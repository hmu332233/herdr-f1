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
  /** Flag shown before the name in the selector. A regional-indicator pair for
   *  a real venue; the chequered flag for the authored circuit, which has no
   *  country. */
  flag: string;
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
  /** Suppresses the PIT ENTRY / PIT EXIT captions. Set it where the pit
   *  straight is short and steep enough that the two junctions crowd a corner
   *  and no placement reads cleanly; the lane, its bays and the PIT LANE title
   *  still mark it. */
  hidePitCaptions?: boolean;
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
  flag: '🏁',
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
  flag: '🇯🇵',
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

/** Korea International Circuit, derived from the layout's own SVG path data.
 *
 *  Only the racing line is carried over. The source drawing also contains two
 *  pale-grey chords — one cutting from turn 12 across to turn 3, another
 *  clipping turn 4 to turn 6 — which are alternative configurations rather than
 *  part of the lap; they are separate paths in the source and are left out. */
const KOREA: CircuitDefinition = {
  id: 'korea',
  name: 'KOREA INTERNATIONAL',
  flag: '🇰🇷',
  points: [
    // Out of the final corner onto the long left-hand section.
    [0.248, 0.694], [0.077, 0.685], [0.043, 0.652], [0.035, 0.606],
    [0.039, 0.582], [0.051, 0.561], [0.114, 0.549], [0.129, 0.531],
    // Climbing through the technical infield.
    [0.132, 0.494], [0.118, 0.396], [0.124, 0.362], [0.237, 0.292],
    [0.264, 0.267], [0.265, 0.237], [0.252, 0.180], [0.256, 0.159],
    [0.302, 0.152], [0.330, 0.156], [0.361, 0.219], [0.387, 0.253],
    [0.412, 0.270], [0.445, 0.272], [0.476, 0.261],
    // The long pit straight along the top, and the corner off the end of it.
    [0.518, 0.221], [0.948, 0.036], [0.958, 0.039], [0.965, 0.104],
    [0.961, 0.130],
    // The diagonal back across the circuit to the bottom straight.
    [0.349, 0.779], [0.357, 0.790], [0.859, 0.824], [0.865, 0.839],
    [0.857, 0.854], [0.796, 0.866], [0.770, 0.882], [0.792, 0.940],
    // The closing sequence back round to the start.
    [0.786, 0.958], [0.743, 0.965], [0.647, 0.955], [0.581, 0.935],
    [0.542, 0.907], [0.517, 0.899], [0.484, 0.905], [0.397, 0.955],
    [0.358, 0.948], [0.272, 0.887], [0.225, 0.840], [0.229, 0.798],
    [0.253, 0.718],
  ],
  // The racing line's own bounding box: 516.2 × 460.6 units.
  aspect: 1.1208,
  // Scaled from the source: a 7-unit ribbon against a 2226-unit lap.
  trackWidth: 8,
  markerRadius: 9,
  spread: 1,
  spreadAnchor: 0.5,
  // Indices 21→24: the run down to turn 1 that the source's pit path lies
  // alongside, and where the layout marks its start/finish line.
  pit: { entry: 21, exit: 24 },
};

/** Las Vegas Strip Circuit, derived from the layout's own SVG path data.
 *
 *  The source draws the track as a filled outline — two edge subpaths rather
 *  than a centreline — but the stroke is only ~1.3 units wide against a
 *  907-unit lap, so a single edge is the centreline at any render scale. The
 *  outer edge is used; averaging the two would need per-corner correspondence
 *  that arc-length pairing does not give around tight turns. */
const LAS_VEGAS: CircuitDefinition = {
  id: 'las-vegas',
  name: 'LAS VEGAS STRIP',
  flag: '🇺🇸',
  //  Point order follows the circuit's direction of travel — anticlockwise,
  //  east along the Strip then north up Harmon Avenue — as marked by the
  //  direction arrows in the source drawing. The traced edge ran the other way
  //  and is reversed here.
  points: [
    // Las Vegas Boulevard: the Strip, heading east along the bottom.
    [0.464, 0.035], [0.926, 0.041], [0.933, 0.088],
    // North up Harmon Avenue to turn 17.
    [0.962, 0.142], [0.965, 0.704],
    // The start/finish diagonal from turn 17 up to turn 1, pit lane alongside.
    [0.951, 0.761], [0.868, 0.937],
    // The turn 1-2-3 complex at the top of the circuit.
    [0.848, 0.937], [0.838, 0.904],
    [0.864, 0.799], [0.865, 0.766], [0.850, 0.730], [0.825, 0.709],
    // West along Koval Lane.
    [0.379, 0.691], [0.369, 0.705], [0.366, 0.865],
    // The MSG Sphere complex across the top-left.
    [0.342, 0.930], [0.293, 0.964], [0.268, 0.961], [0.259, 0.933],
    [0.250, 0.926], [0.201, 0.959],
    // South down the western edge.
    [0.199, 0.667], [0.191, 0.595], [0.155, 0.537], [0.063, 0.457],
    [0.049, 0.413], [0.035, 0.312],
    // The long run back down to the Strip.
    [0.077, 0.279], [0.170, 0.176], [0.290, 0.073], [0.360, 0.040],
    [0.447, 0.036],
  ],
  // The traced edge's own bounding box: 282.8 × 175.1 units.
  aspect: 1.6153,
  // Wide layout: fill some of the frame height so the Sphere complex and the
  // western sequence have usable room.
  fill: 0.5,
  // Scaled from the source: a 2.24-unit stroke against a 907-unit lap.
  trackWidth: 9,
  markerRadius: 9,
  // The start/finish diagonal is short and climbs at ~113°, so pit entry and
  // exit land close together against the turn 1 complex. The captions have no
  // room to read correctly there; the lane and its bays mark the pits instead.
  hidePitCaptions: true,
  spread: 1,
  spreadAnchor: 0.5,
  // Indices 4→6: the diagonal from turn 17 up to turn 1. Published layouts mark
  // PIT IN, START and PIT OUT along this stretch — not Harmon Avenue below it,
  // which is only the approach.
  pit: { entry: 4, exit: 6 },
};

export const CIRCUITS: readonly CircuitDefinition[] = [HERDR, KOREA, SUZUKA, LAS_VEGAS];

export const DEFAULT_CIRCUIT_ID = HERDR.id;

export function circuitByID(id: string | null | undefined): CircuitDefinition {
  return CIRCUITS.find(circuit => circuit.id === id) ?? HERDR;
}
