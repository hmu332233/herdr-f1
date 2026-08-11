import { setTimeout as sleep } from 'node:timers/promises';
import { WebSocket } from 'ws';
import { afterEach, describe, expect, it } from 'vitest';
import { createCrewTracker } from '../src/server/multiplayer/join.js';
import { createVenueShuffleBag, randomVenue, startHost, type HostHandle } from '../src/server/multiplayer/host.js';
import { createParticipantRegistry } from '../src/server/multiplayer/registry.js';
import { MultiplayerRules } from '../src/server/rules.js';
import { createUptimeTracker } from '../src/server/multiplayer/uptime.js';
import {
  decodeHostMessage, decodeJoinMessage, emptyCounters, emptyCrewReport,
  MULTIPLAYER_PROTOCOL, normalizeParticipantName, type CrewCounters,
  type CrewReport, type HostMessage,
} from '../src/server/multiplayer/wire.js';
import type { AgentStatus } from '../src/shared/presentation.js';
import type { SourceAgent, SourceSnapshot } from '../src/server/herdr/types.js';
import type { SyncMessage } from '../src/shared/protocol.js';
import { waitUntil } from './helpers/fake-herdr.js';

const crew = (size: number, working: number, blocked = 0, counters: Partial<CrewCounters> = {}): CrewReport =>
  ({ size, working, idle: size - working - blocked, done: 0, blocked, counters: { ...emptyCounters(), ...counters } });

describe('wire', () => {
  it('normalizes participant names and rejects unusable ones', () => {
    expect(normalizeParticipantName('  mark ')).toBe('mark');
    expect(normalizeParticipantName('')).toBeNull();
    expect(normalizeParticipantName('x'.repeat(25))).toBeNull();
    expect(normalizeParticipantName('a\x07b')).toBeNull();
  });

  it('decodes valid join messages', () => {
    expect(decodeJoinMessage(JSON.stringify({ type: 'hello', protocol: 3, name: ' mark ' })))
      .toEqual({ type: 'hello', protocol: 3, name: 'mark' });
    expect(decodeJoinMessage(JSON.stringify({ type: 'offline' }))).toEqual({ type: 'offline' });
    expect(decodeJoinMessage(JSON.stringify({ type: 'snapshot', crews: [crew(3, 2, 1), crew(2, 0)] })))
      .toEqual({ type: 'snapshot', crews: [crew(3, 2, 1), crew(2, 0)] });
    expect(decodeJoinMessage(JSON.stringify({ type: 'snapshot', crews: [] })))
      .toEqual({ type: 'snapshot', crews: [] });
  });

  it('rejects malformed join input outright', () => {
    for (const raw of [
      'not json',
      '[]',
      JSON.stringify({ type: 'hello', protocol: '2', name: 'mark' }),
      JSON.stringify({ type: 'snapshot' }),
      JSON.stringify({ type: 'snapshot', crews: [crew(1, 0), crew(1, 0), crew(1, 0)] }),
      JSON.stringify({ type: 'snapshot', crews: [{ ...crew(2, 2), blocked: 1 }] }), // working+blocked > size
      JSON.stringify({ type: 'snapshot', crews: [{ ...crew(2, 1), size: -1 }] }),
      JSON.stringify({ type: 'snapshot', crews: [{ ...crew(2, 1), working: 1.5 }] }),
      JSON.stringify({ type: 'snapshot', crews: [{ ...crew(2, 1), counters: null }] }),
      JSON.stringify({
        type: 'snapshot',
        crews: [{ size: 1, working: 1, blocked: 0, counters: emptyCounters() }],
      }), // protocol-v2 crew omitted idle/done
      JSON.stringify({ type: 'snapshot', crews: [crew(2, 1, 0, { stints: -1 })] }),
      JSON.stringify({ type: 'snapshot', crews: [crew(2, 1, 0, { stints: 2_000_000_000 })] }),
      JSON.stringify({ type: 'focus', terminalID: 't1' }),
    ]) {
      expect(decodeJoinMessage(raw), raw).toBeNull();
    }
  });

  it('decodes host replies', () => {
    expect(decodeHostMessage(JSON.stringify({ type: 'welcome' }))).toEqual({ type: 'welcome' });
    expect(decodeHostMessage(JSON.stringify({ type: 'reject', reason: 'no' })))
      .toEqual({ type: 'reject', reason: 'no' });
    expect(decodeHostMessage('nope')).toBeNull();
  });
});

