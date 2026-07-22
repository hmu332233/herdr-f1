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
  paletteSize: 12,
  maximumGridNumber: 99,
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
