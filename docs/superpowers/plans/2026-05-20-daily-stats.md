# Daily Stats Line Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Afficher sous l'horloge de la sidebar une ligne `3/5 faites aujourd'hui` où 3 = tâches cochées aujourd'hui et 5 = objectif quotidien modifiable.

**Architecture :** Une fonction pure `countDoneToday` calcule le numérateur. L'objectif est persisté dans localStorage via `todoStore.ts`. Un composant UI dédié `DailyStats`, monté sous l'horloge, lit todos et objectif via des getters et se redessine à la demande. `SidebarClock` n'est pas touché.

**Tech Stack :** TypeScript, Vitest (jsdom), Vite. Pas de framework UI — DOM natif, comme `SidebarClock` et `TodoSidebar`.

**Branche :** `feat/MH/daily-stats` (déjà créée, contient le spec doc).

**Spec :** `docs/superpowers/specs/2026-05-20-daily-stats-design.md`

## Structure des fichiers

| Fichier | Rôle | Action |
|---|---|---|
| `src/systems/dailyGoal.ts` | Logique pure : compter les tâches faites aujourd'hui | Créer |
| `src/config.ts` | Clé localStorage + bornes de l'objectif | Modifier |
| `src/systems/todoStore.ts` | Persistance de l'objectif (`load`/`save`/`clamp`) | Modifier |
| `src/ui/DailyStats.ts` | Composant UI de la ligne de stats | Créer |
| `index.html` | Styles `.clock-stats` / `.clock-goal` | Modifier |
| `src/main.ts` | Câblage du composant | Modifier |
| `tests/unit/systems/dailyGoal.test.ts` | Tests de `countDoneToday` | Créer |
| `tests/unit/systems/todoStore.test.ts` | Tests de persistance de l'objectif | Modifier |
| `tests/unit/ui/DailyStats.test.ts` | Tests du composant | Créer |

---

### Task 1: `countDoneToday` — fonction pure

**Files:**
- Create: `src/systems/dailyGoal.ts`
- Test: `tests/unit/systems/dailyGoal.test.ts`

- [ ] **Step 1: Écrire le test qui échoue**

Créer `tests/unit/systems/dailyGoal.test.ts` :

```ts
import { describe, it, expect } from 'vitest';
import { countDoneToday } from '../../../src/systems/dailyGoal';
import { newTodo } from '../../../src/domain/todo';

const NOON = new Date(2026, 4, 20, 12, 0, 0).getTime();
const YESTERDAY_NOON = new Date(2026, 4, 19, 12, 0, 0).getTime();

describe('countDoneToday', () => {
  it('counts a todo done today', () => {
    const t = { ...newTodo('a', NOON), done: true, updatedAt: NOON };
    expect(countDoneToday([t], NOON)).toBe(1);
  });

  it('ignores a todo done yesterday', () => {
    const t = { ...newTodo('a', YESTERDAY_NOON), done: true, updatedAt: YESTERDAY_NOON };
    expect(countDoneToday([t], NOON)).toBe(0);
  });

  it('ignores a todo not done', () => {
    const t = { ...newTodo('a', NOON), done: false, updatedAt: NOON };
    expect(countDoneToday([t], NOON)).toBe(0);
  });

  it('returns 0 for an empty list', () => {
    expect(countDoneToday([], NOON)).toBe(0);
  });

  it('counts only today across a mixed list', () => {
    const todayDone = { ...newTodo('a', NOON), done: true, updatedAt: NOON };
    const ydayDone = { ...newTodo('b', YESTERDAY_NOON), done: true, updatedAt: YESTERDAY_NOON };
    const todayOpen = { ...newTodo('c', NOON), done: false, updatedAt: NOON };
    expect(countDoneToday([todayDone, ydayDone, todayOpen], NOON)).toBe(1);
  });

  it('handles the midnight boundary by local day', () => {
    const beforeMidnight = new Date(2026, 4, 20, 23, 59, 59).getTime();
    const afterMidnight = new Date(2026, 4, 20, 0, 0, 1).getTime();
    const t1 = { ...newTodo('a', beforeMidnight), done: true, updatedAt: beforeMidnight };
    const t2 = { ...newTodo('b', afterMidnight), done: true, updatedAt: afterMidnight };
    expect(countDoneToday([t1, t2], NOON)).toBe(2);
  });
});
```

- [ ] **Step 2: Lancer le test pour vérifier l'échec**

