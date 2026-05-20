import { describe, it, expect } from 'vitest';
import { seasonForDay } from '../../../src/systems/season';

describe('season', () => {
  it('cycles spring/summer/autumn/winter every 30 days', () => {
    expect(seasonForDay(0)).toBe('spring');
    expect(seasonForDay(29)).toBe('spring');
    expect(seasonForDay(30)).toBe('summer');
    expect(seasonForDay(60)).toBe('autumn');
    expect(seasonForDay(90)).toBe('winter');
    expect(seasonForDay(120)).toBe('spring');
  });
});
