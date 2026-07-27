import type { CircuitDefinition } from './circuits.js';

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

/** Smoothing steps emitted per control point. The centerline length is always
 *  `controlPoints.length * SMOOTHING_STEPS`. */
export const SMOOTHING_STEPS = 24;

/** Smoothed dense polyline used for drawing and marker placement.
 *
 *  Each control point contributes one quadratic arc from the midpoint of its
 *  incoming edge, through the point itself, to the midpoint of its outgoing
 *  edge. Collinear runs therefore stay straight — their midpoints lie on the
 *  same line — while isolated vertices round into corners. */
export function centerline(rect: Rect, circuit: CircuitDefinition): CircuitPoint[] {
  const anchors = circuit.points.map(([px, py]) => {
    const x = circuit.spreadAnchor + (px - circuit.spreadAnchor) * circuit.spread;
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
    for (let step = 0; step < SMOOTHING_STEPS; step += 1) {
      line.push(quadraticPoint(start, p1, end, step / SMOOTHING_STEPS));
    }
  }
  return line;
}

/** Centerline index where a control point lands after smoothing.
 *
 *  Control point `i` is the apex of the arc emitted by iteration `i - 1`, so
 *  its own position appears at the midpoint of that arc. */
export function centerlineIndexOf(controlIndex: number, count: number): number {
  const previous = (controlIndex - 1 + count) % count;
  return previous * SMOOTHING_STEPS + Math.floor(SMOOTHING_STEPS / 2);
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
