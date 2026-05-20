# Placement interactif des bâtiments — Design

Date : 2026-05-20
Branche : `feat/MH/daily-stats` (le travail de placement aura sa propre branche)

## Contexte

Aujourd'hui, jouer une carte « bâtiment » place automatiquement le bâtiment :
`card.effect(s, now)` appelle `findFreeSpot()` (recherche en spirale autour de la
mairie), puis `placeBuilding()`. Le joueur ne choisit rien. Les bâtiments
s'agglomèrent de façon déterministe autour de la mairie et peuvent se coller.

Objectif : rendre le placement plus agréable via un **mode hybride** — le jeu
propose un emplacement, le joueur le déplace librement sur la grille, puis valide.

## Décisions produit (validées)

- **Rôle joueur** : hybride — suggestion du jeu + ajustement libre.
- **Ajustement** : drag/hover libre sur la grille ; tuiles valides en vert,
  invalides en rouge ; clic = valider.
- **Annulation** : `Échap` / clic droit annule. La carte reste disponible,
  **aucune motivation dépensée**. Le coût n'est payé qu'à la validation.
- **Polish** : le bâtiment validé apparaît avec un tween (fade + scale).

## Approche retenue

**Approche B — `PlacementController` dédié.** Le placement est un mode interactif
autonome avec son propre cycle de vie (`start → drag → confirm | cancel →
teardown`). Il mérite sa propre unité. `WorldScene` reste un orchestrateur de
rendu, pas un gestionnaire de modes.

