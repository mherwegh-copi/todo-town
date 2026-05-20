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
});
