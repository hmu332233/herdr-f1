import type { AgentStatus, EntryPresentation, RacePresentation } from '../../src/shared/presentation.js';
import type { SourceAgent, SourceSnapshot, SourceTeam } from '../../src/server/herdr/types.js';
import type { RaceSession } from '../../src/server/race-session.js';

export function agent(
  terminalID: string,
  status: AgentStatus,
  overrides: Partial<SourceAgent> = {},
): SourceAgent {
  return {
    terminalID,
    paneID: `pane-${terminalID}`,
    tabLabel: `tab-${terminalID}`,
    agentKind: 'claude',
    agentSessionReference: null,
    isFocused: false,
    status,
    ...overrides,
  };
}

export function team(id: string, label: string, agents: SourceAgent[]): SourceTeam {
  return { id, label, agents };
}

export function snap(...teams: SourceTeam[]): SourceSnapshot {
  return { teams };
}

/** Bootstrap: snapshot then live connection, both at `now`. */
export function goLive(session: RaceSession, snapshot: SourceSnapshot, now = 0): void {
  session.applySnapshot(snapshot, now);
  session.applyConnection({ kind: 'live' }, now);
  session.advance(now);
}

/** Advances in fixed steps (default 1 s — at most RaceRules.maximumAcceptedStep). */
export function tickTo(session: RaceSession, from: number, to: number, step = 1): number {
  let now = from;
  while (now < to - 1e-9) {
    now = Math.min(now + step, to);
    session.advance(now);
  }
  return now;
}

export function entryById(presentation: RacePresentation, id: string): EntryPresentation {
  const entry = presentation.teams.flatMap(t => t.entries).find(e => e.id === id);
  if (!entry) throw new Error(`entry ${id} not in presentation`);
  return entry;
}
