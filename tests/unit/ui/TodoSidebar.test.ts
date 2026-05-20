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
