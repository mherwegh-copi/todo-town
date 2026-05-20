export type TileKind = 'grass' | 'dirt' | 'water' | 'path';

export type Tile = {
  readonly x: number;
  readonly y: number;
  readonly kind: TileKind;
};
