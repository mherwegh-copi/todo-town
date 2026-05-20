# Todolist Sidebar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a persistent gamified todolist sidebar (30% left) alongside the village canvas (70% right). Checking todos boosts daily card draws.

**Architecture:** DOM sidebar (vanilla HTML/TS) handles CRUD; persistence in separate `localStorage` key. New `motivation` counter added to `GameState` — incremented on todo completion, drives `drawCards` count (3–5 cards), resets when player picks a card. Phaser canvas resizes to right pane via `Phaser.Scale.RESIZE`.

**Tech Stack:** TypeScript (strict), Vite, Phaser 3, Vitest + jsdom, vanilla DOM (no React).

---

## File Structure

**Create:**
- `src/domain/todo.ts` — `Todo` type, `newTodo(text)` factory
- `src/systems/todoStore.ts` — pure CRUD + localStorage I/O
- `src/ui/TodoSidebar.ts` — DOM component (vanilla)
- `tests/unit/domain/todo.test.ts`
- `tests/unit/systems/todoStore.test.ts`
- `tests/unit/ui/TodoSidebar.test.ts`

**Modify:**
- `src/domain/state.ts` — add `motivation: number`
- `src/systems/save.ts` — migration fallback for missing motivation
- `src/systems/dailyAction.ts` — `drawCards` count + reset on pick
- `src/scenes/WorldScene.ts` — listen `'todo-completed'`, animate
- `src/main.ts` — wire sidebar ↔ store ↔ Phaser
- `index.html` — split layout 30/70 + sidebar styles
- `src/config.ts` — constants (`TODO_STORAGE_KEY`, `MOTIVATION_CARDS_DIV`, `MOTIVATION_BONUS_CAP`)

---

## Task 1: Todo Domain Type

**Files:**
- Create: `src/domain/todo.ts`
- Test: `tests/unit/domain/todo.test.ts`

- [ ] **Step 1: Write failing test**

```ts
// tests/unit/domain/todo.test.ts
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
```

- [ ] **Step 2: Run test, expect FAIL**

Run: `npm run test:run -- todo.test`
Expected: FAIL ("Cannot find module ../../../src/domain/todo")

- [ ] **Step 3: Implement**

```ts
// src/domain/todo.ts
export type Todo = {
  readonly id: string;
  readonly text: string;
  readonly done: boolean;
  readonly createdAt: number;
};

let counter = 0;

export function newTodo(text: string, now: number): Todo {
  const trimmed = text.trim();
  if (trimmed.length === 0) throw new Error('todo text cannot be empty');
  counter += 1;
  return {
    id: `todo-${now}-${counter}`,
    text: trimmed,
    done: false,
    createdAt: now,
  };
}
```

- [ ] **Step 4: Run test, expect PASS**

Run: `npm run test:run -- todo.test`
Expected: PASS, 2 tests

- [ ] **Step 5: Commit**

```bash
git add src/domain/todo.ts tests/unit/domain/todo.test.ts
git commit -m "feat: todo domain type"
```

---

## Task 2: TodoStore Pure CRUD

**Files:**
- Create: `src/systems/todoStore.ts`
- Test: `tests/unit/systems/todoStore.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// tests/unit/systems/todoStore.test.ts
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
```

- [ ] **Step 2: Run, expect FAIL**

Run: `npm run test:run -- todoStore.test`
Expected: FAIL (module not found)

- [ ] **Step 3: Implement**

```ts
// src/systems/todoStore.ts
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
```

- [ ] **Step 4: Run, expect PASS**

Run: `npm run test:run -- todoStore.test`
Expected: PASS, 5 tests

- [ ] **Step 5: Commit**

```bash
git add src/systems/todoStore.ts tests/unit/systems/todoStore.test.ts
git commit -m "feat: todo store pure CRUD operations"
```

---

## Task 3: TodoStore Persistence

**Files:**
- Modify: `src/systems/todoStore.ts`
- Modify: `src/config.ts` (add `TODO_STORAGE_KEY`)
- Test: `tests/unit/systems/todoStore.test.ts` (extend)

- [ ] **Step 1: Add storage key to config**

