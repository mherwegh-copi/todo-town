import { describe, it, expect } from 'vitest';
import { catchUp } from '../../../src/systems/catchup';
import { emptyState } from '../../../src/domain/state';

describe('catchup', () => {
  it('updates day and lastSeenAt', () => {
    const t0 = new Date(2026, 4, 20, 12).getTime();
    const t1 = new Date(2026, 4, 23, 12).getTime();
    const s0 = emptyState(t0, 1);
    const s1 = catchUp(s0, t1);
    expect(s1.progression.day).toBe(3);
    expect(s1.lastSeenAt).toBe(t1);
  });

  it('caps catch-up at MAX_CATCHUP_DAYS', () => {
    const t0 = new Date(2026, 0, 1).getTime();
    const t1 = new Date(2026, 5, 1).getTime();
    const s0 = emptyState(t0, 1);
    const s1 = catchUp(s0, t1);
    expect(s1.progression.day).toBe(30);
  });

  it('accorde l ouverture du matin après 06:00 un nouveau jour', () => {
    const t0 = new Date(2026, 4, 20, 12).getTime();
    const t1 = new Date(2026, 4, 21, 8).getTime();
    const s1 = catchUp(emptyState(t0, 1), t1);
    expect(s1.construction.openings).toBe(1);
    expect(s1.construction.lastMorningDate).toBe('2026-05-21');
  });

  it('n accorde pas d ouverture avant 06:00', () => {
    const t0 = new Date(2026, 4, 20, 12).getTime();
    const t1 = new Date(2026, 4, 21, 5).getTime();
    const s1 = catchUp(emptyState(t0, 1), t1);
    expect(s1.construction.openings).toBe(0);
  });

  it('n accorde qu une seule ouverture matin par jour calendaire', () => {
    const t0 = new Date(2026, 4, 20, 12).getTime();
    const morning = catchUp(emptyState(t0, 1), new Date(2026, 4, 21, 8).getTime());
    const noon = catchUp(morning, new Date(2026, 4, 21, 13).getTime());
    expect(noon.construction.openings).toBe(1);
  });
});
