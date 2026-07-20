// ============================================================
// ARKA Finance — Auth Service (LocalStorage + Supabase Sync)
// ============================================================

import { type Session, type UserRole } from '../types';
import { getItem, setItem, removeItem, getSession, setSession, removeSession, KEYS } from './storage';
import { supabase, isSupabaseConfigured } from './supabase';

async function hashPin(pin: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(pin + 'arka_salt_v1');
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function hasPin(): Promise<boolean> {
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'pin_hash')
        .maybeSingle();

      if (!error && data?.value) {
        setItem(KEYS.PIN_HASH, data.value);
        return true;
      }
    } catch (err) {
      console.warn('Supabase fetch failed, falling back to local storage:', err);
    }
  }

  const hash = getItem<string | null>(KEYS.PIN_HASH, null);
  return hash !== null;
}

export async function setupPin(pin: string): Promise<void> {
  const hash = await hashPin(pin);
  setItem(KEYS.PIN_HASH, hash);

  if (isSupabaseConfigured && supabase) {
    try {
      await supabase
        .from('app_settings')
        .upsert({ key: 'pin_hash', value: hash });
    } catch (err) {
      console.warn('Supabase save failed:', err);
    }
  }
}

export async function verifyPin(pin: string): Promise<boolean> {
  const storedHash = getItem<string | null>(KEYS.PIN_HASH, null);
  if (storedHash) {
    const hash = await hashPin(pin);
    if (hash === storedHash) return true;
  }

  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'pin_hash')
        .maybeSingle();

      if (!error && data?.value) {
        setItem(KEYS.PIN_HASH, data.value);
        const hash = await hashPin(pin);
        return hash === data.value;
      }
    } catch (err) {
      console.warn('Supabase pin verify error:', err);
    }
  }

  return false;
}

export async function changePin(oldPin: string, newPin: string): Promise<boolean> {
  const valid = await verifyPin(oldPin);
  if (!valid) return false;
  await setupPin(newPin);
  return true;
}

export function saveSession(role: UserRole): void {
  const session: Session = {
    role,
    loginAt: new Date().toISOString(),
  };
  setSession(KEYS.SESSION, session);
}

export function getSessionData(): Session | null {
  return getSession<Session | null>(KEYS.SESSION, null);
}

export function clearSession(): void {
  removeSession(KEYS.SESSION);
}

export function resetAllData(): void {
  removeItem(KEYS.PIN_HASH);
  removeItem(KEYS.TRANSACTIONS);
  removeItem(KEYS.PROJECTS);
  clearSession();
}
