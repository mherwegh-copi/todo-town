import { describe, it, expect, beforeEach } from 'vitest';
import { initWorld } from '../../../src/systems/init';
import { resetIdsForTests } from '../../../src/domain/ids';

describe('initWorld', () => {
  beforeEach(() => resetIdsForTests());

  it('places exactly one town hall at center', () => {
    const s = initWorld(0, 1);
    const halls = s.world.buildings.filter((b) => b.kind === 'townHall');
    expect(halls).toHaveLength(1);
    expect(halls[0]!.tileX).toBeGreaterThan(10);
    expect(halls[0]!.tileX).toBeLessThan(22);
  });

  it('uses provided seed', () => {
    const a = initWorld(0, 7);
    const b = initWorld(0, 7);
    expect(a).toEqual(b);
  });
});
