import { GameState } from '../domain/state';
import { SAVE_KEY, SAVE_VERSION } from '../config';

type SaveListener = (state: GameState) => void;
let saveListener: SaveListener | null = null;

/**
 * Enregistre un listener notifié après chaque saveState réussi.
 * Sert de pont vers la synchronisation cloud sans coupler WorldScene au cloud.
 */
export function setSaveListener(listener: SaveListener | null): void {
  saveListener = listener;
}

export function saveState(state: GameState): void {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error('saveState failed', e);
  }
  // Le listener cloud ne doit jamais faire échouer une sauvegarde locale.
  try {
    saveListener?.(state);
  } catch (e) {
    console.warn('saveState listener failed', e);
  }
}

export function loadState(): GameState | null {
  const raw = localStorage.getItem(SAVE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<GameState> & {
      version?: number;
      construction?: GameState['construction'];
    };
    if (parsed.version !== SAVE_VERSION) {
      console.warn('save version mismatch; ignoring');
      return null;
    }
    const base = parsed as GameState;
    return {
      ...base,
      construction: parsed.construction ?? { points: 0, openings: 0, lastMorningDate: '' },
    };
  } catch (e) {
    console.error('loadState failed', e);
    return null;
  }
}

export function clearSave(): void {
  localStorage.removeItem(SAVE_KEY);
}
