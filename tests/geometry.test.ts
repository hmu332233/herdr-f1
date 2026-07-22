import { describe, expect, it } from 'vitest';
import { centerline, cumulativeLengths, pointAt } from '../src/web/geometry.js';

const rect = { x: 0, y: 0, width: 600, height: 540 };

describe('circuit geometry', () => {
  it('produces a dense closed loop inside the rect', () => {
    const line = centerline(rect);
    expect(line.length).toBe(19 * 24); // 19 control points × 24 smoothing steps
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
    const line = centerline(rect);
    const lengths = cumulativeLengths(line);
    const total = lengths[line.length];
    const a = pointAt(0.25, line, lengths);
    const b = pointAt(0.25 + 1e-4, line, lengths);
    // Tiny fraction step ≈ proportional arc distance (uniform speed).
    expect(Math.hypot(b.x - a.x, b.y - a.y)).toBeCloseTo(total * 1e-4, 1);
    expect(Number.isFinite(a.angle)).toBe(true);
  });

  it('pointAt wraps fractions outside [0,1)', () => {
    const line = centerline(rect);
    const lengths = cumulativeLengths(line);
    const wrapped = pointAt(1.25, line, lengths);
    const direct = pointAt(0.25, line, lengths);
    expect(wrapped.x).toBeCloseTo(direct.x, 9);
    expect(wrapped.y).toBeCloseTo(direct.y, 9);
  });
});
