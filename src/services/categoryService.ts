// ============================================================
// ARKA Finance — Category Service (Custom Categories Management)
// ============================================================

import { getItem, setItem, KEYS } from './storage';
import { supabase, isSupabaseConfigured } from './supabase';

const DEFAULT_CATEGORIES = [
  'Biaya Proyek',
  'Gaji & Honorarium',
  'Bahan & Material',
  'Transport & Bensin',
  'Konsumsi & Akomodasi',
  'Peralatan & Sewa Alat',
  'Operasional Kantor',
  'Prive Owner',
  'Setoran Modal',
  'Lain-lain',
];

export async function getCategories(): Promise<string[]> {
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase.from('categories').select('nama').order('nama');
      if (!error && data && data.length > 0) {
        const list = data.map((item: any) => item.nama);
        setItem(KEYS.CATEGORIES, list);
        return list;
      }
    } catch {
      // Fallback
    }
  }

  const stored = getItem<string[]>(KEYS.CATEGORIES, []);
  if (!stored || stored.length === 0) {
    setItem(KEYS.CATEGORIES, DEFAULT_CATEGORIES);
    return DEFAULT_CATEGORIES;
  }
  return stored;
}

export async function addCategory(nama: string): Promise<string[]> {
  const current = await getCategories();
  const trimmed = nama.trim();
  if (!trimmed || current.includes(trimmed)) return current;

  const updated = [...current, trimmed];
  setItem(KEYS.CATEGORIES, updated);

  if (isSupabaseConfigured && supabase) {
    try {
      await supabase.from('categories').upsert({ nama: trimmed });
    } catch {
      // Fallback
    }
  }

  return updated;
}

export async function deleteCategory(nama: string): Promise<string[]> {
  const current = await getCategories();
  const updated = current.filter(c => c !== nama);
  setItem(KEYS.CATEGORIES, updated);

  if (isSupabaseConfigured && supabase) {
    try {
      await supabase.from('categories').delete().eq('nama', nama);
    } catch {
      // Fallback
    }
  }

  return updated;
}
