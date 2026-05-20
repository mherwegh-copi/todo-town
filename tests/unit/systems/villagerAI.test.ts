import { describe, it, expect } from 'vitest';
import { villagerActivityAt } from '../../../src/systems/villagerAI';
import { Villager } from '../../../src/domain/villager';

const v: Villager = {
  id: 'v1',
  name: 'Alma',
  homeId: 'house1',
  workplaceId: 'farm1',
  spriteVariant: 0,
  schedule: [
    { fromHour: 22, toHour: 24, activity: 'sleep', buildingId: 'house1' },
    { fromHour: 0, toHour: 6, activity: 'sleep', buildingId: 'house1' },
    { fromHour: 6, toHour: 8, activity: 'idle' },
    { fromHour: 8, toHour: 18, activity: 'work', buildingId: 'farm1' },
    { fromHour: 18, toHour: 22, activity: 'idle' },
  ],
};

describe('villagerAI', () => {
  it('returns sleep activity at night', () => {
    expect(villagerActivityAt(v, 3).activity).toBe('sleep');
    expect(villagerActivityAt(v, 23).activity).toBe('sleep');
  });

  it('returns work activity during work hours', () => {
    const a = villagerActivityAt(v, 10);
    expect(a.activity).toBe('work');
    expect(a.buildingId).toBe('farm1');
  });

  it('returns idle when no slot matches work', () => {
    expect(villagerActivityAt(v, 7).activity).toBe('idle');
  });

  it('villager without workplace never works', () => {
    const u: Villager = { ...v, workplaceId: undefined, schedule: [
      { fromHour: 0, toHour: 6, activity: 'sleep', buildingId: 'house1' },
      { fromHour: 6, toHour: 24, activity: 'idle' },
    ]};
    expect(villagerActivityAt(u, 10).activity).toBe('idle');
  });
});
