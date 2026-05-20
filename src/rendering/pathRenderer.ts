import Phaser from 'phaser';
import { GameState } from '../domain/state';
import { TILE_SIZE } from '../config';
import { TT_SHEET, PATH } from './frames';
import { pathTiles } from '../systems/paths';

function frameFor(set: Set<string>, x: number, y: number): number {
  const has = (dx: number, dy: number) => set.has(`${x + dx},${y + dy}`);
  const n = has(0, -1);
  const s = has(0, 1);
  const w = has(-1, 0);
  const e = has(1, 0);
  // Edges: when a side has grass (no path neighbour), use the grass-edged frame.
  if (!n && !w) return PATH.nw;
  if (!n && !e) return PATH.ne;
  if (!s && !w) return PATH.sw;
  if (!s && !e) return PATH.se;
  if (!n) return PATH.n;
  if (!s) return PATH.s;
  if (!w) return PATH.w;
  if (!e) return PATH.e;
  return PATH.c;
}

export function renderPaths(scene: Phaser.Scene, state: GameState, container: Phaser.GameObjects.Container): void {
  container.removeAll(true);
  const set = pathTiles(state);
  for (const key of set) {
    const [xs, ys] = key.split(',');
    const x = Number(xs);
    const y = Number(ys);
    const frame = frameFor(set, x, y);
    const img = scene.add.image(x * TILE_SIZE, y * TILE_SIZE, TT_SHEET, frame).setOrigin(0, 0);
    container.add(img);
  }
}