Approches écartées :
- **A — seam minimal** : logique placement inline dans `WorldScene`, qui gère
  déjà pan/zoom/hover (~120 lignes d'input). Mélange des responsabilités,
  difficile à tester.
- **C — `PlacementScene` Phaser dédiée** : surdimensionné. Duplique l'accès
  caméra/layers entre scenes, sync state lourde. YAGNI.

## Architecture & composants

| Élément | Rôle |
|---|---|
| `src/systems/placement/PlacementController.ts` (classe) | possède ghost sprite + surlignage d'empreinte, hooke les pointeurs, appelle la validation, déclenche les callbacks `onConfirm` / `onCancel` |
| `src/systems/placement/placementRules.ts` (fns pures) | `pixelToTile()` ; réutilise `isFootprintFree()` de `worldOps`. Logique testable sans Phaser |
| `WorldScene.beginPlacement(kind, onConfirm, onCancel)` | instancie le controller, **suspend le drag-pan**, le détruit en fin de cycle |
| `cards/types.ts` | flag `needsPlacement?: boolean` sur `ActionCard` |
| `cards/deck.ts` | cartes bâtiment taguées `needsPlacement` ; `effect` accepte des coords explicites optionnelles |
| `systems/dailyAction.ts` | `applyChosenCard` accepte des coords optionnelles |

**Frontières :**
- `PlacementController` ne connaît que : la scene Phaser, le `kind`, le spot
  initial, les callbacks. Aucune dépendance au deck ni à l'UI.
- `WorldScene` reste orchestrateur de rendu ; il expose seulement
  `beginPlacement`.
- `UIScene` garde la carte en attente (`pendingCard`) et dépense la motivation
  **au confirm uniquement**.

## Flux de données

```
1. Joueur clique une carte bâtiment (CardOverlay → onPick)
2. UIScene.pickCard détecte needsPlacement
     → PAS de applyChosenCard, PAS de coût motivation
     → pendingCard = cardId
     → overlay.hide()
     → world.beginPlacement(kind, onConfirm, onCancel)
3. WorldScene.beginPlacement
     → suspend le drag-pan caméra
     → spot initial = findFreeSpot(state, kind, centre)  ← position de départ du ghost
     → new PlacementController(scene, kind, spotInitial, callbacks)
4. PlacementController actif
     → pointermove : ghost suit le curseur, snap tuile, recolore vert/rouge
     → pointerdown sur tuile valide : onConfirm({x, y})
     → Échap / clic droit : onCancel()
5. onConfirm({x, y})
     → controller.destroy(), réactive le pan
     → UIScene : applyChosenCard(state, pendingCard, now, {x, y})
        → effect place le bâtiment aux coords explicites (bypass findFreeSpot)
        → coût motivation pris ICI
     → world.refresh(next)
     → tween d'apparition sur le bâtiment nouvellement placé
6. onCancel
     → controller.destroy(), réactive le pan
     → pendingCard jeté ; la carte reste disponible ; zéro coût
```

**Changement de signature** : `effect(s, now, coords?)` — si `coords` est fourni,
`placeBuilding` direct ; sinon `findFreeSpot` (préserve les cartes
non-placement et l'init du monde). `applyChosenCard(state, cardId, now, coords?)`
propage les coords.

## Validation & retour visuel

- **Ghost sprite** : rendu du bâtiment (composite ou frame unique selon `kind`),
  semi-transparent (`alpha 0.6`), snap à la tuile sous le curseur.
- **Validation par tuile** — `isFootprintFree(state, kind, x, y)` :
  hors bornes monde → invalide ; chevauche un bâtiment → invalide ; sinon valide.
- **Surlignage d'empreinte** : rectangle couvrant les `w×h` tuiles du ghost ;
  vert (`0x00ff00`, alpha bas) si valide, rouge (`0xff0000`, alpha bas) sinon.
- **Confirm bloqué si invalide** : `pointerdown` sur tuile invalide est ignoré.
  Le rouge suffit comme feedback (pas de flash/son).
- **Cas zéro spot** : si `findFreeSpot` initial → `null`, la carte est déjà
  masquée par `isAvailable` (logique existante inchangée). Le mode placement
  n'est jamais déclenché à vide.
- **Curseur hors-grille** : ghost caché.

## Annulation, teardown & polish

- **Annulation** (`Échap` ou clic droit) : `controller.destroy()` détruit ghost
  + surlignage et retire les handlers pointeur ; `WorldScene` réactive le
  drag-pan ; `UIScene` jette `pendingCard` (carte conservée, zéro motivation).
- **Teardown — règle unique** : confirm ET cancel passent par le même
  `controller.destroy()`. Garantit : pas de handler orphelin, pas de double
  ghost si le joueur enchaîne les cartes.
- **Garde-fou** : `UIScene.pickCard` est bloqué tant que `pendingCard` existe —
  un seul placement actif à la fois.
- **Polish d'apparition** : `renderBuildings` reconstruit tous les sprites à
  chaque refresh, donc impossible d'animer « le nouveau » naïvement. Au confirm,
  `WorldScene` connaît l'id du bâtiment placé ; après `world.refresh`, il
  retrouve le sprite/container de cet id dans `buildingLayer` et joue un tween
  one-shot : `alpha 0→1` + `scale 0.85→1`, ~180 ms, ease `Back.easeOut`.
  One-shot ciblé → les refresh suivants (déplacements villageois) ne le rejouent
  pas.

## Tests

**Unitaires (logique pure, sans Phaser) :**
- `pixelToTile()` — pixel curseur + état caméra (zoom/scroll) → coords tuile ;
  cas limites aux bords.
- `applyChosenCard(state, cardId, now, {x, y})` — bâtiment placé aux coords
  exactes, motivation déduite.
- `applyChosenCard` sans coords — fallback `findFreeSpot` intact (cartes
  non-placement + init du monde).
- `effect` d'une carte bâtiment avec coords vs sans — les deux chemins.
- Garde défensive : coords invalides passées à `applyChosenCard` → re-check
  `isFootprintFree`, repli sur `findFreeSpot` (ceinture + bretelles ;
  `PlacementController` ne confirme déjà que du valide).
- Les 135 tests existants restent verts (footprint puits 1×2 déjà couvert).

**Manuel / visuel (checklist — `PlacementController` trop lié à Phaser) :**
- ghost suit le curseur, snap tuile
- vert/rouge selon validité
- clic sur tuile invalide ignoré
- `Échap` / clic droit annule, carte revient, 0 motivation
- pan caméra suspendu pendant le placement, réactivé après
- tween d'apparition joué une seule fois

## Fichiers touchés

- `src/systems/placement/PlacementController.ts` — nouveau
- `src/systems/placement/placementRules.ts` — nouveau
- `src/scenes/WorldScene.ts` — `beginPlacement`, suspension du pan, tween
- `src/scenes/UIScene.ts` — `pendingCard`, branchement `pickCard`, garde-fou
- `src/cards/types.ts` — flag `needsPlacement`
- `src/cards/deck.ts` — tag des cartes bâtiment, `effect` avec coords
- `src/systems/dailyAction.ts` — `applyChosenCard` avec coords
- `src/systems/worldOps.ts` — aucun changement (`placeBuilding` accepte déjà des coords explicites)
