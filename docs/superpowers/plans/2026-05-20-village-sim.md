# Village Sim Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a chill top-down pixel-art village simulation web app that runs on a second monitor, advances in real time (1 min IRL = 1 min sim), and lets the user make one strategic choice each morning to evolve the village.

**Architecture:** Phaser 3 renders the world via scenes (Boot / World / UI). Pure-TypeScript systems hold all logic (clock, season, AI, weather, daily action, progression, save) and operate on an immutable `GameState`. Persistence to `localStorage`. Catch-up on reload via time-derived state — no offline tick replay.

**Tech Stack:** TypeScript, Phaser 3, Vite, Vitest, ESLint, Prettier. Pixel-art assets from free packs (Cute Fantasy / Tiny Swords / Kenney Tiny Town — pick at asset import).

---

## File Structure

```
village-sim/
├─ public/assets/                  # tilesets, sprites (placeholder until Task 18)
├─ src/
│  ├─ main.ts                      # Phaser bootstrap
│  ├─ config.ts                    # global constants
│  ├─ domain/
│  │  ├─ ids.ts                    # ID generation
│  │  ├─ state.ts                  # GameState type + initial state
│  │  ├─ tile.ts                   # Tile types
│  │  ├─ building.ts               # Building types + helpers
│  │  ├─ villager.ts               # Villager type + helpers
│  │  └─ crop.ts                   # Crop type + helpers
│  ├─ systems/
│  │  ├─ rng.ts                    # seeded RNG (mulberry32)
│  │  ├─ clock.ts                  # Date.now → sim time helpers
│  │  ├─ season.ts                 # day → season
│  │  ├─ weather.ts                # deterministic weather f(seed, day)
│  │  ├─ villagerAI.ts             # position f(schedule, time)
│  │  ├─ progression.ts            # townHall conditions + derived metrics
│  │  ├─ dailyAction.ts            # gate, draw, apply
│  │  ├─ catchup.ts                # offline catch-up
│  │  └─ save.ts                   # localStorage + migration
│  ├─ cards/
│  │  ├─ types.ts                  # ActionCard type
│  │  └─ deck.ts                   # all card definitions
│  ├─ rendering/
│  │  ├─ tileRenderer.ts
│  │  ├─ buildingRenderer.ts
│  │  ├─ villagerRenderer.ts
│  │  ├─ cropRenderer.ts
│  │  ├─ weatherRenderer.ts
│  │  └─ dayNightOverlay.ts
│  ├─ scenes/
│  │  ├─ BootScene.ts
│  │  ├─ WorldScene.ts
│  │  └─ UIScene.ts
│  └─ ui/
│     ├─ ClockWidget.ts
│     ├─ ActionButton.ts
│     ├─ CardOverlay.ts
│     ├─ Tooltip.ts
│     └─ BuildingInfo.ts
├─ tests/
│  ├─ unit/                        # mirrors src/ layout
│  └─ integration/
├─ index.html
├─ vite.config.ts
├─ vitest.config.ts
├─ tsconfig.json
├─ .eslintrc.cjs
├─ .prettierrc
├─ .gitignore
└─ package.json
```

---

## Task 1: Project bootstrap

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `vitest.config.ts`, `index.html`, `.gitignore`, `.eslintrc.cjs`, `.prettierrc`, `src/main.ts`

- [ ] **Step 1: Init npm + install deps**

Run:
```bash
cd /Users/matthieu.herwegh/Documents/Code/village-sim
npm init -y
npm install phaser
npm install -D typescript vite vitest @types/node jsdom eslint @typescript-eslint/parser @typescript-eslint/eslint-plugin prettier eslint-config-prettier
```

- [ ] **Step 2: Write `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "types": ["vite/client", "vitest/globals"]
  },
  "include": ["src", "tests"]
}
```

- [ ] **Step 3: Write `vite.config.ts`**

```ts
import { defineConfig } from 'vite';

export default defineConfig({
  server: { port: 5173 },
  build: { outDir: 'dist', target: 'es2022' },
});
```

- [ ] **Step 4: Write `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['tests/**/*.test.ts'],
  },
});
```

- [ ] **Step 5: Write `index.html`**

```html
<!doctype html>
<html lang="fr">
  <head>
    <meta charset="UTF-8" />
    <title>Village Sim</title>
    <style>
      html, body { margin: 0; padding: 0; background: #000; overflow: hidden; }
      #game { width: 100vw; height: 100vh; }
    </style>
  </head>
  <body>
    <div id="game"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

- [ ] **Step 6: Write `src/main.ts` (minimal placeholder)**

```ts
import Phaser from 'phaser';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game',
  width: 1024,
  height: 1024,
  pixelArt: true,
  backgroundColor: '#1a1a1a',
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: [],
};

