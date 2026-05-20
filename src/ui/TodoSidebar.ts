import { Todo } from '../domain/todo';

export type TodoSidebarCallbacks = {
  onAdd: (text: string) => void;
  onToggle: (id: string) => void;
  onEdit: (id: string, text: string) => void;
  onDelete: (id: string) => void;
};

export class TodoSidebar {
  private root: HTMLElement;
  private list!: HTMLUListElement;
  private input!: HTMLInputElement;

  constructor(container: HTMLElement, private cb: TodoSidebarCallbacks) {
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

    this.list = document.createElement('ul');
    this.list.className = 'todo-list';

    this.root.appendChild(header);
    this.root.appendChild(this.list);
  }

  private submitAdd(): void {
    const text = this.input.value.trim();
    if (text.length === 0) return;
    this.cb.onAdd(text);
    this.input.value = '';
  }

  render(todos: readonly Todo[]): void {
    this.list.innerHTML = '';
    for (const t of todos) {
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

      const del = document.createElement('button');
      del.className = 'todo-delete';
      del.textContent = '×';
      del.addEventListener('click', () => this.cb.onDelete(t.id));

      li.appendChild(cb);
      li.appendChild(label);
      li.appendChild(del);
      this.list.appendChild(li);
    }
  }
}
