import { Todo } from '../domain/todo';
import { countDoneToday } from '../systems/dailyGoal';
import { clampDailyGoal } from '../systems/todoStore';

const ROLLOVER_INTERVAL_MS = 60_000;

export class DailyStats {
  private root: HTMLDivElement;
  private getTodos: () => readonly Todo[];
  private getGoal: () => number;
  private onGoalChange: (goal: number) => void;
  private timer: ReturnType<typeof setInterval>;

  constructor(
    container: HTMLElement,
    getTodos: () => readonly Todo[],
    getGoal: () => number,
    onGoalChange: (goal: number) => void,
  ) {
    this.getTodos = getTodos;
    this.getGoal = getGoal;
    this.onGoalChange = onGoalChange;

    this.root = document.createElement('div');
    this.root.className = 'clock-stats';
    container.appendChild(this.root);

    this.render();
    this.timer = setInterval(() => this.render(), ROLLOVER_INTERVAL_MS);
  }

  destroy(): void {
    clearInterval(this.timer);
  }

  render(): void {
    const done = countDoneToday(this.getTodos(), Date.now());
    const goal = this.getGoal();
    this.root.classList.toggle('goal-reached', done >= goal);

    this.root.textContent = '';
    this.root.append(`${done}/`);

    const goalSpan = document.createElement('span');
    goalSpan.className = 'clock-goal';
    goalSpan.textContent = String(goal);
    goalSpan.title = "cliquer pour modifier l'objectif";
    goalSpan.addEventListener('click', () => this.openGoalEditor(goalSpan));
    this.root.appendChild(goalSpan);

    this.root.append(" faites aujourd'hui");
  }

  private openGoalEditor(goalSpan: HTMLSpanElement): void {
    const input = document.createElement('input');
    input.type = 'number';
    input.className = 'clock-goal-edit';
    input.value = String(this.getGoal());
    input.min = '1';
    input.max = '99';

    let finished = false;
    const finish = (commit: boolean): void => {
      if (finished) return;
      finished = true;
      if (commit) {
        const next = clampDailyGoal(Number(input.value));
        if (next !== this.getGoal()) {
          this.onGoalChange(next);
          return; // onGoalChange triggers a render which rebuilds the line
        }
      }
      input.replaceWith(goalSpan);
    };

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') finish(true);
      else if (e.key === 'Escape') finish(false);
    });
    input.addEventListener('blur', () => finish(true));

    goalSpan.replaceWith(input);
    input.focus();
    input.select();
  }
}