new Phaser.Game(config);
```

- [ ] **Step 7: Write `.gitignore`**

```
node_modules
dist
.DS_Store
*.log
.vite
coverage
```

- [ ] **Step 8: Write `.eslintrc.cjs`**

```js
module.exports = {
  parser: '@typescript-eslint/parser',
  parserOptions: { ecmaVersion: 2022, sourceType: 'module' },
  plugins: ['@typescript-eslint'],
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended', 'prettier'],
  rules: { '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }] },
};
```

- [ ] **Step 9: Write `.prettierrc`**

```json
{ "singleQuote": true, "trailingComma": "all", "printWidth": 100, "semi": true }
```

- [ ] **Step 10: Update `package.json` scripts**

Replace the `"scripts"` block in `package.json` with:

```json
"scripts": {
  "dev": "vite",
  "build": "tsc --noEmit && vite build",
  "preview": "vite preview",
  "test": "vitest",
  "test:run": "vitest run",
  "lint": "eslint src tests --ext .ts",
  "format": "prettier --write src tests"
}
```

- [ ] **Step 11: Verify build**

Run:
```bash
npm run build
```
Expected: success, no TypeScript errors.

- [ ] **Step 12: Commit**

```bash
git add -A
git commit -m "chore: scaffold vite + phaser + ts + vitest project"
```

---

## Task 2: Constants + IDs + RNG

**Files:**
- Create: `src/config.ts`, `src/domain/ids.ts`, `src/systems/rng.ts`
- Test: `tests/unit/systems/rng.test.ts`

- [ ] **Step 1: Write failing RNG test**

`tests/unit/systems/rng.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { createRng } from '../../../src/systems/rng';

describe('rng', () => {
  it('produces deterministic sequence for a given seed', () => {
    const a = createRng(42);
    const b = createRng(42);
    const seqA = [a(), a(), a()];
    const seqB = [b(), b(), b()];
    expect(seqA).toEqual(seqB);
  });

  it('produces different sequences for different seeds', () => {
    const a = createRng(1)();
    const b = createRng(2)();
    expect(a).not.toEqual(b);
  });

  it('returns values in [0, 1)', () => {
    const r = createRng(99);
    for (let i = 0; i < 1000; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});
```

- [ ] **Step 2: Run — expect FAIL (module not found)**

```bash
npm run test:run -- tests/unit/systems/rng.test.ts
```
Expected: FAIL.

- [ ] **Step 3: Implement `src/systems/rng.ts`**

```ts
export type Rng = () => number;

export function createRng(seed: number): Rng {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function rngInt(rng: Rng, minInclusive: number, maxExclusive: number): number {
  return Math.floor(rng() * (maxExclusive - minInclusive)) + minInclusive;
}

export function rngPick<T>(rng: Rng, items: readonly T[]): T {
  if (items.length === 0) throw new Error('rngPick: empty');
  return items[rngInt(rng, 0, items.length)]!;
}
```

- [ ] **Step 4: Verify PASS**

```bash
npm run test:run -- tests/unit/systems/rng.test.ts
```

- [ ] **Step 5: Implement `src/domain/ids.ts`**

```ts
let counter = 0;

export function nextId(prefix: string): string {
  counter += 1;
  return `${prefix}_${counter}`;
}

export function resetIdsForTests(): void {
  counter = 0;
}
```

- [ ] **Step 6: Implement `src/config.ts`**

```ts
export const TILE_SIZE = 16;
export const MAP_WIDTH = 32;
export const MAP_HEIGHT = 32;
export const RENDER_SCALE = 2;
export const SIM_TICK_MS = 1000;
export const DAY_START_HOUR = 6;
export const SEASON_DAYS = 30;
export const SAVE_KEY = 'village-sim/state/v1';
export const SAVE_VERSION = 1;
export const MAX_CATCHUP_DAYS = 30;

export const SEASONS = ['spring', 'summer', 'autumn', 'winter'] as const;
export type Season = (typeof SEASONS)[number];
```

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: add rng, ids, config constants"
```

---

## Task 3: Domain types

**Files:**
- Create: `src/domain/tile.ts`, `src/domain/building.ts`, `src/domain/villager.ts`, `src/domain/crop.ts`, `src/domain/state.ts`

- [ ] **Step 1: Write `src/domain/tile.ts`**

```ts
export type TileKind = 'grass' | 'dirt' | 'water' | 'path';

export type Tile = {
  readonly x: number;
  readonly y: number;
  readonly kind: TileKind;
};
```

- [ ] **Step 2: Write `src/domain/building.ts`**

```ts
export type BuildingKind =
  | 'townHall'
  | 'house'
  | 'farm'
  | 'forge'
  | 'mill'
  | 'well'
  | 'square';

export type Building = {
  readonly id: string;
  readonly kind: BuildingKind;
  readonly tileX: number;
  readonly tileY: number;
  readonly builtAt: number;
};

export const BUILDING_FOOTPRINT: Record<BuildingKind, { w: number; h: number }> = {
  townHall: { w: 3, h: 3 },
  house: { w: 2, h: 2 },
  farm: { w: 3, h: 3 },
  forge: { w: 2, h: 2 },
  mill: { w: 2, h: 2 },
  well: { w: 1, h: 1 },
  square: { w: 3, h: 3 },
};

export const HOUSE_CAPACITY = 2;

export function isWorkBuilding(kind: BuildingKind): boolean {
  return kind === 'farm' || kind === 'forge' || kind === 'mill';
}
```

- [ ] **Step 3: Write `src/domain/villager.ts`**

```ts
export type ScheduleEntry = {
  readonly fromHour: number;     // 0-23 inclusive
  readonly toHour: number;       // 0-24 exclusive
  readonly activity: 'sleep' | 'work' | 'idle';
  readonly buildingId?: string;
};

export type Villager = {
  readonly id: string;
  readonly name: string;
  readonly homeId: string;
  readonly workplaceId?: string;
  readonly schedule: readonly ScheduleEntry[];
  readonly spriteVariant: number;
};

export const VILLAGER_NAMES: readonly string[] = [
  'Alma', 'Bran', 'Cora', 'Dorian', 'Elin', 'Faust',
  'Gilda', 'Hadrien', 'Iona', 'Joran', 'Kira', 'Loris',
  'Maël', 'Nora', 'Orin', 'Perla', 'Quentin', 'Reva',
];
```

- [ ] **Step 4: Write `src/domain/crop.ts`**

```ts
export type CropKind = 'wheat' | 'orchard';

export type Crop = {
  readonly id: string;
  readonly kind: CropKind;
  readonly tileX: number;
  readonly tileY: number;
  readonly plantedAt: number;
};

export const CROP_GROWTH_MS: Record<CropKind, number> = {
  wheat: 7 * 24 * 60 * 60 * 1000,
  orchard: 30 * 24 * 60 * 60 * 1000,
};

export function cropStage(crop: Crop, now: number): 0 | 1 | 2 | 3 {
  const total = CROP_GROWTH_MS[crop.kind];
  const age = Math.max(0, now - crop.plantedAt);
  const ratio = Math.min(1, age / total);
  if (ratio < 0.33) return 0;
  if (ratio < 0.66) return 1;
  if (ratio < 1) return 2;
  return 3;
}
```

- [ ] **Step 5: Write `src/domain/state.ts`**

```ts
import { Tile } from './tile';
import { Building } from './building';
import { Villager } from './villager';
import { Crop } from './crop';
import { SAVE_VERSION, MAP_WIDTH, MAP_HEIGHT } from '../config';

export type GameState = {
  readonly version: number;
  readonly createdAt: number;
  readonly lastSeenAt: number;
  readonly lastActionDate: string;
  readonly seed: number;
  readonly world: {
    readonly width: number;
    readonly height: number;
    readonly tiles: readonly Tile[];
    readonly buildings: readonly Building[];
    readonly crops: readonly Crop[];
    readonly villagers: readonly Villager[];
  };
  readonly progression: {
    readonly day: number;
    readonly townHallLevel: number;
    readonly unlockedCards: readonly string[];
  };
};

export function emptyState(now: number, seed: number): GameState {
  const tiles: Tile[] = [];
  for (let y = 0; y < MAP_HEIGHT; y++) {
    for (let x = 0; x < MAP_WIDTH; x++) {
      tiles.push({ x, y, kind: 'grass' });
    }
  }
  return {
    version: SAVE_VERSION,
    createdAt: now,
    lastSeenAt: now,
    lastActionDate: '',
    seed,
    world: { width: MAP_WIDTH, height: MAP_HEIGHT, tiles, buildings: [], crops: [], villagers: [] },
    progression: { day: 0, townHallLevel: 1, unlockedCards: [] },
  };
}
```

- [ ] **Step 6: Verify compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: add domain types (tile/building/villager/crop/state)"
```

---

## Task 4: Clock + Season systems

**Files:**
- Create: `src/systems/clock.ts`, `src/systems/season.ts`
- Test: `tests/unit/systems/clock.test.ts`, `tests/unit/systems/season.test.ts`

- [ ] **Step 1: Write failing `clock.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { dayIndex, hourOfDay, dateKey, daysBetween } from '../../../src/systems/clock';

describe('clock', () => {
  it('dayIndex counts whole days since createdAt at local midnight', () => {
    const created = new Date(2026, 4, 20, 14, 0, 0).getTime();   // May 20 14:00
    const same = new Date(2026, 4, 20, 23, 59, 0).getTime();
    const next = new Date(2026, 4, 21, 0, 1, 0).getTime();
    expect(dayIndex(created, same)).toBe(0);
    expect(dayIndex(created, next)).toBe(1);
  });

  it('hourOfDay returns local hour 0-23', () => {
    const t = new Date(2026, 4, 20, 7, 30).getTime();
    expect(hourOfDay(t)).toBe(7);
  });

  it('dateKey returns YYYY-MM-DD local', () => {
    const t = new Date(2026, 4, 20, 12, 0).getTime();
    expect(dateKey(t)).toBe('2026-05-20');
  });

  it('daysBetween returns whole-day delta', () => {
    const a = new Date(2026, 4, 20, 14).getTime();
    const b = new Date(2026, 4, 23, 8).getTime();
    expect(daysBetween(a, b)).toBe(3);
  });
});
```

- [ ] **Step 2: Verify FAIL**

```bash
npm run test:run -- tests/unit/systems/clock.test.ts
```

- [ ] **Step 3: Implement `src/systems/clock.ts`**

```ts
function startOfLocalDay(t: number): number {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function dayIndex(createdAt: number, now: number): number {
  const startCreated = startOfLocalDay(createdAt);
  const startNow = startOfLocalDay(now);
  return Math.round((startNow - startCreated) / (24 * 60 * 60 * 1000));
}

export function hourOfDay(t: number): number {
  return new Date(t).getHours();
}

export function dateKey(t: number): string {
  const d = new Date(t);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function daysBetween(a: number, b: number): number {
  const sa = startOfLocalDay(a);
  const sb = startOfLocalDay(b);
  return Math.round((sb - sa) / (24 * 60 * 60 * 1000));
}
```

- [ ] **Step 4: Verify PASS**

```bash
npm run test:run -- tests/unit/systems/clock.test.ts
```

- [ ] **Step 5: Write failing `season.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { seasonForDay } from '../../../src/systems/season';

describe('season', () => {
  it('cycles spring/summer/autumn/winter every 30 days', () => {
    expect(seasonForDay(0)).toBe('spring');
    expect(seasonForDay(29)).toBe('spring');
    expect(seasonForDay(30)).toBe('summer');
    expect(seasonForDay(60)).toBe('autumn');
    expect(seasonForDay(90)).toBe('winter');
    expect(seasonForDay(120)).toBe('spring');
  });
});
```

- [ ] **Step 6: Verify FAIL**

- [ ] **Step 7: Implement `src/systems/season.ts`**

```ts
import { SEASONS, SEASON_DAYS, Season } from '../config';

export function seasonForDay(day: number): Season {
  const idx = Math.floor(day / SEASON_DAYS) % SEASONS.length;
  return SEASONS[((idx % SEASONS.length) + SEASONS.length) % SEASONS.length]!;
}
```

- [ ] **Step 8: Verify PASS**

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: add clock and season systems"
```

---

## Task 5: Weather system

**Files:**
- Create: `src/systems/weather.ts`
- Test: `tests/unit/systems/weather.test.ts`

- [ ] **Step 1: Write failing `weather.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { weatherForDay } from '../../../src/systems/weather';

describe('weather', () => {
  it('is deterministic for given (seed, day)', () => {
    const a = weatherForDay(42, 5);
    const b = weatherForDay(42, 5);
    expect(a).toEqual(b);
  });

  it('returns snow only in winter', () => {
    let snowOutsideWinter = 0;
    for (let d = 0; d < 30; d++) {
      if (weatherForDay(1, d).kind === 'snow') snowOutsideWinter++;
    }
    expect(snowOutsideWinter).toBe(0);
  });

  it('valid kinds only', () => {
    const kinds = new Set(['clear', 'rain', 'snow']);
    for (let d = 0; d < 120; d++) {
      expect(kinds.has(weatherForDay(7, d).kind)).toBe(true);
    }
  });
});
```

- [ ] **Step 2: Verify FAIL**

- [ ] **Step 3: Implement `src/systems/weather.ts`**

```ts
import { createRng } from './rng';
import { seasonForDay } from './season';

export type Weather = { kind: 'clear' | 'rain' | 'snow' };

export function weatherForDay(seed: number, day: number): Weather {
  const r = createRng((seed ^ (day * 2654435761)) >>> 0)();
  const season = seasonForDay(day);
  if (season === 'winter') {
    if (r < 0.25) return { kind: 'snow' };
    if (r < 0.35) return { kind: 'rain' };
    return { kind: 'clear' };
  }
  if (season === 'autumn') return r < 0.35 ? { kind: 'rain' } : { kind: 'clear' };
  if (season === 'spring') return r < 0.3 ? { kind: 'rain' } : { kind: 'clear' };
  return r < 0.1 ? { kind: 'rain' } : { kind: 'clear' };
}
```

- [ ] **Step 4: Verify PASS**

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add deterministic weather system"
```

---

## Task 6: World seed — initial Town Hall + map utilities

**Files:**
- Create: `src/systems/worldOps.ts`
- Test: `tests/unit/systems/worldOps.test.ts`

These pure helpers let later code place buildings, find free tiles, and seed the initial map.

- [ ] **Step 1: Write failing test**

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { emptyState } from '../../../src/domain/state';
import {
  placeBuilding,
  isFootprintFree,
  findFreeSpot,
} from '../../../src/systems/worldOps';
import { resetIdsForTests } from '../../../src/domain/ids';

describe('worldOps', () => {
  beforeEach(() => resetIdsForTests());

  it('placeBuilding adds building and returns new state', () => {
    const s0 = emptyState(0, 1);
    const s1 = placeBuilding(s0, 'house', 5, 5, 0);
    expect(s1.world.buildings).toHaveLength(1);
    expect(s0.world.buildings).toHaveLength(0); // immutability
    expect(s1.world.buildings[0]!.kind).toBe('house');
  });

  it('isFootprintFree detects overlaps', () => {
    let s = emptyState(0, 1);
    s = placeBuilding(s, 'house', 5, 5, 0);
    expect(isFootprintFree(s, 'house', 5, 5)).toBe(false);
    expect(isFootprintFree(s, 'house', 10, 10)).toBe(true);
  });

  it('findFreeSpot returns a free tile near origin', () => {
    let s = emptyState(0, 1);
    s = placeBuilding(s, 'townHall', 15, 15, 0);
    const spot = findFreeSpot(s, 'house', 15, 15);
    expect(spot).not.toBeNull();
    expect(isFootprintFree(s, 'house', spot!.x, spot!.y)).toBe(true);
  });

  it('isFootprintFree rejects out-of-bounds', () => {
    const s = emptyState(0, 1);
    expect(isFootprintFree(s, 'townHall', 31, 31)).toBe(false);
  });
});
```

- [ ] **Step 2: Verify FAIL**

- [ ] **Step 3: Implement `src/systems/worldOps.ts`**

```ts
import { GameState } from '../domain/state';
import { Building, BuildingKind, BUILDING_FOOTPRINT } from '../domain/building';
import { nextId } from '../domain/ids';

export function isFootprintFree(
  state: GameState,
  kind: BuildingKind,
  x: number,
  y: number,
): boolean {
  const { w, h } = BUILDING_FOOTPRINT[kind];
  if (x < 0 || y < 0 || x + w > state.world.width || y + h > state.world.height) return false;
  for (const b of state.world.buildings) {
    const bf = BUILDING_FOOTPRINT[b.kind];
    const overlap =
      x < b.tileX + bf.w && x + w > b.tileX && y < b.tileY + bf.h && y + h > b.tileY;
    if (overlap) return false;
  }
  return true;
}

export function placeBuilding(
  state: GameState,
  kind: BuildingKind,
  x: number,
  y: number,
  now: number,
): GameState {
  if (!isFootprintFree(state, kind, x, y)) {
    throw new Error(`placeBuilding: footprint occupied at ${x},${y}`);
  }
  const b: Building = { id: nextId('b'), kind, tileX: x, tileY: y, builtAt: now };
  return {
    ...state,
    world: { ...state.world, buildings: [...state.world.buildings, b] },
  };
}

export function findFreeSpot(
  state: GameState,
  kind: BuildingKind,
  originX: number,
  originY: number,
): { x: number; y: number } | null {
  const maxRadius = Math.max(state.world.width, state.world.height);
  for (let r = 1; r < maxRadius; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
        const x = originX + dx;
        const y = originY + dy;
        if (isFootprintFree(state, kind, x, y)) return { x, y };
      }
    }
  }
  return null;
}
```

- [ ] **Step 4: Verify PASS**

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add worldOps (placeBuilding, isFootprintFree, findFreeSpot)"
```

---

## Task 7: Villager AI — position from schedule

**Files:**
- Create: `src/systems/villagerAI.ts`
- Test: `tests/unit/systems/villagerAI.test.ts`

- [ ] **Step 1: Write failing test**

```ts
import { describe, it, expect } from 'vitest';
import { villagerActivityAt } from '../../../src/systems/villagerAI';
import { Villager } from '../../../src/domain/villager';

const v: Villager = {
  id: 'v1',
  name: 'Alma',
  homeId: 'house1',
  workplaceId: 'farm1',
  spriteVariant: 0,
  schedule: [
    { fromHour: 22, toHour: 24, activity: 'sleep', buildingId: 'house1' },
    { fromHour: 0, toHour: 6, activity: 'sleep', buildingId: 'house1' },
    { fromHour: 6, toHour: 8, activity: 'idle' },
    { fromHour: 8, toHour: 18, activity: 'work', buildingId: 'farm1' },
    { fromHour: 18, toHour: 22, activity: 'idle' },
  ],
};

describe('villagerAI', () => {
  it('returns sleep activity at night', () => {
    expect(villagerActivityAt(v, 3).activity).toBe('sleep');
    expect(villagerActivityAt(v, 23).activity).toBe('sleep');
  });

  it('returns work activity during work hours', () => {
    const a = villagerActivityAt(v, 10);
    expect(a.activity).toBe('work');
    expect(a.buildingId).toBe('farm1');
  });

  it('returns idle when no slot matches work', () => {
    expect(villagerActivityAt(v, 7).activity).toBe('idle');
  });

  it('villager without workplace never works', () => {
    const u: Villager = { ...v, workplaceId: undefined, schedule: [
      { fromHour: 0, toHour: 6, activity: 'sleep', buildingId: 'house1' },
      { fromHour: 6, toHour: 24, activity: 'idle' },
    ]};
    expect(villagerActivityAt(u, 10).activity).toBe('idle');
  });
});
```

- [ ] **Step 2: Verify FAIL**

- [ ] **Step 3: Implement `src/systems/villagerAI.ts`**

```ts
import { Villager, ScheduleEntry } from '../domain/villager';

export function villagerActivityAt(v: Villager, hour: number): ScheduleEntry {
  for (const s of v.schedule) {
    if (hour >= s.fromHour && hour < s.toHour) return s;
  }
  return { fromHour: hour, toHour: hour + 1, activity: 'idle' };
}

export function defaultSchedule(workplaceId?: string): ScheduleEntry[] {
  if (workplaceId) {
    return [
      { fromHour: 0, toHour: 6, activity: 'sleep' },
      { fromHour: 6, toHour: 8, activity: 'idle' },
      { fromHour: 8, toHour: 18, activity: 'work', buildingId: workplaceId },
      { fromHour: 18, toHour: 22, activity: 'idle' },
      { fromHour: 22, toHour: 24, activity: 'sleep' },
    ];
  }
  return [
    { fromHour: 0, toHour: 6, activity: 'sleep' },
    { fromHour: 6, toHour: 22, activity: 'idle' },
    { fromHour: 22, toHour: 24, activity: 'sleep' },
  ];
}
```

- [ ] **Step 4: Verify PASS**

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add villagerAI schedule resolution"
```

---

## Task 8: Progression metrics

**Files:**
- Create: `src/systems/progression.ts`
- Test: `tests/unit/systems/progression.test.ts`

- [ ] **Step 1: Write failing test**

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { emptyState } from '../../../src/domain/state';
import { computeMetrics, canUpgradeTownHall, townHallRequirements } from '../../../src/systems/progression';
import { placeBuilding } from '../../../src/systems/worldOps';
import { resetIdsForTests } from '../../../src/domain/ids';

describe('progression', () => {
  beforeEach(() => resetIdsForTests());

  it('computes zeroed metrics for empty state', () => {
    const m = computeMetrics(emptyState(0, 1));
    expect(m.populationHoused).toBe(0);
    expect(m.populationCurrent).toBe(0);
    expect(m.populationFree).toBe(0);
    expect(m.buildingsIdle).toBe(0);
  });

  it('houses contribute capacity', () => {
    let s = emptyState(0, 1);
    s = placeBuilding(s, 'house', 5, 5, 0);
    s = placeBuilding(s, 'house', 10, 5, 0);
    const m = computeMetrics(s);
    expect(m.populationHoused).toBe(4);
  });

  it('canUpgradeTownHall checks level requirements', () => {
    let s = emptyState(0, 1);
    s = placeBuilding(s, 'townHall', 15, 15, 0);
    expect(canUpgradeTownHall(s)).toBe(false);
    const req = townHallRequirements(s.progression.townHallLevel);
    expect(req.minHouses).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Verify FAIL**

- [ ] **Step 3: Implement `src/systems/progression.ts`**

```ts
import { GameState } from '../domain/state';
import { HOUSE_CAPACITY, isWorkBuilding } from '../domain/building';

export type Metrics = {
  populationHoused: number;
  populationCurrent: number;
  populationFree: number;
  buildingsIdle: number;
  workBuildings: number;
};

export function computeMetrics(state: GameState): Metrics {
  const houses = state.world.buildings.filter((b) => b.kind === 'house');
  const populationHoused = houses.length * HOUSE_CAPACITY;
  const populationCurrent = state.world.villagers.length;
  const populationFree = state.world.villagers.filter((v) => !v.workplaceId).length;
  const workBuildingIds = state.world.buildings
    .filter((b) => isWorkBuilding(b.kind))
    .map((b) => b.id);
  const assignedIds = new Set(
    state.world.villagers.map((v) => v.workplaceId).filter(Boolean) as string[],
  );
  const buildingsIdle = workBuildingIds.filter((id) => !assignedIds.has(id)).length;
  return {
    populationHoused,
    populationCurrent,
    populationFree,
    buildingsIdle,
    workBuildings: workBuildingIds.length,
  };
}

export type TownHallReq = {
  minHouses: number;
  minEmployed: number;
  minDaysSinceLast: number;
};

export function townHallRequirements(level: number): TownHallReq {
  return {
    minHouses: Math.max(1, level) * 2,
    minEmployed: Math.max(0, level - 1) * 2 + 1,
    minDaysSinceLast: 7 * level,
  };
}

export function canUpgradeTownHall(state: GameState): boolean {
  const req = townHallRequirements(state.progression.townHallLevel);
  const houses = state.world.buildings.filter((b) => b.kind === 'house').length;
  if (houses < req.minHouses) return false;
  const employed = state.world.villagers.filter((v) => v.workplaceId).length;
  if (employed < req.minEmployed) return false;
  return true;
}
```

- [ ] **Step 4: Verify PASS**

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add progression metrics + town hall upgrade conditions"
```

---

## Task 9: Card types + initial deck

**Files:**
- Create: `src/cards/types.ts`, `src/cards/deck.ts`
- Test: `tests/unit/cards/deck.test.ts`

- [ ] **Step 1: Write `src/cards/types.ts`**

```ts
import { GameState } from '../domain/state';

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
  readonly isAvailable: (state: GameState) => boolean;
  readonly effect: (state: GameState, now: number) => GameState;
};
```

- [ ] **Step 2: Write failing test for deck**

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { ALL_CARDS, cardById } from '../../../src/cards/deck';
import { emptyState } from '../../../src/domain/state';
import { placeBuilding } from '../../../src/systems/worldOps';
import { resetIdsForTests } from '../../../src/domain/ids';

describe('deck', () => {
  beforeEach(() => resetIdsForTests());

  it('all cards have unique ids', () => {
    const ids = ALL_CARDS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('cardById returns matching card', () => {
    const first = ALL_CARDS[0]!;
    expect(cardById(first.id)).toBe(first);
  });

  it('build-house card adds a house', () => {
    let s = emptyState(0, 1);
    s = placeBuilding(s, 'townHall', 15, 15, 0);
    const card = cardById('build_house');
    expect(card.isAvailable(s)).toBe(true);
    const s2 = card.effect(s, 0);
    expect(s2.world.buildings.filter((b) => b.kind === 'house')).toHaveLength(1);
  });

  it('recruit card unavailable when no free housing', () => {
    let s = emptyState(0, 1);
    s = placeBuilding(s, 'townHall', 15, 15, 0);
    const recruit = cardById('recruit_villager');
    expect(recruit.isAvailable(s)).toBe(false);
  });
});
```

- [ ] **Step 3: Verify FAIL**

- [ ] **Step 4: Implement `src/cards/deck.ts`**

```ts
import { ActionCard } from './types';
import { GameState } from '../domain/state';
import { placeBuilding, findFreeSpot } from '../systems/worldOps';
import { computeMetrics, canUpgradeTownHall } from '../systems/progression';
import { nextId } from '../domain/ids';
import { Villager, VILLAGER_NAMES } from '../domain/villager';
import { defaultSchedule } from '../systems/villagerAI';
import { createRng, rngPick, rngInt } from '../systems/rng';
import { isWorkBuilding } from '../domain/building';

function townHallOrCenter(state: GameState): { x: number; y: number } {
  const th = state.world.buildings.find((b) => b.kind === 'townHall');
  if (th) return { x: th.tileX, y: th.tileY };
  return { x: Math.floor(state.world.width / 2), y: Math.floor(state.world.height / 2) };
}

function pickFreeHouseId(state: GameState): string | undefined {
  const occupied = new Set(state.world.villagers.map((v) => v.homeId));
  const free = state.world.buildings.find((b) => b.kind === 'house' && !occupied.has(b.id));
  return free?.id;
}

export const ALL_CARDS: readonly ActionCard[] = [
  {
    id: 'build_house',
    title: 'Construire une maison',
    description: '+2 places pour villageois.',
    icon: 'house',
    category: 'housing',
    minTier: 1,
    weight: 10,
    isAvailable: (s) => {
      const c = townHallOrCenter(s);
      return findFreeSpot(s, 'house', c.x, c.y) !== null;
    },
    effect: (s, now) => {
      const c = townHallOrCenter(s);
      const spot = findFreeSpot(s, 'house', c.x, c.y);
      if (!spot) return s;
      return placeBuilding(s, 'house', spot.x, spot.y, now);
    },
  },
  {
    id: 'build_farm',
    title: 'Construire une ferme',
    description: 'Bâtiment de travail (assigner un villageois).',
    icon: 'farm',
    category: 'work',
    minTier: 1,
    weight: 6,
    isAvailable: (s) => {
      const c = townHallOrCenter(s);
      return findFreeSpot(s, 'farm', c.x, c.y) !== null;
    },
    effect: (s, now) => {
      const c = townHallOrCenter(s);
      const spot = findFreeSpot(s, 'farm', c.x, c.y);
      if (!spot) return s;
      return placeBuilding(s, 'farm', spot.x, spot.y, now);
    },
  },
  {
    id: 'build_forge',
    title: 'Construire une forge',
    description: 'Bâtiment de travail (assigner un villageois).',
    icon: 'forge',
    category: 'work',
    minTier: 2,
    weight: 5,
    isAvailable: (s) => {
      if (s.progression.townHallLevel < 2) return false;
      const c = townHallOrCenter(s);
      return findFreeSpot(s, 'forge', c.x, c.y) !== null;
    },
    effect: (s, now) => {
      const c = townHallOrCenter(s);
      const spot = findFreeSpot(s, 'forge', c.x, c.y);
      if (!spot) return s;
      return placeBuilding(s, 'forge', spot.x, spot.y, now);
    },
  },
  {
    id: 'build_mill',
    title: 'Construire un moulin',
    description: 'Bâtiment de travail (assigner un villageois).',
    icon: 'mill',
    category: 'work',
    minTier: 2,
    weight: 5,
    isAvailable: (s) => {
      if (s.progression.townHallLevel < 2) return false;
      const c = townHallOrCenter(s);
      return findFreeSpot(s, 'mill', c.x, c.y) !== null;
    },
    effect: (s, now) => {
      const c = townHallOrCenter(s);
      const spot = findFreeSpot(s, 'mill', c.x, c.y);
      if (!spot) return s;
      return placeBuilding(s, 'mill', spot.x, spot.y, now);
    },
  },
  {
    id: 'build_well',
    title: 'Creuser un puits',
    description: 'Infrastructure (zone vivable).',
    icon: 'well',
    category: 'infrastructure',
    minTier: 1,
    weight: 3,
    isAvailable: (s) => {
      const c = townHallOrCenter(s);
      return findFreeSpot(s, 'well', c.x, c.y) !== null;
    },
    effect: (s, now) => {
      const c = townHallOrCenter(s);
      const spot = findFreeSpot(s, 'well', c.x, c.y);
      if (!spot) return s;
      return placeBuilding(s, 'well', spot.x, spot.y, now);
    },
  },
  {
    id: 'recruit_villager',
    title: 'Accueillir un villageois',
    description: 'Un nouveau venu s\'installe (nécessite une maison libre).',
    icon: 'villager',
    category: 'recruit',
    minTier: 1,
    weight: 8,
    isAvailable: (s) => pickFreeHouseId(s) !== undefined,
    effect: (s, _now) => {
      const homeId = pickFreeHouseId(s);
      if (!homeId) return s;
      const rng = createRng(s.seed + s.world.villagers.length);
      const name = rngPick(rng, VILLAGER_NAMES);
      const variant = rngInt(rng, 0, 4);
      const v: Villager = {
        id: nextId('v'),
        name,
        homeId,
        spriteVariant: variant,
        schedule: defaultSchedule(),
      };
      return { ...s, world: { ...s.world, villagers: [...s.world.villagers, v] } };
    },
  },
  {
    id: 'assign_worker',
    title: 'Assigner un villageois',
    description: 'Donne un emploi à un villageois libre.',
    icon: 'assign',
    category: 'assign',
    minTier: 1,
    weight: 7,
    isAvailable: (s) => {
      const m = computeMetrics(s);
      return m.buildingsIdle > 0 && m.populationFree > 0;
    },
    effect: (s, _now) => {
      const free = s.world.villagers.find((v) => !v.workplaceId);
      if (!free) return s;
      const assignedIds = new Set(
        s.world.villagers.map((v) => v.workplaceId).filter(Boolean) as string[],
      );
      const idleBuilding = s.world.buildings.find(
        (b) => isWorkBuilding(b.kind) && !assignedIds.has(b.id),
      );
      if (!idleBuilding) return s;
      const updated: Villager = {
        ...free,
        workplaceId: idleBuilding.id,
        schedule: defaultSchedule(idleBuilding.id),
      };
      return {
        ...s,
        world: {
          ...s.world,
          villagers: s.world.villagers.map((v) => (v.id === free.id ? updated : v)),
        },
      };
    },
  },
  {
    id: 'upgrade_town_hall',
    title: 'Agrandir la mairie',
    description: 'Monte le palier (débloque nouvelles cartes).',
    icon: 'townHall',
    category: 'townHall',
    minTier: 1,
    weight: 4,
    isAvailable: (s) => canUpgradeTownHall(s),
    effect: (s, _now) => ({
      ...s,
      progression: { ...s.progression, townHallLevel: s.progression.townHallLevel + 1 },
    }),
  },
  {
    id: 'festival',
    title: 'Organiser un festival',
    description: 'Villageois se rassemblent sur la place (ambiance).',
    icon: 'festival',
    category: 'event',
    minTier: 1,
    weight: 2,
    isAvailable: (s) => s.world.villagers.length >= 3,
    effect: (s, _now) => s, // visuel handled via lastActionDate + day-of marker; no state change
  },
];

const BY_ID = new Map(ALL_CARDS.map((c) => [c.id, c]));

export function cardById(id: string): ActionCard {
  const c = BY_ID.get(id);
  if (!c) throw new Error(`Unknown card id: ${id}`);
  return c;
}
```

- [ ] **Step 5: Verify PASS**

```bash
npm run test:run -- tests/unit/cards/deck.test.ts
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add card types and initial deck (housing/work/recruit/assign/event)"
```

---

## Task 10: Daily action — draw + apply

**Files:**
- Create: `src/systems/dailyAction.ts`
- Test: `tests/unit/systems/dailyAction.test.ts`

- [ ] **Step 1: Write failing test**

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { drawCards, applyChosenCard, isActionAvailable } from '../../../src/systems/dailyAction';
import { emptyState } from '../../../src/domain/state';
import { placeBuilding } from '../../../src/systems/worldOps';
import { resetIdsForTests } from '../../../src/domain/ids';

describe('dailyAction', () => {
  beforeEach(() => resetIdsForTests());

  it('isActionAvailable false when same day already played', () => {
    const now = new Date(2026, 4, 20, 9).getTime();
    const s = { ...emptyState(now, 1), lastActionDate: '2026-05-20' };
    expect(isActionAvailable(s, now)).toBe(false);
  });

  it('isActionAvailable false before 06:00 even if new day', () => {
    const now = new Date(2026, 4, 21, 5).getTime();
    const s = { ...emptyState(now, 1), lastActionDate: '2026-05-20' };
    expect(isActionAvailable(s, now)).toBe(false);
  });

  it('isActionAvailable true after 06:00 on a new day', () => {
    const now = new Date(2026, 4, 21, 7).getTime();
    const s = { ...emptyState(now, 1), lastActionDate: '2026-05-20' };
    expect(isActionAvailable(s, now)).toBe(true);
  });

  it('drawCards returns 3 distinct available cards', () => {
    let s = emptyState(0, 1);
    s = placeBuilding(s, 'townHall', 15, 15, 0);
    const cards = drawCards(s, 0);
    expect(cards).toHaveLength(3);
    expect(new Set(cards.map((c) => c.id)).size).toBe(3);
  });

  it('applyChosenCard updates lastActionDate and applies effect', () => {
    let s = emptyState(0, 1);
    s = placeBuilding(s, 'townHall', 15, 15, 0);
    const cards = drawCards(s, 0);
    const now = new Date(2026, 4, 21, 7).getTime();
    const s2 = applyChosenCard(s, cards[0]!.id, now);
    expect(s2.lastActionDate).toBe('2026-05-21');
    expect(s2.lastSeenAt).toBe(now);
  });
});
```

- [ ] **Step 2: Verify FAIL**

- [ ] **Step 3: Implement `src/systems/dailyAction.ts`**

```ts
import { GameState } from '../domain/state';
import { ActionCard } from '../cards/types';
import { ALL_CARDS, cardById } from '../cards/deck';
import { createRng, rngInt } from './rng';
import { computeMetrics } from './progression';
import { dateKey, hourOfDay } from './clock';
import { DAY_START_HOUR } from '../config';

export function isActionAvailable(state: GameState, now: number): boolean {
  if (hourOfDay(now) < DAY_START_HOUR) return false;
  return dateKey(now) !== state.lastActionDate;
}

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
  const rng = createRng((state.seed ^ Math.floor(now / 1000)) >>> 0);
  const picked: ActionCard[] = [];
  const remaining = [...pool];
  while (picked.length < 3 && remaining.length > 0) {
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
  // silence unused import warning
  void rngInt;
  return picked;
}

export function applyChosenCard(state: GameState, cardId: string, now: number): GameState {
  const card = cardById(cardId);
  const after = card.effect(state, now);
  return { ...after, lastActionDate: dateKey(now), lastSeenAt: now };
}
```

- [ ] **Step 4: Verify PASS**

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add daily action system (gate, draw, apply)"
```

---

## Task 11: Catch-up + day update

**Files:**
- Create: `src/systems/catchup.ts`
- Test: `tests/unit/systems/catchup.test.ts`

- [ ] **Step 1: Write failing test**

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
});
```

- [ ] **Step 2: Verify FAIL**

- [ ] **Step 3: Implement `src/systems/catchup.ts`**

```ts
import { GameState } from '../domain/state';
import { dayIndex } from './clock';
import { MAX_CATCHUP_DAYS } from '../config';

export function catchUp(state: GameState, now: number): GameState {
  const elapsed = dayIndex(state.createdAt, now);
  const day = Math.min(elapsed, state.progression.day + MAX_CATCHUP_DAYS);
  if (day === state.progression.day && now === state.lastSeenAt) return state;
  return {
    ...state,
    lastSeenAt: now,
    progression: { ...state.progression, day },
  };
}
```

- [ ] **Step 4: Verify PASS**

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add catchUp (offline day progression, capped)"
```

---

## Task 12: Save system (localStorage + migration)

**Files:**
- Create: `src/systems/save.ts`
- Test: `tests/unit/systems/save.test.ts`

- [ ] **Step 1: Write failing test**

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { saveState, loadState, clearSave } from '../../../src/systems/save';
import { emptyState } from '../../../src/domain/state';
import { SAVE_KEY } from '../../../src/config';

describe('save', () => {
  beforeEach(() => localStorage.clear());

  it('save+load roundtrips state', () => {
    const s = emptyState(0, 42);
    saveState(s);
    const loaded = loadState();
    expect(loaded).toEqual(s);
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

  it('clearSave removes data', () => {
    saveState(emptyState(0, 1));
    clearSave();
    expect(loadState()).toBeNull();
  });
});
```

- [ ] **Step 2: Verify FAIL**

- [ ] **Step 3: Implement `src/systems/save.ts`**

```ts
import { GameState } from '../domain/state';
import { SAVE_KEY, SAVE_VERSION } from '../config';

export function saveState(state: GameState): void {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error('saveState failed', e);
  }
}

export function loadState(): GameState | null {
  const raw = localStorage.getItem(SAVE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as GameState;
    if (parsed.version !== SAVE_VERSION) {
      console.warn('save version mismatch; ignoring');
      return null;
    }
    return parsed;
  } catch (e) {
    console.error('loadState failed', e);
    return null;
  }
}

export function clearSave(): void {
  localStorage.removeItem(SAVE_KEY);
}
```

- [ ] **Step 4: Verify PASS**

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add save system (localStorage + version gate)"
```

---

## Task 13: World seeding (initial Town Hall)

**Files:**
- Create: `src/systems/init.ts`
- Test: `tests/unit/systems/init.test.ts`

- [ ] **Step 1: Write failing test**

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { initWorld } from '../../../src/systems/init';
import { resetIdsForTests } from '../../../src/domain/ids';

describe('initWorld', () => {
  beforeEach(() => resetIdsForTests());

  it('places exactly one town hall at center', () => {
    const s = initWorld(0, 1);
    const halls = s.world.buildings.filter((b) => b.kind === 'townHall');
    expect(halls).toHaveLength(1);
    expect(halls[0]!.tileX).toBeGreaterThan(10);
    expect(halls[0]!.tileX).toBeLessThan(22);
  });

  it('uses provided seed', () => {
    const a = initWorld(0, 7);
    const b = initWorld(0, 7);
    expect(a).toEqual(b);
  });
});
```

- [ ] **Step 2: Verify FAIL**

- [ ] **Step 3: Implement `src/systems/init.ts`**

```ts
import { GameState, emptyState } from '../domain/state';
import { placeBuilding } from './worldOps';

export function initWorld(now: number, seed: number): GameState {
  const s0 = emptyState(now, seed);
  const cx = Math.floor(s0.world.width / 2) - 1;
  const cy = Math.floor(s0.world.height / 2) - 1;
  return placeBuilding(s0, 'townHall', cx, cy, now);
}
```

- [ ] **Step 4: Verify PASS**

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add initWorld (seed map with town hall)"
```

---

## Task 14: Integration test — 30-day scenario

**Files:**
- Test: `tests/integration/scenario.test.ts`

- [ ] **Step 1: Write integration test**

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { initWorld } from '../../src/systems/init';
import { drawCards, applyChosenCard } from '../../src/systems/dailyAction';
import { catchUp } from '../../src/systems/catchup';
import { resetIdsForTests } from '../../src/domain/ids';

describe('30-day scenario', () => {
  beforeEach(() => resetIdsForTests());

  it('progresses without orphan villagers or double assignment', () => {
    const t0 = new Date(2026, 4, 20, 8).getTime();
    let s = initWorld(t0, 123);
    for (let day = 1; day <= 30; day++) {
      const now = t0 + day * 24 * 60 * 60 * 1000 + 8 * 60 * 60 * 1000;
      s = catchUp(s, now);
      const cards = drawCards(s, now);
      if (cards.length > 0) {
        s = applyChosenCard(s, cards[0]!.id, now);
      }
    }
    expect(s.progression.day).toBeGreaterThanOrEqual(29);
    // no orphan villager
    const homeIds = new Set(s.world.buildings.filter((b) => b.kind === 'house').map((b) => b.id));
    for (const v of s.world.villagers) {
      expect(homeIds.has(v.homeId)).toBe(true);
    }
    // no double assignment
    const assigns = s.world.villagers.map((v) => v.workplaceId).filter(Boolean) as string[];
    expect(new Set(assigns).size).toBe(assigns.length);
  });
});
```

- [ ] **Step 2: Run; expect PASS**

```bash
npm run test:run -- tests/integration/scenario.test.ts
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "test: 30-day scenario integration test"
```

---

## Task 15: BootScene (asset loading scaffold)

**Files:**
- Create: `src/scenes/BootScene.ts`
- Modify: `src/main.ts`

- [ ] **Step 1: Implement `src/scenes/BootScene.ts`**

```ts
import Phaser from 'phaser';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  preload(): void {
    this.load.on('progress', (v: number) => {
      // optional: progress UI hook later
      void v;
    });
    // Placeholders generated procedurally (replaced when real assets added)
    this.createPlaceholderTextures();
  }

  create(): void {
    this.scene.start('WorldScene');
    this.scene.launch('UIScene');
  }

  private createPlaceholderTextures(): void {
    const palette: Record<string, number> = {
      grass: 0x6abe30,
      dirt: 0x9c6b3c,
      water: 0x4a90c2,
      path: 0xd0b270,
      house: 0xc97f4a,
      townHall: 0xb04a3c,
      farm: 0xe0c450,
      forge: 0x707070,
      mill: 0xa0a0a0,
      well: 0x6080a0,
      square: 0xd0d0c0,
      villager: 0xf2d0a0,
    };
    const g = this.add.graphics();
    for (const [key, color] of Object.entries(palette)) {
      g.clear();
      g.fillStyle(color);
      g.fillRect(0, 0, 16, 16);
      g.lineStyle(1, 0x000000, 0.3);
      g.strokeRect(0, 0, 16, 16);
      g.generateTexture(key, 16, 16);
    }
    g.destroy();
  }
}
```

- [ ] **Step 2: Update `src/main.ts`**

```ts
import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { WorldScene } from './scenes/WorldScene';
import { UIScene } from './scenes/UIScene';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game',
  width: 1024,
  height: 1024,
  pixelArt: true,
  backgroundColor: '#1a1a1a',
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: [BootScene, WorldScene, UIScene],
};

new Phaser.Game(config);
```

- [ ] **Step 3: Commit (compile will pass once Task 16-17 add the remaining scenes; for now keep BootScene + create stubs)**

Create stub `src/scenes/WorldScene.ts`:
```ts
import Phaser from 'phaser';

export class WorldScene extends Phaser.Scene {
  constructor() { super('WorldScene'); }
  create(): void {
    this.add.text(20, 20, 'WorldScene placeholder', { color: '#fff' });
  }
}
```

Create stub `src/scenes/UIScene.ts`:
```ts
import Phaser from 'phaser';

export class UIScene extends Phaser.Scene {
  constructor() { super('UIScene'); }
  create(): void {
    this.add.text(20, 50, 'UIScene placeholder', { color: '#fff' });
  }
}
```

- [ ] **Step 4: Verify build**

```bash
npm run build
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add BootScene + scene scaffold (placeholder textures)"
```

---

## Task 16: WorldScene — terrain + buildings rendering

**Files:**
- Create: `src/rendering/tileRenderer.ts`, `src/rendering/buildingRenderer.ts`
- Modify: `src/scenes/WorldScene.ts`

- [ ] **Step 1: Implement `src/rendering/tileRenderer.ts`**

```ts
import Phaser from 'phaser';
import { GameState } from '../domain/state';
import { TILE_SIZE } from '../config';

export function renderTiles(scene: Phaser.Scene, state: GameState, container: Phaser.GameObjects.Container): void {
  container.removeAll(true);
  for (const t of state.world.tiles) {
    const img = scene.add.image(t.x * TILE_SIZE, t.y * TILE_SIZE, t.kind).setOrigin(0, 0);
    container.add(img);
  }
}
```

- [ ] **Step 2: Implement `src/rendering/buildingRenderer.ts`**

```ts
import Phaser from 'phaser';
import { GameState } from '../domain/state';
import { TILE_SIZE } from '../config';
import { BUILDING_FOOTPRINT } from '../domain/building';

export function renderBuildings(
  scene: Phaser.Scene,
  state: GameState,
  container: Phaser.GameObjects.Container,
): void {
  container.removeAll(true);
  for (const b of state.world.buildings) {
    const fp = BUILDING_FOOTPRINT[b.kind];
    const img = scene.add
      .image(b.tileX * TILE_SIZE, b.tileY * TILE_SIZE, b.kind)
      .setOrigin(0, 0)
      .setDisplaySize(fp.w * TILE_SIZE, fp.h * TILE_SIZE);
    img.setData('buildingId', b.id);
    container.add(img);
  }
}
```

- [ ] **Step 3: Replace `src/scenes/WorldScene.ts`**

```ts
import Phaser from 'phaser';
import { GameState } from '../domain/state';
import { initWorld } from '../systems/init';
import { loadState, saveState } from '../systems/save';
import { catchUp } from '../systems/catchup';
import { renderTiles } from '../rendering/tileRenderer';
import { renderBuildings } from '../rendering/buildingRenderer';
import { MAP_WIDTH, MAP_HEIGHT, TILE_SIZE, RENDER_SCALE } from '../config';

export class WorldScene extends Phaser.Scene {
  private state!: GameState;
  private tileLayer!: Phaser.GameObjects.Container;
  private buildingLayer!: Phaser.GameObjects.Container;

  constructor() { super('WorldScene'); }

  create(): void {
    const now = Date.now();
    const loaded = loadState();
    this.state = loaded ? catchUp(loaded, now) : initWorld(now, Math.floor(Math.random() * 1e9));
    saveState(this.state);

    this.tileLayer = this.add.container(0, 0);
    this.buildingLayer = this.add.container(0, 0);

    renderTiles(this, this.state, this.tileLayer);
    renderBuildings(this, this.state, this.buildingLayer);

    this.cameras.main.setZoom(RENDER_SCALE);
    this.cameras.main.centerOn((MAP_WIDTH / 2) * TILE_SIZE, (MAP_HEIGHT / 2) * TILE_SIZE);

    this.registry.set('state', this.state);
  }

  refresh(state: GameState): void {
    this.state = state;
    renderBuildings(this, state, this.buildingLayer);
    this.registry.set('state', state);
    saveState(state);
  }

  getState(): GameState { return this.state; }
}
```

- [ ] **Step 4: Verify build**

```bash
npm run build
npm run dev
```
Expected: dev server opens, a green map appears with a single red Town Hall block near center.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: WorldScene renders terrain + buildings"
```

---

## Task 17: Villager rendering + simple movement

**Files:**
- Create: `src/rendering/villagerRenderer.ts`
- Modify: `src/scenes/WorldScene.ts`

- [ ] **Step 1: Implement `src/rendering/villagerRenderer.ts`**

```ts
import Phaser from 'phaser';
import { GameState } from '../domain/state';
import { TILE_SIZE } from '../config';
import { villagerActivityAt } from '../systems/villagerAI';
import { BUILDING_FOOTPRINT } from '../domain/building';
import { hourOfDay } from '../systems/clock';

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
      const img = scene.add.image(0, 0, 'villager').setOrigin(0.5, 1);
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
  const h = hourOfDay(now);
  for (const v of state.world.villagers) {
    const sprite = sprites.get(v.id);
    if (!sprite) continue;
    const activity = villagerActivityAt(v, h);
    const targetId = activity.buildingId ?? v.homeId;
    const target = state.world.buildings.find((b) => b.id === targetId);
    if (!target) {
      sprite.setVisible(false);
      continue;
    }
    const fp = BUILDING_FOOTPRINT[target.kind];
    const cx = (target.tileX + fp.w / 2) * TILE_SIZE;
    const cy = (target.tileY + fp.h / 2) * TILE_SIZE;
    sprite.setVisible(activity.activity !== 'sleep');
    sprite.setPosition(cx, cy);
  }
}
```

- [ ] **Step 2: Extend `src/scenes/WorldScene.ts`** — replace contents:

```ts
import Phaser from 'phaser';
import { GameState } from '../domain/state';
import { initWorld } from '../systems/init';
import { loadState, saveState } from '../systems/save';
import { catchUp } from '../systems/catchup';
import { renderTiles } from '../rendering/tileRenderer';
import { renderBuildings } from '../rendering/buildingRenderer';
import {
  ensureVillagerSprites,
  updateVillagerPositions,
  VillagerSpritesMap,
} from '../rendering/villagerRenderer';
import { MAP_WIDTH, MAP_HEIGHT, TILE_SIZE, RENDER_SCALE, SIM_TICK_MS } from '../config';

export class WorldScene extends Phaser.Scene {
  private state!: GameState;
  private tileLayer!: Phaser.GameObjects.Container;
  private buildingLayer!: Phaser.GameObjects.Container;
  private villagerLayer!: Phaser.GameObjects.Container;
  private villagerSprites: VillagerSpritesMap = new Map();
  private lastSimTick = 0;

  constructor() { super('WorldScene'); }

  create(): void {
    const now = Date.now();
    const loaded = loadState();
    this.state = loaded ? catchUp(loaded, now) : initWorld(now, Math.floor(Math.random() * 1e9));
    saveState(this.state);

    this.tileLayer = this.add.container(0, 0);
    this.buildingLayer = this.add.container(0, 0);
    this.villagerLayer = this.add.container(0, 0);

    renderTiles(this, this.state, this.tileLayer);
    renderBuildings(this, this.state, this.buildingLayer);
    ensureVillagerSprites(this, this.state, this.villagerLayer, this.villagerSprites);
    updateVillagerPositions(this.state, this.villagerSprites, now);

    this.cameras.main.setZoom(RENDER_SCALE);
    this.cameras.main.centerOn((MAP_WIDTH / 2) * TILE_SIZE, (MAP_HEIGHT / 2) * TILE_SIZE);

    this.registry.set('state', this.state);
  }

  update(time: number): void {
    if (time - this.lastSimTick < SIM_TICK_MS) return;
    this.lastSimTick = time;
    updateVillagerPositions(this.state, this.villagerSprites, Date.now());
  }

  refresh(state: GameState): void {
    this.state = state;
    renderBuildings(this, state, this.buildingLayer);
    ensureVillagerSprites(this, state, this.villagerLayer, this.villagerSprites);
    updateVillagerPositions(state, this.villagerSprites, Date.now());
    this.registry.set('state', state);
    saveState(state);
  }

  getState(): GameState { return this.state; }
}
```

- [ ] **Step 3: Verify build + visual**

```bash
npm run build
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: render villagers and update positions via schedule"
```

---

## Task 18: Day/night overlay + weather particles

**Files:**
- Create: `src/rendering/dayNightOverlay.ts`, `src/rendering/weatherRenderer.ts`
- Modify: `src/scenes/WorldScene.ts`

- [ ] **Step 1: Implement `src/rendering/dayNightOverlay.ts`**

```ts
import Phaser from 'phaser';
import { hourOfDay } from '../systems/clock';

export class DayNightOverlay {
  private rect: Phaser.GameObjects.Rectangle;

  constructor(scene: Phaser.Scene, width: number, height: number) {
    this.rect = scene.add
      .rectangle(0, 0, width, height, 0x0a1030, 0)
      .setOrigin(0, 0)
      .setScrollFactor(0);
  }

  update(now: number): void {
    const h = hourOfDay(now);
    let alpha = 0;
    if (h < 6 || h >= 21) alpha = 0.55;
    else if (h < 8) alpha = 0.55 - ((h - 6) / 2) * 0.4;
    else if (h >= 19) alpha = ((h - 19) / 2) * 0.55;
    else alpha = 0.05;
    this.rect.setAlpha(Phaser.Math.Clamp(alpha, 0, 0.7));
  }
}
```

- [ ] **Step 2: Implement `src/rendering/weatherRenderer.ts`**

```ts
import Phaser from 'phaser';
import { Weather } from '../systems/weather';

export class WeatherRenderer {
  private emitter?: Phaser.GameObjects.Particles.ParticleEmitter;
  private current: Weather['kind'] = 'clear';

  constructor(private scene: Phaser.Scene, private width: number, private height: number) {}

  apply(weather: Weather): void {
    if (weather.kind === this.current) return;
    this.current = weather.kind;
    this.emitter?.destroy();
    this.emitter = undefined;
    if (weather.kind === 'clear') return;
    const color = weather.kind === 'snow' ? 0xffffff : 0x88bbee;
    const speedY = weather.kind === 'snow' ? { min: 30, max: 60 } : { min: 200, max: 320 };
    this.emitter = this.scene.add.particles(0, 0, '__WHITE', {
      x: { min: 0, max: this.width },
      y: -10,
      lifespan: 4000,
      speedY,
      quantity: weather.kind === 'snow' ? 1 : 3,
      frequency: 80,
      scale: weather.kind === 'snow' ? 1.2 : 0.8,
      tint: color,
      blendMode: 'NORMAL',
    });
    this.emitter.setScrollFactor(0);
  }
}
```

- [ ] **Step 3: Wire into `WorldScene` — add fields + update calls**

In `src/scenes/WorldScene.ts`, add imports + properties + integration. Replace the file with:

```ts
import Phaser from 'phaser';
import { GameState } from '../domain/state';
import { initWorld } from '../systems/init';
import { loadState, saveState } from '../systems/save';
import { catchUp } from '../systems/catchup';
import { renderTiles } from '../rendering/tileRenderer';
import { renderBuildings } from '../rendering/buildingRenderer';
import {
  ensureVillagerSprites,
  updateVillagerPositions,
  VillagerSpritesMap,
} from '../rendering/villagerRenderer';
import { DayNightOverlay } from '../rendering/dayNightOverlay';
import { WeatherRenderer } from '../rendering/weatherRenderer';
import { weatherForDay } from '../systems/weather';
import { MAP_WIDTH, MAP_HEIGHT, TILE_SIZE, RENDER_SCALE, SIM_TICK_MS } from '../config';

export class WorldScene extends Phaser.Scene {
  private state!: GameState;
  private tileLayer!: Phaser.GameObjects.Container;
  private buildingLayer!: Phaser.GameObjects.Container;
  private villagerLayer!: Phaser.GameObjects.Container;
  private villagerSprites: VillagerSpritesMap = new Map();
  private overlay!: DayNightOverlay;
  private weatherFx!: WeatherRenderer;
  private lastSimTick = 0;

  constructor() { super('WorldScene'); }

  create(): void {
    const now = Date.now();
    const loaded = loadState();
    this.state = loaded ? catchUp(loaded, now) : initWorld(now, Math.floor(Math.random() * 1e9));
    saveState(this.state);

    this.tileLayer = this.add.container(0, 0);
    this.buildingLayer = this.add.container(0, 0);
    this.villagerLayer = this.add.container(0, 0);

    renderTiles(this, this.state, this.tileLayer);
    renderBuildings(this, this.state, this.buildingLayer);
    ensureVillagerSprites(this, this.state, this.villagerLayer, this.villagerSprites);
    updateVillagerPositions(this.state, this.villagerSprites, now);

    this.overlay = new DayNightOverlay(this, this.scale.width, this.scale.height);
    this.weatherFx = new WeatherRenderer(this, this.scale.width, this.scale.height);
    this.weatherFx.apply(weatherForDay(this.state.seed, this.state.progression.day));

    this.cameras.main.setZoom(RENDER_SCALE);
    this.cameras.main.centerOn((MAP_WIDTH / 2) * TILE_SIZE, (MAP_HEIGHT / 2) * TILE_SIZE);

    this.registry.set('state', this.state);
  }

  update(time: number): void {
    if (time - this.lastSimTick < SIM_TICK_MS) return;
    this.lastSimTick = time;
    const now = Date.now();
    updateVillagerPositions(this.state, this.villagerSprites, now);
    this.overlay.update(now);
    this.weatherFx.apply(weatherForDay(this.state.seed, this.state.progression.day));
  }

  refresh(state: GameState): void {
    this.state = state;
    renderBuildings(this, state, this.buildingLayer);
    ensureVillagerSprites(this, state, this.villagerLayer, this.villagerSprites);
    updateVillagerPositions(state, this.villagerSprites, Date.now());
    this.registry.set('state', state);
    saveState(state);
  }

  getState(): GameState { return this.state; }
}
```

- [ ] **Step 4: Verify build + run dev**

```bash
npm run build
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add day/night overlay and weather particles"
```

---

## Task 19: Camera pan + zoom + hover/click

**Files:**
- Modify: `src/scenes/WorldScene.ts`

- [ ] **Step 1: Add camera + input controls to `WorldScene` (extend `create`)**

Append to the end of `create()`:

```ts
const cam = this.cameras.main;
let dragging = false;
let lastX = 0;
let lastY = 0;
this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
  dragging = true;
  lastX = p.x;
  lastY = p.y;
});
this.input.on('pointerup', () => { dragging = false; });
this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
  if (!dragging) return;
  cam.scrollX -= (p.x - lastX) / cam.zoom;
  cam.scrollY -= (p.y - lastY) / cam.zoom;
  lastX = p.x;
  lastY = p.y;
});
this.input.on('wheel', (_p: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number) => {
  const next = Phaser.Math.Clamp(cam.zoom + (dy < 0 ? 0.25 : -0.25), 1, 3);
  cam.setZoom(next);
});
```

- [ ] **Step 2: Add hover/click events** — emit events for UIScene. Add at end of `create()`:

```ts
this.input.on('gameobjectover', (_p: Phaser.Input.Pointer, obj: Phaser.GameObjects.Image) => {
  const bid = obj.getData('buildingId') as string | undefined;
  if (bid) this.events.emit('hover-building', bid);
});
this.input.on('gameobjectout', () => this.events.emit('hover-clear'));
this.input.on('gameobjectdown', (_p: Phaser.Input.Pointer, obj: Phaser.GameObjects.Image) => {
  const bid = obj.getData('buildingId') as string | undefined;
  if (bid) this.events.emit('click-building', bid);
});
```

Set interactive in `buildingRenderer.ts` — modify `img` line:

```ts
const img = scene.add
  .image(b.tileX * TILE_SIZE, b.tileY * TILE_SIZE, b.kind)
  .setOrigin(0, 0)
  .setDisplaySize(fp.w * TILE_SIZE, fp.h * TILE_SIZE)
  .setInteractive();
```

- [ ] **Step 3: Verify build**

```bash
npm run build
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: camera pan/zoom + building hover/click events"
```

---

## Task 20: UIScene — clock + action button

**Files:**
- Modify: `src/scenes/UIScene.ts`
- Create: `src/ui/ClockWidget.ts`, `src/ui/ActionButton.ts`

- [ ] **Step 1: Implement `src/ui/ClockWidget.ts`**

```ts
import Phaser from 'phaser';
import { seasonForDay } from '../systems/season';
import { dayIndex } from '../systems/clock';

export class ClockWidget {
  private text: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene) {
    this.text = scene.add.text(16, 16, '', {
      fontFamily: 'monospace',
      fontSize: '14px',
      color: '#ffffff',
      backgroundColor: '#00000099',
      padding: { x: 8, y: 4 },
    }).setScrollFactor(0);
  }

  update(createdAt: number, now: number): void {
    const d = new Date(now);
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    const day = dayIndex(createdAt, now);
    const season = seasonForDay(day);
    this.text.setText(`${hh}:${mm}  •  jour ${day}  •  ${season}`);
  }
}
```

- [ ] **Step 2: Implement `src/ui/ActionButton.ts`**

```ts
import Phaser from 'phaser';

export class ActionButton {
  private text: Phaser.GameObjects.Text;
  private blinkTween?: Phaser.Tweens.Tween;

  constructor(scene: Phaser.Scene, onClick: () => void) {
    this.text = scene.add
      .text(scene.scale.width - 16, 16, '✦ Action du matin', {
        fontFamily: 'sans-serif',
        fontSize: '14px',
        color: '#fff8c0',
        backgroundColor: '#552200dd',
        padding: { x: 10, y: 6 },
      })
      .setOrigin(1, 0)
      .setScrollFactor(0)
      .setInteractive()
      .on('pointerdown', onClick);

    this.blinkTween = scene.tweens.add({
      targets: this.text,
      alpha: 0.4,
      yoyo: true,
      repeat: -1,
      duration: 1200,
    });
    this.setAvailable(false);
  }

  setAvailable(available: boolean): void {
    this.text.setVisible(available);
    if (this.blinkTween) {
      if (available) this.blinkTween.resume();
      else this.blinkTween.pause();
    }
  }
}
```

- [ ] **Step 3: Replace `src/scenes/UIScene.ts`**

```ts
import Phaser from 'phaser';
import { ClockWidget } from '../ui/ClockWidget';
import { ActionButton } from '../ui/ActionButton';
import { isActionAvailable } from '../systems/dailyAction';
import { GameState } from '../domain/state';

export class UIScene extends Phaser.Scene {
  private clock!: ClockWidget;
  private actionBtn!: ActionButton;

  constructor() { super('UIScene'); }

  create(): void {
    this.clock = new ClockWidget(this);
    this.actionBtn = new ActionButton(this, () => this.events.emit('open-action'));
  }

  update(): void {
    const state = this.registry.get('state') as GameState | undefined;
    if (!state) return;
    const now = Date.now();
    this.clock.update(state.createdAt, now);
    this.actionBtn.setAvailable(isActionAvailable(state, now));
  }
}
```

- [ ] **Step 4: Verify build + dev**

```bash
npm run build
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: UIScene with clock widget and action button"
```

---

## Task 21: Card overlay UI + wire to state

**Files:**
- Create: `src/ui/CardOverlay.ts`
- Modify: `src/scenes/UIScene.ts`

- [ ] **Step 1: Implement `src/ui/CardOverlay.ts`**

```ts
import Phaser from 'phaser';
import { ActionCard } from '../cards/types';

export type CardOverlayHandlers = {
  onPick: (cardId: string) => void;
  onCancel: () => void;
};

export class CardOverlay {
  private container: Phaser.GameObjects.Container;
  private bg: Phaser.GameObjects.Rectangle;

  constructor(scene: Phaser.Scene, private handlers: CardOverlayHandlers) {
    this.bg = scene.add
      .rectangle(0, 0, scene.scale.width, scene.scale.height, 0x000000, 0.55)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setInteractive()
      .on('pointerdown', () => this.handlers.onCancel());
    this.container = scene.add.container(0, 0).setScrollFactor(0);
    this.container.add(this.bg);
    this.hide();
  }

  show(cards: readonly ActionCard[]): void {
    const scene = this.container.scene;
    const cw = 200;
    const ch = 280;
    const gap = 20;
    const totalW = cards.length * cw + (cards.length - 1) * gap;
    const startX = (scene.scale.width - totalW) / 2;
    const y = (scene.scale.height - ch) / 2;
    for (let i = 0; i < cards.length; i++) {
      const c = cards[i]!;
      const x = startX + i * (cw + gap);
      const card = scene.add.rectangle(x, y, cw, ch, 0xfaf3df).setOrigin(0, 0).setStrokeStyle(2, 0x333);
      card.setInteractive().on('pointerdown', (p: Phaser.Input.Pointer, _lx: number, _ly: number, ev: Phaser.Types.Input.EventData) => {
        ev.stopPropagation();
        this.handlers.onPick(c.id);
      });
      const title = scene.add.text(x + 12, y + 16, c.title, {
        color: '#222', fontFamily: 'sans-serif', fontSize: '16px', fontStyle: 'bold', wordWrap: { width: cw - 24 },
      });
      const desc = scene.add.text(x + 12, y + 70, c.description, {
        color: '#444', fontFamily: 'sans-serif', fontSize: '12px', wordWrap: { width: cw - 24 },
      });
      this.container.add([card, title, desc]);
    }
    this.container.setVisible(true);
  }

  hide(): void {
    // remove dynamic children except bg
    const children = this.container.list.slice();
    for (const c of children) {
      if (c !== this.bg) c.destroy();
    }
    this.container.setVisible(false);
  }
}
```

- [ ] **Step 2: Update `src/scenes/UIScene.ts`** to wire overlay + WorldScene refresh

```ts
import Phaser from 'phaser';
import { ClockWidget } from '../ui/ClockWidget';
import { ActionButton } from '../ui/ActionButton';
import { CardOverlay } from '../ui/CardOverlay';
import { drawCards, applyChosenCard, isActionAvailable } from '../systems/dailyAction';
import { GameState } from '../domain/state';
import { WorldScene } from './WorldScene';

export class UIScene extends Phaser.Scene {
  private clock!: ClockWidget;
  private actionBtn!: ActionButton;
  private overlay!: CardOverlay;

  constructor() { super('UIScene'); }

  create(): void {
    this.clock = new ClockWidget(this);
    this.actionBtn = new ActionButton(this, () => this.openAction());
    this.overlay = new CardOverlay(this, {
      onPick: (id) => this.pickCard(id),
      onCancel: () => this.overlay.hide(),
    });
  }

  update(): void {
    const state = this.registry.get('state') as GameState | undefined;
    if (!state) return;
    const now = Date.now();
    this.clock.update(state.createdAt, now);
    this.actionBtn.setAvailable(isActionAvailable(state, now));
  }

  private openAction(): void {
    const state = this.registry.get('state') as GameState | undefined;
    if (!state) return;
    const now = Date.now();
    if (!isActionAvailable(state, now)) return;
    const cards = drawCards(state, now);
    if (cards.length === 0) return;
    this.overlay.show(cards);
  }

  private pickCard(cardId: string): void {
    const world = this.scene.get('WorldScene') as WorldScene;
    const state = world.getState();
    const now = Date.now();
    const next = applyChosenCard(state, cardId, now);
    world.refresh(next);
    this.overlay.hide();
  }
}
```

- [ ] **Step 3: Verify build + manual smoke**

```bash
npm run build
```

Then `npm run dev` and manually verify: action button visible at ≥06:00 if it's a new day; click opens 3 cards; picking one closes overlay and (for `build_house`) a new house appears.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: card overlay UI wired to draw/apply daily action"
```

---

## Task 22: Tooltip + building info on hover/click

**Files:**
- Create: `src/ui/Tooltip.ts`
- Modify: `src/scenes/UIScene.ts`

- [ ] **Step 1: Implement `src/ui/Tooltip.ts`**

```ts
import Phaser from 'phaser';

export class Tooltip {
  private text: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene) {
    this.text = scene.add.text(0, 0, '', {
      fontFamily: 'sans-serif',
      fontSize: '12px',
      color: '#fff',
      backgroundColor: '#000000cc',
      padding: { x: 6, y: 3 },
    }).setScrollFactor(0).setDepth(1000).setVisible(false);
    scene.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      this.text.setPosition(p.x + 12, p.y + 12);
    });
  }

  show(content: string): void { this.text.setText(content).setVisible(true); }
  hide(): void { this.text.setVisible(false); }
}
```

- [ ] **Step 2: Wire in `UIScene` — extend `create()`**

Add at end of `create()` in `src/scenes/UIScene.ts`:

```ts
const tooltip = new Tooltip(this);
const world = this.scene.get('WorldScene') as WorldScene;
world.events.on('hover-building', (id: string) => {
  const s = world.getState();
  const b = s.world.buildings.find((bb) => bb.id === id);
  if (!b) return;
  const occupants = s.world.villagers.filter((v) => v.homeId === id || v.workplaceId === id);
  const lines = [`${b.kind}`, `occupants: ${occupants.map((v) => v.name).join(', ') || '—'}`];
  tooltip.show(lines.join('\n'));
});
world.events.on('hover-clear', () => tooltip.hide());
```

Add import: `import { Tooltip } from '../ui/Tooltip';`

- [ ] **Step 3: Verify build**

```bash
npm run build
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: building hover tooltip with occupants"
```

---

## Task 23: Pause rendering when tab hidden

**Files:**
- Modify: `src/main.ts`

- [ ] **Step 1: Update `src/main.ts`**

Replace with:

```ts
import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { WorldScene } from './scenes/WorldScene';
import { UIScene } from './scenes/UIScene';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game',
  width: 1024,
  height: 1024,
  pixelArt: true,
  backgroundColor: '#1a1a1a',
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: [BootScene, WorldScene, UIScene],
};

const game = new Phaser.Game(config);

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    game.loop.sleep();
  } else {
    game.loop.wake();
    // Force a refresh so catchUp can apply elapsed days
    const world = game.scene.getScene('WorldScene') as { getState?: () => unknown; refresh?: (s: unknown) => void };
    if (world && world.getState && world.refresh) {
      // re-running catchUp happens implicitly next frame via update; explicit refresh not needed.
    }
  }
});
```

- [ ] **Step 2: Add visibility-aware catch-up to WorldScene** — modify `update` to call catchUp once per real minute:

In `src/scenes/WorldScene.ts`, add field `private lastCatchUp = 0;` and add to top of `update`:

```ts
if (Date.now() - this.lastCatchUp > 60_000) {
  this.lastCatchUp = Date.now();
  this.state = catchUp(this.state, Date.now());
  this.registry.set('state', this.state);
  saveState(this.state);
}
```

- [ ] **Step 3: Verify build**

```bash
npm run build
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: pause loop on tab hidden + periodic catchUp"
```

---

## Task 24: README + run instructions

**Files:**
- Create: `README.md`

- [ ] **Step 1: Write `README.md`**

```markdown
# Village Sim

