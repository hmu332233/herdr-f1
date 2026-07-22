import { RaceRules, seededPace, stableHash, type RacePaceSource } from './rules.js';
import type { HerdrUpdate, SourceAgent, SourceSnapshot } from './herdr/types.js';
import type {
  AgentStatus, ConnectionState, EntryPlacement, EntryPresentation, PodiumResult,
  RaceOverlay, RacePhase, RacePresentation, TeamColorToken, TeamStanding,
} from '../shared/presentation.js';

interface PaceState {
  multiplier: number;
  /** Lap index the multiplier was sampled for; -1 forces a resample. */
  lap: number;
}

interface Entry {
  readonly terminalID: string;
  carNumber: number;
  teamID: string;
  tabLabel: string;
  agentKind: string;
  sessionReference: string | null;
  status: AgentStatus;
  isFocused: boolean;
  official: number;
  display: number;
  pace: PaceState;
  isRetired: boolean;
  isQueuedNextGrid: boolean;
  /** A block that occurs while parked stays a pit-lane incident. */
  incidentInPit: boolean;
  /** Race-time deadline for the transient NEW STINT treatment. */
  newStintUntil: number | null;
  bootstrapIndex: number;
}

/**
 * In-memory race state owner. Consumes authoritative projected herdr
 * snapshots, connection state, and monotonic time (seconds); publishes a
 * complete RacePresentation. All race records are fictional game state that
 * lives only as long as this object. Official distance advances exclusively
 * from accepted elapsed race time, never from render frames.
 */
