import { describe, it, expect } from 'vitest';
import { findPath } from '../../../../src/systems/villagerPath/astar';
import { buildGraph, tileKey } from '../../../../src/systems/villagerPath/graph';
import { emptyState } from '../../../../src/domain/state';
import { placeBuilding } from '../../../../src/systems/worldOps';

describe('villagerPath/astar (in-graph)', () => {
  it('returns a path between two reachable tiles', () => {
    let s = emptyState(0, 1);
    s = placeBuilding(s, 'townHall', 10, 10, 0);
    s = placeBuilding(s, 'house', 15, 10, 0);
    const g = buildGraph(s);
    const tiles = [...g.tiles].map((k) => {
      const [x, y] = k.split(',').map(Number);
      return { x: x as number, y: y as number };
    });
    const a = tiles[0]!;
    const b = tiles[tiles.length - 1]!;
    const p = findPath(g, a, b);
    expect(p).not.toBeNull();
    expect(p![0]).toEqual(a);
    expect(p![p!.length - 1]).toEqual(b);
  });

  it('returns single-tile path when from === to', () => {
    let s = emptyState(0, 1);
    s = placeBuilding(s, 'townHall', 10, 10, 0);
    const g = buildGraph(s);
    const start = [...g.tiles][0]!;
    const [x, y] = start.split(',').map(Number) as [number, number];
    const p = findPath(g, { x, y }, { x, y });
    expect(p).toEqual([{ x, y }]);
  });

  it('returns null when graph is empty', () => {
    const g = buildGraph(emptyState(0, 1));
    const p = findPath(g, { x: 0, y: 0 }, { x: 1, y: 0 });
    expect(p).toBeNull();
  });
});

describe('villagerPath/astar (snap)', () => {
  it('snaps from/to to nearest graph tiles', () => {
    let s = emptyState(0, 1);
    s = placeBuilding(s, 'townHall', 10, 10, 0);
    s = placeBuilding(s, 'house', 18, 10, 0);
    const g = buildGraph(s);
    // (10, 10) is inside townHall footprint → not in graph
    expect(g.tiles.has(tileKey({ x: 10, y: 10 }))).toBe(false);
    const someGraphTile = [...g.tiles][0]!;
    const [gx, gy] = someGraphTile.split(',').map(Number) as [number, number];
    const p = findPath(g, { x: 10, y: 10 }, { x: gx, y: gy });
    expect(p).not.toBeNull();
    expect(p!.length).toBeGreaterThan(0);
  });
});
