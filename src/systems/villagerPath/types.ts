export type TileXY = { readonly x: number; readonly y: number };

export type Segment = {
  readonly kind: 'walk' | 'pause';
  readonly from: TileXY;
  readonly to: TileXY;
  readonly path: readonly TileXY[];
  readonly startMs: number;
  readonly endMs: number;
};

export type DaySchedule = {
  readonly day: number;
  readonly segments: readonly Segment[];
};

export type Position = { readonly x: number; readonly y: number; readonly bobbing: boolean };
