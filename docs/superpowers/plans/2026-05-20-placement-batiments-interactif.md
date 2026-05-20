# Placement interactif des bâtiments — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Quand le joueur joue une carte « bâtiment », un mode placement interactif s'ouvre — ghost déplaçable, validation visuelle vert/rouge, confirmation au clic, annulation sans coût.

**Architecture:** Approche B du design — une unité `PlacementController` autonome (Phaser) gère le cycle ghost/drag/confirm/cancel. `WorldScene` expose `beginPlacement()` et suspend le pan caméra. `UIScene` garde la carte en attente et dépense la motivation au confirm. La logique pure (`worldPixelToTile`, validation via `isFootprintFree`) est testable hors Phaser.

**Tech Stack:** TypeScript, Phaser 3, Vitest.

Spec source : `docs/superpowers/specs/2026-05-20-placement-batiments-interactif-design.md`

**Note d'implémentation vs spec :** le polish d'apparition est réalisé en animant le *ghost* lui-même (tween `alpha 0.6→1` + `scale 0.85→1`, `Back.easeOut`, 180 ms) avant de le détruire et de déclencher le refresh — au lieu de retrouver le sprite reconstruit dans `buildingLayer`. Résultat visuel identique, couplage moindre (`PlacementController` n'a pas besoin de fouiller `buildingLayer`).

---

## Structure des fichiers

| Fichier | Responsabilité |
|---|---|
| `src/systems/placement/placementRules.ts` (créé) | `worldPixelToTile()` — conversion pixel monde → tuile, pure |
| `src/systems/placement/PlacementController.ts` (créé) | Mode placement : ghost + surlignage + handlers pointeur/clavier + tween de confirmation |
| `src/cards/types.ts` (modifié) | Flag `placementKind` + signature `effect` avec `coords?` |
| `src/cards/deck.ts` (modifié) | Helper `placeAt`, cartes bâtiment taguées `placementKind` |
| `src/systems/dailyAction.ts` (modifié) | `applyChosenCard` propage `coords?` |
| `src/scenes/WorldScene.ts` (modifié) | `beginPlacement()`, suspension du pan, `disableContextMenu` |
| `src/scenes/UIScene.ts` (modifié) | Branchement `pickCard` sur `placementKind`, re-show overlay à l'annulation |
| `tests/unit/systems/placement/placementRules.test.ts` (créé) | Tests `worldPixelToTile` |
| `tests/unit/cards/deck.test.ts` (modifié) | Tests effet avec/sans coords + `placementKind` |
| `tests/unit/systems/dailyAction.test.ts` (modifié) | Test `applyChosenCard` avec coords |

---

## Task 0 : Créer la branche

- [ ] **Step 1 : Créer et basculer sur la branche de feature**

Run :
```bash
git checkout -b feat/MH/placement-interactif
```
Expected : `Switched to a new branch 'feat/MH/placement-interactif'`

---

## Task 1 : `placementRules.ts` — conversion pixel → tuile

**Files:**
- Create: `src/systems/placement/placementRules.ts`
- Test: `tests/unit/systems/placement/placementRules.test.ts`

- [ ] **Step 1 : Écrire le test qui échoue**

Créer `tests/unit/systems/placement/placementRules.test.ts` :
```ts
import { describe, it, expect } from 'vitest';
import { worldPixelToTile } from '../../../../src/systems/placement/placementRules';
import { TILE_SIZE } from '../../../../src/config';

describe('worldPixelToTile', () => {
  it('maps a pixel inside a tile to that tile', () => {
    expect(worldPixelToTile(0, 0)).toEqual({ x: 0, y: 0 });
    expect(worldPixelToTile(TILE_SIZE + 3, TILE_SIZE * 2 + 1)).toEqual({ x: 1, y: 2 });
  });

  it('floors fractional pixels within a tile', () => {
    expect(worldPixelToTile(TILE_SIZE - 1, TILE_SIZE - 1)).toEqual({ x: 0, y: 0 });
  });

  it('handles negative pixels (off the grid)', () => {
    expect(worldPixelToTile(-1, -1)).toEqual({ x: -1, y: -1 });
  });
});
```

- [ ] **Step 2 : Lancer le test pour vérifier l'échec**

Run : `npx vitest run tests/unit/systems/placement/placementRules.test.ts`
Expected : FAIL — `Failed to resolve import ".../placementRules"`

- [ ] **Step 3 : Écrire l'implémentation minimale**

Créer `src/systems/placement/placementRules.ts` :
```ts
import { TILE_SIZE } from '../../config';

/** World-pixel coordinate → tile coordinate. May return out-of-bounds tiles. */
export function worldPixelToTile(px: number, py: number): { x: number; y: number } {
  return { x: Math.floor(px / TILE_SIZE), y: Math.floor(py / TILE_SIZE) };
}
```

- [ ] **Step 4 : Lancer le test pour vérifier le succès**

Run : `npx vitest run tests/unit/systems/placement/placementRules.test.ts`
Expected : PASS — 3 tests

- [ ] **Step 5 : Commit**

```bash
git add src/systems/placement/placementRules.ts tests/unit/systems/placement/placementRules.test.ts
git commit -m "feat(todo): worldPixelToTile pour le placement interactif

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 2 : Étendre le type `ActionCard`

**Files:**
- Modify: `src/cards/types.ts`

Aucun test dédié — vérifié au typecheck. La signature `effect` reste rétro-compatible (les effets existants `(s, now) => ...` satisfont une signature à 3e paramètre optionnel).

- [ ] **Step 1 : Modifier `src/cards/types.ts`**

Remplacer le contenu intégral du fichier par :
```ts
import { GameState } from '../domain/state';
import { BuildingKind } from '../domain/building';

export type CardCategory =
  | 'housing'
  | 'work'
  | 'recruit'
  | 'assign'
  | 'infrastructure'
  | 'townHall'
  | 'event';

export type ActionCard = {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly icon: string;
  readonly category: CardCategory;
  readonly minTier: number;
  readonly weight: number;
  /** Si défini : la carte ouvre le mode placement interactif pour ce type de bâtiment. */
  readonly placementKind?: BuildingKind;
  readonly isAvailable: (state: GameState) => boolean;
  readonly effect: (
    state: GameState,
    now: number,
    coords?: { x: number; y: number },
  ) => GameState;
};
```

- [ ] **Step 2 : Vérifier le typecheck**

Run : `npx tsc --noEmit`
Expected : PASS — aucune erreur

- [ ] **Step 3 : Commit**

```bash
git add src/cards/types.ts
git commit -m "feat(todo): champ placementKind et coords sur ActionCard

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 3 : Cartes bâtiment — helper `placeAt` + `placementKind`

**Files:**
- Modify: `src/cards/deck.ts`
- Test: `tests/unit/cards/deck.test.ts`

- [ ] **Step 1 : Écrire les tests qui échouent**

Dans `tests/unit/cards/deck.test.ts`, remplacer la ligne d'import worldOps :
```ts
import { placeBuilding } from '../../../src/systems/worldOps';
```
par :
```ts
import { placeBuilding, isFootprintFree } from '../../../src/systems/worldOps';
```

Puis ajouter, avant la dernière ligne `});` qui ferme le `describe('deck', ...)`, les tests suivants :
```ts
  it('build_house effect places at explicit coords', () => {
    let s = emptyState(0, 1);
    s = placeBuilding(s, 'townHall', 15, 15, 0);
    const next = cardById('build_house').effect(s, 0, { x: 2, y: 2 });
    const house = next.world.buildings.find((b) => b.kind === 'house');
    expect(house).toBeDefined();
    expect(house!.tileX).toBe(2);
    expect(house!.tileY).toBe(2);
  });

  it('build_house effect falls back to a free spot when coords overlap', () => {
    let s = emptyState(0, 1);
    s = placeBuilding(s, 'townHall', 15, 15, 0);
    // {15,15} chevauche la mairie -> invalide -> repli findFreeSpot
    const next = cardById('build_house').effect(s, 0, { x: 15, y: 15 });
    const house = next.world.buildings.find((b) => b.kind === 'house');
    expect(house).toBeDefined();
    expect(isFootprintFree(s, 'house', house!.tileX, house!.tileY)).toBe(true);
  });

  it('build_house effect still works without coords', () => {
    let s = emptyState(0, 1);
    s = placeBuilding(s, 'townHall', 15, 15, 0);
    const next = cardById('build_house').effect(s, 0);
    expect(next.world.buildings.filter((b) => b.kind === 'house')).toHaveLength(1);
  });

  it('building cards expose placementKind, others do not', () => {
    expect(cardById('build_house').placementKind).toBe('house');
    expect(cardById('build_well').placementKind).toBe('well');
    expect(cardById('recruit_villager').placementKind).toBeUndefined();
    expect(cardById('upgrade_town_hall').placementKind).toBeUndefined();
  });
```

- [ ] **Step 2 : Lancer les tests pour vérifier l'échec**

Run : `npx vitest run tests/unit/cards/deck.test.ts`
Expected : FAIL — les nouveaux tests échouent (coords ignoré, `placementKind` undefined)

- [ ] **Step 3 : Modifier `src/cards/deck.ts`**

Remplacer la ligne d'import worldOps :
```ts
import { placeBuilding, findFreeSpot } from '../systems/worldOps';
```
par :
```ts
import { placeBuilding, findFreeSpot, isFootprintFree } from '../systems/worldOps';
```

Remplacer la ligne d'import building :
```ts
import { isWorkBuilding } from '../domain/building';
```
par :
```ts
import { isWorkBuilding, BuildingKind } from '../domain/building';
```

Ajouter ce helper juste après la fonction `pickFreeHouseId` (avant `export const ALL_CARDS`) :
```ts
/**
 * Pose un bâtiment. Si `coords` est fourni et la case est libre, pose là ;
 * sinon repli sur findFreeSpot autour de la mairie (ceinture + bretelles —
 * PlacementController ne confirme déjà que des cases valides).
 */
function placeAt(
  s: GameState,
  kind: BuildingKind,
  now: number,
  coords: { x: number; y: number } | undefined,
): GameState {
  if (coords && isFootprintFree(s, kind, coords.x, coords.y)) {
    return placeBuilding(s, kind, coords.x, coords.y, now);
  }
  const c = townHallOrCenter(s);
  const spot = findFreeSpot(s, kind, c.x, c.y);
  if (!spot) return s;
  return placeBuilding(s, kind, spot.x, spot.y, now);
}
```

Pour chacune des 5 cartes bâtiment, ajouter une ligne `placementKind` (un `BuildingKind`, pas la `category`) et remplacer le bloc `effect`. Appliquer exactement :

`build_house` :
```ts
    placementKind: 'house',
    isAvailable: (s) => {
      const c = townHallOrCenter(s);
      return findFreeSpot(s, 'house', c.x, c.y) !== null;
    },
    effect: (s, now, coords) => placeAt(s, 'house', now, coords),
```

`build_farm` :
```ts
    placementKind: 'farm',
    isAvailable: (s) => {
      const c = townHallOrCenter(s);
      return findFreeSpot(s, 'farm', c.x, c.y) !== null;
    },
    effect: (s, now, coords) => placeAt(s, 'farm', now, coords),
```

`build_forge` :
```ts
    placementKind: 'forge',
    isAvailable: (s) => {
      if (s.progression.townHallLevel < 2) return false;
      const c = townHallOrCenter(s);
      return findFreeSpot(s, 'forge', c.x, c.y) !== null;
    },
    effect: (s, now, coords) => placeAt(s, 'forge', now, coords),
```

`build_mill` :
```ts
    placementKind: 'mill',
    isAvailable: (s) => {
      if (s.progression.townHallLevel < 2) return false;
      const c = townHallOrCenter(s);
      return findFreeSpot(s, 'mill', c.x, c.y) !== null;
    },
    effect: (s, now, coords) => placeAt(s, 'mill', now, coords),
```

`build_well` :
```ts
    placementKind: 'well',
    isAvailable: (s) => {
      const c = townHallOrCenter(s);
      return findFreeSpot(s, 'well', c.x, c.y) !== null;
    },
    effect: (s, now, coords) => placeAt(s, 'well', now, coords),
```

Pour chaque carte, `placementKind` se place entre la ligne `weight: ...,` et la ligne `isAvailable:`. Les blocs `isAvailable` ci-dessus sont identiques à l'existant — seul `effect` change et `placementKind` est ajouté.

- [ ] **Step 4 : Lancer les tests pour vérifier le succès**

Run : `npx vitest run tests/unit/cards/deck.test.ts`
Expected : PASS — tous les tests `deck` verts

- [ ] **Step 5 : Vérifier le typecheck**

Run : `npx tsc --noEmit`
Expected : PASS

- [ ] **Step 6 : Commit**

```bash
git add src/cards/deck.ts tests/unit/cards/deck.test.ts
git commit -m "feat(todo): cartes bâtiment acceptent des coords de placement

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 4 : `applyChosenCard` propage les coords

**Files:**
- Modify: `src/systems/dailyAction.ts`
- Test: `tests/unit/systems/dailyAction.test.ts`

- [ ] **Step 1 : Écrire le test qui échoue**

Dans `tests/unit/systems/dailyAction.test.ts`, ajouter ce bloc à la fin du fichier :
```ts
describe('applyChosenCard placement coords', () => {
  beforeEach(() => resetIdsForTests());

  it('places building at explicit coords when provided', () => {
    let s = emptyState(0, 1);
    s = placeBuilding(s, 'townHall', 15, 15, 0);
    const now = new Date(2026, 4, 21, 7).getTime();
    const next = applyChosenCard(s, 'build_house', now, { x: 3, y: 3 });
    const house = next.world.buildings.find((b) => b.kind === 'house');
    expect(house).toBeDefined();
    expect(house!.tileX).toBe(3);
    expect(house!.tileY).toBe(3);
    expect(next.lastActionDate).toBe('2026-05-21');
  });

  it('still auto-places when no coords given', () => {
    let s = emptyState(0, 1);
    s = placeBuilding(s, 'townHall', 15, 15, 0);
    const now = new Date(2026, 4, 21, 7).getTime();
    const next = applyChosenCard(s, 'build_house', now);
    expect(next.world.buildings.filter((b) => b.kind === 'house')).toHaveLength(1);
  });
});
```

- [ ] **Step 2 : Lancer le test pour vérifier l'échec**

Run : `npx vitest run tests/unit/systems/dailyAction.test.ts`
Expected : FAIL — `applyChosenCard` n'accepte pas de 4e argument (le bâtiment n'est pas posé en {3,3})

- [ ] **Step 3 : Modifier `src/systems/dailyAction.ts`**

Remplacer la fonction `applyChosenCard` (lignes 52-57) par :
```ts
export function applyChosenCard(
  state: GameState,
  cardId: string,
  now: number,
  coords?: { x: number; y: number },
): GameState {
  const card = cardById(cardId);
  const after = card.effect(state, now, coords);
  const motivation = Math.max(0, state.motivation - MOTIVATION_ACTION_COST);
  return { ...after, lastActionDate: dateKey(now), lastSeenAt: now, motivation };
}
```

- [ ] **Step 4 : Lancer le test pour vérifier le succès**

Run : `npx vitest run tests/unit/systems/dailyAction.test.ts`
Expected : PASS — tous les tests `dailyAction` verts

- [ ] **Step 5 : Commit**

```bash
git add src/systems/dailyAction.ts tests/unit/systems/dailyAction.test.ts
git commit -m "feat(todo): applyChosenCard propage les coords de placement

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 5 : `PlacementController`

**Files:**
- Create: `src/systems/placement/PlacementController.ts`

Pas de test unitaire — classe liée à Phaser, validée au typecheck (Task 8) et à la checklist manuelle (Task 9).

- [ ] **Step 1 : Créer `src/systems/placement/PlacementController.ts`**

```ts
import Phaser from 'phaser';
import { BuildingKind, BUILDING_FOOTPRINT } from '../../domain/building';
import { TILE_SIZE, MAP_WIDTH, MAP_HEIGHT } from '../../config';
import { TT_SHEET, buildingLayout, buildingFrame } from '../../rendering/frames';
import { worldPixelToTile } from './placementRules';

export type PlacementCallbacks = {
  /** true si le bâtiment peut être posé sur cette tuile (coin haut-gauche). */
  readonly isValid: (tileX: number, tileY: number) => boolean;
  readonly onConfirm: (coords: { x: number; y: number }) => void;
  readonly onCancel: () => void;
};

const GHOST_ALPHA = 0.6;
const VALID_COLOR = 0x33dd55;
const INVALID_COLOR = 0xdd3333;
const CONFIRM_MS = 180;

/**
 * Mode placement interactif : ghost semi-transparent qui suit le curseur,
 * surlignage vert/rouge, confirmation au clic gauche, annulation au clic
 * droit ou Échap. Possède tous ses GameObjects ; `destroy()` nettoie tout.
 */
export class PlacementController {
  private readonly ghost: Phaser.GameObjects.Container;
  private readonly highlight: Phaser.GameObjects.Rectangle;
  private readonly fpW: number;
  private readonly fpH: number;
  private tileX: number;
  private tileY: number;
  private valid: boolean;
  private finished = false;
  private readonly keyEsc: Phaser.Input.Keyboard.Key | undefined;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly kind: BuildingKind,
    initial: { x: number; y: number },
    private readonly cb: PlacementCallbacks,
  ) {
    const fp = BUILDING_FOOTPRINT[kind];
    this.fpW = fp.w;
    this.fpH = fp.h;
    this.tileX = initial.x;
    this.tileY = initial.y;

    this.highlight = scene.add
      .rectangle(0, 0, this.fpW * TILE_SIZE, this.fpH * TILE_SIZE, VALID_COLOR, 0.3)
      .setOrigin(0, 0)
      .setDepth(900);
    this.ghost = this.buildGhost();
    this.ghost.setDepth(901);

    this.valid = cb.isValid(this.tileX, this.tileY);
    this.sync();

    scene.input.on('pointermove', this.onMove, this);
    scene.input.on('pointerdown', this.onDown, this);
    this.keyEsc = scene.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
    this.keyEsc?.on('down', this.onEsc, this);
  }

  /** Container dont le point de transfert (0,0) est le CENTRE du footprint. */
  private buildGhost(): Phaser.GameObjects.Container {
    const container = this.scene.add.container(0, 0);
    const halfW = (this.fpW * TILE_SIZE) / 2;
    const halfH = (this.fpH * TILE_SIZE) / 2;
    const layout = buildingLayout(this.kind);
    if (layout) {
      const rows = layout.length;
      const cols = layout[0]!.length;
      const cellW = (this.fpW * TILE_SIZE) / cols;
      const cellH = (this.fpH * TILE_SIZE) / rows;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const img = this.scene.add
            .image(c * cellW - halfW, r * cellH - halfH, TT_SHEET, layout[r]![c]!)
            .setOrigin(0, 0)
            .setDisplaySize(cellW, cellH);
          container.add(img);
        }
      }
    } else {
      const img = this.scene.add
        .image(-halfW, -halfH, TT_SHEET, buildingFrame(this.kind))
        .setOrigin(0, 0)
        .setDisplaySize(this.fpW * TILE_SIZE, this.fpH * TILE_SIZE);
      container.add(img);
    }
    container.setAlpha(GHOST_ALPHA);
    return container;
  }

  /** Repositionne ghost (centré) + surlignage (coin haut-gauche) sur la tuile courante. */
  private sync(): void {
    const px = this.tileX * TILE_SIZE;
    const py = this.tileY * TILE_SIZE;
    this.ghost.setPosition(px + (this.fpW * TILE_SIZE) / 2, py + (this.fpH * TILE_SIZE) / 2);
    this.highlight.setPosition(px, py);
    this.highlight.setFillStyle(this.valid ? VALID_COLOR : INVALID_COLOR, 0.3);
  }

  private setVisible(on: boolean): void {
    this.ghost.setVisible(on);
    this.highlight.setVisible(on);
  }

  private onMove(p: Phaser.Input.Pointer): void {
    if (this.finished) return;
    const wp = this.scene.cameras.main.getWorldPoint(p.x, p.y);
    const t = worldPixelToTile(wp.x, wp.y);
    if (t.x < 0 || t.y < 0 || t.x >= MAP_WIDTH || t.y >= MAP_HEIGHT) {
      this.setVisible(false);
      return;
    }
    this.setVisible(true);
    this.tileX = t.x;
    this.tileY = t.y;
    this.valid = this.cb.isValid(t.x, t.y);
    this.sync();
  }

  private onDown(p: Phaser.Input.Pointer): void {
    if (this.finished) return;
    if (p.rightButtonDown()) {
      this.cancel();
      return;
    }
    if (!this.ghost.visible || !this.valid) return;
    this.confirm();
  }

  private onEsc(): void {
    if (this.finished) return;
    this.cancel();
  }

  /** Tween d'apparition sur le ghost, puis teardown + callback de confirmation. */
  private confirm(): void {
    this.finished = true;
    const coords = { x: this.tileX, y: this.tileY };
    this.ghost.setScale(0.85);
    this.scene.tweens.add({
      targets: this.ghost,
      alpha: 1,
      scale: 1,
      duration: CONFIRM_MS,
      ease: 'Back.easeOut',
      onComplete: () => {
        this.destroy();
        this.cb.onConfirm(coords);
      },
    });
  }

  private cancel(): void {
    this.finished = true;
    this.destroy();
    this.cb.onCancel();
  }

  /** Retire tous les handlers et détruit ghost + surlignage. Idempotent en pratique. */
  destroy(): void {
    this.scene.input.off('pointermove', this.onMove, this);
    this.scene.input.off('pointerdown', this.onDown, this);
    this.keyEsc?.off('down', this.onEsc, this);
    if (this.keyEsc) this.scene.input.keyboard?.removeKey(this.keyEsc);
    this.ghost.destroy(true);
    this.highlight.destroy();
  }
}
```

- [ ] **Step 2 : Vérifier le typecheck**

Run : `npx tsc --noEmit`
Expected : PASS — aucune erreur

- [ ] **Step 3 : Commit**

```bash
git add src/systems/placement/PlacementController.ts
git commit -m "feat(todo): PlacementController pour le placement interactif

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 6 : `WorldScene.beginPlacement` + suspension du pan

**Files:**
- Modify: `src/scenes/WorldScene.ts`

Validé au typecheck et à la checklist manuelle.

- [ ] **Step 1 : Ajouter les imports dans `src/scenes/WorldScene.ts`**

Après la ligne `import { BUILDING_FOOTPRINT } from '../domain/building';`, remplacer cette ligne par :
```ts
import { BUILDING_FOOTPRINT, BuildingKind } from '../domain/building';
import { findFreeSpot, isFootprintFree } from '../systems/worldOps';
import { PlacementController } from '../systems/placement/PlacementController';
```

- [ ] **Step 2 : Ajouter les champs d'instance**

Après la ligne `private debugVisible = false;`, ajouter :
```ts
  private placementActive = false;
  private placement?: PlacementController;
```

- [ ] **Step 3 : Suspendre le pan caméra pendant le placement**

Dans `create()`, le handler `pointerdown` du pan commence par :
```ts
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      dragging = true;
```
Remplacer ces deux lignes par :
```ts
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (this.placementActive) return;
      dragging = true;
```

Le handler `pointermove` du pan commence par :
```ts
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (!dragging) return;
```
Remplacer ces deux lignes par :
```ts
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (this.placementActive || !dragging) return;
```

- [ ] **Step 4 : Désactiver le menu contextuel du clic droit**

Toujours dans `create()`, juste après la ligne `const now = Date.now();` (première ligne de `create()`), ajouter :
```ts
    this.input.mouse?.disableContextMenu();
```

- [ ] **Step 5 : Ajouter `beginPlacement` et `placementOrigin`**

Juste après la méthode `getState()` (la ligne `getState(): GameState { return this.state; }`), ajouter :
```ts

  /** Origine de la recherche du spot initial : la mairie, sinon le centre du monde. */
  private placementOrigin(): { x: number; y: number } {
    const th = this.state.world.buildings.find((b) => b.kind === 'townHall');
    if (th) return { x: th.tileX, y: th.tileY };
    return { x: Math.floor(MAP_WIDTH / 2), y: Math.floor(MAP_HEIGHT / 2) };
  }

  /**
   * Ouvre le mode placement interactif. Suspend le pan caméra jusqu'à
   * confirmation ou annulation. Si aucun spot initial libre, annule d'emblée.
   */
  beginPlacement(
    kind: BuildingKind,
    onConfirm: (coords: { x: number; y: number }) => void,
    onCancel: () => void,
  ): void {
    if (this.placementActive) return;
    const origin = this.placementOrigin();
    const initial = findFreeSpot(this.state, kind, origin.x, origin.y);
    if (!initial) {
      onCancel();
      return;
    }
    this.placementActive = true;
    this.placement = new PlacementController(this, kind, initial, {
      isValid: (x, y) => isFootprintFree(this.state, kind, x, y),
      onConfirm: (coords) => {
        this.placementActive = false;
        this.placement = undefined;
        onConfirm(coords);
      },
      onCancel: () => {
        this.placementActive = false;
        this.placement = undefined;
        onCancel();
      },
    });
  }
```

- [ ] **Step 6 : Vérifier le typecheck**

Run : `npx tsc --noEmit`
Expected : PASS — aucune erreur

- [ ] **Step 7 : Commit**

```bash
git add src/scenes/WorldScene.ts
git commit -m "feat(todo): WorldScene.beginPlacement et suspension du pan

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 7 : `UIScene.pickCard` — branchement placement

**Files:**
- Modify: `src/scenes/UIScene.ts`

Validé au typecheck et à la checklist manuelle.

- [ ] **Step 1 : Ajouter les imports et le champ `cardById`**

Dans `src/scenes/UIScene.ts`, remplacer la ligne d'import dailyAction :
```ts
import { drawCards, applyChosenCard, isActionAvailable } from '../systems/dailyAction';
```
par :
```ts
import { drawCards, applyChosenCard, isActionAvailable } from '../systems/dailyAction';
import { cardById } from '../cards/deck';
import { ActionCard } from '../cards/types';
```

- [ ] **Step 2 : Ajouter les champs d'instance**

Après la ligne `private overlay!: CardOverlay;`, ajouter :
```ts
  private placing = false;
  private drawnCards: readonly ActionCard[] = [];
```

- [ ] **Step 3 : Mémoriser les cartes tirées**

Dans `openAction()`, remplacer la ligne :
```ts
    if (cards.length === 0) return;
    this.overlay.show(cards);
```
par :
```ts
    if (cards.length === 0) return;
    this.drawnCards = cards;
    this.overlay.show(cards);
```

- [ ] **Step 4 : Remplacer `pickCard`**

Remplacer intégralement la méthode `pickCard` par :
```ts
  private pickCard(cardId: string): void {
    if (this.placing) return;
    const world = this.scene.get('WorldScene') as WorldScene;
    const card = cardById(cardId);

    if (card.placementKind) {
      this.placing = true;
      this.overlay.hide();
      world.beginPlacement(
        card.placementKind,
        (coords) => {
          this.placing = false;
          const next = applyChosenCard(world.getState(), cardId, Date.now(), coords);
          world.refresh(next);
        },
        () => {
          this.placing = false;
          // Carte non jouée : aucun coût, on ré-affiche le choix de cartes.
          this.overlay.show(this.drawnCards);
        },
      );
      return;
    }

    const next = applyChosenCard(world.getState(), cardId, Date.now());
    world.refresh(next);
    this.overlay.hide();
  }
```

- [ ] **Step 5 : Vérifier le typecheck**

Run : `npx tsc --noEmit`
Expected : PASS — aucune erreur

- [ ] **Step 6 : Commit**

```bash
git add src/scenes/UIScene.ts
git commit -m "feat(todo): UIScene ouvre le placement interactif pour les bâtiments

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 8 : Vérification automatisée complète

- [ ] **Step 1 : Typecheck global**

Run : `npx tsc --noEmit`
Expected : PASS — aucune erreur

- [ ] **Step 2 : Suite de tests complète**

Run : `npx vitest run`
Expected : PASS — tous les fichiers de test verts (les 135 existants + les nouveaux : 3 `worldPixelToTile`, 4 `deck`, 2 `dailyAction`)

- [ ] **Step 3 : Build de production**

Run : `npm run build`
Expected : build réussi, aucune erreur

---

## Task 9 : Vérification manuelle (checklist navigateur)

Lancer le jeu (`npm run dev`), ouvrir l'URL locale. Avancer jusqu'à pouvoir jouer une action (bouton d'action disponible).

- [ ] Jouer une carte bâtiment (ex. « Construire une maison ») → l'overlay se ferme, un ghost semi-transparent apparaît
- [ ] Le ghost suit le curseur et se cale sur la grille (snap tuile)
- [ ] Surlignage **vert** sur case valide, **rouge** sur case occupée / hors bornes
- [ ] Clic gauche sur case **invalide** → rien ne se passe
- [ ] Clic gauche sur case **valide** → petit tween d'apparition, bâtiment posé à l'emplacement choisi, motivation −10
- [ ] Curseur hors de la grille → ghost caché
- [ ] Pendant le placement, le drag de la caméra (pan) est **désactivé** ; il refonctionne après confirmation/annulation
- [ ] `Échap` pendant le placement → annule, l'overlay de cartes réapparaît, motivation **inchangée**
- [ ] Clic droit pendant le placement → annule de la même façon, pas de menu contextuel navigateur
- [ ] Tester avec le puits (footprint 1×2) : le ghost montre toit + eau, demande 2 cases libres en hauteur
- [ ] Une carte non-bâtiment (ex. « Accueillir un villageois ») s'applique directement, sans mode placement

- [ ] **Commit final** (si des ajustements ont été nécessaires pendant la vérif)

```bash
git add -A
git commit -m "fix(todo): ajustements placement interactif après vérification

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Auto-revue du plan

**Couverture du spec :**
- Mode hybride (suggestion + ajustement) → Task 5/6 (spot initial via `findFreeSpot`, ghost déplaçable) ✓
- Drag libre + vert/rouge → Task 5 (`onMove`, `highlight`) ✓
- Annulation sans coût, carte rendue → Task 7 (`onCancel` ré-affiche l'overlay, motivation non touchée) ✓
- Coût motivation au confirm → Task 7 (`applyChosenCard` appelé seulement dans `onConfirm`) ✓
- Polish d'apparition → Task 5 (`confirm()` tween alpha+scale) ✓
- `PlacementController` dédié → Task 5 ✓
- Suspension du pan → Task 6 ✓
- Garde-fou un seul placement → Task 6 (`placementActive`) + Task 7 (`placing`) ✓
- Cas zéro spot → Task 6 (`beginPlacement` annule si `findFreeSpot` null) ✓
- Tests unitaires (`worldPixelToTile`, `applyChosenCard` coords, `effect` coords + fallback) → Tasks 1/3/4 ✓
- Checklist manuelle → Task 9 ✓

**Cohérence des types :** `coords: { x: number; y: number }` uniforme partout ; `placementKind: BuildingKind` ; `effect(state, now, coords?)` aligné entre `types.ts`, `deck.ts`, `dailyAction.ts` ; `PlacementCallbacks` (`isValid`/`onConfirm`/`onCancel`) cohérent entre `PlacementController` et `WorldScene.beginPlacement`. ✓

**Placeholders :** aucun — chaque step contient le code complet. ✓
