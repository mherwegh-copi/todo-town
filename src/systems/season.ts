import { SEASONS, SEASON_DAYS, Season } from '../config';

export function seasonForDay(day: number): Season {
  const idx = Math.floor(day / SEASON_DAYS) % SEASONS.length;
  return SEASONS[((idx % SEASONS.length) + SEASONS.length) % SEASONS.length]!;
}
