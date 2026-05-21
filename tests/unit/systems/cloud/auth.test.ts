import { vi } from 'vitest';

// Mock the Supabase client so auth helpers always get null regardless of .env
vi.mock('../../../../src/systems/cloud/client', () => ({ supabase: null }));

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