Open `src/config.ts`, append:

```ts
export const TODO_STORAGE_KEY = 'village-todos';
```

- [ ] **Step 2: Write failing tests**

Append to `tests/unit/systems/todoStore.test.ts`:

```ts
import { loadTodos, saveTodos } from '../../../src/systems/todoStore';

describe('todoStore persistence', () => {
  beforeEach(() => localStorage.clear());

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
```

Add `beforeEach` import at top:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
```

- [ ] **Step 3: Run, expect FAIL**

Run: `npm run test:run -- todoStore.test`
Expected: FAIL ("loadTodos is not a function")

- [ ] **Step 4: Implement persistence**

Append to `src/systems/todoStore.ts`:

```ts
import { TODO_STORAGE_KEY } from '../config';

export function loadTodos(): readonly Todo[] {
  const raw = localStorage.getItem(TODO_STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as Todo[];
    if (!Array.isArray(parsed)) return [];
    return parsed;
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
```

- [ ] **Step 5: Run, expect PASS**

Run: `npm run test:run -- todoStore.test`
Expected: PASS, 8 tests

- [ ] **Step 6: Commit**

```bash
git add src/systems/todoStore.ts src/config.ts tests/unit/systems/todoStore.test.ts
git commit -m "feat: todo store localStorage persistence"
```

---

## Task 4: GameState Motivation Field

**Files:**
- Modify: `src/domain/state.ts`
- Modify: `src/systems/save.ts`
- Test: `tests/unit/domain/state.test.ts` (create or extend)
- Test: `tests/unit/systems/save.test.ts` (create or extend)

- [ ] **Step 1: Write failing state test**

Create `tests/unit/domain/state.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { emptyState } from '../../../src/domain/state';

describe('emptyState', () => {
  it('initializes motivation to 0', () => {
    const s = emptyState(1, 42);
    expect(s.motivation).toBe(0);
  });
});
```

- [ ] **Step 2: Run, expect FAIL**

Run: `npm run test:run -- state.test`
Expected: FAIL ("Property 'motivation' does not exist" — TS error during compile, or undefined at runtime)

- [ ] **Step 3: Add motivation to state**

In `src/domain/state.ts`:

Replace:
```ts
  readonly progression: {
    readonly day: number;
    readonly townHallLevel: number;
    readonly unlockedCards: readonly string[];
  };
};
```

With:
```ts
  readonly progression: {
    readonly day: number;
    readonly townHallLevel: number;
    readonly unlockedCards: readonly string[];
  };
  readonly motivation: number;
};
```

In `emptyState()` return, add `motivation: 0,` after `progression`:

```ts
  return {
    version: SAVE_VERSION,
    createdAt: now,
    lastSeenAt: now,
    lastActionDate: '',
    seed,
    world: { width: MAP_WIDTH, height: MAP_HEIGHT, tiles, buildings: [], crops: [], villagers: [] },
    progression: { day: 0, townHallLevel: 1, unlockedCards: [] },
    motivation: 0,
  };
```

- [ ] **Step 4: Run state test, expect PASS**

Run: `npm run test:run -- state.test`
Expected: PASS

- [ ] **Step 5: Write failing save migration test**

Create `tests/unit/systems/save.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { loadState, saveState } from '../../../src/systems/save';
import { emptyState } from '../../../src/domain/state';
import { SAVE_KEY, SAVE_VERSION } from '../../../src/config';

describe('save migration', () => {
  beforeEach(() => localStorage.clear());

  it('loads state and defaults motivation to 0 when missing', () => {
    const base = emptyState(1, 42);
    const { motivation: _drop, ...withoutMotivation } = base;
    localStorage.setItem(SAVE_KEY, JSON.stringify(withoutMotivation));
    const loaded = loadState();
    expect(loaded).not.toBeNull();
    expect(loaded!.motivation).toBe(0);
  });

  it('preserves motivation when present', () => {
    const s = { ...emptyState(1, 42), motivation: 5 };
    saveState(s);
    expect(loadState()!.motivation).toBe(5);
  });

  it('returns null on version mismatch', () => {
    localStorage.setItem(SAVE_KEY, JSON.stringify({ version: SAVE_VERSION - 1 }));
    expect(loadState()).toBeNull();
  });
});
```

- [ ] **Step 6: Run, expect FAIL** (first test fails: motivation undefined)

Run: `npm run test:run -- save.test`
Expected: FAIL on motivation default test

- [ ] **Step 7: Migration in save.ts**

Replace the contents of `src/systems/save.ts` with:

```ts
import { GameState } from '../domain/state';
import { SAVE_KEY, SAVE_VERSION } from '../config';

