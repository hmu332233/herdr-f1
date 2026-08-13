/// Fixed game rules for the fictional Grand Prix. None of these values are
/// measurements of real work; they exist only to make status fun to watch.
/// Values are the Swift RaceRules constants verbatim.
export const RaceRules = {
  totalLaps: 58,
  /** Nominal seconds per lap at pace 1.0. */
  baseLapDuration: 18,
  /** Nominal working velocity in laps per second. */
  baseSpeed: 1 / 18,
  paceMin: 0.75,
  paceMax: 1.25,
  /** Done cooldown display motion relative to nominal base speed. */
  doneCooldownFactor: 0.25,
  /** A single elapsed step larger than this is capped so sleep/debugger
   *  pauses cannot award a block of phantom laps. */
  maximumAcceptedStep: 1.0,
  podiumDuration: 8.0,
  /** A live new entrant starts this many laps behind the current last car. */
  newEntrantDeficit: 0.15,
  /** How long the transient NEW STINT treatment stays visible (race seconds). */
  newStintDuration: 4.0,
  /** Pace of the still-running cars while the yellow flag is out, relative to
   *  nominal. A stopped car brings out the safety car, so the rest of the field
   *  slows and holds position instead of racing past the incident. Scoring is
   *  genuinely slowed — not just the animation — so the standings a viewer reads
   *  match the motion they watched. */
  safetyCarFactor: 0.4,
  /** Number of distinct constructor liveries available. Must match the length
   *  of palette.teamColors on the client: slots are handed out in the palette's
   *  max-contrast order, and teams beyond it fall back to pattern outlines. */
  paletteSize: 11,
  maximumGridNumber: 99,
  /** Team radio lines retained per Grand Prix; older ones fall off the back. */
  radioHistoryLimit: 40,
} as const;

const MASK_64 = 0xffffffffffffffffn;

/** FNV-1a 64-bit: deliberately process-independent so colors and numbers stay
 *  approximately stable across launches (mirrors Swift RaceIdentity). */
export function stableHash(value: string): bigint {
  let hash = 14695981039346656037n;
  for (const byte of new TextEncoder().encode(value)) {
    hash ^= BigInt(byte);
    hash = (hash * 1099511628211n) & MASK_64;
  }
  return hash;
}

/** Rules for the multiplayer two-car mode (design decisions M1–M8). Cars are
 *  fictional; these constants shape how real agent activity becomes speed. */
export const MultiplayerRules = {
  /** Cars fielded per team, like a real constructor (M1). A participant with a
   *  single agent fields one car (M5). */
  carsPerTeam: 2,
  /** Crew agents working at once for full power — M3's k. At 1, scale buys
   *  availability (someone is always working) rather than raw speed. */
  crewPowerCap: 1,
  /** Sliding window (seconds) the rolling uptime is measured over (M4). The
   *  momentum dial: shorter is jumpier, longer is heavier. */
  uptimeWindowSeconds: 90,
  /** Car speed factor = uptimeFloor + uptimeSpan × rolling uptime (M4). */
  uptimeFloor: 0.75,
  uptimeSpan: 0.5,
  /** Per-lap random jitter half-width. Multiplayer speed is earned via uptime;
   *  randomness stays as flavor only (±5% against local's ±25%). */
  paceJitterHalfWidth: 0.05,
  /** Continuous mode keeps state and uptime legible by narrowing flavour. */
  continuousPaceJitterHalfWidth: 0.005,
  /** Continuous cars always circulate close to nominal pace. Activity is a
   *  small advantage rather than enough to split the field quickly. */
  cruisingFactor: 0.98,
  continuousWorkingBonusSpan: 0.02,
  /** Green-flag recovery assist. Every follower is eligible, but the boost is
   *  added to its own pace only after it falls outside the nearby racing pack.
   *  It does not guarantee that a slower car closes on the car ahead. */
  continuousCatchupMax: 0.04,
  continuousCatchupStartGap: 0.1,
  continuousCatchupFullGap: 0.5,
  /** Eight tenths of a car-marker length, allowing at most 20% visual overlap.
   *  The existing Safety Car gap is about 1.5 marker lengths, so
   *  0.025 / 1.5 * 0.8 keeps both rules in one scale. */
  continuousCatchupTargetGap: 1 / 75,
  /** A working car close behind a cruising car gets a short passing burst.
   *  It disappears as soon as the pass is complete or the target works. */
  continuousOvertakeBoost: 0.04,
  continuousOvertakeRange: 0.08,
  /** Working consumes 80 points of tyre life over 20 nominal laps. Worn
   *  tyres lose up to 0.01x before the mandatory stop at 20%, preserving a
   *  small intrinsic advantage over a 0.98x cruising car. */
  tireLifeFresh: 100,
  tireLifePitThreshold: 20,
  tireWearStartsAt: 50,
  tireWorkingSecondsToPit: 20 * RaceRules.baseLapDuration,
  tirePenaltyMax: 0.01,
  pitEntrySeconds: 1.4,
  pitServiceSeconds: 4,
  pitExitSeconds: 1.4,
  safetyCarLeaderFactor: 0.4,
  safetyCarCatchupFactor: 0.8,
  /** Approximate 1.5 marker lengths as a fraction of a lap. */
  safetyCarQueueGap: 0.025,
  safetyCarCatchupRange: 0.25,
  greenFlagDuration: 3,
} as const;

/** Pace multiplier for one official lap, sampled once and fixed for that lap. */
export type RacePaceSource = (grandPrix: number, terminalID: string, lap: number) => number;

/** Production pace: seeded pseudo-random, reproducible across launches for
 *  the same grand prix sequence and terminal, varying lap to lap. */
export const seededPace: RacePaceSource = (grandPrix, terminalID, lap) => {
  const hash = stableHash(`${grandPrix}|${terminalID}|${lap}`) ^ 0x5deece66n;
  // A second mix avalanches the low bits before the modulo.
  const mixed = ((hash ^ (hash >> 33n)) * 0xff51afd7ed558ccdn) & MASK_64;
  const unit = Number(mixed % 100000n) / 99999;
  return RaceRules.paceMin + unit * (RaceRules.paceMax - RaceRules.paceMin);
};

/** Multiplayer pace: the same seeded randomness squeezed into the jitter band.
 *  Rank is meant to be earned through uptime (M3/M4); the dice only flavor. */
export const multiplayerPace: RacePaceSource = (grandPrix, terminalID, lap) => {
  const scale = MultiplayerRules.paceJitterHalfWidth / (RaceRules.paceMax - 1);
  return 1 + (seededPace(grandPrix, terminalID, lap) - 1) * scale;
};

export const continuousMultiplayerPace: RacePaceSource = (grandPrix, terminalID, lap) => {
  const scale = MultiplayerRules.continuousPaceJitterHalfWidth / (RaceRules.paceMax - 1);
  return 1 + (seededPace(grandPrix, terminalID, lap) - 1) * scale;
};
