# Todo — Section "Terminées" + Tri des tâches — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Séparer les tâches terminées dans une section repliable et permettre de trier les tâches actives (création / modification / alphabétique).

**Architecture:** Ajout d'un champ `updatedAt` au type `Todo`, nouveau module pur `todoSort`, helpers de partition et de persistance dans `todoStore`, refonte du rendu de `TodoSidebar` en deux sections. Le tri et l'état replié sont persistés en localStorage.

**Tech Stack:** TypeScript, Vitest (jsdom), Vite. Pas de nouvelle dépendance.

Spec : `docs/superpowers/specs/2026-05-20-todo-done-section-and-sort-design.md` — issue GitHub #4.

---

## File Structure

- `src/domain/todo.ts` — **Modify** : champ `updatedAt` sur `Todo`, `newTodo` le pose.
- `src/systems/todoSort.ts` — **Create** : type `SortMode` + fonction pure `sortTodos`.
- `src/systems/todoStore.ts` — **Modify** : `toggleTodo`/`updateTodoText` posent `updatedAt`, `partitionTodos`, migration dans `loadTodos`, helpers `loadSortMode`/`saveSortMode`/`loadDoneCollapsed`/`saveDoneCollapsed`.
- `src/config.ts` — **Modify** : 2 clés localStorage.
- `src/ui/TodoSidebar.ts` — **Modify** : `<select>` de tri, section terminées repliable, callbacks `onSortChange`/`onCollapseChange`.
- `src/main.ts` — **Modify** : câblage (passe `Date.now()`, charge/sauve tri + repli).
- `index.html` — **Modify** : styles CSS.
- `tests/unit/systems/todoSort.test.ts` — **Create**.
- `tests/unit/systems/todoStore.test.ts` — **Modify** : adapte les appels existants + nouveaux tests.
- `tests/unit/ui/TodoSidebar.test.ts` — **Modify** : nouveaux tests tri + section.

---

## Task 1: Champ `updatedAt` sur `Todo`

**Files:**
- Modify: `src/domain/todo.ts`
- Modify: `tests/unit/systems/todoStore.test.ts` (test existant `addTodo appends` couvre déjà `newTodo`)

- [ ] **Step 1: Write the failing test**

Ajouter dans `tests/unit/systems/todoStore.test.ts`, dans le `describe('todoStore pure ops', ...)` :

```ts
  it('newTodo sets updatedAt equal to createdAt', () => {
    const t = newTodo('a', 42);
    expect(t.createdAt).toBe(42);
    expect(t.updatedAt).toBe(42);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/systems/todoStore.test.ts -t "newTodo sets updatedAt"`
Expected: FAIL — `updatedAt` n'existe pas sur le type / vaut `undefined`.

- [ ] **Step 3: Write minimal implementation**

Remplacer le contenu de `src/domain/todo.ts` par :

```ts
export type Todo = {
  readonly id: string;
  readonly text: string;
  readonly done: boolean;
  readonly createdAt: number;
  readonly updatedAt: number;
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
    updatedAt: now,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/systems/todoStore.test.ts -t "newTodo sets updatedAt"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/domain/todo.ts tests/unit/systems/todoStore.test.ts
git commit -m "feat(todo): add updatedAt field to Todo"
```

---

## Task 2: `toggleTodo` et `updateTodoText` posent `updatedAt`

`toggleTodo` et `updateTodoText` reçoivent un paramètre `now: number` et mettent à jour `updatedAt`. Les appels existants dans les tests doivent être adaptés.

**Files:**
- Modify: `src/systems/todoStore.ts:13-26`
- Modify: `tests/unit/systems/todoStore.test.ts`

- [ ] **Step 1: Write/adapt the failing tests**

Dans `tests/unit/systems/todoStore.test.ts`, remplacer les tests `toggleTodo` et `updateTodoText` existants par ces versions (les appels prennent désormais `now`) :

