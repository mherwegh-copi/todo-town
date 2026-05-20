import Phaser from 'phaser';
import { hourOfDay } from '../systems/clock';

export class DayNightOverlay {
  private rect: Phaser.GameObjects.Rectangle;

  constructor(scene: Phaser.Scene, width: number, height: number) {
    this.rect = scene.add
      .rectangle(0, 0, width, height, 0x0a1030, 0)
      .setOrigin(0, 0)
      .setScrollFactor(0);
  }

  update(now: number): void {
    const h = hourOfDay(now);
    let alpha = 0;
    if (h < 6 || h >= 21) alpha = 0.55;
    else if (h < 8) alpha = 0.55 - ((h - 6) / 2) * 0.4;
    else if (h >= 19) alpha = ((h - 19) / 2) * 0.55;
    else alpha = 0.05;
    this.rect.setAlpha(Phaser.Math.Clamp(alpha, 0, 0.7));
  }
}
