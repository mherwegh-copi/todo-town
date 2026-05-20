import Phaser from 'phaser';

export class Tooltip {
  private text: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene) {
    this.text = scene.add.text(0, 0, '', {
      fontFamily: 'sans-serif',
      fontSize: '12px',
      color: '#fff',
      backgroundColor: '#000000cc',
      padding: { x: 6, y: 3 },
    }).setScrollFactor(0).setDepth(1000).setVisible(false);
    scene.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      this.text.setPosition(p.x + 12, p.y + 12);
    });
  }

  show(content: string): void { this.text.setText(content).setVisible(true); }
  hide(): void { this.text.setVisible(false); }
}
