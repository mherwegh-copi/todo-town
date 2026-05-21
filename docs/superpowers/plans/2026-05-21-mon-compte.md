# Popup « Mon compte » Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter une popup overlay « Mon compte » ouvrable depuis la barre compte par un utilisateur connecté, pour voir son email, changer son mot de passe, consulter l'état de synchro cloud et supprimer son compte.

**Architecture:** Nouveau composant DOM `AccountModal` monté sur un conteneur dédié hors de l'app Phaser. La barre `AccountBar` gagne un bouton `Compte` (à côté de `Déconnexion`). La suppression de compte passe par une edge function Supabase service-role ; le cascade SQL existant supprime les données. Le moteur de sync expose un nouvel état `getStatus()`.

**Tech Stack:** TypeScript, Vite, Phaser 4 (jeu), DOM pur (UI sidebar/modale), Supabase JS, Vitest + jsdom, edge function Deno.

**Branche:** créer `feat/MH/mon-compte` avant de commencer.

---

### Task 1 : État de synchro dans `sync.ts`

**Files:**
- Modify: `src/systems/cloud/sync.ts`
- Test: `tests/unit/systems/cloud/sync.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/systems/cloud/sync.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { createCloudSync } from '../../../../src/systems/cloud/sync';

const cb = {
  getLocalTodos: () => [],
  getLocalGameState: () => null,
  getLocalPrefs: () => ({
    sortMode: 'created' as const,
    doneCollapsed: false,
    dailyGoal: 5,
  }),
  onTodosMerged: vi.fn(),
  onGameStateMerged: vi.fn(),
  onPrefsMerged: vi.fn(),
};

describe('createCloudSync getStatus', () => {
  it('reports not configured when Supabase env is absent', () => {
    // En environnement de test, VITE_SUPABASE_URL/ANON_KEY sont absents,
    // donc createCloudSync renvoie le no-op.
    const sync = createCloudSync(cb);
    expect(sync.getStatus()).toEqual({ configured: false, lastSyncAt: 0 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:run -- tests/unit/systems/cloud/sync.test.ts`
Expected: FAIL — `sync.getStatus is not a function`.

- [ ] **Step 3: Add the `CloudStatus` type**

In `src/systems/cloud/sync.ts`, juste avant `export type CloudSync = {` (ligne ~30), insérer :

```ts
/** État de synchronisation cloud exposé à l'UI. */
export type CloudStatus = {
  /** Vrai si Supabase est configuré (sinon l'app reste en local pur). */
  readonly configured: boolean;
  /** Horodatage (ms epoch) de la dernière synchro réussie, 0 si aucune. */
  readonly lastSyncAt: number;
};
```

- [ ] **Step 4: Add `getStatus` to the `CloudSync` type**

Remplacer le bloc `export type CloudSync = { ... };` par :

```ts
/** API du moteur de sync exposée à main.ts. */
export type CloudSync = {
  readonly pullAndMerge: (mode: PullMode) => Promise<void>;
  readonly pushTodos: (todos: readonly Todo[]) => void;
  readonly pushTodoDelete: (id: string, now: number) => void;
  readonly pushGameState: (state: GameState) => void;
  readonly pushPrefs: (prefs: CloudPrefs) => void;
  readonly getStatus: () => CloudStatus;
};
```

- [ ] **Step 5: Add `getStatus` to the no-op**

Remplacer le bloc `const noop: CloudSync = { ... };` par :

```ts
  const noop: CloudSync = {
    pullAndMerge: async () => {},
    pushTodos: () => {},
    pushTodoDelete: () => {},
    pushGameState: () => {},
    pushPrefs: () => {},
    getStatus: () => ({ configured: false, lastSyncAt: 0 }),
  };
```

- [ ] **Step 6: Track `lastSyncAt`**

Juste après la ligne `let pendingPrefs: { prefs: CloudPrefs; updatedAt: number } | null = null;`, ajouter :

```ts
  let lastSyncAt = 0;
```

