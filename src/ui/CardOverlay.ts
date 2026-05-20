import Phaser from 'phaser';
import { ActionCard } from '../cards/types';

export type CardOverlayHandlers = {
  onPick: (cardId: string) => void;
  onCancel: () => void;
};

export class CardOverlay {
  private container: Phaser.GameObjects.Container;
  private bg: Phaser.GameObjects.Rectangle;

  constructor(scene: Phaser.Scene, private handlers: CardOverlayHandlers) {
    this.bg = scene.add
      .rectangle(0, 0, scene.scale.width, scene.scale.height, 0x000000, 0.55)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setInteractive()
      .on('pointerdown', () => this.handlers.onCancel());
    this.container = scene.add.container(0, 0).setScrollFactor(0);
    this.container.add(this.bg);
    this.hide();
  }

  show(cards: readonly ActionCard[]): void {
    const scene = this.container.scene;
    const cw = 200;
    const ch = 280;
    const gap = 20;
    const totalW = cards.length * cw + (cards.length - 1) * gap;
    const startX = (scene.scale.width - totalW) / 2;
    const y = (scene.scale.height - ch) / 2;
    for (let i = 0; i < cards.length; i++) {
      const c = cards[i]!;
      const x = startX + i * (cw + gap);
      const card = scene.add.rectangle(x, y, cw, ch, 0xfaf3df).setOrigin(0, 0).setStrokeStyle(2, 0x333);
      card.setInteractive().on('pointerdown', (p: Phaser.Input.Pointer, _lx: number, _ly: number, ev: Phaser.Types.Input.EventData) => {
        ev.stopPropagation();
        this.handlers.onPick(c.id);
      });
      const title = scene.add.text(x + 12, y + 16, c.title, {
        color: '#222', fontFamily: 'sans-serif', fontSize: '16px', fontStyle: 'bold', wordWrap: { width: cw - 24 },
      });
      const desc = scene.add.text(x + 12, y + 70, c.description, {
        color: '#444', fontFamily: 'sans-serif', fontSize: '12px', wordWrap: { width: cw - 24 },
      });
      this.container.add([card, title, desc]);
    }
    this.container.setVisible(true);
  }

  hide(): void {
    const children = this.container.list.slice();
    for (const c of children) {
      if (c !== this.bg) c.destroy();
    }
    this.container.setVisible(false);
  }
}
