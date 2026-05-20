import { describe, it, expect } from 'vitest';
import { newTodo } from '../../../src/domain/todo';

describe('newTodo', () => {
  it('creates a todo with trimmed text, done=false, unique id, createdAt', () => {
    const a = newTodo('  buy milk  ', 1700000000000);
    expect(a.text).toBe('buy milk');
    expect(a.done).toBe(false);
    expect(a.createdAt).toBe(1700000000000);
    expect(a.id).toMatch(/^todo-/);
    const b = newTodo('walk dog', 1700000000001);
    expect(a.id).not.toBe(b.id);
  });

  it('throws when text is empty after trim', () => {
    expect(() => newTodo('   ', 0)).toThrow();
  });
});