export function saveState(state: GameState): void {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error('saveState failed', e);
  }
}

export function loadState(): GameState | null {
  const raw = localStorage.getItem(SAVE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<GameState> & { version?: number };
    if (parsed.version !== SAVE_VERSION) {
      console.warn('save version mismatch; ignoring');
      return null;
    }
    return {
      ...(parsed as GameState),
      motivation: typeof parsed.motivation === 'number' ? parsed.motivation : 0,
    };
  } catch (e) {
    console.error('loadState failed', e);
    return null;
  }
}

export function clearSave(): void {
  localStorage.removeItem(SAVE_KEY);
}
```

- [ ] **Step 8: Run, expect PASS**

Run: `npm run test:run -- save.test`
Expected: PASS, 3 tests

- [ ] **Step 9: Run full suite to catch regressions**

Run: `npm run test:run`
Expected: all green

- [ ] **Step 10: Commit**

```bash
git add src/domain/state.ts src/systems/save.ts tests/unit/domain/state.test.ts tests/unit/systems/save.test.ts
git commit -m "feat: motivation field on GameState + migration"
```

---

## Task 5: drawCards Motivation Boost + Reset on Pick

**Files:**
- Modify: `src/systems/dailyAction.ts`
- Modify: `src/config.ts` (add `MOTIVATION_CARDS_DIV`, `MOTIVATION_BONUS_CAP`, `BASE_CARDS_DRAWN`)
- Test: `tests/unit/systems/dailyAction.test.ts` (extend or create)

- [ ] **Step 1: Add constants**

Append to `src/config.ts`:

```ts
export const BASE_CARDS_DRAWN = 3;
export const MOTIVATION_CARDS_DIV = 3;
export const MOTIVATION_BONUS_CAP = 2;
```

- [ ] **Step 2: Write failing tests**

Create or extend `tests/unit/systems/dailyAction.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { drawCards, applyChosenCard } from '../../../src/systems/dailyAction';
import { initWorld } from '../../../src/systems/init';
import { ALL_CARDS } from '../../../src/cards/deck';

const NOW = 1700000000000;

describe('drawCards motivation', () => {
  it('returns 3 cards when motivation = 0', () => {
    const s = { ...initWorld(NOW, 1), motivation: 0 };
    expect(drawCards(s, NOW).length).toBeLessThanOrEqual(3);
    if (ALL_CARDS.length >= 3) expect(drawCards(s, NOW).length).toBe(3);
  });

  it('returns 4 cards when motivation = 3', () => {
    const s = { ...initWorld(NOW, 1), motivation: 3 };
    if (ALL_CARDS.length >= 4) expect(drawCards(s, NOW).length).toBe(4);
  });

  it('returns 5 cards (cap) when motivation = 99', () => {
    const s = { ...initWorld(NOW, 1), motivation: 99 };
    if (ALL_CARDS.length >= 5) expect(drawCards(s, NOW).length).toBe(5);
  });
});

