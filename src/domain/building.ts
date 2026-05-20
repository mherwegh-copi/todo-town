export type BuildingKind =
  | 'townHall'
  | 'house'
  | 'farm'
  | 'forge'
  | 'mill'
  | 'well'
  | 'square';

export type Building = {
  readonly id: string;
  readonly kind: BuildingKind;
  readonly tileX: number;
  readonly tileY: number;
  readonly builtAt: number;
};

export const BUILDING_FOOTPRINT: Record<BuildingKind, { w: number; h: number }> = {
  townHall: { w: 3, h: 3 },
  house: { w: 2, h: 2 },
  farm: { w: 3, h: 3 },
  forge: { w: 2, h: 2 },
  mill: { w: 2, h: 2 },
  well: { w: 1, h: 1 },
  square: { w: 3, h: 3 },
};

export const HOUSE_CAPACITY = 2;

export function isWorkBuilding(kind: BuildingKind): boolean {
  return kind === 'farm' || kind === 'forge' || kind === 'mill';
}
