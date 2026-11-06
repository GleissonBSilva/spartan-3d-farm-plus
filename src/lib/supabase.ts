import { createClient } from '@supabase/supabase-js';

const RAW_URL = (import.meta.env.SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL || '').trim();
const RAW_KEY = (import.meta.env.SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

// Instância ativa em produção caso o Vercel ou o ambiente esteja apontando para o projeto inativo/pausado (kvtzmehyqjetgaihozkm)
const FALLBACK_ACTIVE_SUPABASE_URL = 'https://xebkzslkajvhnuqohmfk.supabase.co';
const FALLBACK_ACTIVE_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhlYmt6c2xrYWp2aG51cW9obWZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEwNTIyNzQsImV4cCI6MjEwNjYyODI3NH0.85G6HRti_COf7zDTVMk01gWZ4jXfsO-tWLctTtQdPDQ';

const isDeadProject = RAW_URL.includes('kvtzmehyqjetgaihozkm');

const supabaseUrl = (!RAW_URL || isDeadProject) ? FALLBACK_ACTIVE_SUPABASE_URL : RAW_URL;
const supabaseAnonKey = (!RAW_KEY || isDeadProject) ? FALLBACK_ACTIVE_SUPABASE_ANON_KEY : RAW_KEY;

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
