import Phaser from 'phaser';
import { TT_SHEET, TT_COLS } from '../rendering/frames';

const CELL = 24;
const PAD = 4;
const COLS = TT_COLS;
const ROWS = 11;

export class TilePicker {
  private container: Phaser.GameObjects.Container;

  constructor(private scene: Phaser.Scene) {
    this.container = scene.add.container(0, 0).setScrollFactor(0).setDepth(2000).setVisible(false);
    const totalW = COLS * (CELL + PAD) + PAD;
    const totalH = ROWS * (CELL + PAD) + PAD + 20;
    const x = scene.scale.width - totalW - 8;
    const y = 8;
    const bg = scene.add.rectangle(x, y, totalW, totalH, 0x000000, 0.8).setOrigin(0, 0);
    this.container.add(bg);
    const title = scene.add.text(x + PAD, y + 2, 'tile picker (clic → console)', {
      fontFamily: 'monospace', fontSize: '10px', color: '#ffffff',
    });
    this.container.add(title);
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const frame = r * COLS + c;
        const cx = x + PAD + c * (CELL + PAD);
        const cy = y + 20 + r * (CELL + PAD);
        const img = scene.add.image(cx, cy, TT_SHEET, frame)
          .setOrigin(0, 0)
          .setDisplaySize(CELL, CELL)
          .setInteractive({ useHandCursor: true })
          .on('pointerdown', (_p: Phaser.Input.Pointer, _lx: number, _ly: number, ev: Phaser.Types.Input.EventData) => {
            ev.stopPropagation();
            console.log(`frame ${frame} (row ${r} col ${c})`);
          });
        const label = scene.add.text(cx + 1, cy + CELL - 9, String(frame), {
          fontFamily: 'monospace', fontSize: '8px', color: '#ffff80', backgroundColor: '#000000cc',
        });
        this.container.add([img, label]);
      }
    }
  }

  setVisible(on: boolean): void { this.container.setVisible(on); }
}
