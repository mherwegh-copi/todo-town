import Phaser from 'phaser';
import { GameState } from '../domain/state';
import { TILE_SIZE } from '../config';
import { BUILDING_FOOTPRINT } from '../domain/building';
import { TT_SHEET, buildingFrame, buildingLayout, CompositeLayout } from './frames';

function renderComposite(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  layout: CompositeLayout,
  tileX: number,
  tileY: number,
  fpW: number,
  fpH: number,
  buildingId: string,
): void {
  const rows = layout.length;
  const cols = layout[0]?.length ?? 0;
  if (rows === 0 || cols === 0) return;
  const cellW = (fpW * TILE_SIZE) / cols;
  const cellH = (fpH * TILE_SIZE) / rows;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const frame = layout[r]![c]!;
      const img = scene.add
        .image(tileX * TILE_SIZE + c * cellW, tileY * TILE_SIZE + r * cellH, TT_SHEET, frame)
        .setOrigin(0, 0)
        .setDisplaySize(cellW, cellH);
      // Only top-left tile carries interactive id (simpler hover); also add invisible hitbox below.
      container.add(img);
    }
  }
  const hit = scene.add
    .rectangle(tileX * TILE_SIZE, tileY * TILE_SIZE, fpW * TILE_SIZE, fpH * TILE_SIZE, 0xffffff, 0)
    .setOrigin(0, 0)
    .setInteractive();
  hit.setData('buildingId', buildingId);
  container.add(hit);
}

export function renderBuildings(
  scene: Phaser.Scene,
  state: GameState,
  container: Phaser.GameObjects.Container,
): void {
  container.removeAll(true);
  for (const b of state.world.buildings) {
    const fp = BUILDING_FOOTPRINT[b.kind];
    const layout = buildingLayout(b.kind);
    if (layout) {
      renderComposite(scene, container, layout, b.tileX, b.tileY, fp.w, fp.h, b.id);
      continue;
    }
    const img = scene.add
      .image(b.tileX * TILE_SIZE, b.tileY * TILE_SIZE, TT_SHEET, buildingFrame(b.kind))
      .setOrigin(0, 0)
      .setDisplaySize(fp.w * TILE_SIZE, fp.h * TILE_SIZE)
      .setInteractive();
    img.setData('buildingId', b.id);
    container.add(img);
  }
}
