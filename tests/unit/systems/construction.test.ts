import { describe, it, expect } from 'vitest';
import {
  thresholdFor,
  poolSizeFor,
  addPoints,
  consumeOpening,
  grantMorningOpening,
} from '../../../src/systems/construction';
import { emptyState } from '../../../src/domain/state';

function withConstruction(points: number, openings: number, level = 1) {
  const s = emptyState(0, 1);
  return {
    ...s,
    progression: { ...s.progression, townHallLevel: level },
    construction: { points, openings, lastMorningDate: '' },
  };
}

describe('thresholdFor', () => {
  it('vaut 3 au niveau 1, 5 au niveau 2, 7 au niveau 3', () => {
    expect(thresholdFor(1)).toBe(3);
    expect(thresholdFor(2)).toBe(5);
    expect(thresholdFor(3)).toBe(7);
  });

  it('traite un niveau < 1 comme le niveau 1', () => {
    expect(thresholdFor(0)).toBe(3);
  });
});

describe('poolSizeFor', () => {
  it('vaut 3 au niveau 1, 4 au niveau 2, 5 au niveau 3+', () => {
    expect(poolSizeFor(1)).toBe(3);
    expect(poolSizeFor(2)).toBe(4);
    expect(poolSizeFor(3)).toBe(5);
    expect(poolSizeFor(7)).toBe(5);
  });
});

describe('addPoints', () => {
  it('accumule les points sans atteindre le seuil', () => {
    const s = addPoints(withConstruction(0, 0), 1);
    expect(s.construction.points).toBe(1);
    expect(s.construction.openings).toBe(0);
  });

  it('convertit un palier atteint en une ouverture', () => {
    const s = addPoints(withConstruction(0, 0), 3);
    expect(s.construction.points).toBe(0);
    expect(s.construction.openings).toBe(1);
  });

  it('convertit plusieurs paliers d un coup et garde le surplus', () => {
    const s = addPoints(withConstruction(0, 0), 7);
    expect(s.construction.openings).toBe(2);
    expect(s.construction.points).toBe(1);
  });

  it('utilise le seuil du niveau courant', () => {
    const s = addPoints(withConstruction(0, 0, 2), 12);
    expect(s.construction.openings).toBe(2);
    expect(s.construction.points).toBe(2);
  });

  it('retire des points au décochage, plancher à 0', () => {
    expect(addPoints(withConstruction(2, 0), -1).construction.points).toBe(1);
    expect(addPoints(withConstruction(2, 0), -5).construction.points).toBe(0);
  });

  it('met la conversion en pause quand la file est pleine', () => {
    const s = addPoints(withConstruction(0, 5), 3);
    expect(s.construction.openings).toBe(5);
    expect(s.construction.points).toBe(3);
  });
});

describe('consumeOpening', () => {
  it('retire une ouverture de la file', () => {
    expect(consumeOpening(withConstruction(0, 2)).construction.openings).toBe(1);
  });

  it('ne descend pas sous zéro', () => {
    expect(consumeOpening(withConstruction(0, 0)).construction.openings).toBe(0);
  });

  it('reconvertit le surplus de points en attente quand un créneau se libère', () => {
    // File pleine (5) + 3 points bloqués au niveau 1 (seuil 3).
    const s = consumeOpening(withConstruction(3, 5));
    expect(s.construction.openings).toBe(5);
    expect(s.construction.points).toBe(0);
  });
});

describe('grantMorningOpening', () => {
  const at = (h: number) => new Date(2026, 4, 21, h).getTime();

  it('accorde une ouverture le matin et mémorise la date', () => {
    const s = grantMorningOpening(withConstruction(0, 0), at(8));
    expect(s.construction.openings).toBe(1);
    expect(s.construction.lastMorningDate).toBe('2026-05-21');
  });

  it('est idempotent dans la même journée', () => {
    const once = grantMorningOpening(withConstruction(0, 0), at(8));
    const twice = grantMorningOpening(once, at(11));
    expect(twice.construction.openings).toBe(1);
  });

  it('n accorde rien avant 06:00', () => {
    const s = grantMorningOpening(withConstruction(0, 0), at(5));
    expect(s.construction.openings).toBe(0);
    expect(s.construction.lastMorningDate).toBe('');
  });

  it('respecte le plafond mais mémorise quand même la date du jour', () => {
    const s = grantMorningOpening(withConstruction(0, 5), at(8));
    expect(s.construction.openings).toBe(5);
    expect(s.construction.lastMorningDate).toBe('2026-05-21');
  });

  it('accorde de nouveau un autre jour', () => {
    const day1 = grantMorningOpening(withConstruction(0, 0), at(8));
    const day2 = grantMorningOpening(day1, new Date(2026, 4, 22, 8).getTime());
    expect(day2.construction.openings).toBe(2);
    expect(day2.construction.lastMorningDate).toBe('2026-05-22');
  });
});
