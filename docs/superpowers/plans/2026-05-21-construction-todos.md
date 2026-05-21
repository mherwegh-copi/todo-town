# Construction du village pilotée par les todos — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remplacer la motivation par une ressource de construction visible : fermer des todos accumule des points qui débloquent des « ouvertures » (tirages de cartes), avec une ouverture garantie chaque matin.

**Architecture:** Un module pur `src/systems/construction.ts` porte toute la logique de ressource (seuils, conversion en ouvertures, ouverture du matin). L'état du jeu gagne un bloc `construction`. Les systèmes existants (`catchup`, `dailyAction`) et l'UI (`StatusBar`, `ActionButton`, `UIScene`) sont recâblés dessus. La motivation est retirée en fin de plan, une fois ses derniers consommateurs migrés.

**Tech Stack:** TypeScript, Phaser 3, Vitest. Tests dans `tests/unit/**` et `tests/integration/`.

**Spec de référence:** `docs/superpowers/specs/2026-05-21-construction-todos-design.md`

**Ordre de travail:** Les tâches 1→11 sont additives — le dépôt compile après chacune (la motivation cohabite avec `construction`). La tâche 12 retire la motivation une fois tous ses consommateurs migrés.

**Commandes utiles:**
- Tests ciblés : `npx vitest run <chemin>`
- Type-check : `npx tsc --noEmit`
- Lint : `npx eslint <chemin>`

---

## Task 1: Constantes de configuration

**Files:**
- Modify: `src/config.ts:11-16`

- [ ] **Step 1: Ajouter les constantes de construction**

Dans `src/config.ts`, juste après la ligne `export const BASE_CARDS_DRAWN = 3;` et le bloc `MOTIVATION_*` (lignes 12-16), ajouter ce bloc. Ne **pas** retirer les constantes `MOTIVATION_*` ni `BASE_CARDS_DRAWN` — elles seront supprimées en Task 12.

```ts
// Construction : points accumulés par todo fermé → ouvertures (tirages).
export const CONSTRUCTION_BASE_THRESHOLD = 3;
export const CONSTRUCTION_THRESHOLD_STEP = 2;
export const CONSTRUCTION_OPENINGS_CAP = 5;
export const CONSTRUCTION_CARDS_BASE = 2;
export const CONSTRUCTION_CARDS_MAX = 5;
```

- [ ] **Step 2: Vérifier que le projet compile toujours**

Run: `npx tsc --noEmit`
Expected: aucune erreur (ajout purement additif).

- [ ] **Step 3: Commit**

```bash
git add src/config.ts
git commit -m "feat(construction): add construction config constants"
```

---

## Task 2: Bloc `construction` dans l'état du jeu

**Files:**
- Modify: `src/domain/state.ts:7-48`
- Test: `tests/unit/domain/state.test.ts`

- [ ] **Step 1: Écrire le test qui échoue**

Remplacer **tout** le contenu de `tests/unit/domain/state.test.ts` par :

```ts
import { describe, it, expect } from 'vitest';
import { emptyState } from '../../../src/domain/state';

describe('emptyState', () => {
  it('initialise le bloc construction à zéro', () => {
    const s = emptyState(1, 42);
    expect(s.construction).toEqual({ points: 0, openings: 0, lastMorningDate: '' });
  });
});
```

- [ ] **Step 2: Lancer le test pour vérifier qu'il échoue**

Run: `npx vitest run tests/unit/domain/state.test.ts`
Expected: FAIL — `construction` est `undefined`.

- [ ] **Step 3: Ajouter le champ `construction` au type et à `emptyState`**

Dans `src/domain/state.ts`, ajouter le champ au type `GameState`, juste après le bloc `progression` (avant `motivation`) :

```ts
  readonly construction: {
    readonly points: number;
    readonly openings: number;
    readonly lastMorningDate: string;
  };
  readonly motivation: number;
  readonly motivationLastDecayAt: number;
```

Puis dans `emptyState`, ajouter le champ dans l'objet retourné, juste après `progression: { ... }` :

```ts
    progression: { day: 0, townHallLevel: 1, unlockedCards: [] },
    construction: { points: 0, openings: 0, lastMorningDate: '' },
    motivation: 0,
    motivationLastDecayAt: now,
```

- [ ] **Step 4: Lancer le test pour vérifier qu'il passe**

Run: `npx vitest run tests/unit/domain/state.test.ts`
Expected: PASS.

- [ ] **Step 5: Vérifier que tout le projet compile et que les tests passent**

Run: `npx tsc --noEmit && npx vitest run`
Expected: aucune erreur. `emptyState` fournit toujours `construction`, donc le round-trip `save`/`load` reste cohérent.

- [ ] **Step 6: Commit**

```bash
git add src/domain/state.ts tests/unit/domain/state.test.ts
git commit -m "feat(construction): add construction block to GameState"
```

---

## Task 3: Module `construction.ts` — seuils, points et ouvertures

**Files:**
- Create: `src/systems/construction.ts`
- Test: `tests/unit/systems/construction.test.ts`

- [ ] **Step 1: Écrire les tests qui échouent**

Créer `tests/unit/systems/construction.test.ts` :

