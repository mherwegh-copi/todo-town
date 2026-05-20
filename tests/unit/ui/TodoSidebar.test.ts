import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TodoSidebar } from '../../../src/ui/TodoSidebar';
import { newTodo } from '../../../src/domain/todo';

function makeContainer(): HTMLElement {
  const el = document.createElement('div');
  document.body.appendChild(el);
  return el;
}

describe('TodoSidebar render', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('renders empty list with input and add button', () => {
    const sb = new TodoSidebar(makeContainer(), {
      onAdd: vi.fn(),
      onToggle: vi.fn(),
      onEdit: vi.fn(),
      onDelete: vi.fn(),
    });
    sb.render([]);
    expect(document.querySelector('.todo-sidebar input.todo-input')).not.toBeNull();
    expect(document.querySelector('.todo-sidebar button.todo-add')).not.toBeNull();
    expect(document.querySelectorAll('.todo-sidebar .todo-item').length).toBe(0);
  });

  it('renders one item per todo, marks done', () => {
    const sb = new TodoSidebar(makeContainer(), {
      onAdd: vi.fn(),
      onToggle: vi.fn(),
      onEdit: vi.fn(),
      onDelete: vi.fn(),
    });
    const a = newTodo('a', 1);
    const b = { ...newTodo('b', 2), done: true };
    sb.render([a, b]);
    const items = document.querySelectorAll('.todo-sidebar .todo-item');
    expect(items.length).toBe(2);
    expect(items[1]!.classList.contains('done')).toBe(true);
  });

  it('onAdd called when add button clicked with input value', () => {
    const onAdd = vi.fn();
    const sb = new TodoSidebar(makeContainer(), {
      onAdd,
      onToggle: vi.fn(),
      onEdit: vi.fn(),
      onDelete: vi.fn(),
    });
    sb.render([]);
    const input = document.querySelector<HTMLInputElement>('.todo-sidebar input.todo-input')!;
    input.value = 'hello';
    document.querySelector<HTMLButtonElement>('.todo-sidebar button.todo-add')!.click();
    expect(onAdd).toHaveBeenCalledWith('hello');
  });

  it('onAdd not called when input empty', () => {
    const onAdd = vi.fn();
    const sb = new TodoSidebar(makeContainer(), {
      onAdd,
      onToggle: vi.fn(),
      onEdit: vi.fn(),
      onDelete: vi.fn(),
    });
    sb.render([]);
    document.querySelector<HTMLButtonElement>('.todo-sidebar button.todo-add')!.click();
    expect(onAdd).not.toHaveBeenCalled();
  });

  it('onDelete called with id when × clicked', () => {
    const onDelete = vi.fn();
    const sb = new TodoSidebar(makeContainer(), {
      onAdd: vi.fn(),
      onToggle: vi.fn(),
      onEdit: vi.fn(),
      onDelete,
    });
    const a = newTodo('a', 1);
    sb.render([a]);
    document.querySelector<HTMLButtonElement>('.todo-sidebar .todo-delete')!.click();
    expect(onDelete).toHaveBeenCalledWith(a.id);
  });
});

describe('TodoSidebar toggle + edit', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('onToggle called with id when checkbox changes', () => {
    const onToggle = vi.fn();
    const sb = new TodoSidebar(makeContainer(), {
      onAdd: vi.fn(),
      onToggle,
      onEdit: vi.fn(),
      onDelete: vi.fn(),
    });
    const a = newTodo('a', 1);
    sb.render([a]);
    const cb = document.querySelector<HTMLInputElement>('.todo-sidebar .todo-check')!;
    cb.checked = true;
    cb.dispatchEvent(new Event('change'));
    expect(onToggle).toHaveBeenCalledWith(a.id);
  });

  it('double-click label swaps to input; Enter calls onEdit with new text', () => {
    const onEdit = vi.fn();
    const sb = new TodoSidebar(makeContainer(), {
      onAdd: vi.fn(),
      onToggle: vi.fn(),
      onEdit,
      onDelete: vi.fn(),
    });
    const a = newTodo('a', 1);
    sb.render([a]);
    const label = document.querySelector<HTMLSpanElement>('.todo-sidebar .todo-label')!;
    label.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    const editInput = document.querySelector<HTMLInputElement>('.todo-sidebar .todo-edit')!;
    expect(editInput).not.toBeNull();
    editInput.value = 'updated';
    editInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(onEdit).toHaveBeenCalledWith(a.id, 'updated');
  });

  it('Escape cancels edit without calling onEdit', () => {
    const onEdit = vi.fn();
    const sb = new TodoSidebar(makeContainer(), {
      onAdd: vi.fn(),
      onToggle: vi.fn(),
      onEdit,
      onDelete: vi.fn(),
    });
    const a = newTodo('a', 1);
    sb.render([a]);
    document.querySelector<HTMLSpanElement>('.todo-sidebar .todo-label')!
      .dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    const editInput = document.querySelector<HTMLInputElement>('.todo-sidebar .todo-edit')!;
    editInput.value = 'updated';
    editInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(onEdit).not.toHaveBeenCalled();
  });
});

