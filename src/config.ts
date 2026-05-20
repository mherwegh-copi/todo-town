export const TILE_SIZE = 16;
export const MAP_WIDTH = 32;
export const MAP_HEIGHT = 32;
export const RENDER_SCALE = 2;
export const SIM_TICK_MS = 1000;
export const DAY_START_HOUR = 6;
export const SEASON_DAYS = 30;
export const SAVE_KEY = 'village-sim/state/v1';
export const SAVE_VERSION = 5;
export const MAX_CATCHUP_DAYS = 30;

export const BASE_CARDS_DRAWN = 3;
export const MOTIVATION_CARDS_DIV = 3;
export const MOTIVATION_BONUS_CAP = 2;
export const MOTIVATION_ACTION_COST = 10;
export const MOTIVATION_DECAY_HOURS = 12;

export const SEASONS = ['spring', 'summer', 'autumn', 'winter'] as const;
export type Season = (typeof SEASONS)[number];
export const TODO_STORAGE_KEY = 'village-todos';
export const TODO_SORT_KEY = 'village-todo-sort';
export const TODO_DONE_COLLAPSED_KEY = 'village-todo-done-collapsed';
export const TODO_DAILY_GOAL_KEY = 'village-todo-daily-goal';
export const DAILY_GOAL_MIN = 1;
export const DAILY_GOAL_MAX = 99;
export const DAILY_GOAL_DEFAULT = 5;
