import Phaser from 'phaser';
import { GameState } from '../domain/state';
import { weatherForDay } from '../systems/weather';
import { seasonForDay } from '../systems/season';

const WEATHER_LABEL_FR: Record<string, string> = {
  clear: 'beau',
  rain: 'pluie',
  snow: 'neige',
};

const WEATHER_ICON: Record<string, string> = {
  clear: '☀',
  rain: '☂',
  snow: '❄',
};

const SEASON_LABEL_FR: Record<string, string> = {
  spring: 'printemps',
  summer: 'été',
  autumn: 'automne',
  winter: 'hiver',
};

const BUILDING_LABEL_FR: Record<string, string> = {
  townHall: 'mairie',
  house: 'maisons',
  farm: 'fermes',
  forge: 'forges',
  mill: 'moulins',
  well: 'puits',
  square: 'places',
};

const PAD_X = 14;
const PAD_Y = 10;
const MARGIN = 12;
const ROW_H = 18;
const WIDTH = 240;
const FONT = 'system-ui, -apple-system, sans-serif';

export class StatusBar {
  private container: Phaser.GameObjects.Container;
  private bg: Phaser.GameObjects.Graphics;
  private title: Phaser.GameObjects.Text;
  private rows: Phaser.GameObjects.Text[] = [];
  private motivationLabel: Phaser.GameObjects.Text;
  private motivationBarBg: Phaser.GameObjects.Graphics;
  private motivationBarFill: Phaser.GameObjects.Graphics;
  private motivationValue: Phaser.GameObjects.Text;

  constructor(private scene: Phaser.Scene) {
    this.container = scene.add.container(MARGIN, MARGIN).setScrollFactor(0).setDepth(1000);

    this.bg = scene.add.graphics();
    this.container.add(this.bg);

    this.title = scene.add.text(PAD_X, PAD_Y, 'VILLAGE', {
      fontFamily: FONT, fontSize: '11px', color: '#8a8f99',
    });
    this.title.setLetterSpacing(2);
    this.container.add(this.title);

    for (let i = 0; i < 5; i++) {
      const t = scene.add.text(PAD_X, PAD_Y + 22 + i * ROW_H, '', {
        fontFamily: FONT, fontSize: '13px', color: '#f0f0f0',
      });
      this.rows.push(t);
      this.container.add(t);
    }

    const motivationY = PAD_Y + 22 + 5 * ROW_H + 8;
    this.motivationLabel = scene.add.text(PAD_X, motivationY, 'MOTIVATION', {
      fontFamily: FONT, fontSize: '10px', color: '#8a8f99',
    });
    this.motivationLabel.setLetterSpacing(1);
    this.container.add(this.motivationLabel);

    this.motivationValue = scene.add.text(WIDTH - PAD_X, motivationY, '0', {
      fontFamily: FONT, fontSize: '12px', color: '#f0f0f0',
    }).setOrigin(1, 0);
    this.container.add(this.motivationValue);

    this.motivationBarBg = scene.add.graphics();
    this.motivationBarFill = scene.add.graphics();
    this.container.add(this.motivationBarBg);
    this.container.add(this.motivationBarFill);

  }

  update(state: GameState): void {
    const counts = new Map<string, number>();
    for (const b of state.world.buildings) {
      counts.set(b.kind, (counts.get(b.kind) ?? 0) + 1);
    }
    const buildingParts: string[] = [];
    for (const [kind, n] of counts) {
      buildingParts.push(`${n} ${BUILDING_LABEL_FR[kind] ?? kind}`);
    }
    const weather = weatherForDay(state.seed, state.progression.day);
    const season = seasonForDay(state.progression.day);

    const lines = [
      `👥  ${state.world.villagers.length} habitants`,
      `🌾  ${state.world.crops.length} cultures`,
      `🏛  mairie niv. ${state.progression.townHallLevel}`,
      `🏘  ${buildingParts.join(', ') || '—'}`,
      `${WEATHER_ICON[weather.kind] ?? '·'}  ${WEATHER_LABEL_FR[weather.kind] ?? weather.kind} · ${SEASON_LABEL_FR[season] ?? season}`,
    ];
    for (let i = 0; i < this.rows.length; i++) {
      this.rows[i]!.setText(lines[i] ?? '');
    }

    const m = Math.max(0, state.motivation);
    const cap = 12;
    const ratio = Math.min(1, m / cap);
    this.motivationValue.setText(String(m));

    const motivationY = PAD_Y + 22 + 5 * ROW_H + 8;
    const barY = motivationY + 16;
    const barW = WIDTH - PAD_X * 2;
    const barH = 6;

    this.motivationBarBg.clear();
    this.motivationBarBg.fillStyle(0x2a2d34, 1);
    this.motivationBarBg.fillRoundedRect(PAD_X, barY, barW, barH, 3);

    this.motivationBarFill.clear();
    const color = ratio < 0.34 ? 0xd64545 : ratio < 0.67 ? 0xe2a93b : 0x4caf6d;
    if (ratio > 0) {
      this.motivationBarFill.fillStyle(color, 1);
      this.motivationBarFill.fillRoundedRect(PAD_X, barY, Math.max(2, barW * ratio), barH, 3);
    }

    const totalH = barY + barH + PAD_Y;
    this.bg.clear();
    this.bg.fillStyle(0x16181d, 0.88);
    this.bg.fillRoundedRect(0, 0, WIDTH, totalH, 8);
    this.bg.lineStyle(1, 0x2a2d34, 1);
    this.bg.strokeRoundedRect(0, 0, WIDTH, totalH, 8);
  }
}
