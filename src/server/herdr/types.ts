import type { AgentStatus, ConnectionState } from '../../shared/presentation.js';

/** One detected agent, projected from an authoritative herdr snapshot.
 *  The terminal ID is the durable car identity and the focus target. */
export interface SourceAgent {
  terminalID: string;
  paneID: string;
  workspaceID: string;
  tabLabel: string;
  agentKind: string;
  /** Opaque session identity used only for NEW STINT detection.
   *  Must never appear in visible text. */
  agentSessionReference: string | null;
  isFocused: boolean;
  status: AgentStatus;
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
}

export type HerdrUpdate =
  | { kind: 'snapshot'; snapshot: SourceSnapshot }
  | { kind: 'connection'; state: ConnectionState };

export function allAgents(snapshot: SourceSnapshot): SourceAgent[] {
  return snapshot.teams.flatMap(team => team.agents);
}