describe('applyChosenCard resets motivation', () => {
  it('motivation becomes 0 after picking', () => {
    const base = initWorld(NOW, 1);
    const s = { ...base, motivation: 4 };
    const cards = drawCards(s, NOW);
    if (cards.length === 0) return;
    const next = applyChosenCard(s, cards[0]!.id, NOW);
    expect(next.motivation).toBe(0);
  });
});
```

- [ ] **Step 3: Run, expect FAIL**

Run: `npm run test:run -- dailyAction.test`
Expected: FAIL (counts wrong; reset missing)

- [ ] **Step 4: Update drawCards and applyChosenCard**

In `src/systems/dailyAction.ts`:

Add import:
```ts
import { BASE_CARDS_DRAWN, MOTIVATION_CARDS_DIV, MOTIVATION_BONUS_CAP, DAY_START_HOUR } from '../config';
```

(Remove duplicate `DAY_START_HOUR` import if any.)

Replace the `drawCards` body:

```ts
export function drawCards(state: GameState, now: number): readonly ActionCard[] {
  const pool = ALL_CARDS.filter(
    (c) => c.minTier <= state.progression.townHallLevel && c.isAvailable(state),
  );
  if (pool.length === 0) return [];
  const bonus = Math.min(MOTIVATION_BONUS_CAP, Math.floor(state.motivation / MOTIVATION_CARDS_DIV));
  const target = BASE_CARDS_DRAWN + bonus;
  const rng = createRng((state.seed ^ Math.floor(now / 1000)) >>> 0);
  const picked: ActionCard[] = [];
  const remaining = [...pool];
  while (picked.length < target && remaining.length > 0) {
    const weights = remaining.map((c) => pondWeight(c, state));
    const total = weights.reduce((a, b) => a + b, 0);
    let r = rng() * total;
    let idx = 0;
    for (let i = 0; i < remaining.length; i++) {
      r -= weights[i]!;
      if (r <= 0) {
        idx = i;
        break;
      }
    }
    picked.push(remaining[idx]!);
    remaining.splice(idx, 1);
  }
  void rngInt;
  return picked;
}
```

Replace `applyChosenCard`:

```ts
export function applyChosenCard(state: GameState, cardId: string, now: number): GameState {
  const card = cardById(cardId);
  const after = card.effect(state, now);
  return { ...after, lastActionDate: dateKey(now), lastSeenAt: now, motivation: 0 };
}
```

- [ ] **Step 5: Run, expect PASS**

Run: `npm run test:run -- dailyAction.test`
Expected: PASS

- [ ] **Step 6: Run full suite**

Run: `npm run test:run`
Expected: all green

- [ ] **Step 7: Commit**

```bash
git add src/systems/dailyAction.ts src/config.ts tests/unit/systems/dailyAction.test.ts
git commit -m "feat: motivation-driven card draw count + reset on pick"
```

---

## Task 6: TodoSidebar DOM Component (render + create + delete)

**Files:**
- Create: `src/ui/TodoSidebar.ts`
- Test: `tests/unit/ui/TodoSidebar.test.ts`

- [ ] **Step 1: Write failing test**

Create `tests/unit/ui/TodoSidebar.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TodoSidebar } from '../../../src/ui/TodoSidebar';
import { newTodo } from '../../../src/domain/todo';

function makeContainer(): HTMLElement {
  const el = document.createElement('div');
  document.body.appendChild(el);
  return el;
}

