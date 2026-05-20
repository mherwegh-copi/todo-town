import { describe, it, expect } from 'vitest';
import { sortTodos } from '../../../src/systems/todoSort';
import type { Todo } from '../../../src/domain/todo';

function todo(over: Partial<Todo>): Todo {
  return {
    id: over.id ?? 'id',
    text: over.text ?? 'text',
    done: over.done ?? false,
    createdAt: over.createdAt ?? 0,
    updatedAt: over.updatedAt ?? 0,
  };
}

describe('sortTodos', () => {
  it('created: oldest first', () => {
    const a = todo({ id: 'a', createdAt: 3 });
    const b = todo({ id: 'b', createdAt: 1 });
    const c = todo({ id: 'c', createdAt: 2 });
    expect(sortTodos([a, b, c], 'created').map((t) => t.id)).toEqual(['b', 'c', 'a']);
  });

  it('modified: most recent first', () => {
    const a = todo({ id: 'a', updatedAt: 1 });
    const b = todo({ id: 'b', updatedAt: 3 });
    const c = todo({ id: 'c', updatedAt: 2 });
    expect(sortTodos([a, b, c], 'modified').map((t) => t.id)).toEqual(['b', 'c', 'a']);
  });

  it('alpha: A to Z, case-insensitive', () => {
    const a = todo({ id: 'a', text: 'banana' });
    const b = todo({ id: 'b', text: 'Apple' });
    const c = todo({ id: 'c', text: 'cherry' });
    expect(sortTodos([a, b, c], 'alpha').map((t) => t.id)).toEqual(['b', 'a', 'c']);
  });

  it('does not mutate the input array', () => {
    const a = todo({ id: 'a', createdAt: 2 });
    const b = todo({ id: 'b', createdAt: 1 });
    const input = [a, b];
    sortTodos(input, 'created');
    expect(input).toEqual([a, b]);
  });

  it('returns empty array for empty input', () => {
    expect(sortTodos([], 'alpha')).toEqual([]);
  });
});
