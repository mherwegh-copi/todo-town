import { GameState } from '../domain/state';
import { dayIndex } from './clock';
import { MAX_CATCHUP_DAYS } from '../config';

export function catchUp(state: GameState, now: number): GameState {
  const elapsed = dayIndex(state.createdAt, now);
  const day = Math.min(elapsed, state.progression.day + MAX_CATCHUP_DAYS);
  if (day === state.progression.day && now === state.lastSeenAt) return state;
  return {
    ...state,
    lastSeenAt: now,
    progression: { ...state.progression, day },
  };
}
