import { describe, it, expect, beforeEach } from 'vitest';
import { drawCards, applyChosenCard, isActionAvailable } from '../../../src/systems/dailyAction';
import { emptyState } from '../../../src/domain/state';
import { placeBuilding } from '../../../src/systems/worldOps';
import { resetIdsForTests } from '../../../src/domain/ids';

describe('dailyAction', () => {
  beforeEach(() => resetIdsForTests());

  it('isActionAvailable false when same day already played', () => {
    const now = new Date(2026, 4, 20, 9).getTime();
    const s = { ...emptyState(now, 1), lastActionDate: '2026-05-20' };
    expect(isActionAvailable(s, now)).toBe(false);
  });

  it('isActionAvailable false before 06:00 even if new day', () => {
    const now = new Date(2026, 4, 21, 5).getTime();
    const s = { ...emptyState(now, 1), lastActionDate: '2026-05-20' };
    expect(isActionAvailable(s, now)).toBe(false);
  });

  it('isActionAvailable true after 06:00 on a new day', () => {
    const now = new Date(2026, 4, 21, 7).getTime();
    const s = { ...emptyState(now, 1), lastActionDate: '2026-05-20' };
    expect(isActionAvailable(s, now)).toBe(true);
  });

  it('drawCards returns 3 distinct available cards', () => {
    let s = emptyState(0, 1);
    s = placeBuilding(s, 'townHall', 15, 15, 0);
    const cards = drawCards(s, 0);
    expect(cards).toHaveLength(3);
    expect(new Set(cards.map((c) => c.id)).size).toBe(3);
  });

  it('applyChosenCard updates lastActionDate and applies effect', () => {
    let s = emptyState(0, 1);
    s = placeBuilding(s, 'townHall', 15, 15, 0);
    const cards = drawCards(s, 0);
    const now = new Date(2026, 4, 21, 7).getTime();
    const s2 = applyChosenCard(s, cards[0]!.id, now);
    expect(s2.lastActionDate).toBe('2026-05-21');
    expect(s2.lastSeenAt).toBe(now);
  });
});
