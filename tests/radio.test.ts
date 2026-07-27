import { describe, expect, it } from 'vitest';
import { radioText } from '../src/server/radio.js';
import type { RadioKind } from '../src/shared/presentation.js';

const KINDS: RadioKind[] = [
  'boxBox', 'greenAgain', 'incident', 'recovered', 'chequered', 'newStint', 'retired',
];

describe('radio phrasing', () => {
  it('produces a non-empty line for every kind', () => {
    for (const kind of KINDS) {
      expect(radioText(kind, 'seed').length).toBeGreaterThan(0);
    }
  });

  it('is deterministic for the same kind and seed', () => {
    for (const kind of KINDS) {
      expect(radioText(kind, 'gp1|t1|4')).toBe(radioText(kind, 'gp1|t1|4'));
    }
  });

  it('varies the line as the seed changes', () => {
    const lines = new Set(
      Array.from({ length: 40 }, (_, i) => radioText('boxBox', `seed-${i}`)),
    );
    expect(lines.size).toBeGreaterThan(1);
  });

  it('keeps each kind to its own script', () => {
    const incidents = new Set(
      Array.from({ length: 40 }, (_, i) => radioText('incident', `seed-${i}`)),
    );
    const boxes = new Set(
      Array.from({ length: 40 }, (_, i) => radioText('boxBox', `seed-${i}`)),
    );
    for (const line of incidents) expect(boxes.has(line)).toBe(false);
  });
});
