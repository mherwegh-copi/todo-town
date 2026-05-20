import { GameState, emptyState } from '../domain/state';
import { placeBuilding } from './worldOps';
import { resetIdsForTests } from '../domain/ids';

export function initWorld(now: number, seed: number): GameState {
  resetIdsForTests();
  const s0 = emptyState(now, seed);
  const cx = Math.floor(s0.world.width / 2) - 1;
  const cy = Math.floor(s0.world.height / 2) - 1;
  return placeBuilding(s0, 'townHall', cx, cy, now);
}
