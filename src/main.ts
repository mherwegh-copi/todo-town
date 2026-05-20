import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { WorldScene } from './scenes/WorldScene';
import { UIScene } from './scenes/UIScene';
import { TodoSidebar } from './ui/TodoSidebar';
import { SidebarClock } from './ui/SidebarClock';
import {
  loadTodos,
  saveTodos,
  addTodo,
  toggleTodo,
  updateTodoText,
  deleteTodo,
  loadSortMode,
  saveSortMode,
  loadDoneCollapsed,
  saveDoneCollapsed,
} from './systems/todoStore';
import { newTodo } from './domain/todo';
import type { Todo } from './domain/todo';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game',
  pixelArt: true,
  backgroundColor: '#1a1a1a',
  scale: { mode: Phaser.Scale.RESIZE, autoCenter: Phaser.Scale.CENTER_BOTH, parent: 'game' },
  scene: [BootScene, WorldScene, UIScene],
};

const game = new Phaser.Game(config);

document.addEventListener('visibilitychange', () => {
  if (document.hidden) game.loop.sleep();
  else game.loop.wake();
});

function bumpMotivation(delta: number): void {
  const world = game.scene.getScene('WorldScene') as WorldScene | null;
  if (!world || !world.scene.isActive()) {
    console.warn('bumpMotivation: WorldScene not ready, skipping');
    return;
  }
  world.bumpMotivation(delta);
}

function emitTodoCompleted(): void {
  const world = game.scene.getScene('WorldScene') as WorldScene | null;
  if (world) world.events.emit('todo-completed');
}

const clockMount = document.getElementById('clock-mount')!;
new SidebarClock(clockMount, () => {
  const world = game.scene.getScene('WorldScene') as WorldScene | null;
  if (!world || !world.scene.isActive()) return null;
  return world.getState().createdAt;
});

const pane = document.getElementById('todo-pane')!;
let todos: readonly Todo[] = loadTodos();
const sidebar = new TodoSidebar(
  pane,
  {
    onAdd: (text) => {
      todos = addTodo(todos, newTodo(text, Date.now()));
      saveTodos(todos);
      sidebar.render(todos);
    },
    onToggle: (id) => {
      const result = toggleTodo(todos, id, Date.now());
      todos = result.todos;
      saveTodos(todos);
      sidebar.render(todos);
      if (result.toggled) {
        if (result.toggled.to === true) {
          bumpMotivation(+1);
          emitTodoCompleted();
        } else {
          bumpMotivation(-1);
        }
      }
    },
    onEdit: (id, text) => {
      todos = updateTodoText(todos, id, text, Date.now());
      saveTodos(todos);
      sidebar.render(todos);
    },
    onDelete: (id) => {
      todos = deleteTodo(todos, id);
      saveTodos(todos);
      sidebar.render(todos);
    },
    onSortChange: (mode) => {
      saveSortMode(mode);
      sidebar.render(todos);
    },
    onCollapseChange: (collapsed) => {
      saveDoneCollapsed(collapsed);
    },
  },
  loadSortMode(),
  loadDoneCollapsed(),
);
sidebar.render(todos);
