import { Villager, ScheduleEntry } from '../domain/villager';

export function villagerActivityAt(v: Villager, hour: number): ScheduleEntry {
  for (const s of v.schedule) {
    if (hour >= s.fromHour && hour < s.toHour) return s;
  }
  return { fromHour: hour, toHour: hour + 1, activity: 'idle' };
}

export function defaultSchedule(workplaceId?: string): ScheduleEntry[] {
  if (workplaceId) {
    return [
      { fromHour: 0, toHour: 6, activity: 'sleep' },
      { fromHour: 6, toHour: 8, activity: 'idle' },
      { fromHour: 8, toHour: 18, activity: 'work', buildingId: workplaceId },
      { fromHour: 18, toHour: 22, activity: 'idle' },
      { fromHour: 22, toHour: 24, activity: 'sleep' },
    ];
  }
  return [
    { fromHour: 0, toHour: 6, activity: 'sleep' },
    { fromHour: 6, toHour: 22, activity: 'idle' },
    { fromHour: 22, toHour: 24, activity: 'sleep' },
  ];
}
