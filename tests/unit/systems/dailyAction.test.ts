import { describe, it, expect, beforeEach } from 'vitest';
import { drawCards, applyChosenCard } from '../../../src/systems/dailyAction';
import { emptyState } from '../../../src/domain/state';
import { placeBuilding } from '../../../src/systems/worldOps';
import { resetIdsForTests } from '../../../src/domain/ids';

describe('dailyAction', () => {
  beforeEach(() => resetIdsForTests());

  it('drawCards renvoie 3 cartes distinctes au niveau 1', () => {
    let s = emptyState(0, 1);
    s = placeBuilding(s, 'townHall', 15, 15, 0);
    const cards = drawCards(s, 0);
    expect(cards).toHaveLength(3);
    expect(new Set(cards.map((c) => c.id)).size).toBe(3);
  });

  it('applyChosenCard applique l effet, consomme une ouverture et met à jour lastSeenAt', () => {
    let s = emptyState(0, 1);
    s = placeBuilding(s, 'townHall', 15, 15, 0);
    s = { ...s, construction: { ...s.construction, openings: 2 } };
    const cards = drawCards(s, 0);
    const now = new Date(2026, 4, 21, 7).getTime();
    const s2 = applyChosenCard(s, cards[0]!.id, now);
    expect(s2.construction.openings).toBe(1);
    expect(s2.lastSeenAt).toBe(now);
  });

  it('place le bâtiment aux coordonnées fournies', () => {
    let s = emptyState(0, 1);
    s = placeBuilding(s, 'townHall', 15, 15, 0);
    s = { ...s, construction: { ...s.construction, openings: 1 } };
    const now = new Date(2026, 4, 21, 7).getTime();
    const next = applyChosenCard(s, 'build_house', now, { x: 3, y: 3 });
    const house = next.world.buildings.find((b) => b.kind === 'house');
    expect(house).toBeDefined();
    expect(house!.tileX).toBe(3);
    expect(house!.tileY).toBe(3);
  });

  it('place automatiquement quand aucune coordonnée n est donnée', () => {
    let s = emptyState(0, 1);
    s = placeBuilding(s, 'townHall', 15, 15, 0);
    const now = new Date(2026, 4, 21, 7).getTime();
    const next = applyChosenCard(s, 'build_house', now);
    expect(next.world.buildings.filter((b) => b.kind === 'house')).toHaveLength(1);
  });
});
