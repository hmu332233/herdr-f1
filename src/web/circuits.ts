/** Circuit definitions. Each entry is authored geometry: an ordered ring of
 *  normalized y-up control points tracing the centerline, plus the explicit
 *  pit-lane attachment.
 *
 *  Control points feed the same midpoint-smoothing pipeline for every circuit
 *  (see geometry.centerline), so the rule is unchanged: collinear runs stay
 *  straight, isolated vertices round into corners. Author straights as three
 *  or more collinear points; author corners as single vertices.
 *
 *  Pit anchors are explicit rather than derived from the bounding box. Real
 *  layouts rarely put a flat straight at the bottom of their bounds, so
 *  inferring the pit lane from the lowest points lands it mid-corner. Each
 *  circuit instead names the control-point indices its pit lane runs beside.
 */

export interface CircuitDefinition {
  id: string;
  /** Shown in the selector. */
  name: string;
  points: ReadonlyArray<readonly [number, number]>;
  /** Width-to-height ratio of the space these points were authored in. The
   *  renderer fits a rect of this shape, so a layout traced from a wide diagram
   *  keeps its proportions instead of being stretched to fill a square. */
  aspect: number;
  /** How much of the scene frame to fill instead of holding `aspect` exactly.
   *  0 (default) preserves the source proportions; 1 uses the whole frame.
   *  Wide layouts need some of this: fitted exactly they leave the frame's
   *  height unused, which squeezes parallel stretches of track together. */
  fill?: number;
  /** Car-marker radius override. Layouts that run stretches of track close
   *  together need smaller markers for those stretches to stay readable as
   *  separate track. Defaults to the standard radius when omitted. */
  markerRadius?: number;
  /** Number of places the circuit deliberately crosses over itself — Suzuka's
   *  figure-eight bridge is one. Declaring it distinguishes a real feature of
   *  the layout from an authoring mistake, which would otherwise look identical
   *  to a geometry check. */
  crossovers?: number;
  /** Asphalt width in design units (default 22). A layout traced to real
   *  proportions needs a narrower ribbon than the stylized default: where the
   *  real circuit runs two legs side by side, too wide a ribbon merges them
   *  into a single road. Scale it from the source — ribbon width as a fraction
   *  of lap length — rather than by eye. */
  trackWidth?: number;
  /** Horizontal spread about `spreadAnchor`, applied to authored x before
   *  fitting. 1 leaves the traced proportions alone. */
  spread: number;
  spreadAnchor: number;
  /** Control-point indices the pit lane attaches to. The lane is drawn beside
   *  the segment between them, so they should bracket a genuine pit straight
   *  and be ordered along the direction of travel. */
  pit: { entry: number; exit: number };
}

/** The original authored circuit — the stylized shape this dashboard shipped
 *  with. Kept as the default so existing sessions render unchanged. */
const HERDR: CircuitDefinition = {
  id: 'herdr',
  name: 'HERDR CIRCUIT',
  points: [
    // Long start/finish straight feeding a decisive right-side climb.
    [0.58, 0.10], [0.72, 0.10], [0.78, 0.16],
    [0.77, 0.43], [0.74, 0.75],
    // Broad terrain-like crown with one changing-radius transition.
    [0.67, 0.84], [0.53, 0.92], [0.42, 0.83],
    [0.30, 0.86], [0.22, 0.78],
    // Three distinct left-side complexes instead of repeated waves.
    [0.24, 0.68], [0.18, 0.61], [0.23, 0.53],
    [0.15, 0.46], [0.20, 0.38], [0.13, 0.27],
    // Lower hairpin opens progressively onto the main straight.
    [0.10, 0.17], [0.18, 0.11], [0.38, 0.10],
  ],
  // Authored for a near-square frame, which is what it always rendered into.
  aspect: 600 / 540,
  // The natural-circuit concept has a slightly broader footprint (authored
  // geometry, not view stretching).
  spread: 1.3,
  spreadAnchor: 0.44,
  // Indices 17→18→0→1 are the collinear bottom straight the pit lane was
  // originally inferred from; naming it explicitly preserves that placement.
  pit: { entry: 18, exit: 1 },
};

