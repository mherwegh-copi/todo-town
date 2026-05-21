import { describe, it, expect } from 'vitest';
import {
  mergeTodos,
  mergeStamped,
  purgeTombstones,
  mergeSnapshots,
  TOMBSTONE_TTL_MS,
  type CloudTodo,
  type Stamped,
  type SyncSnapshot,
} from '../../../../src/systems/cloud/merge';
import type { GameState } from '../../../../src/domain/state';

function todo(id: string, updatedAt: number, over: Partial<CloudTodo> = {}): CloudTodo {
  return { id, text: id, done: false, createdAt: 1, updatedAt, deleted: false, ...over };
}

describe('mergeTodos', () => {
  it('garde un id présent d\'un seul côté', () => {
    const out = mergeTodos([todo('a', 10)], [todo('b', 20)]);
    expect(out.map((t) => t.id).sort()).toEqual(['a', 'b']);
  });

  it('garde la version au updatedAt le plus grand pour un id partagé', () => {
    const out = mergeTodos([todo('a', 10, { text: 'vieux' })], [todo('a', 20, { text: 'neuf' })]);
    expect(out).toHaveLength(1);
    expect(out[0]!.text).toBe('neuf');
  });

  it('un tombstone plus récent gagne sur une version active', () => {
    const out = mergeTodos([todo('a', 10)], [todo('a', 20, { deleted: true })]);
    expect(out[0]!.deleted).toBe(true);
  });

  it('une version active plus récente gagne sur un tombstone', () => {
    const out = mergeTodos([todo('a', 30)], [todo('a', 20, { deleted: true })]);
    expect(out[0]!.deleted).toBe(false);
  });

  it('en cas d\'égalité de updatedAt, le remote gagne', () => {
    const out = mergeTodos([todo('a', 10, { text: 'local' })], [todo('a', 10, { text: 'remote' })]);
    expect(out[0]!.text).toBe('remote');
  });
});

describe('mergeStamped', () => {
  const a: Stamped<string> = { value: 'local', updatedAt: 10 };
  const b: Stamped<string> = { value: 'remote', updatedAt: 20 };

  it('garde la valeur au updatedAt le plus grand', () => {
    expect(mergeStamped(a, b).value).toBe('remote');
    expect(mergeStamped(b, a).value).toBe('remote');
  });

  it('en cas d\'égalité, le remote gagne', () => {
    const localTie: Stamped<string> = { value: 'local', updatedAt: 10 };
    const remoteTie: Stamped<string> = { value: 'remote', updatedAt: 10 };
    expect(mergeStamped(localTie, remoteTie).value).toBe('remote');
  });
});

describe('purgeTombstones', () => {
  const now = 1_000_000_000_000;

  it('droppe les tombstones plus vieux que la TTL', () => {
    const old: CloudTodo = todo('a', now - TOMBSTONE_TTL_MS - 1, { deleted: true });
    expect(purgeTombstones([old], now)).toEqual([]);
  });

  it('garde les tombstones récents', () => {
    const fresh: CloudTodo = todo('a', now - 1000, { deleted: true });
    expect(purgeTombstones([fresh], now)).toHaveLength(1);
  });

  it('ne droppe jamais un todo actif, même ancien', () => {
    const oldActive: CloudTodo = todo('a', now - TOMBSTONE_TTL_MS - 1, { deleted: false });
    expect(purgeTombstones([oldActive], now)).toHaveLength(1);
  });
});

describe('mergeSnapshots', () => {
  const localGs = { lastSeenAt: 1 } as GameState;
  const remoteGs = { lastSeenAt: 2 } as GameState;

  function snap(
    todos: readonly CloudTodo[],
    gs: GameState | null,
    gsAt: number,
  ): SyncSnapshot {
    return {
      todos,
      gameState: { value: gs, updatedAt: gsAt },
      prefs: {
        value: { sortMode: 'created', doneCollapsed: false, dailyGoal: 5 },
        updatedAt: 0,
      },
    };
  }

  it('mode normal : fusionne les todos et applique le LWW sur l\'état du jeu', () => {
    const local = snap([todo('a', 10)], localGs, 10);
    const remote = snap([todo('b', 20)], remoteGs, 20);
    const out = mergeSnapshots(local, remote, 'normal');
    expect(out.todos.map((t) => t.id).sort()).toEqual(['a', 'b']);
    expect(out.gameState.value).toBe(remoteGs);
  });

  it('mode login : todos fusionnés mais état du jeu cloud forcé', () => {
    // Local plus récent que remote : en mode login, remote gagne quand même.
    const local = snap([todo('a', 99)], localGs, 99);
    const remote = snap([todo('b', 1)], remoteGs, 1);
    const out = mergeSnapshots(local, remote, 'login');
    expect(out.todos.map((t) => t.id).sort()).toEqual(['a', 'b']);
    expect(out.gameState.value).toBe(remoteGs);
  });
});
