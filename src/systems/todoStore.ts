import { Todo } from '../domain/todo';

export function addTodo(todos: readonly Todo[], todo: Todo): readonly Todo[] {
  return [...todos, todo];
}

export type ToggleResult = {
  readonly todos: readonly Todo[];
  readonly toggled: { readonly from: boolean; readonly to: boolean } | null;
};

export function toggleTodo(todos: readonly Todo[], id: string): ToggleResult {
  const idx = todos.findIndex((t) => t.id === id);
  if (idx === -1) return { todos, toggled: null };
  const prev = todos[idx]!;
  const next = { ...prev, done: !prev.done };
  const out = todos.map((t, i) => (i === idx ? next : t));
  return { todos: out, toggled: { from: prev.done, to: next.done } };
}

export function updateTodoText(todos: readonly Todo[], id: string, text: string): readonly Todo[] {
  const trimmed = text.trim();
  if (trimmed.length === 0) throw new Error('todo text cannot be empty');
  return todos.map((t) => (t.id === id ? { ...t, text: trimmed } : t));
}

export function deleteTodo(todos: readonly Todo[], id: string): readonly Todo[] {
  return todos.filter((t) => t.id !== id);
}
