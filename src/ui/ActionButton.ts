import Phaser from 'phaser';

const W = 220;
const H = 44;
const MARGIN = 12;
const FONT = 'system-ui, -apple-system, sans-serif';

export class ActionButton {
  private container: Phaser.GameObjects.Container;
  private bg: Phaser.GameObjects.Graphics;
  private dot: Phaser.GameObjects.Graphics;
  private label: Phaser.GameObjects.Text;
  private sub: Phaser.GameObjects.Text;
  private pulse?: Phaser.Tweens.Tween;
  private dotPulse?: Phaser.Tweens.Tween;
  private hit: Phaser.GameObjects.Rectangle;

  constructor(scene: Phaser.Scene, onClick: () => void) {
    const x = scene.scale.width - W - MARGIN;
    this.container = scene.add.container(x, MARGIN).setScrollFactor(0).setDepth(1000);

    this.bg = scene.add.graphics();
    this.container.add(this.bg);

    this.dot = scene.add.graphics();
    this.container.add(this.dot);

    this.label = scene.add.text(34, 8, 'Action du jour', {
      fontFamily: FONT, fontSize: '14px', fontStyle: 'bold', color: '#fff8e0',
    });
    this.container.add(this.label);

    this.sub = scene.add.text(34, 25, 'cliquer pour piocher', {
      fontFamily: FONT, fontSize: '11px', color: '#e5c98a',
    });
    this.container.add(this.sub);

    this.hit = scene.add.rectangle(0, 0, W, H, 0x000000, 0).setOrigin(0, 0).setInteractive({ useHandCursor: true });
    this.hit.on('pointerover', () => this.drawBg(true));
    this.hit.on('pointerout', () => this.drawBg(false));
    this.hit.on('pointerdown', onClick);
    this.container.add(this.hit);

    this.drawBg(false);
    this.drawDot();

    this.pulse = scene.tweens.add({
      targets: this.container,
      alpha: 0.75,
      yoyo: true,
      repeat: -1,
      duration: 1400,
      ease: 'Sine.easeInOut',
    });
    this.dotPulse = scene.tweens.add({
      targets: this.dot,
      scale: 1.4,
      yoyo: true,
      repeat: -1,
      duration: 900,
      ease: 'Sine.easeInOut',
    });

    scene.scale.on('resize', () => {
      this.container.setPosition(scene.scale.width - W - MARGIN, MARGIN);
    });

    this.setAvailable(false);
  }

  private drawBg(hover: boolean): void {
    this.bg.clear();
    const fill = hover ? 0x7a3a10 : 0x5e2a08;
    const stroke = hover ? 0xffb060 : 0xd68a3a;
    this.bg.fillStyle(fill, 0.95);
    this.bg.fillRoundedRect(0, 0, W, H, 10);
    this.bg.lineStyle(1.5, stroke, 1);
    this.bg.strokeRoundedRect(0, 0, W, H, 10);
  }

  private drawDot(): void {
    this.dot.clear();
    this.dot.fillStyle(0xffb84d, 0.25);
    this.dot.fillCircle(18, 22, 9);
    this.dot.fillStyle(0xffb84d, 1);
    this.dot.fillCircle(18, 22, 5);
  }

  setAvailable(available: boolean): void {
    this.container.setVisible(available);
    if (this.pulse) {
      if (available) this.pulse.resume();
      else this.pulse.pause();
    }
    if (this.dotPulse) {
      if (available) this.dotPulse.resume();
      else this.dotPulse.pause();
    }
  }
}
