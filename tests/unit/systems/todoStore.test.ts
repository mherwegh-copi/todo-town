import { describe, it, expect, beforeEach, vi } from 'vitest';
import { addTodo, toggleTodo, updateTodoText, deleteTodo } from '../../../src/systems/todoStore';
import { newTodo } from '../../../src/domain/todo';

describe('todoStore pure ops', () => {
  it('addTodo appends', () => {
    const t1 = newTodo('a', 1);
    const t2 = newTodo('b', 2);
    const out = addTodo([t1], t2);
    expect(out).toEqual([t1, t2]);
  });

  it('toggleTodo flips done and returns toggled item', () => {
    const t = newTodo('a', 1);
    const { todos, toggled } = toggleTodo([t], t.id);
    expect(todos[0]!.done).toBe(true);
    expect(toggled).toEqual({ from: false, to: true });
    const again = toggleTodo(todos, t.id);
    expect(again.todos[0]!.done).toBe(false);
    expect(again.toggled).toEqual({ from: true, to: false });
  });

  it('toggleTodo with unknown id returns same list and null', () => {
    const t = newTodo('a', 1);
    const out = toggleTodo([t], 'nope');
    expect(out.todos).toEqual([t]);
    expect(out.toggled).toBeNull();
  });

  it('updateTodoText replaces text trimmed, throws on empty', () => {
    const t = newTodo('a', 1);
    const out = updateTodoText([t], t.id, '  new  ');
    expect(out[0]!.text).toBe('new');
    expect(() => updateTodoText([t], t.id, '   ')).toThrow();
  });

  it('deleteTodo removes by id', () => {
    const t1 = newTodo('a', 1);
    const t2 = newTodo('b', 2);
    expect(deleteTodo([t1, t2], t1.id)).toEqual([t2]);
  });

  it('newTodo sets updatedAt equal to createdAt', () => {
    const t = newTodo('a', 42);
    expect(t.createdAt).toBe(42);
    expect(t.updatedAt).toBe(42);
  });
});

import { loadTodos, saveTodos } from '../../../src/systems/todoStore';

describe('todoStore persistence', () => {
  let store: Record<string, string>;

  beforeEach(() => {
    store = {};
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => store[key] ?? null,
      setItem: (key: string, value: string) => {
        store[key] = value;
      },
      clear: () => {
        store = {};
      },
      removeItem: (key: string) => {
        delete store[key];
      },
      length: 0,
      key: (index: number) => null,
    });
  });

  it('loadTodos returns [] when nothing stored', () => {
    expect(loadTodos()).toEqual([]);
  });

  it('saveTodos + loadTodos round-trip', () => {
    const t = newTodo('a', 1);
    saveTodos([t]);
    const loaded = loadTodos();
    expect(loaded).toEqual([t]);
  });

  it('loadTodos returns [] on corrupt JSON', () => {
    localStorage.setItem('village-todos', 'not-json');
    expect(loadTodos()).toEqual([]);
  });
});
