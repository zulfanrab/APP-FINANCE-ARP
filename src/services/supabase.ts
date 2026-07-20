// ============================================================
// ARKA Finance — Supabase Client Configuration
// ============================================================

import { createClient } from '@supabase/supabase-js';

const rawUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

// Normalize URL (strip trailing /rest/v1/ if user pasted REST endpoint)
const supabaseUrl = rawUrl ? rawUrl.replace(/\/rest\/v1\/?$/, '') : undefined;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabaseAnonKey!)
  : null;
