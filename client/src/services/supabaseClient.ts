import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? import.meta.env.SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? import.meta.env.SUPABASE_ANON_KEY;
const authStorage = typeof window === 'undefined' ? undefined : window.sessionStorage;

export const supabase: SupabaseClient | null =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey, {
        auth: authStorage
          ? {
              storage: authStorage,
            }
          : undefined,
      })
    : null;

export function isSupabaseConfigured(): boolean {
  return supabase !== null;
}
