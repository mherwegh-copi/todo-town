# Stats du jour — ligne « 3/5 tâches faites aujourd'hui »

Date : 2026-05-20

## Objectif

Afficher sous l'horloge de la sidebar une ligne de progression quotidienne :
`3/5 faites aujourd'hui`, où :

- **3** (numérateur) = nombre de tâches cochées aujourd'hui.
- **5** (dénominateur) = objectif quotidien fixe, par défaut 5, modifiable et
  persisté.

L'objectif est un but personnel, pas un dérivé de la liste de tâches.

## Approche retenue

Composant UI dédié `DailyStats`, monté sous l'horloge. `SidebarClock` reste
focalisé sur le temps ; `DailyStats` ne gère que la progression des tâches.
Frontière nette : chaque composant a une seule raison de changer.

## Composants

### 1. Logique pure — `src/systems/dailyGoal.ts`

```
countDoneToday(todos: readonly Todo[], now: number): number
```

Compte les todos tels que `t.done === true` **et**
`daysBetween(t.updatedAt, now) === 0`. Réutilise `daysBetween` de
`src/systems/clock.ts`.

Pas d'état interne — fonction pure.

### 2. Persistance de l'objectif — `src/systems/todoStore.ts`

Ajout, cohérent avec `loadSortMode` / `saveSortMode` existants :

```
loadDailyGoal(): number       // défaut 5, valeur clampée 1–99
saveDailyGoal(goal: number): void
```

`loadDailyGoal` retourne 5 si la clé est absente, non numérique, ou hors
bornes. `saveDailyGoal` clampe avant écriture et capture les erreurs
localStorage comme les autres `save*`.

Nouvelle clé dans `src/config.ts` : `TODO_DAILY_GOAL_KEY`.

Constantes de bornes : `DAILY_GOAL_MIN = 1`, `DAILY_GOAL_MAX = 99`.

### 3. Composant — `src/ui/DailyStats.ts`

Signature :

```
new DailyStats(
  container: HTMLElement,
  getTodos: () => readonly Todo[],
  getGoal: () => number,
  onGoalChange: (goal: number) => void,
)
```

Rendu : `<div class="clock-stats">` ajouté dans `container`, contenant le
texte `<n>/<objectif> faites aujourd'hui`. Le `<objectif>` est un `<span>`
cliquable.

Comportement :

- `render()` public — recalcule `countDoneToday` et redessine la ligne.
- Clic sur le span objectif → remplacement par un `<input type="number">`
  inline (même motif que l'édition double-clic des tâches dans
  `TodoSidebar`). `Entrée` ou `blur` valide ; `Échap` annule. Valeur clampée
  1–99 avant d'appeler `onGoalChange`.
- Quand `compte >= objectif`, ajout de la classe CSS `goal-reached` sur la
  ligne (couleur accent). Pas de plafonnement du compte : un dépassement
  s'affiche tel quel, ex. `6/5`.
- Timer interne `setInterval` 60 s appelant `render()` — gère le passage de
  minuit (le numérateur « aujourd'hui » repart à zéro).
- `destroy()` — `clearInterval`.

### 4. Câblage — `src/main.ts`

- `let dailyGoal = loadDailyGoal();`
- Instanciation après `SidebarClock`, dans le même `clockMount` :

```
const stats = new DailyStats(
  clockMount,
  () => todos,
  () => dailyGoal,
  (n) => { dailyGoal = n; saveDailyGoal(n); stats.render(); },
);
```

- Appel `stats.render()` ajouté à la fin de chaque callback todo
  (`onAdd`, `onToggle`, `onEdit`, `onDelete`) → mise à jour instantanée du
  numérateur.

### 5. Styles — CSS existant (`index.html` / feuille de la sidebar)

- `.clock-stats` : taille et couleur proches de `.clock-meta`.
- Le span objectif : `cursor: pointer` + soulignement discret pour la
  découvrabilité.
- `.clock-stats.goal-reached` : couleur accent.

## Flux de données

```
todos (main.ts) ──getTodos()──▶ DailyStats.render()
dailyGoal (main.ts) ──getGoal()──▶ DailyStats.render()
DailyStats input ──onGoalChange()──▶ main.ts maj dailyGoal + saveDailyGoal
callbacks todo (main.ts) ──stats.render()──▶ maj instantanée
timer 60 s (DailyStats) ──render()──▶ rollover minuit
```

`DailyStats` ne possède aucun état métier — il lit via les getters et
recompute à chaque `render()`.

## Cas limites

- Liste vide → `0/5 faites aujourd'hui`.
- Tâche cochée hier → non comptée (`updatedAt` ≠ aujourd'hui).
- Tâche décochée → retombe sous le compte au `render()` suivant.
- Tâche cochée aujourd'hui puis éditée aujourd'hui → toujours comptée
  (`updatedAt` reste aujourd'hui).
- Compte > objectif → affiché tel quel, classe `goal-reached` active.
- Saisie objectif invalide / vide → annulée (clamp + Échap).
- App ouverte au passage de minuit → décalage maximal de 60 s avant que la
  ligne reparte à zéro (accepté).

## Tests — `tests/dailyGoal.test.ts`

`countDoneToday` :
- tâche faite aujourd'hui → comptée
- tâche faite hier → non comptée
- tâche non faite → non comptée
- liste vide → 0
- bord minuit (`updatedAt` juste avant / après minuit local)

`loadDailyGoal` / `saveDailyGoal` :
- clé absente → défaut 5
- valeur valide → relue à l'identique
- valeur hors bornes → clampée 1–99
- valeur non numérique → défaut 5

## Hors périmètre (YAGNI)

- Historique des jours passés / graphique de série.
- Objectif variable selon le jour de la semaine.
- Notification ou animation à l'atteinte de l'objectif (au-delà du
  changement de couleur).
