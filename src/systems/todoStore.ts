import { Todo } from '../domain/todo';
import {
  TODO_STORAGE_KEY,
  TODO_SORT_KEY,
  TODO_DONE_COLLAPSED_KEY,
  TODO_DAILY_GOAL_KEY,
  DAILY_GOAL_MIN,
  DAILY_GOAL_MAX,
  DAILY_GOAL_DEFAULT,
} from '../config';
import { SortMode } from './todoSort';

export function addTodo(todos: readonly Todo[], todo: Todo): readonly Todo[] {
  return [...todos, todo];
}

export type ToggleResult = {
  readonly todos: readonly Todo[];
  readonly toggled: { readonly from: boolean; readonly to: boolean } | null;
};

export function toggleTodo(
  todos: readonly Todo[],
  id: string,
  now: number,
): ToggleResult {
  const idx = todos.findIndex((t) => t.id === id);
  if (idx === -1) return { todos, toggled: null };
  const prev = todos[idx]!;
  const next = { ...prev, done: !prev.done, updatedAt: now };
  const out = todos.map((t, i) => (i === idx ? next : t));
  return { todos: out, toggled: { from: prev.done, to: next.done } };
}

export function updateTodoText(
  todos: readonly Todo[],
  id: string,
  text: string,
  now: number,
): readonly Todo[] {
  const trimmed = text.trim();
  if (trimmed.length === 0) throw new Error('todo text cannot be empty');
  return todos.map((t) =>
    t.id === id ? { ...t, text: trimmed, updatedAt: now } : t,
  );
}

export function deleteTodo(todos: readonly Todo[], id: string): readonly Todo[] {
  return todos.filter((t) => t.id !== id);
}

export type Partitioned = {
  readonly active: readonly Todo[];
  readonly done: readonly Todo[];
};

export function partitionTodos(todos: readonly Todo[]): Partitioned {
  const active: Todo[] = [];
  const done: Todo[] = [];
  for (const t of todos) {
    if (t.done) done.push(t);
    else active.push(t);
  }
  return { active, done };
}

export function loadTodos(): readonly Todo[] {
  const raw = localStorage.getItem(TODO_STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as Array<
      Omit<Todo, 'updatedAt'> & { updatedAt?: number }
    >;
    if (!Array.isArray(parsed)) return [];
    return parsed.map((t) => ({
      ...t,
      updatedAt: t.updatedAt ?? t.createdAt,
    }));
  } catch {
    return [];
  }
}

export function saveTodos(todos: readonly Todo[]): void {
  try {
    localStorage.setItem(TODO_STORAGE_KEY, JSON.stringify(todos));
  } catch (e) {
    console.error('saveTodos failed', e);
  }
}

const SORT_MODES: readonly SortMode[] = ['created', 'modified', 'alpha'];

export function loadSortMode(): SortMode {
  const raw = localStorage.getItem(TODO_SORT_KEY);
  return SORT_MODES.includes(raw as SortMode) ? (raw as SortMode) : 'created';
}

export function saveSortMode(mode: SortMode): void {
  try {
    localStorage.setItem(TODO_SORT_KEY, mode);
  } catch (e) {
    console.error('saveSortMode failed', e);
  }
}

export function loadDoneCollapsed(): boolean {
  return localStorage.getItem(TODO_DONE_COLLAPSED_KEY) === 'true';
}

export function saveDoneCollapsed(collapsed: boolean): void {
  try {
    localStorage.setItem(TODO_DONE_COLLAPSED_KEY, String(collapsed));
  } catch (e) {
    console.error('saveDoneCollapsed failed', e);
  }
}

export function clampDailyGoal(n: number): number {
  if (!Number.isFinite(n)) return DAILY_GOAL_DEFAULT;
  return Math.min(DAILY_GOAL_MAX, Math.max(DAILY_GOAL_MIN, Math.round(n)));
}

export function loadDailyGoal(): number {
  const raw = localStorage.getItem(TODO_DAILY_GOAL_KEY);
  if (raw == null) return DAILY_GOAL_DEFAULT;
  return clampDailyGoal(Number(raw));
}

export function saveDailyGoal(goal: number): void {
  try {
    localStorage.setItem(TODO_DAILY_GOAL_KEY, String(clampDailyGoal(goal)));
  } catch (e) {
    console.error('saveDailyGoal failed', e);
  }
}
