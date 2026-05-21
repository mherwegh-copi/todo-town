import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { WorldScene } from './scenes/WorldScene';
import { UIScene } from './scenes/UIScene';
import { TodoSidebar } from './ui/TodoSidebar';
import { SidebarClock } from './ui/SidebarClock';
import { DailyStats } from './ui/DailyStats';
import { AccountBar } from './ui/AccountBar';
import { AccountModal } from './ui/AccountModal';
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
  loadDailyGoal,
  saveDailyGoal,
} from './systems/todoStore';
import { newTodo } from './domain/todo';
import type { Todo } from './domain/todo';
import type { GameState } from './domain/state';
import { setSaveListener } from './systems/save';
import { createCloudSync } from './systems/cloud/sync';
import type { CloudPrefs } from './systems/cloud/merge';
import {
  ensureSession,
  upgradeAccount,
  login,
  logout,
  changePassword,
  deleteAccount,
} from './systems/cloud/auth';
import type { AuthState } from './systems/cloud/auth';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game',
  pixelArt: true,
  backgroundColor: '#1a1a1a',
  scale: { mode: Phaser.Scale.RESIZE, autoCenter: Phaser.Scale.CENTER_BOTH, parent: 'game' },
  scene: [BootScene, WorldScene, UIScene],
};

const game = new Phaser.Game(config);

function getWorld(): WorldScene | null {
  const world = game.scene.getScene('WorldScene') as WorldScene | null;
  return world && world.scene.isActive() ? world : null;
}

function bumpMotivation(delta: number): void {
  const world = getWorld();
  if (!world) {
    console.warn('bumpMotivation: WorldScene not ready, skipping');
    return;
  }
  world.bumpMotivation(delta);
}

function emitTodoCompleted(): void {
  const world = getWorld();
  if (world) world.events.emit('todo-completed');
}

const clockMount = document.getElementById('clock-mount')!;
new SidebarClock(clockMount, () => {
  const world = getWorld();
  return world ? world.getState().createdAt : null;
});

const pane = document.getElementById('todo-pane')!;
const accountMount = document.getElementById('account-mount')!;
const modalMount = document.getElementById('modal-mount')!;
let todos: readonly Todo[] = loadTodos();
let dailyGoal = loadDailyGoal();
let sortMode = loadSortMode();
let doneCollapsed = loadDoneCollapsed();

function currentPrefs(): CloudPrefs {
  return { sortMode, doneCollapsed, dailyGoal };
}

const stats = new DailyStats(
  clockMount,
  () => todos,
  () => dailyGoal,
  (n) => {
    dailyGoal = n;
    saveDailyGoal(n);
    stats.render();
    cloud.pushPrefs(currentPrefs());
  },
);

const cloud = createCloudSync({
  getLocalTodos: () => todos,
  getLocalGameState: () => getWorld()?.getState() ?? null,
  getLocalPrefs: currentPrefs,
  onTodosMerged: (merged) => {
    todos = merged;
    saveTodos(todos);
    sidebar.render(todos);
    stats.render();
  },
  onGameStateMerged: (state: GameState) => {
    getWorld()?.refresh(state);
  },
  onPrefsMerged: (prefs) => {
    sortMode = prefs.sortMode;
    doneCollapsed = prefs.doneCollapsed;
    dailyGoal = prefs.dailyGoal;
    saveSortMode(sortMode);
    saveDoneCollapsed(doneCollapsed);
    saveDailyGoal(dailyGoal);
    sidebar.setPrefs(sortMode, doneCollapsed);
    sidebar.render(todos);
    stats.render();
  },
});

const sidebar = new TodoSidebar(
  pane,
  {
    onAdd: (text) => {
      todos = addTodo(todos, newTodo(text, Date.now()));
      saveTodos(todos);
      sidebar.render(todos);
      stats.render();
      cloud.pushTodos(todos);
    },
    onToggle: (id) => {
      const result = toggleTodo(todos, id, Date.now());
      todos = result.todos;
      saveTodos(todos);
      sidebar.render(todos);
      stats.render();
      cloud.pushTodos(todos);
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
      stats.render();
      cloud.pushTodos(todos);
    },
    onDelete: (id) => {
      todos = deleteTodo(todos, id);
      saveTodos(todos);
      sidebar.render(todos);
      stats.render();
      cloud.pushTodoDelete(id, Date.now());
    },
    onSortChange: (mode) => {
      sortMode = mode;
      saveSortMode(mode);
      sidebar.render(todos);
      cloud.pushPrefs(currentPrefs());
    },
    onCollapseChange: (collapsed) => {
      doneCollapsed = collapsed;
      saveDoneCollapsed(collapsed);
      cloud.pushPrefs(currentPrefs());
    },
  },
  sortMode,
  doneCollapsed,
);
sidebar.render(todos);

let authState: AuthState = { kind: 'disabled' };

const accountModal = new AccountModal(modalMount, {
  onChangePassword: (newPassword) => changePassword(newPassword),
  onDeleteAccount: async () => {
    await deleteAccount();
    applyAuth(await logout());
    await cloud.pullAndMerge('normal');
  },
  getSyncStatus: () => cloud.getStatus(),
});

const accountBar = new AccountBar(accountMount, {
  onUpgrade: async (email, password) => {
    applyAuth(await upgradeAccount(email, password));
  },
  onLogin: async (email, password) => {
    applyAuth(await login(email, password));
    await cloud.pullAndMerge('login');
  },
  onLogout: async () => {
    applyAuth(await logout());
    await cloud.pullAndMerge('normal');
  },
  onOpenAccount: () => {
    if (authState.kind === 'permanent') accountModal.open(authState.email);
  },
});

/** Mémorise l'état d'auth courant et le propage à la barre compte. */
function applyAuth(auth: AuthState): void {
  authState = auth;
  accountBar.setAuth(auth);
}

// Pousse l'état du jeu vers le cloud à chaque sauvegarde de WorldScene.
setSaveListener((state) => cloud.pushGameState(state));

// Sync initiale : session anonyme garantie, puis pull/merge.
void (async () => {
  applyAuth(await ensureSession());
  await cloud.pullAndMerge('normal');
})();

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    game.loop.sleep();
  } else {
    game.loop.wake();
    void cloud.pullAndMerge('normal');
  }
});
