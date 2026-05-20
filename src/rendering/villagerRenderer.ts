import Phaser from 'phaser';
import { GameState } from '../domain/state';
import { TILE_SIZE } from '../config';
import { villagerActivityAt } from '../systems/villagerAI';
import { BUILDING_FOOTPRINT } from '../domain/building';
import { hourOfDay } from '../systems/clock';

export type VillagerSpritesMap = Map<string, Phaser.GameObjects.Image>;

export function ensureVillagerSprites(
  scene: Phaser.Scene,
  state: GameState,
  container: Phaser.GameObjects.Container,
  sprites: VillagerSpritesMap,
): void {
  const livingIds = new Set(state.world.villagers.map((v) => v.id));
  for (const [id, s] of sprites) {
    if (!livingIds.has(id)) {
      s.destroy();
      sprites.delete(id);
    }
  }
  for (const v of state.world.villagers) {
    if (!sprites.has(v.id)) {
      const img = scene.add.image(0, 0, 'villager').setOrigin(0.5, 1);
      container.add(img);
      sprites.set(v.id, img);
    }
  }
}

export function updateVillagerPositions(
  state: GameState,
  sprites: VillagerSpritesMap,
  now: number,
): void {
  const h = hourOfDay(now);
  for (const v of state.world.villagers) {
    const sprite = sprites.get(v.id);
    if (!sprite) continue;
    const activity = villagerActivityAt(v, h);
    const targetId = activity.buildingId ?? v.homeId;
    const target = state.world.buildings.find((b) => b.id === targetId);
    if (!target) {
      sprite.setVisible(false);
      continue;
    }
    const fp = BUILDING_FOOTPRINT[target.kind];
    const cx = (target.tileX + fp.w / 2) * TILE_SIZE;
    const cy = (target.tileY + fp.h / 2) * TILE_SIZE;
    sprite.setVisible(activity.activity !== 'sleep');
    sprite.setPosition(cx, cy);
  }
}
