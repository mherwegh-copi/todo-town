# Supabase Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrer la persistance de l'app de `localStorage` vers Supabase, avec compte anonyme upgradable vers un compte email, en synchronisant todos / état du jeu / préférences entre appareils tout en restant utilisable hors-ligne.

**Architecture :** Local-first. `localStorage` reste la source locale immédiate ; un nouveau module `src/systems/cloud/` se branche par-dessus pour tirer/pousser vers Supabase. Le cœur de fusion (`merge.ts`) est constitué de fonctions pures testées en TDD ; l'I/O réseau (`client.ts`, `auth.ts`, `sync.ts`) est isolée derrière. Si les variables d'environnement Supabase sont absentes, le module devient un no-op et l'app tourne 100 % offline comme aujourd'hui.

**Tech Stack :** TypeScript, Vite, Vitest, Phaser 4, `@supabase/supabase-js`, Supabase (Postgres + Auth + RLS).

**Spec :** `docs/superpowers/specs/2026-05-20-supabase-sync-design.md`

---

## File Structure

| Fichier | Responsabilité |
|---|---|
| `supabase/schema.sql` | DDL des 3 tables + policies RLS (appliqué manuellement dans Supabase) |
| `.env.example` | Modèle des variables d'environnement |
| `src/systems/cloud/client.ts` | Instance `@supabase/supabase-js` ou `null` si non configuré |
| `src/systems/cloud/merge.ts` | Fonctions de fusion **pures** (LWW, tombstones) |
| `src/systems/cloud/auth.ts` | Session anonyme, upgrade, login, logout |
| `src/systems/cloud/sync.ts` | Moteur pull/push, mapping DB ↔ domaine |
| `src/ui/AccountBar.ts` | Barre compte en bas de la sidebar |
| `src/systems/save.ts` | + hook listener pour notifier le cloud d'un `saveState` |
| `src/ui/TodoSidebar.ts` | + méthode `setPrefs` pour appliquer tri/collapse après une fusion |
| `index.html` | + `<div id="account-mount">` et styles `.account-bar` |
| `src/main.ts` | Câblage : instanciation cloud, push sur mutations, pull au focus |
| `tests/unit/systems/cloud/merge.test.ts` | Tests des fonctions de fusion |

---

## Task 1: Dépendance Supabase & fichiers d'environnement

**Files:**
- Modify: `package.json` (via npm)
- Create: `.env.example`
- Modify: `.gitignore`

- [ ] **Step 1: Installer `@supabase/supabase-js`**

Run: `npm install @supabase/supabase-js`
Expected: ajoute la dépendance dans `package.json` et `package-lock.json`, exit 0.

- [ ] **Step 2: Créer `.env.example`**

Créer `.env.example` :

```
# Supabase — laisser vide pour faire tourner l'app 100% offline (le cloud devient no-op).
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

- [ ] **Step 3: Ignorer les fichiers `.env` réels**

Ajouter à la fin de `.gitignore` :

```
.env
.env.local
```

- [ ] **Step 4: Vérifier que le build passe encore**

Run: `npm run build`
Expected: PASS (aucun code ne référence encore Supabase).

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json .env.example .gitignore
git commit -m "chore(todo): add supabase-js dependency and env scaffolding"
```

---

## Task 2: Schéma Supabase

**Files:**
- Create: `supabase/schema.sql`

- [ ] **Step 1: Écrire le DDL des tables + RLS**

Créer `supabase/schema.sql` :

```sql
-- Schéma Supabase pour todo-town. À exécuter dans le SQL Editor du projet Supabase.
-- L'authentification anonyme doit être activée : Authentication > Providers > Anonymous.

create table if not exists public.todos (
  id text primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  text text not null,
  done boolean not null default false,
  created_at bigint not null,
  updated_at bigint not null,
  deleted boolean not null default false
);
alter table public.todos enable row level security;
create policy "todos owner access" on public.todos
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create table if not exists public.game_states (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  state jsonb not null,
  updated_at bigint not null
);
alter table public.game_states enable row level security;
create policy "game_states owner access" on public.game_states
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create table if not exists public.preferences (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  sort_mode text not null,
  done_collapsed boolean not null default false,
  daily_goal integer not null,
  updated_at bigint not null
);
alter table public.preferences enable row level security;
create policy "preferences owner access" on public.preferences
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
```

