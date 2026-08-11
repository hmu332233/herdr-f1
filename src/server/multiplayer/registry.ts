import { MultiplayerRules } from '../rules.js';
import type { SourceAgent, SourceSnapshot, SourceTeam } from '../herdr/types.js';
import { createUptimeTracker, type UptimeTracker } from './uptime.js';
import { CREWS_PER_TEAM, emptyCrewReport, type CrewReport } from './wire.js';
import type { CrewState, RaceMode } from '../../shared/presentation.js';

interface CarState {
  /** Last reported crew aggregates; retained through disconnects so the team
   *  and its accumulated distance survive a Wi-Fi blip (design decision 7). */
  crew: CrewReport;
  /** Host-side cumulative stint count. Kept monotonic across reconnects —
   *  join restarts reset their counters, and a raw reset must not read as a
   *  fresh stint. Encoded into the car's session reference so the race
   *  session's NEW STINT detection fires on increments. */
  stintTotal: number;
  /** Rolling uptime (M4): the car's earned speed. Persists across
   *  disconnects — power drops to 0, history stays. */
  tracker: UptimeTracker;
}

interface Participant {
  name: string;
  /** The join socket is currently attached. A connected name cannot be claimed
   *  again; a disconnected one is resumed by reconnecting with it. */
  connected: boolean;
  /** The participant's local herdr feed is live. Mode rules decide whether a
   *  down feed pits the cars (classic) or keeps them cruising (continuous). */
  herdrLive: boolean;
  cars: CarState[];
  /** True until the first report after (re)connect: that report re-baselines
   *  the counters instead of being diffed, since a restarted join counts from
   *  zero again. */
  countersBaselined: boolean;
}

/**
 * The host's roster for the two-car paddock (M1): one participant = one team
 * fielding up to two cars, whose crews are the participant's real agents.
 * Projects everything the host knows into a SourceSnapshot for the race
 * session; car identities are `name/car1`, `name/car2`, stable for the whole
 * hosting session.
 */
