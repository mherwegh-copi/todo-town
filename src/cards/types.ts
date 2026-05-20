import { GameState } from '../domain/state';

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
  readonly isAvailable: (state: GameState) => boolean;
  readonly effect: (state: GameState, now: number) => GameState;
};
