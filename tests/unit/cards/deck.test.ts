import { describe, it, expect, beforeEach } from 'vitest';
import { ALL_CARDS, cardById } from '../../../src/cards/deck';
import { emptyState } from '../../../src/domain/state';
import { placeBuilding } from '../../../src/systems/worldOps';
import { resetIdsForTests } from '../../../src/domain/ids';

describe('deck', () => {
  beforeEach(() => resetIdsForTests());

  it('all cards have unique ids', () => {
    const ids = ALL_CARDS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('cardById returns matching card', () => {
    const first = ALL_CARDS[0]!;
    expect(cardById(first.id)).toBe(first);
  });

  it('build-house card adds a house', () => {
    let s = emptyState(0, 1);
    s = placeBuilding(s, 'townHall', 15, 15, 0);
    const card = cardById('build_house');
    expect(card.isAvailable(s)).toBe(true);
    const s2 = card.effect(s, 0);
    expect(s2.world.buildings.filter((b) => b.kind === 'house')).toHaveLength(1);
  });

  it('recruit card unavailable when no free housing', () => {
    let s = emptyState(0, 1);
    s = placeBuilding(s, 'townHall', 15, 15, 0);
    const recruit = cardById('recruit_villager');
    expect(recruit.isAvailable(s)).toBe(false);
  });
});
