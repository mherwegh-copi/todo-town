import Phaser from 'phaser';
import { GameState } from '../domain/state';
import { TILE_SIZE } from '../config';

const GRASS_VARIANTS = ['grass', 'grass2', 'grass3'] as const;

function tileTexture(kind: string, x: number, y: number, seed: number): string {
  if (kind !== 'grass') return kind;
  const h = ((x * 73856093) ^ (y * 19349663) ^ (seed * 83492791)) >>> 0;
  return GRASS_VARIANTS[h % GRASS_VARIANTS.length]!;
}

export function renderTiles(scene: Phaser.Scene, state: GameState, container: Phaser.GameObjects.Container): void {
  container.removeAll(true);
  for (const t of state.world.tiles) {
    const tex = tileTexture(t.kind, t.x, t.y, state.seed);
    const img = scene.add.image(t.x * TILE_SIZE, t.y * TILE_SIZE, tex).setOrigin(0, 0);
    container.add(img);
  }
}
