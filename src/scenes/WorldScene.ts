import Phaser from 'phaser';
import { GameState } from '../domain/state';
import { initWorld } from '../systems/init';
import { loadState, saveState } from '../systems/save';
import { catchUp } from '../systems/catchup';
import { renderTiles } from '../rendering/tileRenderer';
import { renderBuildings } from '../rendering/buildingRenderer';
import {
  ensureVillagerSprites,
  updateVillagerPositions,
  VillagerSpritesMap,
} from '../rendering/villagerRenderer';
import { MAP_WIDTH, MAP_HEIGHT, TILE_SIZE, RENDER_SCALE, SIM_TICK_MS } from '../config';

export class WorldScene extends Phaser.Scene {
  private state!: GameState;
  private tileLayer!: Phaser.GameObjects.Container;
  private buildingLayer!: Phaser.GameObjects.Container;
  private villagerLayer!: Phaser.GameObjects.Container;
  private villagerSprites: VillagerSpritesMap = new Map();
  private lastSimTick = 0;

  constructor() { super('WorldScene'); }

  create(): void {
    const now = Date.now();
    const loaded = loadState();
    this.state = loaded ? catchUp(loaded, now) : initWorld(now, Math.floor(Math.random() * 1e9));
    saveState(this.state);

    this.tileLayer = this.add.container(0, 0);
    this.buildingLayer = this.add.container(0, 0);
    this.villagerLayer = this.add.container(0, 0);

    renderTiles(this, this.state, this.tileLayer);
    renderBuildings(this, this.state, this.buildingLayer);
    ensureVillagerSprites(this, this.state, this.villagerLayer, this.villagerSprites);
    updateVillagerPositions(this.state, this.villagerSprites, now);

    this.cameras.main.setZoom(RENDER_SCALE);
    this.cameras.main.centerOn((MAP_WIDTH / 2) * TILE_SIZE, (MAP_HEIGHT / 2) * TILE_SIZE);

    this.registry.set('state', this.state);
  }

  update(time: number): void {
    if (time - this.lastSimTick < SIM_TICK_MS) return;
    this.lastSimTick = time;
    updateVillagerPositions(this.state, this.villagerSprites, Date.now());
  }

  refresh(state: GameState): void {
    this.state = state;
    renderBuildings(this, state, this.buildingLayer);
    ensureVillagerSprites(this, state, this.villagerLayer, this.villagerSprites);
    updateVillagerPositions(state, this.villagerSprites, Date.now());
    this.registry.set('state', state);
    saveState(state);
  }

  getState(): GameState { return this.state; }
}
