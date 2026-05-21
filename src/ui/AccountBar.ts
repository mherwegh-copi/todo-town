import type { AuthState } from '../systems/cloud/auth';

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