describe('TodoSidebar render', () => {
  beforeEach(() => { document.body.innerHTML = ''; });

  it('renders empty list with input and add button', () => {
    const sb = new TodoSidebar(makeContainer(), { onAdd: vi.fn(), onToggle: vi.fn(), onEdit: vi.fn(), onDelete: vi.fn() });
    sb.render([]);
    expect(document.querySelector('.todo-sidebar input.todo-input')).not.toBeNull();
    expect(document.querySelector('.todo-sidebar button.todo-add')).not.toBeNull();
    expect(document.querySelectorAll('.todo-sidebar .todo-item').length).toBe(0);
  });

  it('renders one item per todo, marks done', () => {
    const sb = new TodoSidebar(makeContainer(), { onAdd: vi.fn(), onToggle: vi.fn(), onEdit: vi.fn(), onDelete: vi.fn() });
    const a = newTodo('a', 1);
    const b = { ...newTodo('b', 2), done: true };
    sb.render([a, b]);
    const items = document.querySelectorAll('.todo-sidebar .todo-item');
    expect(items.length).toBe(2);
    expect(items[1]!.classList.contains('done')).toBe(true);
  });

  it('onAdd called when add button clicked with input value', () => {
    const onAdd = vi.fn();
    const sb = new TodoSidebar(makeContainer(), { onAdd, onToggle: vi.fn(), onEdit: vi.fn(), onDelete: vi.fn() });
    sb.render([]);
    const input = document.querySelector<HTMLInputElement>('.todo-sidebar input.todo-input')!;
    input.value = 'hello';
    document.querySelector<HTMLButtonElement>('.todo-sidebar button.todo-add')!.click();
    expect(onAdd).toHaveBeenCalledWith('hello');
  });

  it('onAdd not called when input empty', () => {
    const onAdd = vi.fn();
    const sb = new TodoSidebar(makeContainer(), { onAdd, onToggle: vi.fn(), onEdit: vi.fn(), onDelete: vi.fn() });
    sb.render([]);
    document.querySelector<HTMLButtonElement>('.todo-sidebar button.todo-add')!.click();
    expect(onAdd).not.toHaveBeenCalled();
  });

  it('onDelete called with id when × clicked', () => {
    const onDelete = vi.fn();
    const sb = new TodoSidebar(makeContainer(), { onAdd: vi.fn(), onToggle: vi.fn(), onEdit: vi.fn(), onDelete });
    const a = newTodo('a', 1);
    sb.render([a]);
    document.querySelector<HTMLButtonElement>('.todo-sidebar .todo-delete')!.click();
    expect(onDelete).toHaveBeenCalledWith(a.id);
  });
});
```

- [ ] **Step 2: Run, expect FAIL**

Run: `npm run test:run -- TodoSidebar.test`
Expected: FAIL (module not found)

- [ ] **Step 3: Implement TodoSidebar**

Create `src/ui/TodoSidebar.ts`:

```ts
import { Todo } from '../domain/todo';

export type TodoSidebarCallbacks = {
  onAdd: (text: string) => void;
  onToggle: (id: string) => void;
  onEdit: (id: string, text: string) => void;
  onDelete: (id: string) => void;
};

export class TodoSidebar {
  private root: HTMLElement;
  private list!: HTMLUListElement;
  private input!: HTMLInputElement;

  constructor(container: HTMLElement, private cb: TodoSidebarCallbacks) {
    this.root = document.createElement('div');
    this.root.className = 'todo-sidebar';
    container.appendChild(this.root);
    this.buildShell();
  }

