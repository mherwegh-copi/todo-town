export type ScheduleEntry = {
  readonly fromHour: number;
  readonly toHour: number;
  readonly activity: 'sleep' | 'work' | 'idle';
  readonly buildingId?: string;
};

export type Villager = {
  readonly id: string;
  readonly name: string;
  readonly homeId: string;
  readonly workplaceId?: string;
  readonly schedule: readonly ScheduleEntry[];
  readonly spriteVariant: number;
};

export const VILLAGER_NAMES: readonly string[] = [
  'Alma', 'Bran', 'Cora', 'Dorian', 'Elin', 'Faust',
  'Gilda', 'Hadrien', 'Iona', 'Joran', 'Kira', 'Loris',
  'Maël', 'Nora', 'Orin', 'Perla', 'Quentin', 'Reva',
];
