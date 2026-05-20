export type CropKind = 'wheat' | 'orchard';

export type Crop = {
  readonly id: string;
  readonly kind: CropKind;
  readonly tileX: number;
  readonly tileY: number;
  readonly plantedAt: number;
};

export const CROP_GROWTH_MS: Record<CropKind, number> = {
  wheat: 7 * 24 * 60 * 60 * 1000,
  orchard: 30 * 24 * 60 * 60 * 1000,
};

export function cropStage(crop: Crop, now: number): 0 | 1 | 2 | 3 {
  const total = CROP_GROWTH_MS[crop.kind];
  const age = Math.max(0, now - crop.plantedAt);
  const ratio = Math.min(1, age / total);
  if (ratio < 0.33) return 0;
  if (ratio < 0.66) return 1;
  if (ratio < 1) return 2;
  return 3;
}
