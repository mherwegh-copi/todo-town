# Villager pathfinding — design spec

**Date**: 2026-05-20
**Status**: draft, awaiting implementation plan
**Related issue**: [#1 Ideas backlog](https://github.com/mherwegh-copi/todo-town/issues/1) — item "Pathfinding villageois"

## Goal

Remplacer le wander statique autour de la maison par des déplacements lisibles entre bâtiments via A* sur le graphe des chemins. Animer maison↔travail, déambulation libre, et visites planifiées de points d'intérêt (puits, place, mairie, autres maisons).

## Non-goals

- Pas d'interactions villageois↔villageois (collision, rencontre, dialogue).
- Pas de portage d'objet ni de transport de ressources.
- Pas de nouvelle persistance — aucun champ ajouté à `GameState`.
- Pas de changement du système d'activités existant (`villagerActivityAt`).

## Choix de design retenus

| Question | Choix |
|---|---|
| Portée | Maison↔travail + déambulation libre + visites |
| Calcul | Render-only, fonction pure dérivant la position depuis `(villager, now, state)` |
| Surface marchable | Chemins uniquement (`pathTiles(state)`) |
| Vitesse | 0.5 tile/s (contemplatif) |
| Comportement idle | Tour de visites déterministe (seed = id + jour) |
| Comportement à destination | Pause statique 90s avec bobbing vertical ±2px |

## Architecture

Nouveau dossier `src/systems/villagerPath/` avec 4 modules purs:

```
src/systems/villagerPath/
  graph.ts       # build walkable graph from pathTiles
  astar.ts       # generic A* on the graph
  schedule.ts    # deterministic day schedule per villager
  position.ts    # public resolver: villagerPositionAt(v, now, state)
  index.ts       # re-exports
```

`villagerRenderer.updateVillagerPositions` appelle `villagerPositionAt(v, now, state)` au lieu du wander actuel.

## Modèle de données

Aucun champ ajouté à `GameState`. Types internes au module:

```ts
type TileXY = { x: number; y: number };

type Segment = {
  kind: 'walk' | 'pause';
  from: TileXY;
  to: TileXY;
  path: readonly TileXY[]; // walk: A* result; pause: [from]
  startMs: number;          // ms depuis minuit local
  endMs: number;
};

type DaySchedule = {
  day: number;
  segments: readonly Segment[]; // tri par startMs, contigus
};

type Position = { x: number; y: number; bobbing: boolean };
```

`villagerPositionAt` retourne `Position | null` (null = sleep ou hors fenêtre éveillée → sprite caché).

## Graphe + A*

**graph.ts**
- `buildGraph(state) → { tiles: Set<string>, neighbors: Map<string, string[]> }`
- Tiles = sortie de `pathTiles(state)`. Voisins = 4-connexité (N/S/E/O) restreints au set.
- Cache memo via WeakMap par référence `state.world.buildings`. Immutabilité du state → invalidation automatique.

**astar.ts**
- `findPath(graph, from, to) → TileXY[] | null`
- Heuristique Manhattan, coût uniforme 1.
- `from`/`to` hors graphe → snap au tile path le plus proche (Manhattan) avant lancement.
- Garde-fou: max 200 itérations (graphe ~50 tiles). Retourne null si dépassé.

**Edge case**: bâtiment non atteignable depuis le hub → `findPath` retourne null. Le schedule generator skip cette destination et en pioche une autre.

## Schedule generator

```ts
villagerScheduleForDay(v: Villager, day: number, state: GameState): DaySchedule
```

Pure, déterministe.

**Algorithme**:
1. Calcule fenêtre éveillée via `villagerActivityAt` (typiquement `[wakeHour, sleepHour]`). Pendant sleep: aucun segment, schedule peut être vide.
2. Si `v.workplaceId` défini: ancres fixes `home → work → home` autour des heures où `villagerActivityAt` retourne `work`.
3. Hors heures de travail, pioche destinations idle:
   - Pool: tous bâtiments sauf `home` du villageois — frontage center de chaque.
   - PRNG seed: `hash(v.id, day, state.seed)`.
   - Pioche 2–4 destinations sans répétition.
4. Génère séquence chronologique des segments: `home → walk → pause90s → walk → pause90s → ... → walk → work → ... → home → sleep`.
5. Pour chaque walk: `path = findPath(graph, from, to)`. Si null, skip destination, pioche suivante. Si toutes les destinations échouent, villageois reste en pause à home toute la journée.
6. Durées:
   - `walkMs = path.length * 2000` (0.5 tile/s).
   - `pauseMs = 90_000` (90 s).
7. Empile segments avec `startMs` / `endMs` cumulatifs à partir de `wakeHour * 3_600_000`.

**Cache**: memoize par clé `(v.id, day, state.world.buildings ref)`. Coût ~12 villageois × 3 trajets × A*(50 tiles) — négligeable.

## Position resolver

```ts
villagerPositionAt(v: Villager, now: number, state: GameState): Position | null
```

**Algorithme**:
1. `day = dayIndex(state.createdAt, now)`.
2. `schedule = villagerScheduleForDay(v, day, state)`.
3. `msOfDay = msSinceMidnight(now)`.
4. Trouve segment actif: `startMs ≤ msOfDay < endMs`. Segments triés, recherche linéaire suffisante (≤10/jour).
5. Aucun segment trouvé (sleep, avant wake, après sleep) → retourne `null`.
6. `kind: 'pause'` → position = tile center px, `bobbing: true`.
7. `kind: 'walk'`:
   - `u = (msOfDay - startMs) / (endMs - startMs)` ∈ [0, 1).
   - `idx = u * (path.length - 1)`.
   - Interpolation linéaire entre `path[floor(idx)]` et `path[ceil(idx)]`.
   - `bobbing: false`.
8. Conversion tile → px: `x = (tile.x + 0.5) * TILE_SIZE`, idem y. Sprite origin reste `(0.5, 1)`.

## Intégration renderer

Réécriture compacte de `updateVillagerPositions`:

```ts
for v in state.world.villagers:
  sprite = sprites.get(v.id)
  if sprite.celebrating: continue   // garde existant
  pos = villagerPositionAt(v, now, state)
  if pos === null:
    sprite.setVisible(false)
    continue
  sprite.setVisible(true)
  let y = pos.y
  if pos.bobbing: y -= 2 * Math.sin(now / 400)
  sprite.setPosition(pos.x, y)
```

Suppressions: `wanderOffset`, `wanderTarget`, `pointInRects`, `buildingRectsPx`. `hashStr` migre dans `villagerPath/schedule.ts` (ou réutilise depuis un util commun).

Plus de branchement `activity` dans le renderer — le schedule embarque déjà l'info via les segments générés depuis `villagerActivityAt`.

## Tests

**Unitaires (Vitest)**:

- `graph.test.ts` — graphe correct (voisins 4-connexité), bâtiment isolé non connecté.
- `astar.test.ts` — chemin court trouvé, null si déconnecté, respect borne 200 itérations, snap to nearest fonctionne.
- `schedule.test.ts` — déterministe (même `(v, day, state)` → même output), aucun segment pendant sleep, segments contigus sans gap, destinations toutes distinctes, fallback si toutes destinations échouent.
- `position.test.ts` — interpolation correcte au milieu d'un segment, null hors fenêtre éveillée, bobbing actif sur pause uniquement.

**Smoke**:
- Renderer stable si `state.world.buildings` vide (graphe vide → null → sprite caché).
- Renderer stable après ajout d'un bâtiment (cache graphe invalidé via nouvelle ref).

**Pas de E2E** — validation visuelle manuelle de l'animation.

## Risques et mitigations

| Risque | Mitigation |
|---|---|
| A* coûteux à chaque frame | Cache schedule par (id, day, buildings ref). Schedule construit une fois/jour/villageois. |
| Graphe minuscule + 12 villageois → A* trivial | Mesure perf après implém, optimise seulement si nécessaire. |
| Discontinuité visuelle au changement de bâtiment | Nouveau graphe → nouveau schedule → sprite "saute" sur frontage le plus proche. Acceptable, événement rare. |
| Bobbing sin(now/400) désync entre villageois | Voulu — `now` partagé, donc tous bobbing en phase. Si jugé moche, ajouter offset hash(id) sur la phase. |

## Out of scope (futurs tickets)

- Pathfinding sur herbe avec coût pondéré (idée C de la Q3).
- Interactions villageois↔villageois.
- Skins/animations de marche directionnelle (sprite tourné).
- Schedule influencé par météo (rester chez soi sous la pluie).
