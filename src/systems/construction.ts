import { GameState } from '../domain/state';
import { dateKey, hourOfDay } from './clock';
import {
  CONSTRUCTION_BASE_THRESHOLD,
  CONSTRUCTION_THRESHOLD_STEP,
  CONSTRUCTION_OPENINGS_CAP,
  CONSTRUCTION_CARDS_BASE,
  CONSTRUCTION_CARDS_MAX,
  DAY_START_HOUR,
} from '../config';

/** Nombre de todos fermés pour débloquer une ouverture au niveau donné. */
export function thresholdFor(townHallLevel: number): number {
  const level = Math.max(1, townHallLevel);
  return CONSTRUCTION_BASE_THRESHOLD + (level - 1) * CONSTRUCTION_THRESHOLD_STEP;
}

/** Nombre de cartes proposées à chaque ouverture au niveau donné. */
export function poolSizeFor(townHallLevel: number): number {
  const level = Math.max(1, townHallLevel);
  return Math.min(CONSTRUCTION_CARDS_MAX, CONSTRUCTION_CARDS_BASE + level);
}

/**
 * Convertit autant de paliers de `points` que possible en ouvertures, sans
 * dépasser CONSTRUCTION_OPENINGS_CAP. Renvoie le couple { points, openings } résultant.
 */
function convert(points: number, openings: number, threshold: number): {
  points: number;
  openings: number;
} {
  let p = points;
  let o = openings;
  while (p >= threshold && o < CONSTRUCTION_OPENINGS_CAP) {
    p -= threshold;
    o += 1;
  }
  return { points: p, openings: o };
}

/**
 * Applique `delta` points de construction (positif à la fermeture d'un todo,
 * négatif au décochage). Plancher à 0, puis conversion des paliers atteints en
 * ouvertures.
 */
export function addPoints(state: GameState, delta: number): GameState {
  const raw = Math.max(0, state.construction.points + delta);
  const { points, openings } = convert(
    raw,
    state.construction.openings,
    thresholdFor(state.progression.townHallLevel),
  );
  return { ...state, construction: { ...state.construction, points, openings } };
}

/**
 * Consomme une ouverture de la file (no-op si la file est vide). Relance la
 * conversion : un créneau libéré peut absorber des points en attente.
 */
export function consumeOpening(state: GameState): GameState {
  if (state.construction.openings <= 0) return state;
  const { points, openings } = convert(
    state.construction.points,
    state.construction.openings - 1,
    thresholdFor(state.progression.townHallLevel),
  );
  return { ...state, construction: { ...state.construction, points, openings } };
}

/**
 * Accorde l'ouverture garantie du matin si un nouveau jour calendaire a
 * commencé et que l'heure est >= DAY_START_HOUR. Idempotent dans la journée :
 * `lastMorningDate` est mis à jour même si la file est pleine, pour ne pas
 * réessayer en boucle.
 */
export function grantMorningOpening(state: GameState, now: number): GameState {
  if (hourOfDay(now) < DAY_START_HOUR) return state;
  const today = dateKey(now);
  if (state.construction.lastMorningDate === today) return state;
  const openings = Math.min(CONSTRUCTION_OPENINGS_CAP, state.construction.openings + 1);
  return {
    ...state,
    construction: { ...state.construction, openings, lastMorningDate: today },
  };
}
