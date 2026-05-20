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
