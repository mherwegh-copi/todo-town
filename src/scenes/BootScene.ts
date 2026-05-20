import Phaser from 'phaser';
import { TT_SHEET, TT_FRAME_SIZE, BLOCKY_KEYS, blockyAssetPath } from '../rendering/frames';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  preload(): void {
    this.load.spritesheet(TT_SHEET, '/assets/tiny-town/tilemap_packed.png', {
      frameWidth: TT_FRAME_SIZE,
      frameHeight: TT_FRAME_SIZE,
    });
    for (const key of BLOCKY_KEYS) {
      this.load.image(key, blockyAssetPath(key));
    }
  }

  create(): void {
    this.scene.start('WorldScene');
    this.scene.launch('UIScene');
  }
}
