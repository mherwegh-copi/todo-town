import { describe, it, expect, beforeEach } from 'vitest';
import { ALL_CARDS, cardById } from '../../../src/cards/deck';
import { emptyState } from '../../../src/domain/state';
import { placeBuilding, isFootprintFree } from '../../../src/systems/worldOps';
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

  it('build_house effect places at explicit coords', () => {
    let s = emptyState(0, 1);
    s = placeBuilding(s, 'townHall', 15, 15, 0);
    const next = cardById('build_house').effect(s, 0, { x: 2, y: 2 });
    const house = next.world.buildings.find((b) => b.kind === 'house');
    expect(house).toBeDefined();
    expect(house!.tileX).toBe(2);
    expect(house!.tileY).toBe(2);
  });

  it('build_house effect falls back to a free spot when coords overlap', () => {
    let s = emptyState(0, 1);
    s = placeBuilding(s, 'townHall', 15, 15, 0);
    // {15,15} chevauche la mairie -> invalide -> repli findFreeSpot
    const next = cardById('build_house').effect(s, 0, { x: 15, y: 15 });
    const house = next.world.buildings.find((b) => b.kind === 'house');
    expect(house).toBeDefined();
    expect(isFootprintFree(s, 'house', house!.tileX, house!.tileY)).toBe(true);
  });

  it('build_house effect still works without coords', () => {
    let s = emptyState(0, 1);
    s = placeBuilding(s, 'townHall', 15, 15, 0);
    const next = cardById('build_house').effect(s, 0);
    expect(next.world.buildings.filter((b) => b.kind === 'house')).toHaveLength(1);
  });

  it('building cards expose placementKind, others do not', () => {
    expect(cardById('build_house').placementKind).toBe('house');
    expect(cardById('build_well').placementKind).toBe('well');
    expect(cardById('recruit_villager').placementKind).toBeUndefined();
    expect(cardById('upgrade_town_hall').placementKind).toBeUndefined();
  });
});
