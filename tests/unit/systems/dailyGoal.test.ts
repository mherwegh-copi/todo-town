import { describe, it, expect } from 'vitest';
import { countDoneToday } from '../../../src/systems/dailyGoal';
import { newTodo } from '../../../src/domain/todo';

const NOON = new Date(2026, 4, 20, 12, 0, 0).getTime();
const YESTERDAY_NOON = new Date(2026, 4, 19, 12, 0, 0).getTime();

describe('countDoneToday', () => {
  it('counts a todo done today', () => {
    const t = { ...newTodo('a', NOON), done: true, updatedAt: NOON };
    expect(countDoneToday([t], NOON)).toBe(1);
  });

  it('ignores a todo done yesterday', () => {
    const t = { ...newTodo('a', YESTERDAY_NOON), done: true, updatedAt: YESTERDAY_NOON };
    expect(countDoneToday([t], NOON)).toBe(0);
  });

  it('ignores a todo not done', () => {
    const t = { ...newTodo('a', NOON), done: false, updatedAt: NOON };
    expect(countDoneToday([t], NOON)).toBe(0);
  });

  it('returns 0 for an empty list', () => {
    expect(countDoneToday([], NOON)).toBe(0);
  });

  it('counts only today across a mixed list', () => {
    const todayDone = { ...newTodo('a', NOON), done: true, updatedAt: NOON };
    const ydayDone = { ...newTodo('b', YESTERDAY_NOON), done: true, updatedAt: YESTERDAY_NOON };
    const todayOpen = { ...newTodo('c', NOON), done: false, updatedAt: NOON };
    expect(countDoneToday([todayDone, ydayDone, todayOpen], NOON)).toBe(1);
  });

  it('handles the midnight boundary by local day', () => {
    const beforeMidnight = new Date(2026, 4, 20, 23, 59, 59).getTime();
    const afterMidnight = new Date(2026, 4, 20, 0, 0, 1).getTime();
    const t1 = { ...newTodo('a', beforeMidnight), done: true, updatedAt: beforeMidnight };
    const t2 = { ...newTodo('b', afterMidnight), done: true, updatedAt: afterMidnight };
    expect(countDoneToday([t1, t2], NOON)).toBe(2);
  });
});
