import Phaser from 'phaser';
import { GameState } from '../domain/state';
import { TILE_SIZE } from '../config';
import { BUILDING_FOOTPRINT } from '../domain/building';

export function renderBuildings(
  scene: Phaser.Scene,
  state: GameState,
  container: Phaser.GameObjects.Container,
): void {
  container.removeAll(true);
  for (const b of state.world.buildings) {
    const fp = BUILDING_FOOTPRINT[b.kind];
    const img = scene.add
      .image(b.tileX * TILE_SIZE, b.tileY * TILE_SIZE, b.kind)
      .setOrigin(0, 0)
      .setDisplaySize(fp.w * TILE_SIZE, fp.h * TILE_SIZE);
    img.setData('buildingId', b.id);
    container.add(img);
  }
}