describe('uptime tracker', () => {
  it('integrates piecewise-constant power over the window', () => {
    const tracker = createUptimeTracker(90);
    expect(tracker.uptime(100)).toBe(0);
    tracker.setPower(0, 1);
    expect(tracker.uptime(45)).toBeCloseTo(0.5, 6);
    expect(tracker.uptime(90)).toBeCloseTo(1, 6);
    expect(tracker.uptime(500)).toBeCloseTo(1, 6);
  });

  it('decays after power drops and survives pruning', () => {
    const tracker = createUptimeTracker(90);
    tracker.setPower(0, 1);
    tracker.setPower(30, 0);
    expect(tracker.uptime(90)).toBeCloseTo(30 / 90, 6);
    expect(tracker.uptime(120)).toBeCloseTo(0, 6);
    // Old change points are pruned; the sustained value must remain correct.
    tracker.setPower(200, 1);
    expect(tracker.uptime(1000)).toBeCloseTo(1, 6);
  });

  it('lets a same-instant correction win', () => {
    const tracker = createUptimeTracker(90);
    tracker.setPower(10, 1);
    tracker.setPower(10, 0);
    expect(tracker.uptime(100)).toBe(0);
  });
});

describe('crew tracker (join side)', () => {
  const agent = (id: string, status: AgentStatus, session: string | null = null): SourceAgent => ({
    terminalID: id, paneID: `p-${id}`, tabLabel: `secret tab ${id}`,
    agentKind: 'claude', agentSessionReference: session, isFocused: false, status,
  });
  const snap = (...agents: SourceAgent[]): SourceSnapshot =>
    ({ teams: [{ id: 'ws-1', label: 'secret workspace', agents }] });

  it('splits agents into two near-even crews, deterministically', () => {
    const tracker = createCrewTracker();
    const first = tracker.update(snap(agent('a', 'working'), agent('b', 'idle'), agent('c', 'working')));
    expect(first.map(report => report.size).sort()).toEqual([1, 2]);
    expect(first[0].size + first[1].size).toBe(3);
    const again = createCrewTracker().update(
      snap(agent('a', 'working'), agent('b', 'idle'), agent('c', 'working')));
    expect(again.map(report => report.size)).toEqual(first.map(report => report.size));
    expect(again.map(report => report.working)).toEqual(first.map(report => report.working));
  });

  it('reports only aggregates — nothing identifying survives serialization', () => {
    const reports = createCrewTracker().update(snap(agent('terminal-007', 'working', '/home/me/secret')));
    const serialized = JSON.stringify(reports);
    expect(serialized).not.toContain('terminal-007');
    expect(serialized).not.toContain('secret');
    expect(serialized).not.toContain('claude');
    expect(reports[0]).toEqual(crew(1, 1));
    expect(reports[1]).toEqual(crew(0, 0));
  });

  it('accumulates transition counters per crew', () => {
    const tracker = createCrewTracker();
    tracker.update(snap(agent('a', 'working')));
    tracker.update(snap(agent('a', 'idle')));       // pits
    tracker.update(snap(agent('a', 'working')));    // greens
    tracker.update(snap(agent('a', 'blocked')));    // incidents
    tracker.update(snap(agent('a', 'working')));    // recoveries
    const reports = tracker.update(snap(agent('a', 'done')));  // chequered
    expect(reports[0].counters).toEqual(
      { incidents: 1, recoveries: 1, pits: 1, greens: 1, chequered: 1, stints: 0 });
  });

  it('counts a replaced agent session as a stint', () => {
    const tracker = createCrewTracker();
    tracker.update(snap(agent('a', 'working', 'session-1')));
    const reports = tracker.update(snap(agent('a', 'working', 'session-2')));
    expect(reports[0].counters.stints).toBe(1);
  });

  it('forgets departed agents without corrupting counters', () => {
    const tracker = createCrewTracker();
    tracker.update(snap(agent('a', 'working')));
    tracker.update(snap()); // a is gone
    const reports = tracker.update(snap(agent('a', 'idle')));
    // Reappearing with a different status is not a transition; nothing fired.
    expect(reports[0].counters).toEqual(emptyCounters());
    expect(reports[0].size).toBe(1);
  });
});

