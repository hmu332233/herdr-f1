import type { RaceSession } from './race-session.js';
import { stableHash } from './rules.js';
import type { AgentStatus, ConnectionState } from '../shared/presentation.js';
import type { SourceAgent, SourceSnapshot } from './herdr/types.js';

export const FIXTURE_NAMES = ['grid', 'dense', 'redflag', 'error', 'podium'] as const;

/** Deterministic grids used to review the dashboard without a live herdr. */
export function loadFixture(name: string, session: RaceSession): void {
  switch (name) {
    case 'dense': dense(session); break;
    case 'redflag': connectionFixture(session, { kind: 'offline' }); break;
    case 'error':
      connectionFixture(session, { kind: 'protocolError', detail: 'Unsupported Herdr protocol 999' });
      break;
    case 'podium': podium(session); break;
    default: grid(session);
  }
}

type TeamSpec = [id: string, label: string, agents: SourceAgent[]];

function agent(
  id: string, workspace: string, tab: string,
  kind: string, status: AgentStatus, focused = false,
): SourceAgent {
  return {
    terminalID: id, paneID: `pane-${id}`, workspaceID: workspace,
    tabLabel: tab, agentKind: kind, agentSessionReference: null, isFocused: focused, status,
  };
}

function snapshot(teams: TeamSpec[]): SourceSnapshot {
  return { teams: teams.map(([id, label, agents]) => ({ id, label, agents })) };
}

/** Boots a live race, lets everyone work for staggered spans so distances
 *  spread out, then applies the final statuses. */
function race(session: RaceSession, teams: TeamSpec[], seconds: number): void {
  const asWorking = (a: SourceAgent): SourceAgent => ({ ...a, status: 'working' });
  const working = teams.map(([id, label, agents]) => [id, label, agents.map(asWorking)] as TeamSpec);
  session.applySnapshot(snapshot(working), 0);
  session.applyConnection({ kind: 'live' }, 0);
  session.advance(0);

  let now = 0;
  // Deterministic mixing: settle agents in stable-hash order so the same
  // fixture always produces the same spread of distances.
  const flattened = teams
    .flatMap(([, , agents]) => agents)
    .sort((a, b) => (stableHash(a.terminalID) < stableHash(b.terminalID) ? -1 : 1));
  const stagger = seconds / Math.max(1, flattened.length);
  const settled = new Map<string, SourceAgent>();
  flattened.forEach((item, index) => {
    const target = (index + 1) * stagger;
    while (now < target - 1e-9) {
      now = Math.min(now + 1, target);
      session.advance(now);
    }
    settled.set(item.terminalID, item);
    const mixed = teams.map(
      ([id, label, agents]) =>
        [id, label, agents.map(a => settled.get(a.terminalID) ?? asWorking(a))] as TeamSpec,
    );
    session.applySnapshot(snapshot(mixed), now);
  });
}

function standardTeams(): TeamSpec[] {
  return [
    ['ws-herdr', 'herdr', [
      agent('t1', 'ws-herdr', 'core', 'claude', 'working'),
      agent('t2', 'ws-herdr', 'socket', 'codex', 'working', true),
      agent('t3', 'ws-herdr', 'tests', 'claude', 'idle'),
    ]],
    ['ws-pet', 'agent-pet', [
      agent('t4', 'ws-pet', 'dashboard', 'claude', 'working'),
      agent('t5', 'ws-pet', 'track', 'claude', 'done'),
      agent('t6', 'ws-pet', 'standings', 'codex', 'blocked'),
      agent('t7', 'ws-pet', 'fixtures', 'claude', 'idle'),
    ]],
    ['ws-console', 'console-api', [
      agent('t8', 'ws-console', 'billing', 'codex', 'working'),
      agent('t9', 'ws-console', 'auth', 'claude', 'idle'),
    ]],
    ['ws-infra', 'infra-tools', [
      agent('t10', 'ws-infra', 'deploy', 'claude', 'working'),
      agent('t11', 'ws-infra', 'monitor', 'aider', 'done'),
      agent('t12', 'ws-infra', 'runbook', 'codex', 'working'),
    ]],
  ];
}

function grid(session: RaceSession): void {
  race(session, standardTeams(), 400);
}

function dense(session: RaceSession): void {
  const statuses: AgentStatus[] = ['working', 'working', 'idle', 'done', 'blocked'];
  const teams: TeamSpec[] = Array.from({ length: 14 }, (_, index) => {
    const id = `ws-${index}`;
    const label = `project-${index}`;
    const agents = Array.from({ length: (index % 3) + 1 }, (_, slot) =>
      agent(`d${index}-${slot}`, id, `pane-${slot}`,
        slot % 2 === 0 ? 'claude' : 'codex', statuses[(index + slot) % statuses.length]));
    return [id, label, agents];
  });
  race(session, teams, 300);
}

function connectionFixture(session: RaceSession, state: ConnectionState): void {
  race(session, standardTeams(), 400);
  session.applyConnection(state, 500);
}

function podium(session: RaceSession): void {
  race(session, standardTeams(), 120);
  let now = 500;
  while (session.presentation().phase === 'live' && now < 500 + 60 * 60) {
    now += 1;
    session.advance(now);
  }
}
