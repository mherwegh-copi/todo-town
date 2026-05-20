import { describe, it, expect } from 'vitest';
import { villagerScheduleForDay } from '../../../../src/systems/villagerPath/schedule';
import { initWorld } from '../../../../src/systems/init';
import { BUILDING_FOOTPRINT } from '../../../../src/domain/building';
import { nextId } from '../../../../src/domain/ids';
import { defaultSchedule } from '../../../../src/systems/villagerAI';

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

describe('villagerPath/schedule (work)', () => {
  it('produces walk + work pause + walk for workers', () => {
    const s = initWorld(0, 1);
    const townHall = s.world.buildings.find((b) => b.kind === 'townHall')!;
    const workplaceId = townHall.id;
    const worker = {
      ...s.world.villagers[0]!,
      workplaceId,
      schedule: defaultSchedule(workplaceId),
    };
    const ds = villagerScheduleForDay(worker, 0, s);
    const kinds = ds.segments.map((seg) => seg.kind);
    expect(kinds).toContain('walk');
    const hasWorkPause = ds.segments.some((seg) => {
      const b = s.world.buildings.find((bb) => bb.id === worker.workplaceId);
      if (!b) return false;
      const fp = BUILDING_FOOTPRINT[b.kind];
      const cx = b.tileX + Math.floor(fp.w / 2);
      const cy = b.tileY + fp.h;
      return seg.kind === 'pause' && seg.to.x === cx && seg.to.y === cy;
    });
    expect(hasWorkPause).toBe(true);
  });

  it('segments are chronologically contiguous (no gap, no overlap)', () => {
    const s = initWorld(0, 1);
    const v = s.world.villagers[0]!;
    const ds = villagerScheduleForDay(v, 0, s);
    for (let i = 1; i < ds.segments.length; i++) {
      expect(ds.segments[i]!.startMs).toBe(ds.segments[i - 1]!.endMs);
    }
  });
});
