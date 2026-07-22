import { describe, expect, it } from 'vitest';

describe('toolchain', () => {
  it('runs typescript tests', () => {
    const value: number = 2 + 2;
    expect(value).toBe(4);
  });
});
