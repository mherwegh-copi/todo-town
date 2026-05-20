import Phaser from 'phaser';
import { TT_SHEET, TT_FRAME_SIZE } from '../rendering/frames';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  preload(): void {
    this.load.spritesheet(TT_SHEET, '/assets/tiny-town/tilemap_packed.png', {
      frameWidth: TT_FRAME_SIZE,
      frameHeight: TT_FRAME_SIZE,
    });
  }

  create(): void {
    this.scene.start('WorldScene');
    this.scene.launch('UIScene');
  }
}
