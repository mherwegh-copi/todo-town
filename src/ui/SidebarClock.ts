import { dayIndex } from '../systems/clock';
import { seasonForDay } from '../systems/season';

const SEASON_LABEL_FR: Record<string, string> = {
  spring: 'printemps',
  summer: 'été',
  autumn: 'automne',
  winter: 'hiver',
};

export class SidebarClock {
  private timeEl: HTMLElement;
  private metaEl: HTMLElement;
  private getCreatedAt: () => number | null;
  private timer: ReturnType<typeof setInterval>;

  constructor(container: HTMLElement, getCreatedAt: () => number | null) {
    this.getCreatedAt = getCreatedAt;

    const root = document.createElement('div');
    root.className = 'clock-bar';

    this.timeEl = document.createElement('div');
    this.timeEl.className = 'clock-time';

    this.metaEl = document.createElement('div');
    this.metaEl.className = 'clock-meta';

    root.appendChild(this.timeEl);
    root.appendChild(this.metaEl);
    container.appendChild(root);

    this.tick();
    this.timer = setInterval(() => this.tick(), 1000);
  }

  destroy(): void {
    clearInterval(this.timer);
  }

  private tick(): void {
    const now = Date.now();
    const d = new Date(now);
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    const ss = String(d.getSeconds()).padStart(2, '0');
    this.timeEl.textContent = `${hh}:${mm}:${ss}`;
    const createdAt = this.getCreatedAt();
    if (createdAt == null) {
      this.metaEl.textContent = '';
      return;
    }
    const day = dayIndex(createdAt, now);
    const season = seasonForDay(day);
    this.metaEl.textContent = `jour ${day} · ${SEASON_LABEL_FR[season] ?? season}`;
  }
}
