import { TILE_SIZE } from '../../config';

/** World-pixel coordinate → tile coordinate. May return out-of-bounds tiles. */
export function worldPixelToTile(px: number, py: number): { x: number; y: number } {
  return { x: Math.floor(px / TILE_SIZE), y: Math.floor(py / TILE_SIZE) };
}
