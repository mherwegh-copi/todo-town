import { describe, it, expect } from 'vitest';
import { villagerScheduleForDay } from '../../../../src/systems/villagerPath/schedule';
import { initWorld } from '../../../../src/systems/init';

describe('villagerPath/schedule (skeleton)', () => {
  it('returns a DaySchedule with day field set', () => {
    const s = initWorld(0, 1);
    const v = s.world.villagers[0]!;
    const ds = villagerScheduleForDay(v, 5, s);
    expect(ds.day).toBe(5);
  });

  it('produces no segments covering sleep hours (00:00–06:00)', () => {
    const s = initWorld(0, 1);
    const v = s.world.villagers[0]!;
    const ds = villagerScheduleForDay(v, 0, s);
    for (const seg of ds.segments) {
      const sleepEndMs = 6 * 3_600_000;
      expect(seg.startMs).toBeGreaterThanOrEqual(sleepEndMs);
    }
  });

  it('is deterministic for the same (villager, day, state)', () => {
    const s = initWorld(0, 1);
    const v = s.world.villagers[0]!;
    const a = villagerScheduleForDay(v, 3, s);
    const b = villagerScheduleForDay(v, 3, s);
    expect(b).toBe(a);
  });
});