- [ ] **Step 2: Commit**

```bash
git add supabase/schema.sql
git commit -m "feat(todo): supabase schema with RLS for todos, game state, prefs"
```

> **Note d'exécution (manuelle, hors plan code) :** créer un projet Supabase, exécuter ce SQL dans le SQL Editor, activer le provider Anonymous, puis renseigner `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` dans un fichier `.env` local. Sans cela, l'app reste en mode offline (attendu).

---

## Task 3: `merge.ts` — types & `mergeTodos`

**Files:**
- Create: `src/systems/cloud/merge.ts`
- Test: `tests/unit/systems/cloud/merge.test.ts`

- [ ] **Step 1: Écrire le test qui échoue**

Créer `tests/unit/systems/cloud/merge.test.ts` :

```ts
import { describe, it, expect } from 'vitest';
import { mergeTodos, type CloudTodo } from '../../../../src/systems/cloud/merge';

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
```

- [ ] **Step 2: Lancer le test pour le voir échouer**

Run: `npm run test:run -- merge`
Expected: FAIL — `Cannot find module '.../cloud/merge'`.

- [ ] **Step 3: Implémentation minimale**

Créer `src/systems/cloud/merge.ts` :

```ts
import type { Todo } from '../../domain/todo';
import type { GameState } from '../../domain/state';
import type { SortMode } from '../todoSort';

/** Un todo côté cloud : un todo du domaine + un drapeau tombstone. */
export type CloudTodo = Todo & { readonly deleted: boolean };

/** Préférences UI synchronisées. */
export type CloudPrefs = {
  readonly sortMode: SortMode;
  readonly doneCollapsed: boolean;
  readonly dailyGoal: number;
};

/** Une valeur accompagnée de son horodatage de dernière écriture (ms epoch). */
export type Stamped<T> = { readonly value: T; readonly updatedAt: number };

/** Photo complète de l'état synchronisable, local ou distant. */
export type SyncSnapshot = {
  readonly todos: readonly CloudTodo[];
  readonly gameState: Stamped<GameState | null>;
  readonly prefs: Stamped<CloudPrefs>;
};

/** Durée de vie d'un tombstone dans le cache local (30 jours). */
export const TOMBSTONE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Fusionne deux listes de todos par id, last-write-wins sur updatedAt.
 * En cas d'égalité, la version remote gagne (le cloud fait autorité).
 */
export function mergeTodos(
  local: readonly CloudTodo[],
  remote: readonly CloudTodo[],
): readonly CloudTodo[] {
  const byId = new Map<string, CloudTodo>();
  for (const t of local) byId.set(t.id, t);
  for (const t of remote) {
    const existing = byId.get(t.id);
    if (!existing || t.updatedAt >= existing.updatedAt) byId.set(t.id, t);
  }
  return [...byId.values()];
}
```

- [ ] **Step 4: Lancer le test pour le voir passer**

Run: `npm run test:run -- merge`
Expected: PASS — 5 tests verts.

- [ ] **Step 5: Commit**

```bash
git add src/systems/cloud/merge.ts tests/unit/systems/cloud/merge.test.ts
git commit -m "feat(todo): mergeTodos with last-write-wins and tombstones"
```

---

## Task 4: `merge.ts` — `mergeStamped`

**Files:**
- Modify: `src/systems/cloud/merge.ts`
- Test: `tests/unit/systems/cloud/merge.test.ts`

- [ ] **Step 1: Ajouter le test qui échoue**

Ajouter dans `tests/unit/systems/cloud/merge.test.ts` (après l'import existant, compléter l'import) :

```ts
import {
  mergeTodos,
  mergeStamped,
  type CloudTodo,
  type Stamped,
} from '../../../../src/systems/cloud/merge';
```

Puis ajouter ce bloc `describe` :

```ts
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
```

- [ ] **Step 2: Lancer le test pour le voir échouer**

Run: `npm run test:run -- merge`
Expected: FAIL — `mergeStamped is not exported` / `is not a function`.