Dans la méthode `pullAndMerge`, après la ligne `await pushSnapshot(merged);`, ajouter :

```ts
        lastSyncAt = now;
```

Dans l'objet `return { ... }` final, ajouter en dernière propriété (après `pushPrefs`) :

```ts
    getStatus(): CloudStatus {
      return { configured: true, lastSyncAt };
    },
```

- [ ] **Step 7: Run test to verify it passes**

Run: `npm run test:run -- tests/unit/systems/cloud/sync.test.ts`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/systems/cloud/sync.ts tests/unit/systems/cloud/sync.test.ts
git commit -m "feat(account): expose cloud sync status via getStatus

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 2 : Helpers d'auth `changePassword` et `deleteAccount`

**Files:**
- Modify: `src/systems/cloud/auth.ts`
- Test: `tests/unit/systems/cloud/auth.test.ts`

Note : `auth.ts` dépend du client Supabase, `null` en environnement de test. Les
tests vérifient donc uniquement le garde-fou « pas de Supabase = no-op » ; le
comportement réseau réel est validé manuellement (voir Task 7 / vérification).

- [ ] **Step 1: Write the failing test**

Create `tests/unit/systems/cloud/auth.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { changePassword, deleteAccount } from '../../../../src/systems/cloud/auth';

describe('auth helpers without Supabase configured', () => {
  it('changePassword resolves to undefined when Supabase is absent', async () => {
    await expect(changePassword('newpass123')).resolves.toBeUndefined();
  });

  it('deleteAccount resolves to undefined when Supabase is absent', async () => {
    await expect(deleteAccount()).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:run -- tests/unit/systems/cloud/auth.test.ts`
Expected: FAIL — `changePassword`/`deleteAccount` not exported.

- [ ] **Step 3: Add the helpers**

In `src/systems/cloud/auth.ts`, à la fin du fichier (après `requestPasswordReset`), ajouter :

```ts
/** Change le mot de passe du compte connecté. */
export async function changePassword(newPassword: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
}

/**
 * Supprime définitivement le compte courant via l'edge function
 * `delete-account`. Le cascade SQL supprime todos / game_states / preferences.
 */
export async function deleteAccount(): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.functions.invoke('delete-account', {
    method: 'POST',
  });
  if (error) throw error;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:run -- tests/unit/systems/cloud/auth.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/systems/cloud/auth.ts tests/unit/systems/cloud/auth.test.ts
git commit -m "feat(account): add changePassword and deleteAccount auth helpers

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 3 : Composant `AccountModal`

**Files:**
- Create: `src/ui/AccountModal.ts`
- Test: `tests/unit/ui/AccountModal.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/ui/AccountModal.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AccountModal } from '../../../src/ui/AccountModal';
import type { CloudStatus } from '../../../src/systems/cloud/sync';

function makeContainer(): HTMLElement {
  const el = document.createElement('div');
  document.body.appendChild(el);
  return el;
}

const okStatus: CloudStatus = { configured: true, lastSyncAt: Date.now() };

function defaults() {
  return {
    onChangePassword: vi.fn().mockResolvedValue(undefined),
    onDeleteAccount: vi.fn().mockResolvedValue(undefined),
    getSyncStatus: () => okStatus,
  };
}

