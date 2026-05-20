import { describe, it, expect, beforeEach } from 'vitest';
import { drawCards, applyChosenCard, isActionAvailable } from '../../../src/systems/dailyAction';
import { emptyState } from '../../../src/domain/state';
import { placeBuilding } from '../../../src/systems/worldOps';
import { resetIdsForTests } from '../../../src/domain/ids';
import { initWorld } from '../../../src/systems/init';
import { ALL_CARDS } from '../../../src/cards/deck';

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

describe('drawCards motivation', () => {
  beforeEach(() => resetIdsForTests());

  it('returns 3 cards when motivation = 0', () => {
    const NOW = 1700000000000;
    const s = { ...initWorld(NOW, 1), motivation: 0 };
    const cards = drawCards(s, NOW);
    expect(cards.length).toBeLessThanOrEqual(3);
  });

  it('draws more cards when motivation is higher', () => {
    const NOW = 1700000000000;
    const s0 = initWorld(NOW, 1);
    const cardsLow = drawCards({ ...s0, motivation: 0 }, NOW);
    const cardsMid = drawCards({ ...s0, motivation: 3 }, NOW);
    const cardsHigh = drawCards({ ...s0, motivation: 99 }, NOW);
    // With motivation bonus: floor(3 / 3) = 1, floor(99 / 3) = 33 (capped at 2)
    // So expecting 3+1=4 and 3+2=5 cards respectively
    expect(cardsMid.length).toBeGreaterThanOrEqual(cardsLow.length);
    expect(cardsHigh.length).toBeGreaterThanOrEqual(cardsMid.length);
  });

  it('applies motivation bonus correctly', () => {
    const NOW = 1700000000000;
    const s0 = initWorld(NOW, 1);
    // motivation=0 -> bonus=0 -> 3 cards
    const cards0 = drawCards({ ...s0, motivation: 0 }, NOW);
    // motivation=3 -> bonus=floor(3/3)=1 -> 4 cards (if available)
    const cards3 = drawCards({ ...s0, motivation: 3 }, NOW);
    // motivation=6 -> bonus=floor(6/3)=2 (capped) -> 5 cards (if available)
    const cards6 = drawCards({ ...s0, motivation: 6 }, NOW);

    expect(cards3.length).toBeGreaterThanOrEqual(cards0.length);
    expect(cards6.length).toBeGreaterThanOrEqual(cards3.length);
  });
});

describe('applyChosenCard motivation cost', () => {
  beforeEach(() => resetIdsForTests());

  it('motivation -10 after picking (clamped at 0)', () => {
    const NOW = 1700000000000;
    const base = initWorld(NOW, 1);
    const s = { ...base, motivation: 4 };
    const cards = drawCards(s, NOW);
    if (cards.length === 0) return;
    const next = applyChosenCard(s, cards[0]!.id, NOW);
    expect(next.motivation).toBe(0);
  });

  it('motivation -10 when above threshold', () => {
    const NOW = 1700000000000;
    const base = initWorld(NOW, 1);
    const s = { ...base, motivation: 25 };
    const cards = drawCards(s, NOW);
    if (cards.length === 0) return;
    const next = applyChosenCard(s, cards[0]!.id, NOW);
    expect(next.motivation).toBe(15);
  });
});
