# Todolist Sidebar — Design Spec

**Date:** 2026-05-20
**Status:** Validated (user approval pending review)

## Goal

Ajouter une todolist persistante à gauche du village-sim, occupant 30% de la largeur de l'écran. Le village (canvas Phaser) occupe les 70% restants. La todolist est gamifiée : cocher des items boost le tirage de cartes quotidiennes.

## Layout

- Écran split horizontal 30/70 via flexbox sur `<body>` ou `#app`.
- Gauche 30% : `<div id="todo-sidebar">` (DOM HTML, hors canvas Phaser).
- Droite 70% : conteneur du jeu Phaser. Le canvas se redimensionne via `Phaser.Scale.RESIZE` ou en passant explicitement `width/height` au config.
- Min-width sidebar : 280px (sinon UI inutilisable sur petit écran).

## Todolist — Comportement

### Persistance

- Stockée dans `localStorage` sous clé dédiée `village-todos` (séparée du save game).
- **Pas de reset automatique.** L'utilisateur gère manuellement la liste : ajoute, supprime, modifie.
- Items persistent indéfiniment, peu importe le jour de la simulation.

### Modèle

```ts
type Todo = {
  readonly id: string;
  readonly text: string;
  readonly done: boolean;
  readonly createdAt: number;
};
```

### CRUD

- **Create** : input texte en haut + bouton `+` (ou Entrée). Ajoute en bas de liste.
- **Read** : liste verticale scrollable. Items cochés affichés barrés, opacité réduite.
- **Update** :
  - Toggle done : clic sur checkbox.
  - Edit texte : double-clic sur le label → champ input inline → blur ou Entrée valide, Échap annule.
- **Delete** : bouton `×` à droite de chaque item.
- **Tri** : ordre d'ajout (createdAt asc). Pas de tri par done — items cochés restent à leur place pour traçabilité.

### Validation

- Texte non vide (trim) requis pour create/update.
- Pas de doublon ni de longueur max imposée.

## Mécanique de jeu (gamification forte)

### Compteur motivation

- Nouvel attribut `motivation: number` dans `GameState`.
- Initialisé à 0 dans `emptyState()`.
- Migration : si state chargé sans `motivation`, défaut à 0 (pas de bump de SAVE_VERSION nécessaire — fallback inline).

### Effets

- Cocher une todo (toggle `done: false → true`) → `motivation += 1`.
- Décocher une todo (toggle `done: true → false`) → `motivation = max(0, motivation - 1)` (clamp pour éviter négatif).
- Création / suppression / édition de texte : aucun effet sur motivation.

### Application au tirage quotidien

- `drawCards()` : nb cartes tirées = `3 + Math.min(2, Math.floor(motivation / 3))`.
  - 0–2 motivation → 3 cartes (baseline)
  - 3–5 motivation → 4 cartes
  - 6+ motivation → 5 cartes (cap)
- Après pick d'une carte via `applyChosenCard()` : `motivation = 0`.

### Feedback visuel

- Lors d'un cocher, émettre un événement Phaser (`scene.events.emit('todo-completed')`).
- `WorldScene` écoute : prend 1 villageois aléatoire visible, anime un petit saut (tween Y de -8px puis retour, 400ms).
- Pas d'effet si aucun villageois visible.

## Architecture

### Fichiers à créer

- `src/domain/todo.ts` : type `Todo`, factory `newTodo(text)`.
- `src/systems/todoStore.ts` : `loadTodos()`, `saveTodos()`, `addTodo()`, `updateTodo()`, `toggleTodo()`, `deleteTodo()`. Pures pour create/update/delete (in/out arrays), I/O via load/save.
- `src/ui/TodoSidebar.ts` : classe qui prend un container DOM, crée la structure, gère événements DOM, émet callbacks (`onToggle(id)`, etc.). Découplée du store.
- `src/styles/todo.css` (ou inline dans `index.html`) : styles sidebar.

### Fichiers à modifier

- `src/domain/state.ts` : ajout `motivation: number` à `GameState`, défaut 0 dans `emptyState()`.
- `src/systems/save.ts` : migration inline (si motivation absent, défaut 0).
- `src/systems/dailyAction.ts` : `drawCards()` lit motivation depuis state ; `applyChosenCard()` reset motivation à 0.
- `src/main.ts` : crée la structure DOM (`#todo-sidebar` + `#game`), instancie `TodoSidebar`, branche callbacks vers `todoStore` et émet `'todo-completed'` sur scène.
- `src/scenes/WorldScene.ts` : écoute `'todo-completed'`, anime villager.
- `index.html` : conteneur split + import CSS si externalisé.
- `src/config.ts` : éventuellement constantes (sidebar width, motivation cap).

### Découplage

- `todoStore` ne sait rien du DOM ni de Phaser.
- `TodoSidebar` ne sait rien du store ni du game state — purement vue + événements.
- Glue dans `main.ts` : sidebar callbacks → store → re-render sidebar + update GameState motivation + emit Phaser event.

## Tests

- `todoStore.test.ts` : CRUD pur (add/update/toggle/delete), invariants (textes trimés, id unique), serialization round-trip via JSON.
- `dailyAction.test.ts` (étendu) : `drawCards` retourne 3/4/5 cartes selon motivation ; `applyChosenCard` reset motivation.
- `state.test.ts` (étendu) : `emptyState` initialise motivation à 0.
- `TodoSidebar.test.ts` : test DOM via vitest + jsdom — render initial, ajout via input, toggle checkbox, edit inline, delete.

## YAGNI — non inclus

- Pas de catégories, tags, priorités, dates limite, rappels, sous-tâches.
- Pas d'export, partage, sync cloud.
- Pas d'historique des items supprimés.
- Pas de raccourcis clavier au-delà d'Entrée / Échap.
- Pas de drag-and-drop pour réordonner.
- Pas de pagination ni virtualization (assume < 100 items).

## Risques / questions ouvertes

- **Resize Phaser** : le canvas doit redimensionner proprement quand fenêtre change. À tester. Solution : `Phaser.Scale.FIT` ou `RESIZE`.
- **Décocher pour ré-cocher = exploit motivation** : géré par `max(0, ...)` clamp côté décochage, mais user peut toggle plusieurs fois. Atténuation : compteur ne dépasse pas le nombre total d'items todos (`motivation = min(motivation, todos.length)`). À implémenter dans le store ou côté state. **Décision : ne pas atténuer pour MVP** — assume bonne foi user (single-player, second monitor).
