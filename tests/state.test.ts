import { describe, expect, it } from 'vitest';
import { extrapolateProgress } from '../src/web/state.js';

describe('extrapolateProgress', () => {
  it('advances track progress by displaySpeed and wraps at 1', () => {
    expect(extrapolateProgress({ kind: 'track', progress: 0.9 }, 1 / 18, 3.6)).toBeCloseTo(0.1, 9);
  });

  it('cooldown markers keep circulating', () => {
    expect(extrapolateProgress({ kind: 'cooldown', progress: 0.5 }, 1 / 72, 7.2)).toBeCloseTo(0.6, 9);
  });

  it('incidents hold position (speed 0)', () => {
    expect(extrapolateProgress({ kind: 'incidentTrack', progress: 0.4 }, 0, 60)).toBeCloseTo(0.4, 9);
  });

  it('non-circuit placements have no progress', () => {
    expect(extrapolateProgress({ kind: 'pit' }, 0, 1)).toBeNull();
    expect(extrapolateProgress({ kind: 'nextGrid' }, 0, 1)).toBeNull();
    expect(extrapolateProgress({ kind: 'retired' }, 0, 1)).toBeNull();
    expect(extrapolateProgress({ kind: 'incidentPit' }, 0, 1)).toBeNull();
  });
});
