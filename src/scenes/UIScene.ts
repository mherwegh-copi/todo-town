import Phaser from 'phaser';
import { ClockWidget } from '../ui/ClockWidget';
import { ActionButton } from '../ui/ActionButton';
import { isActionAvailable } from '../systems/dailyAction';
import { GameState } from '../domain/state';

export class UIScene extends Phaser.Scene {
  private clock!: ClockWidget;
  private actionBtn!: ActionButton;

  constructor() { super('UIScene'); }

  create(): void {
    this.clock = new ClockWidget(this);
    this.actionBtn = new ActionButton(this, () => this.events.emit('open-action'));
  }

  update(): void {
    const state = this.registry.get('state') as GameState | undefined;
    if (!state) return;
    const now = Date.now();
    this.clock.update(state.createdAt, now);
    this.actionBtn.setAvailable(isActionAvailable(state, now));
  }
}