Run: `npx vitest run tests/unit/systems/dailyGoal.test.ts`
Expected: FAIL — `Failed to resolve import "../../../src/systems/dailyGoal"`.

- [ ] **Step 3: Écrire l'implémentation minimale**

Créer `src/systems/dailyGoal.ts` :

```ts
import { Todo } from '../domain/todo';
import { daysBetween } from './clock';

export function countDoneToday(todos: readonly Todo[], now: number): number {
  let count = 0;
  for (const t of todos) {
    if (t.done && daysBetween(t.updatedAt, now) === 0) count += 1;
  }
  return count;
}
```

- [ ] **Step 4: Lancer le test pour vérifier le succès**

Run: `npx vitest run tests/unit/systems/dailyGoal.test.ts`
Expected: PASS — 6 tests.

- [ ] **Step 5: Commit**

```bash
git add src/systems/dailyGoal.ts tests/unit/systems/dailyGoal.test.ts
git commit -m "feat(todo): add countDoneToday helper"
```

---

### Task 2: Persistance de l'objectif quotidien

**Files:**
- Modify: `src/config.ts` (ajout après la ligne `TODO_DONE_COLLAPSED_KEY`)
- Modify: `src/systems/todoStore.ts`
- Test: `tests/unit/systems/todoStore.test.ts` (ajout en fin de fichier)

- [ ] **Step 1: Écrire le test qui échoue**

Ajouter à la fin de `tests/unit/systems/todoStore.test.ts` :

```ts
import { loadDailyGoal, saveDailyGoal } from '../../../src/systems/todoStore';

describe('todoStore daily goal persistence', () => {
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

  it('loadDailyGoal defaults to 5', () => {
    expect(loadDailyGoal()).toBe(5);
  });

  it('saveDailyGoal + loadDailyGoal round-trip', () => {
    saveDailyGoal(8);
    expect(loadDailyGoal()).toBe(8);
  });

  it('saveDailyGoal clamps above max to 99', () => {
    saveDailyGoal(500);
    expect(loadDailyGoal()).toBe(99);
  });

  it('saveDailyGoal clamps below min to 1', () => {
    saveDailyGoal(0);
    expect(loadDailyGoal()).toBe(1);
  });

  it('loadDailyGoal returns 5 on non-numeric value', () => {
    localStorage.setItem('village-todo-daily-goal', 'garbage');
    expect(loadDailyGoal()).toBe(5);
  });
});
```

- [ ] **Step 2: Lancer le test pour vérifier l'échec**

Run: `npx vitest run tests/unit/systems/todoStore.test.ts`
Expected: FAIL — `loadDailyGoal` / `saveDailyGoal` not exported.

- [ ] **Step 3: Ajouter les constantes de config**

Dans `src/config.ts`, ajouter après la ligne `export const TODO_DONE_COLLAPSED_KEY = ...;` :

```ts
export const TODO_DAILY_GOAL_KEY = 'village-todo-daily-goal';
export const DAILY_GOAL_MIN = 1;
export const DAILY_GOAL_MAX = 99;
export const DAILY_GOAL_DEFAULT = 5;
```

- [ ] **Step 4: Implémenter la persistance dans `todoStore.ts`**

Dans `src/systems/todoStore.ts`, remplacer le bloc d'import du haut :

```ts
import {
  TODO_STORAGE_KEY,
  TODO_SORT_KEY,
  TODO_DONE_COLLAPSED_KEY,
} from '../config';
```

par :

```ts
import {
  TODO_STORAGE_KEY,
  TODO_SORT_KEY,
  TODO_DONE_COLLAPSED_KEY,
  TODO_DAILY_GOAL_KEY,
  DAILY_GOAL_MIN,
  DAILY_GOAL_MAX,
  DAILY_GOAL_DEFAULT,
} from '../config';
```

Puis ajouter à la fin du fichier :

```ts
export function clampDailyGoal(n: number): number {
  if (!Number.isFinite(n)) return DAILY_GOAL_DEFAULT;
  return Math.min(DAILY_GOAL_MAX, Math.max(DAILY_GOAL_MIN, Math.round(n)));
}

export function loadDailyGoal(): number {
  const raw = localStorage.getItem(TODO_DAILY_GOAL_KEY);
  if (raw == null) return DAILY_GOAL_DEFAULT;
  const n = Number(raw);
  if (!Number.isFinite(n)) return DAILY_GOAL_DEFAULT;
  return clampDailyGoal(n);
}

export function saveDailyGoal(goal: number): void {
  try {
    localStorage.setItem(TODO_DAILY_GOAL_KEY, String(clampDailyGoal(goal)));
  } catch (e) {
    console.error('saveDailyGoal failed', e);
  }
}
```

