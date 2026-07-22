/** Authoritative herdr agent status. Only these four states become race entries. */
export type AgentStatus = 'idle' | 'working' | 'done' | 'blocked';

export type ConnectionState =
  | { kind: 'waiting' }
  | { kind: 'live' }
  | { kind: 'offline' }
  | { kind: 'protocolError'; detail: string };

export type RacePhase = 'awaitingGrid' | 'live' | 'podium';

/** Stable team visual identity. `pattern` reuses a hue with a distinct
 *  outline treatment once the 12-color palette is exhausted. */
export interface TeamColorToken {
  kind: 'palette' | 'pattern';
  slot: number;
}

/** Where the marker belongs on the track. `progress` is the fractional lap
 *  position in [0, 1) along the circuit at the sync instant. */
export type EntryPlacement =
  | { kind: 'track'; progress: number }
  | { kind: 'pit' }
  | { kind: 'cooldown'; progress: number }
  | { kind: 'incidentTrack'; progress: number }
  | { kind: 'incidentPit' }
  | { kind: 'retired' }
  | { kind: 'nextGrid' };

/** Full-screen connection/race condition layered over the race phase. */
export type RaceOverlay =
  | { kind: 'none' }
  | { kind: 'formationLap' }
  | { kind: 'noCarsOnGrid' }
  | { kind: 'redFlag' }
  | { kind: 'suspended'; detail: string };

export interface EntryPresentation {
  /** Durable terminal ID: the car identity and the agent.focus target. */
  id: string;
  carNumber: number;
  teamID: string;
  workspaceLabel: string;
  tabLabel: string;
  agentKind: string;
  status: AgentStatus;
  colorToken: TeamColorToken;
  /** Official fractional laps. Owns rank, lap labels, gap, and finish. */
  officialDistance: number;
  /** One-based lap derived from official distance, capped at 58. */
  lap: number;
  /** `LAP n`, `PIT`, `DONE · LAP n`, `INCIDENT · LAP n`, `RETIRED · LAP n`, `NEXT GRID`. */
  statusText: string;
  placement: EntryPlacement;
  /** Display motion in laps/second for client-side extrapolation between syncs. */
  displaySpeed: number;
  isFocused: boolean;
  showsNewStint: boolean;
}

export interface TeamStanding {
  id: string;
  rank: number;
  label: string;
  colorToken: TeamColorToken;
  /** Exact sum of member official distances, including frozen ones. */
  distance: number;
  /** Preformatted `x.x LAPS`. */
  distanceText: string;
  /** `—` for the leader; `+x.xs` under one lap, `+x.x LAPS` otherwise. */
  gapText: string;
  entries: EntryPresentation[];
}

export interface PodiumTeam {
  rank: number;
  label: string;
  colorToken: TeamColorToken;
  distance: number;
}

export interface PodiumResult {
  grandPrix: number;
  top: PodiumTeam[];
}

/** The complete externally observable race state. The browser renders this;
 *  tests assert on it. */
export interface RacePresentation {
  phase: RacePhase;
  grandPrix: number;
  /** One-based leader lap for the `LAP n / 58` header, capped at 58. */
  headerLap: number;
  teams: TeamStanding[];
  podium: PodiumResult | null;
  connection: ConnectionState;
  overlay: RaceOverlay;
}
