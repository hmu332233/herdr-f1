import { MultiplayerRules, RaceRules, seededPace, stableHash, type RacePaceSource } from './rules.js';
import { radioText } from './radio.js';
import type { HerdrUpdate, SourceAgent, SourceSnapshot } from './herdr/types.js';
import type {
  AgentStatus, ConnectionState, CrewCounts, CrewState, EntryPlacement, EntryPresentation,
  FlagState, PitState, PodiumResult, RaceControlState, RaceMode, RaceOverlay, RacePhase,
  RacePresentation, RadioKind, RadioMessage, TeamColorToken, TeamStanding,
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
  crewState: CrewState;
  crewCounts: CrewCounts;
  isLastKnown: boolean;
  isFocused: boolean;
  official: number;
  display: number;
  pace: PaceState;
  /** Live speed factor injected from outside the seeded pace — the multiplayer
   *  host drives it from crew uptime (M4). 1 in local mode. */
  externalPace: number;
  tireLife: number;
  pitState: Exclude<PitState, 'none'>;
  pitPhaseRemaining: number;
  isRetired: boolean;
  isQueuedNextGrid: boolean;
  /** A block that occurs while parked stays a pit-lane incident. */
  incidentInPit: boolean;
  /** Race-time deadline for the transient NEW STINT treatment. */
  newStintUntil: number | null;
  bootstrapIndex: number;
}

export interface RaceSessionOptions {
  raceMode?: RaceMode;
}

/**
 * In-memory race state owner. Consumes authoritative projected herdr
 * snapshots, connection state, and monotonic time (seconds); publishes a
 * complete RacePresentation. All race records are fictional game state that
 * lives only as long as this object. Official distance advances exclusively
 * from accepted elapsed race time, never from render frames.
 */
