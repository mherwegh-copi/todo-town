import { Tile } from './tile';
import { Building } from './building';
import { Villager } from './villager';
import { Crop } from './crop';
import { SAVE_VERSION, MAP_WIDTH, MAP_HEIGHT } from '../config';

export type GameState = {
  readonly version: number;
  readonly createdAt: number;
  readonly lastSeenAt: number;
  readonly lastActionDate: string;
  readonly seed: number;
  readonly world: {
    readonly width: number;
    readonly height: number;
    readonly tiles: readonly Tile[];
    readonly buildings: readonly Building[];
    readonly crops: readonly Crop[];
    readonly villagers: readonly Villager[];
  };
  readonly progression: {
    readonly day: number;
    readonly townHallLevel: number;
    readonly unlockedCards: readonly string[];
  };
  readonly construction: {
    readonly points: number;
    readonly openings: number;
    readonly lastMorningDate: string;
  };
  readonly motivation: number;
  readonly motivationLastDecayAt: number;
};

export function emptyState(now: number, seed: number): GameState {
  const tiles: Tile[] = [];
  for (let y = 0; y < MAP_HEIGHT; y++) {
    for (let x = 0; x < MAP_WIDTH; x++) {
      tiles.push({ x, y, kind: 'grass' });
    }
  }
  return {
    version: SAVE_VERSION,
    createdAt: now,
    lastSeenAt: now,
    lastActionDate: '',
    seed,
    world: { width: MAP_WIDTH, height: MAP_HEIGHT, tiles, buildings: [], crops: [], villagers: [] },
    progression: { day: 0, townHallLevel: 1, unlockedCards: [] },
    construction: { points: 0, openings: 0, lastMorningDate: '' },
    motivation: 0,
    motivationLastDecayAt: now,
  };
}
