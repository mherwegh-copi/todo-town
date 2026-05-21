import { describe, it, expect, vi } from 'vitest';

// Mock the Supabase client so sync always gets a no-op regardless of .env
vi.mock('../../../../src/systems/cloud/client', () => ({ supabase: null }));

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
