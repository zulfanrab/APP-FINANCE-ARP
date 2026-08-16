// ============================================================
// ARKA Finance — localStorage Utility
// ============================================================

const KEYS = {
  TRANSACTIONS: 'arka_transactions',
  PROJECTS: 'arka_projects',
  CATEGORIES: 'arka_categories',
  PIN_HASH: 'arka_pin_hash',
  SESSION: 'arka_session',
  TRASH_TRANSACTIONS: 'arka_trash_transactions',
  TRASH_PROJECTS: 'arka_trash_projects',
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
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err: any) {
    if (err?.name === 'QuotaExceededError' || err?.code === 22 || (err?.message && err.message.toLowerCase().includes('quota'))) {
      console.warn(`localStorage quota exceeded for key "${key}". Cleaning old attachment DataURLs...`);
      if (key === KEYS.TRANSACTIONS && Array.isArray(value)) {
        const cleaned = (value as any[]).map((tx, idx) => {
          if (idx > 15 && Array.isArray(tx.lampiran)) {
            return {
              ...tx,
              lampiran: tx.lampiran.map((att: any) => ({
                ...att,
                dataUrl: att.dataUrl?.startsWith('data:') ? '' : att.dataUrl,
              })),
            };
          }
          return tx;
        });
        try {
          localStorage.setItem(key, JSON.stringify(cleaned));
          return;
        } catch {
          // If still over quota, strip all dataUrls except the newest 5
          const aggressiveCleaned = (value as any[]).map((tx, idx) => {
            if (idx > 5 && Array.isArray(tx.lampiran)) {
              return {
                ...tx,
                lampiran: tx.lampiran.map((att: any) => ({
                  ...att,
                  dataUrl: att.dataUrl?.startsWith('data:') ? '' : att.dataUrl,
                })),
              };
            }
            return tx;
          });
          try {
            localStorage.setItem(key, JSON.stringify(aggressiveCleaned));
            return;
          } catch (finalErr) {
            console.error('Final localStorage attempt failed:', finalErr);
          }
        }
      }
    }
    console.error(`Failed to setItem for key "${key}":`, err);
  }
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
