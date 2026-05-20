import Phaser from 'phaser';
import { Weather } from '../systems/weather';

export class WeatherRenderer {
  private emitter?: Phaser.GameObjects.Particles.ParticleEmitter;
  private current: Weather['kind'] = 'clear';

  constructor(private scene: Phaser.Scene, private width: number, private height: number) {}

  apply(weather: Weather): void {
    if (weather.kind === this.current) return;
    this.current = weather.kind;
    this.emitter?.destroy();
    this.emitter = undefined;
    if (weather.kind === 'clear') return;
    const color = weather.kind === 'snow' ? 0xffffff : 0x88bbee;
    const speedY = weather.kind === 'snow' ? { min: 30, max: 60 } : { min: 200, max: 320 };
    this.emitter = this.scene.add.particles(0, 0, '__WHITE', {
      x: { min: 0, max: this.width },
      y: -10,
      lifespan: 4000,
      speedY,
      quantity: weather.kind === 'snow' ? 1 : 3,
      frequency: 80,
      scale: weather.kind === 'snow' ? 1.2 : 0.8,
      tint: color,
      blendMode: 'NORMAL',
    });
    this.emitter.setScrollFactor(0);
  }
}
