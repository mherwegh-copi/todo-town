import { describe, it, expect } from 'vitest';
import { emptyState } from '../../../src/domain/state';

describe('emptyState', () => {
  it('initialise le bloc construction à zéro', () => {
    const s = emptyState(1, 42);
    expect(s.construction).toEqual({ points: 0, openings: 0, lastMorningDate: '' });
  });
});
