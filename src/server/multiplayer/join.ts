import { setTimeout as sleep } from 'node:timers/promises';
import { WebSocket } from 'ws';
import { createHerdrClient } from '../herdr/client.js';
import { allAgents, type SourceSnapshot } from '../herdr/types.js';
import { MultiplayerRules, stableHash } from '../rules.js';
import type { AgentStatus } from '../../shared/presentation.js';
import {
  CREWS_PER_TEAM, decodeHostMessage, emptyCounters, emptyCrewReport,
  MULTIPLAYER_PROTOCOL, type CrewCounters, type CrewReport, type JoinMessage,
} from './wire.js';

/**
 * Projects local herdr snapshots into the two-car wire format (M2/M7): agents
 * are split into per-car crews on this side, and only aggregates — counts and
 * cumulative transition counters — ever leave the machine. Names, per-agent
 * IDs, and session references are not even hashed anymore; they simply are
 * not sent.
 */
export function createCrewTracker() {
  const previousStatus = new Map<string, AgentStatus>();
  const previousSession = new Map<string, string>();
  /** Cumulative per-crew transition counts since this process started (M8). */
  const counters: CrewCounters[] = [emptyCounters(), emptyCounters()];

  function update(snapshot: SourceSnapshot): CrewReport[] {
    const agents = allAgents(snapshot);
    // Deterministic split (M2): stable hash order, alternating assignment.
    // The same agent set always lands in the same crews — across reconnects
    // too — and the two crews never differ in size by more than one.
    const ordered = agents
      .slice()
      .sort((a, b) => {
        const ha = stableHash(a.terminalID);
        const hb = stableHash(b.terminalID);
        return ha < hb ? -1 : ha > hb ? 1 : a.terminalID < b.terminalID ? -1 : 1;
      });

    const crews: CrewReport[] = [emptyCrewReport(), emptyCrewReport()];
    const seen = new Set<string>();
    ordered.forEach((agent, index) => {
      const crewIndex = index % CREWS_PER_TEAM;
      const crew = crews[crewIndex];
      crew.size += 1;
      if (agent.status === 'working') crew.working += 1;
      if (agent.status === 'idle') crew.idle += 1;
      if (agent.status === 'done') crew.done += 1;
      if (agent.status === 'blocked') crew.blocked += 1;
      seen.add(agent.terminalID);

      const before = previousStatus.get(agent.terminalID);
      if (before !== undefined && before !== agent.status) {
        countTransition(counters[crewIndex], before, agent.status);
      }
      previousStatus.set(agent.terminalID, agent.status);

      const session = agent.agentSessionReference;
      if (session !== null) {
        const knownSession = previousSession.get(agent.terminalID);
        if (knownSession !== undefined && knownSession !== session) {
          counters[crewIndex].stints += 1;
        }
        previousSession.set(agent.terminalID, session);
      }
    });
    for (const id of [...previousStatus.keys()]) {
      if (!seen.has(id)) {
        previousStatus.delete(id);
        previousSession.delete(id);
      }
    }

    // Counters are cumulative and stay attached to their crew even after the
    // agents that produced them move on; reports always carry both crews.
    crews[0].counters = { ...counters[0] };
    crews[1].counters = { ...counters[1] };
    return crews;
  }

  return { update };
}

function countTransition(counters: CrewCounters, before: AgentStatus, after: AgentStatus): void {
  // Mirrors the radio vocabulary: blocked takes precedence, then the rest.
  if (after === 'blocked') counters.incidents += 1;
  else if (before === 'blocked') counters.recoveries += 1;
  else if (after === 'done') counters.chequered += 1;
  else if (before === 'working' && after === 'idle') counters.pits += 1;
  else if (before === 'idle' && after === 'working') counters.greens += 1;
}

export interface JoinOptions {
  host: string;
  port: number;
  name: string;
  socketPath: string;
}

/**
 * Foreground reporter (design decision 9): reads the local herdr socket and
 * pushes crew aggregates to the host until Ctrl+C. Runs no server of its own.
 * The host connection is outbound, so NAT needs no port forwarding.
 */
export async function runJoin(options: JoinOptions): Promise<void> {
  const url = `ws://${bracketed(options.host)}:${options.port}/join`;
  let stopped = false;
  let fatalReason: string | null = null;
  let socket: WebSocket | null = null;
  let welcomed = false;
  const tracker = createCrewTracker();
  /** What the host should currently believe; replayed after every reconnect. */
  let latest: JoinMessage | null = null;

  const push = (message: JoinMessage): void => {
    if (welcomed && socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
  };
  const closeSocket = (): void => socket?.close();

  const client = createHerdrClient({ socketPath: options.socketPath });
  client.start(update => {
    if (update.kind === 'snapshot') {
      latest = { type: 'snapshot', crews: tracker.update(update.snapshot) };
    } else if (update.state.kind === 'live') {
      return; // the client fetches an authoritative snapshot right after going live
    } else {
      // Local Herdr feed is down: the host applies the selected mode's offline
      // rule without presenting this retained report as live telemetry.
      latest = { type: 'offline' };
    }
    push(latest);
  });

  // Aborting cuts a pending backoff sleep short, so Ctrl+C exits immediately
  // instead of waiting out a timer that can be 30 seconds long.
  const stopController = new AbortController();
  const onSignal = () => {
    stopped = true;
    stopController.abort();
    closeSocket();
  };
  process.once('SIGINT', onSignal);
  process.once('SIGTERM', onSignal);

  console.log(`Herdr F1 · joining ${options.host}:${options.port} as "${options.name}" · Ctrl+C to leave`);
  // Same backoff shape as the herdr client: reset on success, double to a cap.
  let delayMs = 1000;
  while (!stopped && fatalReason === null) {
    await new Promise<void>(resolve => {
      const ws = new WebSocket(url);
      socket = ws;
      ws.on('open', () => {
        ws.send(JSON.stringify({ type: 'hello', protocol: MULTIPLAYER_PROTOCOL, name: options.name }));
      });
      ws.on('message', raw => {
        const message = decodeHostMessage(String(raw));
        if (message?.type === 'welcome') {
          welcomed = true;
          delayMs = 1000;
          console.log(
            `Connected. Team "${options.name}" fields ${MultiplayerRules.carsPerTeam} cars; ` +
            'your agents are the crews.',
          );
          if (latest) push(latest);
        } else if (message?.type === 'reject') {
          fatalReason = message.reason;
        }
      });
      ws.on('error', () => {}); // 'close' always follows
      ws.on('close', () => {
        if (welcomed && !stopped && fatalReason === null) {
          console.log('Lost the host; reconnecting…');
        }
        welcomed = false;
        socket = null;
        resolve();
      });
    });
    if (stopped || fatalReason !== null) break;
    try {
      await sleep(delayMs, undefined, { signal: stopController.signal });
    } catch {
      break; // the signal handler aborted the backoff
    }
    delayMs = Math.min(delayMs * 2, 30000);
  }

  process.removeListener('SIGINT', onSignal);
  process.removeListener('SIGTERM', onSignal);
  client.stop();
  closeSocket();
  if (fatalReason !== null) {
    console.error(`Join rejected: ${fatalReason}`);
    process.exitCode = 1;
  } else {
    console.log('Left the session. Your team and points stay on the host until it shuts down.');
  }
}

/** Raw IPv6 addresses need brackets in a URL authority. */
function bracketed(host: string): string {
  return host.includes(':') ? `[${host}]` : host;
}
