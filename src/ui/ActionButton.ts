import Phaser from 'phaser';

export class ActionButton {
  private text: Phaser.GameObjects.Text;
  private blinkTween?: Phaser.Tweens.Tween;

  constructor(scene: Phaser.Scene, onClick: () => void) {
    this.text = scene.add
      .text(scene.scale.width - 16, 16, '✦ Action du matin', {
        fontFamily: 'sans-serif',
        fontSize: '14px',
        color: '#fff8c0',
        backgroundColor: '#552200dd',
        padding: { x: 10, y: 6 },
      })
      .setOrigin(1, 0)
      .setScrollFactor(0)
      .setInteractive()
      .on('pointerdown', onClick);

    this.blinkTween = scene.tweens.add({
      targets: this.text,
      alpha: 0.4,
      yoyo: true,
      repeat: -1,
      duration: 1200,
    });
    this.setAvailable(false);
  }

  setAvailable(available: boolean): void {
    this.text.setVisible(available);
    if (this.blinkTween) {
      if (available) this.blinkTween.resume();
      else this.blinkTween.pause();
    }
  }
}
