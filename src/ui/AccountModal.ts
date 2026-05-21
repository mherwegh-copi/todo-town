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
        })
        .finally(() => {
          del.disabled = false;
        });
    });

    section.appendChild(label);
    section.appendChild(del);
    section.appendChild(error);
    return section;
  }
}
