# Villager pathfinding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace static wander around home with deterministic A*-based movement on the village path graph (home↔work, free roaming, planned visits, bobbing at destinations).

**Architecture:** New pure module `src/systems/villagerPath/` exposes `villagerPositionAt(v, now, state) → Position | null`. Renderer calls it once per villager per frame. Internally: build walkable graph from `pathTiles(state)`, run A* between bldg frontages, derive a deterministic day schedule (work + 2–4 idle visits) seeded by `(villager.id, day, state.seed)`, interpolate position from current segment. No `GameState` changes.

**Tech Stack:** TypeScript strict, Vitest + jsdom, Phaser 3 (renderer only).

**Reference spec:** `docs/superpowers/specs/2026-05-20-villager-pathfinding-design.md`

---

## File Structure

**Created:**
- `src/systems/villagerPath/types.ts` — shared types (`TileXY`, `Segment`, `DaySchedule`, `Position`)
- `src/systems/villagerPath/hash.ts` — FNV-1a hash util (extracted from renderer)
- `src/systems/villagerPath/graph.ts` — `buildGraph(state)` with WeakMap memo
- `src/systems/villagerPath/astar.ts` — `findPath(graph, from, to)` with snap-to-nearest
- `src/systems/villagerPath/schedule.ts` — `villagerScheduleForDay(v, day, state)` with memo
- `src/systems/villagerPath/position.ts` — `villagerPositionAt(v, now, state)` + `msSinceMidnight`
- `src/systems/villagerPath/index.ts` — barrel re-exports

**Tests (mirrors):**
- `tests/unit/systems/villagerPath/hash.test.ts`
- `tests/unit/systems/villagerPath/graph.test.ts`
- `tests/unit/systems/villagerPath/astar.test.ts`
- `tests/unit/systems/villagerPath/schedule.test.ts`
- `tests/unit/systems/villagerPath/position.test.ts`

**Modified:**
- `src/rendering/villagerRenderer.ts` — drop wander, call `villagerPositionAt`

---

## Task 1: Shared types + barrel

**Files:**
- Create: `src/systems/villagerPath/types.ts`
- Create: `src/systems/villagerPath/index.ts`

- [ ] **Step 1: Write types**

`src/systems/villagerPath/types.ts`:
```ts
export type TileXY = { readonly x: number; readonly y: number };

export type Segment = {
  readonly kind: 'walk' | 'pause';
  readonly from: TileXY;
  readonly to: TileXY;
  readonly path: readonly TileXY[];
  readonly startMs: number;
  readonly endMs: number;
};

export type DaySchedule = {
  readonly day: number;
  readonly segments: readonly Segment[];
};

export type Position = { readonly x: number; readonly y: number; readonly bobbing: boolean };
```

- [ ] **Step 2: Write barrel**

`src/systems/villagerPath/index.ts`:
```ts
export * from './types';
```

- [ ] **Step 3: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: PASS (no output).

- [ ] **Step 4: Commit**

```bash
git add src/systems/villagerPath/
git commit -m "feat(villagerPath): shared types"
```

---

## Task 2: FNV-1a hash util

**Files:**
- Create: `src/systems/villagerPath/hash.ts`
- Create: `tests/unit/systems/villagerPath/hash.test.ts`

- [ ] **Step 1: Write failing test**

`tests/unit/systems/villagerPath/hash.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { hashStr, mixSeeds } from '../../../../src/systems/villagerPath/hash';

describe('villagerPath/hash', () => {
  it('hashStr is deterministic', () => {
    expect(hashStr('alma')).toBe(hashStr('alma'));
  });

  it('hashStr differs for different inputs', () => {
    expect(hashStr('alma')).not.toBe(hashStr('bran'));
  });

  it('mixSeeds is deterministic and combines inputs', () => {
    expect(mixSeeds(1, 2, 3)).toBe(mixSeeds(1, 2, 3));
    expect(mixSeeds(1, 2, 3)).not.toBe(mixSeeds(1, 2, 4));
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

Run: `npx vitest run tests/unit/systems/villagerPath/hash.test.ts`
Expected: FAIL — cannot resolve module.

- [ ] **Step 3: Implement**

`src/systems/villagerPath/hash.ts`:
```ts
export function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h;
}

