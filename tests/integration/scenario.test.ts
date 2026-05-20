import { describe, it, expect, beforeEach } from 'vitest';
import { initWorld } from '../../src/systems/init';
import { drawCards, applyChosenCard } from '../../src/systems/dailyAction';
import { catchUp } from '../../src/systems/catchup';
import { resetIdsForTests } from '../../src/domain/ids';

describe('30-day scenario', () => {
  beforeEach(() => resetIdsForTests());

  it('progresses without orphan villagers or double assignment', () => {
    const t0 = new Date(2026, 4, 20, 8).getTime();
    let s = initWorld(t0, 123);
    for (let day = 1; day <= 30; day++) {
      const now = t0 + day * 24 * 60 * 60 * 1000 + 8 * 60 * 60 * 1000;
      s = catchUp(s, now);
      const cards = drawCards(s, now);
      if (cards.length > 0) {
        s = applyChosenCard(s, cards[0]!.id, now);
      }
    }
    expect(s.progression.day).toBeGreaterThanOrEqual(29);
    const homeIds = new Set(s.world.buildings.filter((b) => b.kind === 'house').map((b) => b.id));
    for (const v of s.world.villagers) {
      expect(homeIds.has(v.homeId)).toBe(true);
    }
    const assigns = s.world.villagers.map((v) => v.workplaceId).filter(Boolean) as string[];
    expect(new Set(assigns).size).toBe(assigns.length);
  });
});