  private buildShell(): void {
    const header = document.createElement('div');
    header.className = 'todo-header';

    this.input = document.createElement('input');
    this.input.className = 'todo-input';
    this.input.type = 'text';
    this.input.placeholder = 'nouvelle tâche…';
    this.input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.submitAdd();
    });

    const addBtn = document.createElement('button');
    addBtn.className = 'todo-add';
    addBtn.textContent = '+';
    addBtn.addEventListener('click', () => this.submitAdd());

    header.appendChild(this.input);
    header.appendChild(addBtn);

    this.list = document.createElement('ul');
    this.list.className = 'todo-list';

    this.root.appendChild(header);
    this.root.appendChild(this.list);
  }

  private submitAdd(): void {
    const text = this.input.value.trim();
    if (text.length === 0) return;
    this.cb.onAdd(text);
    this.input.value = '';
  }

  render(todos: readonly Todo[]): void {
    this.list.innerHTML = '';
    for (const t of todos) {
      const li = document.createElement('li');
      li.className = 'todo-item' + (t.done ? ' done' : '');
      li.dataset.id = t.id;

      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.className = 'todo-check';
      cb.checked = t.done;
      cb.addEventListener('change', () => this.cb.onToggle(t.id));

      const label = document.createElement('span');
      label.className = 'todo-label';
      label.textContent = t.text;

      const del = document.createElement('button');
      del.className = 'todo-delete';
      del.textContent = '×';
      del.addEventListener('click', () => this.cb.onDelete(t.id));

      li.appendChild(cb);
      li.appendChild(label);
      li.appendChild(del);
      this.list.appendChild(li);
    }
  }
}
```

- [ ] **Step 4: Run, expect PASS**

Run: `npm run test:run -- TodoSidebar.test`
Expected: PASS, 5 tests

- [ ] **Step 5: Commit**

```bash
git add src/ui/TodoSidebar.ts tests/unit/ui/TodoSidebar.test.ts
git commit -m "feat: TodoSidebar DOM component with add/render/delete"
```

---

## Task 7: TodoSidebar Toggle Callback + Inline Edit

**Files:**
- Modify: `src/ui/TodoSidebar.ts`
- Modify: `tests/unit/ui/TodoSidebar.test.ts`

- [ ] **Step 1: Write failing tests**

Append to `tests/unit/ui/TodoSidebar.test.ts`:

```ts
describe('TodoSidebar toggle + edit', () => {
  beforeEach(() => { document.body.innerHTML = ''; });

  it('onToggle called with id when checkbox changes', () => {
    const onToggle = vi.fn();
    const sb = new TodoSidebar(makeContainer(), { onAdd: vi.fn(), onToggle, onEdit: vi.fn(), onDelete: vi.fn() });
    const a = newTodo('a', 1);
    sb.render([a]);
    const cb = document.querySelector<HTMLInputElement>('.todo-sidebar .todo-check')!;
    cb.checked = true;
    cb.dispatchEvent(new Event('change'));
    expect(onToggle).toHaveBeenCalledWith(a.id);
  });

  it('double-click label swaps to input; Enter calls onEdit with new text', () => {
    const onEdit = vi.fn();
    const sb = new TodoSidebar(makeContainer(), { onAdd: vi.fn(), onToggle: vi.fn(), onEdit, onDelete: vi.fn() });
    const a = newTodo('a', 1);
    sb.render([a]);
    const label = document.querySelector<HTMLSpanElement>('.todo-sidebar .todo-label')!;
    label.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    const editInput = document.querySelector<HTMLInputElement>('.todo-sidebar .todo-edit')!;
    expect(editInput).not.toBeNull();
    editInput.value = 'updated';
    editInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(onEdit).toHaveBeenCalledWith(a.id, 'updated');
  });

  it('Escape cancels edit without calling onEdit', () => {
    const onEdit = vi.fn();
    const sb = new TodoSidebar(makeContainer(), { onAdd: vi.fn(), onToggle: vi.fn(), onEdit, onDelete: vi.fn() });
    const a = newTodo('a', 1);
    sb.render([a]);
    document.querySelector<HTMLSpanElement>('.todo-sidebar .todo-label')!
      .dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    const editInput = document.querySelector<HTMLInputElement>('.todo-sidebar .todo-edit')!;
    editInput.value = 'updated';
    editInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(onEdit).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run, expect FAIL**

Run: `npm run test:run -- TodoSidebar.test`
Expected: FAIL (edit input missing)

- [ ] **Step 3: Add inline edit in render()**

In `src/ui/TodoSidebar.ts`, inside `render()`, replace the `label` creation block with:

```ts
      const label = document.createElement('span');
      label.className = 'todo-label';
      label.textContent = t.text;
      label.addEventListener('dblclick', () => {
        const edit = document.createElement('input');
        edit.type = 'text';
        edit.className = 'todo-edit';
        edit.value = t.text;
        const finish = (commit: boolean): void => {
          if (commit) {
            const val = edit.value.trim();
            if (val.length > 0 && val !== t.text) this.cb.onEdit(t.id, val);
          }
          edit.replaceWith(label);
        };
        edit.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') finish(true);
          else if (e.key === 'Escape') finish(false);
        });
        edit.addEventListener('blur', () => finish(true));
        label.replaceWith(edit);
        edit.focus();
        edit.select();
      });
```

- [ ] **Step 4: Run, expect PASS**

Run: `npm run test:run -- TodoSidebar.test`
Expected: PASS, 8 tests total

- [ ] **Step 5: Commit**

```bash
git add src/ui/TodoSidebar.ts tests/unit/ui/TodoSidebar.test.ts
git commit -m "feat: TodoSidebar inline edit + toggle callback"
```

---

## Task 8: Layout 30/70 Split

**Files:**
- Modify: `index.html`
- Modify: `src/main.ts`

- [ ] **Step 1: Update index.html**

Replace contents of `index.html` with:

```html
<!doctype html>
<html lang="fr">
  <head>
    <meta charset="UTF-8" />
    <title>Village Sim</title>
    <style>
      html, body { margin: 0; padding: 0; background: #000; overflow: hidden; height: 100%; }
      #app { display: flex; width: 100vw; height: 100vh; }
      #todo-pane { flex: 0 0 30%; min-width: 280px; background: #16181d; color: #f0f0f0; overflow-y: auto; border-right: 1px solid #2a2d34; }
      #game { flex: 1 1 auto; min-width: 0; }
      .todo-sidebar { display: flex; flex-direction: column; height: 100%; padding: 12px; box-sizing: border-box; font-family: system-ui, sans-serif; }
      .todo-header { display: flex; gap: 6px; margin-bottom: 10px; }
      .todo-input { flex: 1; padding: 6px 8px; background: #0e1014; color: #f0f0f0; border: 1px solid #2a2d34; border-radius: 4px; font-size: 14px; }
      .todo-add { width: 32px; background: #2d6a4f; color: #fff; border: none; border-radius: 4px; font-size: 18px; cursor: pointer; }
      .todo-add:hover { background: #38875e; }
      .todo-list { list-style: none; margin: 0; padding: 0; flex: 1; overflow-y: auto; }
      .todo-item { display: flex; align-items: center; gap: 8px; padding: 6px 4px; border-bottom: 1px solid #1f2128; }
      .todo-item.done .todo-label { text-decoration: line-through; opacity: 0.5; }
      .todo-label { flex: 1; cursor: text; user-select: none; font-size: 14px; }
      .todo-edit { flex: 1; padding: 4px 6px; background: #0e1014; color: #f0f0f0; border: 1px solid #38875e; border-radius: 3px; font-size: 14px; font-family: inherit; }
      .todo-delete { background: transparent; color: #888; border: none; cursor: pointer; font-size: 18px; padding: 0 4px; }
      .todo-delete:hover { color: #ff5555; }
      .todo-check { cursor: pointer; }
    </style>
  </head>
  <body>
    <div id="app">
      <div id="todo-pane"></div>
      <div id="game"></div>
    </div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

- [ ] **Step 2: Update Phaser config for resize**

In `src/main.ts`, replace `scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },` with:

```ts
  scale: { mode: Phaser.Scale.RESIZE, autoCenter: Phaser.Scale.CENTER_BOTH, parent: 'game' },
```

Also remove the fixed `width`/`height` (`RESIZE` mode uses parent size). Replace:

```ts
  width: 1024,
  height: 1024,
```

with nothing (delete those two lines). The full config block becomes:

```ts
const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game',
  pixelArt: true,
  backgroundColor: '#1a1a1a',
  scale: { mode: Phaser.Scale.RESIZE, autoCenter: Phaser.Scale.CENTER_BOTH, parent: 'game' },
  scene: [BootScene, WorldScene, UIScene],
};
```

- [ ] **Step 3: Run build to confirm TS OK**

Run: `npm run build`
Expected: build succeeds

- [ ] **Step 4: Commit**

```bash
git add index.html src/main.ts
git commit -m "feat: 30/70 split layout for todo sidebar + Phaser canvas"
```

---

## Task 9: Wire Sidebar ↔ Store ↔ GameState ↔ Phaser

**Files:**
- Modify: `src/main.ts`

- [ ] **Step 1: Replace main.ts with wired version**

Replace contents of `src/main.ts` with:

```ts
import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { WorldScene } from './scenes/WorldScene';
import { UIScene } from './scenes/UIScene';
import { TodoSidebar } from './ui/TodoSidebar';
import {
  loadTodos,
  saveTodos,
  addTodo,
  toggleTodo,
  updateTodoText,
  deleteTodo,
} from './systems/todoStore';
import { newTodo } from './domain/todo';
import { loadState, saveState } from './systems/save';
import { Todo } from './domain/todo';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game',
  pixelArt: true,
  backgroundColor: '#1a1a1a',
  scale: { mode: Phaser.Scale.RESIZE, autoCenter: Phaser.Scale.CENTER_BOTH, parent: 'game' },
  scene: [BootScene, WorldScene, UIScene],
};

const game = new Phaser.Game(config);

document.addEventListener('visibilitychange', () => {
  if (document.hidden) game.loop.sleep();
  else game.loop.wake();
});

function bumpMotivation(delta: number): void {
  const state = loadState();
  if (!state) return;
  const next = { ...state, motivation: Math.max(0, state.motivation + delta) };
  saveState(next);
  const world = game.scene.getScene('WorldScene') as WorldScene | null;
  if (world) {
    world.registry.set('state', next);
  }
}

function emitTodoCompleted(): void {
  const world = game.scene.getScene('WorldScene') as WorldScene | null;
  if (world) world.events.emit('todo-completed');
}

const pane = document.getElementById('todo-pane')!;
let todos: readonly Todo[] = loadTodos();
const sidebar = new TodoSidebar(pane, {
  onAdd: (text) => {
    todos = addTodo(todos, newTodo(text, Date.now()));
    saveTodos(todos);
    sidebar.render(todos);
  },
  onToggle: (id) => {
    const result = toggleTodo(todos, id);
    todos = result.todos;
    saveTodos(todos);
    sidebar.render(todos);
    if (result.toggled) {
      if (result.toggled.to === true) {
        bumpMotivation(+1);
        emitTodoCompleted();
      } else {
        bumpMotivation(-1);
      }
    }
  },
  onEdit: (id, text) => {
    todos = updateTodoText(todos, id, text);
    saveTodos(todos);
    sidebar.render(todos);
  },
  onDelete: (id) => {
    todos = deleteTodo(todos, id);
    saveTodos(todos);
    sidebar.render(todos);
  },
});
sidebar.render(todos);
```

- [ ] **Step 2: Run build**

Run: `npm run build`
Expected: success

- [ ] **Step 3: Run test suite**

Run: `npm run test:run`
Expected: all green

- [ ] **Step 4: Commit**

```bash
git add src/main.ts
git commit -m "feat: wire TodoSidebar to store + GameState motivation"
```

---

## Task 10: WorldScene Villager Jump on Todo Completed

**Files:**
- Modify: `src/scenes/WorldScene.ts`

- [ ] **Step 1: Add event listener in create()**

In `src/scenes/WorldScene.ts`, at the end of the `create()` method (before the final `}`), add:

```ts
    this.events.on('todo-completed', () => this.celebrateRandomVillager());