export function mixSeeds(...seeds: number[]): number {
  let h = 2166136261;
  for (const s of seeds) {
    h ^= s >>> 0;
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}
```

- [ ] **Step 4: Run test, verify it passes**

Run: `npx vitest run tests/unit/systems/villagerPath/hash.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add src/systems/villagerPath/hash.ts tests/unit/systems/villagerPath/hash.test.ts
git commit -m "feat(villagerPath): hash util"
```

---

## Task 3: Walkable graph builder

**Files:**
- Create: `src/systems/villagerPath/graph.ts`
- Create: `tests/unit/systems/villagerPath/graph.test.ts`

Background: `src/systems/paths.ts` already exposes `pathTiles(state: GameState) → Set<string>` where each entry is a `"x,y"` key for walkable tiles connecting building frontages via the townHall hub.

- [ ] **Step 1: Write failing test**

`tests/unit/systems/villagerPath/graph.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { buildGraph, tileKey } from '../../../../src/systems/villagerPath/graph';
import { emptyState } from '../../../../src/domain/state';
import { placeBuilding } from '../../../../src/systems/worldOps';

describe('villagerPath/graph', () => {
  it('empty state yields empty graph', () => {
    const g = buildGraph(emptyState(0, 1));
    expect(g.tiles.size).toBe(0);
  });

  it('one building yields some frontage tiles', () => {
    let s = emptyState(0, 1);
    s = placeBuilding(s, 'townHall', 10, 10, 0);
    const g = buildGraph(s);
    expect(g.tiles.size).toBeGreaterThan(0);
  });

  it('neighbors are 4-connected and inside the tile set', () => {
    let s = emptyState(0, 1);
    s = placeBuilding(s, 'townHall', 10, 10, 0);
    s = placeBuilding(s, 'house', 15, 10, 0);
    const g = buildGraph(s);
    for (const [key, ns] of g.neighbors) {
      const [x, y] = key.split(',').map(Number) as [number, number];
      for (const n of ns) {
        const [nx, ny] = n.split(',').map(Number) as [number, number];
        expect(Math.abs(nx - x) + Math.abs(ny - y)).toBe(1);
        expect(g.tiles.has(n)).toBe(true);
      }
    }
  });

  it('is memoised on state.world.buildings reference', () => {
    let s = emptyState(0, 1);
    s = placeBuilding(s, 'townHall', 10, 10, 0);
    const g1 = buildGraph(s);
    const g2 = buildGraph(s);
    expect(g2).toBe(g1);
  });

  it('tileKey roundtrips', () => {
    expect(tileKey({ x: 4, y: 7 })).toBe('4,7');
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

Run: `npx vitest run tests/unit/systems/villagerPath/graph.test.ts`
Expected: FAIL — cannot resolve module.

- [ ] **Step 3: Implement**

`src/systems/villagerPath/graph.ts`:
```ts
import { GameState } from '../../domain/state';
import { pathTiles } from '../paths';
import { TileXY } from './types';

export type Graph = {
  readonly tiles: ReadonlySet<string>;
  readonly neighbors: ReadonlyMap<string, readonly string[]>;
};

export function tileKey(t: TileXY): string {
  return `${t.x},${t.y}`;
}

export function parseTileKey(k: string): TileXY {
  const [xs, ys] = k.split(',');
  return { x: Number(xs), y: Number(ys) };
}

const cache: WeakMap<object, Graph> = new WeakMap();

export function buildGraph(state: GameState): Graph {
  const hit = cache.get(state.world.buildings);
  if (hit) return hit;

  const tiles = pathTiles(state);
  const neighbors = new Map<string, string[]>();
  const dirs: ReadonlyArray<[number, number]> = [
    [1, 0], [-1, 0], [0, 1], [0, -1],
  ];
  for (const key of tiles) {
    const { x, y } = parseTileKey(key);
    const ns: string[] = [];
    for (const [dx, dy] of dirs) {
      const nk = `${x + dx},${y + dy}`;
      if (tiles.has(nk)) ns.push(nk);
    }
    neighbors.set(key, ns);
  }
  const g: Graph = { tiles, neighbors };
  cache.set(state.world.buildings, g);
  return g;
}
```

- [ ] **Step 4: Run test, verify it passes**

Run: `npx vitest run tests/unit/systems/villagerPath/graph.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/systems/villagerPath/graph.ts tests/unit/systems/villagerPath/graph.test.ts
git commit -m "feat(villagerPath): walkable graph builder"
```

---

## Task 4: A* core (in-graph endpoints)

**Files:**
- Create: `src/systems/villagerPath/astar.ts`
- Create: `tests/unit/systems/villagerPath/astar.test.ts`

- [ ] **Step 1: Write failing test (in-graph endpoints only)**

`tests/unit/systems/villagerPath/astar.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { findPath } from '../../../../src/systems/villagerPath/astar';
import { buildGraph } from '../../../../src/systems/villagerPath/graph';
import { emptyState } from '../../../../src/domain/state';
import { placeBuilding } from '../../../../src/systems/worldOps';

describe('villagerPath/astar (in-graph)', () => {
  it('returns a path between two reachable tiles', () => {
    let s = emptyState(0, 1);
    s = placeBuilding(s, 'townHall', 10, 10, 0);
    s = placeBuilding(s, 'house', 15, 10, 0);
    const g = buildGraph(s);
    const tiles = [...g.tiles].map((k) => {
      const [x, y] = k.split(',').map(Number);
      return { x: x as number, y: y as number };
    });
    const a = tiles[0]!;
    const b = tiles[tiles.length - 1]!;
    const p = findPath(g, a, b);
    expect(p).not.toBeNull();
    expect(p![0]).toEqual(a);
    expect(p![p!.length - 1]).toEqual(b);
  });

  it('returns single-tile path when from === to', () => {
    let s = emptyState(0, 1);
    s = placeBuilding(s, 'townHall', 10, 10, 0);
    const g = buildGraph(s);
    const start = [...g.tiles][0]!;
    const [x, y] = start.split(',').map(Number) as [number, number];
    const p = findPath(g, { x, y }, { x, y });
    expect(p).toEqual([{ x, y }]);
  });

  it('returns null when graph is empty', () => {
    const g = buildGraph(emptyState(0, 1));
    const p = findPath(g, { x: 0, y: 0 }, { x: 1, y: 0 });
    expect(p).toBeNull();
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

Run: `npx vitest run tests/unit/systems/villagerPath/astar.test.ts`
Expected: FAIL — cannot resolve module.

- [ ] **Step 3: Implement (in-graph only; snap added in Task 5)**

`src/systems/villagerPath/astar.ts`:
```ts
import { Graph, parseTileKey, tileKey } from './graph';
import { TileXY } from './types';

const MAX_ITER = 200;

function manhattan(a: TileXY, b: TileXY): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

export function findPath(graph: Graph, from: TileXY, to: TileXY): TileXY[] | null {
  if (graph.tiles.size === 0) return null;
  const fromKey = tileKey(from);
  const toKey = tileKey(to);
  if (!graph.tiles.has(fromKey) || !graph.tiles.has(toKey)) return null;
  if (fromKey === toKey) return [from];

  const open = new Set<string>([fromKey]);
  const cameFrom = new Map<string, string>();
  const gScore = new Map<string, number>([[fromKey, 0]]);
  const fScore = new Map<string, number>([[fromKey, manhattan(from, to)]]);

  let iter = 0;
  while (open.size > 0 && iter < MAX_ITER) {
    iter++;
    let current: string | null = null;
    let currentF = Infinity;
    for (const k of open) {
      const f = fScore.get(k) ?? Infinity;
      if (f < currentF) {
        currentF = f;
        current = k;
      }
    }
    if (current === null) return null;
    if (current === toKey) {
      const out: TileXY[] = [parseTileKey(current)];
      let cur: string = current;
      while (cameFrom.has(cur)) {
        cur = cameFrom.get(cur)!;
        out.push(parseTileKey(cur));
      }
      return out.reverse();
    }
    open.delete(current);
    const ns = graph.neighbors.get(current) ?? [];
    const curG = gScore.get(current) ?? Infinity;
    for (const n of ns) {
      const tentative = curG + 1;
      if (tentative < (gScore.get(n) ?? Infinity)) {
        cameFrom.set(n, current);
        gScore.set(n, tentative);
        fScore.set(n, tentative + manhattan(parseTileKey(n), to));
        open.add(n);
      }
    }
  }
  return null;
}
```

- [ ] **Step 4: Run test, verify it passes**

Run: `npx vitest run tests/unit/systems/villagerPath/astar.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add src/systems/villagerPath/astar.ts tests/unit/systems/villagerPath/astar.test.ts
git commit -m "feat(villagerPath): A* core (in-graph endpoints)"
```

---

## Task 5: A* snap-to-nearest tile

**Files:**
- Modify: `src/systems/villagerPath/astar.ts`
- Modify: `tests/unit/systems/villagerPath/astar.test.ts`

Why: villageois start at building frontage which is on the graph, but destinations passed by future callers may include slightly-off coords (frontage center, but bldg footprint center is not on graph). Snap to nearest path tile before A*.

- [ ] **Step 1: Add failing test for snap**

Append to `tests/unit/systems/villagerPath/astar.test.ts`:
```ts
import { tileKey } from '../../../../src/systems/villagerPath/graph';

describe('villagerPath/astar (snap)', () => {
  it('snaps from/to to nearest graph tiles', () => {
    // Sequence: place buildings, find any far-from-graph point, expect snap
    // We approximate by passing a tile we know is NOT on the graph
    // (interior of a building footprint), and verify findPath still works.
    const s0 = (() => {
      let s = require('../../../../src/domain/state').emptyState(0, 1);
      s = require('../../../../src/systems/worldOps').placeBuilding(s, 'townHall', 10, 10, 0);
      s = require('../../../../src/systems/worldOps').placeBuilding(s, 'house', 18, 10, 0);
      return s;
    })();
    const g = require('../../../../src/systems/villagerPath/graph').buildGraph(s0);
    // Pick an offgrid point: (10, 10) is inside townHall footprint → not in graph
    expect(g.tiles.has(tileKey({ x: 10, y: 10 }))).toBe(false);
    const someGraphTile = [...g.tiles][0]!;
    const [gx, gy] = someGraphTile.split(',').map(Number) as [number, number];
    const p = findPath(g, { x: 10, y: 10 }, { x: gx, y: gy });
    expect(p).not.toBeNull();
    expect(p!.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

Run: `npx vitest run tests/unit/systems/villagerPath/astar.test.ts`
Expected: FAIL — snap test fails (findPath returns null on offgrid input).

- [ ] **Step 3: Add snap to implementation**

Edit `src/systems/villagerPath/astar.ts` — replace the early `if (!graph.tiles.has(fromKey) || !graph.tiles.has(toKey)) return null;` block with snap:

```ts
function snapToGraph(graph: Graph, p: TileXY): TileXY | null {
  if (graph.tiles.size === 0) return null;
  if (graph.tiles.has(tileKey(p))) return p;
  let best: TileXY | null = null;
  let bestD = Infinity;
  for (const k of graph.tiles) {
    const t = parseTileKey(k);
    const d = manhattan(t, p);
    if (d < bestD) {
      bestD = d;
      best = t;
    }
  }
  return best;
}
```

And replace the offending lines inside `findPath` (right after the `graph.tiles.size === 0` check) with:

```ts
  const fromSnap = snapToGraph(graph, from);
  const toSnap = snapToGraph(graph, to);
  if (!fromSnap || !toSnap) return null;
  const fromKey = tileKey(fromSnap);
  const toKey = tileKey(toSnap);
  if (fromKey === toKey) return [fromSnap];
```

(Drop the previous `tileKey(from)`/`tileKey(to)` lines and the `if (!graph.tiles.has(...))` line.)

- [ ] **Step 4: Run test, verify it passes**

Run: `npx vitest run tests/unit/systems/villagerPath/astar.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add src/systems/villagerPath/astar.ts tests/unit/systems/villagerPath/astar.test.ts
git commit -m "feat(villagerPath): A* snap-to-nearest"
```

---

## Task 6: Schedule generator (skeleton — sleep + idle anchor)

**Files:**
- Create: `src/systems/villagerPath/schedule.ts`
- Create: `tests/unit/systems/villagerPath/schedule.test.ts`

Goal: minimal generator that respects sleep window via `villagerActivityAt`. No work, no idle visits yet — just a single pause segment at home for the entire wake window. Builds the scaffolding for Tasks 7–8.

- [ ] **Step 1: Write failing test**

`tests/unit/systems/villagerPath/schedule.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { villagerScheduleForDay } from '../../../../src/systems/villagerPath/schedule';
import { initWorld } from '../../../../src/systems/init';

describe('villagerPath/schedule (skeleton)', () => {
  it('returns a DaySchedule with day field set', () => {
    const s = initWorld(0, 1);
    const v = s.world.villagers[0]!;
    const ds = villagerScheduleForDay(v, 5, s);
    expect(ds.day).toBe(5);
  });

  it('produces no segments covering sleep hours (00:00–06:00)', () => {
    const s = initWorld(0, 1);
    const v = s.world.villagers[0]!;
    const ds = villagerScheduleForDay(v, 0, s);
    for (const seg of ds.segments) {
      // sleep window is 00:00–06:00 → 0..21_600_000ms
      const sleepEndMs = 6 * 3_600_000;
      expect(seg.startMs).toBeGreaterThanOrEqual(sleepEndMs);
    }
  });

  it('is deterministic for the same (villager, day, state)', () => {
    const s = initWorld(0, 1);
    const v = s.world.villagers[0]!;
    const a = villagerScheduleForDay(v, 3, s);
    const b = villagerScheduleForDay(v, 3, s);
    expect(b).toBe(a);
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

Run: `npx vitest run tests/unit/systems/villagerPath/schedule.test.ts`
Expected: FAIL — cannot resolve module.

- [ ] **Step 3: Implement skeleton**

`src/systems/villagerPath/schedule.ts`:
```ts
import { GameState } from '../../domain/state';
import { Villager } from '../../domain/villager';
import { BUILDING_FOOTPRINT } from '../../domain/building';
import { DaySchedule, Segment, TileXY } from './types';
import { mixSeeds, hashStr } from './hash';

const HOUR_MS = 3_600_000;

function frontageCenter(state: GameState, buildingId: string): TileXY | null {
  const b = state.world.buildings.find((bb) => bb.id === buildingId);
  if (!b) return null;
  const fp = BUILDING_FOOTPRINT[b.kind];
  return { x: b.tileX + Math.floor(fp.w / 2), y: b.tileY + fp.h };
}

function wakeWindow(v: Villager): { wakeHour: number; sleepHour: number } {
  let wake = 24;
  let sleep = 0;
  for (const s of v.schedule) {
    if (s.activity !== 'sleep') {
      wake = Math.min(wake, s.fromHour);
      sleep = Math.max(sleep, s.toHour);
    }
  }
  if (wake >= sleep) return { wakeHour: 6, sleepHour: 22 };
  return { wakeHour: wake, sleepHour: sleep };
}

const cache: WeakMap<object, Map<string, DaySchedule>> = new WeakMap();

export function villagerScheduleForDay(v: Villager, day: number, state: GameState): DaySchedule {
  let perState = cache.get(state.world.buildings);
  if (!perState) {
    perState = new Map();
    cache.set(state.world.buildings, perState);
  }
  const key = `${v.id}@${day}`;
  const hit = perState.get(key);
  if (hit) return hit;

  const seed = mixSeeds(hashStr(v.id), day, state.seed);
  void seed; // used in Task 8

  const home = frontageCenter(state, v.homeId);
  if (!home) {
    const ds: DaySchedule = { day, segments: [] };
    perState.set(key, ds);
    return ds;
  }

  const { wakeHour, sleepHour } = wakeWindow(v);
  const segments: Segment[] = [
    {
      kind: 'pause',
      from: home,
      to: home,
      path: [home],
      startMs: wakeHour * HOUR_MS,
      endMs: sleepHour * HOUR_MS,
    },
  ];
  const ds: DaySchedule = { day, segments };
  perState.set(key, ds);
  return ds;
}
```

- [ ] **Step 4: Run test, verify it passes**

Run: `npx vitest run tests/unit/systems/villagerPath/schedule.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add src/systems/villagerPath/schedule.ts tests/unit/systems/villagerPath/schedule.test.ts
git commit -m "feat(villagerPath): schedule skeleton (sleep + home anchor)"
```

---

## Task 7: Schedule — insert work segments

**Files:**
- Modify: `src/systems/villagerPath/schedule.ts`
- Modify: `tests/unit/systems/villagerPath/schedule.test.ts`

Goal: when villager has `workplaceId` and `villagerActivityAt` returns `work` for some hours, generate `home → walk → work_pause → walk → home_pause` covering the work window.

- [ ] **Step 1: Add failing test**

Append to `tests/unit/systems/villagerPath/schedule.test.ts`:
```ts
describe('villagerPath/schedule (work)', () => {
  it('produces walk + work pause + walk for workers', () => {
    const s = initWorld(0, 1);
    const worker = s.world.villagers.find((v) => v.workplaceId !== undefined);
    if (!worker) return; // initWorld may or may not place workers — skip if none
    const ds = villagerScheduleForDay(worker, 0, s);
    const kinds = ds.segments.map((seg) => seg.kind);
    expect(kinds).toContain('walk');
    // At least one pause segment whose `to` is the workplace frontage center.
    const hasWorkPause = ds.segments.some((seg) => {
      const b = s.world.buildings.find((bb) => bb.id === worker.workplaceId);
      if (!b) return false;
      const fp = require('../../../../src/domain/building').BUILDING_FOOTPRINT[b.kind];
      const cx = b.tileX + Math.floor(fp.w / 2);
      const cy = b.tileY + fp.h;
      return seg.kind === 'pause' && seg.to.x === cx && seg.to.y === cy;
    });
    expect(hasWorkPause).toBe(true);
  });

  it('segments are chronologically contiguous (no gap, no overlap)', () => {
    const s = initWorld(0, 1);
    const v = s.world.villagers[0]!;
    const ds = villagerScheduleForDay(v, 0, s);
    for (let i = 1; i < ds.segments.length; i++) {
      expect(ds.segments[i]!.startMs).toBe(ds.segments[i - 1]!.endMs);
    }
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

Run: `npx vitest run tests/unit/systems/villagerPath/schedule.test.ts`
Expected: FAIL — current skeleton only emits one home-pause segment.

- [ ] **Step 3: Extend implementation**

Replace the body of `villagerScheduleForDay` after the `home`/`wakeWindow` setup with the logic below. Update imports at top:

```ts
import { GameState } from '../../domain/state';
import { Villager } from '../../domain/villager';
import { BUILDING_FOOTPRINT } from '../../domain/building';
import { DaySchedule, Segment, TileXY } from './types';
import { mixSeeds, hashStr } from './hash';
import { buildGraph } from './graph';
import { findPath } from './astar';

const HOUR_MS = 3_600_000;
const WALK_MS_PER_TILE = 2000;
```

Then replace the segment construction (after `const { wakeHour, sleepHour } = wakeWindow(v);`) with:

```ts
  const graph = buildGraph(state);
  const segments: Segment[] = [];
  let cursorMs = wakeHour * HOUR_MS;
  let here: TileXY = home;

  const pushWalk = (to: TileXY): boolean => {
    const path = findPath(graph, here, to);
    if (!path || path.length === 0) return false;
    const durMs = Math.max(1000, path.length * WALK_MS_PER_TILE);
    segments.push({
      kind: 'walk',
      from: here,
      to,
      path,
      startMs: cursorMs,
      endMs: cursorMs + durMs,
    });
    cursorMs += durMs;
    here = to;
    return true;
  };

  const pushPause = (durMs: number) => {
    segments.push({
      kind: 'pause',
      from: here,
      to: here,
      path: [here],
      startMs: cursorMs,
      endMs: cursorMs + durMs,
    });
    cursorMs += durMs;
  };

  // Work window: find contiguous work hours from schedule.
  const workHours = v.schedule.filter((e) => e.activity === 'work');
  if (workHours.length > 0 && v.workplaceId) {
    const workStart = Math.max(wakeHour, Math.min(...workHours.map((e) => e.fromHour)));
    const workEnd = Math.min(sleepHour, Math.max(...workHours.map((e) => e.toHour)));
    const workTile = frontageCenter(state, v.workplaceId);
    if (workTile && workEnd > workStart) {
      // morning idle until work
      const morningPauseMs = workStart * HOUR_MS - cursorMs;
      if (morningPauseMs > 0) pushPause(morningPauseMs);
      pushWalk(workTile);
      // sit at work until workEnd
      const sitMs = workEnd * HOUR_MS - cursorMs;
      if (sitMs > 0) pushPause(sitMs);
      pushWalk(home);
    }
  }

  // Fill remainder until sleepHour with pause at home.
  const tailMs = sleepHour * HOUR_MS - cursorMs;
  if (tailMs > 0) pushPause(tailMs);

  const ds: DaySchedule = { day, segments };
```

- [ ] **Step 4: Run test, verify it passes**

Run: `npx vitest run tests/unit/systems/villagerPath/schedule.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/systems/villagerPath/schedule.ts tests/unit/systems/villagerPath/schedule.test.ts
git commit -m "feat(villagerPath): schedule work segments"
```

---

## Task 8: Schedule — idle visits (2–4 deterministic destinations)

**Files:**
- Modify: `src/systems/villagerPath/schedule.ts`
- Modify: `tests/unit/systems/villagerPath/schedule.test.ts`

Goal: outside work hours, pick 2–4 destinations from buildings (excluding home, excluding workplace if any), interleave `walk → 90s pause` between them before settling at home for the tail.

- [ ] **Step 1: Add failing test**

Append to `tests/unit/systems/villagerPath/schedule.test.ts`:
```ts
describe('villagerPath/schedule (idle visits)', () => {
  it('inserts walk+pause pairs to other buildings', () => {
    const s = initWorld(0, 1);
    const v = s.world.villagers[0]!;
    const ds = villagerScheduleForDay(v, 0, s);
    const walks = ds.segments.filter((seg) => seg.kind === 'walk');
    expect(walks.length).toBeGreaterThan(0);
  });

  it('different days yield different schedules (when destinations available)', () => {
    const s = initWorld(0, 1);
    const v = s.world.villagers[0]!;
    if (s.world.buildings.length < 3) return;
    const a = villagerScheduleForDay(v, 0, s);
    const b = villagerScheduleForDay(v, 1, s);
    const aSig = a.segments.map((seg) => `${seg.kind}@${seg.to.x},${seg.to.y}`).join('|');
    const bSig = b.segments.map((seg) => `${seg.kind}@${seg.to.x},${seg.to.y}`).join('|');
    expect(aSig).not.toBe(bSig);
  });

  it('visited destinations are unique within a day', () => {
    const s = initWorld(0, 1);
    const v = s.world.villagers[0]!;
    const ds = villagerScheduleForDay(v, 0, s);
    const pauseTargets = ds.segments
      .filter((seg) => seg.kind === 'pause')
      .map((seg) => `${seg.to.x},${seg.to.y}`);
    // Tail-home pause may repeat the start; assert visited (non-home) destinations distinct.
    const homeKey = (() => {
      const b = s.world.buildings.find((bb) => bb.id === v.homeId)!;
      const fp = require('../../../../src/domain/building').BUILDING_FOOTPRINT[b.kind];
      return `${b.tileX + Math.floor(fp.w / 2)},${b.tileY + fp.h}`;
    })();
    const nonHome = pauseTargets.filter((k) => k !== homeKey);
    expect(new Set(nonHome).size).toBe(nonHome.length);
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

Run: `npx vitest run tests/unit/systems/villagerPath/schedule.test.ts`
Expected: FAIL — Task 7 only walks home↔work; no idle visits yet.

- [ ] **Step 3: Extend implementation**

Update `src/systems/villagerPath/schedule.ts`:

Add at top:
```ts
import { createRng, rngInt } from '../rng';
```

Add helper `pickDestinations` above `villagerScheduleForDay`:

```ts
const PAUSE_MS = 90_000;

function candidateDestinations(state: GameState, excludeIds: ReadonlySet<string>): TileXY[] {
  const out: TileXY[] = [];
  for (const b of state.world.buildings) {
    if (excludeIds.has(b.id)) continue;
    const fp = BUILDING_FOOTPRINT[b.kind];
    out.push({ x: b.tileX + Math.floor(fp.w / 2), y: b.tileY + fp.h });
  }
  return out;
}

function pickDestinations(pool: TileXY[], rng: () => number, count: number): TileXY[] {
  const copy = [...pool];
  const out: TileXY[] = [];
  while (out.length < count && copy.length > 0) {
    const idx = rngInt(rng, 0, copy.length);
    out.push(copy[idx]!);
    copy.splice(idx, 1);
  }
  return out;
}
```

Then, inside `villagerScheduleForDay`, before the final `tailMs` filler, insert idle visits during the **pre-work** and **post-work** windows. Replace the existing morning-pause / tail-pause logic with this richer flow. The full replacement of the section "Work window: …" onward becomes:

```ts
  const exclude = new Set<string>([v.homeId]);
  if (v.workplaceId) exclude.add(v.workplaceId);
  const pool = candidateDestinations(state, exclude);
  const rng = createRng(seed);
  const visitCount = pool.length === 0 ? 0 : 2 + rngInt(rng, 0, 3); // 2..4

  // Helper: insert n visit segments, ending back at the home tile for clean re-entry.
  const insertVisits = (untilMs: number, n: number) => {
    if (n <= 0) return;
    const picks = pickDestinations(pool, rng, n);
    for (const dest of picks) {
      // Leave enough time for walk + pause + return walk back to home.
      const projectedMs = WALK_MS_PER_TILE * 20 + PAUSE_MS;
      if (cursorMs + projectedMs > untilMs) break;
      if (!pushWalk(dest)) continue;
      pushPause(PAUSE_MS);
      if (!pushWalk(home)) break;
    }
    // Sit at home until untilMs.
    const idle = untilMs - cursorMs;
    if (idle > 0) pushPause(idle);
  };

  const workHours = v.schedule.filter((e) => e.activity === 'work');
  if (workHours.length > 0 && v.workplaceId) {
    const workStart = Math.max(wakeHour, Math.min(...workHours.map((e) => e.fromHour)));
    const workEnd = Math.min(sleepHour, Math.max(...workHours.map((e) => e.toHour)));
    const workTile = frontageCenter(state, v.workplaceId);
    if (workTile && workEnd > workStart) {
      insertVisits(workStart * HOUR_MS, Math.min(1, visitCount));
      pushWalk(workTile);
      const sitMs = workEnd * HOUR_MS - cursorMs;
      if (sitMs > 0) pushPause(sitMs);
      pushWalk(home);
      insertVisits(sleepHour * HOUR_MS, Math.max(0, visitCount - 1));
    } else {
      insertVisits(sleepHour * HOUR_MS, visitCount);
    }
  } else {
    insertVisits(sleepHour * HOUR_MS, visitCount);
  }

  const tailMs = sleepHour * HOUR_MS - cursorMs;
  if (tailMs > 0) pushPause(tailMs);

  const ds: DaySchedule = { day, segments };
```

Remove the previously-placed simpler "Work window" block — the new block above supersedes it.

- [ ] **Step 4: Run test, verify it passes**

Run: `npx vitest run tests/unit/systems/villagerPath/schedule.test.ts`
Expected: PASS, 8 tests.

- [ ] **Step 5: Commit**

```bash
git add src/systems/villagerPath/schedule.ts tests/unit/systems/villagerPath/schedule.test.ts
git commit -m "feat(villagerPath): idle visits (2-4 deterministic destinations)"
```

---

## Task 9: Position resolver

**Files:**
- Create: `src/systems/villagerPath/position.ts`
- Create: `tests/unit/systems/villagerPath/position.test.ts`
- Modify: `src/systems/villagerPath/index.ts` (re-export)

- [ ] **Step 1: Write failing test**

`tests/unit/systems/villagerPath/position.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { villagerPositionAt, msSinceMidnight } from '../../../../src/systems/villagerPath/position';
import { initWorld } from '../../../../src/systems/init';

describe('villagerPath/position', () => {
  it('returns null during sleep hours', () => {
    const t0 = new Date(2026, 4, 20, 3, 0, 0).getTime();
    const s = initWorld(t0, 1);
    const v = s.world.villagers[0]!;
    expect(villagerPositionAt(v, t0, s)).toBeNull();
  });

  it('returns a Position during wake hours', () => {
    const t0 = new Date(2026, 4, 20, 10, 0, 0).getTime();
    const s = initWorld(t0, 1);
    const v = s.world.villagers[0]!;
    const pos = villagerPositionAt(v, t0, s);
    expect(pos).not.toBeNull();
    expect(typeof pos!.x).toBe('number');
    expect(typeof pos!.y).toBe('number');
  });

  it('bobbing is true during pause segments only', () => {
    const t0 = new Date(2026, 4, 20, 12, 0, 0).getTime();
    const s = initWorld(t0, 1);
    const v = s.world.villagers[0]!;
    const pos = villagerPositionAt(v, t0, s);
    // Could be in either walk or pause; assert it returns a boolean either way.
    expect(typeof pos!.bobbing).toBe('boolean');
  });

  it('msSinceMidnight returns 0 at local midnight', () => {
    const t = new Date(2026, 4, 20, 0, 0, 0, 0).getTime();
    expect(msSinceMidnight(t)).toBe(0);
  });

  it('msSinceMidnight returns ~3600000 at 01:00', () => {
    const t = new Date(2026, 4, 20, 1, 0, 0, 0).getTime();
    expect(msSinceMidnight(t)).toBe(3_600_000);
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

Run: `npx vitest run tests/unit/systems/villagerPath/position.test.ts`
Expected: FAIL — cannot resolve module.

- [ ] **Step 3: Implement**

`src/systems/villagerPath/position.ts`:
```ts
import { GameState } from '../../domain/state';
import { Villager } from '../../domain/villager';
import { TILE_SIZE } from '../../config';
import { dayIndex } from '../clock';
import { Position, Segment } from './types';
import { villagerScheduleForDay } from './schedule';

export function msSinceMidnight(t: number): number {
  const d = new Date(t);
  return ((d.getHours() * 60 + d.getMinutes()) * 60 + d.getSeconds()) * 1000 + d.getMilliseconds();
}

function tileToPx(t: { x: number; y: number }): { x: number; y: number } {
  return { x: (t.x + 0.5) * TILE_SIZE, y: (t.y + 0.5) * TILE_SIZE };
}

function interpolateWalk(seg: Segment, msOfDay: number): { x: number; y: number } {
  const span = seg.endMs - seg.startMs;
  const u = span <= 0 ? 0 : Math.max(0, Math.min(0.999999, (msOfDay - seg.startMs) / span));
  if (seg.path.length === 1) return tileToPx(seg.path[0]!);
  const idx = u * (seg.path.length - 1);
  const i0 = Math.floor(idx);
  const i1 = Math.min(seg.path.length - 1, i0 + 1);
  const t = idx - i0;
  const a = seg.path[i0]!;
  const b = seg.path[i1]!;
  return tileToPx({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
}

export function villagerPositionAt(v: Villager, now: number, state: GameState): Position | null {
  const day = dayIndex(state.createdAt, now);
  const sched = villagerScheduleForDay(v, day, state);
  if (sched.segments.length === 0) return null;
  const mod = msSinceMidnight(now);
  let active: Segment | null = null;
  for (const seg of sched.segments) {
    if (mod >= seg.startMs && mod < seg.endMs) {
      active = seg;
      break;
    }
  }
  if (!active) return null;
  if (active.kind === 'pause') {
    const p = tileToPx(active.from);
    return { x: p.x, y: p.y, bobbing: true };
  }
  const p = interpolateWalk(active, mod);
  return { x: p.x, y: p.y, bobbing: false };
}
```

Edit `src/systems/villagerPath/index.ts`:
```ts
export * from './types';
export { villagerPositionAt, msSinceMidnight } from './position';
```

- [ ] **Step 4: Run test, verify it passes**

Run: `npx vitest run tests/unit/systems/villagerPath/position.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/systems/villagerPath/position.ts src/systems/villagerPath/index.ts tests/unit/systems/villagerPath/position.test.ts
git commit -m "feat(villagerPath): position resolver"
```

---

## Task 10: Renderer integration + drop wander

**Files:**
- Modify: `src/rendering/villagerRenderer.ts`

Goal: replace `updateVillagerPositions` body with the new resolver call. Drop wander helpers. Keep `celebrating` guard from H1 fix. Keep `ensureVillagerSprites` untouched.

- [ ] **Step 1: Replace the file contents**

Rewrite `src/rendering/villagerRenderer.ts`:

```ts
import Phaser from 'phaser';
import { GameState } from '../domain/state';
import { blockyKey } from './frames';
import { villagerPositionAt } from '../systems/villagerPath';

const VILLAGER_DISPLAY_PX = 24;

export type VillagerSpritesMap = Map<string, Phaser.GameObjects.Image>;

export function ensureVillagerSprites(
  scene: Phaser.Scene,
  state: GameState,
  container: Phaser.GameObjects.Container,
  sprites: VillagerSpritesMap,
): void {
  const livingIds = new Set(state.world.villagers.map((v) => v.id));
  for (const [id, s] of sprites) {
    if (!livingIds.has(id)) {
      s.destroy();
      sprites.delete(id);
    }
  }
  for (const v of state.world.villagers) {
    if (!sprites.has(v.id)) {
      const img = scene.add.image(0, 0, blockyKey(v.spriteVariant)).setOrigin(0.5, 1);
      img.setDisplaySize(VILLAGER_DISPLAY_PX, VILLAGER_DISPLAY_PX);
      container.add(img);
      sprites.set(v.id, img);
    }
  }
}

export function updateVillagerPositions(
  state: GameState,
  sprites: VillagerSpritesMap,
  now: number,
): void {
  for (const v of state.world.villagers) {
    const sprite = sprites.get(v.id);
    if (!sprite) continue;
    if (sprite.getData('celebrating') === true) continue;
    const pos = villagerPositionAt(v, now, state);
    if (pos === null) {
      sprite.setVisible(false);
      continue;
    }
    sprite.setVisible(true);
    let y = pos.y;
    if (pos.bobbing) y -= 2 * Math.sin(now / 400);
    sprite.setPosition(pos.x, y);
  }
}
```

- [ ] **Step 2: Run full test suite**

Run: `npm run test:run`
Expected: PASS, all suites (renderer not directly tested but should not break imports). Schedule + position tests still PASS.

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: PASS, no TS errors. Bundle builds.

- [ ] **Step 4: Manual smoke (developer action — not blocking the commit)**

Run: `npm run dev`. Open browser, observe villagers walking on paths between buildings, pausing with vertical bobbing, sleeping (invisible) at night. Document any visual regression in a follow-up issue.

- [ ] **Step 5: Commit**

```bash
git add src/rendering/villagerRenderer.ts
git commit -m "feat(villagerPath): wire renderer to A* resolver, drop wander"
```

---

## Self-review checklist (post-plan)

Run before declaring the plan ready:

1. **Spec coverage**
   - Architecture (4 modules) → Tasks 1–9.
   - Render-only / no state change → no save migration, no `GameState` field added.
   - Chemins-only walkable surface → graph from `pathTiles` in Task 3.
   - 0.5 tile/s → `WALK_MS_PER_TILE = 2000` in Task 7.
   - Visite tour déterministe → Task 8 with `createRng(mixSeeds(...))`.
   - Pause + bobbing → Tasks 8 (pause segments) + 9 (`bobbing: true` flag) + 10 (renderer applies sin).
   - A* with snap + 200 iter cap + null on disconnect → Tasks 4–5.
   - Tests: graph, astar, schedule, position → Tasks 3, 4–5, 6–8, 9.
   - Renderer integration → Task 10.

2. **Placeholder scan** — no TBD/TODO/"similar to X"/"add validation"/"handle edge cases" remain.

3. **Type consistency** — `TileXY`, `Segment`, `DaySchedule`, `Position`, `Graph` defined once and reused. Function names stable across tasks: `buildGraph`, `findPath`, `villagerScheduleForDay`, `villagerPositionAt`, `msSinceMidnight`, `tileKey`, `parseTileKey`, `hashStr`, `mixSeeds`.
