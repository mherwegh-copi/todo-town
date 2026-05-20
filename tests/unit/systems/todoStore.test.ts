import { describe, it, expect } from 'vitest';
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
});
