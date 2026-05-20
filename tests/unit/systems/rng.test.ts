import { describe, it, expect } from 'vitest';
import { createRng } from '../../../src/systems/rng';

describe('rng', () => {
  it('produces deterministic sequence for a given seed', () => {
    const a = createRng(42);
    const b = createRng(42);
    const seqA = [a(), a(), a()];
    const seqB = [b(), b(), b()];
    expect(seqA).toEqual(seqB);
  });

  it('produces different sequences for different seeds', () => {
    const a = createRng(1)();
    const b = createRng(2)();
    expect(a).not.toEqual(b);
  });

  it('returns values in [0, 1)', () => {
    const r = createRng(99);
    for (let i = 0; i < 1000; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});
