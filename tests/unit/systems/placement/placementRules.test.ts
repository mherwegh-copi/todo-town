import { describe, it, expect } from 'vitest';
import { worldPixelToTile } from '../../../../src/systems/placement/placementRules';
import { TILE_SIZE } from '../../../../src/config';

describe('worldPixelToTile', () => {
  it('maps a pixel inside a tile to that tile', () => {
    expect(worldPixelToTile(0, 0)).toEqual({ x: 0, y: 0 });
    expect(worldPixelToTile(TILE_SIZE + 3, TILE_SIZE * 2 + 1)).toEqual({ x: 1, y: 2 });
  });

  it('floors fractional pixels within a tile', () => {
    expect(worldPixelToTile(TILE_SIZE - 1, TILE_SIZE - 1)).toEqual({ x: 0, y: 0 });
  });

  it('handles negative pixels (off the grid)', () => {
    expect(worldPixelToTile(-1, -1)).toEqual({ x: -1, y: -1 });
  });
});