```ts
import { describe, it, expect } from 'vitest';
import {
  thresholdFor,
  poolSizeFor,
  addPoints,
  consumeOpening,
} from '../../../src/systems/construction';
import { emptyState } from '../../../src/domain/state';

function withConstruction(points: number, openings: number, level = 1) {
  const s = emptyState(0, 1);
  return {
    ...s,
    progression: { ...s.progression, townHallLevel: level },
    construction: { points, openings, lastMorningDate: '' },
  };
}

describe('thresholdFor', () => {
  it('vaut 3 au niveau 1, 5 au niveau 2, 7 au niveau 3', () => {
    expect(thresholdFor(1)).toBe(3);
    expect(thresholdFor(2)).toBe(5);
    expect(thresholdFor(3)).toBe(7);
  });

  it('traite un niveau < 1 comme le niveau 1', () => {
    expect(thresholdFor(0)).toBe(3);
  });
});

describe('poolSizeFor', () => {
  it('vaut 3 au niveau 1, 4 au niveau 2, 5 au niveau 3+', () => {
    expect(poolSizeFor(1)).toBe(3);
    expect(poolSizeFor(2)).toBe(4);
    expect(poolSizeFor(3)).toBe(5);
    expect(poolSizeFor(7)).toBe(5);
  });
});

describe('addPoints', () => {
  it('accumule les points sans atteindre le seuil', () => {
    const s = addPoints(withConstruction(0, 0), 1);
    expect(s.construction.points).toBe(1);
    expect(s.construction.openings).toBe(0);
  });

  it('convertit un palier atteint en une ouverture', () => {
    const s = addPoints(withConstruction(0, 0), 3);
    expect(s.construction.points).toBe(0);
    expect(s.construction.openings).toBe(1);
  });

  it('convertit plusieurs paliers d un coup et garde le surplus', () => {
    const s = addPoints(withConstruction(0, 0), 7);
    expect(s.construction.openings).toBe(2);
    expect(s.construction.points).toBe(1);
  });

  it('utilise le seuil du niveau courant', () => {
    const s = addPoints(withConstruction(0, 0, 2), 12);
    expect(s.construction.openings).toBe(2);
    expect(s.construction.points).toBe(2);
  });

  it('retire des points au décochage, plancher à 0', () => {
    expect(addPoints(withConstruction(2, 0), -1).construction.points).toBe(1);
    expect(addPoints(withConstruction(2, 0), -5).construction.points).toBe(0);
  });

  it('met la conversion en pause quand la file est pleine', () => {
    const s = addPoints(withConstruction(0, 5), 3);
    expect(s.construction.openings).toBe(5);
    expect(s.construction.points).toBe(3);
  });
});

describe('consumeOpening', () => {
  it('retire une ouverture de la file', () => {
    expect(consumeOpening(withConstruction(0, 2)).construction.openings).toBe(1);
  });

  it('ne descend pas sous zéro', () => {
    expect(consumeOpening(withConstruction(0, 0)).construction.openings).toBe(0);
  });

  it('reconvertit le surplus de points en attente quand un créneau se libère', () => {
    // File pleine (5) + 3 points bloqués au niveau 1 (seuil 3).
    const s = consumeOpening(withConstruction(3, 5));
    expect(s.construction.openings).toBe(5);
    expect(s.construction.points).toBe(0);
  });
});
```

- [ ] **Step 2: Lancer les tests pour vérifier qu'ils échouent**

Run: `npx vitest run tests/unit/systems/construction.test.ts`
Expected: FAIL — module `construction` introuvable.

- [ ] **Step 3: Créer le module**

Créer `src/systems/construction.ts` :

```ts
import { GameState } from '../domain/state';
import {
  CONSTRUCTION_BASE_THRESHOLD,
  CONSTRUCTION_THRESHOLD_STEP,
  CONSTRUCTION_OPENINGS_CAP,
  CONSTRUCTION_CARDS_BASE,
  CONSTRUCTION_CARDS_MAX,
} from '../config';

/** Nombre de todos fermés pour débloquer une ouverture au niveau donné. */
export function thresholdFor(townHallLevel: number): number {
  const level = Math.max(1, townHallLevel);
  return CONSTRUCTION_BASE_THRESHOLD + (level - 1) * CONSTRUCTION_THRESHOLD_STEP;
}

/** Nombre de cartes proposées à chaque ouverture au niveau donné. */
export function poolSizeFor(townHallLevel: number): number {
  const level = Math.max(1, townHallLevel);
  return Math.min(CONSTRUCTION_CARDS_MAX, CONSTRUCTION_CARDS_BASE + level);
}

/**
 * Convertit autant de paliers de `points` que possible en ouvertures, sans
 * dépasser OPENINGS_CAP. Renvoie le couple { points, openings } résultant.
 */
function convert(points: number, openings: number, threshold: number): {
  points: number;
  openings: number;
} {
  let p = points;
  let o = openings;
  while (p >= threshold && o < CONSTRUCTION_OPENINGS_CAP) {
    p -= threshold;
    o += 1;
  }
  return { points: p, openings: o };
}

/**
 * Applique `delta` points de construction (positif à la fermeture d'un todo,
 * négatif au décochage). Plancher à 0, puis conversion des paliers atteints en
 * ouvertures.
 */
export function addPoints(state: GameState, delta: number): GameState {
  const raw = Math.max(0, state.construction.points + delta);
  const { points, openings } = convert(
    raw,
    state.construction.openings,
    thresholdFor(state.progression.townHallLevel),
  );
  return { ...state, construction: { ...state.construction, points, openings } };
}

/**
 * Consomme une ouverture de la file (no-op si la file est vide). Relance la
 * conversion : un créneau libéré peut absorber des points en attente.
 */
export function consumeOpening(state: GameState): GameState {
  if (state.construction.openings <= 0) return state;
  const { points, openings } = convert(
    state.construction.points,
    state.construction.openings - 1,
    thresholdFor(state.progression.townHallLevel),
  );
  return { ...state, construction: { ...state.construction, points, openings } };
}
```

- [ ] **Step 4: Lancer les tests pour vérifier qu'ils passent**

Run: `npx vitest run tests/unit/systems/construction.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/systems/construction.ts tests/unit/systems/construction.test.ts
git commit -m "feat(construction): add threshold, pool size and points logic"
```

---

## Task 4: Module `construction.ts` — ouverture du matin

**Files:**
- Modify: `src/systems/construction.ts`
- Test: `tests/unit/systems/construction.test.ts`

- [ ] **Step 1: Écrire les tests qui échouent**

Ajouter à la fin de `tests/unit/systems/construction.test.ts` :

