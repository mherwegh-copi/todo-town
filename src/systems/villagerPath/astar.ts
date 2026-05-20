import { Graph, parseTileKey, tileKey } from './graph';
import { TileXY } from './types';

const MAX_ITER = 200;

function manhattan(a: TileXY, b: TileXY): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

export function findPath(graph: Graph, from: TileXY, to: TileXY): TileXY[] | null {
  if (graph.tiles.size === 0) return null;
  const fromKey = tileKey(from);
  const toKey = tileKey(to);
  if (!graph.tiles.has(fromKey) || !graph.tiles.has(toKey)) return null;
  if (fromKey === toKey) return [from];

  const open = new Set<string>([fromKey]);
  const cameFrom = new Map<string, string>();
  const gScore = new Map<string, number>([[fromKey, 0]]);
  const fScore = new Map<string, number>([[fromKey, manhattan(from, to)]]);

  let iter = 0;
  while (open.size > 0 && iter < MAX_ITER) {
    iter++;
    let current: string | null = null;
    let currentF = Infinity;
    for (const k of open) {
      const f = fScore.get(k) ?? Infinity;
      if (f < currentF) {
        currentF = f;
        current = k;
      }
    }
    if (current === null) return null;
    if (current === toKey) {
      const out: TileXY[] = [parseTileKey(current)];
      let cur: string = current;
      while (cameFrom.has(cur)) {
        cur = cameFrom.get(cur)!;
        out.push(parseTileKey(cur));
      }
      return out.reverse();
    }
    open.delete(current);
    const ns = graph.neighbors.get(current) ?? [];
    const curG = gScore.get(current) ?? Infinity;
    for (const n of ns) {
      const tentative = curG + 1;
      if (tentative < (gScore.get(n) ?? Infinity)) {
        cameFrom.set(n, current);
        gScore.set(n, tentative);
        fScore.set(n, tentative + manhattan(parseTileKey(n), to));
        open.add(n);
      }
    }
  }
  return null;
}