export function createRaceSession(
  paceSource: RacePaceSource = seededPace,
  /** Wall clock used only to stamp team radio. The race itself runs on the
   *  monotonic clock passed to advance(); this is injected separately so tests
   *  get stable timestamps. */
  wallClock: () => Date = () => new Date(),
  options: RaceSessionOptions = {},
) {
  const raceMode = options.raceMode ?? 'classic';
  let lastTick: number | null = null;
  /** Race distance for the circuit currently being raced. Session state rather
   *  than a constant, because each venue has its own published distance and the
   *  dashboard can switch circuits mid-session. */
  let totalLaps: number = RaceRules.totalLaps;
  /** Accepted live seconds since the current Grand Prix started. */
  let raceTime = 0;
  let podiumElapsed = 0;
  let phase: RacePhase = 'awaitingGrid';
  let grandPrix = 1;
  let connection: ConnectionState = { kind: 'waiting' };
  let hasSnapshot = false;
  let frozenPodium: PodiumResult | null = null;
  let controlPhase: 'green' | 'deployed' | 'inThisLap' | 'greenFlag' = 'green';
  let safetyQueue: string[] = [];
  let safetyCarDistance = 0;
  let withdrawalLine = 0;
  let greenFlagUntil = 0;

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

  /** Recent team radio for the current Grand Prix, oldest first. */
  let radio: RadioMessage[] = [];
  let nextRadioID = 1;

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
        if (raceMode === 'continuous') scoreContinuous(elapsed);
        else scoreLive(elapsed);
        return;
      case 'podium':
        raceTime += elapsed;
        podiumElapsed += elapsed;
        coolDownDisplays(elapsed);
        if (podiumElapsed >= RaceRules.podiumDuration) startNextGrandPrix();
    }
  }

  function scoreLive(elapsed: number): void {
    // Sampled once for the whole step: the probe pass below and the commit pass
    // that follows must score against the same track condition, or a car could
    // be found to finish at a pace it is then not advanced at.
    const paceFactor = fieldPaceFactor();
    // The first individual to reach the finish ends the race, so everyone only
    // advances up to the earliest finish instant within this step.
    let earliestFinish = elapsed;
    let finisher: string | null = null;
    for (const entry of entries.values()) {
      if (!isDriving(entry)) continue;
      const official = { value: entry.official };
      const pace = { ...entry.pace };
      const unused = walk(official, pace, entry.terminalID, elapsed, paceFactor * entry.externalPace);
      if (official.value >= totalLaps) {
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
        walk(official, entry.pace, entry.terminalID, budget, paceFactor * entry.externalPace);
        entry.display += official.value - entry.official;
        entry.official = official.value;
      } else if (entry.status === 'done' && !entry.isRetired) {
        entry.display +=
          budget * RaceRules.baseSpeed * RaceRules.doneCooldownFactor * paceFactor;
      }
    }

    if (finisher !== null) finishGrandPrix();
  }

  function scoreContinuous(elapsed: number): void {
    if (controlPhase === 'greenFlag' && raceTime >= greenFlagUntil) controlPhase = 'green';
    advancePitCycles(elapsed);
    if (controlPhase === 'deployed' || controlPhase === 'inThisLap') {
      safetyQueue = safetyQueue.filter(id => {
        const entry = entries.get(id);
        return entry !== undefined && isContinuousRunner(entry);
      });
      appendMissingQueueRunners();
      scoreSafetyCar(elapsed);
      return;
    }
    scoreContinuousGreen(elapsed);
  }

  function scoreContinuousGreen(elapsed: number): void {
    // Freeze the factors for this scoring step. The finish probe and commit
    // pass must use the same rubber-band correction, even if a pass would
    // change the order by the end of the step.
    const plan = continuousGreenPlan();
    const factors = plan.factors;
    let earliestFinish = elapsed;
    let finisher: string | null = null;
    for (const [index, entry] of plan.runners.entries()) {
      const official = { value: entry.official };
      const pace = { ...entry.pace };
      const unused = walk(
        official, pace, entry.terminalID, elapsed,
        factors.get(entry.terminalID) ?? continuousNormalFactor(entry),
      );
      // A pace-matched follower cannot finish through the car ahead. Only the
      // current leader and cars with an explicit working pass may set the
      // finish time in the independent probe.
      if (official.value >= totalLaps && (index === 0 || plan.canPass.has(entry.terminalID))) {
        const finishTime = elapsed - unused;
        if (finishTime < earliestFinish || (finishTime === earliestFinish && finisher === null)) {
          earliestFinish = finishTime;
          finisher = entry.terminalID;
        }
      }
    }
    const budget = finisher === null ? elapsed : earliestFinish;
    let ahead: Entry | undefined;
    for (const entry of plan.runners) {
      const before = entry.official;
      const official = { value: entry.official };
      walk(
        official, entry.pace, entry.terminalID, budget,
        factors.get(entry.terminalID) ?? continuousNormalFactor(entry),
      );
      const mayPass = plan.canPass.has(entry.terminalID);
      if (ahead && !mayPass) {
        const limit = ahead.official
          - (plan.holdingGaps.get(entry.terminalID)
            ?? MultiplayerRules.continuousCatchupTargetGap);
        official.value = Math.min(official.value, Math.max(before, limit));
      }
      entry.official = official.value;
      entry.display = official.value;
      ahead = entry;
    }
    wearContinuousTires(budget);
    if (finisher !== null) finishGrandPrix();
  }

  function scoreSafetyCar(elapsed: number): void {
    const leader = safetyQueue.length > 0 ? entries.get(safetyQueue[0]) : undefined;
    let neutralized = elapsed;
    let greenRemainder = 0;
    if (controlPhase === 'inThisLap' && leader) {
      const secondsToLine = Math.max(
        0,
        (withdrawalLine - leader.official) /
          (RaceRules.baseSpeed * MultiplayerRules.safetyCarLeaderFactor),
      );
      if (secondsToLine <= elapsed) {
        neutralized = secondsToLine;
        greenRemainder = elapsed - secondsToLine;
      }
    }
    advanceSafetyQueue(neutralized);
    if ([...entries.values()].some(entry => entry.official >= totalLaps && isContinuousRunner(entry))) {
      finishGrandPrix();
      return;
    }
    if (greenRemainder > 0 || (controlPhase === 'inThisLap' && leader?.official === withdrawalLine)) {
      controlPhase = 'greenFlag';
      greenFlagUntil = raceTime - greenRemainder + MultiplayerRules.greenFlagDuration;
      safetyQueue = [];
      if (greenRemainder > 0) scoreContinuousGreen(greenRemainder);
    }
  }

  function advanceSafetyQueue(elapsed: number): void {
    if (elapsed <= 0) return;
    safetyCarDistance += RaceRules.baseSpeed * MultiplayerRules.safetyCarLeaderFactor * elapsed;
    let ahead: Entry | null = null;
    for (const id of safetyQueue) {
      const entry = entries.get(id);
      if (!entry || !isContinuousRunner(entry)) continue;
      const factor = ahead === null
        ? MultiplayerRules.safetyCarLeaderFactor
        : safetyCarFollowerFactor(ahead, entry);
      const proposed = entry.official + RaceRules.baseSpeed * factor * elapsed;
      entry.official = ahead === null
        ? proposed
        : Math.max(
            entry.official,
            Math.min(proposed, ahead.official - MultiplayerRules.safetyCarQueueGap),
          );
      entry.display = entry.official;
      ahead = entry;
    }
  }

  function safetyCarFollowerFactor(ahead: Entry, entry: Entry): number {
    const excess = Math.max(
      0,
      ahead.official - entry.official - MultiplayerRules.safetyCarQueueGap,
    );
    const ratio = Math.min(1, excess / MultiplayerRules.safetyCarCatchupRange);
    return MultiplayerRules.safetyCarLeaderFactor
      + ratio * (MultiplayerRules.safetyCarCatchupFactor - MultiplayerRules.safetyCarLeaderFactor);
  }

  function isContinuousRunner(entry: Entry): boolean {
    return !entry.isRetired
      && !entry.isQueuedNextGrid
      && !isLiveBlocked(entry)
      && entry.pitState === 'racing';
  }

  function continuousNormalFactor(entry: Entry): number {
    const stateFactor = entry.isLastKnown || entry.crewState !== 'working'
      ? MultiplayerRules.cruisingFactor
      : Math.min(
          1 + MultiplayerRules.continuousWorkingBonusSpan,
          Math.max(1, entry.externalPace),
        );
    return stateFactor - continuousTirePenalty(entry);
  }

  function continuousTirePenalty(entry: Entry): number {
    const wornRange = MultiplayerRules.tireWearStartsAt
      - MultiplayerRules.tireLifePitThreshold;
    const worn = MultiplayerRules.tireWearStartsAt - entry.tireLife;
    return MultiplayerRules.tirePenaltyMax * Math.min(1, Math.max(0, worn / wornRange));
  }

  /** Individual-car green-flag pace. Catch-up is available to every follower,
   *  including a cruising car behind a working leader. It closes the field but
   *  cannot create an overtake: inside the target gap the follower matches the
   *  actual pace of the car ahead. A live WORKING car is the sole exception:
   *  natural pace can pass another car, with an extra burst against a
   *  non-working or offline car inside the passing range. */
  function continuousGreenPlan(): {
    runners: Entry[];
    factors: Map<string, number>;
    canPass: Set<string>;
    holdingGaps: Map<string, number>;
  } {
    const runners = [...entries.values()]
      .filter(isContinuousRunner)
      .sort((a, b) => b.official - a.official || compareOrderKeys(orderKey(a), orderKey(b)));
    const factors = new Map<string, number>();
    const actualFactors = new Map<string, number>();
    const naturalFactors = new Map<string, number>();
    const canPass = new Set<string>();
    const holdingGaps = new Map<string, number>();
    const leaderPace = runners[0] ? currentPaceMultiplier(runners[0]) : 1;
    const leaderActual = runners[0]
      ? leaderPace * continuousNormalFactor(runners[0])
      : 0;
    runners.forEach((entry, index) => {
      const pace = currentPaceMultiplier(entry);
      const naturalActual = pace * continuousNormalFactor(entry);
      const ahead = index > 0 ? runners[index - 1] : undefined;
      const gapToAhead = ahead ? Math.max(0, ahead.official - entry.official) : Infinity;
      const canPassCruiser = entry.crewState === 'working'
        && !entry.isLastKnown
        && ahead !== undefined
        && (ahead.crewState !== 'working' || ahead.isLastKnown)
        && gapToAhead <= MultiplayerRules.continuousOvertakeRange;
      let actual = naturalActual;
      if (ahead) {
        const aheadActual = actualFactors.get(ahead.terminalID) ?? leaderActual;
        const aheadNatural = naturalFactors.get(ahead.terminalID) ?? aheadActual;
        const workingPass = entry.crewState === 'working'
          && !entry.isLastKnown
          && gapToAhead <= MultiplayerRules.continuousOvertakeRange
          && (canPassCruiser || naturalActual > aheadNatural + 1e-9);
        if (!workingPass && gapToAhead <= MultiplayerRules.continuousCatchupTargetGap) {
          actual = aheadActual;
          // Cars may join or start at the same coordinate. Hold the intended
          // spacing rather than preserving that overlap forever; the commit
          // cap lets the car ahead open the gap without moving anyone back.
          holdingGaps.set(entry.terminalID, MultiplayerRules.continuousCatchupTargetGap);
        } else {
          const catchupRange = MultiplayerRules.continuousCatchupFullGap
            - MultiplayerRules.continuousCatchupTargetGap;
          const gapShare = Math.min(
            1,
            Math.max(
              0,
              (gapToAhead - MultiplayerRules.continuousCatchupTargetGap) / catchupRange,
            ),
          );
          const catchup = MultiplayerRules.continuousCatchupMin
            + (MultiplayerRules.continuousCatchupMax - MultiplayerRules.continuousCatchupMin)
              * gapShare;
          // Cap every follower against the leader rather than compounding
          // +0.04x down a long train. A tail car closes after the car ahead
          // joins the train, producing a stable accordion instead of runaway.
          actual = Math.max(
            actual,
            Math.min(aheadActual + catchup, leaderActual + MultiplayerRules.continuousCatchupMax),
          );
          if (workingPass) {
            if (canPassCruiser) actual += MultiplayerRules.continuousOvertakeBoost;
            canPass.add(entry.terminalID);
          } else {
            holdingGaps.set(
              entry.terminalID,
              MultiplayerRules.continuousCatchupTargetGap,
            );
          }
        }
      }
      naturalFactors.set(entry.terminalID, naturalActual);
      actualFactors.set(entry.terminalID, actual);
      factors.set(entry.terminalID, actual / pace);
    });
    return { runners, factors, canPass, holdingGaps };
  }

  function currentPaceMultiplier(entry: Entry): number {
    return entry.pace.lap === -1 ? 1 : entry.pace.multiplier;
  }

  function advancePitCycles(elapsed: number): void {
    for (const entry of entries.values()) {
      if (entry.pitState === 'racing') continue;
      let remaining = elapsed;
      while (remaining > 1e-12 && entry.pitState !== 'racing') {
        const used = Math.min(remaining, entry.pitPhaseRemaining);
        entry.pitPhaseRemaining -= used;
        remaining -= used;
        if (entry.pitPhaseRemaining > 1e-12) break;
        if (entry.pitState === 'pitIn') {
          entry.pitState = 'pitting';
          entry.pitPhaseRemaining = MultiplayerRules.pitServiceSeconds;
        } else if (entry.pitState === 'pitting') {
          entry.tireLife = MultiplayerRules.tireLifeFresh;
          entry.pitState = 'pitOut';
          entry.pitPhaseRemaining = MultiplayerRules.pitExitSeconds;
        } else {
          entry.pitState = 'racing';
          entry.pitPhaseRemaining = 0;
        }
      }
    }
  }

  function wearContinuousTires(elapsed: number): void {
    const wearPerSecond = (
      MultiplayerRules.tireLifeFresh - MultiplayerRules.tireLifePitThreshold
    ) / MultiplayerRules.tireWorkingSecondsToPit;
    for (const entry of entries.values()) {
      if (!isContinuousRunner(entry)) continue;
      if (entry.crewState !== 'working' || entry.isLastKnown) continue;
      entry.tireLife = Math.max(
        MultiplayerRules.tireLifePitThreshold,
        entry.tireLife - elapsed * wearPerSecond,
      );
      if (entry.tireLife > MultiplayerRules.tireLifePitThreshold + 1e-9) continue;
      entry.pitState = 'pitIn';
      entry.pitPhaseRemaining = MultiplayerRules.pitEntrySeconds;
    }
  }

  function pitTimeRemaining(entry: Entry): number | null {
    switch (entry.pitState) {
      case 'racing': return null;
      case 'pitIn':
        return entry.pitPhaseRemaining
          + MultiplayerRules.pitServiceSeconds
          + MultiplayerRules.pitExitSeconds;
      case 'pitting':
        return entry.pitPhaseRemaining + MultiplayerRules.pitExitSeconds;
      case 'pitOut': return entry.pitPhaseRemaining;
    }
  }

  function isDriving(entry: Entry): boolean {
    return entry.status === 'working' && !entry.isRetired && !entry.isQueuedNextGrid;
  }

  /** A car stopped on the circuit: blocked, but still in this race and not
   *  parked in the pit lane. This is the whole yellow-flag condition — an agent
   *  that blocked while idle is in its pit box, which needs no marshals.
   *
   *  Retired and next-grid cars are excluded because they are not on the
   *  circuit at all; a race would otherwise stay permanently yellow for a
   *  terminal that has already gone away. */
  function causesYellowFlag(entry: Entry): boolean {
    if (raceMode === 'continuous') return isLiveBlocked(entry);
    return entry.status === 'blocked'
      && !entry.isRetired
      && !entry.isQueuedNextGrid
      && !entry.incidentInPit;
  }

  function isLiveBlocked(entry: Entry): boolean {
    return entry.crewState === 'blocked'
      && !entry.isLastKnown
      && !entry.isRetired
      && !entry.isQueuedNextGrid;
  }

  /** True while any car is stopped on the circuit. Read once per scoring step
   *  and once per presentation, so the pace the field runs at and the flag the
   *  dashboard shows always come from the same condition. */
  function isYellowFlag(): boolean {
    for (const entry of entries.values()) {
      if (causesYellowFlag(entry)) return true;
    }
    return false;
  }

  /** Speed scale applied to every running car. The safety car neutralizes the
   *  race: the field slows, but nobody stops and gaps are preserved, since one
   *  factor applied to everyone leaves the relative order untouched. */
  function fieldPaceFactor(): number {
    return isYellowFlag() ? RaceRules.safetyCarFactor : 1;
  }

  /** Advances `official.value` by up to `budget` seconds, resampling pace at
   *  each official lap boundary and stopping exactly at the finish.
   *  Returns the unused part of the budget (non-zero only at the finish).
   *
   *  `paceFactor` neutralizes the field behind the safety car. It scales the
   *  speed rather than the budget so the lap-boundary walk stays exact: pace is
   *  still resampled per official lap, and the finish is still hit dead on. */
  function walk(
    official: { value: number },
    pace: PaceState,
    terminalID: string,
    budget: number,
    paceFactor: number,
  ): number {
    const finish = totalLaps;
    let remaining = budget;
    while (remaining > 1e-12 && official.value < finish) {
      const lap = Math.min(Math.floor(official.value), totalLaps - 1);
      if (pace.lap !== lap) {
        pace.multiplier = clampPace(paceSource(grandPrix, terminalID, lap));
        pace.lap = lap;
      }
      const speed = RaceRules.baseSpeed * pace.multiplier * paceFactor;
      const boundary = Math.min(lap + 1, finish);
      const timeToBoundary = (boundary - official.value) / speed;
      // The epsilon snaps float-accumulated distance onto exact lap
      // boundaries so lap labels and the finish stay crisp.
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
      if (raceMode === 'continuous') {
        if (isLiveBlocked(entry)) continue;
      } else if (entry.status !== 'working' && entry.status !== 'done') continue;
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
    // Radio belongs to the Grand Prix that produced it.
    radio = [];
    controlPhase = 'green';
    safetyQueue = [];
    safetyCarDistance = 0;
    withdrawalLine = 0;
    greenFlagUntil = 0;
    const orderedIDs = [...entries.keys()].sort((a, b) =>
      compareOrderKeys(orderKey(entries.get(a)!), orderKey(entries.get(b)!)),
    );
    const circulating: string[] = [];
    for (const id of orderedIDs) {
      const entry = entries.get(id)!;
      entry.official = 0;
      entry.display = 0;
      entry.pace = { multiplier: 1, lap: -1 };
      entry.tireLife = MultiplayerRules.tireLifeFresh;
      entry.pitState = 'racing';
      entry.pitPhaseRemaining = 0;
      entry.isQueuedNextGrid = false;
      entry.newStintUntil = null;
      entry.incidentInPit = false;
      if (raceMode === 'classic' && (entry.status === 'done' || entry.status === 'blocked')) {
        circulating.push(id);
      }
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

  // MARK: - Team radio

  /** Appends one radio line for a transition that just happened, trimming the
   *  oldest once the window is full. Callers must only fire this on a real
   *  transition — never on a snapshot that merely restates known state. */
  function emitRadio(entry: Entry, kind: RadioKind): void {
    const lap = lapOf(entry, totalLaps);
    const id = nextRadioID++;
    radio.push({
      id,
      kind,
      terminalID: entry.terminalID,
      carNumber: entry.carNumber,
      colorToken: teamTokens.get(entry.teamID) ?? { kind: 'palette', slot: 0 },
      teamLabel: teamLabels.get(entry.teamID) ?? entry.teamID,
      tabLabel: entry.tabLabel,
      lap,
      timeText: clockText(wallClock()),
      // Seeded by the transition itself, so the line a viewer is reading never
      // changes underneath them as sync re-sends the window.
      text: radioText(kind, `${grandPrix}|${entry.terminalID}|${lap}|${id}`),
    });
    if (radio.length > RaceRules.radioHistoryLimit) {
      radio = radio.slice(radio.length - RaceRules.radioHistoryLimit);
    }
  }

  /** The status change a radio line should announce, or null when the
   *  transition is not worth breaking radio silence for. */
  function radioKindFor(previous: AgentStatus, next: AgentStatus): RadioKind | null {
    if (next === 'blocked') return 'incident';
    if (previous === 'blocked') return 'recovered';
    if (next === 'done') return 'chequered';
    if (previous === 'working' && next === 'idle') return 'boxBox';
    if (previous === 'idle' && next === 'working') return 'greenAgain';
    return null;
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

    // The bootstrap snapshot establishes the grid rather than changing it;
    // announcing it would open every race with a burst of radio for cars that
    // never actually did anything.
    const announces = !bootstrapping;

    const seen = new Set<string>();
    const newcomers: Array<[SourceAgent, string]> = [];
    for (const team of snapshot.teams) {
      for (const agent of team.agents) {
        seen.add(agent.terminalID);
        if (entries.has(agent.terminalID)) updateEntry(agent, team.id, announces);
        else newcomers.push([agent, team.id]);
      }
    }
    // Collisions resolve in deterministic terminal-ID order without
    // renumbering existing or retired cars.
    newcomers.sort(([a], [b]) => compareStrings(a.terminalID, b.terminalID));
    for (const [agent, teamID] of newcomers) addEntry(agent, teamID);

    presentInLatestSnapshot = seen;
    for (const [id, entry] of entries) {
      if (seen.has(id) || entry.isRetired) continue;
      entry.isRetired = true;
      if (announces) emitRadio(entry, 'retired');
    }

    if (raceMode === 'continuous' && phase === 'live') refreshContinuousControl();

    if (bootstrapping) {
      phase = 'live';
      resetGrid();
      if (raceMode === 'continuous') refreshContinuousControl();
    }
  }

  function updateEntry(agent: SourceAgent, teamID: string, announces: boolean): void {
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
      if (announces) emitRadio(entry, 'newStint');
    }
    if (agent.agentSessionReference !== null) {
      entry.sessionReference = agent.agentSessionReference;
    }

    if (entry.status !== agent.status) {
      const kind = radioKindFor(entry.status, agent.status);
      if (agent.status === 'blocked') {
        entry.incidentInPit = entry.status === 'idle' || entry.isQueuedNextGrid;
      } else {
        entry.incidentInPit = false;
      }
      entry.status = agent.status;
      // Emitted after the status lands so the line quotes the new state.
      if (announces && kind !== null) emitRadio(entry, kind);
    }

    entry.crewState = agent.crewState ?? agent.status;
    entry.crewCounts = agent.crewCounts ?? countsForStatus(agent.status);
    entry.isLastKnown = agent.isLastKnown ?? false;

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
      crewState: agent.crewState ?? agent.status,
      crewCounts: agent.crewCounts ?? countsForStatus(agent.status),
      isLastKnown: agent.isLastKnown ?? false,
      isFocused: agent.isFocused,
      official: 0,
      display: 0,
      pace: { multiplier: 1, lap: -1 },
      externalPace: 1,
      tireLife: MultiplayerRules.tireLifeFresh,
      pitState: 'racing',
      pitPhaseRemaining: 0,
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

  function refreshContinuousControl(): void {
    const blocked = [...entries.values()].filter(isLiveBlocked);
    if (blocked.length > 0) {
      if (controlPhase === 'green' || controlPhase === 'greenFlag') {
        safetyQueue = runningOrder();
        const leader = safetyQueue.length > 0 ? entries.get(safetyQueue[0]) : undefined;
        safetyCarDistance = (leader?.official ?? Math.max(0, ...blocked.map(entry => entry.official)))
          + MultiplayerRules.safetyCarQueueGap;
      } else {
        safetyQueue = safetyQueue.filter(id => {
          const entry = entries.get(id);
          return entry !== undefined && isContinuousRunner(entry);
        });
        appendMissingQueueRunners();
      }
      controlPhase = 'deployed';
      return;
    }

    if (controlPhase === 'deployed') {
      appendMissingQueueRunners();
      const leader = safetyQueue.length > 0 ? entries.get(safetyQueue[0]) : undefined;
      withdrawalLine = leader ? Math.floor(leader.official) + 1 : 0;
      controlPhase = leader ? 'inThisLap' : 'greenFlag';
      if (!leader) greenFlagUntil = raceTime + MultiplayerRules.greenFlagDuration;
      return;
    }

    if (controlPhase === 'inThisLap') appendMissingQueueRunners();
  }

  function runningOrder(): string[] {
    return [...entries.values()]
      .filter(isContinuousRunner)
      .sort((a, b) => b.official - a.official || compareOrderKeys(orderKey(a), orderKey(b)))
      .map(entry => entry.terminalID);
  }

  function appendMissingQueueRunners(): void {
    const present = new Set(safetyQueue);
    const missing = runningOrder().filter(id => !present.has(id));
    for (const id of missing) {
      const entry = entries.get(id)!;
      const tail = safetyQueue.length > 0 ? entries.get(safetyQueue[safetyQueue.length - 1]) : undefined;
      if (tail) {
        entry.official = Math.max(0, tail.official - MultiplayerRules.safetyCarQueueGap);
        entry.display = entry.official;
      }
      safetyQueue.push(id);
    }
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
    // Existing assignments are preserved. The palette itself is ordered as a
    // max-contrast sequence, so handing out the first free slot makes a small
    // field much easier to scan than starting from an arbitrary hash (which
    // could give the first two teams neighboring blues or reds). Sorting a
    // batch keeps bootstrap assignment deterministic; later arrivals take the
    // next visually distinct slot without changing anyone already racing.
    const unseen = ids.filter(id => !teamTokens.has(id)).sort(compareStrings);
    for (const id of unseen) {
      let assigned: number | null = null;
      for (let slot = 0; slot < RaceRules.paletteSize; slot += 1) {
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
      raceMode,
      phase: phase,
      grandPrix: grandPrix,
      headerLap: headerLap(),
      totalLaps,
      teams,
      podium: frozenPodium,
      connection: connection,
      overlay: currentOverlay,
      flag: flag(teams),
      raceControl: raceControl(teams),
      radio: [...radio],
    };
  }

  function raceControl(teams: TeamStanding[]): RaceControlState {
    if (raceMode !== 'continuous') return { kind: 'green' };
    if (controlPhase === 'greenFlag') return { kind: 'greenFlag' };
    if (controlPhase === 'deployed' || controlPhase === 'inThisLap') {
      const terminalIDs = teams.flatMap(team => team.entries)
        .filter(entry => entry.causesYellowFlag)
        .map(entry => entry.id);
      return {
        kind: 'safetyCar',
        phase: controlPhase,
        terminalIDs,
        safetyCarProgress: controlPhase === 'deployed'
          ? safetyCarDistance - Math.floor(safetyCarDistance)
          : null,
      };
    }
    return { kind: 'green' };
  }

  /** Track condition, read off the entries already presented so the flag and
   *  the cars flagged can never disagree. Standings order carries through,
   *  which makes the list stable between syncs. */
  function flag(teams: TeamStanding[]): FlagState {
    const terminalIDs = teams
      .flatMap(team => team.entries)
      .filter(entry => entry.causesYellowFlag)
      .map(entry => entry.id);
    return terminalIDs.length === 0 ? { kind: 'green' } : { kind: 'yellow', terminalIDs };
  }

  function headerLap(): number {
    let leader = 0;
    for (const entry of entries.values()) {
      if (!entry.isQueuedNextGrid) leader = Math.max(leader, entry.official);
    }
    return Math.min(totalLaps, Math.floor(leader) + 1);
  }

  function rankedTeams(): TeamStanding[] {
    // One condition for the whole presentation: every entry reports the display
    // speed it is actually being scored at.
    const paceFactor = fieldPaceFactor();
    const continuousFactors = raceMode === 'continuous'
      ? continuousGreenPlan().factors
      : undefined;
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
      isOffline: teamGroup.members.every(entry => entry.isLastKnown),
      blockedCount: teamGroup.members.filter(entry => isLiveBlocked(entry)).length,
      entries: teamGroup.members
        .slice()
        .sort(
          (a, b) =>
            quantized(b.official) - quantized(a.official) ||
            a.carNumber - b.carNumber ||
            compareStrings(a.terminalID, b.terminalID),
        )
        .map(entry => present(entry, paceFactor, continuousFactors)),
    }));
  }

  function present(
    entry: Entry,
    paceFactor: number,
    continuousFactors?: Map<string, number>,
  ): EntryPresentation {
    const lap = lapOf(entry, totalLaps);
    const progress = entry.display - Math.floor(entry.display);

    let placement: EntryPlacement;
    let statusText: string;
    if (entry.isQueuedNextGrid) {
      placement = { kind: 'nextGrid' };
      statusText = 'NEXT GRID';
    } else if (entry.isRetired) {
      placement = { kind: 'retired' };
      statusText = `RETIRED · LAP ${lap}`;
    } else if (raceMode === 'continuous') {
      if (isLiveBlocked(entry)) {
        placement = { kind: 'incidentTrack', progress };
        statusText = `INCIDENT · LAP ${lap}`;
      } else if (entry.pitState === 'pitIn' || entry.pitState === 'pitting') {
        placement = { kind: 'pit' };
        statusText = entry.pitState === 'pitIn' ? 'PIT IN' : 'PITTING';
      } else if (entry.pitState === 'pitOut') {
        placement = { kind: 'track', progress };
        statusText = 'PIT OUT';
      } else {
        placement = { kind: 'track', progress };
        statusText = `LAP ${lap}`;
      }
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
      crewState: entry.crewState,
      crewCounts: { ...entry.crewCounts },
      isLastKnown: entry.isLastKnown,
      colorToken: teamTokens.get(entry.teamID) ?? { kind: 'palette', slot: 0 },
      officialDistance: entry.official,
      lap,
      statusText,
      placement,
      displaySpeed: displaySpeed(entry, paceFactor, continuousFactors),
      tireLife: raceMode === 'continuous' ? entry.tireLife : null,
      pitState: raceMode === 'continuous' ? entry.pitState : 'none',
      pitTimeRemaining: raceMode === 'continuous' ? pitTimeRemaining(entry) : null,
      isFocused: entry.isFocused,
      showsNewStint: entry.newStintUntil !== null && raceTime < entry.newStintUntil,
      causesYellowFlag: causesYellowFlag(entry),
    };
  }

  /** Display motion in laps/second the client uses to extrapolate between
   *  syncs. Mirrors the motion the server itself applies in step(). */
  function displaySpeed(
    entry: Entry,
    paceFactor: number,
    continuousFactors?: Map<string, number>,
  ): number {
    if (connection.kind !== 'live') return 0;
    if (entry.isRetired || entry.isQueuedNextGrid) return 0;
    if (phase === 'live') {
      if (raceMode === 'continuous') {
        if (!isContinuousRunner(entry)) return 0;
        if (controlPhase === 'deployed' || controlPhase === 'inThisLap') {
          const index = safetyQueue.indexOf(entry.terminalID);
          if (index < 0) return 0;
          if (index === 0) return RaceRules.baseSpeed * MultiplayerRules.safetyCarLeaderFactor;
          const ahead = entries.get(safetyQueue[index - 1]);
          return RaceRules.baseSpeed * (ahead
            ? safetyCarFollowerFactor(ahead, entry)
            : MultiplayerRules.safetyCarLeaderFactor);
        }
        return RaceRules.baseSpeed
          * (entry.pace.lap === -1 ? 1 : entry.pace.multiplier)
          * (continuousFactors?.get(entry.terminalID) ?? continuousNormalFactor(entry));
      }
      if (entry.status === 'working') {
        return RaceRules.baseSpeed
          * (entry.pace.lap === -1 ? 1 : entry.pace.multiplier)
          * paceFactor
          * entry.externalPace;
      }
      if (entry.status === 'done') {
        return RaceRules.baseSpeed * RaceRules.doneCooldownFactor * paceFactor;
      }
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

  /** Sets the race distance for the selected circuit.
   *
   *  Distance already covered is kept: cars stay where they are and the finish
   *  moves. Shortening it below what the leader has already run would leave the
   *  race unfinishable by the normal path, so that case finishes the Grand Prix
   *  immediately — the same outcome as a car crossing the line. */
  function setTotalLaps(laps: number, now: number): void {
    const next = Math.max(1, Math.floor(laps));
    if (next === totalLaps) return;
    advance(now);
    totalLaps = next;
    if (phase !== 'live') return;
    for (const entry of entries.values()) {
      if (!entry.isQueuedNextGrid && entry.official >= totalLaps) {
        finishGrandPrix();
        return;
      }
    }
  }

  /** Injects a live speed factor for one car (multiplayer uptime, M4). Settles
   *  scored time first so the new factor applies only from this instant. */
  function setExternalPace(terminalID: string, factor: number, now: number): void {
    const entry = entries.get(terminalID);
    if (!entry) return;
    const next = Math.min(Math.max(factor, 0), 2);
    if (next === entry.externalPace) return;
    advance(now);
    entry.externalPace = next;
  }

  return { apply, applyConnection, applySnapshot, advance, presentation, setTotalLaps, setExternalPace };
}

export type RaceSession = ReturnType<typeof createRaceSession>;

// MARK: - Helpers

function clampPace(value: number): number {
  return Math.min(Math.max(value, RaceRules.paceMin), RaceRules.paceMax);
}

/** Local wall-clock `HH:MM:SS`. */
function clockText(now: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
}

/** One-based lap from official distance, capped at the finish. Shared so the
 *  lap a radio line quotes always matches the standings. */
function lapOf(entry: Entry, totalLaps: number): number {
  return Math.min(totalLaps, Math.floor(entry.official) + 1);
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

function countsForStatus(status: AgentStatus): CrewCounts {
  return {
    working: status === 'working' ? 1 : 0,
    idle: status === 'idle' ? 1 : 0,
    done: status === 'done' ? 1 : 0,
    blocked: status === 'blocked' ? 1 : 0,
  };
}
