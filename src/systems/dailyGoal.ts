import { Todo } from '../domain/todo';
import { daysBetween } from './clock';

export function countDoneToday(todos: readonly Todo[], now: number): number {
  let count = 0;
  for (const t of todos) {
    if (t.done && daysBetween(t.updatedAt, now) === 0) count += 1;
  }
  return count;
}