```ts
import { grantMorningOpening } from '../../../src/systems/construction';

describe('grantMorningOpening', () => {
  const at = (h: number) => new Date(2026, 4, 21, h).getTime();

  it('accorde une ouverture le matin et mémorise la date', () => {
    const s = grantMorningOpening(withConstruction(0, 0), at(8));
    expect(s.construction.openings).toBe(1);
    expect(s.construction.lastMorningDate).toBe('2026-05-21');
  });

  it('est idempotent dans la même journée', () => {
    const once = grantMorningOpening(withConstruction(0, 0), at(8));
    const twice = grantMorningOpening(once, at(11));
    expect(twice.construction.openings).toBe(1);
  });

  it('n accorde rien avant 06:00', () => {
    const s = grantMorningOpening(withConstruction(0, 0), at(5));
    expect(s.construction.openings).toBe(0);
    expect(s.construction.lastMorningDate).toBe('');
  });

  it('respecte le plafond mais mémorise quand même la date du jour', () => {
    const s = grantMorningOpening(withConstruction(0, 5), at(8));
    expect(s.construction.openings).toBe(5);
    expect(s.construction.lastMorningDate).toBe('2026-05-21');
  });

  it('accorde de nouveau un autre jour', () => {
    const day1 = grantMorningOpening(withConstruction(0, 0), at(8));
    const day2 = grantMorningOpening(day1, new Date(2026, 4, 22, 8).getTime());
    expect(day2.construction.openings).toBe(2);
    expect(day2.construction.lastMorningDate).toBe('2026-05-22');
  });
});
```

- [ ] **Step 2: Lancer les tests pour vérifier qu'ils échouent**

Run: `npx vitest run tests/unit/systems/construction.test.ts`
Expected: FAIL — `grantMorningOpening` non exporté.

- [ ] **Step 3: Implémenter `grantMorningOpening`**

Dans `src/systems/construction.ts`, ajouter l'import de l'horloge et de la constante en haut du fichier :

```ts
import { dateKey, hourOfDay } from './clock';
import {
  CONSTRUCTION_BASE_THRESHOLD,
  CONSTRUCTION_THRESHOLD_STEP,
  CONSTRUCTION_OPENINGS_CAP,
  CONSTRUCTION_CARDS_BASE,
  CONSTRUCTION_CARDS_MAX,
  DAY_START_HOUR,
} from '../config';
```

