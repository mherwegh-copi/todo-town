import Phaser from 'phaser';

export class UIScene extends Phaser.Scene {
  constructor() {
    super('UIScene');
  }

  create(): void {
    this.add.text(20, 50, 'UIScene placeholder', { color: '#fff' });
  }
}
