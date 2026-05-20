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
