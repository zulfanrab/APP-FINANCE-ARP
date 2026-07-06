// ============================================================
// ARKA Finance — Auth Service
// Pola async/await siap diganti fetch() ke backend
// ============================================================

import { type Session, type UserRole } from '../types';
import { getItem, setItem, removeItem, getSession, setSession, removeSession, KEYS } from './storage';

// Simple hash: SHA-256 via Web Crypto API
async function hashPin(pin: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(pin + 'arka_salt_v1');
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function hasPin(): Promise<boolean> {
  const hash = getItem<string | null>(KEYS.PIN_HASH, null);
  return hash !== null;
}

export async function setupPin(pin: string): Promise<void> {
  const hash = await hashPin(pin);
  setItem(KEYS.PIN_HASH, hash);
}

export async function verifyPin(pin: string): Promise<boolean> {
  const storedHash = getItem<string | null>(KEYS.PIN_HASH, null);
  if (!storedHash) return false;
  const hash = await hashPin(pin);
  return hash === storedHash;
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
