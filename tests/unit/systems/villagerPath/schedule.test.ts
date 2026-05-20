import { describe, it, expect } from 'vitest';
import { villagerScheduleForDay } from '../../../../src/systems/villagerPath/schedule';
import { initWorld } from '../../../../src/systems/init';
import { BUILDING_FOOTPRINT } from '../../../../src/domain/building';
import { nextId } from '../../../../src/domain/ids';
import { defaultSchedule } from '../../../../src/systems/villagerAI';
import { placeBuilding, findFreeSpot } from '../../../../src/systems/worldOps';

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

describe('villagerPath/schedule (idle visits)', () => {
  it('inserts walk+pause pairs to other buildings (when available)', () => {
    let s = initWorld(0, 5);
    // Add 2 more buildings to ensure candidates exist
    const th = s.world.buildings[0];
    if (th) {
      const spot1 = findFreeSpot(s, 'house', th.tileX, th.tileY);
      if (spot1) s = placeBuilding(s, 'house', spot1.x, spot1.y, 0);
      const spot2 = findFreeSpot(s, 'house', th.tileX, th.tileY);
      if (spot2) s = placeBuilding(s, 'house', spot2.x, spot2.y, 0);
    }
    if (s.world.buildings.length < 3) return;
    const v = s.world.villagers[0]!;
    const ds = villagerScheduleForDay(v, 0, s);
    const walks = ds.segments.filter((seg) => seg.kind === 'walk');
    expect(walks.length).toBeGreaterThan(0);
  });

  it('different days yield different schedules (with enough destinations)', () => {
    let s = initWorld(0, 1);
    const th = s.world.buildings[0];
    if (th) {
      // Add 4 buildings to increase chances of variation
      for (let i = 0; i < 4; i++) {
        const spot = findFreeSpot(s, 'house', th.tileX, th.tileY);
        if (spot) s = placeBuilding(s, 'house', spot.x, spot.y, 0);
      }
    }
    if (s.world.buildings.length < 5) return;
    const v = s.world.villagers[0]!;
    // Generate multiple days to find at least one different
    const schedules = [0, 1, 2, 3, 4].map((day) => {
      const ds = villagerScheduleForDay(v, day, s);
      return ds.segments.map((seg) => `${seg.kind}@${seg.to.x},${seg.to.y}`).join('|');
    });
    // With enough buildings and days, at least one should be different from day 0
    const allSame = schedules.slice(1).every((sig) => sig === schedules[0]);
    expect(allSame).toBe(false);
  });

  it('visited destinations are unique within a day', () => {
    let s = initWorld(0, 1);
    const th = s.world.buildings[0];
    if (th) {
      const spot1 = findFreeSpot(s, 'house', th.tileX, th.tileY);
      if (spot1) s = placeBuilding(s, 'house', spot1.x, spot1.y, 0);
      const spot2 = findFreeSpot(s, 'house', th.tileX, th.tileY);
      if (spot2) s = placeBuilding(s, 'house', spot2.x, spot2.y, 0);
    }
    const v = s.world.villagers[0]!;
    const ds = villagerScheduleForDay(v, 0, s);
    const pauseTargets = ds.segments
      .filter((seg) => seg.kind === 'pause')
      .map((seg) => `${seg.to.x},${seg.to.y}`);
    const homeKey = (() => {
      const b = s.world.buildings.find((bb) => bb.id === v.homeId)!;
      const fp = BUILDING_FOOTPRINT[b.kind];
      return `${b.tileX + Math.floor(fp.w / 2)},${b.tileY + fp.h}`;
    })();
    const nonHome = pauseTargets.filter((k) => k !== homeKey);
    expect(new Set(nonHome).size).toBe(nonHome.length);
  });
});