/** Suzuka, derived from the circuit's own SVG path data.
 *
 *  The source path's cubic segments were flattened, simplified, then normalized
 *  and flipped into this module's y-up space — so these points are the
 *  published centreline rather than an interpretation of a picture of one. The
 *  source loop closes exactly.
 *
 *  Suzuka is a figure eight: after the Degner corners the track crosses over
 *  itself on a bridge, and the two legs meet at a point on screen. Lap progress
 *  keeps the cars apart — one at 44% and one at 84% are half a lap from each
 *  other — but they draw in the same place, so `markerRadius` shrinks the discs
 *  enough for both streams to stay legible through the crossing. */
const SUZUKA: CircuitDefinition = {
  id: 'suzuka',
  name: 'SUZUKA',
  points: [
    // Main straight past the pits, into the opening right-hander.
    [0.622, 0.965], [0.922, 0.957], [0.949, 0.926], [0.965, 0.857],
    [0.957, 0.824], [0.943, 0.804],
    // The Esses: linked alternating direction changes.
    [0.855, 0.820], [0.801, 0.757], [0.735, 0.792], [0.689, 0.725],
    [0.667, 0.713], [0.641, 0.730], [0.611, 0.827], [0.577, 0.833],
    // Dunlop curve dropping away toward the Degner corners.
    [0.536, 0.786], [0.508, 0.714], [0.499, 0.621], [0.513, 0.454],
    [0.475, 0.341], [0.454, 0.341],
    // Under the crossover bridge and out to the hairpin.
    [0.349, 0.463], [0.316, 0.567], [0.301, 0.575], [0.296, 0.548],
    [0.316, 0.421], [0.317, 0.357], [0.310, 0.310], [0.285, 0.245],
    // The long left sweep of Spoon.
    [0.234, 0.177], [0.192, 0.151], [0.162, 0.152], [0.090, 0.194],
    [0.068, 0.193], [0.041, 0.137], [0.035, 0.100], [0.040, 0.067],
    [0.057, 0.041], [0.085, 0.036],
    // Back straight climbing to 130R, crossing over the Degner leg.
    [0.195, 0.099], [0.445, 0.386], [0.460, 0.431], [0.470, 0.510],
    // Casio triangle chicane, then back onto the main straight.
    [0.469, 0.758], [0.476, 0.784], [0.498, 0.807], [0.505, 0.888],
    [0.547, 0.952],
  ],
  // Derived from the source path's own bounding box: 20016 × 9870 units.
  aspect: 2.0279,
  // A wide layout fitted to its exact aspect leaves most of the frame's height
  // unused; filling some of it gives the esses and chicane usable room.
  fill: 0.65,
  // Scaled from the source: its ribbon is 318.9 units against a 57760-unit lap,
  // so at this circuit's rendered lap length a faithful ribbon is ~10 design
  // units. The stylized default of 22 is over twice as wide and merges the
  // Degner and Spoon legs, which really do run side by side here.
  trackWidth: 10,
  // Smaller discs so the two legs of the figure eight stay readable where they
  // cross. The crossing is a real feature of the circuit, not a data artefact.
  markerRadius: 8,
  // The crossunder bridge after Degner, where the back straight passes over the
  // Degner leg.
  crossovers: 1,
  spread: 1,
  spreadAnchor: 0.5,
  // Indices 46→1: the main straight past the pits, which is also where the
  // source path marks the start/finish line.
  pit: { entry: 46, exit: 1 },
};

export const CIRCUITS: readonly CircuitDefinition[] = [HERDR, SUZUKA];

export const DEFAULT_CIRCUIT_ID = HERDR.id;

export function circuitByID(id: string | null | undefined): CircuitDefinition {
  return CIRCUITS.find(circuit => circuit.id === id) ?? HERDR;
}
