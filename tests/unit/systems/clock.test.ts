import { describe, it, expect } from 'vitest';
import { dayIndex, hourOfDay, dateKey, daysBetween } from '../../../src/systems/clock';

describe('clock', () => {
  it('dayIndex counts whole days since createdAt at local midnight', () => {
    const created = new Date(2026, 4, 20, 14, 0, 0).getTime();
    const same = new Date(2026, 4, 20, 23, 59, 0).getTime();
    const next = new Date(2026, 4, 21, 0, 1, 0).getTime();
    expect(dayIndex(created, same)).toBe(0);
    expect(dayIndex(created, next)).toBe(1);
  });

  it('hourOfDay returns local hour 0-23', () => {
    const t = new Date(2026, 4, 20, 7, 30).getTime();
    expect(hourOfDay(t)).toBe(7);
  });

  it('dateKey returns YYYY-MM-DD local', () => {
    const t = new Date(2026, 4, 20, 12, 0).getTime();
    expect(dateKey(t)).toBe('2026-05-20');
  });

  it('daysBetween returns whole-day delta', () => {
    const a = new Date(2026, 4, 20, 14).getTime();
    const b = new Date(2026, 4, 23, 8).getTime();
    expect(daysBetween(a, b)).toBe(3);
  });
});
