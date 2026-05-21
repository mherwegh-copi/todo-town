import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/**
 * Instance Supabase, ou null si les variables d'environnement sont absentes.
 * Quand c'est null, tout le module cloud devient un no-op et l'app reste
 * pleinement utilisable hors-ligne sur localStorage.
 */
export const supabase: SupabaseClient | null =
  url && anonKey ? createClient(url, anonKey) : null;
