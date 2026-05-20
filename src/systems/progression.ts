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
