// ============================================================
// ARKA Finance — Transaction Service
// Pola async/await: siap diganti fetch() ke backend API
// ============================================================

import { type Transaction, type TransactionStatus, type FilterOptions } from '../types';
import { getItem, setItem, KEYS } from './storage';

function generateId(): string {
  return `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function now(): string {
  return new Date().toISOString();
}

export async function getTransactions(): Promise<Transaction[]> {
  const data = getItem<Transaction[]>(KEYS.TRANSACTIONS, []);
  // Sort by tanggal desc
  return [...data].sort(
    (a, b) => new Date(b.tanggal).getTime() - new Date(a.tanggal).getTime()
  );
}

export async function getTransactionById(id: string): Promise<Transaction | null> {
  const data = getItem<Transaction[]>(KEYS.TRANSACTIONS, []);
  return data.find(t => t.id === id) ?? null;
}

export async function getTransactionsByProject(proyekId: string): Promise<Transaction[]> {
  const data = getItem<Transaction[]>(KEYS.TRANSACTIONS, []);
  return data
    .filter(t => t.proyekId === proyekId)
    .sort((a, b) => new Date(b.tanggal).getTime() - new Date(a.tanggal).getTime());
}

export async function addTransaction(
  data: Omit<Transaction, 'id' | 'status' | 'dibuatPada' | 'diupdatePada'>
): Promise<Transaction> {
  const transactions = getItem<Transaction[]>(KEYS.TRANSACTIONS, []);

  const newTransaction: Transaction = {
    ...data,
    id: generateId(),
    status: 'menunggu_approval',
    dibuatPada: now(),
    diupdatePada: now(),
  };

  transactions.push(newTransaction);
  setItem(KEYS.TRANSACTIONS, transactions);
  return newTransaction;
}

export async function updateTransaction(
  id: string,
  updates: Partial<Omit<Transaction, 'id' | 'dibuatPada'>>
): Promise<Transaction> {
  const transactions = getItem<Transaction[]>(KEYS.TRANSACTIONS, []);
  const idx = transactions.findIndex(t => t.id === id);
  if (idx === -1) throw new Error(`Transaction ${id} not found`);

  transactions[idx] = {
    ...transactions[idx],
    ...updates,
    diupdatePada: now(),
  };

  setItem(KEYS.TRANSACTIONS, transactions);
  return transactions[idx];
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
