# Todo — Section "Terminées" + Tri des tâches

Date : 2026-05-20

## Contexte

La sidebar todo affiche une liste plate de tâches. Les tâches cochées (`done`)
restent mélangées aux tâches actives, juste barrées. Avec l'usage, la liste se
remplit et devient difficile à scanner sur un second écran. Deux besoins :

1. **Séparer les tâches terminées** dans une section repliable dédiée, pour
   garder les tâches actives lisibles.
2. **Trier les tâches actives** par date de création, date de dernière
   modification, ou ordre alphabétique — actuellement l'ordre est figé
   (ordre d'ajout).

Résultat attendu : sidebar plus lisible, tâches terminées rangées hors du
champ visuel principal, contrôle de tri pour réorganiser les tâches actives.

## Décisions

- **Section terminées** : section repliable en bas de la sidebar. En-tête
  cliquable « Terminées (N) » avec chevron. État replié/déplié persisté.
  Dépliée par défaut.
- **Contrôle de tri** : menu déroulant `<select>` dans le header de la
  sidebar. 3 modes : Création / Modification / Alphabétique.
- **Portée du tri** : le tri s'applique **aux tâches actives uniquement**.
  La section terminées garde un ordre fixe.
- **Champ `updatedAt`** : ajouté au type `Todo`. Mis à jour lors d'une
  **édition de texte OU d'un cocher/décocher**.
- **Sens des tris** :
  - Création : plus ancienne en haut (chronologique).
  - Modification : plus récente en haut.
  - Alphabétique : A→Z (insensible à la casse).
  - Tri stable dans tous les cas.
- **Ordre section terminées** : par date de complétion, plus récente en haut
  (= `updatedAt` décroissant, puisque cocher met à jour `updatedAt`).
- **Persistance** : choix de tri et état replié/déplié sauvés en localStorage.
  Tri par défaut = Création.
- **Migration** : todos legacy sans `updatedAt` → `updatedAt = createdAt`.
  Aucune perte de partie.

## Architecture

### 1. Domaine — `src/domain/todo.ts`

Ajout du champ `updatedAt` au type `Todo` :

```ts
type Todo = {
  readonly id: string;
  readonly text: string;
  readonly done: boolean;
  readonly createdAt: number;
  readonly updatedAt: number;
};
```

`newTodo(text, now)` : pose `updatedAt = now` (= `createdAt`).

### 2. Tri — nouveau module `src/systems/todoSort.ts`

```ts
export type SortMode = 'created' | 'modified' | 'alpha';

export function sortTodos(
  todos: readonly Todo[],
  mode: SortMode,
): readonly Todo[];
```

Fonction pure : retourne une nouvelle liste, ne mute pas l'entrée. Tri stable.

- `created` : `createdAt` croissant.
- `modified` : `updatedAt` décroissant.
- `alpha` : `text` croissant, comparaison insensible à la casse
  (`localeCompare`).

### 3. Store — `src/systems/todoStore.ts`

- `toggleTodo` et `updateTodoText` : signature étendue avec `now: number`,
  posent `updatedAt = now` sur la tâche modifiée.
- `partitionTodos(todos)` → `{ active: Todo[], done: Todo[] }`.
- `loadTodos` : migration — tout todo sans `updatedAt` reçoit
  `updatedAt = createdAt`.
- Persistance tri/repli :
  - clés localStorage `village-todo-sort` et `village-todo-done-collapsed`
    (ajoutées à `src/config.ts`).
  - `loadSortMode()` / `saveSortMode(mode)` — défaut `'created'`, valide
    contre les 3 modes connus.
  - `loadDoneCollapsed()` / `saveDoneCollapsed(bool)` — défaut `false`.

### 4. UI — `src/ui/TodoSidebar.ts`

- Header : `<select class="todo-sort">` avec 3 `<option>` (Création /
  Modification / Alphabétique), à côté de l'input + bouton ajout.
- Nouveau callback `onSortChange(mode: SortMode)`.
- Le constructeur reçoit le `SortMode` initial et l'état `doneCollapsed`
  initial pour positionner le `<select>` et la section.
- `render(todos)` :
  1. `partitionTodos(todos)` → `active`, `done`.
  2. `active` triées via `sortTodos(active, currentMode)`.
  3. `done` triées par `updatedAt` décroissant.
  4. Rendu : liste active en haut.
  5. En-tête de section « Terminées (N) » cliquable + chevron ; bascule
     l'état replié, déclenche `onCollapseChange`, masque/affiche la liste
     des terminées.
- Nouveau callback `onCollapseChange(collapsed: boolean)`.

### 5. Wiring — `src/main.ts`

- Au boot : `loadSortMode()` et `loadDoneCollapsed()`, passés à `TodoSidebar`.
- `onAdd` / `onToggle` / `onEdit` : passent `Date.now()` aux fonctions store
  mises à jour.
- `onSortChange` → `saveSortMode(mode)` + `sidebar.render(todos)`.
- `onCollapseChange` → `saveDoneCollapsed(bool)`.

### 6. CSS — `index.html`

Nouveaux styles :
- `.todo-sort` — style du `<select>`, cohérent avec `.todo-input`.
- `.todo-section-header` — barre cliquable « Terminées (N) » + chevron.
- `.todo-section.collapsed` — masque la liste des terminées.

## Flux de données

```
localStorage ──loadTodos()──> todos (migration updatedAt)
                                │
            loadSortMode() ─────┤
        loadDoneCollapsed() ─────┘
                                ▼
                         TodoSidebar.render()
                                │
              partitionTodos ───┤
                                ├─ active ─ sortTodos(mode) ─> liste haut
                                └─ done   ─ tri updatedAt↓  ─> section bas

action utilisateur (add/toggle/edit/delete/sort/collapse)
    └─> main.ts callback ─> fn store (now) ─> saveTodos / saveSortMode /
        saveDoneCollapsed ─> sidebar.render()
```

## Gestion d'erreurs

- `loadSortMode` : si valeur localStorage inconnue/corrompue → défaut
  `'created'`.
- `loadDoneCollapsed` : si valeur non booléenne → défaut `false`.
- `loadTodos` : migration tolérante — todo sans `updatedAt` n'est pas rejeté,
  il est complété.
- `saveSortMode` / `saveDoneCollapsed` : `try/catch` + `console.error`, à
  l'image de `saveTodos` existant.

## Tests

- **`tests/unit/systems/todoSort.test.ts`** (nouveau) — les 3 modes, stabilité
  du tri, immutabilité (entrée non mutée), liste vide.
- **`tests/unit/systems/todoStore.test.ts`** (étendu) — `partitionTodos`,
  `updatedAt` mis à jour par `toggleTodo` et `updateTodoText`, migration des
  todos legacy par `loadTodos`, `loadSortMode`/`saveSortMode` round-trip +
  valeur corrompue, `loadDoneCollapsed`/`saveDoneCollapsed`.
- **`tests/unit/ui/TodoSidebar.test.ts`** (étendu) — rendu du `<select>`,
  `onSortChange` au changement, rendu des deux sections, repli/dépli de la
  section terminées et `onCollapseChange`, compteur « Terminées (N) ».

## Vérification end-to-end

1. `npm run test:run` — toute la suite verte.
2. `npm run lint` — pas d'erreur.
3. `npm run dev`, ouvrir http://localhost:5173 :
   - Ajouter quelques tâches, en cocher certaines → elles descendent dans la
     section « Terminées (N) ».
   - Replier/déplier la section ; recharger la page → l'état est conservé.
   - Changer le tri (Création / Modification / Alphabétique) → l'ordre des
     tâches actives change ; recharger → le tri choisi est conservé.
   - Éditer le texte d'une tâche puis trier par Modification → elle remonte.
