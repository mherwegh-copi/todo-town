import { describe, it, expect } from 'vitest';
import { weatherForDay } from '../../../src/systems/weather';

describe('weather', () => {
  it('is deterministic for given (seed, day)', () => {
    const a = weatherForDay(42, 5);
    const b = weatherForDay(42, 5);
    expect(a).toEqual(b);
  });

  it('returns snow only in winter', () => {
    let snowOutsideWinter = 0;
    for (let d = 0; d < 30; d++) {
      if (weatherForDay(1, d).kind === 'snow') snowOutsideWinter++;
    }
    expect(snowOutsideWinter).toBe(0);
  });

  it('valid kinds only', () => {
    const kinds = new Set(['clear', 'rain', 'snow']);
    for (let d = 0; d < 120; d++) {
      expect(kinds.has(weatherForDay(7, d).kind)).toBe(true);
    }
  });
});