- [ ] **Step 3: Implémentation**

Ajouter dans `src/systems/cloud/merge.ts` :

```ts
/** Last-write-wins sur une valeur horodatée. Égalité → remote gagne. */
export function mergeStamped<T>(
  local: Stamped<T>,
  remote: Stamped<T>,
): Stamped<T> {
  return remote.updatedAt >= local.updatedAt ? remote : local;
}
```

- [ ] **Step 4: Lancer le test pour le voir passer**

Run: `npm run test:run -- merge`
Expected: PASS — tous les tests verts.

- [ ] **Step 5: Commit**

```bash
git add src/systems/cloud/merge.ts tests/unit/systems/cloud/merge.test.ts
git commit -m "feat(todo): mergeStamped last-write-wins helper"
```

---

## Task 5: `merge.ts` — `purgeTombstones`

**Files:**
- Modify: `src/systems/cloud/merge.ts`
- Test: `tests/unit/systems/cloud/merge.test.ts`

- [ ] **Step 1: Ajouter le test qui échoue**

Compléter l'import de `tests/unit/systems/cloud/merge.test.ts` :

```ts
import {
  mergeTodos,
  mergeStamped,
  purgeTombstones,
  TOMBSTONE_TTL_MS,
  type CloudTodo,
  type Stamped,
} from '../../../../src/systems/cloud/merge';
```

Ajouter ce bloc `describe` :

```ts
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
```

- [ ] **Step 2: Lancer le test pour le voir échouer**

Run: `npm run test:run -- merge`
Expected: FAIL — `purgeTombstones is not a function`.

- [ ] **Step 3: Implémentation**

Ajouter dans `src/systems/cloud/merge.ts` :

```ts
/** Retire du cache local les tombstones plus vieux que TOMBSTONE_TTL_MS. */
export function purgeTombstones(
  todos: readonly CloudTodo[],
  now: number,
): readonly CloudTodo[] {
  return todos.filter(
    (t) => !t.deleted || now - t.updatedAt <= TOMBSTONE_TTL_MS,
  );
}
```

- [ ] **Step 4: Lancer le test pour le voir passer**

Run: `npm run test:run -- merge`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/systems/cloud/merge.ts tests/unit/systems/cloud/merge.test.ts
git commit -m "feat(todo): purgeTombstones drops expired deleted todos"
```

---

## Task 6: `merge.ts` — `mergeSnapshots`

**Files:**
- Modify: `src/systems/cloud/merge.ts`
- Test: `tests/unit/systems/cloud/merge.test.ts`

- [ ] **Step 1: Ajouter le test qui échoue**

Compléter l'import de `tests/unit/systems/cloud/merge.test.ts` :

```ts
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
```

Ajouter ce bloc `describe` :

```ts
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
```

- [ ] **Step 2: Lancer le test pour le voir échouer**

Run: `npm run test:run -- merge`
Expected: FAIL — `mergeSnapshots is not a function`.

- [ ] **Step 3: Implémentation**

Ajouter dans `src/systems/cloud/merge.ts` :

```ts
/**
 * Fusionne une photo locale et une photo distante.
 * - mode 'normal' : LWW partout.
 * - mode 'login' (connexion depuis un nouvel appareil) : todos fusionnés,
 *   mais l'état du jeu distant est forcé (un village ne se fusionne pas).
 */
export function mergeSnapshots(
  local: SyncSnapshot,
  remote: SyncSnapshot,
  mode: 'normal' | 'login',
): SyncSnapshot {
  return {
    todos: mergeTodos(local.todos, remote.todos),
    gameState:
      mode === 'login'
        ? remote.gameState
        : mergeStamped(local.gameState, remote.gameState),
    prefs: mergeStamped(local.prefs, remote.prefs),
  };
}
```

- [ ] **Step 4: Lancer le test pour le voir passer**

Run: `npm run test:run -- merge`
Expected: PASS — tous les tests du fichier verts.

- [ ] **Step 5: Vérifier lint + build**

Run: `npm run lint && npm run build`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/systems/cloud/merge.ts tests/unit/systems/cloud/merge.test.ts
git commit -m "feat(todo): mergeSnapshots orchestrator with login mode"
```

