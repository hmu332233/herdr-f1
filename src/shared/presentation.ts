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

/** Track condition, in the sense a marshal would signal it.
 *
 *  `yellow` is raised while any car is stopped on the circuit — a blocked
 *  agent — and cleared as soon as the last of them is recovered. Unlike
 *  RaceOverlay this is not full-screen and does not suspend anything: the race
 *  keeps scoring underneath it, so it is a separate field rather than another
 *  overlay kind. */
export type FlagState =
  | { kind: 'green' }
  | {
      kind: 'yellow';
      /** Terminal IDs of the cars that caused it, in standings order. The
       *  dashboard flashes exactly these entries. */
      terminalIDs: string[];
    };

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
  /** One-based lap derived from official distance, capped at the race distance. */
  lap: number;
  /** `LAP n`, `PIT`, `DONE · LAP n`, `INCIDENT · LAP n`, `RETIRED · LAP n`, `NEXT GRID`. */
  statusText: string;
  placement: EntryPlacement;
  /** Display motion in laps/second for client-side extrapolation between syncs. */
  displaySpeed: number;
  isFocused: boolean;
  showsNewStint: boolean;
  /** This car is why the yellow flag is out, so it flashes with the track.
   *  Blocked and still in the race — a blocked agent that has retired or is
   *  queued for the next grid is off the circuit and brings out nothing. */
  causesYellowFlag: boolean;
}

/** Why a radio message fired. Derived purely from agent status transitions —
 *  terminal output and conversation content are never read. */
export type RadioKind =
  | 'boxBox'      // working → idle
  | 'greenAgain'  // idle → working
  | 'incident'    // → blocked
  | 'recovered'   // blocked → working or idle
  | 'chequered'   // → done
  | 'newStint'    // agent session replaced
  | 'retired';    // gone from the authoritative snapshot

/** One team-radio line. The text is generated race fiction in the same spirit
 *  as laps and points; it is never an agent's actual output. */
export interface RadioMessage {
  /** Monotonic within a Grand Prix. The client's de-duplication key. */
  id: number;
  kind: RadioKind;
  /** Durable terminal ID, so a radio line is an agent.focus target too. */
  terminalID: string;
  carNumber: number;
  colorToken: TeamColorToken;
  /** Workspace acting as the team, and the tab the agent runs in. */
  teamLabel: string;
  tabLabel: string;
  lap: number;
  text: string;
  /** Wall-clock time the line was emitted, as `HH:MM:SS` in the server's local
   *  zone. Preformatted because the race clock is monotonic — there is no
   *  timestamp the browser could derive this from. */
  timeText: string;
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
  /** One-based leader lap for the `LAP n / totalLaps` header, capped at it. */
  headerLap: number;
  /** Race distance in laps, for the circuit currently being raced. The browser
   *  renders `LAP headerLap / totalLaps` from this rather than a constant, since
   *  each venue has its own published distance. */
  totalLaps: number;
  teams: TeamStanding[];
  podium: PodiumResult | null;
  connection: ConnectionState;
  overlay: RaceOverlay;
  /** Track condition. Yellow while any car is stopped on the circuit. */
  flag: FlagState;
  /** Recent team radio, oldest first, capped at RaceRules.radioHistoryLimit.
   *  Sync carries the whole window rather than deltas, so a reconnecting or
   *  reloading browser recovers the backlog for free. */
  radio: RadioMessage[];
}
