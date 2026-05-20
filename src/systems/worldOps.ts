import { GameState } from '../domain/state';
import { Building, BuildingKind, BUILDING_FOOTPRINT } from '../domain/building';
import { nextId } from '../domain/ids';

export function isFootprintFree(
  state: GameState,
  kind: BuildingKind,
  x: number,
  y: number,
): boolean {
  const { w, h } = BUILDING_FOOTPRINT[kind];
  if (x < 0 || y < 0 || x + w > state.world.width || y + h > state.world.height) return false;
  for (const b of state.world.buildings) {
    const bf = BUILDING_FOOTPRINT[b.kind];
    const overlap =
      x < b.tileX + bf.w && x + w > b.tileX && y < b.tileY + bf.h && y + h > b.tileY;
    if (overlap) return false;
  }
  return true;
}

export function placeBuilding(
  state: GameState,
  kind: BuildingKind,
  x: number,
  y: number,
  now: number,
): GameState {
  if (!isFootprintFree(state, kind, x, y)) {
    throw new Error(`placeBuilding: footprint occupied at ${x},${y}`);
  }
  const b: Building = { id: nextId('b'), kind, tileX: x, tileY: y, builtAt: now };
  return {
    ...state,
    world: { ...state.world, buildings: [...state.world.buildings, b] },
  };
}

export function findFreeSpot(
  state: GameState,
  kind: BuildingKind,
  originX: number,
  originY: number,
): { x: number; y: number } | null {
  const maxRadius = Math.max(state.world.width, state.world.height);
  for (let r = 1; r < maxRadius; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
        const x = originX + dx;
        const y = originY + dy;
        if (isFootprintFree(state, kind, x, y)) return { x, y };
      }
    }
  }
  return null;
}