---

## Task 7: `client.ts` — instance Supabase

**Files:**
- Create: `src/systems/cloud/client.ts`

- [ ] **Step 1: Écrire le client**

Créer `src/systems/cloud/client.ts` :

```ts
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/**
 * Instance Supabase, ou null si les variables d'environnement sont absentes.
 * Quand c'est null, tout le module cloud devient un no-op et l'app reste
 * pleinement utilisable hors-ligne sur localStorage.
 */
export const supabase: SupabaseClient | null =
  url && anonKey ? createClient(url, anonKey) : null;
```

- [ ] **Step 2: Vérifier build + lint**

Run: `npm run build && npm run lint`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/systems/cloud/client.ts
git commit -m "feat(todo): supabase client with offline-safe null fallback"
```

---

## Task 8: `auth.ts` — gestion de session

**Files:**
- Create: `src/systems/cloud/auth.ts`

- [ ] **Step 1: Écrire le module d'auth**

Créer `src/systems/cloud/auth.ts` :

```ts
import { supabase } from './client';

/** État d'authentification observable par l'UI. */
export type AuthState =
  | { readonly kind: 'disabled' }
  | { readonly kind: 'anonymous'; readonly userId: string }
  | { readonly kind: 'permanent'; readonly userId: string; readonly email: string };

const DISABLED: AuthState = { kind: 'disabled' };

function toAuthState(
  user: { id: string; email?: string | null; is_anonymous?: boolean } | null,
): AuthState {
  if (!user) return DISABLED;
  if (user.email && user.is_anonymous !== true) {
    return { kind: 'permanent', userId: user.id, email: user.email };
  }
  return { kind: 'anonymous', userId: user.id };
}

/** Lit l'état d'auth courant sans rien modifier. */
export async function currentAuth(): Promise<AuthState> {
  if (!supabase) return DISABLED;
  const { data } = await supabase.auth.getUser();
  return toAuthState(data.user);
}

/** Garantit une session : ouvre une session anonyme si aucune n'existe. */
export async function ensureSession(): Promise<AuthState> {
  if (!supabase) return DISABLED;
  const { data } = await supabase.auth.getUser();
  if (data.user) return toAuthState(data.user);
  const { data: anon, error } = await supabase.auth.signInAnonymously();
  if (error) {
    console.warn('ensureSession: signInAnonymously failed', error);
    return DISABLED;
  }
  return toAuthState(anon.user);
}

/** Upgrade la session anonyme courante en compte permanent. */
export async function upgradeAccount(
  email: string,
  password: string,
): Promise<AuthState> {
  if (!supabase) return DISABLED;
  const { data, error } = await supabase.auth.updateUser({ email, password });
  if (error) throw error;
  return toAuthState(data.user);
}

/** Connecte un compte existant (login depuis un nouvel appareil). */
export async function login(
  email: string,
  password: string,
): Promise<AuthState> {
  if (!supabase) return DISABLED;
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) throw error;
  return toAuthState(data.user);
}

/** Déconnecte et repart sur une session anonyme propre. */
export async function logout(): Promise<AuthState> {
  if (!supabase) return DISABLED;
  await supabase.auth.signOut();
  return ensureSession();
}

/** Envoie un email de réinitialisation de mot de passe. */
export async function requestPasswordReset(email: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.auth.resetPasswordForEmail(email);
  if (error) throw error;
}
```

- [ ] **Step 2: Vérifier build + lint**

Run: `npm run build && npm run lint`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/systems/cloud/auth.ts
git commit -m "feat(todo): cloud auth — anonymous session, upgrade, login, logout"
```

---

## Task 9: `sync.ts` — moteur de synchronisation

**Files:**
- Create: `src/systems/cloud/sync.ts`

- [ ] **Step 1: Écrire le moteur de sync**

Créer `src/systems/cloud/sync.ts` :

```ts
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
```

- [ ] **Step 2: Vérifier build + lint**

