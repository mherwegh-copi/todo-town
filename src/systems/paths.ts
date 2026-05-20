import { GameState } from '../domain/state';
import { BUILDING_FOOTPRINT, Building } from '../domain/building';

function buildingCenter(b: Building): { x: number; y: number } {
  const fp = BUILDING_FOOTPRINT[b.kind];
  return { x: b.tileX + Math.floor(fp.w / 2), y: b.tileY + Math.floor(fp.h / 2) };
}

function isOnBuilding(state: GameState, x: number, y: number): boolean {
  for (const b of state.world.buildings) {
    const fp = BUILDING_FOOTPRINT[b.kind];
    if (x >= b.tileX && x < b.tileX + fp.w && y >= b.tileY && y < b.tileY + fp.h) return true;
  }
  return false;
}

export function pathTiles(state: GameState): Set<string> {
  const out = new Set<string>();
  const townHall = state.world.buildings.find((b) => b.kind === 'townHall');
  if (!townHall) return out;
  const c = buildingCenter(townHall);
  for (const b of state.world.buildings) {
    if (b.kind === 'townHall') continue;
    const t = buildingCenter(b);
    const x0 = Math.min(c.x, t.x);
    const x1 = Math.max(c.x, t.x);
    for (let x = x0; x <= x1; x++) {
      if (!isOnBuilding(state, x, c.y)) out.add(`${x},${c.y}`);
    }
    const y0 = Math.min(c.y, t.y);
    const y1 = Math.max(c.y, t.y);
    for (let y = y0; y <= y1; y++) {
      if (!isOnBuilding(state, t.x, y)) out.add(`${t.x},${y}`);
    }
  }
  return out;
}