describe('participant registry', () => {
  it('rejects a connected name and resumes a disconnected one', () => {
    const registry = createParticipantRegistry();
    expect(registry.connect('mark')).toBe(true);
    expect(registry.connect('mark')).toBe(false);
    registry.disconnect('mark', 0);
    expect(registry.connect('mark')).toBe(true);
  });

  it('synthesizes up to two cars with crew arithmetic on display', () => {
    const registry = createParticipantRegistry();
    registry.connect('mark');
    registry.update('mark', [crew(3, 1), crew(2, 0, 1)], 0);
    const [team] = registry.snapshot().teams;
    expect(team.id).toBe('mark');
    expect(team.agents.map(car => car.terminalID)).toEqual(['mark/car1', 'mark/car2']);
    expect(team.agents.map(car => car.tabLabel)).toEqual(['car 1', 'car 2']);
    expect(team.agents.map(car => car.agentKind)).toEqual(['crew 1/3', 'crew 0/2']);
    expect(team.agents.map(car => car.status)).toEqual(['working', 'blocked']);
    expect(team.agents.every(car => !car.isFocused)).toBe(true);
  });

  it('derives continuous crew state by blocked, working, all-done, all-idle priority', () => {
    const registry = createParticipantRegistry('continuous');
    registry.connect('mark');
    const report = (
      working: number, idle: number, done: number, blocked: number,
    ): CrewReport => ({
      size: working + idle + done + blocked,
      working, idle, done, blocked, counters: emptyCounters(),
    });

    for (const [crewReport, expected] of [
      [report(1, 0, 0, 1), 'blocked'],
      [report(1, 1, 0, 0), 'working'],
      [report(0, 0, 2, 0), 'done'],
      [report(0, 2, 0, 0), 'idle'],
      [report(0, 1, 1, 0), 'cruising'],
    ] as const) {
      registry.update('mark', [crewReport, emptyCrewReport()], 0);
      expect(registry.snapshot().teams[0].agents[0].crewState).toBe(expected);
    }
  });

  it('retains offline crew counts while forcing continuous pace to cruising', () => {
    const registry = createParticipantRegistry('continuous');
    registry.connect('mark');
    registry.update('mark', [{
      size: 2, working: 0, idle: 0, done: 0, blocked: 2, counters: emptyCounters(),
    }, emptyCrewReport()], 0);
    registry.markOffline('mark', 1);
    const car = registry.snapshot().teams[0].agents[0];
    expect(car.crewCounts).toEqual({ working: 0, idle: 0, done: 0, blocked: 2 });
    expect(car.isLastKnown).toBe(true);
    expect(car.status).toBe('idle');
    expect(registry.paceFactors(1)[0].factor).toBe(MultiplayerRules.cruisingFactor);
  });

  it('compresses continuous working uptime into a 1.0x to 1.02x band', () => {
    const registry = createParticipantRegistry('continuous');
    registry.connect('mark');
    registry.update('mark', [crew(1, 1), crew(0, 0)], 0);
    expect(registry.paceFactors(0)[0].factor).toBe(1);
    expect(registry.paceFactors(45)[0].factor).toBeCloseTo(1.01, 8);
    expect(registry.paceFactors(90)[0].factor).toBeCloseTo(1.02, 8);
  });

  it('fields one car for a one-agent participant', () => {
    const registry = createParticipantRegistry();
    registry.connect('solo');
    registry.update('solo', [crew(1, 1), crew(0, 0)], 0);
    const [team] = registry.snapshot().teams;
    expect(team.agents).toHaveLength(1);
    expect(team.agents[0].terminalID).toBe('solo/car1');
  });

  it('pits the cars on disconnect and on a herdr outage, keeping the team', () => {
    const registry = createParticipantRegistry();
    registry.connect('mark');
    registry.update('mark', [crew(2, 2), crew(1, 1)], 0);
    expect(registry.snapshot().teams[0].agents.map(car => car.status)).toEqual(['working', 'working']);

    registry.markOffline('mark', 10);
    let [team] = registry.snapshot().teams;
    expect(team.agents.map(car => car.status)).toEqual(['idle', 'idle']);
    expect(team.agents.map(car => car.agentKind)).toEqual(['crew 0/2', 'crew 0/1']);

    registry.update('mark', [crew(2, 1), crew(1, 1)], 20);
    expect(registry.snapshot().teams[0].agents.map(car => car.status)).toEqual(['working', 'working']);

    registry.disconnect('mark', 30);
    [team] = registry.snapshot().teams;
    expect(team.agents.map(car => car.status)).toEqual(['idle', 'idle']);
  });

  it('keeps stint identity monotonic across join restarts', () => {
    const registry = createParticipantRegistry();
    registry.connect('mark');
    // First report baselines: a pre-existing count is not an event.
    registry.update('mark', [crew(1, 1, 0, { stints: 5 }), crew(0, 0)], 0);
    expect(registry.snapshot().teams[0].agents[0].agentSessionReference).toBe('stint-0');
    registry.update('mark', [crew(1, 1, 0, { stints: 6 }), crew(0, 0)], 1);
    expect(registry.snapshot().teams[0].agents[0].agentSessionReference).toBe('stint-1');

    // Join restart: counters reset to zero, which must not read as a stint,
    // and later growth must still count.
    registry.disconnect('mark', 2);
    registry.connect('mark');
    registry.update('mark', [crew(1, 1, 0, { stints: 0 }), crew(0, 0)], 3);
    expect(registry.snapshot().teams[0].agents[0].agentSessionReference).toBe('stint-1');
    registry.update('mark', [crew(1, 1, 0, { stints: 1 }), crew(0, 0)], 4);
    expect(registry.snapshot().teams[0].agents[0].agentSessionReference).toBe('stint-2');
  });

  it('earns pace through rolling uptime', () => {
    const registry = createParticipantRegistry();
    registry.connect('mark');
    registry.update('mark', [crew(1, 0), crew(0, 0)], 0);
    // Never worked: floor speed.
    expect(registry.paceFactors(0)).toEqual([{ terminalID: 'mark/car1', factor: 0.75 }]);
    // Full window of work: full speed.
    registry.update('mark', [crew(1, 1), crew(0, 0)], 100);
    expect(registry.paceFactors(190)[0].factor).toBeCloseTo(1.25, 6);
    // Half the window since the crew stopped: halfway back down.
    registry.update('mark', [crew(1, 0), crew(0, 0)], 190);
    expect(registry.paceFactors(235)[0].factor).toBeCloseTo(1.0, 6);
  });
});

