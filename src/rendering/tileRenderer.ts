import Phaser from 'phaser';
import { GameState } from '../domain/state';
import { TILE_SIZE } from '../config';

export function renderTiles(scene: Phaser.Scene, state: GameState, container: Phaser.GameObjects.Container): void {
  container.removeAll(true);
  for (const t of state.world.tiles) {
    const img = scene.add.image(t.x * TILE_SIZE, t.y * TILE_SIZE, t.kind).setOrigin(0, 0);
    container.add(img);
  }
}
