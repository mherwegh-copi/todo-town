import { GameState, emptyState } from '../domain/state';
import { placeBuilding } from './worldOps';

export function initWorld(now: number, seed: number): GameState {
  const s0 = emptyState(now, seed);
  const cx = Math.floor(s0.world.width / 2) - 1;
  const cy = Math.floor(s0.world.height / 2) - 1;
  return placeBuilding(s0, 'townHall', cx, cy, now);
}