```ts
  it('toggleTodo flips done, updates updatedAt, returns toggled item', () => {
    const t = newTodo('a', 1);
    const { todos, toggled } = toggleTodo([t], t.id, 100);
    expect(todos[0]!.done).toBe(true);
    expect(todos[0]!.updatedAt).toBe(100);
    expect(toggled).toEqual({ from: false, to: true });
    const again = toggleTodo(todos, t.id, 200);
    expect(again.todos[0]!.done).toBe(false);
    expect(again.todos[0]!.updatedAt).toBe(200);
    expect(again.toggled).toEqual({ from: true, to: false });
  });

  it('toggleTodo with unknown id returns same list and null', () => {
    const t = newTodo('a', 1);
    const out = toggleTodo([t], 'nope', 100);
    expect(out.todos).toEqual([t]);
    expect(out.toggled).toBeNull();
  });

  it('updateTodoText replaces text trimmed, updates updatedAt, throws on empty', () => {
    const t = newTodo('a', 1);
    const out = updateTodoText([t], t.id, '  new  ', 100);
    expect(out[0]!.text).toBe('new');
    expect(out[0]!.updatedAt).toBe(100);
    expect(() => updateTodoText([t], t.id, '   ', 100)).toThrow();
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/unit/systems/todoStore.test.ts -t "toggleTodo flips"`
Expected: FAIL — `toggleTodo` ne prend pas de 3e argument / `updatedAt` non mis à jour.

- [ ] **Step 3: Write minimal implementation**

Dans `src/systems/todoStore.ts`, remplacer les fonctions `toggleTodo` et `updateTodoText` :

```ts
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/unit/systems/todoStore.test.ts`
Expected: PASS (tous les tests du fichier).

- [ ] **Step 5: Commit**

```bash
git add src/systems/todoStore.ts tests/unit/systems/todoStore.test.ts
git commit -m "feat(todo): toggle/edit update updatedAt"
```

---

## Task 3: `partitionTodos`

**Files:**
- Modify: `src/systems/todoStore.ts`
- Modify: `tests/unit/systems/todoStore.test.ts`

- [ ] **Step 1: Write the failing test**

Ajouter dans `tests/unit/systems/todoStore.test.ts`, dans le `describe('todoStore pure ops', ...)`, et compléter l'import en tête de fichier :

```ts
// import en tête : ajouter partitionTodos
// import { addTodo, toggleTodo, updateTodoText, deleteTodo, partitionTodos } from '../../../src/systems/todoStore';

  it('partitionTodos splits active and done preserving order', () => {
    const a = newTodo('a', 1);
    const b = { ...newTodo('b', 2), done: true };
    const c = newTodo('c', 3);
    const { active, done } = partitionTodos([a, b, c]);
    expect(active).toEqual([a, c]);
    expect(done).toEqual([b]);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/systems/todoStore.test.ts -t "partitionTodos"`
Expected: FAIL — `partitionTodos` n'est pas exporté.

- [ ] **Step 3: Write minimal implementation**

