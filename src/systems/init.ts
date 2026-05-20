import { GameState, emptyState } from '../domain/state';
import { placeBuilding } from './worldOps';
import { Villager, VILLAGER_NAMES } from '../domain/villager';
import { defaultSchedule } from './villagerAI';
import { nextId } from '../domain/ids';
import { createRng, rngInt, rngPick } from './rng';

const INITIAL_VILLAGERS = 2;

export function initWorld(now: number, seed: number): GameState {
  const s0 = emptyState(now, seed);
  const cx = Math.floor(s0.world.width / 2) - 1;
  const cy = Math.floor(s0.world.height / 2) - 1;
  const s1 = placeBuilding(s0, 'townHall', cx, cy, now);
  const townHall = s1.world.buildings.find((b) => b.kind === 'townHall');
  if (!townHall) return s1;
  const rng = createRng(seed);
  const villagers: Villager[] = [];
  for (let i = 0; i < INITIAL_VILLAGERS; i++) {
    villagers.push({
      id: nextId('v'),
      name: rngPick(rng, VILLAGER_NAMES),
      homeId: townHall.id,
      spriteVariant: rngInt(rng, 0, 4),
      schedule: defaultSchedule(),
    });
  }
  return { ...s1, world: { ...s1.world, villagers: [...s1.world.villagers, ...villagers] } };
}
