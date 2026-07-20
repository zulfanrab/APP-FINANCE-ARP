// ============================================================
// ARKA Finance — localStorage Utility
// ============================================================

const KEYS = {
  TRANSACTIONS: 'arka_transactions',
  PROJECTS: 'arka_projects',
  CATEGORIES: 'arka_categories',
  PIN_HASH: 'arka_pin_hash',
  SESSION: 'arka_session',
} as const;

export function getItem<T>(key: string, defaultValue: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return defaultValue;
    return JSON.parse(raw) as T;
  } catch {
    return defaultValue;
  }
}

export function setItem<T>(key: string, value: T): void {
  localStorage.setItem(key, JSON.stringify(value));
}

export function removeItem(key: string): void {
  localStorage.removeItem(key);
}

// Session uses sessionStorage (clears on tab close)
export function getSession<T>(key: string, defaultValue: T): T {
  try {
    const raw = sessionStorage.getItem(key);
    if (raw === null) return defaultValue;
    return JSON.parse(raw) as T;
  } catch {
    return defaultValue;
  }
}

export function setSession<T>(key: string, value: T): void {
  sessionStorage.setItem(key, JSON.stringify(value));
}

export function removeSession(key: string): void {
  sessionStorage.removeItem(key);
}

export { KEYS };
