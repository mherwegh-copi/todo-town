import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DailyStats } from '../../../src/ui/DailyStats';
import { newTodo } from '../../../src/domain/todo';
import type { Todo } from '../../../src/domain/todo';

function makeContainer(): HTMLElement {
  const el = document.createElement('div');
  document.body.appendChild(el);
  return el;
}

function doneNow(text: string): Todo {
  const now = Date.now();
  return { ...newTodo(text, now), done: true, updatedAt: now };
}

describe('DailyStats', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('renders count over goal with the goal in a clickable span', () => {
    const stats = new DailyStats(makeContainer(), () => [doneNow('a')], () => 5, vi.fn());
    const el = document.querySelector('.clock-stats')!;
    expect(el.textContent).toContain('1/5');
    expect(el.textContent).toContain('aujourd');
    expect(el.querySelector('.clock-goal')!.textContent).toBe('5');
    stats.destroy();
  });

  it('adds goal-reached class when count meets the goal', () => {
    const stats = new DailyStats(makeContainer(), () => [doneNow('a')], () => 1, vi.fn());
    expect(document.querySelector('.clock-stats')!.classList.contains('goal-reached')).toBe(true);
    stats.destroy();
  });

  it('does not add goal-reached class when count is below the goal', () => {
    const stats = new DailyStats(makeContainer(), () => [], () => 5, vi.fn());
    expect(document.querySelector('.clock-stats')!.classList.contains('goal-reached')).toBe(false);
    stats.destroy();
  });

  it('clicking the goal opens an inline number input', () => {
    const stats = new DailyStats(makeContainer(), () => [], () => 5, vi.fn());
    (document.querySelector('.clock-goal') as HTMLElement).click();
    const input = document.querySelector('input.clock-goal-edit') as HTMLInputElement;
    expect(input).not.toBeNull();
    expect(input.value).toBe('5');
    stats.destroy();
  });

  it('committing a new goal with Enter calls onGoalChange clamped', () => {
    const onGoalChange = vi.fn();
    const stats = new DailyStats(makeContainer(), () => [], () => 5, onGoalChange);
    (document.querySelector('.clock-goal') as HTMLElement).click();
    const input = document.querySelector('input.clock-goal-edit') as HTMLInputElement;
    input.value = '200';
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(onGoalChange).toHaveBeenCalledWith(99);
    stats.destroy();
  });

  it('Escape cancels the edit without calling onGoalChange', () => {
    const onGoalChange = vi.fn();
    const stats = new DailyStats(makeContainer(), () => [], () => 5, onGoalChange);
    (document.querySelector('.clock-goal') as HTMLElement).click();
    const input = document.querySelector('input.clock-goal-edit') as HTMLInputElement;
    input.value = '9';
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(onGoalChange).not.toHaveBeenCalled();
    expect(document.querySelector('.clock-goal')).not.toBeNull();
    stats.destroy();
  });

  it('render() reflects the current todos getter', () => {
    let todos: readonly Todo[] = [];
    const stats = new DailyStats(makeContainer(), () => todos, () => 5, vi.fn());
    expect(document.querySelector('.clock-stats')!.textContent).toContain('0/5');
    todos = [doneNow('a')];
    stats.render();
    expect(document.querySelector('.clock-stats')!.textContent).toContain('1/5');
    stats.destroy();
  });
});
