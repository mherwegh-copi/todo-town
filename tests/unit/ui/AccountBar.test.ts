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
