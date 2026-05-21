import type { Todo } from '../../domain/todo';
import type { GameState } from '../../domain/state';
import { supabase } from './client';
import {
  mergeSnapshots,
  purgeTombstones,
  type CloudTodo,
  type CloudPrefs,
  type SyncSnapshot,
} from './merge';

const TOMBSTONE_KEY = 'village-todo-tombstones';
const PREFS_UPDATED_KEY = 'village-prefs-updated-at';
const PUSH_DEBOUNCE_MS = 800;

/** Mode de fusion pour un pull. */
export type PullMode = 'normal' | 'login';

/** Dépendances fournies par main.ts pour lire/écrire le cache local. */
export type CloudSyncCallbacks = {
  readonly getLocalTodos: () => readonly Todo[];
  readonly getLocalGameState: () => GameState | null;
  readonly getLocalPrefs: () => CloudPrefs;
  readonly onTodosMerged: (todos: readonly Todo[]) => void;
  readonly onGameStateMerged: (state: GameState) => void;
  readonly onPrefsMerged: (prefs: CloudPrefs) => void;
};

/** API du moteur de sync exposée à main.ts. */
export type CloudSync = {
  readonly pullAndMerge: (mode: PullMode) => Promise<void>;
  readonly pushTodos: (todos: readonly Todo[]) => void;
  readonly pushTodoDelete: (id: string, now: number) => void;
  readonly pushGameState: (state: GameState) => void;
  readonly pushPrefs: (prefs: CloudPrefs) => void;
};

type TodoRow = {
  id: string;
  text: string;
  done: boolean;
  created_at: number;
  updated_at: number;
  deleted: boolean;
};

