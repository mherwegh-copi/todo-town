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

  it('decays motivation -1 per 12h elapsed', () => {
    const t0 = new Date(2026, 4, 20, 0).getTime();
    const t1 = t0 + 13 * 60 * 60 * 1000;
    const s0 = { ...emptyState(t0, 1), motivation: 5 };
    const s1 = catchUp(s0, t1);
    expect(s1.motivation).toBe(4);
    expect(s1.motivationLastDecayAt).toBe(t0 + 12 * 60 * 60 * 1000);
  });

  it('decays motivation multiple steps over long gap', () => {
    const t0 = new Date(2026, 4, 20, 0).getTime();
    const t1 = t0 + 25 * 60 * 60 * 1000;
    const s0 = { ...emptyState(t0, 1), motivation: 5 };
    const s1 = catchUp(s0, t1);
    expect(s1.motivation).toBe(3);
  });

  it('does not decay below 0', () => {
    const t0 = new Date(2026, 4, 20, 0).getTime();
    const t1 = t0 + 50 * 60 * 60 * 1000;
    const s0 = { ...emptyState(t0, 1), motivation: 1 };
    const s1 = catchUp(s0, t1);
    expect(s1.motivation).toBe(0);
  });
});
