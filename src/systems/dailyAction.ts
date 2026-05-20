import { GameState } from '../domain/state';
import { ActionCard } from '../cards/types';
import { ALL_CARDS, cardById } from '../cards/deck';
import { createRng, rngInt } from './rng';
import { computeMetrics } from './progression';
import { dateKey, hourOfDay } from './clock';
import { DAY_START_HOUR, BASE_CARDS_DRAWN, MOTIVATION_CARDS_DIV, MOTIVATION_BONUS_CAP, MOTIVATION_ACTION_COST } from '../config';

export function isActionAvailable(state: GameState, now: number): boolean {
  if (hourOfDay(now) < DAY_START_HOUR) return false;
  return dateKey(now) !== state.lastActionDate;
}

function pondWeight(card: ActionCard, state: GameState): number {
  const m = computeMetrics(state);
  let w = card.weight;
  if (m.buildingsIdle > 0 && (card.category === 'recruit' || card.category === 'assign')) {
    w *= 2;
  }
  return w;
}

export function drawCards(state: GameState, now: number): readonly ActionCard[] {
  const pool = ALL_CARDS.filter(
    (c) => c.minTier <= state.progression.townHallLevel && c.isAvailable(state),
  );
  if (pool.length === 0) return [];
  const bonus = Math.min(MOTIVATION_BONUS_CAP, Math.floor(state.motivation / MOTIVATION_CARDS_DIV));
  const target = BASE_CARDS_DRAWN + bonus;
  const rng = createRng((state.seed ^ Math.floor(now / 1000)) >>> 0);
  const picked: ActionCard[] = [];
  const remaining = [...pool];
  while (picked.length < target && remaining.length > 0) {
    const weights = remaining.map((c) => pondWeight(c, state));
    const total = weights.reduce((a, b) => a + b, 0);
    let r = rng() * total;
    let idx = 0;
    for (let i = 0; i < remaining.length; i++) {
      r -= weights[i]!;
      if (r <= 0) {
        idx = i;
        break;
      }
    }
    picked.push(remaining[idx]!);
    remaining.splice(idx, 1);
  }
  void rngInt;
  return picked;
}

export function applyChosenCard(state: GameState, cardId: string, now: number): GameState {
  const card = cardById(cardId);
  const after = card.effect(state, now);
  const motivation = Math.max(0, state.motivation - MOTIVATION_ACTION_COST);
  return { ...after, lastActionDate: dateKey(now), lastSeenAt: now, motivation };
}
