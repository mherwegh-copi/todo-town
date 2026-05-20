import Phaser from 'phaser';
import { GameState } from '../domain/state';
import { blockyKey } from './frames';
import { villagerPositionAt } from '../systems/villagerPath';

const VILLAGER_DISPLAY_PX = 24;

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
      const img = scene.add.image(0, 0, blockyKey(v.spriteVariant)).setOrigin(0.5, 1);
      img.setDisplaySize(VILLAGER_DISPLAY_PX, VILLAGER_DISPLAY_PX);
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
  for (const v of state.world.villagers) {
    const sprite = sprites.get(v.id);
    if (!sprite) continue;
    if (sprite.getData('celebrating') === true) continue;
    const pos = villagerPositionAt(v, now, state);
    if (pos === null) {
      sprite.setVisible(false);
      continue;
    }
    sprite.setVisible(true);
    let y = pos.y;
    if (pos.bobbing) y -= 2 * Math.sin(now / 400);
    sprite.setPosition(pos.x, y);
  }
}