Run: `npm run build && npm run lint`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/systems/cloud/sync.ts
git commit -m "feat(todo): cloud sync engine — pull/merge/push with debounce"
```

---

## Task 10: `index.html` — montage & styles de la barre compte

**Files:**
- Modify: `index.html`

- [ ] **Step 1: Ajouter le conteneur de montage**

Dans `index.html`, modifier le bloc `#side-pane` pour ajouter `account-mount` après `todo-pane` :

```html
      <div id="side-pane">
        <div id="clock-mount"></div>
        <div id="todo-pane"></div>
        <div id="account-mount"></div>
      </div>
```

- [ ] **Step 2: Ajouter les styles**

Dans la balise `<style>` de `index.html`, ajouter `#account-mount` à la ligne de flex layout existante et ajouter les styles `.account-bar`. Ajouter après la ligne `#todo-pane { ... }` :

```css
      #account-mount { flex: 0 0 auto; }

      .account-bar { padding: 8px 12px; border-top: 1px solid #2a2d34; background: #1c1f26; font-size: 12px; color: #8a8f99; display: flex; align-items: center; justify-content: space-between; gap: 8px; }
      .account-id { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .account-action { background: transparent; color: #8a8f99; border: 1px solid #2a2d34; border-radius: 3px; font-size: 11px; font-family: inherit; padding: 3px 8px; cursor: pointer; white-space: nowrap; }
      .account-action:hover { color: #f0f0f0; border-color: #38875e; }
      .account-form { padding: 8px 12px; border-top: 1px solid #2a2d34; background: #1c1f26; display: flex; flex-direction: column; gap: 6px; }
      .account-form input { padding: 5px 8px; background: #0e1014; color: #f0f0f0; border: 1px solid #2a2d34; border-radius: 4px; font-size: 13px; font-family: inherit; }
      .account-form-row { display: flex; gap: 6px; }
      .account-form-row button { flex: 1; padding: 5px 8px; border: none; border-radius: 4px; font-size: 12px; font-family: inherit; cursor: pointer; }
      .account-submit { background: #2d6a4f; color: #fff; }
      .account-submit:hover { background: #38875e; }
      .account-cancel { background: #2a2d34; color: #f0f0f0; }
      .account-error { font-size: 11px; color: #ff5555; }
      .account-toggle { background: none; border: none; color: #8a8f99; font-size: 11px; cursor: pointer; text-decoration: underline; padding: 0; }
```

- [ ] **Step 3: Vérifier le démarrage**

Run: `npm run build`
Expected: PASS. (Le `#account-mount` est vide tant que Task 11 n'est pas faite — c'est attendu.)

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "feat(todo): account bar mount point and styles"
```

---

## Task 11: `AccountBar.ts` — composant UI

**Files:**
- Create: `src/ui/AccountBar.ts`

- [ ] **Step 1: Écrire le composant**

Créer `src/ui/AccountBar.ts` :

```ts
import type { AuthState } from '../systems/cloud/auth';

/** Callbacks que main.ts branche sur les actions de la barre compte. */
export type AccountBarCallbacks = {
  /** Upgrade de la session anonyme courante en compte permanent. */
  readonly onUpgrade: (email: string, password: string) => Promise<void>;
  /** Connexion à un compte existant depuis cet appareil. */
  readonly onLogin: (email: string, password: string) => Promise<void>;
  /** Déconnexion. */
  readonly onLogout: () => Promise<void>;
};

type FormMode = 'upgrade' | 'login';

/**
 * Barre compte fixée en bas de la sidebar. Affiche l'état de session et
 * ouvre un mini-formulaire email/mot de passe au-dessus de la barre.
 */
export class AccountBar {
  private root: HTMLElement;
  private auth: AuthState = { kind: 'disabled' };
  private formMode: FormMode | null = null;

  constructor(
    container: HTMLElement,
    private cb: AccountBarCallbacks,
  ) {
    this.root = document.createElement('div');
    container.appendChild(this.root);
    this.render();
  }

  /** Met à jour l'état de session affiché. */
  setAuth(auth: AuthState): void {
    this.auth = auth;
    this.formMode = null;
    this.render();
  }

  private render(): void {
    this.root.innerHTML = '';
    if (this.auth.kind === 'disabled') return;
    if (this.formMode) this.root.appendChild(this.buildForm(this.formMode));
    this.root.appendChild(this.buildBar());
  }