export function createRaceSession(paceSource: RacePaceSource = seededPace) {
  let lastTick: number | null = null;
  /** Accepted live seconds since the current Grand Prix started. */
  let raceTime = 0;
  let podiumElapsed = 0;
  let phase: RacePhase = 'awaitingGrid';
  let grandPrix = 1;
  let connection: ConnectionState = { kind: 'waiting' };
  let hasSnapshot = false;
  let frozenPodium: PodiumResult | null = null;

  const entries = new Map<string, Entry>();
  let nextBootstrapIndex = 0;
  /** Terminals present in the most recent authoritative snapshot. Absence
   *  from this set (not socket loss) is what retires an entry. */
  let presentInLatestSnapshot = new Set<string>();

  const numberAssignments = new Map<string, number>();
  const usedNumbers = new Set<number>();
  const teamTokens = new Map<string, TeamColorToken>();
  const usedPaletteSlots = new Set<number>();
  let nextPatternSlot = 0;
  const teamOrder = new Map<string, number>();
  let nextTeamOrder = 0;
  const teamLabels = new Map<string, string>();

  // MARK: - Inputs

  function apply(update: HerdrUpdate, now: number): void {
    if (update.kind === 'snapshot') applySnapshot(update.snapshot, now);
    else applyConnection(update.state, now);
  }

  function applyConnection(state: ConnectionState, now: number): void {
    if (connectionEquals(state, connection)) return;
    // Settle scored time up to this instant, then break the tick chain so
    // frozen (offline/error) duration is excluded when live returns.
    advance(now);
    connection = state;
    lastTick = null;
  }

  function applySnapshot(snapshot: SourceSnapshot, now: number): void {
    advance(now);
    reconcile(snapshot);
  }

  /** Advances race time to `now` (monotonic seconds). A single step is capped
   *  at one second so suspensions cannot award phantom laps; time only counts
   *  while the herdr connection is live. */
  function advance(now: number): void {
    const elapsed =
      lastTick === null
        ? 0
        : Math.min(Math.max(0, now - lastTick), RaceRules.maximumAcceptedStep);
    lastTick = now;
    if (connection.kind !== 'live' || elapsed <= 0) return;
    step(elapsed);
  }

  // MARK: - Simulation

  function step(elapsed: number): void {
    switch (phase) {
      case 'awaitingGrid':
        return;
      case 'live':
        raceTime += elapsed;
        scoreLive(elapsed);
        return;
      case 'podium':
        raceTime += elapsed;
        podiumElapsed += elapsed;
        coolDownDisplays(elapsed);
        if (podiumElapsed >= RaceRules.podiumDuration) startNextGrandPrix();
    }
  }

  function scoreLive(elapsed: number): void {
    // The first individual to reach 58 ends the race, so everyone only
    // advances up to the earliest finish instant within this step.
    let earliestFinish = elapsed;
    let finisher: string | null = null;
    for (const entry of entries.values()) {
      if (!isDriving(entry)) continue;
      const official = { value: entry.official };
      const pace = { ...entry.pace };
      const unused = walk(official, pace, entry.terminalID, elapsed);
      if (official.value >= RaceRules.totalLaps) {
        const finishTime = elapsed - unused;
        if (finishTime < earliestFinish || (finishTime === earliestFinish && finisher === null)) {
          earliestFinish = finishTime;
          finisher = entry.terminalID;
        } else if (
          finishTime === earliestFinish && finisher !== null &&
          compareOrderKeys(orderKey(entries.get(finisher)!), orderKey(entry)) > 0
        ) {
          finisher = entry.terminalID;
        }
      }
    }

    const budget = finisher === null ? elapsed : earliestFinish;
    for (const entry of entries.values()) {
      if (isDriving(entry)) {
        const official = { value: entry.official };
        walk(official, entry.pace, entry.terminalID, budget);
        entry.display += official.value - entry.official;
        entry.official = official.value;
      } else if (entry.status === 'done' && !entry.isRetired) {
        entry.display += budget * RaceRules.baseSpeed * RaceRules.doneCooldownFactor;
      }
    }

    if (finisher !== null) finishGrandPrix();
  }

  function isDriving(entry: Entry): boolean {
    return entry.status === 'working' && !entry.isRetired && !entry.isQueuedNextGrid;
  }

  /** Advances `official.value` by up to `budget` seconds, resampling pace at
   *  each official lap boundary and stopping exactly at the 58-lap finish.
   *  Returns the unused part of the budget (non-zero only at the finish). */
  function walk(
    official: { value: number },
    pace: PaceState,
    terminalID: string,
    budget: number,
  ): number {
    const finish = RaceRules.totalLaps;
    let remaining = budget;
    while (remaining > 1e-12 && official.value < finish) {
      const lap = Math.min(Math.floor(official.value), RaceRules.totalLaps - 1);
      if (pace.lap !== lap) {
        pace.multiplier = clampPace(paceSource(grandPrix, terminalID, lap));
        pace.lap = lap;
      }
      const speed = RaceRules.baseSpeed * pace.multiplier;
      const boundary = Math.min(lap + 1, finish);
      const timeToBoundary = (boundary - official.value) / speed;
      // The epsilon snaps float-accumulated distance onto exact lap
      // boundaries so lap labels and the 58-lap finish stay crisp.
      if (timeToBoundary <= remaining + 1e-9) {
        official.value = boundary;
        remaining = Math.max(0, remaining - timeToBoundary);
      } else {
        official.value += remaining * speed;
        remaining = 0;
      }
    }
    return remaining;
  }

  function coolDownDisplays(elapsed: number): void {
    // Podium victory lap: slow display-only motion; the result is frozen.
    for (const entry of entries.values()) {
      if (entry.isRetired || entry.isQueuedNextGrid) continue;
      if (entry.status !== 'working' && entry.status !== 'done') continue;
      entry.display += elapsed * RaceRules.baseSpeed * RaceRules.doneCooldownFactor;
    }
  }

  // MARK: - Grand Prix lifecycle

  function finishGrandPrix(): void {
    const standings = rankedTeams();
    frozenPodium = {
      grandPrix: grandPrix,
      top: standings.slice(0, 3).map(standing => ({
        rank: standing.rank,
        label: standing.label,
        colorToken: standing.colorToken,
        distance: standing.distance,
      })),
    };
    phase = 'podium';
    podiumElapsed = 0;
  }

  function startNextGrandPrix(): void {
    grandPrix += 1;
    dropAbsentRetiredEntries();
    resetGrid();
    phase = 'live';
    frozenPodium = null;
  }

  function dropAbsentRetiredEntries(): void {
    for (const entry of [...entries.values()]) {
      if (!entry.isRetired || presentInLatestSnapshot.has(entry.terminalID)) continue;
      entries.delete(entry.terminalID);
      // Retired numbers were held for the whole race; free them now.
      const number = numberAssignments.get(entry.terminalID);
      if (number !== undefined) {
        numberAssignments.delete(entry.terminalID);
        usedNumbers.delete(number);
      }
    }
  }

  function resetGrid(): void {
    raceTime = 0;
    podiumElapsed = 0;
    const orderedIDs = [...entries.keys()].sort((a, b) =>
      compareOrderKeys(orderKey(entries.get(a)!), orderKey(entries.get(b)!)),
    );
    const circulating: string[] = [];
    for (const id of orderedIDs) {
      const entry = entries.get(id)!;
      entry.official = 0;
      entry.display = 0;
      entry.pace = { multiplier: 1, lap: -1 };
      entry.isQueuedNextGrid = false;
      entry.newStintUntil = null;
      entry.incidentInPit = false;
      if (entry.status === 'done' || entry.status === 'blocked') circulating.push(id);
    }
    // Done cooldown and incident markers restart on deterministic,
    // non-overlapping display positions around the circuit.
    circulating.forEach((id, index) => {
      entries.get(id)!.display = (index + 1) / (circulating.length + 1);
    });
  }

  function orderKey(entry: Entry): [number, number, string] {
    return [
      teamOrder.get(entry.teamID) ?? Number.MAX_SAFE_INTEGER,
      entry.bootstrapIndex,
      entry.terminalID,
    ];
  }

  // MARK: - Snapshot reconciliation

  function reconcile(snapshot: SourceSnapshot): void {
    const bootstrapping = !hasSnapshot;
    hasSnapshot = true;

    for (const team of snapshot.teams) {
      teamLabels.set(team.id, team.label);
      if (!teamOrder.has(team.id)) teamOrder.set(team.id, nextTeamOrder++);
    }
    assignTeamTokens(snapshot.teams.map(team => team.id));

    const seen = new Set<string>();
    const newcomers: Array<[SourceAgent, string]> = [];
    for (const team of snapshot.teams) {
      for (const agent of team.agents) {
        seen.add(agent.terminalID);
        if (entries.has(agent.terminalID)) updateEntry(agent, team.id);
        else newcomers.push([agent, team.id]);
      }
    }
    // Collisions resolve in deterministic terminal-ID order without
    // renumbering existing or retired cars.
    newcomers.sort(([a], [b]) => compareStrings(a.terminalID, b.terminalID));
    for (const [agent, teamID] of newcomers) addEntry(agent, teamID);

    presentInLatestSnapshot = seen;
    for (const [id, entry] of entries) {
      if (!seen.has(id)) entry.isRetired = true;
    }

    if (bootstrapping) {
      phase = 'live';
      resetGrid();
    }
  }

  function updateEntry(agent: SourceAgent, teamID: string): void {
    const entry = entries.get(agent.terminalID)!;
    // A terminal reappearing before race end restores its existing entry.
    entry.isRetired = false;
    // A live workspace move transfers the entry and its whole distance.
    entry.teamID = teamID;

    if (
      entry.sessionReference !== null &&
      agent.agentSessionReference !== null &&
      entry.sessionReference !== agent.agentSessionReference
    ) {
      entry.newStintUntil = raceTime + RaceRules.newStintDuration;
    }
    if (agent.agentSessionReference !== null) {
      entry.sessionReference = agent.agentSessionReference;
    }

    if (entry.status !== agent.status) {
      if (agent.status === 'blocked') {
        entry.incidentInPit = entry.status === 'idle' || entry.isQueuedNextGrid;
      } else {
        entry.incidentInPit = false;
      }
      entry.status = agent.status;
    }

    entry.tabLabel = agent.tabLabel;
    entry.agentKind = agent.agentKind;
    entry.isFocused = agent.isFocused;
  }

  function addEntry(agent: SourceAgent, teamID: string): void {
    const entry: Entry = {
      terminalID: agent.terminalID,
      carNumber: assignNumber(agent.terminalID),
      teamID,
      tabLabel: agent.tabLabel,
      agentKind: agent.agentKind,
      sessionReference: agent.agentSessionReference,
      status: agent.status,
      isFocused: agent.isFocused,
      official: 0,
      display: 0,
      pace: { multiplier: 1, lap: -1 },
      isRetired: false,
      isQueuedNextGrid: false,
      incidentInPit: false,
      newStintUntil: null,
      bootstrapIndex: nextBootstrapIndex++,
    };

    if (phase === 'live') {
      // Join just behind the current last-place car, clamped at zero.
      const actives = [...entries.values()]
        .filter(other => !other.isRetired && !other.isQueuedNextGrid)
        .map(other => other.official);
      const lowest = actives.length > 0 ? Math.min(...actives) : RaceRules.newEntrantDeficit;
      entry.official = Math.max(0, lowest - RaceRules.newEntrantDeficit);
      entry.display = entry.official;
    } else if (phase === 'podium') {
      entry.isQueuedNextGrid = true;
    }
    entries.set(agent.terminalID, entry);
  }

  // MARK: - Identity assignment

  function assignNumber(terminalID: string): number {
    const existing = numberAssignments.get(terminalID);
    if (existing !== undefined) return existing;
    const preferred =
      Number(stableHash(terminalID) % BigInt(RaceRules.maximumGridNumber)) + 1;
    for (let probe = 0; probe < RaceRules.maximumGridNumber; probe += 1) {
      const candidate = ((preferred - 1 + probe) % RaceRules.maximumGridNumber) + 1;
      if (!usedNumbers.has(candidate)) {
        numberAssignments.set(terminalID, candidate);
        usedNumbers.add(candidate);
        return candidate;
      }
    }
    throw new Error(`grid is limited to ${RaceRules.maximumGridNumber} cars`);
  }

  function assignTeamTokens(ids: string[]): void {
    // Existing assignments are preserved; only unseen teams (sorted by
    // workspace ID for determinism) probe for a free palette slot.
    const unseen = ids.filter(id => !teamTokens.has(id)).sort(compareStrings);
    for (const id of unseen) {
      const preferred = Number(stableHash(id) % BigInt(RaceRules.paletteSize));
      let assigned: number | null = null;
      for (let probe = 0; probe < RaceRules.paletteSize; probe += 1) {
        const slot = (preferred + probe) % RaceRules.paletteSize;
        if (!usedPaletteSlots.has(slot)) {
          assigned = slot;
          break;
        }
      }
      if (assigned !== null) {
        teamTokens.set(id, { kind: 'palette', slot: assigned });
        usedPaletteSlots.add(assigned);
      } else {
        teamTokens.set(id, { kind: 'pattern', slot: nextPatternSlot++ });
      }
    }
  }

  // MARK: - Presentation

  function presentation(): RacePresentation {
    const teams = rankedTeams();
    const currentOverlay = overlay();
    return {
      phase: phase,
      grandPrix: grandPrix,
      headerLap: headerLap(),
      teams,
      podium: frozenPodium,
      connection: connection,
      overlay: currentOverlay,
    };
  }

  function headerLap(): number {
    let leader = 0;
    for (const entry of entries.values()) {
      if (!entry.isQueuedNextGrid) leader = Math.max(leader, entry.official);
    }
    return Math.min(RaceRules.totalLaps, Math.floor(leader) + 1);
  }

  function rankedTeams(): TeamStanding[] {
    // A workspace whose every entry has retired leaves the standings (and the
    // podium) entirely. The entries themselves stay in the session, so a
    // terminal reappearing before race end restores the team with its
    // distance intact.
    const groups = new Map<string, Entry[]>();
    for (const entry of entries.values()) {
      const members = groups.get(entry.teamID) ?? [];
      members.push(entry);
      groups.set(entry.teamID, members);
    }
    // Quantized distances keep ordering stable against float noise.
    const quantized = (value: number) => Math.round(value * 1e6);

    const ordered = [...groups.entries()]
      .filter(([, members]) => members.some(member => !member.isRetired))
      .map(([id, members]) => ({
        id,
        distance: members.reduce((sum, member) => sum + member.official, 0),
        members,
      }))
      .sort(
        (a, b) =>
          quantized(b.distance) - quantized(a.distance) ||
          (teamOrder.get(a.id) ?? Number.MAX_SAFE_INTEGER) -
            (teamOrder.get(b.id) ?? Number.MAX_SAFE_INTEGER) ||
          compareStrings(a.id, b.id),
      );

    const leaderDistance = ordered[0]?.distance ?? 0;
    return ordered.map((teamGroup, index) => ({
      id: teamGroup.id,
      rank: index + 1,
      label: teamLabels.get(teamGroup.id) ?? teamGroup.id,
      colorToken: teamTokens.get(teamGroup.id) ?? { kind: 'palette', slot: 0 },
      distance: teamGroup.distance,
      distanceText: `${teamGroup.distance.toFixed(1)} LAPS`,
      gapText: index === 0 ? '—' : gapText(leaderDistance - teamGroup.distance),
      entries: teamGroup.members
        .slice()
        .sort(
          (a, b) =>
            quantized(b.official) - quantized(a.official) ||
            a.carNumber - b.carNumber ||
            compareStrings(a.terminalID, b.terminalID),
        )
        .map(entry => present(entry)),
    }));
  }

  function present(entry: Entry): EntryPresentation {
    const lap = Math.min(RaceRules.totalLaps, Math.floor(entry.official) + 1);
    const progress = entry.display - Math.floor(entry.display);

    let placement: EntryPlacement;
    let statusText: string;
    if (entry.isQueuedNextGrid) {
      placement = { kind: 'nextGrid' };
      statusText = 'NEXT GRID';
    } else if (entry.isRetired) {
      placement = { kind: 'retired' };
      statusText = `RETIRED · LAP ${lap}`;
    } else {
      switch (entry.status) {
        case 'working':
          placement = { kind: 'track', progress };
          statusText = `LAP ${lap}`;
          break;
        case 'idle':
          placement = { kind: 'pit' };
          statusText = 'PIT';
          break;
        case 'done':
          placement = { kind: 'cooldown', progress };
          statusText = `DONE · LAP ${lap}`;
          break;
        case 'blocked':
          placement = entry.incidentInPit ? { kind: 'incidentPit' } : { kind: 'incidentTrack', progress };
          statusText = `INCIDENT · LAP ${lap}`;
          break;
      }
    }

    return {
      id: entry.terminalID,
      carNumber: entry.carNumber,
      teamID: entry.teamID,
      workspaceLabel: teamLabels.get(entry.teamID) ?? entry.teamID,
      tabLabel: entry.tabLabel,
      agentKind: entry.agentKind,
      status: entry.status,
      colorToken: teamTokens.get(entry.teamID) ?? { kind: 'palette', slot: 0 },
      officialDistance: entry.official,
      lap,
      statusText,
      placement,
      displaySpeed: displaySpeed(entry),
      isFocused: entry.isFocused,
      showsNewStint: entry.newStintUntil !== null && raceTime < entry.newStintUntil,
    };
  }

  /** Display motion in laps/second the client uses to extrapolate between
   *  syncs. Mirrors the motion the server itself applies in step(). */
  function displaySpeed(entry: Entry): number {
    if (connection.kind !== 'live') return 0;
    if (entry.isRetired || entry.isQueuedNextGrid) return 0;
    if (phase === 'live') {
      if (entry.status === 'working') {
        return RaceRules.baseSpeed * (entry.pace.lap === -1 ? 1 : entry.pace.multiplier);
      }
      if (entry.status === 'done') return RaceRules.baseSpeed * RaceRules.doneCooldownFactor;
      return 0;
    }
    if (phase === 'podium' && (entry.status === 'working' || entry.status === 'done')) {
      return RaceRules.baseSpeed * RaceRules.doneCooldownFactor;
    }
    return 0;
  }

  function overlay(): RaceOverlay {
    if (connection.kind === 'protocolError') {
      return { kind: 'suspended', detail: connection.detail };
    }
    if (!hasSnapshot) return { kind: 'formationLap' };
    if (connection.kind !== 'live') return { kind: 'redFlag' };
    if ([...entries.values()].every(entry => entry.isRetired)) return { kind: 'noCarsOnGrid' };
    return { kind: 'none' };
  }

  return { apply, applyConnection, applySnapshot, advance, presentation };
}

export type RaceSession = ReturnType<typeof createRaceSession>;

// MARK: - Helpers

function clampPace(value: number): number {
  return Math.min(Math.max(value, RaceRules.paceMin), RaceRules.paceMax);
}

function gapText(gap: number): string {
  if (gap < 1) return `+${(gap * RaceRules.baseLapDuration).toFixed(1)}s`;
  return `+${gap.toFixed(1)} LAPS`;
}

function connectionEquals(a: ConnectionState, b: ConnectionState): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === 'protocolError' && b.kind === 'protocolError') return a.detail === b.detail;
  return true;
}

function compareStrings(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function compareOrderKeys(a: [number, number, string], b: [number, number, string]): number {
  return a[0] - b[0] || a[1] - b[1] || compareStrings(a[2], b[2]);
}
