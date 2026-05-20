import Phaser from 'phaser';
import { GameState } from '../domain/state';
import { TILE_SIZE } from '../config';
import { villagerActivityAt } from '../systems/villagerAI';
import { BUILDING_FOOTPRINT } from '../domain/building';
import { hourOfDay } from '../systems/clock';
import { TT_SHEET, villagerFrame } from './frames';

export type VillagerSpritesMap = Map<string, Phaser.GameObjects.Image>;

const WANDER_RADIUS_PX = 4 * TILE_SIZE;
const WANDER_PERIOD_MS = 16000;
const WANDER_RETRIES = 12;

type Rect = { x: number; y: number; w: number; h: number };

function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h;
}

function pointInRects(x: number, y: number, rects: Rect[]): boolean {
  for (const r of rects) {
    if (x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h) return true;
  }
  return false;
}

function wanderTarget(
  seed: number,
  slot: number,
  ax: number,
  ay: number,
  rects: Rect[],
): { dx: number; dy: number } {
  for (let i = 0; i < WANDER_RETRIES; i++) {
    const h1 = Math.imul(seed ^ (slot * 31 + i * 7), 73856093) >>> 0;
    const h2 = Math.imul(seed ^ (slot * 17 + i * 13 + 1013), 19349663) >>> 0;
    const a = ((h1 % 10000) / 10000) * Math.PI * 2;
    const r = ((h2 % 10000) / 10000) * WANDER_RADIUS_PX;
    const dx = Math.cos(a) * r;
    const dy = Math.sin(a) * r;
    if (!pointInRects(ax + dx, ay + dy, rects)) return { dx, dy };
  }
  return { dx: 0, dy: 0 };
}

function wanderOffset(
  id: string,
  now: number,
  ax: number,
  ay: number,
  rects: Rect[],
): { dx: number; dy: number } {
  const seed = hashStr(id);
  const t = now / WANDER_PERIOD_MS;
  const slot = Math.floor(t);
  const u = t - slot;
  const a = wanderTarget(seed, slot, ax, ay, rects);
  const b = wanderTarget(seed, slot + 1, ax, ay, rects);
  const e = (1 - Math.cos(u * Math.PI)) / 2;
  const dx = a.dx + (b.dx - a.dx) * e;
  const dy = a.dy + (b.dy - a.dy) * e;
  if (pointInRects(ax + dx, ay + dy, rects)) return { dx: a.dx, dy: a.dy };
  return { dx, dy };
}

function buildingRectsPx(state: GameState): Rect[] {
  return state.world.buildings.map((b) => {
    const fp = BUILDING_FOOTPRINT[b.kind];
    return {
      x: b.tileX * TILE_SIZE,
      y: b.tileY * TILE_SIZE,
      w: fp.w * TILE_SIZE,
      h: fp.h * TILE_SIZE,
    };
  });
}

export function ensureVillagerSprites(
  scene: Phaser.Scene,
  state: GameState,
  container: Phaser.GameObjects.Container,
  sprites: VillagerSpritesMap,
): void {
  const livingIds = new Set(state.world.villagers.map((v) => v.id));
  for (const [id, s] of sprites) {
    if (!livingIds.has(id)) {
      s.destroy();
      sprites.delete(id);
    }
  }
  for (const v of state.world.villagers) {
    if (!sprites.has(v.id)) {
      const img = scene.add.image(0, 0, TT_SHEET, villagerFrame(v.spriteVariant)).setOrigin(0.5, 1);
      container.add(img);
      sprites.set(v.id, img);
    }
  }
}

export function updateVillagerPositions(
  state: GameState,
  sprites: VillagerSpritesMap,
  now: number,
): void {
  const h = hourOfDay(now);
  const rects = buildingRectsPx(state);
  for (const v of state.world.villagers) {
    const sprite = sprites.get(v.id);
    if (!sprite) continue;
    const activity = villagerActivityAt(v, h);

    if (activity.activity === 'sleep') {
      sprite.setVisible(false);
      continue;
    }

    if (activity.activity === 'work' && activity.buildingId) {
      const target = state.world.buildings.find((b) => b.id === activity.buildingId);
      if (!target) {
        sprite.setVisible(false);
        continue;
      }
      const fp = BUILDING_FOOTPRINT[target.kind];
      const cx = (target.tileX + fp.w / 2) * TILE_SIZE;
      const cy = (target.tileY + fp.h) * TILE_SIZE;
      sprite.setVisible(true);
      sprite.setPosition(cx, cy);
      continue;
    }

    // idle: wander around home anchor
    const home = state.world.buildings.find((b) => b.id === v.homeId);
    if (!home) {
      sprite.setVisible(false);
      continue;
    }
    const fp = BUILDING_FOOTPRINT[home.kind];
    const ax = (home.tileX + fp.w / 2) * TILE_SIZE;
    const ay = (home.tileY + fp.h) * TILE_SIZE;
    const { dx, dy } = wanderOffset(v.id, now, ax, ay, rects);
    sprite.setVisible(true);
    sprite.setPosition(ax + dx, ay + dy);
  }
}