- [ ] **Step 5: Lancer le test pour vérifier le succès**

Run: `npx vitest run tests/unit/systems/todoStore.test.ts`
Expected: PASS — toute la suite passe, dont les 5 nouveaux tests.

- [ ] **Step 6: Commit**

```bash
git add src/config.ts src/systems/todoStore.ts tests/unit/systems/todoStore.test.ts
git commit -m "feat(todo): persist daily goal with clamping"
```

---

### Task 3: Composant `DailyStats`

**Files:**
- Create: `src/ui/DailyStats.ts`
- Test: `tests/unit/ui/DailyStats.test.ts`

- [ ] **Step 1: Écrire le test qui échoue**

Créer `tests/unit/ui/DailyStats.test.ts` :

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DailyStats } from '../../../src/ui/DailyStats';
import { newTodo } from '../../../src/domain/todo';
import type { Todo } from '../../../src/domain/todo';

function makeContainer(): HTMLElement {
  const el = document.createElement('div');
  document.body.appendChild(el);
  return el;
}

function doneNow(text: string): Todo {
  const now = Date.now();
  return { ...newTodo(text, now), done: true, updatedAt: now };
}

describe('DailyStats', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('renders count over goal with the goal in a clickable span', () => {
    const stats = new DailyStats(makeContainer(), () => [doneNow('a')], () => 5, vi.fn());
    const el = document.querySelector('.clock-stats')!;
    expect(el.textContent).toContain('1/5');
    expect(el.textContent).toContain('aujourd');
    expect(el.querySelector('.clock-goal')!.textContent).toBe('5');
    stats.destroy();
  });

  it('adds goal-reached class when count meets the goal', () => {
    const stats = new DailyStats(makeContainer(), () => [doneNow('a')], () => 1, vi.fn());
    expect(document.querySelector('.clock-stats')!.classList.contains('goal-reached')).toBe(true);
    stats.destroy();
  });

  it('does not add goal-reached class when count is below the goal', () => {
    const stats = new DailyStats(makeContainer(), () => [], () => 5, vi.fn());
    expect(document.querySelector('.clock-stats')!.classList.contains('goal-reached')).toBe(false);
    stats.destroy();
  });

  it('clicking the goal opens an inline number input', () => {
    const stats = new DailyStats(makeContainer(), () => [], () => 5, vi.fn());
    (document.querySelector('.clock-goal') as HTMLElement).click();
    const input = document.querySelector('input.clock-goal-edit') as HTMLInputElement;
    expect(input).not.toBeNull();
    expect(input.value).toBe('5');
    stats.destroy();
  });

  it('committing a new goal with Enter calls onGoalChange clamped', () => {
    const onGoalChange = vi.fn();
    const stats = new DailyStats(makeContainer(), () => [], () => 5, onGoalChange);
    (document.querySelector('.clock-goal') as HTMLElement).click();
    const input = document.querySelector('input.clock-goal-edit') as HTMLInputElement;
    input.value = '200';
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(onGoalChange).toHaveBeenCalledWith(99);
    stats.destroy();
  });

  it('Escape cancels the edit without calling onGoalChange', () => {
    const onGoalChange = vi.fn();
    const stats = new DailyStats(makeContainer(), () => [], () => 5, onGoalChange);
    (document.querySelector('.clock-goal') as HTMLElement).click();
    const input = document.querySelector('input.clock-goal-edit') as HTMLInputElement;
    input.value = '9';
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(onGoalChange).not.toHaveBeenCalled();
    expect(document.querySelector('.clock-goal')).not.toBeNull();
    stats.destroy();
  });

  it('render() reflects the current todos getter', () => {
    let todos: readonly Todo[] = [];
    const stats = new DailyStats(makeContainer(), () => todos, () => 5, vi.fn());
    expect(document.querySelector('.clock-stats')!.textContent).toContain('0/5');
    todos = [doneNow('a')];
    stats.render();
    expect(document.querySelector('.clock-stats')!.textContent).toContain('1/5');
    stats.destroy();
  });
});
```

- [ ] **Step 2: Lancer le test pour vérifier l'échec**

Run: `npx vitest run tests/unit/ui/DailyStats.test.ts`
Expected: FAIL — `Failed to resolve import "../../../src/ui/DailyStats"`.

- [ ] **Step 3: Écrire l'implémentation**

Créer `src/ui/DailyStats.ts` :

```ts
import { Todo } from '../domain/todo';
import { countDoneToday } from '../systems/dailyGoal';
import { clampDailyGoal } from '../systems/todoStore';