function loadTombstones(): CloudTodo[] {
  try {
    const raw = localStorage.getItem(TOMBSTONE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CloudTodo[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveTombstones(todos: readonly CloudTodo[]): void {
  try {
    localStorage.setItem(TOMBSTONE_KEY, JSON.stringify(todos));
  } catch (e) {
    console.warn('saveTombstones failed', e);
  }
}

function loadPrefsUpdatedAt(): number {
  const raw = localStorage.getItem(PREFS_UPDATED_KEY);
  const n = raw == null ? 0 : Number(raw);
  return Number.isFinite(n) ? n : 0;
}

function savePrefsUpdatedAt(at: number): void {
  try {
    localStorage.setItem(PREFS_UPDATED_KEY, String(at));
  } catch (e) {
    console.warn('savePrefsUpdatedAt failed', e);
  }
}

function rowToCloudTodo(r: TodoRow): CloudTodo {
  return {
    id: r.id,
    text: r.text,
    done: r.done,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    deleted: r.deleted,
  };
}

function cloudTodoToRow(t: CloudTodo): TodoRow {
  return {
    id: t.id,
    text: t.text,
    done: t.done,
    created_at: t.createdAt,
    updated_at: t.updatedAt,
    deleted: t.deleted,
  };
}

/**
 * Crée le moteur de sync. Si Supabase n'est pas configuré, toutes les
 * méthodes sont des no-op et pullAndMerge se résout immédiatement.
 */
export function createCloudSync(cb: CloudSyncCallbacks): CloudSync {
  const noop: CloudSync = {
    pullAndMerge: async () => {},
    pushTodos: () => {},
    pushTodoDelete: () => {},
    pushGameState: () => {},
    pushPrefs: () => {},
  };
  if (!supabase) return noop;
  const db = supabase;

  let pushTimer: ReturnType<typeof setTimeout> | null = null;
  let pendingTodos: CloudTodo[] = [];
  let pendingGameState: { state: GameState; updatedAt: number } | null = null;
  let pendingPrefs: { prefs: CloudPrefs; updatedAt: number } | null = null;

  function localSnapshot(): SyncSnapshot {
    const gs = cb.getLocalGameState();
    return {
      todos: [
        ...cb.getLocalTodos().map((t) => ({ ...t, deleted: false })),
        ...loadTombstones(),
      ],
      gameState: { value: gs, updatedAt: gs ? gs.lastSeenAt : 0 },
      prefs: { value: cb.getLocalPrefs(), updatedAt: loadPrefsUpdatedAt() },
    };
  }

  function applyMerged(merged: SyncSnapshot, now: number): void {
    const purged = purgeTombstones(merged.todos, now);
    const active: Todo[] = purged
      .filter((t) => !t.deleted)
      .map(({ deleted: _deleted, ...t }) => t);
    saveTombstones(purged.filter((t) => t.deleted));
    cb.onTodosMerged(active);
    if (merged.gameState.value) cb.onGameStateMerged(merged.gameState.value);
    cb.onPrefsMerged(merged.prefs.value);
    savePrefsUpdatedAt(merged.prefs.updatedAt);
  }

  async function pushSnapshot(snap: SyncSnapshot): Promise<void> {
    try {
      const rows = snap.todos.map(cloudTodoToRow);
      if (rows.length > 0) await db.from('todos').upsert(rows);
      if (snap.gameState.value) {
        await db.from('game_states').upsert({
          state: snap.gameState.value,
          updated_at: snap.gameState.updatedAt,
        });
      }
      await db.from('preferences').upsert({
        sort_mode: snap.prefs.value.sortMode,
        done_collapsed: snap.prefs.value.doneCollapsed,
        daily_goal: snap.prefs.value.dailyGoal,
        updated_at: snap.prefs.updatedAt,
      });
    } catch (e) {
      console.warn('cloud push failed', e);
    }
  }

  function scheduleFlush(): void {
    if (pushTimer) clearTimeout(pushTimer);
    pushTimer = setTimeout(() => {
      pushTimer = null;
      void flush();
    }, PUSH_DEBOUNCE_MS);
  }

  async function flush(): Promise<void> {
    const todos = pendingTodos;
    const gs = pendingGameState;
    const prefs = pendingPrefs;
    pendingTodos = [];
    pendingGameState = null;
    pendingPrefs = null;
    try {
      if (todos.length > 0) {
        await db.from('todos').upsert(todos.map(cloudTodoToRow));
      }
      if (gs) {
        await db
          .from('game_states')
          .upsert({ state: gs.state, updated_at: gs.updatedAt });
      }
      if (prefs) {
        await db.from('preferences').upsert({
          sort_mode: prefs.prefs.sortMode,
          done_collapsed: prefs.prefs.doneCollapsed,
          daily_goal: prefs.prefs.dailyGoal,
          updated_at: prefs.updatedAt,
        });
      }
    } catch (e) {
      console.warn('cloud flush failed', e);
    }
  }

  return {
    async pullAndMerge(mode: PullMode): Promise<void> {
      try {
        const [todosRes, gsRes, prefsRes] = await Promise.all([
          db.from('todos').select('*'),
          db.from('game_states').select('*').maybeSingle(),
          db.from('preferences').select('*').maybeSingle(),
        ]);
        const remoteGs = gsRes.data as { state: GameState; updated_at: number } | null;
        const remotePrefs = prefsRes.data as {
          sort_mode: CloudPrefs['sortMode'];
          done_collapsed: boolean;
          daily_goal: number;
          updated_at: number;
        } | null;
        const remote: SyncSnapshot = {
          todos: ((todosRes.data as TodoRow[] | null) ?? []).map(rowToCloudTodo),
          gameState: remoteGs
            ? { value: remoteGs.state, updatedAt: remoteGs.updated_at }
            : { value: null, updatedAt: 0 },
          prefs: remotePrefs
            ? {
                value: {
                  sortMode: remotePrefs.sort_mode,
                  doneCollapsed: remotePrefs.done_collapsed,
                  dailyGoal: remotePrefs.daily_goal,
                },
                updatedAt: remotePrefs.updated_at,
              }
            : { value: cb.getLocalPrefs(), updatedAt: 0 },
        };
        const now = Date.now();
        const merged = mergeSnapshots(localSnapshot(), remote, mode);
        applyMerged(merged, now);
        await pushSnapshot(merged);
      } catch (e) {
        console.warn('cloud pull failed', e);
      }
    },

    pushTodos(todos: readonly Todo[]): void {
      const byId = new Map(pendingTodos.map((t) => [t.id, t]));
      for (const t of todos) byId.set(t.id, { ...t, deleted: false });
      pendingTodos = [...byId.values()];
      scheduleFlush();
    },

    pushTodoDelete(id: string, now: number): void {
      const tombstone: CloudTodo = {
        id,
        text: '',
        done: false,
        createdAt: now,
        updatedAt: now,
        deleted: true,
      };
      saveTombstones([
        ...loadTombstones().filter((t) => t.id !== id),
        tombstone,
      ]);
      const byId = new Map(pendingTodos.map((t) => [t.id, t]));
      byId.set(id, tombstone);
      pendingTodos = [...byId.values()];
      scheduleFlush();
    },

    pushGameState(state: GameState): void {
      pendingGameState = { state, updatedAt: state.lastSeenAt };
      scheduleFlush();
    },

    pushPrefs(prefs: CloudPrefs): void {
      const updatedAt = Date.now();
      pendingPrefs = { prefs, updatedAt };
      savePrefsUpdatedAt(updatedAt);
      scheduleFlush();
    },
  };
}
