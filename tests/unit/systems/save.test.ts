import { describe, it, expect, beforeEach } from 'vitest';
import { saveState, loadState, clearSave } from '../../../src/systems/save';
import { emptyState } from '../../../src/domain/state';
import { SAVE_KEY, SAVE_VERSION } from '../../../src/config';

describe('save', () => {
  let store: Record<string, string> = {};

  beforeEach(() => {
    store = {};
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
    expect(loadState()).toEqual(s);
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

  it('returns null on version mismatch', () => {
    localStorage.setItem(SAVE_KEY, JSON.stringify({ version: SAVE_VERSION - 1 }));
    expect(loadState()).toBeNull();
  });

  it('clearSave removes data', () => {
    saveState(emptyState(0, 1));
    clearSave();
    expect(loadState()).toBeNull();
  });

  it('défaut le bloc construction quand il manque', () => {
    const base = emptyState(1, 42);
    const { construction: _drop, ...withoutConstruction } = base;
    localStorage.setItem(SAVE_KEY, JSON.stringify(withoutConstruction));
    const loaded = loadState();
    expect(loaded).not.toBeNull();
    expect(loaded!.construction).toEqual({ points: 0, openings: 0, lastMorningDate: '' });
  });

  it('préserve le bloc construction présent', () => {
    const s = {
      ...emptyState(1, 42),
      construction: { points: 2, openings: 1, lastMorningDate: '2026-05-21' },
    };
    saveState(s);
    expect(loadState()!.construction).toEqual({
      points: 2,
      openings: 1,
      lastMorningDate: '2026-05-21',
    });
  });
});
