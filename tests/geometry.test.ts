import { describe, expect, it } from 'vitest';
import { CIRCUITS, circuitByID, DEFAULT_CIRCUIT_ID } from '../src/web/circuits.js';
import {
  centerline, centerlineIndexOf, cumulativeLengths, pointAt, SMOOTHING_STEPS,
} from '../src/web/geometry.js';

const rect = { x: 0, y: 0, width: 600, height: 540 };
const herdr = circuitByID(DEFAULT_CIRCUIT_ID);

describe('circuit geometry', () => {
  it('produces a dense closed loop inside the rect', () => {
    const line = centerline(rect, herdr);
    expect(line.length).toBe(herdr.points.length * SMOOTHING_STEPS);
    for (const point of line) {
      expect(point.x).toBeGreaterThanOrEqual(rect.x - 1);
      expect(point.x).toBeLessThanOrEqual(rect.x + rect.width + 1);
      expect(point.y).toBeGreaterThanOrEqual(rect.y - 1);
      expect(point.y).toBeLessThanOrEqual(rect.y + rect.height + 1);
    }
    // Closed: the loop's end is near its start.
    const first = line[0];
    const last = line[line.length - 1];
    expect(Math.hypot(first.x - last.x, first.y - last.y)).toBeLessThan(30);
  });

  it('pointAt maps fractions to arc-length-uniform positions', () => {
    const line = centerline(rect, herdr);
    const lengths = cumulativeLengths(line);
    const total = lengths[line.length];
    const a = pointAt(0.25, line, lengths);
    const b = pointAt(0.25 + 1e-4, line, lengths);
    // Tiny fraction step ≈ proportional arc distance (uniform speed).
    expect(Math.hypot(b.x - a.x, b.y - a.y)).toBeCloseTo(total * 1e-4, 1);
    expect(Number.isFinite(a.angle)).toBe(true);
  });

  it('pointAt wraps fractions outside [0,1)', () => {
    const line = centerline(rect, herdr);
    const lengths = cumulativeLengths(line);
    const wrapped = pointAt(1.25, line, lengths);
    const direct = pointAt(0.25, line, lengths);
    expect(wrapped.x).toBeCloseTo(direct.x, 9);
    expect(wrapped.y).toBeCloseTo(direct.y, 9);
  });

  it('centerlineIndexOf lands near the control point it names', () => {
    const line = centerline(rect, herdr);
    const count = herdr.points.length;
    // Midpoint smoothing pulls the curve toward each control point without
    // passing through it — a quadratic at t=0.5 reaches only halfway — so the
    // index is the closest approach, not an exact hit. Pit anchors only need
    // to land on the right stretch of track, which this guarantees.
    herdr.points.forEach(([px, py], controlIndex) => {
      const x = herdr.spreadAnchor + (px - herdr.spreadAnchor) * herdr.spread;
      const expected = { x: rect.x + x * rect.width, y: rect.y + (1 - py) * rect.height };
      const actual = line[centerlineIndexOf(controlIndex, count)];
      expect(Math.hypot(actual.x - expected.x, actual.y - expected.y)).toBeLessThan(20);
    });
  });
});

