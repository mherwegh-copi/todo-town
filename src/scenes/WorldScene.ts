import Phaser from 'phaser';
import { GameState } from '../domain/state';
import { initWorld } from '../systems/init';
import { loadState, saveState } from '../systems/save';
import { catchUp } from '../systems/catchup';
import { renderTiles } from '../rendering/tileRenderer';
import { renderBuildings } from '../rendering/buildingRenderer';
import { MAP_WIDTH, MAP_HEIGHT, TILE_SIZE, RENDER_SCALE } from '../config';

export class WorldScene extends Phaser.Scene {
  private state!: GameState;
  private tileLayer!: Phaser.GameObjects.Container;
  private buildingLayer!: Phaser.GameObjects.Container;

  constructor() {
    super('WorldScene');
  }

  create(): void {
    const now = Date.now();
    const loaded = loadState();
    this.state = loaded ? catchUp(loaded, now) : initWorld(now, Math.floor(Math.random() * 1e9));
    saveState(this.state);

    this.tileLayer = this.add.container(0, 0);
    this.buildingLayer = this.add.container(0, 0);

    renderTiles(this, this.state, this.tileLayer);
    renderBuildings(this, this.state, this.buildingLayer);

    this.cameras.main.setZoom(RENDER_SCALE);
    this.cameras.main.centerOn((MAP_WIDTH / 2) * TILE_SIZE, (MAP_HEIGHT / 2) * TILE_SIZE);

    this.registry.set('state', this.state);
  }

  refresh(state: GameState): void {
    this.state = state;
    renderBuildings(this, state, this.buildingLayer);
    this.registry.set('state', state);
    saveState(state);
  }

  getState(): GameState {
    return this.state;
  }
}
