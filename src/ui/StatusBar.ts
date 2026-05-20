import Phaser from 'phaser';
import { GameState } from '../domain/state';
import { weatherForDay } from '../systems/weather';

const WEATHER_LABEL_FR: Record<string, string> = {
  clear: 'beau',
  rain: 'pluie',
  snow: 'neige',
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

export class StatusBar {
  private text: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene) {
    const w = scene.scale.width;
    this.text = scene.add.text(w - 16, 16, '', {
      fontFamily: 'monospace',
      fontSize: '13px',
      color: '#ffffff',
      backgroundColor: '#00000099',
      padding: { x: 8, y: 4 },
      align: 'right',
    }).setOrigin(1, 0).setScrollFactor(0);
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
    const lines = [
      `habitants : ${state.world.villagers.length}`,
      `cultures : ${state.world.crops.length}`,
      `bâtiments : ${buildingParts.join(', ') || '—'}`,
      `mairie niv. ${state.progression.townHallLevel}`,
      `météo : ${WEATHER_LABEL_FR[weather.kind] ?? weather.kind}`,
    ];
    this.text.setText(lines.join('\n'));
  }
}
