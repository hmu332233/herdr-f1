import { describe, expect, it } from 'vitest';
import { RaceRules, seededPace, stableHash } from '../src/server/rules.js';

describe('RaceRules', () => {
  it('matches the Swift constants', () => {
    expect(RaceRules).toMatchObject({
      totalLaps: 58, baseLapDuration: 18, baseSpeed: 1 / 18,
      paceMin: 0.75, paceMax: 1.25, doneCooldownFactor: 0.25,
      maximumAcceptedStep: 1, podiumDuration: 8, newEntrantDeficit: 0.15,
      newStintDuration: 4, paletteSize: 12, maximumGridNumber: 99,
    });
  });
});

describe('stableHash', () => {
  it('is 64-bit FNV-1a (known vectors)', () => {
    // Standard FNV-1a test vectors.
    expect(stableHash('')).toBe(14695981039346656037n);
    expect(stableHash('a')).toBe(0xaf63dc4c8601ec8cn);
    expect(stableHash('foobar')).toBe(0x85944171f73967e8n);
  });

  it('is stable across calls and encodes UTF-8', () => {
    expect(stableHash('터미널-1')).toBe(stableHash('터미널-1'));
    expect(stableHash('t1')).not.toBe(stableHash('t2'));
  });
});

describe('seededPace', () => {
  it('stays within the pace range', () => {
    for (let lap = 0; lap < 58; lap += 1) {
      const pace = seededPace(1, 'terminal-a', lap);
      expect(pace).toBeGreaterThanOrEqual(RaceRules.paceMin);
      expect(pace).toBeLessThanOrEqual(RaceRules.paceMax);
    }
  });

  it('is deterministic per (grandPrix, terminal, lap) and varies across laps', () => {
    expect(seededPace(1, 't1', 3)).toBe(seededPace(1, 't1', 3));
    const paces = new Set(Array.from({ length: 10 }, (_, lap) => seededPace(1, 't1', lap)));
    expect(paces.size).toBeGreaterThan(1);
    expect(seededPace(1, 't1', 3)).not.toBe(seededPace(2, 't1', 3));
  });
});
