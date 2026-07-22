export interface CircuitPoint {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Stylized closed circuit in normalized y-up coordinates (from the Swift
 *  original). Collinear runs keep the straights straight through midpoint
 *  smoothing; only the isolated vertices round into corners. */
const CONTROL_POINTS: ReadonlyArray<readonly [number, number]> = [
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
];

/** Smoothed dense polyline used for drawing and marker placement. */
export function centerline(rect: Rect): CircuitPoint[] {
  const anchors = CONTROL_POINTS.map(([px, py]) => {
    // The natural-circuit concept has a slightly broader footprint (authored
    // geometry, not view stretching).
    const x = 0.44 + (px - 0.44) * 1.3;
    return { x: rect.x + x * rect.width, y: rect.y + (1 - py) * rect.height };
  });
  const line: CircuitPoint[] = [];
  const count = anchors.length;
  for (let index = 0; index < count; index += 1) {
    const p0 = anchors[index];
    const p1 = anchors[(index + 1) % count];
    const p2 = anchors[(index + 2) % count];
    const start = midpoint(p0, p1);
    const end = midpoint(p1, p2);
    for (let step = 0; step < 24; step += 1) {
      line.push(quadraticPoint(start, p1, end, step / 24));
    }
  }
  return line;
}

/** Cumulative arc length; index i = length up to line[i], last = total. */
export function cumulativeLengths(line: CircuitPoint[]): number[] {
  const lengths: number[] = [0];
  for (let index = 1; index <= line.length; index += 1) {
    lengths.push(lengths[index - 1] + distance(line[index - 1], line[index % line.length]));
  }
  return lengths;
}

/** Maps a normalized display fraction to a position and tangent angle using
 *  cumulative path length, so motion speed is uniform at every size. */
export function pointAt(
  fraction: number,
  line: CircuitPoint[],
  lengths: number[] = cumulativeLengths(line),
): { x: number; y: number; angle: number } {
  let normalized = fraction % 1;
  if (normalized < 0) normalized += 1;
  const target = normalized * lengths[line.length];
  let low = 0;
  while (low < line.length - 1 && lengths[low + 1] < target) low += 1;
  const a = line[low];
  const b = line[(low + 1) % line.length];
  const segment = Math.max(0.0001, lengths[low + 1] - lengths[low]);
  const t = (target - lengths[low]) / segment;
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    angle: Math.atan2(b.y - a.y, b.x - a.x),
  };
}

/** Unit travel-direction tangent of the circuit at a centerline index. */
export function tangentAt(index: number, line: CircuitPoint[]): { dx: number; dy: number } {
  const count = line.length;
  const previous = line[(index - 1 + count) % count];
  const next = line[(index + 1) % count];
  const length = Math.max(0.0001, Math.hypot(next.x - previous.x, next.y - previous.y));
  return { dx: (next.x - previous.x) / length, dy: (next.y - previous.y) / length };
}

function midpoint(a: CircuitPoint, b: CircuitPoint): CircuitPoint {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function distance(a: CircuitPoint, b: CircuitPoint): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function quadraticPoint(start: CircuitPoint, control: CircuitPoint, end: CircuitPoint, t: number): CircuitPoint {
  const inverse = 1 - t;
  return {
    x: inverse * inverse * start.x + 2 * inverse * t * control.x + t * t * end.x,
    y: inverse * inverse * start.y + 2 * inverse * t * control.y + t * t * end.y,
  };
}