  private buildBar(): HTMLElement {
    const bar = document.createElement('div');
    bar.className = 'account-bar';

    const id = document.createElement('span');
    id.className = 'account-id';
    const action = document.createElement('button');
    action.className = 'account-action';

    if (this.auth.kind === 'permanent') {
      id.textContent = `👤 ${this.auth.email}`;
      action.textContent = 'Déconnexion';
      action.addEventListener('click', () => {
        void this.cb.onLogout();
      });
    } else {
      id.textContent = '👤 Invité';
      action.textContent = 'Créer un compte';
      action.addEventListener('click', () => {
        this.formMode = 'upgrade';
        this.render();
      });
    }

    bar.appendChild(id);
    bar.appendChild(action);
    return bar;
  }

  private buildForm(mode: FormMode): HTMLElement {
    const form = document.createElement('div');
    form.className = 'account-form';

    const email = document.createElement('input');
    email.type = 'email';
    email.placeholder = 'email';

    const password = document.createElement('input');
    password.type = 'password';
    password.placeholder = 'mot de passe';

    const error = document.createElement('div');
    error.className = 'account-error';

    const row = document.createElement('div');
    row.className = 'account-form-row';

    const submit = document.createElement('button');
    submit.className = 'account-submit';
    submit.textContent = mode === 'upgrade' ? 'Créer' : 'Se connecter';

    const cancel = document.createElement('button');
    cancel.className = 'account-cancel';
    cancel.textContent = 'Annuler';
    cancel.addEventListener('click', () => {
      this.formMode = null;
      this.render();
    });

    submit.addEventListener('click', () => {
      error.textContent = '';
      const action =
        mode === 'upgrade'
          ? this.cb.onUpgrade(email.value.trim(), password.value)
          : this.cb.onLogin(email.value.trim(), password.value);
      submit.disabled = true;
      action.catch((e: unknown) => {
        error.textContent =
          e instanceof Error ? e.message : 'Échec, réessaie.';
        submit.disabled = false;
      });
    });

    const toggle = document.createElement('button');
    toggle.className = 'account-toggle';
    toggle.textContent =
      mode === 'upgrade' ? "J'ai déjà un compte" : 'Créer un compte';
    toggle.addEventListener('click', () => {
      this.formMode = mode === 'upgrade' ? 'login' : 'upgrade';
      this.render();
    });

    row.appendChild(submit);
    row.appendChild(cancel);
    form.appendChild(email);
    form.appendChild(password);
    form.appendChild(error);
    form.appendChild(row);
    form.appendChild(toggle);
    return form;
  }
}
```

- [ ] **Step 2: Vérifier build + lint**

Run: `npm run build && npm run lint`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/ui/AccountBar.ts
git commit -m "feat(todo): AccountBar component for session state and auth forms"
```

---

## Task 12: `TodoSidebar.setPrefs` — appliquer tri/collapse après fusion

**Files:**
- Modify: `src/ui/TodoSidebar.ts`

- [ ] **Step 1: Ajouter la méthode `setPrefs`**

Dans `src/ui/TodoSidebar.ts`, ajouter cette méthode publique après `render(...)` (avant l'accolade fermante de la classe) :

```ts
  /** Applique des préférences arrivées par synchronisation cloud. */
  setPrefs(sortMode: SortMode, doneCollapsed: boolean): void {
    this.sortMode = sortMode;
    this.sortSelect.value = sortMode;
    this.doneCollapsed = doneCollapsed;
    this.applyCollapsed();
  }
```

- [ ] **Step 2: Vérifier build + lint**

Run: `npm run build && npm run lint`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/ui/TodoSidebar.ts
git commit -m "feat(todo): TodoSidebar.setPrefs to apply synced sort and collapse"
```

---

## Task 13: `save.ts` — hook listener pour l'état du jeu

**Files:**
- Modify: `src/systems/save.ts`

- [ ] **Step 1: Ajouter un listener de sauvegarde**

Dans `src/systems/save.ts`, ajouter un mécanisme de notification. Remplacer le contenu actuel de la fonction `saveState` et ajouter le registre. Le fichier devient :

```ts
import { GameState } from '../domain/state';
import { SAVE_KEY, SAVE_VERSION } from '../config';

type SaveListener = (state: GameState) => void;
let saveListener: SaveListener | null = null;

/**
 * Enregistre un listener notifié après chaque saveState réussi.
 * Sert de pont vers la synchronisation cloud sans coupler WorldScene au cloud.
 */
export function setSaveListener(listener: SaveListener | null): void {
  saveListener = listener;
}

export function saveState(state: GameState): void {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error('saveState failed', e);
  }
  saveListener?.(state);
}

