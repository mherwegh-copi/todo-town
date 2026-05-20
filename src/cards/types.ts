import { GameState } from '../domain/state';
import { BuildingKind } from '../domain/building';

export type CardCategory =
  | 'housing'
  | 'work'
  | 'recruit'
  | 'assign'
  | 'infrastructure'
  | 'townHall'
  | 'event';

export type ActionCard = {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly icon: string;
  readonly category: CardCategory;
  readonly minTier: number;
  readonly weight: number;
  /** Si défini : la carte ouvre le mode placement interactif pour ce type de bâtiment. */
  readonly placementKind?: BuildingKind;
  readonly isAvailable: (state: GameState) => boolean;
  readonly effect: (
    state: GameState,
    now: number,
    coords?: { x: number; y: number },
  ) => GameState;
};
