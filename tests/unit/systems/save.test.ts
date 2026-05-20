import { describe, it, expect, beforeEach, vi } from 'vitest';
import { saveState, loadState, clearSave } from '../../../src/systems/save';
import { emptyState } from '../../../src/domain/state';
import { SAVE_KEY } from '../../../src/config';

describe('save', () => {
  let store: Record<string, string> = {};

  beforeEach(() => {
    store = {};
    // Mock localStorage
    (globalThis as any).localStorage = {
      getItem: (key: string) => store[key] || null,
      setItem: (key: string, value: string) => {
        store[key] = value;
      },
      removeItem: (key: string) => {
        delete store[key];
      },
      clear: () => {
        store = {};
      },
      key: (index: number) => Object.keys(store)[index] || null,
      length: Object.keys(store).length,
    } as any;
  });

  it('save+load roundtrips state', () => {
    const s = emptyState(0, 42);
    saveState(s);
    const loaded = loadState();
    expect(loaded).toEqual(s);
  });

  it('returns null when nothing saved', () => {
    expect(loadState()).toBeNull();
  });

  it('returns null on corrupted JSON', () => {
    localStorage.setItem(SAVE_KEY, '{not-json');
    expect(loadState()).toBeNull();
  });

  it('returns null on unknown version', () => {
    const bad = { ...emptyState(0, 1), version: 999 };
    localStorage.setItem(SAVE_KEY, JSON.stringify(bad));
    expect(loadState()).toBeNull();
  });

  it('clearSave removes data', () => {
    saveState(emptyState(0, 1));
    clearSave();
    expect(loadState()).toBeNull();
  });
});