export function loadState(): GameState | null {
  const raw = localStorage.getItem(SAVE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<GameState> & { version?: number };
    if (parsed.version !== SAVE_VERSION) {
      console.warn('save version mismatch; ignoring');
      return null;
    }
    const base = parsed as GameState;
    return {
      ...base,
      motivation: typeof parsed.motivation === 'number' ? parsed.motivation : 0,
      motivationLastDecayAt:
        typeof parsed.motivationLastDecayAt === 'number'
          ? parsed.motivationLastDecayAt
          : (base.lastSeenAt ?? Date.now()),
    };
  } catch (e) {
    console.error('loadState failed', e);
    return null;
  }
}

export function clearSave(): void {
  localStorage.removeItem(SAVE_KEY);
}
```

- [ ] **Step 2: Vérifier build + lint + tests**

Run: `npm run build && npm run lint && npm run test:run`
Expected: PASS — la signature publique de `saveState` est inchangée, rien ne casse.

- [ ] **Step 3: Commit**

```bash
git add src/systems/save.ts
git commit -m "feat(todo): saveState listener hook for cloud sync bridge"
```

---

## Task 14: `main.ts` — câblage du cloud

**Files:**
- Modify: `src/main.ts`

- [ ] **Step 1: Remplacer le contenu de `src/main.ts`**

Le fichier devient :

```ts
import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { WorldScene } from './scenes/WorldScene';
import { UIScene } from './scenes/UIScene';
import { TodoSidebar } from './ui/TodoSidebar';
import { SidebarClock } from './ui/SidebarClock';
import { DailyStats } from './ui/DailyStats';
import { AccountBar } from './ui/AccountBar';
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
} from './systems/cloud/auth';

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
  const world = game.scene.getScene('WorldScene') as WorldScene | null;
  if (world) world.events.emit('todo-completed');
}

const clockMount = document.getElementById('clock-mount')!;
new SidebarClock(clockMount, () => {
  const world = getWorld();
  return world ? world.getState().createdAt : null;
});

const pane = document.getElementById('todo-pane')!;
const accountMount = document.getElementById('account-mount')!;
let todos: readonly Todo[] = loadTodos();
let dailyGoal = loadDailyGoal();
let sortMode = loadSortMode();
let doneCollapsed = loadDoneCollapsed();

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

function currentPrefs(): CloudPrefs {
  return { sortMode, doneCollapsed, dailyGoal };
}