export function createParticipantRegistry(raceMode: RaceMode = 'classic') {
  /** Insertion order is team order; participants are never removed, so teams
   *  and points survive departures for the lifetime of the host. */
  const participants = new Map<string, Participant>();

  function makeCar(): CarState {
    return {
      crew: emptyCrewReport(),
      stintTotal: 0,
      tracker: createUptimeTracker(MultiplayerRules.uptimeWindowSeconds),
    };
  }

  /** Claims `name` for a new join socket. Returns false while the name is
   *  connected — reject and let the caller explain; a disconnected name is
   *  resumed with its team, cars, and points intact. */
  function connect(name: string): boolean {
    const existing = participants.get(name);
    if (existing) {
      if (existing.connected) return false;
      existing.connected = true;
      // Telemetry stays stale until the resumed participant pushes a fresh
      // report, which also re-baselines the restarted counters.
      existing.herdrLive = false;
      existing.countersBaselined = false;
      return true;
    }
    participants.set(name, {
      name,
      connected: true,
      herdrLive: false,
      cars: Array.from({ length: CREWS_PER_TEAM }, makeCar),
      countersBaselined: false,
    });
    return true;
  }

  /** The team, retained report, and points stay; telemetry becomes stale. */
  function disconnect(name: string, now: number): void {
    const participant = participants.get(name);
    if (!participant) return;
    participant.connected = false;
    participant.herdrLive = false;
    stopPower(participant, now);
  }

  function update(name: string, crews: CrewReport[], now: number): void {
    const participant = participants.get(name);
    if (!participant) return;
    participant.herdrLive = true;
    for (let index = 0; index < CREWS_PER_TEAM; index += 1) {
      const car = participant.cars[index];
      const report = crews[index] ?? emptyCrewReport();
      if (participant.countersBaselined) {
        // Counters are cumulative per join process; only growth is an event.
        car.stintTotal += Math.max(0, report.counters.stints - car.crew.counters.stints);
      }
      car.crew = report;
      car.tracker.setPower(now, carPower(report));
    }
    participant.countersBaselined = true;
  }

  /** The participant's local Herdr went down: keep the grid and stale report. */
  function markOffline(name: string, now: number): void {
    const participant = participants.get(name);
    if (!participant) return;
    participant.herdrLive = false;
    stopPower(participant, now);
  }

  function stopPower(participant: Participant, now: number): void {
    for (const car of participant.cars) car.tracker.setPower(now, 0);
  }

  /** M3: full power once any crew agent works (crewPowerCap = 1). */
  function carPower(crew: CrewReport): number {
    return Math.min(crew.working, MultiplayerRules.crewPowerCap) / MultiplayerRules.crewPowerCap;
  }

  function isRacing(participant: Participant): boolean {
    return participant.connected && participant.herdrLive;
  }

  function crewState(crew: CrewReport): CrewState {
    if (crew.blocked > 0) return 'blocked';
    if (crew.working > 0) return 'working';
    if (crew.size > 0 && crew.done === crew.size) return 'done';
    if (crew.size > 0 && crew.idle === crew.size) return 'idle';
    return 'cruising';
  }

  /** Everything the race session gets to see: up to two synthesized cars per
   *  team. Names and per-agent identifiers never reached the host (M7), so
   *  this projection cannot leak them; what shows is the crew arithmetic the
   *  dashboard is meant to show (M6). */
  function snapshot(): SourceSnapshot {
    const teams: SourceTeam[] = [];
    for (const participant of participants.values()) {
      const racing = isRacing(participant);
      const agents: SourceAgent[] = [];
      participant.cars.forEach((car, index) => {
        if (car.crew.size === 0) return; // an empty crew fields no car (M5)
        const working = racing ? car.crew.working : 0;
        const state = crewState(car.crew);
        agents.push({
          terminalID: `${participant.name}/car${index + 1}`,
          paneID: `${participant.name}/car${index + 1}`,
          tabLabel: `car ${index + 1}`,
          // Rendered as the row badge: the crew arithmetic behind the speed.
          agentKind: `crew ${working}/${car.crew.size}`,
          // Monotonic stint identity; the race session announces NEW STINT
          // whenever it changes (M8).
          agentSessionReference: `stint-${car.stintTotal}`,
          // Focus is inactive in multiplayer (design decision 4).
          isFocused: false,
          status: !racing ? 'idle'
            : raceMode === 'classic'
              ? car.crew.blocked > 0 ? 'blocked' : car.crew.working > 0 ? 'working' : 'idle'
              : state === 'cruising' ? 'idle' : state,
          crewState: state,
          crewCounts: {
            working: car.crew.working,
            idle: car.crew.idle,
            done: car.crew.done,
            blocked: car.crew.blocked,
          },
          isLastKnown: !racing,
        });
      });
      if (agents.length === 0) continue;
      teams.push({ id: participant.name, label: participant.name, agents });
    }
    return { teams };
  }

  /** Live speed factors for every fielded car (M4), for the host to inject
   *  into the race session each tick. */
  function paceFactors(now: number): Array<{ terminalID: string; factor: number }> {
    const factors: Array<{ terminalID: string; factor: number }> = [];
    for (const participant of participants.values()) {
      participant.cars.forEach((car, index) => {
        if (car.crew.size === 0) return;
        const live = isRacing(participant);
        const state = crewState(car.crew);
        const uptime = car.tracker.uptime(now);
        factors.push({
          terminalID: `${participant.name}/car${index + 1}`,
          factor: raceMode === 'continuous'
            ? (!live || state !== 'working'
                ? MultiplayerRules.cruisingFactor
                : 1 + MultiplayerRules.continuousWorkingBonusSpan * uptime)
            : MultiplayerRules.uptimeFloor + MultiplayerRules.uptimeSpan * uptime,
        });
      });
    }
    return factors;
  }

  return { connect, disconnect, update, markOffline, snapshot, paceFactors };
}

export type ParticipantRegistry = ReturnType<typeof createParticipantRegistry>;
