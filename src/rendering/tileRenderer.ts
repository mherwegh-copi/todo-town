import Phaser from 'phaser';
import { GameState } from '../domain/state';
import { TILE_SIZE } from '../config';
import { TT_SHEET, tileFrame } from './frames';

export function renderTiles(scene: Phaser.Scene, state: GameState, container: Phaser.GameObjects.Container): void {
  container.removeAll(true);
  for (const t of state.world.tiles) {
    const frame = tileFrame(t.kind, t.x, t.y, state.seed);
    const img = scene.add.image(t.x * TILE_SIZE, t.y * TILE_SIZE, TT_SHEET, frame).setOrigin(0, 0);
    container.add(img);
  }
}