describe('TodoSidebar sort + done section', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('renders a sort select with three options', () => {
    const sb = new TodoSidebar(makeContainer(), {
      onAdd: vi.fn(),
      onToggle: vi.fn(),
      onEdit: vi.fn(),
      onDelete: vi.fn(),
    });
    sb.render([]);
    const select = document.querySelector<HTMLSelectElement>('.todo-sidebar select.todo-sort')!;
    expect(select).not.toBeNull();
    expect(select.querySelectorAll('option').length).toBe(3);
  });

  it('select reflects the initial sort mode passed to constructor', () => {
    const sb = new TodoSidebar(
      makeContainer(),
      { onAdd: vi.fn(), onToggle: vi.fn(), onEdit: vi.fn(), onDelete: vi.fn() },
      'alpha',
    );
    sb.render([]);
    expect(document.querySelector<HTMLSelectElement>('.todo-sort')!.value).toBe('alpha');
  });

  it('onSortChange called when select changes', () => {
    const onSortChange = vi.fn();
    const sb = new TodoSidebar(makeContainer(), {
      onAdd: vi.fn(),
      onToggle: vi.fn(),
      onEdit: vi.fn(),
      onDelete: vi.fn(),
      onSortChange,
    });
    sb.render([]);
    const select = document.querySelector<HTMLSelectElement>('.todo-sort')!;
    select.value = 'modified';
    select.dispatchEvent(new Event('change'));
    expect(onSortChange).toHaveBeenCalledWith('modified');
  });

  it('active todos sorted by alpha when mode is alpha', () => {
    const sb = new TodoSidebar(
      makeContainer(),
      { onAdd: vi.fn(), onToggle: vi.fn(), onEdit: vi.fn(), onDelete: vi.fn() },
      'alpha',
    );
    sb.render([newTodo('banana', 1), newTodo('apple', 2)]);
    const labels = [...document.querySelectorAll('.todo-list .todo-label')].map(
      (el) => el.textContent,
    );
    expect(labels).toEqual(['apple', 'banana']);
  });

  it('done todos go into the done section with a count header', () => {
    const sb = new TodoSidebar(makeContainer(), {
      onAdd: vi.fn(),
      onToggle: vi.fn(),
      onEdit: vi.fn(),
      onDelete: vi.fn(),
    });
    const active = newTodo('todo', 1);
    const done = { ...newTodo('finished', 2), done: true };
    sb.render([active, done]);
    expect(document.querySelectorAll('.todo-done-list .todo-item').length).toBe(1);
    expect(document.querySelector('.todo-section-header')!.textContent).toContain('(1)');
  });

  it('clicking the done header toggles collapsed and calls onCollapseChange', () => {
    const onCollapseChange = vi.fn();
    const sb = new TodoSidebar(makeContainer(), {
      onAdd: vi.fn(),
      onToggle: vi.fn(),
      onEdit: vi.fn(),
      onDelete: vi.fn(),
      onCollapseChange,
    });
    sb.render([]);
    const section = document.querySelector('.todo-section')!;
    expect(section.classList.contains('collapsed')).toBe(false);
    document.querySelector<HTMLDivElement>('.todo-section-header')!.click();
    expect(section.classList.contains('collapsed')).toBe(true);
    expect(onCollapseChange).toHaveBeenCalledWith(true);
  });

  it('starts collapsed when initialCollapsed is true', () => {
    const sb = new TodoSidebar(
      makeContainer(),
      { onAdd: vi.fn(), onToggle: vi.fn(), onEdit: vi.fn(), onDelete: vi.fn() },
      'created',
      true,
    );
    sb.render([]);
    expect(document.querySelector('.todo-section')!.classList.contains('collapsed')).toBe(true);
  });
});