describe('AccountModal', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('open() renders the account email', () => {
    const modal = new AccountModal(makeContainer(), defaults());
    modal.open('jean@exemple.com');
    expect(
      document.querySelector('.account-modal-email')!.textContent,
    ).toContain('jean@exemple.com');
  });

  it('close() removes the modal from the DOM', () => {
    const modal = new AccountModal(makeContainer(), defaults());
    modal.open('jean@exemple.com');
    modal.close();
    expect(document.querySelector('.account-modal')).toBeNull();
  });

  it('clicking the backdrop closes the modal', () => {
    const modal = new AccountModal(makeContainer(), defaults());
    modal.open('jean@exemple.com');
    (document.querySelector('.account-modal-backdrop') as HTMLElement).click();
    expect(document.querySelector('.account-modal')).toBeNull();
  });

  it('the close button closes the modal', () => {
    const modal = new AccountModal(makeContainer(), defaults());
    modal.open('jean@exemple.com');
    (document.querySelector('.account-modal-close') as HTMLElement).click();
    expect(document.querySelector('.account-modal')).toBeNull();
  });

  it('Escape closes the modal', () => {
    const modal = new AccountModal(makeContainer(), defaults());
    modal.open('jean@exemple.com');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(document.querySelector('.account-modal')).toBeNull();
  });

  it('mismatched passwords show an error and skip onChangePassword', () => {
    const cb = defaults();
    const modal = new AccountModal(makeContainer(), cb);
    modal.open('jean@exemple.com');
    (document.querySelector('.account-modal-pwd-new') as HTMLInputElement).value =
      'aaaaaa';
    (
      document.querySelector('.account-modal-pwd-confirm') as HTMLInputElement
    ).value = 'bbbbbb';
    (document.querySelector('.account-modal-pwd-submit') as HTMLElement).click();
    expect(
      document.querySelector('.account-modal-pwd-error')!.textContent,
    ).toContain('diffèrent');
    expect(cb.onChangePassword).not.toHaveBeenCalled();
  });

  it('matching passwords call onChangePassword with the value', () => {
    const cb = defaults();
    const modal = new AccountModal(makeContainer(), cb);
    modal.open('jean@exemple.com');
    (document.querySelector('.account-modal-pwd-new') as HTMLInputElement).value =
      'secret1';
    (
      document.querySelector('.account-modal-pwd-confirm') as HTMLInputElement
    ).value = 'secret1';
    (document.querySelector('.account-modal-pwd-submit') as HTMLElement).click();
    expect(cb.onChangePassword).toHaveBeenCalledWith('secret1');
  });

  it('shows a disabled-sync message when cloud is not configured', () => {
    const cb = defaults();
    cb.getSyncStatus = () => ({ configured: false, lastSyncAt: 0 });
    const modal = new AccountModal(makeContainer(), cb);
    modal.open('jean@exemple.com');
    expect(
      document.querySelector('.account-modal-sync')!.textContent,
    ).toContain('désactivée');
  });

  it('delete requires a confirmation click before calling onDeleteAccount', () => {
    const cb = defaults();
    const modal = new AccountModal(makeContainer(), cb);
    modal.open('jean@exemple.com');
    const del = document.querySelector('.account-modal-delete') as HTMLElement;
    del.click();
    expect(cb.onDeleteAccount).not.toHaveBeenCalled();
    expect(del.textContent).toContain('Confirmer');
    del.click();
    expect(cb.onDeleteAccount).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:run -- tests/unit/ui/AccountModal.test.ts`
Expected: FAIL — `Cannot find module '../../../src/ui/AccountModal'`.

- [ ] **Step 3: Create the component**

Create `src/ui/AccountModal.ts`:

```ts
import type { CloudStatus } from '../systems/cloud/sync';

/** Callbacks que main.ts branche sur les actions de la modale compte. */
export type AccountModalCallbacks = {
  /** Change le mot de passe du compte connecté. */
  readonly onChangePassword: (newPassword: string) => Promise<void>;
  /** Supprime définitivement le compte. */
  readonly onDeleteAccount: () => Promise<void>;
  /** Lit l'état de synchronisation cloud courant. */
  readonly getSyncStatus: () => CloudStatus;
};

/** Met en forme un délai écoulé depuis `at` (ms epoch) en texte court. */
function formatAgo(at: number, now: number): string {
  if (at <= 0) return 'pas encore synchronisé';
  const sec = Math.max(0, Math.round((now - at) / 1000));
  if (sec < 60) return "il y a moins d'une minute";
  const min = Math.round(sec / 60);
  if (min < 60) return `il y a ${min} min`;
  return `il y a ${Math.round(min / 60)} h`;
}

/**
 * Popup overlay « Mon compte ». Construite une fois ; `open(email)` la peuple
 * et l'affiche, `close()` la retire du DOM.
 */
export class AccountModal {
  private backdrop: HTMLElement;
  private isOpen = false;
  private deleteArmed = false;

  constructor(
    private container: HTMLElement,
    private cb: AccountModalCallbacks,
  ) {
    this.backdrop = document.createElement('div');
    this.backdrop.className = 'account-modal-backdrop';
    this.backdrop.addEventListener('click', (e) => {
      if (e.target === this.backdrop) this.close();
    });
  }

  /** Affiche la modale pour le compte `email`. */
  open(email: string): void {
    if (this.isOpen) return;
    this.isOpen = true;
    this.deleteArmed = false;
    this.backdrop.innerHTML = '';
    this.backdrop.appendChild(this.buildPanel(email));
    this.container.appendChild(this.backdrop);
    document.addEventListener('keydown', this.onKeydown);
  }

  /** Retire la modale du DOM. */
  close(): void {
    if (!this.isOpen) return;
    this.isOpen = false;
    document.removeEventListener('keydown', this.onKeydown);
    this.backdrop.remove();
  }

  private onKeydown = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') this.close();
  };

  private buildPanel(email: string): HTMLElement {
    const panel = document.createElement('div');
    panel.className = 'account-modal';
    panel.appendChild(this.buildHeader());
    panel.appendChild(this.buildEmail(email));
    panel.appendChild(this.buildPasswordSection());
    panel.appendChild(this.buildSyncSection());
    panel.appendChild(this.buildDangerSection());
    return panel;
  }

  private buildHeader(): HTMLElement {
    const header = document.createElement('div');
    header.className = 'account-modal-header';

    const title = document.createElement('span');
    title.className = 'account-modal-title';
    title.textContent = 'Mon compte';

    const close = document.createElement('button');
    close.className = 'account-modal-close';
    close.textContent = '✕';
    close.addEventListener('click', () => this.close());

    header.appendChild(title);
    header.appendChild(close);
    return header;
  }

  private buildEmail(email: string): HTMLElement {
    const row = document.createElement('div');
    row.className = 'account-modal-email';
    row.textContent = `👤 ${email}`;
    return row;
  }

  private buildPasswordSection(): HTMLElement {
    const section = document.createElement('div');
    section.className = 'account-modal-section';

    const label = document.createElement('div');
    label.className = 'account-modal-section-label';
    label.textContent = 'Mot de passe';

    const newPwd = document.createElement('input');
    newPwd.type = 'password';
    newPwd.className = 'account-modal-pwd-new';
    newPwd.placeholder = 'nouveau mot de passe';

    const confirmPwd = document.createElement('input');
    confirmPwd.type = 'password';
    confirmPwd.className = 'account-modal-pwd-confirm';
    confirmPwd.placeholder = 'confirmer';

    const error = document.createElement('div');
    error.className = 'account-modal-pwd-error';

    const submit = document.createElement('button');
    submit.className = 'account-modal-pwd-submit';
    submit.textContent = 'Mettre à jour';
    submit.addEventListener('click', () => {
      error.textContent = '';
      error.classList.remove('account-modal-ok');
      const a = newPwd.value;
      const b = confirmPwd.value;
      if (a.length === 0) {
        error.textContent = 'Saisis un mot de passe.';
        return;
      }
      if (a !== b) {
        error.textContent = 'Les deux mots de passe diffèrent.';
        return;
      }
      submit.disabled = true;
      this.cb
        .onChangePassword(a)
        .then(() => {
          newPwd.value = '';
          confirmPwd.value = '';
          error.textContent = 'Mot de passe mis à jour.';
          error.classList.add('account-modal-ok');
        })
        .catch((e: unknown) => {
          error.textContent =
            e instanceof Error ? e.message : 'Échec, réessaie.';
        })
        .finally(() => {
          submit.disabled = false;
        });
    });

    section.appendChild(label);
    section.appendChild(newPwd);
    section.appendChild(confirmPwd);
    section.appendChild(error);
    section.appendChild(submit);
    return section;
  }

  private buildSyncSection(): HTMLElement {
    const section = document.createElement('div');
    section.className = 'account-modal-section';

    const label = document.createElement('div');
    label.className = 'account-modal-section-label';
    label.textContent = 'Synchronisation';

    const status = document.createElement('div');
    status.className = 'account-modal-sync';
    const s = this.cb.getSyncStatus();
    status.textContent = s.configured
      ? `☁ Synchronisé · ${formatAgo(s.lastSyncAt, Date.now())}`
      : '☁ Sync cloud désactivée';

    section.appendChild(label);
    section.appendChild(status);
    return section;
  }

  private buildDangerSection(): HTMLElement {
    const section = document.createElement('div');
    section.className = 'account-modal-danger';

    const label = document.createElement('div');
    label.className = 'account-modal-section-label';
    label.textContent = 'Zone danger';

    const error = document.createElement('div');
    error.className = 'account-modal-delete-error';

    const del = document.createElement('button');
    del.className = 'account-modal-delete';
    del.textContent = 'Supprimer le compte';
    del.addEventListener('click', () => {
      error.textContent = '';
      if (!this.deleteArmed) {
        this.deleteArmed = true;
        del.textContent = 'Confirmer la suppression ?';
        del.classList.add('account-modal-delete-armed');
        return;
      }
      del.disabled = true;
      this.cb
        .onDeleteAccount()
        .then(() => this.close())
        .catch((e: unknown) => {
          error.textContent =
            e instanceof Error ? e.message : 'Échec de la suppression.';
          this.deleteArmed = false;
          del.textContent = 'Supprimer le compte';
          del.classList.remove('account-modal-delete-armed');
          del.disabled = false;
        });
    });

    section.appendChild(label);
    section.appendChild(del);
    section.appendChild(error);
    return section;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:run -- tests/unit/ui/AccountModal.test.ts`
Expected: PASS — 9 tests.

- [ ] **Step 5: Commit**

```bash
git add src/ui/AccountModal.ts tests/unit/ui/AccountModal.test.ts
git commit -m "feat(account): add AccountModal popup component

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 4 : Conteneur `#modal-mount` et CSS dans `index.html`

**Files:**
- Modify: `index.html`

Pas de test automatisé (HTML/CSS) ; vérification visuelle en Task 6.

- [ ] **Step 1: Add the mount point**

Dans `index.html`, remplacer le bloc `<body> … </body>` par :

```html
  <body>
    <div id="app">
      <div id="side-pane">
        <div id="clock-mount"></div>
        <div id="todo-pane"></div>
        <div id="account-mount"></div>
      </div>
      <div id="game"></div>
    </div>
    <div id="modal-mount"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
```

- [ ] **Step 2: Add the modal CSS**

Dans le `<style>` de `index.html`, juste après la ligne
`.account-toggle { … }` (fin du bloc compte), insérer :

```css
      .account-modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; z-index: 100; }
      .account-modal { width: 340px; max-width: 90vw; background: #1c1f26; color: #f0f0f0; border: 1px solid #2a2d34; border-radius: 8px; padding: 16px; box-sizing: border-box; display: flex; flex-direction: column; gap: 14px; }
      .account-modal-header { display: flex; align-items: center; justify-content: space-between; }
      .account-modal-title { font-size: 16px; font-weight: 600; }
      .account-modal-close { background: transparent; border: none; color: #8a8f99; font-size: 16px; cursor: pointer; padding: 0 4px; }
      .account-modal-close:hover { color: #f0f0f0; }
      .account-modal-email { font-size: 14px; color: #f0f0f0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .account-modal-section, .account-modal-danger { display: flex; flex-direction: column; gap: 6px; }
      .account-modal-danger { border-top: 1px solid #2a2d34; padding-top: 12px; }
      .account-modal-section-label { font-size: 12px; color: #8a8f99; text-transform: uppercase; letter-spacing: 1px; }
      .account-modal input { padding: 6px 8px; background: #0e1014; color: #f0f0f0; border: 1px solid #2a2d34; border-radius: 4px; font-size: 13px; font-family: inherit; }
      .account-modal-pwd-submit { padding: 6px 8px; background: #2d6a4f; color: #fff; border: none; border-radius: 4px; font-size: 12px; font-family: inherit; cursor: pointer; }
      .account-modal-pwd-submit:hover { background: #38875e; }
      .account-modal-pwd-submit:disabled { opacity: 0.5; cursor: default; }
      .account-modal-pwd-error { font-size: 11px; color: #ff5555; }
      .account-modal-pwd-error.account-modal-ok { color: #38875e; }
      .account-modal-sync { font-size: 13px; color: #8a8f99; }
      .account-modal-delete { padding: 6px 8px; background: transparent; color: #ff5555; border: 1px solid #5a2d2d; border-radius: 4px; font-size: 12px; font-family: inherit; cursor: pointer; }
      .account-modal-delete:hover { border-color: #ff5555; }
      .account-modal-delete-armed { background: #ff5555; color: #fff; }
      .account-modal-delete-error { font-size: 11px; color: #ff5555; }
```

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat(account): add modal mount point and styles

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 5 : Bouton `Compte` dans `AccountBar`

**Files:**
- Modify: `src/ui/AccountBar.ts`
- Test: `tests/unit/ui/AccountBar.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/ui/AccountBar.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AccountBar } from '../../../src/ui/AccountBar';

function makeContainer(): HTMLElement {
  const el = document.createElement('div');
  document.body.appendChild(el);
  return el;
}

function callbacks() {
  return {
    onUpgrade: vi.fn().mockResolvedValue(undefined),
    onLogin: vi.fn().mockResolvedValue(undefined),
    onLogout: vi.fn().mockResolvedValue(undefined),
    onOpenAccount: vi.fn(),
  };
}

describe('AccountBar', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('shows Compte and Déconnexion for a permanent account', () => {
    const bar = new AccountBar(makeContainer(), callbacks());
    bar.setAuth({ kind: 'permanent', userId: 'u1', email: 'a@b.com' });
    const labels = [...document.querySelectorAll('.account-action')].map(
      (b) => b.textContent,
    );
    expect(labels).toContain('Compte');
    expect(labels).toContain('Déconnexion');
  });

  it('clicking Compte calls onOpenAccount', () => {
    const cb = callbacks();
    const bar = new AccountBar(makeContainer(), cb);
    bar.setAuth({ kind: 'permanent', userId: 'u1', email: 'a@b.com' });
    const compte = [...document.querySelectorAll('.account-action')].find(
      (b) => b.textContent === 'Compte',
    ) as HTMLElement;
    compte.click();
    expect(cb.onOpenAccount).toHaveBeenCalledTimes(1);
  });

  it('shows only Créer un compte for a guest session', () => {
    const bar = new AccountBar(makeContainer(), callbacks());
    bar.setAuth({ kind: 'anonymous', userId: 'u1' });
    const labels = [...document.querySelectorAll('.account-action')].map(
      (b) => b.textContent,
    );
    expect(labels).toEqual(['Créer un compte']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:run -- tests/unit/ui/AccountBar.test.ts`
Expected: FAIL — `onOpenAccount` manquant dans le type des callbacks / pas de bouton `Compte`.

- [ ] **Step 3: Add the `onOpenAccount` callback to the type**

Dans `src/ui/AccountBar.ts`, remplacer le bloc `export type AccountBarCallbacks = { ... };` par :

```ts
/** Callbacks que main.ts branche sur les actions de la barre compte. */
export type AccountBarCallbacks = {
  /** Upgrade de la session anonyme courante en compte permanent. */
  readonly onUpgrade: (email: string, password: string) => Promise<void>;
  /** Connexion à un compte existant depuis cet appareil. */
  readonly onLogin: (email: string, password: string) => Promise<void>;
  /** Déconnexion. */
  readonly onLogout: () => Promise<void>;
  /** Ouvre la popup « Mon compte ». */
  readonly onOpenAccount: () => void;
};
```

- [ ] **Step 4: Rebuild `buildBar` with the Compte button**

Remplacer toute la méthode `private buildBar(): HTMLElement { ... }` par :

```ts
  private buildBar(): HTMLElement {
    const bar = document.createElement('div');
    bar.className = 'account-bar';

    const id = document.createElement('span');
    id.className = 'account-id';
    bar.appendChild(id);

    if (this.auth.kind === 'permanent') {
      id.textContent = `👤 ${this.auth.email}`;

      const account = document.createElement('button');
      account.className = 'account-action';
      account.textContent = 'Compte';
      account.addEventListener('click', () => this.cb.onOpenAccount());
      bar.appendChild(account);

      const logout = document.createElement('button');
      logout.className = 'account-action';
      logout.textContent = 'Déconnexion';
      logout.addEventListener('click', () => {
        void this.cb.onLogout();
      });
      bar.appendChild(logout);
    } else {
      id.textContent = '👤 Invité';

      const create = document.createElement('button');
      create.className = 'account-action';
      create.textContent = 'Créer un compte';
      create.addEventListener('click', () => {
        this.formMode = 'upgrade';
        this.render();
      });
      bar.appendChild(create);
    }
    return bar;
  }
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm run test:run -- tests/unit/ui/AccountBar.test.ts`
Expected: PASS — 3 tests.

- [ ] **Step 6: Commit**

```bash
git add src/ui/AccountBar.ts tests/unit/ui/AccountBar.test.ts
git commit -m "feat(account): add Compte button to AccountBar

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 6 : Câblage dans `main.ts`

**Files:**
- Modify: `src/main.ts`

`main.ts` est le point d'entrée Phaser, non testé unitairement. Vérification :
build TypeScript + suite complète + contrôle visuel.

- [ ] **Step 1: Add imports**

Dans `src/main.ts`, remplacer le bloc d'import de `./ui/AccountBar` et le bloc
d'import de `./systems/cloud/auth` par :

```ts
import { AccountBar } from './ui/AccountBar';
import { AccountModal } from './ui/AccountModal';
```

et

```ts
import {
  ensureSession,
  upgradeAccount,
  login,
  logout,
  changePassword,
  deleteAccount,
} from './systems/cloud/auth';
import type { AuthState } from './systems/cloud/auth';
```

- [ ] **Step 2: Add the modal mount lookup**

Juste après la ligne `const accountMount = document.getElementById('account-mount')!;`, ajouter :

```ts
const modalMount = document.getElementById('modal-mount')!;
```

- [ ] **Step 3: Replace the AccountBar wiring block**

Remplacer entièrement le bloc `const accountBar = new AccountBar(accountMount, { ... });` par :

```ts
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
```

- [ ] **Step 4: Update the initial sync block**

Remplacer le bloc :

```ts
// Sync initiale : session anonyme garantie, puis pull/merge.
void (async () => {
  accountBar.setAuth(await ensureSession());
  await cloud.pullAndMerge('normal');
})();
```

par :

```ts
// Sync initiale : session anonyme garantie, puis pull/merge.
void (async () => {
  applyAuth(await ensureSession());
  await cloud.pullAndMerge('normal');
})();
```

- [ ] **Step 5: Verify the build and the full test suite**

Run: `npm run build`
Expected: aucune erreur TypeScript, build Vite OK.

Run: `npm run test:run`
Expected: tous les tests passent (suite existante + nouveaux fichiers).

- [ ] **Step 6: Manual visual check**

Run: `npm run dev`, ouvrir l'URL locale.
- Créer un compte via la barre → la barre affiche `👤 email`, `Compte`, `Déconnexion`.
- Cliquer `Compte` → la modale s'ouvre en overlay.
- Vérifier : email affiché, section synchro, formulaire mot de passe, zone danger.
- Fermer via la croix, le backdrop, puis `Échap`.
- Changer le mot de passe avec deux champs identiques → message « Mot de passe mis à jour. ».
- Saisir deux champs différents → message « Les deux mots de passe diffèrent. ».

- [ ] **Step 7: Commit**

```bash
git add src/main.ts
git commit -m "feat(account): wire AccountModal into main entry point

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 7 : Edge function `delete-account`

**Files:**
- Create: `supabase/functions/delete-account/index.ts`
- Modify: `README.md`

Pas de test automatisé (runtime Deno, infra serveur). Vérification : déploiement
puis test manuel de la suppression depuis l'app.

- [ ] **Step 1: Create the edge function**

Create `supabase/functions/delete-account/index.ts`:

```ts
// Edge function : supprime définitivement le compte de l'appelant.
// Le cascade SQL (on delete cascade vers auth.users) supprime
// todos / game_states / preferences.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Missing Authorization' }, 401);

    const url = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Identifie l'appelant à partir de son JWT.
    const userClient = createClient(url, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
      error: userErr,
    } = await userClient.auth.getUser();
    if (userErr || !user) return json({ error: 'Invalid session' }, 401);

    // Supprime le compte avec les droits service-role.
    const admin = createClient(url, serviceKey);
    const { error: delErr } = await admin.auth.admin.deleteUser(user.id);
    if (delErr) return json({ error: delErr.message }, 500);

    return json({ ok: true }, 200);
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
```

- [ ] **Step 2: Document the deployment**

Dans `README.md`, ajouter à la fin une section :

```markdown
## Edge function `delete-account`

Suppression de compte. Déployer une fois le projet Supabase configuré :

```bash
supabase functions deploy delete-account
```

Le runtime injecte automatiquement `SUPABASE_URL`, `SUPABASE_ANON_KEY` et
`SUPABASE_SERVICE_ROLE_KEY` — aucun secret à définir manuellement.
```

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/delete-account/index.ts README.md
git commit -m "feat(account): add delete-account edge function

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

- [ ] **Step 4: Deploy and verify (manuel)**

Déployer : `supabase functions deploy delete-account`.
Dans l'app : compte connecté → `Compte` → `Supprimer le compte` → `Confirmer la
suppression ?` → la modale se ferme, la barre repasse en `👤 Invité`. Vérifier
dans le dashboard Supabase que l'utilisateur et ses lignes ont disparu.

---

## Self-Review

**Spec coverage:**
- Email affiché → Task 3 (`buildEmail`).
- Changer le mot de passe → Task 3 (`buildPasswordSection`) + Task 2 (`changePassword`).
- État de synchro cloud → Task 1 (`getStatus`) + Task 3 (`buildSyncSection`).
- Supprimer le compte → Task 3 (`buildDangerSection`) + Task 2 (`deleteAccount`) + Task 7 (edge function).
- Popup overlay, pas de pages → Task 3 (`AccountModal`) + Task 4 (mount + CSS).
- Bouton `Compte` à côté de `Déconnexion` → Task 5.
- Câblage → Task 6.
- Confirmation inline en deux temps (pas de `window.confirm`) → Task 3 (`buildDangerSection`).
- Périmètre comptes permanents uniquement → Task 5 (branche `permanent`) + Task 6 (`onOpenAccount` garde `kind === 'permanent'`).

Aucun écart : chaque exigence de la spec est couverte.

**Type consistency:**
- `CloudStatus` défini en Task 1, importé en Task 3 et utilisé en Task 6 (`cloud.getStatus()`).
- `AccountModalCallbacks` (Task 3) : `onChangePassword`, `onDeleteAccount`, `getSyncStatus` — mêmes noms câblés en Task 6.
- `AccountBarCallbacks.onOpenAccount` (Task 5) — câblé en Task 6.
- `AuthState` réutilisé tel quel (type existant) en Task 6.
- Edge function nommée `delete-account` en Task 7 — même nom invoqué par `deleteAccount` en Task 2.

**Placeholder scan:** aucun TODO/TBD ; tout le code est fourni.
