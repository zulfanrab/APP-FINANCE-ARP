// ============================================================
// ARKA Finance — Category Service (Dynamic Income vs Expense Categories)
// ============================================================

import { getItem, setItem, KEYS } from './storage';
import { supabase, isSupabaseConfigured } from './supabase';

export const DEFAULT_INCOME_CATEGORIES = [
  'Pembayaran Klien / Proyek',
  'DP / Termijn Proyek',
  'Pelunasan Proyek',
  'Drop Dana Kas Utama / Holding',
  'Setoran Modal Owner / Direksi',
  'Saldo Awal',
  'Mutasi Internal / Transfer Kas',
  'Refund Sisa Dana Proyek ke Kas Utama',
];

export const DEFAULT_EXPENSE_CATEGORIES = [
  'Biaya Proyek',
  'Bahan & Material',
  'Biaya Admin Bank',
  'Gaji & Honorarium',
  'Transport & Bensin',
  'Konsumsi & Akomodasi',
  'Peralatan & Sewa Alat',
  'Operasional Kantor',
  'Alokasi Modal Operasional Proyek',
  'Mutasi Internal / Transfer Kas',
  'Penarikan Prive / Non-Operasional',
  'Pengeluaran Lainnya',
];

export async function getCategories(jenis: 'masuk' | 'keluar' = 'keluar'): Promise<string[]> {
  const defaults = jenis === 'masuk' ? DEFAULT_INCOME_CATEGORIES : DEFAULT_EXPENSE_CATEGORIES;

  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase.from('categories').select('nama, jenis').order('nama');
      if (!error && data && data.length > 0) {
        const filtered = data.filter((item: any) => !item.jenis || item.jenis === jenis).map((item: any) => item.nama);
        if (filtered.length > 0) {
          return Array.from(new Set([...defaults, ...filtered]));
        }
      }
    } catch {
      // Fallback
    }
  }

  const storedKey = jenis === 'masuk' ? 'arka_categories_masuk' : KEYS.CATEGORIES;
  const stored = getItem<string[]>(storedKey, []);
  if (!stored || stored.length === 0) {
    setItem(storedKey, defaults);
    return defaults;
  }
  return Array.from(new Set([...defaults, ...stored]));
}

export async function addCategory(nama: string, jenis: 'masuk' | 'keluar' = 'keluar'): Promise<string[]> {
  const current = await getCategories(jenis);
  const trimmed = nama.trim();
  if (!trimmed || current.includes(trimmed)) return current;

  const updated = [...current, trimmed];
  const storedKey = jenis === 'masuk' ? 'arka_categories_masuk' : KEYS.CATEGORIES;
  setItem(storedKey, updated);

  if (isSupabaseConfigured && supabase) {
    try {
      await supabase.from('categories').upsert({ nama: trimmed, jenis });
    } catch {
      // Fallback
    }
  }

  return updated;
}

export async function deleteCategory(nama: string, jenis: 'masuk' | 'keluar' = 'keluar'): Promise<string[]> {
  const current = await getCategories(jenis);
  const updated = current.filter(c => c !== nama);
  const storedKey = jenis === 'masuk' ? 'arka_categories_masuk' : KEYS.CATEGORIES;
  setItem(storedKey, updated);

  if (isSupabaseConfigured && supabase) {
    try {
      await supabase.from('categories').delete().eq('nama', nama);
    } catch {
      // Fallback
    }
  }

  return updated;
}