(Remplacer le bloc d'import de `../config` existant par celui ci-dessus — il ajoute `DAY_START_HOUR`.)

Puis ajouter la fonction à la fin du fichier :

```ts
/**
 * Accorde l'ouverture garantie du matin si un nouveau jour calendaire a
 * commencé et que l'heure est >= DAY_START_HOUR. Idempotent dans la journée :
 * `lastMorningDate` est mis à jour même si la file est pleine, pour ne pas
 * réessayer en boucle.
 */
export function grantMorningOpening(state: GameState, now: number): GameState {
  if (hourOfDay(now) < DAY_START_HOUR) return state;
  const today = dateKey(now);
  if (state.construction.lastMorningDate === today) return state;
  const openings = Math.min(CONSTRUCTION_OPENINGS_CAP, state.construction.openings + 1);
  return {
    ...state,
    construction: { ...state.construction, openings, lastMorningDate: today },
  };
}
```

- [ ] **Step 4: Lancer les tests pour vérifier qu'ils passent**

Run: `npx vitest run tests/unit/systems/construction.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/systems/construction.ts tests/unit/systems/construction.test.ts
git commit -m "feat(construction): add guaranteed morning opening"
```

---

## Task 5: Câbler `catchUp` sur l'ouverture du matin

**Files:**
- Modify: `src/systems/catchup.ts`
- Test: `tests/unit/systems/catchup.test.ts`

- [ ] **Step 1: Réécrire les tests de `catchup`**

Remplacer **tout** le contenu de `tests/unit/systems/catchup.test.ts` par :

```ts
import { describe, it, expect } from 'vitest';
import { catchUp } from '../../../src/systems/catchup';
import { emptyState } from '../../../src/domain/state';

describe('catchup', () => {
  it('updates day and lastSeenAt', () => {
    const t0 = new Date(2026, 4, 20, 12).getTime();
    const t1 = new Date(2026, 4, 23, 12).getTime();
    const s0 = emptyState(t0, 1);
    const s1 = catchUp(s0, t1);
    expect(s1.progression.day).toBe(3);
    expect(s1.lastSeenAt).toBe(t1);
  });

  it('caps catch-up at MAX_CATCHUP_DAYS', () => {
    const t0 = new Date(2026, 0, 1).getTime();
    const t1 = new Date(2026, 5, 1).getTime();
    const s0 = emptyState(t0, 1);
    const s1 = catchUp(s0, t1);
    expect(s1.progression.day).toBe(30);
  });

  it('accorde l ouverture du matin après 06:00 un nouveau jour', () => {
    const t0 = new Date(2026, 4, 20, 12).getTime();
    const t1 = new Date(2026, 4, 21, 8).getTime();
    const s1 = catchUp(emptyState(t0, 1), t1);
    expect(s1.construction.openings).toBe(1);
    expect(s1.construction.lastMorningDate).toBe('2026-05-21');
  });

  it('n accorde pas d ouverture avant 06:00', () => {
    const t0 = new Date(2026, 4, 20, 12).getTime();
    const t1 = new Date(2026, 4, 21, 5).getTime();
    const s1 = catchUp(emptyState(t0, 1), t1);
    expect(s1.construction.openings).toBe(0);
  });

  it('n accorde qu une seule ouverture matin par jour calendaire', () => {
    const t0 = new Date(2026, 4, 20, 12).getTime();
    const morning = catchUp(emptyState(t0, 1), new Date(2026, 4, 21, 8).getTime());
    const noon = catchUp(morning, new Date(2026, 4, 21, 13).getTime());
    expect(noon.construction.openings).toBe(1);
  });
});
```

- [ ] **Step 2: Lancer les tests pour vérifier qu'ils échouent**

Run: `npx vitest run tests/unit/systems/catchup.test.ts`
Expected: FAIL — `catchUp` n'accorde pas encore d'ouverture du matin.

- [ ] **Step 3: Réécrire `catchUp`**

Remplacer **tout** le contenu de `src/systems/catchup.ts` par :

```ts
import { GameState } from '../domain/state';
import { dayIndex } from './clock';
import { MAX_CATCHUP_DAYS } from '../config';
import { grantMorningOpening } from './construction';

export function catchUp(state: GameState, now: number): GameState {
  const elapsed = dayIndex(state.createdAt, now);
  const day = Math.min(elapsed, state.progression.day + MAX_CATCHUP_DAYS);

  let next: GameState = state;
  if (day !== state.progression.day || now !== state.lastSeenAt) {
    next = { ...next, lastSeenAt: now, progression: { ...next.progression, day } };
  }
  return grantMorningOpening(next, now);
}
```

Note : la décroissance de motivation est retirée. La constante `MOTIVATION_DECAY_HOURS` n'est plus importée ici (elle sera supprimée de `config.ts` en Task 12).

- [ ] **Step 4: Lancer les tests pour vérifier qu'ils passent**

Run: `npx vitest run tests/unit/systems/catchup.test.ts`
Expected: PASS.

- [ ] **Step 5: Vérifier le scénario d'intégration**

Run: `npx vitest run tests/integration/scenario.test.ts`
Expected: PASS (le scénario ne dépend pas de la motivation).

- [ ] **Step 6: Commit**

```bash
git add src/systems/catchup.ts tests/unit/systems/catchup.test.ts
git commit -m "feat(construction): grant morning opening in catchUp, drop motivation decay"
```

---

## Task 6: Recâbler `dailyAction` sur les ouvertures

**Files:**
- Modify: `src/systems/dailyAction.ts`
- Test: `tests/unit/systems/dailyAction.test.ts`

- [ ] **Step 1: Réécrire les tests de `dailyAction`**

Remplacer **tout** le contenu de `tests/unit/systems/dailyAction.test.ts` par :

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { drawCards, applyChosenCard } from '../../../src/systems/dailyAction';
import { emptyState } from '../../../src/domain/state';
import { placeBuilding } from '../../../src/systems/worldOps';
import { resetIdsForTests } from '../../../src/domain/ids';

describe('dailyAction', () => {
  beforeEach(() => resetIdsForTests());

  it('drawCards renvoie 3 cartes distinctes au niveau 1', () => {
    let s = emptyState(0, 1);
    s = placeBuilding(s, 'townHall', 15, 15, 0);
    const cards = drawCards(s, 0);
    expect(cards).toHaveLength(3);
    expect(new Set(cards.map((c) => c.id)).size).toBe(3);
  });

  it('applyChosenCard applique l effet, consomme une ouverture et met à jour lastSeenAt', () => {
    let s = emptyState(0, 1);
    s = placeBuilding(s, 'townHall', 15, 15, 0);
    s = { ...s, construction: { ...s.construction, openings: 2 } };
    const cards = drawCards(s, 0);
    const now = new Date(2026, 4, 21, 7).getTime();
    const s2 = applyChosenCard(s, cards[0]!.id, now);
    expect(s2.construction.openings).toBe(1);
    expect(s2.lastSeenAt).toBe(now);
  });

  it('place le bâtiment aux coordonnées fournies', () => {
    let s = emptyState(0, 1);
    s = placeBuilding(s, 'townHall', 15, 15, 0);
    s = { ...s, construction: { ...s.construction, openings: 1 } };
    const now = new Date(2026, 4, 21, 7).getTime();
    const next = applyChosenCard(s, 'build_house', now, { x: 3, y: 3 });
    const house = next.world.buildings.find((b) => b.kind === 'house');
    expect(house).toBeDefined();
    expect(house!.tileX).toBe(3);
    expect(house!.tileY).toBe(3);
  });

  it('place automatiquement quand aucune coordonnée n est donnée', () => {
    let s = emptyState(0, 1);
    s = placeBuilding(s, 'townHall', 15, 15, 0);
    const now = new Date(2026, 4, 21, 7).getTime();
    const next = applyChosenCard(s, 'build_house', now);
    expect(next.world.buildings.filter((b) => b.kind === 'house')).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Lancer les tests pour vérifier qu'ils échouent**

Run: `npx vitest run tests/unit/systems/dailyAction.test.ts`
Expected: FAIL — `applyChosenCard` ne consomme pas encore d'ouverture.

- [ ] **Step 3: Réécrire `dailyAction.ts`**

Remplacer **tout** le contenu de `src/systems/dailyAction.ts` par :

```ts
import { GameState } from '../domain/state';
import { ActionCard } from '../cards/types';
import { ALL_CARDS, cardById } from '../cards/deck';
import { createRng, rngInt } from './rng';
import { computeMetrics } from './progression';
import { poolSizeFor, consumeOpening } from './construction';

function pondWeight(card: ActionCard, state: GameState): number {
  const m = computeMetrics(state);
  let w = card.weight;
  if (m.buildingsIdle > 0 && (card.category === 'recruit' || card.category === 'assign')) {
    w *= 2;
  }
  return w;
}

export function drawCards(state: GameState, now: number): readonly ActionCard[] {
  const pool = ALL_CARDS.filter(
    (c) => c.minTier <= state.progression.townHallLevel && c.isAvailable(state),
  );
  if (pool.length === 0) return [];
  const target = poolSizeFor(state.progression.townHallLevel);
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

export function applyChosenCard(
  state: GameState,
  cardId: string,
  now: number,
  coords?: { x: number; y: number },
): GameState {
  const card = cardById(cardId);
  const after = card.effect(state, now, coords);
  return consumeOpening({ ...after, lastSeenAt: now });
}
```

Changements : `drawCards` utilise `poolSizeFor` (plus de bonus motivation) ; `applyChosenCard` consomme une ouverture et ne touche plus ni à `motivation` ni à `lastActionDate` ; `isActionAvailable` est supprimée.

- [ ] **Step 4: Lancer les tests pour vérifier qu'ils passent**

Run: `npx vitest run tests/unit/systems/dailyAction.test.ts`
Expected: PASS.

- [ ] **Step 5: Vérifier la compilation**

Run: `npx tsc --noEmit`
Expected: une **seule** erreur attendue — `src/scenes/UIScene.ts` importe `isActionAvailable`, supprimée. Elle sera corrigée en Task 8. Si d'autres erreurs apparaissent, s'arrêter et investiguer.

- [ ] **Step 6: Commit**

```bash
git add src/systems/dailyAction.ts tests/unit/systems/dailyAction.test.ts
git commit -m "feat(construction): draw cards by level, consume opening on card play"
```

---

## Task 7: Méthode `addConstructionPoints` sur `WorldScene`

**Files:**
- Modify: `src/scenes/WorldScene.ts:171-177`

- [ ] **Step 1: Remplacer `bumpMotivation` par `addConstructionPoints`**

Dans `src/scenes/WorldScene.ts`, ajouter l'import en haut du fichier (après les autres imports `systems`) :

```ts
import { addPoints } from '../systems/construction';
```

Puis remplacer la méthode `bumpMotivation` (lignes 171-177) par :

```ts
  addConstructionPoints(delta: number): GameState {
    const next = addPoints(this.state, delta);
    this.state = next;
    this.registry.set('state', next);
    saveState(next);
    return next;
  }
```

- [ ] **Step 2: Vérifier la compilation**

Run: `npx tsc --noEmit`
Expected: erreurs attendues dans `src/main.ts` (appelle `world.bumpMotivation`) et `src/scenes/UIScene.ts` (Task 6). Corrigées en Task 8 et 9. Aucune autre erreur.

- [ ] **Step 3: Commit**

```bash
git add src/scenes/WorldScene.ts
git commit -m "feat(construction): replace bumpMotivation with addConstructionPoints on WorldScene"
```

---

## Task 8: Recâbler `UIScene` sur les ouvertures

**Files:**
- Modify: `src/scenes/UIScene.ts:8,50-67`

- [ ] **Step 1: Mettre à jour l'import**

Dans `src/scenes/UIScene.ts`, remplacer la ligne 8 :

```ts
import { drawCards, applyChosenCard, isActionAvailable } from '../systems/dailyAction';
```

par :

```ts
import { drawCards, applyChosenCard } from '../systems/dailyAction';
```

- [ ] **Step 2: Recâbler `update` et `openAction`**

Remplacer les méthodes `update` (lignes 50-56) et `openAction` (lignes 58-67) par :

```ts
  update(): void {
    const state = this.registry.get('state') as GameState | undefined;
    if (!state) return;
    this.status.update(state);
    this.actionBtn.setAvailable(state.construction.openings > 0, state.construction.openings);
  }

  private openAction(): void {
    const state = this.registry.get('state') as GameState | undefined;
    if (!state) return;
    if (state.construction.openings <= 0) return;
    const cards = drawCards(state, Date.now());
    if (cards.length === 0) return;
    this.drawnCards = cards;
    this.overlay.show(cards);
  }
```

Note : l'ouverture est consommée dans `applyChosenCard` (Task 6), donc uniquement quand une carte est effectivement jouée. Fermer l'overlay ou annuler le placement ne coûte rien — comportement identique à l'actuel. `pickCard` reste inchangée. La méthode `ActionButton.setAvailable` accepte un deuxième argument `count` ajouté en Task 11 ; d'ici là TypeScript tolère l'argument supplémentaire seulement après Task 11, donc cette tâche peut laisser une erreur de compilation sur cet appel jusqu'à Task 11.

- [ ] **Step 3: Vérifier la compilation**

Run: `npx tsc --noEmit`
Expected: erreur attendue sur `setAvailable` (2 arguments vs 1) — corrigée en Task 11. Erreur attendue dans `src/main.ts` — corrigée en Task 9. `StatusBar` lit encore `state.motivation` : OK, le champ existe toujours. Aucune autre erreur.

- [ ] **Step 4: Commit**

```bash
git add src/scenes/UIScene.ts
git commit -m "feat(construction): gate action button on pending openings"
```

---

## Task 9: Recâbler `main.ts` sur les points de construction

**Files:**
- Modify: `src/main.ts:56-63,143-150`

- [ ] **Step 1: Renommer le wrapper `bumpMotivation`**

Dans `src/main.ts`, remplacer la fonction `bumpMotivation` (lignes 56-63) par :

```ts
function addConstructionPoints(delta: number): void {
  const world = getWorld();
  if (!world) {
    console.warn('addConstructionPoints: WorldScene not ready, skipping');
    return;
  }
  world.addConstructionPoints(delta);
}
```

- [ ] **Step 2: Mettre à jour `onToggle`**

Dans `src/main.ts`, remplacer le bloc `if (result.toggled) { ... }` du handler `onToggle` (lignes 143-150) par :

```ts
      if (result.toggled) {
        if (result.toggled.to === true) {
          addConstructionPoints(+1);
          emitTodoCompleted();
        } else {
          addConstructionPoints(-1);
        }
      }
```

- [ ] **Step 3: Vérifier la compilation**

Run: `npx tsc --noEmit`
Expected: seule l'erreur `setAvailable` de Task 8 subsiste (corrigée en Task 11). Aucune autre erreur.

- [ ] **Step 4: Commit**

```bash
git add src/main.ts
git commit -m "feat(construction): feed construction points from todo toggles"
```

---

## Task 10: Barre de chantier dans `StatusBar`

**Files:**
- Modify: `src/ui/StatusBar.ts`

- [ ] **Step 1: Remplacer le bloc motivation par la barre de chantier**

Remplacer **tout** le contenu de `src/ui/StatusBar.ts` par :

```ts
import Phaser from 'phaser';
import { GameState } from '../domain/state';
import { weatherForDay } from '../systems/weather';
import { seasonForDay } from '../systems/season';
import { thresholdFor } from '../systems/construction';
import { OPENINGS_CAP } from '../config';

const WEATHER_LABEL_FR: Record<string, string> = {
  clear: 'beau',
  rain: 'pluie',
  snow: 'neige',
};

const WEATHER_ICON: Record<string, string> = {
  clear: '☀',
  rain: '☂',
  snow: '❄',
};

const SEASON_LABEL_FR: Record<string, string> = {
  spring: 'printemps',
  summer: 'été',
  autumn: 'automne',
  winter: 'hiver',
};

const BUILDING_LABEL_FR: Record<string, string> = {
  townHall: 'mairie',
  house: 'maisons',
  farm: 'fermes',
  forge: 'forges',
  mill: 'moulins',
  well: 'puits',
  square: 'places',
};

const PAD_X = 14;
const PAD_Y = 10;
const MARGIN = 12;
const ROW_H = 18;
const WIDTH = 240;
const FONT = 'system-ui, -apple-system, sans-serif';

const TOKEN_W = 14;
const TOKEN_H = 16;
const TOKEN_GAP = 6;

export class StatusBar {
  private container: Phaser.GameObjects.Container;
  private bg: Phaser.GameObjects.Graphics;
  private title: Phaser.GameObjects.Text;
  private rows: Phaser.GameObjects.Text[] = [];
  private chantierLabel: Phaser.GameObjects.Text;
  private chantierValue: Phaser.GameObjects.Text;
  private chantierBarBg: Phaser.GameObjects.Graphics;
  private chantierBarFill: Phaser.GameObjects.Graphics;
  private openingsLabel: Phaser.GameObjects.Text;
  private openingsTokens: Phaser.GameObjects.Graphics;

  constructor(private scene: Phaser.Scene) {
    this.container = scene.add.container(MARGIN, MARGIN).setScrollFactor(0).setDepth(1000);

    this.bg = scene.add.graphics();
    this.container.add(this.bg);

    this.title = scene.add.text(PAD_X, PAD_Y, 'VILLAGE', {
      fontFamily: FONT, fontSize: '11px', color: '#8a8f99',
    });
    this.title.setLetterSpacing(2);
    this.container.add(this.title);

    for (let i = 0; i < 5; i++) {
      const t = scene.add.text(PAD_X, PAD_Y + 22 + i * ROW_H, '', {
        fontFamily: FONT, fontSize: '13px', color: '#f0f0f0',
      });
      this.rows.push(t);
      this.container.add(t);
    }

    const chantierY = PAD_Y + 22 + 5 * ROW_H + 8;
    this.chantierLabel = scene.add.text(PAD_X, chantierY, '🔨 CHANTIER', {
      fontFamily: FONT, fontSize: '10px', color: '#8a8f99',
    });
    this.chantierLabel.setLetterSpacing(1);
    this.container.add(this.chantierLabel);

    this.chantierValue = scene.add.text(WIDTH - PAD_X, chantierY, '0/3', {
      fontFamily: FONT, fontSize: '12px', color: '#f0f0f0',
    }).setOrigin(1, 0);
    this.container.add(this.chantierValue);

    this.chantierBarBg = scene.add.graphics();
    this.chantierBarFill = scene.add.graphics();
    this.container.add(this.chantierBarBg);
    this.container.add(this.chantierBarFill);

    const openingsY = chantierY + 16 + 6 + 12;
    this.openingsLabel = scene.add.text(PAD_X, openingsY, 'OUVERTURES PRÊTES', {
      fontFamily: FONT, fontSize: '10px', color: '#8a8f99',
    });
    this.openingsLabel.setLetterSpacing(1);
    this.container.add(this.openingsLabel);

    this.openingsTokens = scene.add.graphics();
    this.container.add(this.openingsTokens);
  }

  update(state: GameState): void {
    const counts = new Map<string, number>();
    for (const b of state.world.buildings) {
      counts.set(b.kind, (counts.get(b.kind) ?? 0) + 1);
    }
    const buildingParts: string[] = [];
    for (const [kind, n] of counts) {
      buildingParts.push(`${n} ${BUILDING_LABEL_FR[kind] ?? kind}`);
    }
    const weather = weatherForDay(state.seed, state.progression.day);
    const season = seasonForDay(state.progression.day);

    const lines = [
      `👥  ${state.world.villagers.length} habitants`,
      `🌾  ${state.world.crops.length} cultures`,
      `🏛  mairie niv. ${state.progression.townHallLevel}`,
      `🏘  ${buildingParts.join(', ') || '—'}`,
      `${WEATHER_ICON[weather.kind] ?? '·'}  ${WEATHER_LABEL_FR[weather.kind] ?? weather.kind} · ${SEASON_LABEL_FR[season] ?? season}`,
    ];
    for (let i = 0; i < this.rows.length; i++) {
      this.rows[i]!.setText(lines[i] ?? '');
    }

    const threshold = thresholdFor(state.progression.townHallLevel);
    const points = state.construction.points;
    const ratio = threshold > 0 ? Math.min(1, points / threshold) : 0;
    this.chantierValue.setText(`${points}/${threshold} tâches`);

    const chantierY = PAD_Y + 22 + 5 * ROW_H + 8;
    const barY = chantierY + 16;
    const barW = WIDTH - PAD_X * 2;
    const barH = 8;

    this.chantierBarBg.clear();
    this.chantierBarBg.fillStyle(0x2a2d34, 1);
    this.chantierBarBg.fillRoundedRect(PAD_X, barY, barW, barH, 3);

    this.chantierBarFill.clear();
    if (ratio > 0) {
      this.chantierBarFill.fillStyle(0xf0a500, 1);
      this.chantierBarFill.fillRoundedRect(PAD_X, barY, Math.max(2, barW * ratio), barH, 3);
    }

    const tokensY = barY + barH + 6 + 14;
    this.openingsTokens.clear();
    for (let i = 0; i < CONSTRUCTION_OPENINGS_CAP; i++) {
      const x = PAD_X + i * (TOKEN_W + TOKEN_GAP);
      const filled = i < state.construction.openings;
      this.openingsTokens.fillStyle(filled ? 0xffd45e : 0x1f1b2b, 1);
      this.openingsTokens.fillRoundedRect(x, tokensY, TOKEN_W, TOKEN_H, 3);
      this.openingsTokens.lineStyle(1.5, filled ? 0xf0a500 : 0x4a4360, 1);
      this.openingsTokens.strokeRoundedRect(x, tokensY, TOKEN_W, TOKEN_H, 3);
    }

    const totalH = tokensY + TOKEN_H + PAD_Y;
    this.bg.clear();
    this.bg.fillStyle(0x16181d, 0.88);
    this.bg.fillRoundedRect(0, 0, WIDTH, totalH, 8);
    this.bg.lineStyle(1, 0x2a2d34, 1);
    this.bg.strokeRoundedRect(0, 0, WIDTH, totalH, 8);
  }
}
```

- [ ] **Step 2: Vérifier la compilation**

Run: `npx tsc --noEmit`
Expected: seule l'erreur `setAvailable` de Task 8 subsiste. `StatusBar` ne lit plus `state.motivation`.

- [ ] **Step 3: Commit**

```bash
git add src/ui/StatusBar.ts
git commit -m "feat(construction): show chantier bar and opening tokens in StatusBar"
```

---

## Task 11: Compteur d'ouvertures sur `ActionButton`

**Files:**
- Modify: `src/ui/ActionButton.ts:28-36,89-99`

- [ ] **Step 1: Adapter le libellé et le sous-titre**

Dans `src/ui/ActionButton.ts`, remplacer la création de `label` et `sub` (lignes 28-36) par :

```ts
    this.label = scene.add.text(34, 8, 'Ouverture du chantier', {
      fontFamily: FONT, fontSize: '13px', fontStyle: 'bold', color: '#fff8e0',
    });
    this.container.add(this.label);

    this.sub = scene.add.text(34, 25, '', {
      fontFamily: FONT, fontSize: '11px', color: '#e5c98a',
    });
    this.container.add(this.sub);
```

- [ ] **Step 2: Ajouter le paramètre `count` à `setAvailable`**

Remplacer la méthode `setAvailable` (lignes 89-99) par :

```ts
  setAvailable(available: boolean, count = 0): void {
    this.container.setVisible(available);
    this.sub.setText(count > 1 ? `${count} ouvertures en attente` : 'cliquer pour piocher');
    if (this.pulse) {
      if (available) this.pulse.resume();
      else this.pulse.pause();
    }
    if (this.dotPulse) {
      if (available) this.dotPulse.resume();
      else this.dotPulse.pause();
    }
  }
```

- [ ] **Step 3: Vérifier la compilation et lancer toute la suite de tests**

Run: `npx tsc --noEmit && npx vitest run`
Expected: aucune erreur de compilation. Tous les tests passent (la motivation existe encore comme champ inerte ; aucun test ne la référence sauf `save.test.ts`, traité en Task 12).

- [ ] **Step 4: Commit**

```bash
git add src/ui/ActionButton.ts
git commit -m "feat(construction): show pending opening count on ActionButton"
```

---

## Task 12: Retirer la motivation

**Files:**
- Modify: `src/domain/state.ts`
- Modify: `src/config.ts`
- Modify: `src/systems/save.ts`
- Test: `tests/unit/systems/save.test.ts`

- [ ] **Step 1: Réécrire les tests de `save`**

Remplacer **tout** le contenu de `tests/unit/systems/save.test.ts` par :

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { saveState, loadState, clearSave } from '../../../src/systems/save';
import { emptyState } from '../../../src/domain/state';
import { SAVE_KEY, SAVE_VERSION } from '../../../src/config';

describe('save', () => {
  let store: Record<string, string> = {};

  beforeEach(() => {
    store = {};
    (globalThis as any).localStorage = {
      getItem: (key: string) => store[key] || null,
      setItem: (key: string, value: string) => {
        store[key] = value;
      },
      removeItem: (key: string) => {
        delete store[key];
      },
      clear: () => {
        store = {};
      },
      key: (index: number) => Object.keys(store)[index] || null,
      length: Object.keys(store).length,
    } as any;
  });

  it('save+load roundtrips state', () => {
    const s = emptyState(0, 42);
    saveState(s);
    expect(loadState()).toEqual(s);
  });

  it('returns null when nothing saved', () => {
    expect(loadState()).toBeNull();
  });

  it('returns null on corrupted JSON', () => {
    localStorage.setItem(SAVE_KEY, '{not-json');
    expect(loadState()).toBeNull();
  });

  it('returns null on unknown version', () => {
    const bad = { ...emptyState(0, 1), version: 999 };
    localStorage.setItem(SAVE_KEY, JSON.stringify(bad));
    expect(loadState()).toBeNull();
  });

  it('returns null on version mismatch', () => {
    localStorage.setItem(SAVE_KEY, JSON.stringify({ version: SAVE_VERSION - 1 }));
    expect(loadState()).toBeNull();
  });

  it('clearSave removes data', () => {
    saveState(emptyState(0, 1));
    clearSave();
    expect(loadState()).toBeNull();
  });

  it('défaut le bloc construction quand il manque', () => {
    const base = emptyState(1, 42);
    const { construction: _drop, ...withoutConstruction } = base;
    localStorage.setItem(SAVE_KEY, JSON.stringify(withoutConstruction));
    const loaded = loadState();
    expect(loaded).not.toBeNull();
    expect(loaded!.construction).toEqual({ points: 0, openings: 0, lastMorningDate: '' });
  });

  it('préserve le bloc construction présent', () => {
    const s = {
      ...emptyState(1, 42),
      construction: { points: 2, openings: 1, lastMorningDate: '2026-05-21' },
    };
    saveState(s);
    expect(loadState()!.construction).toEqual({
      points: 2,
      openings: 1,
      lastMorningDate: '2026-05-21',
    });
  });
});
```

- [ ] **Step 2: Lancer les tests pour vérifier qu'ils échouent**

Run: `npx vitest run tests/unit/systems/save.test.ts`
Expected: FAIL — `loadState` ne défaut pas encore `construction`.

- [ ] **Step 3: Retirer la motivation et `lastActionDate` du type d'état**

Dans `src/domain/state.ts`, dans le type `GameState`, supprimer les lignes :

```ts
  readonly lastActionDate: string;
```

et

```ts
  readonly motivation: number;
  readonly motivationLastDecayAt: number;
```

Dans `emptyState`, supprimer la ligne `lastActionDate: '',` et les lignes `motivation: 0,` / `motivationLastDecayAt: now,`. Le bloc `construction` reste.

- [ ] **Step 4: Nettoyer `config.ts`**

Dans `src/config.ts`, supprimer les lignes :

```ts
export const BASE_CARDS_DRAWN = 3;
export const MOTIVATION_CARDS_DIV = 3;
export const MOTIVATION_BONUS_CAP = 2;
export const MOTIVATION_ACTION_COST = 10;
export const MOTIVATION_DECAY_HOURS = 12;
```

- [ ] **Step 5: Mettre à jour `loadState`**

Dans `src/systems/save.ts`, remplacer le corps du `try` de `loadState` (le bloc `const parsed = ...` jusqu'au `return { ... }`) par :

```ts
    const parsed = JSON.parse(raw) as Partial<GameState> & {
      version?: number;
      construction?: GameState['construction'];
    };
    if (parsed.version !== SAVE_VERSION) {
      console.warn('save version mismatch; ignoring');
      return null;
    }
    const base = parsed as GameState;
    return {
      ...base,
      construction: parsed.construction ?? { points: 0, openings: 0, lastMorningDate: '' },
    };
```

- [ ] **Step 6: Bumper `SAVE_VERSION`**

Dans `src/config.ts`, passer `SAVE_VERSION` de `5` à `6` :

```ts
export const SAVE_VERSION = 6;
```

- [ ] **Step 7: Lancer toute la suite de tests et le type-check**

Run: `npx tsc --noEmit && npx vitest run`
Expected: aucune erreur de compilation, tous les tests passent. Si une référence à `motivation`, `motivationLastDecayAt`, `lastActionDate`, `BASE_CARDS_DRAWN` ou une constante `MOTIVATION_*` subsiste, `tsc` la signale — la corriger avant de committer.

- [ ] **Step 8: Commit**

```bash
git add src/domain/state.ts src/config.ts src/systems/save.ts tests/unit/systems/save.test.ts
git commit -m "refactor(construction): remove motivation system, bump save version"
```

---

## Task 13: Vérification de bout en bout

**Files:** aucun (vérification)

- [ ] **Step 1: Suite complète**

Run: `npx tsc --noEmit && npx eslint src && npx vitest run`
Expected: zéro erreur, tous les tests verts.

- [ ] **Step 2: Vérification manuelle dans le navigateur**

Run: `npm run dev` puis ouvrir l'URL servie.
Vérifier :
- La barre « 🔨 CHANTIER » s'affiche dans le panneau de statut, avec les jetons d'ouvertures.
- Cocher un todo fait monter la barre de chantier ; en décocher un la fait redescendre.
- Atteindre le seuil (3 au niveau 1) débloque un jeton d'ouverture et le bouton « Ouverture du chantier ».
- Cliquer le bouton ouvre le tirage de cartes ; jouer une carte consomme une ouverture ; annuler n'en consomme aucune.
- Recharger la page un nouveau jour (ou avancer l'horloge) accorde l'ouverture du matin.

- [ ] **Step 3: Commit éventuel**

Si des corrections ont été nécessaires, les committer avec un message `fix(construction): ...` approprié.

---

## Notes de vérification (self-review)

- **Couverture du spec :** points de construction (Task 3, 9), seuil croissant `thresholdFor` (Task 3), ouvertures + plafond souple `OPENINGS_CAP` (Task 3), ouverture du matin (Task 4, 5), tirage par niveau `poolSizeFor` (Task 3, 6), bouton actif sur file non vide (Task 8), suppression motivation (Task 12), barre de chantier UI option A (Task 10, 11), persistance sans changement de schéma + bump version (Task 12). Tous couverts.
- **Décision d'implémentation :** l'ouverture est consommée dans `applyChosenCard` (quand une carte est jouée), pas à l'ouverture de l'overlay. Cela préserve le comportement actuel « carte non jouée = aucun coût » et reste fidèle à l'intention du spec (une ouverture = une carte jouée).
- **`tests/integration/scenario.test.ts` :** inchangé. Il appelle `applyChosenCard` chaque jour sans passer par le filtre UI ; `consumeOpening` plafonne à 0, l'effet de carte s'applique quand même. Vérifié en Task 5 Step 5.
- **Migration Supabase :** `game_states.state` est un `jsonb` ; aucun changement de schéma. Les anciennes sauvegardes locales (version 5) sont écartées par le contrôle de version de `loadState` ; `loadState` défaut défensivement `construction` pour toute sauvegarde de version courante où le bloc manquerait.
