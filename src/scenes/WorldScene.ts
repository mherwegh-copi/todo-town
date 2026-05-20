import Phaser from 'phaser';
import { GameState } from '../domain/state';
import { initWorld } from '../systems/init';
import { loadState, saveState } from '../systems/save';
import { catchUp } from '../systems/catchup';
import { renderTiles } from '../rendering/tileRenderer';
import { renderPaths } from '../rendering/pathRenderer';
import { renderBuildings } from '../rendering/buildingRenderer';
import {
  ensureVillagerSprites,
  updateVillagerPositions,
  VillagerSpritesMap,
} from '../rendering/villagerRenderer';
import { DayNightOverlay } from '../rendering/dayNightOverlay';
import { WeatherRenderer } from '../rendering/weatherRenderer';
import { weatherForDay } from '../systems/weather';
import { MAP_WIDTH, MAP_HEIGHT, TILE_SIZE, RENDER_SCALE, SIM_TICK_MS } from '../config';
import { BUILDING_FOOTPRINT } from '../domain/building';

export class WorldScene extends Phaser.Scene {
  private state!: GameState;
  private tileLayer!: Phaser.GameObjects.Container;
  private pathLayer!: Phaser.GameObjects.Container;
  private buildingLayer!: Phaser.GameObjects.Container;
  private villagerLayer!: Phaser.GameObjects.Container;
  private villagerSprites: VillagerSpritesMap = new Map();
  private overlay!: DayNightOverlay;
  private weatherFx!: WeatherRenderer;
  private lastSimTick = 0;
  private lastCatchUp = 0;
  private debugLayer!: Phaser.GameObjects.Container;
  private debugVisible = false;

  constructor() { super('WorldScene'); }

