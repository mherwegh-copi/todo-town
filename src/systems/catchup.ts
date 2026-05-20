import { GameState } from '../domain/state';
import { dayIndex } from './clock';
import { MAX_CATCHUP_DAYS, MOTIVATION_DECAY_HOURS } from '../config';

const DECAY_INTERVAL_MS = MOTIVATION_DECAY_HOURS * 60 * 60 * 1000;

export function catchUp(state: GameState, now: number): GameState {
  const elapsed = dayIndex(state.createdAt, now);
  const day = Math.min(elapsed, state.progression.day + MAX_CATCHUP_DAYS);

  const elapsedDecay = now - state.motivationLastDecayAt;
  const decaySteps = elapsedDecay >= DECAY_INTERVAL_MS ? Math.floor(elapsedDecay / DECAY_INTERVAL_MS) : 0;
  const nextMotivation = Math.max(0, state.motivation - decaySteps);
  const nextDecayAt = state.motivationLastDecayAt + decaySteps * DECAY_INTERVAL_MS;

  if (day === state.progression.day && now === state.lastSeenAt && decaySteps === 0) return state;

  return {
    ...state,
    lastSeenAt: now,
    progression: { ...state.progression, day },
    motivation: nextMotivation,
    motivationLastDecayAt: nextDecayAt,
  };
}
