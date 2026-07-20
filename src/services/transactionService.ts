// ============================================================
// ARKA Finance — Transaction Service (LocalStorage + Supabase Sync)
// ============================================================

import { type Transaction, type TransactionStatus, type FilterOptions } from '../types';
import { getItem, setItem, KEYS } from './storage';
import { supabase, isSupabaseConfigured } from './supabase';

function generateId(): string {
  return `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function now(): string {
  return new Date().toISOString();
}

function mapRowToTransaction(row: any): Transaction {
  return {
    id: row.id,
    tanggal: row.tanggal,
    jenis: row.jenis,
    deskripsi: row.deskripsi,
    nominal: Number(row.nominal),
    kategori: row.kategori,
    tag: row.tag ?? undefined,
    proyekId: row.proyek_id ?? undefined,
    lampiran: Array.isArray(row.lampiran) ? row.lampiran : [],
    status: row.status,
    buktiTransfer: row.bukti_transfer ?? undefined,
    catatanPenolakan: row.catatan_penolakan ?? undefined,
    dibuatPada: row.dibuat_pada,
    diupdatePada: row.diupdate_pada,
  };
}

function mapTransactionToRow(t: Transaction): any {
  return {
    id: t.id,
    tanggal: t.tanggal,
    jenis: t.jenis,
    deskripsi: t.deskripsi,
    nominal: t.nominal,
    kategori: t.kategori,
    tag: t.tag ?? null,
    proyek_id: t.proyekId ?? null,
    lampiran: t.lampiran ?? [],
    status: t.status,
    bukti_transfer: t.buktiTransfer ?? null,
    catatan_penolakan: t.catatanPenolakan ?? null,
    dibuat_pada: t.dibuatPada,
    diupdate_pada: t.diupdatePada,
  };
}

export async function getTransactions(): Promise<Transaction[]> {
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .order('tanggal', { ascending: false });

      if (!error && data) {
        const transactions = data.map(mapRowToTransaction);
        setItem(KEYS.TRANSACTIONS, transactions);
        return transactions;
      }
    } catch (err) {
      console.warn('Supabase transactions fetch error, falling back to local storage:', err);
    }
  }

  const data = getItem<Transaction[]>(KEYS.TRANSACTIONS, []);
  return [...data].sort(
    (a, b) => new Date(b.tanggal).getTime() - new Date(a.tanggal).getTime()
  );
}

export async function getTransactionById(id: string): Promise<Transaction | null> {
  const all = await getTransactions();
  return all.find(t => t.id === id) ?? null;
}

export async function getTransactionsByProject(proyekId: string): Promise<Transaction[]> {
  const all = await getTransactions();
  return all
    .filter(t => t.proyekId === proyekId)
    .sort((a, b) => new Date(b.tanggal).getTime() - new Date(a.tanggal).getTime());
}

export async function addTransaction(
  data: Omit<Transaction, 'id' | 'status' | 'dibuatPada' | 'diupdatePada'>
): Promise<Transaction> {
  const newTransaction: Transaction = {
    ...data,
    id: generateId(),
    status: 'menunggu_approval',
    dibuatPada: now(),
    diupdatePada: now(),
  };

  const transactions = getItem<Transaction[]>(KEYS.TRANSACTIONS, []);
  transactions.push(newTransaction);
  setItem(KEYS.TRANSACTIONS, transactions);

  if (isSupabaseConfigured && supabase) {
    try {
      await supabase.from('transactions').insert(mapTransactionToRow(newTransaction));
    } catch (err) {
      console.warn('Supabase add transaction error:', err);
    }
  }

  return newTransaction;
}

export async function updateTransaction(
  id: string,
  updates: Partial<Omit<Transaction, 'id' | 'dibuatPada'>>
): Promise<Transaction> {
  const transactions = getItem<Transaction[]>(KEYS.TRANSACTIONS, []);
  const idx = transactions.findIndex(t => t.id === id);

  const current = idx !== -1 ? transactions[idx] : await getTransactionById(id);
  if (!current) throw new Error(`Transaction ${id} not found`);

  const updated: Transaction = {
    ...current,
    ...updates,
    diupdatePada: now(),
  };

  if (idx !== -1) {
    transactions[idx] = updated;
    setItem(KEYS.TRANSACTIONS, transactions);
  }

  if (isSupabaseConfigured && supabase) {
    try {
      await supabase.from('transactions').update(mapTransactionToRow(updated)).eq('id', id);
    } catch (err) {
      console.warn('Supabase update transaction error:', err);
    }
  }

  return updated;
}

export async function updateTransactionStatus(
  id: string,
  status: TransactionStatus,
  notes?: string
): Promise<Transaction> {
  const updates: Partial<Transaction> = { status };
  if (notes !== undefined) {
    if (status === 'ditolak') updates.catatanPenolakan = notes;
  }
  return updateTransaction(id, updates);
}

export async function uploadBuktiTransfer(
  id: string,
  buktiTransfer: string
): Promise<Transaction> {
  return updateTransaction(id, { buktiTransfer, status: 'selesai' });
}

export async function deleteTransaction(id: string): Promise<void> {
  const transactions = getItem<Transaction[]>(KEYS.TRANSACTIONS, []);
  const filtered = transactions.filter(t => t.id !== id);
  setItem(KEYS.TRANSACTIONS, filtered);

  if (isSupabaseConfigured && supabase) {
    try {
      await supabase.from('transactions').delete().eq('id', id);
    } catch (err) {
      console.warn('Supabase delete transaction error:', err);
    }
  }
}

export async function filterTransactions(
  options: FilterOptions
): Promise<Transaction[]> {
  const all = await getTransactions();

  return all.filter(t => {
    if (options.jenis && options.jenis !== 'semua' && t.jenis !== options.jenis) return false;
    if (options.tag && options.tag !== 'semua' && t.tag !== options.tag) return false;
    if (options.status && options.status !== 'semua' && t.status !== options.status) return false;
    if (options.proyekId && t.proyekId !== options.proyekId) return false;
    if (options.tanggalDari) {
      const from = new Date(options.tanggalDari);
      const txDate = new Date(t.tanggal);
      if (txDate < from) return false;
    }
    if (options.tanggalSampai) {
      const to = new Date(options.tanggalSampai);
      to.setHours(23, 59, 59, 999);
      const txDate = new Date(t.tanggal);
      if (txDate > to) return false;
    }
    return true;
  });
}