const ROLLOVER_INTERVAL_MS = 60_000;

export class DailyStats {
  private root: HTMLDivElement;
  private getTodos: () => readonly Todo[];
  private getGoal: () => number;
  private onGoalChange: (goal: number) => void;
  private timer: ReturnType<typeof setInterval>;

  constructor(
    container: HTMLElement,
    getTodos: () => readonly Todo[],
    getGoal: () => number,
    onGoalChange: (goal: number) => void,
  ) {
    this.getTodos = getTodos;
    this.getGoal = getGoal;
    this.onGoalChange = onGoalChange;

    this.root = document.createElement('div');
    this.root.className = 'clock-stats';
    container.appendChild(this.root);

    this.render();
    this.timer = setInterval(() => this.render(), ROLLOVER_INTERVAL_MS);
  }

  destroy(): void {
    clearInterval(this.timer);
  }

  render(): void {
    const done = countDoneToday(this.getTodos(), Date.now());
    const goal = this.getGoal();
    this.root.classList.toggle('goal-reached', done >= goal);

    this.root.textContent = '';
    this.root.append(`${done}/`);

    const goalSpan = document.createElement('span');
    goalSpan.className = 'clock-goal';
    goalSpan.textContent = String(goal);
    goalSpan.title = 'cliquer pour modifier l’objectif';
    goalSpan.addEventListener('click', () => this.openGoalEditor(goalSpan));
    this.root.appendChild(goalSpan);

    this.root.append(' faites aujourd’hui');
  }

