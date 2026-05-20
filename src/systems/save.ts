import { GameState } from '../domain/state';
import { SAVE_KEY, SAVE_VERSION } from '../config';

export function saveState(state: GameState): void {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error('saveState failed', e);
  }
}

export function loadState(): GameState | null {
  const raw = localStorage.getItem(SAVE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<GameState> & { version?: number };
    if (parsed.version !== SAVE_VERSION) {
      console.warn('save version mismatch; ignoring');
      return null;
    }
    const base = parsed as GameState;
    return {
      ...base,
      motivation: typeof parsed.motivation === 'number' ? parsed.motivation : 0,
      motivationLastDecayAt:
        typeof parsed.motivationLastDecayAt === 'number'
          ? parsed.motivationLastDecayAt
          : (base.lastSeenAt ?? Date.now()),
    };
  } catch (e) {
    console.error('loadState failed', e);
    return null;
  }
}

export function clearSave(): void {
  localStorage.removeItem(SAVE_KEY);
}
