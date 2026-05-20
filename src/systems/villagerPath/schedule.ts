import { GameState } from '../../domain/state';
import { Villager } from '../../domain/villager';
import { BUILDING_FOOTPRINT } from '../../domain/building';
import { DaySchedule, Segment, TileXY } from './types';
import { mixSeeds, hashStr } from './hash';
import { buildGraph } from './graph';
import { findPath } from './astar';
import { createRng, rngInt } from '../rng';

const HOUR_MS = 3_600_000;
const WALK_MS_PER_TILE = 2000;
const PAUSE_MS = 90_000;

function candidateDestinations(state: GameState, excludeIds: ReadonlySet<string>): TileXY[] {
  const out: TileXY[] = [];
  for (const b of state.world.buildings) {
    if (excludeIds.has(b.id)) continue;
    const fp = BUILDING_FOOTPRINT[b.kind];
    out.push({ x: b.tileX + Math.floor(fp.w / 2), y: b.tileY + fp.h });
  }
  return out;
}

function pickDestinations(pool: TileXY[], rng: () => number, count: number): TileXY[] {
  const copy = [...pool];
  const out: TileXY[] = [];
  while (out.length < count && copy.length > 0) {
    const idx = rngInt(rng, 0, copy.length);
    out.push(copy[idx]!);
    copy.splice(idx, 1);
  }
  return out;
}

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

  const home = frontageCenter(state, v.homeId);
  if (!home) {
    const ds: DaySchedule = { day, segments: [] };
    perState.set(key, ds);
    return ds;
  }

  const { wakeHour, sleepHour } = wakeWindow(v);
  const graph = buildGraph(state);
  const segments: Segment[] = [];
  let cursorMs = wakeHour * HOUR_MS;
  let here: TileXY = home;

  const pushWalk = (to: TileXY): boolean => {
    const path = findPath(graph, here, to);
    if (!path || path.length === 0) return false;
    const durMs = Math.max(1000, path.length * WALK_MS_PER_TILE);
    segments.push({ kind: 'walk', from: here, to, path, startMs: cursorMs, endMs: cursorMs + durMs });
    cursorMs += durMs;
    here = to;
    return true;
  };

  const pushPause = (durMs: number) => {
    segments.push({ kind: 'pause', from: here, to: here, path: [here], startMs: cursorMs, endMs: cursorMs + durMs });
    cursorMs += durMs;
  };

  const exclude = new Set<string>([v.homeId]);
  if (v.workplaceId) exclude.add(v.workplaceId);
  const pool = candidateDestinations(state, exclude);
  const rng = createRng(seed);
  const visitCount = pool.length === 0 ? 0 : 2 + rngInt(rng, 0, 3);

  const insertVisits = (untilMs: number, n: number) => {
    if (n <= 0) return;
    const picks = pickDestinations(pool, rng, n);
    for (const dest of picks) {
      const projectedMs = WALK_MS_PER_TILE * 20 + PAUSE_MS;
      if (cursorMs + projectedMs > untilMs) break;
      if (!pushWalk(dest)) continue;
      pushPause(PAUSE_MS);
      if (!pushWalk(home)) break;
    }
    const idle = untilMs - cursorMs;
    if (idle > 0) pushPause(idle);
  };

  const workHours = v.schedule.filter((e) => e.activity === 'work');
  if (workHours.length > 0 && v.workplaceId) {
    const workStart = Math.max(wakeHour, Math.min(...workHours.map((e) => e.fromHour)));
    const workEnd = Math.min(sleepHour, Math.max(...workHours.map((e) => e.toHour)));
    const workTile = frontageCenter(state, v.workplaceId);
    if (workTile && workEnd > workStart) {
      insertVisits(workStart * HOUR_MS, Math.min(1, visitCount));
      pushWalk(workTile);
      const sitMs = workEnd * HOUR_MS - cursorMs;
      if (sitMs > 0) pushPause(sitMs);
      pushWalk(home);
      insertVisits(sleepHour * HOUR_MS, Math.max(0, visitCount - 1));
    } else {
      insertVisits(sleepHour * HOUR_MS, visitCount);
    }
  } else {
    insertVisits(sleepHour * HOUR_MS, visitCount);
  }

  const tailMs = sleepHour * HOUR_MS - cursorMs;
  if (tailMs > 0) pushPause(tailMs);

  const ds: DaySchedule = { day, segments };
  perState.set(key, ds);
  return ds;
}
