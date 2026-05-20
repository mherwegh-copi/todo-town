import { GameState } from '../../domain/state';
import { Villager } from '../../domain/villager';
import { TILE_SIZE } from '../../config';
import { dayIndex } from '../clock';
import { Position, Segment } from './types';
import { villagerScheduleForDay } from './schedule';

export function msSinceMidnight(t: number): number {
  const d = new Date(t);
  return ((d.getHours() * 60 + d.getMinutes()) * 60 + d.getSeconds()) * 1000 + d.getMilliseconds();
}

function tileToPx(t: { x: number; y: number }): { x: number; y: number } {
  return { x: (t.x + 0.5) * TILE_SIZE, y: (t.y + 0.5) * TILE_SIZE };
}

function interpolateWalk(seg: Segment, msOfDay: number): { x: number; y: number } {
  const span = seg.endMs - seg.startMs;
  const u = span <= 0 ? 0 : Math.max(0, Math.min(0.999999, (msOfDay - seg.startMs) / span));
  if (seg.path.length === 1) return tileToPx(seg.path[0]!);
  const idx = u * (seg.path.length - 1);
  const i0 = Math.floor(idx);
  const i1 = Math.min(seg.path.length - 1, i0 + 1);
  const t = idx - i0;
  const a = seg.path[i0]!;
  const b = seg.path[i1]!;
  return tileToPx({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
}

export function villagerPositionAt(v: Villager, now: number, state: GameState): Position | null {
  const day = dayIndex(state.createdAt, now);
  const sched = villagerScheduleForDay(v, day, state);
  if (sched.segments.length === 0) return null;
  const mod = msSinceMidnight(now);
  let active: Segment | null = null;
  for (const seg of sched.segments) {
    if (mod >= seg.startMs && mod < seg.endMs) {
      active = seg;
      break;
    }
  }
  if (!active) return null;
  if (active.kind === 'pause') {
    const p = tileToPx(active.from);
    return { x: p.x, y: p.y, bobbing: true };
  }
  const p = interpolateWalk(active, mod);
  return { x: p.x, y: p.y, bobbing: false };
}
