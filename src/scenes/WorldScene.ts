import Phaser from 'phaser';

export class WorldScene extends Phaser.Scene {
  constructor() {
    super('WorldScene');
  }

  create(): void {
    this.add.text(20, 20, 'WorldScene placeholder', { color: '#fff' });
  }
}
