import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

const tabSessionStorage =
  typeof window !== 'undefined'
    ? {
        getItem: (key: string): string | null => {
          try {
            const sessionVal = window.sessionStorage.getItem(key);
            if (sessionVal !== null) return sessionVal;
            // Migra uma única vez do localStorage para o sessionStorage da aba atual e remove do localStorage global
            const legacyVal = window.localStorage.getItem(key);
            if (legacyVal !== null) {
              window.sessionStorage.setItem(key, legacyVal);
              window.localStorage.removeItem(key);
              return legacyVal;
            }
          } catch {
            // ignore storage errors
          }
          return null;
        },
        setItem: (key: string, value: string): void => {
          try {
            window.sessionStorage.setItem(key, value);
            window.localStorage.removeItem(key);
          } catch {
            // ignore storage errors
          }
        },
        removeItem: (key: string): void => {
          try {
            window.sessionStorage.removeItem(key);
            window.localStorage.removeItem(key);
          } catch {
            // ignore storage errors
          }
        },
      }
    : undefined;

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabaseAnonKey!, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
        storage: tabSessionStorage,
      },
    })
  : null;

export function requireSupabase() {
  if (!supabase) {
    throw new Error('Supabase is not configured. Set SUPABASE_URL and SUPABASE_ANON_KEY.');
  }
  return supabase;
}