  private openGoalEditor(goalSpan: HTMLSpanElement): void {
    const input = document.createElement('input');
    input.type = 'number';
    input.className = 'clock-goal-edit';
    input.value = String(this.getGoal());
    input.min = '1';
    input.max = '99';

    let finished = false;
    const finish = (commit: boolean): void => {
      if (finished) return;
      finished = true;
      if (commit) {
        const next = clampDailyGoal(Number(input.value));
        if (next !== this.getGoal()) {
          this.onGoalChange(next);
          return; // onGoalChange déclenche render() qui reconstruit la ligne
        }
      }
      input.replaceWith(goalSpan);
    };

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') finish(true);
      else if (e.key === 'Escape') finish(false);
    });
    input.addEventListener('blur', () => finish(true));

    goalSpan.replaceWith(input);
    input.focus();
    input.select();
  }
}
```

- [ ] **Step 4: Lancer le test pour vérifier le succès**

Run: `npx vitest run tests/unit/ui/DailyStats.test.ts`
Expected: PASS — 7 tests.

- [ ] **Step 5: Commit**

```bash
git add src/ui/DailyStats.ts tests/unit/ui/DailyStats.test.ts
git commit -m "feat(todo): add DailyStats component"
```

---

### Task 4: Styles CSS

**Files:**
- Modify: `index.html` (bloc `<style>`)

- [ ] **Step 1: Ajouter les règles CSS**

Dans `index.html`, juste après la ligne `.clock-meta { ... }`, ajouter :

```css
      .clock-stats { padding: 8px 16px; font-size: 12px; color: #8a8f99; text-align: center; border-bottom: 1px solid #2a2d34; }
      .clock-stats.goal-reached { color: #38875e; }
      .clock-goal { cursor: pointer; text-decoration: underline dotted; text-underline-offset: 2px; }
      .clock-goal:hover { color: #f0f0f0; }
      .clock-goal-edit { width: 42px; background: #0e1014; color: #f0f0f0; border: 1px solid #38875e; border-radius: 3px; font-size: 12px; font-family: inherit; text-align: center; }
```

- [ ] **Step 2: Commit**

```bash
git add index.html
git commit -m "feat(todo): styles for daily stats line"
```

---

### Task 5: Câblage dans `main.ts`

**Files:**
- Modify: `src/main.ts`

- [ ] **Step 1: Ajouter les imports**

Dans `src/main.ts`, remplacer le bloc d'import de `todoStore` :

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

par :

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
  loadDailyGoal,
  saveDailyGoal,
} from './systems/todoStore';
```

Puis ajouter après la ligne `import { SidebarClock } from './ui/SidebarClock';` :

```ts
import { DailyStats } from './ui/DailyStats';
```

- [ ] **Step 2: Instancier `DailyStats` et brancher les callbacks**

Dans `src/main.ts`, remplacer tout le bloc allant de `const pane = document.getElementById('todo-pane')!;` jusqu'à la fin du fichier (`sidebar.render(todos);`) par :

```ts
const pane = document.getElementById('todo-pane')!;
let todos: readonly Todo[] = loadTodos();
let dailyGoal = loadDailyGoal();

const stats = new DailyStats(
  clockMount,
  () => todos,
  () => dailyGoal,
  (n) => {
    dailyGoal = n;
    saveDailyGoal(n);
    stats.render();
  },
);

const sidebar = new TodoSidebar(
  pane,
  {
    onAdd: (text) => {
      todos = addTodo(todos, newTodo(text, Date.now()));
      saveTodos(todos);
      sidebar.render(todos);
      stats.render();
    },
    onToggle: (id) => {
      const result = toggleTodo(todos, id, Date.now());
      todos = result.todos;
      saveTodos(todos);
      sidebar.render(todos);
      stats.render();
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
      stats.render();
    },
    onDelete: (id) => {
      todos = deleteTodo(todos, id);
      saveTodos(todos);
      sidebar.render(todos);
      stats.render();
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

Note : `clockMount` est déjà défini plus haut dans le fichier (`const clockMount = document.getElementById('clock-mount')!;`). `DailyStats` ajoute son `<div>` dans `clockMount`, après le `.clock-bar` de l'horloge — la ligne apparaît donc sous l'horloge.

- [ ] **Step 3: Vérifier le build et le lint**

Run: `npm run build`
Expected: succès — `tsc --noEmit` sans erreur, build Vite OK.

Run: `npm run lint`
Expected: aucune erreur ESLint.

- [ ] **Step 4: Lancer toute la suite de tests**

Run: `npm run test:run`
Expected: PASS — toute la suite, dont `dailyGoal.test.ts`, `todoStore.test.ts`, `DailyStats.test.ts`.

- [ ] **Step 5: Vérification manuelle**

Run: `npm run dev`, ouvrir l'app.
Vérifier :
- La ligne `0/5 faites aujourd'hui` apparaît sous l'horloge.
- Cocher une tâche → le numérateur passe à `1/5` immédiatement.
- Atteindre l'objectif → la ligne passe en vert (`goal-reached`).
- Clic sur le `5` → champ numérique ; saisir `3`, Entrée → la ligne devient `.../3`.
- Recharger la page → l'objectif `3` est conservé.

- [ ] **Step 6: Commit**

```bash
git add src/main.ts
git commit -m "feat(todo): wire DailyStats under the sidebar clock"
```

---

## Self-Review

**Couverture du spec :**
- Ligne `n/objectif faites aujourd'hui` sous l'horloge → Task 3 + Task 5. ✓
- `countDoneToday` pure réutilisant `daysBetween` → Task 1. ✓
- `loadDailyGoal`/`saveDailyGoal`, clé `TODO_DAILY_GOAL_KEY`, bornes 1–99, défaut 5 → Task 2. ✓
- Composant `DailyStats` dédié, clic → champ inline, classe `goal-reached`, timer 60 s → Task 3. ✓
- Câblage `main.ts`, `stats.render()` dans chaque callback todo → Task 5. ✓
- Styles `.clock-stats` → Task 4. ✓
- Tests `countDoneToday` + persistance objectif → Task 1 + Task 2 ; tests composant ajoutés (Task 3) au-delà du spec, cohérents avec `TodoSidebar.test.ts`. ✓
- Cas limites (liste vide, hier, décochée, dépassement, minuit) → couverts par les tests Task 1 / Task 3. ✓

**Cohérence des types :** `countDoneToday(todos, now)` défini Task 1, appelé identiquement Task 3. `clampDailyGoal(n)` défini Task 2, appelé Task 3. `loadDailyGoal`/`saveDailyGoal` définis Task 2, importés Task 5. `DailyStats` constructeur `(container, getTodos, getGoal, onGoalChange)` défini Task 3, appelé identiquement Task 5.

**Placeholders :** aucun — chaque étape contient le code complet.