Ajouter dans `src/systems/todoStore.ts` (après `deleteTodo`) :

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/systems/todoStore.test.ts -t "partitionTodos"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/systems/todoStore.ts tests/unit/systems/todoStore.test.ts
git commit -m "feat(todo): add partitionTodos helper"
```

---

## Task 4: Migration `updatedAt` dans `loadTodos`

Les todos enregistrés avant cette feature n'ont pas de `updatedAt`. `loadTodos` doit le reconstruire à partir de `createdAt`.

**Files:**
- Modify: `src/systems/todoStore.ts:32-42`
- Modify: `tests/unit/systems/todoStore.test.ts`

- [ ] **Step 1: Write the failing test**

Ajouter dans `tests/unit/systems/todoStore.test.ts`, dans le `describe('todoStore persistence', ...)` :

```ts
  it('loadTodos backfills updatedAt for legacy todos', () => {
    const legacy = [{ id: 'x', text: 'old', done: false, createdAt: 55 }];
    localStorage.setItem('village-todos', JSON.stringify(legacy));
    const loaded = loadTodos();
    expect(loaded[0]!.updatedAt).toBe(55);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/systems/todoStore.test.ts -t "backfills updatedAt"`
Expected: FAIL — `updatedAt` vaut `undefined`.

- [ ] **Step 3: Write minimal implementation**

Dans `src/systems/todoStore.ts`, remplacer la fonction `loadTodos` :

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/systems/todoStore.test.ts`
Expected: PASS (tout le fichier, y compris le round-trip existant).

- [ ] **Step 5: Commit**

```bash
git add src/systems/todoStore.ts tests/unit/systems/todoStore.test.ts
git commit -m "feat(todo): backfill updatedAt on load (legacy migration)"
```

---

## Task 5: Module de tri `todoSort`

**Files:**
- Create: `src/systems/todoSort.ts`
- Create: `tests/unit/systems/todoSort.test.ts`

- [ ] **Step 1: Write the failing test**

Créer `tests/unit/systems/todoSort.test.ts` :

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/systems/todoSort.test.ts`
Expected: FAIL — module `todoSort` introuvable.

- [ ] **Step 3: Write minimal implementation**

Créer `src/systems/todoSort.ts` :

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/systems/todoSort.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/systems/todoSort.ts tests/unit/systems/todoSort.test.ts
git commit -m "feat(todo): add todoSort module"
```

---

## Task 6: Persistance tri + état replié

**Files:**
- Modify: `src/config.ts`
- Modify: `src/systems/todoStore.ts`
- Modify: `tests/unit/systems/todoStore.test.ts`

- [ ] **Step 1: Write the failing test**

Ajouter dans `tests/unit/systems/todoStore.test.ts` un nouveau `describe` à la fin du fichier, et compléter l'import de `todoStore` en tête avec `loadSortMode, saveSortMode, loadDoneCollapsed, saveDoneCollapsed` :

```ts
import {
  loadSortMode,
  saveSortMode,
  loadDoneCollapsed,
  saveDoneCollapsed,
} from '../../../src/systems/todoStore';

describe('todoStore sort + collapse persistence', () => {
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
      key: () => null,
    });
  });

  it('loadSortMode defaults to created', () => {
    expect(loadSortMode()).toBe('created');
  });

  it('saveSortMode + loadSortMode round-trip', () => {
    saveSortMode('alpha');
    expect(loadSortMode()).toBe('alpha');
  });

  it('loadSortMode returns created on unknown value', () => {
    localStorage.setItem('village-todo-sort', 'garbage');
    expect(loadSortMode()).toBe('created');
  });

  it('loadDoneCollapsed defaults to false', () => {
    expect(loadDoneCollapsed()).toBe(false);
  });

  it('saveDoneCollapsed + loadDoneCollapsed round-trip', () => {
    saveDoneCollapsed(true);
    expect(loadDoneCollapsed()).toBe(true);
    saveDoneCollapsed(false);
    expect(loadDoneCollapsed()).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/systems/todoStore.test.ts -t "sort + collapse"`
Expected: FAIL — fonctions non exportées.

- [ ] **Step 3: Write minimal implementation**

Dans `src/config.ts`, ajouter après `TODO_STORAGE_KEY` :

```ts
export const TODO_SORT_KEY = 'village-todo-sort';
export const TODO_DONE_COLLAPSED_KEY = 'village-todo-done-collapsed';
```

Dans `src/systems/todoStore.ts`, compléter les imports en tête et ajouter les helpers à la fin du fichier :

```ts
// En tête, remplacer la ligne d'import config par :
import {
  TODO_STORAGE_KEY,
  TODO_SORT_KEY,
  TODO_DONE_COLLAPSED_KEY,
} from '../config';
import { SortMode } from './todoSort';

// À la fin du fichier :
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/systems/todoStore.test.ts`
Expected: PASS (tout le fichier).

- [ ] **Step 5: Commit**

```bash
git add src/config.ts src/systems/todoStore.ts tests/unit/systems/todoStore.test.ts
git commit -m "feat(todo): persist sort mode and done-section collapse state"
```

---

## Task 7: Refonte `TodoSidebar` — tri + section terminées

Refonte complète de `TodoSidebar` : `<select>` de tri, deux sections (actives triées / terminées repliable), callbacks optionnels `onSortChange` et `onCollapseChange`. Les items sont créés par une méthode partagée `createItem`.

**Files:**
- Modify: `src/ui/TodoSidebar.ts` (réécriture complète)
- Modify: `tests/unit/ui/TodoSidebar.test.ts`

- [ ] **Step 1: Write the failing tests**

Ajouter à la fin de `tests/unit/ui/TodoSidebar.test.ts` :

```ts
describe('TodoSidebar sort + done section', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('renders a sort select with three options', () => {
    const sb = new TodoSidebar(makeContainer(), {
      onAdd: vi.fn(),
      onToggle: vi.fn(),
      onEdit: vi.fn(),
      onDelete: vi.fn(),
    });
    sb.render([]);
    const select = document.querySelector<HTMLSelectElement>('.todo-sidebar select.todo-sort')!;
    expect(select).not.toBeNull();
    expect(select.querySelectorAll('option').length).toBe(3);
  });

  it('select reflects the initial sort mode passed to constructor', () => {
    const sb = new TodoSidebar(
      makeContainer(),
      { onAdd: vi.fn(), onToggle: vi.fn(), onEdit: vi.fn(), onDelete: vi.fn() },
      'alpha',
    );
    sb.render([]);
    expect(document.querySelector<HTMLSelectElement>('.todo-sort')!.value).toBe('alpha');
  });

  it('onSortChange called when select changes', () => {
    const onSortChange = vi.fn();
    const sb = new TodoSidebar(makeContainer(), {
      onAdd: vi.fn(),
      onToggle: vi.fn(),
      onEdit: vi.fn(),
      onDelete: vi.fn(),
      onSortChange,
    });
    sb.render([]);
    const select = document.querySelector<HTMLSelectElement>('.todo-sort')!;
    select.value = 'modified';
    select.dispatchEvent(new Event('change'));
    expect(onSortChange).toHaveBeenCalledWith('modified');
  });

  it('active todos sorted by alpha when mode is alpha', () => {
    const sb = new TodoSidebar(
      makeContainer(),
      { onAdd: vi.fn(), onToggle: vi.fn(), onEdit: vi.fn(), onDelete: vi.fn() },
      'alpha',
    );
    sb.render([newTodo('banana', 1), newTodo('apple', 2)]);
    const labels = [...document.querySelectorAll('.todo-list .todo-label')].map(
      (el) => el.textContent,
    );
    expect(labels).toEqual(['apple', 'banana']);
  });

  it('done todos go into the done section with a count header', () => {
    const sb = new TodoSidebar(makeContainer(), {
      onAdd: vi.fn(),
      onToggle: vi.fn(),
      onEdit: vi.fn(),
      onDelete: vi.fn(),
    });
    const active = newTodo('todo', 1);
    const done = { ...newTodo('finished', 2), done: true };
    sb.render([active, done]);
    expect(document.querySelectorAll('.todo-done-list .todo-item').length).toBe(1);
    expect(document.querySelector('.todo-section-header')!.textContent).toContain('(1)');
  });

  it('clicking the done header toggles collapsed and calls onCollapseChange', () => {
    const onCollapseChange = vi.fn();
    const sb = new TodoSidebar(makeContainer(), {
      onAdd: vi.fn(),
      onToggle: vi.fn(),
      onEdit: vi.fn(),
      onDelete: vi.fn(),
      onCollapseChange,
    });
    sb.render([]);
    const section = document.querySelector('.todo-section')!;
    expect(section.classList.contains('collapsed')).toBe(false);
    document.querySelector<HTMLDivElement>('.todo-section-header')!.click();
    expect(section.classList.contains('collapsed')).toBe(true);
    expect(onCollapseChange).toHaveBeenCalledWith(true);
  });

  it('starts collapsed when initialCollapsed is true', () => {
    const sb = new TodoSidebar(
      makeContainer(),
      { onAdd: vi.fn(), onToggle: vi.fn(), onEdit: vi.fn(), onDelete: vi.fn() },
      'created',
      true,
    );
    sb.render([]);
    expect(document.querySelector('.todo-section')!.classList.contains('collapsed')).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/unit/ui/TodoSidebar.test.ts -t "sort + done section"`
Expected: FAIL — `.todo-sort` / `.todo-section` n'existent pas.

- [ ] **Step 3: Write the implementation**

Remplacer **tout** le contenu de `src/ui/TodoSidebar.ts` par :

```ts
import { Todo } from '../domain/todo';
import { SortMode, sortTodos } from '../systems/todoSort';
import { partitionTodos } from '../systems/todoStore';

export type TodoSidebarCallbacks = {
  onAdd: (text: string) => void;
  onToggle: (id: string) => void;
  onEdit: (id: string, text: string) => void;
  onDelete: (id: string) => void;
  onSortChange?: (mode: SortMode) => void;
  onCollapseChange?: (collapsed: boolean) => void;
};

const SORT_OPTIONS: readonly { value: SortMode; label: string }[] = [
  { value: 'created', label: 'Création' },
  { value: 'modified', label: 'Modification' },
  { value: 'alpha', label: 'Alphabétique' },
];

export class TodoSidebar {
  private root: HTMLElement;
  private list!: HTMLUListElement;
  private input!: HTMLInputElement;
  private sortSelect!: HTMLSelectElement;
  private doneSection!: HTMLDivElement;
  private doneHeader!: HTMLDivElement;
  private doneList!: HTMLUListElement;
  private sortMode: SortMode;
  private doneCollapsed: boolean;

  constructor(
    container: HTMLElement,
    private cb: TodoSidebarCallbacks,
    initialSort: SortMode = 'created',
    initialCollapsed = false,
  ) {
    this.sortMode = initialSort;
    this.doneCollapsed = initialCollapsed;
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

    const sortRow = document.createElement('div');
    sortRow.className = 'todo-sort-row';
    this.sortSelect = document.createElement('select');
    this.sortSelect.className = 'todo-sort';
    for (const { value, label } of SORT_OPTIONS) {
      const opt = document.createElement('option');
      opt.value = value;
      opt.textContent = label;
      this.sortSelect.appendChild(opt);
    }
    this.sortSelect.value = this.sortMode;
    this.sortSelect.addEventListener('change', () => {
      this.sortMode = this.sortSelect.value as SortMode;
      this.cb.onSortChange?.(this.sortMode);
    });
    sortRow.appendChild(this.sortSelect);

    this.list = document.createElement('ul');
    this.list.className = 'todo-list';

    this.doneSection = document.createElement('div');
    this.doneSection.className = 'todo-section';
    this.doneHeader = document.createElement('div');
    this.doneHeader.className = 'todo-section-header';
    this.doneHeader.addEventListener('click', () => {
      this.doneCollapsed = !this.doneCollapsed;
      this.applyCollapsed();
      this.cb.onCollapseChange?.(this.doneCollapsed);
    });
    this.doneList = document.createElement('ul');
    this.doneList.className = 'todo-list todo-done-list';
    this.doneSection.appendChild(this.doneHeader);
    this.doneSection.appendChild(this.doneList);

    this.root.appendChild(header);
    this.root.appendChild(sortRow);
    this.root.appendChild(this.list);
    this.root.appendChild(this.doneSection);
  }

  private applyCollapsed(): void {
    this.doneSection.classList.toggle('collapsed', this.doneCollapsed);
  }

  private submitAdd(): void {
    const text = this.input.value.trim();
    if (text.length === 0) return;
    this.cb.onAdd(text);
    this.input.value = '';
  }

  private createItem(t: Todo): HTMLLIElement {
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
    label.addEventListener('dblclick', () => {
      const edit = document.createElement('input');
      edit.type = 'text';
      edit.className = 'todo-edit';
      edit.value = t.text;
      let finished = false;
      const finish = (commit: boolean): void => {
        if (finished) return;
        finished = true;
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

    const del = document.createElement('button');
    del.className = 'todo-delete';
    del.textContent = '×';
    del.addEventListener('click', () => this.cb.onDelete(t.id));

    li.appendChild(cb);
    li.appendChild(label);
    li.appendChild(del);
    return li;
  }

  render(todos: readonly Todo[]): void {
    const { active, done } = partitionTodos(todos);
    const sortedActive = sortTodos(active, this.sortMode);
    const sortedDone = [...done].sort((a, b) => b.updatedAt - a.updatedAt);

    this.list.innerHTML = '';
    for (const t of sortedActive) this.list.appendChild(this.createItem(t));

    this.doneList.innerHTML = '';
    for (const t of sortedDone) this.doneList.appendChild(this.createItem(t));

    this.doneHeader.textContent = `${this.doneCollapsed ? '▸' : '▾'} Terminées (${sortedDone.length})`;
    this.applyCollapsed();
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/unit/ui/TodoSidebar.test.ts`
Expected: PASS — tous les tests, anciens et nouveaux. (Les anciens tests fonctionnent car l'ordre DOM est `liste active` puis `section terminées`.)

- [ ] **Step 5: Commit**

```bash
git add src/ui/TodoSidebar.ts tests/unit/ui/TodoSidebar.test.ts
git commit -m "feat(todo): sort select and collapsible done section in sidebar"
```

---

## Task 8: Câblage `main.ts`

`main.ts` n'a pas de test unitaire (glue d'intégration) — vérification par build + lancement.

**Files:**
- Modify: `src/main.ts:7-16` (imports), `src/main.ts:55-88` (câblage sidebar)

- [ ] **Step 1: Update imports**

Dans `src/main.ts`, remplacer le bloc d'import `./systems/todoStore` (lignes 7-14) :

```ts
import {
  loadTodos,
  saveTodos,
  addTodo,
  toggleTodo,
  updateTodoText,
  deleteTodo,
  loadSortMode,
  saveSortMode,
  loadDoneCollapsed,
  saveDoneCollapsed,
} from './systems/todoStore';
```

- [ ] **Step 2: Update sidebar wiring**

Dans `src/main.ts`, remplacer le bloc depuis `let todos: readonly Todo[] = loadTodos();` jusqu'à `sidebar.render(todos);` inclus par :

```ts
let todos: readonly Todo[] = loadTodos();
const sidebar = new TodoSidebar(
  pane,
  {
    onAdd: (text) => {
      todos = addTodo(todos, newTodo(text, Date.now()));
      saveTodos(todos);
      sidebar.render(todos);
    },
    onToggle: (id) => {
      const result = toggleTodo(todos, id, Date.now());
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
      todos = updateTodoText(todos, id, text, Date.now());
      saveTodos(todos);
      sidebar.render(todos);
    },
    onDelete: (id) => {
      todos = deleteTodo(todos, id);
      saveTodos(todos);
      sidebar.render(todos);
    },
    onSortChange: (mode) => {
      saveSortMode(mode);
      sidebar.render(todos);
    },
    onCollapseChange: (collapsed) => {
      saveDoneCollapsed(collapsed);
    },
  },
  loadSortMode(),
  loadDoneCollapsed(),
);
sidebar.render(todos);
```

- [ ] **Step 3: Verify the build**

Run: `npm run build`
Expected: build Vite réussi, aucune erreur TypeScript.

- [ ] **Step 4: Run the full test suite**

Run: `npm run test:run`
Expected: tous les tests verts.

- [ ] **Step 5: Commit**

```bash
git add src/main.ts
git commit -m "feat(todo): wire sort and done-section persistence in main"
```

---

## Task 9: Styles CSS

**Files:**
- Modify: `index.html` (bloc `<style>`, après les règles `.todo-*` existantes)

- [ ] **Step 1: Add CSS rules**

Dans `index.html`, juste après la ligne `.todo-check { cursor: pointer; }`, ajouter :

```css
      .todo-sort-row { margin-bottom: 8px; }
      .todo-sort { width: 100%; padding: 5px 8px; background: #0e1014; color: #f0f0f0; border: 1px solid #2a2d34; border-radius: 4px; font-size: 13px; font-family: inherit; cursor: pointer; }
      .todo-section { margin-top: 8px; flex: 0 0 auto; }
      .todo-section-header { padding: 6px 4px; font-size: 13px; color: #888; cursor: pointer; user-select: none; border-top: 1px solid #1f2128; }
      .todo-section-header:hover { color: #f0f0f0; }
      .todo-done-list { flex: 0 0 auto; }
      .todo-section.collapsed .todo-done-list { display: none; }
```

- [ ] **Step 2: Verify the build**

Run: `npm run build`
Expected: build réussi.

- [ ] **Step 3: Manual visual check**

Run: `npm run dev` puis ouvrir http://localhost:5173.
Expected :
- Un `<select>` de tri sous l'input.
- Ajouter des tâches, en cocher → elles passent sous l'en-tête « ▾ Terminées (N) ».
- Cliquer l'en-tête → la section se replie (« ▸ »), recharger → l'état est conservé.
- Changer le tri → l'ordre des tâches actives change, recharger → le tri est conservé.
- Éditer le texte d'une tâche, trier par Modification → elle remonte en tête.

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "feat(todo): styles for sort select and done section"
```

---

## Verification

End-to-end, après la Task 9 :

1. `npm run test:run` — toute la suite verte (todoSort, todoStore, TodoSidebar, + reste du projet).
2. `npm run lint` — aucune erreur.
3. `npm run build` — bundle produit sans erreur TypeScript.
4. `npm run dev` → http://localhost:5173 — exécuter le check manuel de la Task 9, Step 3.
5. Migration : conserver d'anciennes données todo en localStorage (sans `updatedAt`) → l'app se charge sans erreur, les anciennes tâches ont `updatedAt = createdAt`.
