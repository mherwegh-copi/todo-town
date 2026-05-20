import { describe, it, expect } from 'vitest';
import { buildGraph, tileKey } from '../../../../src/systems/villagerPath/graph';
import { emptyState } from '../../../../src/domain/state';
import { placeBuilding } from '../../../../src/systems/worldOps';

describe('villagerPath/graph', () => {
  it('empty state yields empty graph', () => {
    const g = buildGraph(emptyState(0, 1));
    expect(g.tiles.size).toBe(0);
  });

  it('one building yields some frontage tiles', () => {
    let s = emptyState(0, 1);
    s = placeBuilding(s, 'townHall', 10, 10, 0);
    const g = buildGraph(s);
    expect(g.tiles.size).toBeGreaterThan(0);
  });

  it('neighbors are 4-connected and inside the tile set', () => {
    let s = emptyState(0, 1);
    s = placeBuilding(s, 'townHall', 10, 10, 0);
    s = placeBuilding(s, 'house', 15, 10, 0);
    const g = buildGraph(s);
    for (const [key, ns] of g.neighbors) {
      const [x, y] = key.split(',').map(Number) as [number, number];
      for (const n of ns) {
        const [nx, ny] = n.split(',').map(Number) as [number, number];
        expect(Math.abs(nx - x) + Math.abs(ny - y)).toBe(1);
        expect(g.tiles.has(n)).toBe(true);
      }
    }
  });

  it('is memoised on state.world.buildings reference', () => {
    let s = emptyState(0, 1);
    s = placeBuilding(s, 'townHall', 10, 10, 0);
    const g1 = buildGraph(s);
    const g2 = buildGraph(s);
    expect(g2).toBe(g1);
  });

  it('tileKey roundtrips', () => {
    expect(tileKey({ x: 4, y: 7 })).toBe('4,7');
  });
});
