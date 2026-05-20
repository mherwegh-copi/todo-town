import { Todo } from '../domain/todo';

export type SortMode = 'created' | 'modified' | 'alpha';

export function sortTodos(
  todos: readonly Todo[],
  mode: SortMode,
): readonly Todo[] {
  const copy = [...todos];
  switch (mode) {
    case 'created':
      return copy.sort((a, b) => a.createdAt - b.createdAt);
    case 'modified':
      return copy.sort((a, b) => b.updatedAt - a.updatedAt);
    case 'alpha':
      return copy.sort((a, b) =>
        a.text.localeCompare(b.text, undefined, { sensitivity: 'base' }),
      );
  }
}