describe('circuit registry', () => {
  it('falls back to the default for unknown or missing ids', () => {
    expect(circuitByID('nope').id).toBe(DEFAULT_CIRCUIT_ID);
    expect(circuitByID(null).id).toBe(DEFAULT_CIRCUIT_ID);
    expect(circuitByID(undefined).id).toBe(DEFAULT_CIRCUIT_ID);
  });

  it('every circuit is a well-formed closed loop with usable pit anchors', () => {
    const ids = new Set<string>();
    for (const circuit of CIRCUITS) {
      expect(ids.has(circuit.id)).toBe(false);
      ids.add(circuit.id);

      // Normalized authored space, and enough points to smooth into a circuit.
      expect(circuit.points.length).toBeGreaterThanOrEqual(8);
      for (const [px, py] of circuit.points) {
        expect(px).toBeGreaterThanOrEqual(0);
        expect(px).toBeLessThanOrEqual(1);
        expect(py).toBeGreaterThanOrEqual(0);
        expect(py).toBeLessThanOrEqual(1);
      }

      // Pit anchors must index real control points and be distinct, or the
      // pit lane would collapse to a single point.
      const { entry, exit } = circuit.pit;
      expect(Number.isInteger(entry)).toBe(true);
      expect(Number.isInteger(exit)).toBe(true);
      expect(entry).toBeGreaterThanOrEqual(0);
      expect(entry).toBeLessThan(circuit.points.length);
      expect(exit).toBeGreaterThanOrEqual(0);
      expect(exit).toBeLessThan(circuit.points.length);
      expect(entry).not.toBe(exit);

      // The spread transform must keep the circuit inside the fitted rect.
      const line = centerline(rect, circuit);
      for (const point of line) {
        expect(point.x).toBeGreaterThanOrEqual(rect.x - 1);
        expect(point.x).toBeLessThanOrEqual(rect.x + rect.width + 1);
        expect(point.y).toBeGreaterThanOrEqual(rect.y - 1);
        expect(point.y).toBeLessThanOrEqual(rect.y + rect.height + 1);
      }

      // Pit exit must lie a short way forward of pit entry along the lap.
      // Measured as forward (wrapping) distance, since a pit lane may
      // legitimately straddle the start/finish line — the default circuit's
      // does. A near-zero or near-full-lap gap would mean the anchors are the
      // same point or wound the wrong way round the circuit.
      const lengths = cumulativeLengths(line);
      const total = lengths[line.length];
      const count = circuit.points.length;
      const entryProgress = lengths[centerlineIndexOf(entry, count)] / total;
      const exitProgress = lengths[centerlineIndexOf(exit, count)] / total;
      const forward = (exitProgress - entryProgress + 1) % 1;
      expect(forward).toBeGreaterThan(0.02);
      expect(forward).toBeLessThan(0.5);
    }
  });

  // A doubled-back spur or an accidentally crossing leg renders as a circuit
  // cars appear to teleport across. Real layouts may cross on purpose, though —
  // Suzuka's figure eight does — so a crossing is only a bug when the circuit
  // did not declare one. Only non-adjacent segments are compared: neighbours
  // share an endpoint by definition.
  it('only declared crossovers self-intersect', () => {
    for (const circuit of CIRCUITS) {
      const line = centerline(rect, circuit);
      const crossings: string[] = [];
      for (let i = 0; i < line.length; i += 1) {
        const a1 = line[i];
        const a2 = line[(i + 1) % line.length];
        for (let j = i + 2; j < line.length; j += 1) {
          if (i === 0 && j === line.length - 1) continue; // wrap-around neighbours
          const b1 = line[j];
          const b2 = line[(j + 1) % line.length];
          if (segmentsCross(a1, a2, b1, b2)) crossings.push(`${i}×${j}`);
        }
      }
      if (circuit.crossovers) {
        // Declared: the count is bounded, but the crossing must actually exist.
        // A smoothing change that quietly removes it should fail here too.
        expect(crossings.length, `${circuit.id} declares ${circuit.crossovers} crossover(s)`)
          .toBeGreaterThan(0);
        expect(crossings.length).toBeLessThanOrEqual(circuit.crossovers * 4);
      } else {
        expect(crossings, `${circuit.id} self-intersects at ${crossings.slice(0, 5).join(', ')}`)
          .toEqual([]);
      }
    }
  });

  // Where two stretches of track run closer together than the asphalt is wide,
  // their ribbons merge and the pair renders as one wide road instead of two.
  // Real layouts do run legs side by side, so the fix is a narrower ribbon for
  // that circuit rather than moved geometry — hence checking width against
  // geometry here. Declared crossovers are exempt: there the track really does
  // meet itself.
  it('asphalt width keeps adjacent stretches distinct', () => {
    for (const circuit of CIRCUITS) {
      const line = centerline(rect, circuit);
      const lengths = cumulativeLengths(line);
      const total = lengths[line.length];
      // Scene-to-design scale, mirroring the renderer.
      const ds = Math.min((620 - 88) / 600, (540 - 80) / 540);
      const trackWidth = (circuit.trackWidth ?? 22) * ds;
      const zones: Array<{ x: number; y: number }> = [];
      for (let i = 0; i < line.length; i += 2) {
        for (let j = i + 2; j < line.length; j += 2) {
          const raw = Math.abs(lengths[i] - lengths[j]);
          if (Math.min(raw, total - raw) / total < 0.05) continue;
          if (Math.hypot(line[i].x - line[j].x, line[i].y - line[j].y) >= trackWidth) continue;
          const x = (line[i].x + line[j].x) / 2;
          const y = (line[i].y + line[j].y) / 2;
          if (!zones.some(z => Math.hypot(z.x - x, z.y - y) < 25)) zones.push({ x, y });
        }
      }
      expect(
        zones.length,
        `${circuit.id} merges asphalt in ${zones.length} place(s); allowed ${circuit.crossovers ?? 0}`,
      ).toBeLessThanOrEqual(circuit.crossovers ?? 0);
    }
  });

  // Two cars far apart in the lap but close together on screen read as one
  // blob. Markers must be small enough that the circuit's tightest approach
  // still separates them — except at a declared crossover, where the track
  // genuinely meets itself and no radius can help.
  it('marker radius suits each circuit tightest approach', () => {
    for (const circuit of CIRCUITS) {
      const line = centerline(rect, circuit);
      const lengths = cumulativeLengths(line);
      const total = lengths[line.length];
      let tightest = Infinity;
      for (let i = 0; i < line.length; i += 2) {
        for (let j = i + 2; j < line.length; j += 2) {
          const raw = Math.abs(lengths[i] - lengths[j]);
          const apart = Math.min(raw, total - raw) / total;
          if (apart < 0.08) continue; // adjacent along the lap, not a conflict
          const d = Math.hypot(line[i].x - line[j].x, line[i].y - line[j].y);
          if (d < tightest) tightest = d;
        }
      }
      if (circuit.crossovers) {
        // At a crossover the centrelines touch, so only check the markers were
        // shrunk from the default — the overlap itself is expected.
        expect(circuit.markerRadius, `${circuit.id} has a crossover, so it must shrink markers`)
          .toBeLessThan(12.5);
      } else {
        const r = circuit.markerRadius ?? 12.5;
        expect(tightest, `${circuit.id} tightest approach ${tightest.toFixed(1)}px vs radius ${r}`)
          .toBeGreaterThan(r * 2);
      }
    }
  });
});

interface Pt { x: number; y: number }

function cross(o: Pt, a: Pt, b: Pt): number {
  return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
}

/** Proper crossing test: strict sign changes on both sides, so segments that
 *  merely touch at an endpoint are not reported. */
function segmentsCross(a1: Pt, a2: Pt, b1: Pt, b2: Pt): boolean {
  const d1 = cross(a1, a2, b1);
  const d2 = cross(a1, a2, b2);
  const d3 = cross(b1, b2, a1);
  const d4 = cross(b1, b2, a2);
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0))
    && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
}
