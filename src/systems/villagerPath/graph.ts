import { GameState } from '../../domain/state';
import { pathTiles } from '../paths';
import { TileXY } from './types';

export type Graph = {
  readonly tiles: ReadonlySet<string>;
  readonly neighbors: ReadonlyMap<string, readonly string[]>;
};

export function tileKey(t: TileXY): string {
  return `${t.x},${t.y}`;
}

export function parseTileKey(k: string): TileXY {
  const [xs, ys] = k.split(',');
  return { x: Number(xs), y: Number(ys) };
}

const cache: WeakMap<object, Graph> = new WeakMap();

export function buildGraph(state: GameState): Graph {
  const hit = cache.get(state.world.buildings);
  if (hit) return hit;

  const tiles = pathTiles(state);
  const neighbors = new Map<string, string[]>();
  const dirs: ReadonlyArray<[number, number]> = [
    [1, 0], [-1, 0], [0, 1], [0, -1],
  ];
  for (const key of tiles) {
    const { x, y } = parseTileKey(key);
    const ns: string[] = [];
    for (const [dx, dy] of dirs) {
      const nk = `${x + dx},${y + dy}`;
      if (tiles.has(nk)) ns.push(nk);
    }
    neighbors.set(key, ns);
  }
  const g: Graph = { tiles, neighbors };
  cache.set(state.world.buildings, g);
  return g;
}