Animation détente de village pixel-art top-down, à laisser tourner sur second écran. Une action par matin fait évoluer le village.

## Démarrage

```bash
npm install
npm run dev
```

Ouvre http://localhost:5173.

## Scripts

- `npm run dev` — Vite HMR
- `npm run build` — bundle statique `dist/`
- `npm run preview` — sert le build
- `npm run test` — Vitest watch
- `npm run test:run` — Vitest run-once
- `npm run lint` — ESLint

## Fonctionnement

- Le temps de la simulation suit l'heure locale (1 min IRL = 1 min sim).
- Chaque matin (≥ 06:00, heure locale), une nouvelle carte d'action est disponible : choisis 1 carte parmi 3 pour faire évoluer ton village.
- Si tu loupes un matin, le village vit normalement mais ne progresse pas ce jour-là.
- Les saisons défilent toutes les 30 jours IRL (printemps → été → automne → hiver).
- La sauvegarde est locale (localStorage). Vider le cache du navigateur = perdre la partie.

## Stack

TypeScript + Phaser 3 + Vite + Vitest.
```

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "docs: add README"
```

---

## Task 25: Final verification + PR

- [ ] **Step 1: Run full test suite**

```bash
npm run test:run
```
Expected: all green.

- [ ] **Step 2: Run lint**

