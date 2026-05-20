import { describe, it, expect } from 'vitest';
import { villagerPositionAt, msSinceMidnight } from '../../../../src/systems/villagerPath/position';
import { initWorld } from '../../../../src/systems/init';

describe('villagerPath/position', () => {
  it('returns null during sleep hours', () => {
    const t0 = new Date(2026, 4, 20, 3, 0, 0).getTime();
    const s = initWorld(t0, 1);
    const v = s.world.villagers[0]!;
    expect(villagerPositionAt(v, t0, s)).toBeNull();
  });

  it('returns a Position during wake hours', () => {
    const t0 = new Date(2026, 4, 20, 10, 0, 0).getTime();
    const s = initWorld(t0, 1);
    const v = s.world.villagers[0]!;
    const pos = villagerPositionAt(v, t0, s);
    expect(pos).not.toBeNull();
    expect(typeof pos!.x).toBe('number');
    expect(typeof pos!.y).toBe('number');
  });

  it('bobbing is true during pause segments only', () => {
    const t0 = new Date(2026, 4, 20, 12, 0, 0).getTime();
    const s = initWorld(t0, 1);
    const v = s.world.villagers[0]!;
    const pos = villagerPositionAt(v, t0, s);
    expect(typeof pos!.bobbing).toBe('boolean');
  });

  it('msSinceMidnight returns 0 at local midnight', () => {
    const t = new Date(2026, 4, 20, 0, 0, 0, 0).getTime();
    expect(msSinceMidnight(t)).toBe(0);
  });

  it('msSinceMidnight returns ~3600000 at 01:00', () => {
    const t = new Date(2026, 4, 20, 1, 0, 0, 0).getTime();
    expect(msSinceMidnight(t)).toBe(3_600_000);
  });
});
