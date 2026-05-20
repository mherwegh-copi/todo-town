import { GameState } from '../domain/state';
import { BUILDING_FOOTPRINT, Building } from '../domain/building';

function frontageCenter(b: Building): { x: number; y: number } {
  const fp = BUILDING_FOOTPRINT[b.kind];
  return { x: b.tileX + Math.floor(fp.w / 2), y: b.tileY + fp.h };
}

function frontageRow(b: Building): Array<{ x: number; y: number }> {
  const fp = BUILDING_FOOTPRINT[b.kind];
  const y = b.tileY + fp.h;
  return Array.from({ length: fp.w }, (_, i) => ({ x: b.tileX + i, y }));
}

function isOnBuilding(state: GameState, x: number, y: number): boolean {
  for (const b of state.world.buildings) {
    const fp = BUILDING_FOOTPRINT[b.kind];
    if (x >= b.tileX && x < b.tileX + fp.w && y >= b.tileY && y < b.tileY + fp.h) return true;
  }
  return false;
}

function inBounds(state: GameState, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < state.world.width && y < state.world.height;
}

export function pathTiles(state: GameState): Set<string> {
  const out = new Set<string>();
  const townHall = state.world.buildings.find((b) => b.kind === 'townHall');
  if (!townHall) return out;

  const add = (x: number, y: number) => {
    if (!inBounds(state, x, y)) return;
    if (isOnBuilding(state, x, y)) return;
    out.add(`${x},${y}`);
  };

  for (const b of state.world.buildings) {
    for (const p of frontageRow(b)) add(p.x, p.y);
  }

  const c = frontageCenter(townHall);
  for (const b of state.world.buildings) {
    if (b.kind === 'townHall') continue;
    const t = frontageCenter(b);
    for (let x = Math.min(c.x, t.x); x <= Math.max(c.x, t.x); x++) add(x, c.y);
    for (let y = Math.min(c.y, t.y); y <= Math.max(c.y, t.y); y++) add(t.x, y);
  }
  return out;
}
