import { GameState } from '../../domain/state';
import { Villager } from '../../domain/villager';
import { BUILDING_FOOTPRINT } from '../../domain/building';
import { DaySchedule, Segment, TileXY } from './types';
import { mixSeeds, hashStr } from './hash';

const HOUR_MS = 3_600_000;

function frontageCenter(state: GameState, buildingId: string): TileXY | null {
  const b = state.world.buildings.find((bb) => bb.id === buildingId);
  if (!b) return null;
  const fp = BUILDING_FOOTPRINT[b.kind];
  return { x: b.tileX + Math.floor(fp.w / 2), y: b.tileY + fp.h };
}

function wakeWindow(v: Villager): { wakeHour: number; sleepHour: number } {
  let wake = 24;
  let sleep = 0;
  for (const s of v.schedule) {
    if (s.activity !== 'sleep') {
      wake = Math.min(wake, s.fromHour);
      sleep = Math.max(sleep, s.toHour);
    }
  }
  if (wake >= sleep) return { wakeHour: 6, sleepHour: 22 };
  return { wakeHour: wake, sleepHour: sleep };
}

const cache: WeakMap<object, Map<string, DaySchedule>> = new WeakMap();

export function villagerScheduleForDay(v: Villager, day: number, state: GameState): DaySchedule {
  let perState = cache.get(state.world.buildings);
  if (!perState) {
    perState = new Map();
    cache.set(state.world.buildings, perState);
  }
  const key = `${v.id}@${day}`;
  const hit = perState.get(key);
  if (hit) return hit;

  const seed = mixSeeds(hashStr(v.id), day, state.seed);
  void seed;

  const home = frontageCenter(state, v.homeId);
  if (!home) {
    const ds: DaySchedule = { day, segments: [] };
    perState.set(key, ds);
    return ds;
  }

  const { wakeHour, sleepHour } = wakeWindow(v);
  const segments: Segment[] = [
    {
      kind: 'pause',
      from: home,
      to: home,
      path: [home],
      startMs: wakeHour * HOUR_MS,
      endMs: sleepHour * HOUR_MS,
    },
  ];
  const ds: DaySchedule = { day, segments };
  perState.set(key, ds);
  return ds;
}
