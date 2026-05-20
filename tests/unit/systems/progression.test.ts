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
