// Kenney Tiny Town tilemap_packed.png: 12 cols × 11 rows of 16×16 frames (132 total).
// Frame index = row * 12 + col. Tweak values here to refine visuals — single source of truth.

export const TT_SHEET = 'tt';
export const TT_FRAME_SIZE = 16;
export const TT_COLS = 12;

export const FRAME = {
  // terrain
  grass: 0,
  grass2: 1,
  grass3: 2,
  dirt: 36,
  water: 41,
  path: 27,

  // single-frame fallbacks (stretched to footprint)
  townHall: 47,
  farm: 26,
  forge: 51,
  mill: 49,
  well: 33,
  square: 96,

  // characters (variants) — placeholder, awaiting confirmed indices
  villager: [102, 103, 104, 105] as const,
} as const;

export type CompositeLayout = readonly (readonly number[])[];

export const HOUSE_LAYOUT: CompositeLayout = [
  [48, 49, 50, 51],
  [60, 61, 62, 63],
  [72, 73, 74, 75],
  [84, 85, 86, 87],
];

export function buildingLayout(kind: string): CompositeLayout | null {
  if (kind === 'house') return HOUSE_LAYOUT;
  return null;
}

const GRASS_FRAMES = [FRAME.grass, FRAME.grass2, FRAME.grass3] as const;

export function grassVariant(x: number, y: number, seed: number): number {
  const h = ((x * 73856093) ^ (y * 19349663) ^ (seed * 83492791)) >>> 0;
  return GRASS_FRAMES[h % GRASS_FRAMES.length]!;
}

export function tileFrame(kind: string, x: number, y: number, seed: number): number {
  if (kind === 'grass') return grassVariant(x, y, seed);
  if (kind === 'dirt') return FRAME.dirt;
  if (kind === 'water') return FRAME.water;
  if (kind === 'path') return FRAME.path;
  return FRAME.grass;
}

export function buildingFrame(kind: string): number {
  switch (kind) {
    case 'townHall': return FRAME.townHall;
    case 'farm': return FRAME.farm;
    case 'forge': return FRAME.forge;
    case 'mill': return FRAME.mill;
    case 'well': return FRAME.well;
    case 'square': return FRAME.square;
    default: return FRAME.grass;
  }
}

export function villagerFrame(variant: number): number {
  const arr = FRAME.villager;
  return arr[((variant % arr.length) + arr.length) % arr.length]!;
}
