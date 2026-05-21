import { GameState } from '../domain/state';
import { dayIndex } from './clock';
import { MAX_CATCHUP_DAYS } from '../config';
import { grantMorningOpening } from './construction';

export function catchUp(state: GameState, now: number): GameState {
  const elapsed = dayIndex(state.createdAt, now);
  const day = Math.min(elapsed, state.progression.day + MAX_CATCHUP_DAYS);

  let next: GameState = state;
  if (day !== state.progression.day || now !== state.lastSeenAt) {
    next = { ...next, lastSeenAt: now, progression: { ...next.progression, day } };
  }
  return grantMorningOpening(next, now);
}
