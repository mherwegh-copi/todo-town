import Phaser from 'phaser';
import { StatusBar } from '../ui/StatusBar';
import { ActionButton } from '../ui/ActionButton';
import { CardOverlay } from '../ui/CardOverlay';
import { Tooltip } from '../ui/Tooltip';
import { DebugButton } from '../ui/DebugButton';
import { TilePicker } from '../ui/TilePicker';
import { drawCards, applyChosenCard, isActionAvailable } from '../systems/dailyAction';
import { cardById } from '../cards/deck';
import { ActionCard } from '../cards/types';
import { GameState } from '../domain/state';
import { WorldScene } from './WorldScene';

export class UIScene extends Phaser.Scene {
  private status!: StatusBar;
  private actionBtn!: ActionButton;
  private overlay!: CardOverlay;
  private placing = false;
  private drawnCards: readonly ActionCard[] = [];

  constructor() { super('UIScene'); }

  create(): void {
    this.status = new StatusBar(this);
    this.actionBtn = new ActionButton(this, () => this.openAction());
    this.overlay = new CardOverlay(this, {
      onPick: (id) => this.pickCard(id),
      onCancel: () => this.overlay.hide(),
    });

    const tooltip = new Tooltip(this);
    const world = this.scene.get('WorldScene') as WorldScene;
    world.events.on('hover-building', (id: string) => {
      const s = world.getState();
      const b = s.world.buildings.find((bb) => bb.id === id);
      if (!b) return;
      const occupants = s.world.villagers.filter((v) => v.homeId === id || v.workplaceId === id);
      const lines = [`${b.kind}`, `occupants: ${occupants.map((v) => v.name).join(', ') || '—'}`];
      tooltip.show(lines.join('\n'));
    });
    world.events.on('hover-clear', () => tooltip.hide());

    const picker = new TilePicker(this);
    new DebugButton(this, (on) => {
      world.setDebugVisible(on);
      picker.setVisible(on);
    });
  }

  update(): void {
    const state = this.registry.get('state') as GameState | undefined;
    if (!state) return;
    const now = Date.now();
    this.status.update(state);
    this.actionBtn.setAvailable(isActionAvailable(state, now));
  }

  private openAction(): void {
    const state = this.registry.get('state') as GameState | undefined;
    if (!state) return;
    const now = Date.now();
    if (!isActionAvailable(state, now)) return;
    const cards = drawCards(state, now);
    if (cards.length === 0) return;
    this.drawnCards = cards;
    this.overlay.show(cards);
  }

  private pickCard(cardId: string): void {
    if (this.placing) return;
    const world = this.scene.get('WorldScene') as WorldScene;
    const card = cardById(cardId);

    if (card.placementKind) {
      this.placing = true;
      this.overlay.hide();
      world.beginPlacement(
        card.placementKind,
        (coords) => {
          this.placing = false;
          const next = applyChosenCard(world.getState(), cardId, Date.now(), coords);
          world.refresh(next);
        },
        () => {
          this.placing = false;
          // Carte non jouée : aucun coût, on ré-affiche le choix de cartes.
          this.overlay.hide();
          this.overlay.show(this.drawnCards);
        },
      );
      return;
    }

    const next = applyChosenCard(world.getState(), cardId, Date.now());
    world.refresh(next);
    this.overlay.hide();
  }
}