```bash
npm run lint
```
Expected: no errors (warnings allowed).

- [ ] **Step 3: Run build**

```bash
npm run build
```
Expected: success.

- [ ] **Step 4: Manual smoke test**

```bash
npm run dev
```

Check:
- Map + Town Hall visible.
- Clock widget updates.
- Drag to pan; wheel to zoom.
- If new day ≥ 06:00, action button blinks. Click → 3 cards.
- Pick "build_house" → new house appears immediately, persists after reload.

- [ ] **Step 5: Push branch**

```bash
git push -u origin feat/MH/initial-design
```

- [ ] **Step 6: Open PR** (manuel via `gh pr create` ou interface GitHub) avec résumé : scope MVP livré, prochaines étapes (assets pixel art réels, cultures, animations marche, audio).

---

## Self-Review Summary

**Spec coverage check:**

- Vision / boucle journalière → Tasks 9, 10, 21 ✓
- Architecture séparée systems/scenes → Tasks 4-13 + 15-22 ✓
- Modèle données immutable + sérialisable → Tasks 3, 12 ✓
- Temps réel + saison + catch-up → Tasks 4, 5, 11, 23 ✓
- Town Hall progression + cartes interconnectées → Tasks 8, 9, 10, 14 ✓
- Rendu visuel (terrain, bâtiments, villageois, météo, jour/nuit) → Tasks 15-18 ✓
- Caméra pan/zoom + hover/click + tooltip → Tasks 19, 22 ✓
- Persistance localStorage + migration version → Task 12 ✓
- Tests unit + integration → Tasks 2-14 ✓
- Dev workflow + scripts → Tasks 1, 24 ✓
- Pause si onglet caché → Task 23 ✓
- Carte ratée = jour neutre → comportement naturel (UIScene gate sur `isActionAvailable`, pas d'auto-apply) ✓

**Hors scope MVP explicite** (spec § "Hors scope") : animaux, PNJ voyageurs, audio, easter eggs, export/import, sync cloud, E2E Phaser — non planifiés ici, OK.

**Type/method naming consistency:** `applyChosenCard`, `drawCards`, `isActionAvailable`, `computeMetrics`, `canUpgradeTownHall`, `placeBuilding`, `findFreeSpot`, `villagerActivityAt`, `weatherForDay`, `seasonForDay`, `catchUp`, `loadState/saveState/clearSave` — référencés cohérents entre tasks.

**Placeholder scan:** aucun TBD/TODO/"add error handling" générique restant.
