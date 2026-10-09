import type {
  AgentStatus, ConnectionState, CrewCounts, CrewState,
} from '../../shared/presentation.js';

/** One detected agent, projected from an authoritative herdr snapshot.
 *  The terminal ID is the durable car identity and the focus target. */
export interface SourceAgent {
  terminalID: string;
  paneID: string;
  tabLabel: string;
  agentKind: string;
  /** Opaque session identity used only for NEW STINT detection.
   *  Must never appear in visible text. */
  agentSessionReference: string | null;
  isFocused: boolean;
  status: AgentStatus;
  /** Multiplayer aggregate metadata. Local Herdr projections omit it. */
  crewState?: CrewState;
  crewCounts?: CrewCounts;
  isLastKnown?: boolean;
}

/** One herdr workspace acting as a racing team. */
export interface SourceTeam {
  id: string;
  label: string;
  agents: SourceAgent[];
}

/** A complete race-ready projection of one authoritative herdr snapshot,
 *  in authoritative workspace order. */
export interface SourceSnapshot {
  teams: SourceTeam[];
  /** Every pane herdr reported, whether or not it currently races. Per-pane
   *  status subscriptions are built from this rather than from `teams`: an
   *  agent whose status is not raceable is absent from `teams`, and herdr has
   *  no session-wide status event, so subscribing only to racing panes would
   *  leave nothing listening for the transition that brings one back.
   *  Non-herdr sources (fixtures, multiplayer) have no panes and omit it. */
  paneIDs?: string[];
}

export type HerdrUpdate =
  | { kind: 'snapshot'; snapshot: SourceSnapshot }
  | { kind: 'connection'; state: ConnectionState };

export function allAgents(snapshot: SourceSnapshot): SourceAgent[] {
  return snapshot.teams.flatMap(team => team.agents);
}