  create(): void {
    const now = Date.now();
    const loaded = loadState();
    this.state = loaded ? catchUp(loaded, now) : initWorld(now, Math.floor(Math.random() * 1e9));
    saveState(this.state);

    this.tileLayer = this.add.container(0, 0);
    this.pathLayer = this.add.container(0, 0);
    this.buildingLayer = this.add.container(0, 0);
    this.villagerLayer = this.add.container(0, 0);
    this.debugLayer = this.add.container(0, 0).setVisible(false).setDepth(500);

    renderTiles(this, this.state, this.tileLayer);
    renderPaths(this, this.state, this.pathLayer);
    renderBuildings(this, this.state, this.buildingLayer);
    ensureVillagerSprites(this, this.state, this.villagerLayer, this.villagerSprites);
    updateVillagerPositions(this.state, this.villagerSprites, now);

    this.overlay = new DayNightOverlay(this, this.scale.width, this.scale.height);
    this.weatherFx = new WeatherRenderer(this, this.scale.width, this.scale.height);
    this.weatherFx.apply(weatherForDay(this.state.seed, this.state.progression.day));

    this.cameras.main.setZoom(RENDER_SCALE);
    this.cameras.main.centerOn((MAP_WIDTH / 2) * TILE_SIZE, (MAP_HEIGHT / 2) * TILE_SIZE);

    const cam = this.cameras.main;
    let dragging = false;
    let lastX = 0;
    let lastY = 0;
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      dragging = true;
      lastX = p.x;
      lastY = p.y;
    });
    this.input.on('pointerup', () => { dragging = false; });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (!dragging) return;
      cam.scrollX -= (p.x - lastX) / cam.zoom;
      cam.scrollY -= (p.y - lastY) / cam.zoom;
      lastX = p.x;
      lastY = p.y;
    });
    this.input.on('wheel', (_p: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number) => {
      const next = Phaser.Math.Clamp(cam.zoom + (dy < 0 ? 0.25 : -0.25), 1, 3);
      cam.setZoom(next);
    });

    this.input.on('gameobjectover', (_p: Phaser.Input.Pointer, obj: Phaser.GameObjects.Image) => {
      const bid = obj.getData('buildingId') as string | undefined;
      if (bid) this.events.emit('hover-building', bid);
    });
    this.input.on('gameobjectout', () => this.events.emit('hover-clear'));
    this.input.on('gameobjectdown', (_p: Phaser.Input.Pointer, obj: Phaser.GameObjects.Image) => {
      const bid = obj.getData('buildingId') as string | undefined;
      if (bid) this.events.emit('click-building', bid);
    });

    this.registry.set('state', this.state);
    this.events.on('todo-completed', () => this.celebrateRandomVillager());
  }

  update(time: number): void {
    if (Date.now() - this.lastCatchUp > 60_000) {
      this.lastCatchUp = Date.now();
      this.state = catchUp(this.state, Date.now());
      this.registry.set('state', this.state);
      saveState(this.state);
    }

    const now = Date.now();
    updateVillagerPositions(this.state, this.villagerSprites, now);
    if (time - this.lastSimTick < SIM_TICK_MS) return;
    this.lastSimTick = time;
    this.overlay.update(now);
    this.weatherFx.apply(weatherForDay(this.state.seed, this.state.progression.day));
  }

  refresh(state: GameState): void {
    this.state = state;
    renderPaths(this, state, this.pathLayer);
    renderBuildings(this, state, this.buildingLayer);
    ensureVillagerSprites(this, state, this.villagerLayer, this.villagerSprites);
    updateVillagerPositions(state, this.villagerSprites, Date.now());
    this.registry.set('state', state);
    saveState(state);
    if (this.debugVisible) this.renderDebug();
  }

  getState(): GameState { return this.state; }

  bumpMotivation(delta: number): GameState {
    const next = { ...this.state, motivation: Math.max(0, this.state.motivation + delta) };
    this.state = next;
    this.registry.set('state', next);
    saveState(next);
    return next;
  }

  setDebugVisible(on: boolean): void {
    this.debugVisible = on;
    this.debugLayer.setVisible(on);
    if (on) this.renderDebug();
  }

  private renderDebug(): void {
    this.debugLayer.removeAll(true);
    const g = this.add.graphics();
    g.lineStyle(1, 0xffffff, 0.35);
    for (let x = 0; x <= MAP_WIDTH; x++) {
      g.lineBetween(x * TILE_SIZE, 0, x * TILE_SIZE, MAP_HEIGHT * TILE_SIZE);
    }
    for (let y = 0; y <= MAP_HEIGHT; y++) {
      g.lineBetween(0, y * TILE_SIZE, MAP_WIDTH * TILE_SIZE, y * TILE_SIZE);
    }
    g.lineStyle(1, 0xff3030, 0.9);
    for (const b of this.state.world.buildings) {
      const fp = BUILDING_FOOTPRINT[b.kind];
      g.strokeRect(b.tileX * TILE_SIZE, b.tileY * TILE_SIZE, fp.w * TILE_SIZE, fp.h * TILE_SIZE);
    }
    this.debugLayer.add(g);

    for (let x = 0; x < MAP_WIDTH; x += 4) {
      for (let y = 0; y < MAP_HEIGHT; y += 4) {
        const t = this.add.text(x * TILE_SIZE + 1, y * TILE_SIZE + 1, `${x},${y}`, {
          fontFamily: 'monospace', fontSize: '6px', color: '#ffffffaa',
        });
        this.debugLayer.add(t);
      }
    }

    for (const b of this.state.world.buildings) {
      const fp = BUILDING_FOOTPRINT[b.kind];
      const cx = (b.tileX + fp.w / 2) * TILE_SIZE;
      const cy = (b.tileY + fp.h / 2) * TILE_SIZE;
      const label = this.add.text(cx, cy, b.kind, {
        fontFamily: 'monospace', fontSize: '8px', color: '#ffffff', backgroundColor: '#000000aa',
      }).setOrigin(0.5, 0.5);
      this.debugLayer.add(label);
    }

    for (const v of this.state.world.villagers) {
      const target = this.state.world.buildings.find((b) => b.id === v.homeId);
      if (!target) continue;
      const fp = BUILDING_FOOTPRINT[target.kind];
      const cx = (target.tileX + fp.w / 2) * TILE_SIZE;
      const cy = (target.tileY + fp.h / 2) * TILE_SIZE;
      const label = this.add.text(cx, cy - 16, v.name, {
        fontFamily: 'monospace', fontSize: '8px', color: '#ffff80', backgroundColor: '#000000aa',
      }).setOrigin(0.5, 0.5);
      this.debugLayer.add(label);
    }
  }

  isDebugVisible(): boolean { return this.debugVisible; }

  private celebrateRandomVillager(): void {
    const sprites: Phaser.GameObjects.Image[] = [];
    for (const s of this.villagerSprites.values()) {
      if (s.visible) sprites.push(s);
    }
    if (sprites.length === 0) return;
    const sprite = sprites[Math.floor(Math.random() * sprites.length)]!;
    if (sprite.getData('celebrating') === true) return;
    const baseY = sprite.y;
    sprite.setData('celebrating', true);
    this.tweens.add({
      targets: sprite,
      y: baseY - 8,
      duration: 200,
      yoyo: true,
      ease: 'Quad.easeOut',
      onComplete: () => { sprite.y = baseY; sprite.setData('celebrating', false); },
    });
  }
}
