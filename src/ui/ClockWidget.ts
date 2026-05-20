import Phaser from 'phaser';
import { seasonForDay } from '../systems/season';
import { dayIndex } from '../systems/clock';

export class ClockWidget {
  private text: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene) {
    this.text = scene.add.text(16, 16, '', {
      fontFamily: 'monospace',
      fontSize: '14px',
      color: '#ffffff',
      backgroundColor: '#00000099',
      padding: { x: 8, y: 4 },
    }).setScrollFactor(0);
  }

  update(createdAt: number, now: number): void {
    const d = new Date(now);
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    const day = dayIndex(createdAt, now);
    const season = seasonForDay(day);
    this.text.setText(`${hh}:${mm}  •  jour ${day}  •  ${season}`);
  }
}
