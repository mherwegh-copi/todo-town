import Phaser from 'phaser';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  preload(): void {
    this.load.on('progress', (v: number) => {
      void v;
    });
    this.createPlaceholderTextures();
  }

  create(): void {
    this.scene.start('WorldScene');
    this.scene.launch('UIScene');
  }

  private createPlaceholderTextures(): void {
    const palette: Record<string, number> = {
      grass: 0x6abe30,
      dirt: 0x9c6b3c,
      water: 0x4a90c2,
      path: 0xd0b270,
      house: 0xc97f4a,
      townHall: 0xb04a3c,
      farm: 0xe0c450,
      forge: 0x707070,
      mill: 0xa0a0a0,
      well: 0x6080a0,
      square: 0xd0d0c0,
      villager: 0xf2d0a0,
    };
    const g = this.add.graphics();
    for (const [key, color] of Object.entries(palette)) {
      g.clear();
      g.fillStyle(color);
      g.fillRect(0, 0, 16, 16);
      g.lineStyle(1, 0x000000, 0.3);
      g.strokeRect(0, 0, 16, 16);
      g.generateTexture(key, 16, 16);
    }
    g.destroy();
  }
}
