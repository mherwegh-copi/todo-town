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
