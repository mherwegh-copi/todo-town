import type { Todo } from '../../domain/todo';
import type { GameState } from '../../domain/state';
import type { SortMode } from '../todoSort';

/** Un todo côté cloud : un todo du domaine + un drapeau tombstone. */
export type CloudTodo = Todo & { readonly deleted: boolean };

/** Préférences UI synchronisées. */
export type CloudPrefs = {
  readonly sortMode: SortMode;
  readonly doneCollapsed: boolean;
  readonly dailyGoal: number;
};

/** Une valeur accompagnée de son horodatage de dernière écriture (ms epoch). */
export type Stamped<T> = { readonly value: T; readonly updatedAt: number };

/** Photo complète de l'état synchronisable, local ou distant. */
export type SyncSnapshot = {
  readonly todos: readonly CloudTodo[];
  readonly gameState: Stamped<GameState | null>;
  readonly prefs: Stamped<CloudPrefs>;
};

/** Durée de vie d'un tombstone dans le cache local (30 jours). */
export const TOMBSTONE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Fusionne deux listes de todos par id, last-write-wins sur updatedAt.
 * En cas d'égalité, la version remote gagne (le cloud fait autorité).
 */
export function mergeTodos(
  local: readonly CloudTodo[],
  remote: readonly CloudTodo[],
): readonly CloudTodo[] {
  const byId = new Map<string, CloudTodo>();
  for (const t of local) byId.set(t.id, t);
  for (const t of remote) {
    const existing = byId.get(t.id);
    if (!existing || t.updatedAt >= existing.updatedAt) byId.set(t.id, t);
  }
  return [...byId.values()];
}
