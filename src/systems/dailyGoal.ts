import { Todo } from '../domain/todo';
import { daysBetween } from './clock';

/**
 * Compte les tâches faites le jour de `now`, via `updatedAt`.
 * Limite connue : une tâche cochée hier puis éditée aujourd'hui voit son
 * `updatedAt` glisser à aujourd'hui et sera donc comptée. Cas rare, accepté
 * tant que le modèle Todo n'a pas de champ `completedAt` dédié.
 */
export function countDoneToday(todos: readonly Todo[], now: number): number {
  let count = 0;
  for (const t of todos) {
    // daysBetween renvoie 0 le jour même ; updatedAt étant toujours <= now, jamais négatif ici
    if (t.done && daysBetween(t.updatedAt, now) === 0) count += 1;
  }
  return count;
}
