import Phaser from 'phaser';
import { GameState } from '../domain/state';
import { weatherForDay } from '../systems/weather';
import { seasonForDay } from '../systems/season';
import { thresholdFor } from '../systems/construction';
import { CONSTRUCTION_OPENINGS_CAP } from '../config';

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

const TOKEN_W = 14;
const TOKEN_H = 16;
const TOKEN_GAP = 6;

export class StatusBar {
  private container: Phaser.GameObjects.Container;
  private bg: Phaser.GameObjects.Graphics;
  private title: Phaser.GameObjects.Text;
  private rows: Phaser.GameObjects.Text[] = [];
  private chantierLabel: Phaser.GameObjects.Text;
  private chantierValue: Phaser.GameObjects.Text;
  private chantierBarBg: Phaser.GameObjects.Graphics;
  private chantierBarFill: Phaser.GameObjects.Graphics;
  private openingsLabel: Phaser.GameObjects.Text;
  private openingsTokens: Phaser.GameObjects.Graphics;

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

    const chantierY = PAD_Y + 22 + 5 * ROW_H + 8;
    this.chantierLabel = scene.add.text(PAD_X, chantierY, '🔨 CHANTIER', {
      fontFamily: FONT, fontSize: '10px', color: '#8a8f99',
    });
    this.chantierLabel.setLetterSpacing(1);
    this.container.add(this.chantierLabel);

    this.chantierValue = scene.add.text(WIDTH - PAD_X, chantierY, '0/3', {
      fontFamily: FONT, fontSize: '12px', color: '#f0f0f0',
    }).setOrigin(1, 0);
    this.container.add(this.chantierValue);

    this.chantierBarBg = scene.add.graphics();
    this.chantierBarFill = scene.add.graphics();
    this.container.add(this.chantierBarBg);
    this.container.add(this.chantierBarFill);

    const openingsY = chantierY + 16 + 6 + 12;
    this.openingsLabel = scene.add.text(PAD_X, openingsY, 'OUVERTURES PRÊTES', {
      fontFamily: FONT, fontSize: '10px', color: '#8a8f99',
    });
    this.openingsLabel.setLetterSpacing(1);
    this.container.add(this.openingsLabel);

    this.openingsTokens = scene.add.graphics();
    this.container.add(this.openingsTokens);
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

    const threshold = thresholdFor(state.progression.townHallLevel);
    const points = state.construction.points;
    const ratio = threshold > 0 ? Math.min(1, points / threshold) : 0;
    this.chantierValue.setText(`${points}/${threshold} tâches`);

    const chantierY = PAD_Y + 22 + 5 * ROW_H + 8;
    const barY = chantierY + 16;
    const barW = WIDTH - PAD_X * 2;
    const barH = 8;

    this.chantierBarBg.clear();
    this.chantierBarBg.fillStyle(0x2a2d34, 1);
    this.chantierBarBg.fillRoundedRect(PAD_X, barY, barW, barH, 3);

    this.chantierBarFill.clear();
    if (ratio > 0) {
      this.chantierBarFill.fillStyle(0xf0a500, 1);
      this.chantierBarFill.fillRoundedRect(PAD_X, barY, Math.max(2, barW * ratio), barH, 3);
    }

    const tokensY = barY + barH + 6 + 14;
    this.openingsTokens.clear();
    for (let i = 0; i < CONSTRUCTION_OPENINGS_CAP; i++) {
      const x = PAD_X + i * (TOKEN_W + TOKEN_GAP);
      const filled = i < state.construction.openings;
      this.openingsTokens.fillStyle(filled ? 0xffd45e : 0x1f1b2b, 1);
      this.openingsTokens.fillRoundedRect(x, tokensY, TOKEN_W, TOKEN_H, 3);
      this.openingsTokens.lineStyle(1.5, filled ? 0xf0a500 : 0x4a4360, 1);
      this.openingsTokens.strokeRoundedRect(x, tokensY, TOKEN_W, TOKEN_H, 3);
    }

    const totalH = tokensY + TOKEN_H + PAD_Y;
    this.bg.clear();
    this.bg.fillStyle(0x16181d, 0.88);
    this.bg.fillRoundedRect(0, 0, WIDTH, totalH, 8);
    this.bg.lineStyle(1, 0x2a2d34, 1);
    this.bg.strokeRoundedRect(0, 0, WIDTH, totalH, 8);
  }
}