describe('startHost', () => {
  let host: HostHandle | null = null;
  const sockets: WebSocket[] = [];

  afterEach(async () => {
    for (const socket of sockets) socket.close();
    sockets.length = 0;
    await host?.close();
    host = null;
  });

  async function makeHost(circuit?: 'herdr' | 'suzuka'): Promise<number> {
    host = await startHost({ port: 4960, bindHost: '127.0.0.1', circuit });
    return host.port;
  }

  function track(socket: WebSocket): WebSocket {
    sockets.push(socket);
    return socket;
  }

  async function join(port: number, name: string, protocol = MULTIPLAYER_PROTOCOL) {
    const socket = track(new WebSocket(`ws://127.0.0.1:${port}/join`));
    const replies: HostMessage[] = [];
    socket.on('message', raw => replies.push(JSON.parse(String(raw))));
    socket.on('open', () => socket.send(JSON.stringify({ type: 'hello', protocol, name })));
    await waitUntil(() => replies.length >= 1);
    return { socket, replies };
  }

  function viewer(port: number) {
    const socket = track(new WebSocket(`ws://127.0.0.1:${port}/ws`, {
      origin: `http://127.0.0.1:${port}`,
    }));
    const syncs: SyncMessage[] = [];
    socket.on('message', raw => syncs.push(JSON.parse(String(raw))));
    return { socket, syncs };
  }

  const latest = (syncs: SyncMessage[]) => syncs[syncs.length - 1];

  it('races pushed crew reports as a two-car team', async () => {
    const port = await makeHost();
    const { socket, replies } = await join(port, 'mark');
    expect(replies[0]).toEqual({ type: 'welcome' });
    socket.send(JSON.stringify({ type: 'snapshot', crews: [crew(3, 2), crew(2, 1)] }));

    const { syncs } = viewer(port);
    await waitUntil(() => syncs.length > 0 && latest(syncs).teams.length === 1);
    const sync = latest(syncs);
    expect(sync.connection.kind).toBe('live');
    const [team] = sync.teams;
    expect(team.label).toBe('mark');
    expect(new Set(team.entries.map(entry => entry.id))).toEqual(new Set(['mark/car1', 'mark/car2']));
    expect(new Set(team.entries.map(entry => entry.agentKind))).toEqual(new Set(['crew 2/3', 'crew 1/2']));
    for (const entry of team.entries) {
      expect(entry.status).toBe('working');
      expect(entry.displaySpeed).toBeGreaterThan(0);
    }
  });

  it('rejects a name that is currently connected and resumes it after a disconnect', async () => {
    const port = await makeHost();
    const first = await join(port, 'mark');
    expect(first.replies[0].type).toBe('welcome');

    const duplicate = await join(port, 'mark');
    expect(duplicate.replies[0].type).toBe('reject');
    expect((duplicate.replies[0] as { reason: string }).reason).toContain('already connected');

    first.socket.close();
    let resumed = false;
    for (let attempt = 0; attempt < 20 && !resumed; attempt += 1) {
      const retry = await join(port, 'mark');
      resumed = retry.replies[0].type === 'welcome';
      retry.socket.close();
      if (!resumed) await sleep(50);
    }
    expect(resumed).toBe(true);
  });

  it('rejects protocol mismatches and non-handshake openings with a reason', async () => {
    const port = await makeHost();
    const wrongVersion = await join(port, 'mark', MULTIPLAYER_PROTOCOL - 1);
    expect(wrongVersion.replies[0].type).toBe('reject');
    expect((wrongVersion.replies[0] as { reason: string }).reason).toContain('protocol');

    const socket = track(new WebSocket(`ws://127.0.0.1:${port}/join`));
    const replies: HostMessage[] = [];
    socket.on('message', raw => replies.push(JSON.parse(String(raw))));
    socket.on('open', () => socket.send(JSON.stringify({ type: 'snapshot', crews: [] })));
    await waitUntil(() => replies.length >= 1);
    expect(replies[0].type).toBe('reject');
  });

  it('pins the launch circuit and ignores viewer distance writes', async () => {
    const port = await makeHost('suzuka');
    const { socket } = await join(port, 'mark');
    socket.send(JSON.stringify({ type: 'snapshot', crews: [crew(1, 1), crew(0, 0)] }));

    const { socket: viewerSocket, syncs } = viewer(port);
    await waitUntil(() => syncs.length > 0);
    expect(latest(syncs).circuitID).toBe('suzuka');
    expect(latest(syncs).totalLaps).toBe(53);

    viewerSocket.send(JSON.stringify({ type: 'circuit', totalLaps: 1 }));
    const count = syncs.length;
    await waitUntil(() => syncs.length > count + 1);
    expect(latest(syncs).totalLaps).toBe(53);
    expect(latest(syncs).phase).toBe('live');
  });

  it('starts on a random circuit when the host omits --circuit', async () => {
    host = await startHost({
      port: 4960,
      bindHost: '127.0.0.1',
      random: () => 0.5,
      raceMode: 'continuous',
    });

    const { syncs } = viewer(host.port);
    await waitUntil(() => syncs.length > 0);
    expect(latest(syncs).circuitID).toBe('suzuka');
    expect(latest(syncs).totalLaps).toBe(53);
  });

  it('pits a departed participant but keeps the team on the board', async () => {
    const port = await makeHost();
    const { socket } = await join(port, 'mark');
    socket.send(JSON.stringify({ type: 'snapshot', crews: [crew(1, 1), crew(0, 0)] }));

    const { syncs } = viewer(port);
    await waitUntil(() =>
      syncs.length > 0 && latest(syncs).teams[0]?.entries[0]?.status === 'working');

    socket.close();
    await waitUntil(() =>
      latest(syncs).teams[0]?.entries[0]?.status === 'idle');
    const entry = latest(syncs).teams[0].entries[0];
    expect(entry.statusText).toBe('PIT');
    expect(entry.placement.kind).toBe('pit');
    expect(entry.agentKind).toBe('crew 0/1');
  });

  it('accepts viewers on whichever host they connected to, and no other origin', async () => {
    const port = await makeHost();
    const viaLocalhost = track(new WebSocket(`ws://localhost:${port}/ws`, {
      origin: `http://localhost:${port}`,
    }));
    await new Promise<void>((resolve, reject) => {
      viaLocalhost.once('open', () => resolve());
      viaLocalhost.once('error', reject);
    });

    const evil = track(new WebSocket(`ws://127.0.0.1:${port}/ws`, {
      origin: 'https://example.com',
    }));
    const status = await new Promise<number | undefined>((resolve, reject) => {
      evil.once('unexpected-response', (_request, response) => {
        response.resume();
        resolve(response.statusCode);
      });
      evil.once('open', () => reject(new Error('cross-origin viewer was accepted')));
      evil.once('error', () => {});
    });
    expect(status).toBe(403);
  });
});

describe('multiplayer circuit rotation', () => {
  it('selects the opening venue from every circuit when none is specified', () => {
    expect(randomVenue(() => 0)).toBe('herdr');
    expect(randomVenue(() => 0.5)).toBe('suzuka');
    expect(randomVenue(() => 0.999999)).toBe('las-vegas');
  });

  it('uses every venue once per shuffle-bag cycle without a boundary repeat', () => {
    const bag = createVenueShuffleBag('herdr', () => 0.5);
    const restOfFirstCycle = Array.from({ length: 4 }, () => bag.next());
    expect(new Set(['herdr', ...restOfFirstCycle]).size).toBe(5);

    const secondCycle = Array.from({ length: 5 }, () => bag.next());
    expect(new Set(secondCycle).size).toBe(5);
    expect(secondCycle[0]).not.toBe(restOfFirstCycle.at(-1));
  });
});
