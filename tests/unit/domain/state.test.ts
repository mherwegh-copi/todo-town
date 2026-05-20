import { describe, it, expect } from 'vitest';
import { emptyState } from '../../../src/domain/state';

describe('emptyState', () => {
  it('initializes motivation to 0', () => {
    const s = emptyState(1, 42);
    expect(s.motivation).toBe(0);
  });
});
