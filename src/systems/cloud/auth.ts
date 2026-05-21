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
