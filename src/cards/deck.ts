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
    effect: (s, _now) => s,
  },
];

const BY_ID = new Map(ALL_CARDS.map((c) => [c.id, c]));

export function cardById(id: string): ActionCard {
  const c = BY_ID.get(id);
  if (!c) throw new Error(`Unknown card id: ${id}`);
  return c;
}
