import Phaser from 'phaser';

export class DebugButton {
  private text: Phaser.GameObjects.Text;
  private active = false;

  constructor(scene: Phaser.Scene, private onToggle: (on: boolean) => void) {
    this.text = scene.add
      .text(16, scene.scale.height - 16, '🛠 debug', {
        fontFamily: 'sans-serif',
        fontSize: '12px',
        color: '#ffffff',
        backgroundColor: '#000000aa',
        padding: { x: 8, y: 4 },
      })
      .setOrigin(0, 1)
      .setScrollFactor(0)
      .setInteractive()
      .on('pointerdown', () => this.toggle());
  }

  private toggle(): void {
    this.active = !this.active;
    this.text.setBackgroundColor(this.active ? '#226622cc' : '#000000aa');
    this.onToggle(this.active);
  }
}
