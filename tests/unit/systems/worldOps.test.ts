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
    expect(s0.world.buildings).toHaveLength(0);
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