```

- [ ] **Step 2: Add celebrate method**

Add this method to the `WorldScene` class (after `isDebugVisible`):

```ts
  private celebrateRandomVillager(): void {
    const sprites: Phaser.GameObjects.Image[] = [];
    for (const s of this.villagerSprites.values()) {
      if (s.visible) sprites.push(s);
    }
    if (sprites.length === 0) return;
    const sprite = sprites[Math.floor(Math.random() * sprites.length)]!;
    const baseY = sprite.y;
    this.tweens.add({
      targets: sprite,
      y: baseY - 8,
      duration: 200,
      yoyo: true,
      ease: 'Quad.easeOut',
      onComplete: () => { sprite.y = baseY; },
    });
  }
```

- [ ] **Step 3: Build to verify TS**

Run: `npm run build`
Expected: success

- [ ] **Step 4: Manual verify**

Run: `npm run dev`
- Open browser, add a todo, check it.
- Expected: a villager makes a small jump animation, motivation increments (verify via DevTools localStorage → village-state shows motivation: 1).

- [ ] **Step 5: Run full suite + lint**

Run: `npm run test:run && npm run build`
Expected: all green

- [ ] **Step 6: Commit**

```bash
git add src/scenes/WorldScene.ts
git commit -m "feat: villager jump animation on todo completion"
```

---

## Final Verification

- [ ] All tests pass: `npm run test:run`
- [ ] Build clean: `npm run build`
- [ ] Manual smoke test:
  - Add 3 todos
  - Check all 3 → motivation = 3 in localStorage
  - Open daily action at next available window → should see 4 cards instead of 3
  - Pick one → motivation back to 0
  - Reload page → todos persist, motivation 0
  - Decheck one → motivation stays 0 (clamped)
