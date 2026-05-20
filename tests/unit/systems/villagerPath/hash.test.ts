import { describe, it, expect } from 'vitest';
import { hashStr, mixSeeds } from '../../../../src/systems/villagerPath/hash';

describe('villagerPath/hash', () => {
  it('hashStr is deterministic', () => {
    expect(hashStr('alma')).toBe(hashStr('alma'));
  });

  it('hashStr differs for different inputs', () => {
    expect(hashStr('alma')).not.toBe(hashStr('bran'));
  });

  it('mixSeeds is deterministic and combines inputs', () => {
    expect(mixSeeds(1, 2, 3)).toBe(mixSeeds(1, 2, 3));
    expect(mixSeeds(1, 2, 3)).not.toBe(mixSeeds(1, 2, 4));
  });
});