const cloud = createCloudSync({
  getLocalTodos: () => todos,
  getLocalGameState: () => {
    const world = getWorld();
    return world ? world.getState() : null;
  },
  getLocalPrefs: currentPrefs,
  onTodosMerged: (merged) => {
    todos = merged;
    saveTodos(todos);
    sidebar.render(todos);
    stats.render();
  },
  onGameStateMerged: (state: GameState) => {
    const world = getWorld();
    if (world) world.refresh(state);
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

const accountBar = new AccountBar(accountMount, {
  onUpgrade: async (email, password) => {
    accountBar.setAuth(await upgradeAccount(email, password));
  },
  onLogin: async (email, password) => {
    accountBar.setAuth(await login(email, password));
    await cloud.pullAndMerge('login');
  },
  onLogout: async () => {
    accountBar.setAuth(await logout());
    await cloud.pullAndMerge('normal');
  },
});

// Pousse l'état du jeu vers le cloud à chaque sauvegarde de WorldScene.
setSaveListener((state) => cloud.pushGameState(state));

// Sync initiale : session anonyme garantie, puis pull/merge.
void (async () => {
  accountBar.setAuth(await ensureSession());
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
```

- [ ] **Step 2: Vérifier build + lint + tests**

Run: `npm run build && npm run lint && npm run test:run`
Expected: PASS.

- [ ] **Step 3: Vérification manuelle — mode offline (sans `.env`)**

Run: `npm run dev`
Ouvrir http://localhost:5173. Vérifier : la barre compte affiche `👤 Invité` (Supabase non configuré → `kind: 'disabled'` → barre vide ; c'est attendu sans `.env`). Ajouter/cocher/supprimer un todo fonctionne, la console n'affiche aucune erreur bloquante.

- [ ] **Step 4: Vérification manuelle — mode cloud (avec `.env`)**

Avec un projet Supabase configuré (Task 2) et un `.env` renseigné, relancer `npm run dev`. Vérifier :
- la barre compte affiche `👤 Invité · Créer un compte` ;
- créer un compte → la barre passe à `👤 email · Déconnexion` ;
- les todos créés apparaissent dans la table `todos` de Supabase ;
- ouvrir l'app dans un autre navigateur, se connecter → les todos fusionnent, le village du compte s'affiche.

- [ ] **Step 5: Commit**

```bash
git add src/main.ts
git commit -m "feat(todo): wire cloud sync, account bar, and pull-on-focus"
```

---

## Mise à jour de la documentation

## Task 15: README

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Mettre à jour la section persistance**

Dans `README.md`, remplacer la ligne :

```
- La sauvegarde est locale (localStorage). Vider le cache du navigateur = perdre la partie.
```

par :

```
- La sauvegarde est locale (localStorage) et fonctionne hors-ligne.
- Avec un compte (optionnel), les données sont synchronisées via Supabase entre appareils. Voir `supabase/schema.sql` et `.env.example` pour la configuration.
```

Et ajouter à la section `## Stack` :

```
TypeScript + Phaser 4 + Vite + Vitest. Synchronisation optionnelle via Supabase.
```

(remplacer la ligne existante `TypeScript + Phaser 3 + Vite + Vitest.`)

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs(todo): document supabase sync in README"
```

---

## Self-Review

**Spec coverage :**
- Auth anonyme + upgrade → Tasks 8, 11, 14 ✅
- Local-first + sync arrière-plan → Tasks 9, 14 ✅
- Périmètre todos + état du jeu + préfs → schéma Task 2, sync Task 9 ✅
- Login appareil B (todos fusionnés, village cloud forcé) → `mergeSnapshots` mode `login` Task 6, câblage Task 14 ✅
- Moteur pull-démarrage / push-mutation / pull-focus → Tasks 9, 14 ✅
- Widget compte barre en bas → Tasks 10, 11 ✅
- Schéma 3 tables + RLS + tombstones → Task 2 ✅
- Conflits LWW + tombstones + purge 30 j → Tasks 3-6 ✅
- Migration = 1er cycle de sync → Task 14 (pull initial pousse le local) ✅
- Erreurs non bloquantes + no-op si `.env` absent → Tasks 7, 9 ✅
- Tests des fonctions pures → Tasks 3-6 ✅
- Secrets `.env` + `.env.example` → Task 1 ✅

**Limitation connue (documentée) :** la fusion LWW de l'état du jeu compare `lastSeenAt`. `bumpMotivation` et `refresh` sauvegardent sans avancer `lastSeenAt` ; entre deux `catchUp` (toutes les 60 s), une mutation de motivation peut perdre la course LWW face à un état distant. Acceptable en v1 — cohérent avec la limitation déjà documentée sur `countDoneToday`.

**Placeholder scan :** aucun TBD/TODO ; tout le code est fourni intégralement.

**Type consistency :** `CloudTodo`, `CloudPrefs`, `Stamped<T>`, `SyncSnapshot` définis Task 3-4, utilisés tels quels Tasks 6, 9. `AuthState` défini Task 8, consommé Tasks 11, 14. `CloudSync` / `CloudSyncCallbacks` définis Task 9, consommés Task 14. `setPrefs(sortMode, doneCollapsed)` défini Task 12, appelé Task 14. `setSaveListener` défini Task 13, appelé Task 14. Cohérent.
