import { Todo } from '../domain/todo';
import { SortMode, sortTodos } from '../systems/todoSort';
import { partitionTodos } from '../systems/todoStore';

export type TodoSidebarCallbacks = {
  onAdd: (text: string) => void;
  onToggle: (id: string) => void;
  onEdit: (id: string, text: string) => void;
  onDelete: (id: string) => void;
  onSortChange?: (mode: SortMode) => void;
  onCollapseChange?: (collapsed: boolean) => void;
};

const SORT_OPTIONS: readonly { value: SortMode; label: string }[] = [
  { value: 'created', label: 'Création' },
  { value: 'modified', label: 'Modification' },
  { value: 'alpha', label: 'Alphabétique' },
];

export class TodoSidebar {
  private root: HTMLElement;
  private list!: HTMLUListElement;
  private input!: HTMLInputElement;
  private sortSelect!: HTMLSelectElement;
  private doneSection!: HTMLDivElement;
  private doneHeader!: HTMLDivElement;
  private doneList!: HTMLUListElement;
  private sortMode: SortMode;
  private doneCollapsed: boolean;

  constructor(
    container: HTMLElement,
    private cb: TodoSidebarCallbacks,
    initialSort: SortMode = 'created',
    initialCollapsed = false,
  ) {
    this.sortMode = initialSort;
    this.doneCollapsed = initialCollapsed;
    this.root = document.createElement('div');
    this.root.className = 'todo-sidebar';
    container.appendChild(this.root);
    this.buildShell();
  }

  private buildShell(): void {
    const header = document.createElement('div');
    header.className = 'todo-header';

    this.input = document.createElement('input');
    this.input.className = 'todo-input';
    this.input.type = 'text';
    this.input.placeholder = 'nouvelle tâche…';
    this.input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.submitAdd();
    });

    const addBtn = document.createElement('button');
    addBtn.className = 'todo-add';
    addBtn.textContent = '+';
    addBtn.addEventListener('click', () => this.submitAdd());

    header.appendChild(this.input);
    header.appendChild(addBtn);

    const sortRow = document.createElement('div');
    sortRow.className = 'todo-sort-row';
    this.sortSelect = document.createElement('select');
    this.sortSelect.className = 'todo-sort';
    for (const { value, label } of SORT_OPTIONS) {
      const opt = document.createElement('option');
      opt.value = value;
      opt.textContent = label;
      this.sortSelect.appendChild(opt);
    }
    this.sortSelect.value = this.sortMode;
    this.sortSelect.addEventListener('change', () => {
      this.sortMode = this.sortSelect.value as SortMode;
      this.cb.onSortChange?.(this.sortMode);
    });
    sortRow.appendChild(this.sortSelect);

    this.list = document.createElement('ul');
    this.list.className = 'todo-list';

    this.doneSection = document.createElement('div');
    this.doneSection.className = 'todo-section';
    this.doneHeader = document.createElement('div');
    this.doneHeader.className = 'todo-section-header';
    this.doneHeader.addEventListener('click', () => {
      this.doneCollapsed = !this.doneCollapsed;
      this.applyCollapsed();
      this.cb.onCollapseChange?.(this.doneCollapsed);
    });
    this.doneList = document.createElement('ul');
    this.doneList.className = 'todo-list todo-done-list';
    this.doneSection.appendChild(this.doneHeader);
    this.doneSection.appendChild(this.doneList);

    this.root.appendChild(header);
    this.root.appendChild(sortRow);
    this.root.appendChild(this.list);
    this.root.appendChild(this.doneSection);
  }

  private applyCollapsed(): void {
    this.doneSection.classList.toggle('collapsed', this.doneCollapsed);
  }

  private submitAdd(): void {
    const text = this.input.value.trim();
    if (text.length === 0) return;
    this.cb.onAdd(text);
    this.input.value = '';
  }

  private createItem(t: Todo): HTMLLIElement {
    const li = document.createElement('li');
    li.className = 'todo-item' + (t.done ? ' done' : '');
    li.dataset.id = t.id;

    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.className = 'todo-check';
    cb.checked = t.done;
    cb.addEventListener('change', () => this.cb.onToggle(t.id));

    const label = document.createElement('span');
    label.className = 'todo-label';
    label.textContent = t.text;
    label.addEventListener('dblclick', () => {
      const edit = document.createElement('input');
      edit.type = 'text';
      edit.className = 'todo-edit';
      edit.value = t.text;
      let finished = false;
      const finish = (commit: boolean): void => {
        if (finished) return;
        finished = true;
        if (commit) {
          const val = edit.value.trim();
          if (val.length > 0 && val !== t.text) this.cb.onEdit(t.id, val);
        }
        edit.replaceWith(label);
      };
      edit.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') finish(true);
        else if (e.key === 'Escape') finish(false);
      });
      edit.addEventListener('blur', () => finish(true));
      label.replaceWith(edit);
      edit.focus();
      edit.select();
    });

    const del = document.createElement('button');
    del.className = 'todo-delete';
    del.textContent = '×';
    del.addEventListener('click', () => this.cb.onDelete(t.id));

    li.appendChild(cb);
    li.appendChild(label);
    li.appendChild(del);
    return li;
  }

  render(todos: readonly Todo[]): void {
    const { active, done } = partitionTodos(todos);
    const sortedActive = sortTodos(active, this.sortMode);
    const sortedDone = [...done].sort((a, b) => b.updatedAt - a.updatedAt);

    this.list.innerHTML = '';
    for (const t of sortedActive) this.list.appendChild(this.createItem(t));

    this.doneList.innerHTML = '';
    for (const t of sortedDone) this.doneList.appendChild(this.createItem(t));

    this.doneHeader.textContent = `${this.doneCollapsed ? '▸' : '▾'} Terminées (${sortedDone.length})`;
    this.applyCollapsed();
  }

  /** Applique des préférences arrivées par synchronisation cloud. */
  setPrefs(sortMode: SortMode, doneCollapsed: boolean): void {
    this.sortMode = sortMode;
    this.sortSelect.value = sortMode;
    this.doneCollapsed = doneCollapsed;
    this.applyCollapsed();
  }
}
