// ============================================================
// ARKA Finance — Transaction Service (LocalStorage + Supabase Sync)
// Includes: Auto-Split Admin Fee, Parent-Child Relational Sync,
// Project Allocation Binding & Cascade Delete Handling
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
    penerimaDetail: row.penerima_detail ?? undefined,
    jalurTransfer: row.jalur_transfer ?? undefined,
    adminNominalCustom: row.admin_nominal_custom ? Number(row.admin_nominal_custom) : undefined,
    parentTransactionId: row.parent_transaction_id ?? undefined,
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
    penerima_detail: t.penerimaDetail ?? null,
    jalur_transfer: t.jalurTransfer ?? null,
    admin_nominal_custom: t.adminNominalCustom ?? null,
    parent_transaction_id: t.parentTransactionId ?? null,
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
  data: Omit<Transaction, 'id' | 'status' | 'dibuatPada' | 'diupdatePada'> & { status?: TransactionStatus }
): Promise<Transaction> {
  const newTransaction: Transaction = {
    ...data,
    id: generateId(),
    status: data.status ?? 'menunggu_approval',
    dibuatPada: now(),
    diupdatePada: now(),
  };

  const transactions = getItem<Transaction[]>(KEYS.TRANSACTIONS, []);
  transactions.push(newTransaction);

  // AUTO-SPLIT BIAYA ADMIN BANK IF JALUR TRANSFER IS bi_fast, online_rtgs, OR virtual_account
  let adminFeeTx: Transaction | null = null;
  if (
    newTransaction.jenis === 'keluar' &&
    newTransaction.jalurTransfer &&
    (newTransaction.jalurTransfer === 'bi_fast' ||
     newTransaction.jalurTransfer === 'online_rtgs' ||
     newTransaction.jalurTransfer === 'virtual_account')
  ) {
    let feeNominal = 0;
    let jalurLabel = '';
    if (newTransaction.jalurTransfer === 'bi_fast') {
      feeNominal = 2500;
      jalurLabel = 'BI-FAST';
    } else if (newTransaction.jalurTransfer === 'online_rtgs') {
      feeNominal = 6500;
      jalurLabel = 'Online/RTGS';
    } else if (newTransaction.jalurTransfer === 'virtual_account') {
      feeNominal = newTransaction.adminNominalCustom && newTransaction.adminNominalCustom >= 0
        ? newTransaction.adminNominalCustom
        : 1000;
      jalurLabel = 'Virtual Account';
    }

    if (feeNominal > 0) {
      adminFeeTx = {
        id: generateId(),
        tanggal: newTransaction.tanggal,
        jenis: 'keluar',
        deskripsi: `Biaya Admin Bank (${jalurLabel}) - ${newTransaction.deskripsi}`,
        nominal: feeNominal,
        kategori: 'Biaya Admin Bank',
        tag: newTransaction.tag,
        proyekId: newTransaction.proyekId, // CRITICAL: Bound to the SAME project allocation!
        lampiran: [], // Admin fee entry does not require separate attachments
        status: newTransaction.status,
        penerimaDetail: newTransaction.penerimaDetail,
        jalurTransfer: newTransaction.jalurTransfer,
        parentTransactionId: newTransaction.id, // FK link to main transaction
        dibuatPada: now(),
        diupdatePada: now(),
      };
      transactions.push(adminFeeTx);
    }
  }

  setItem(KEYS.TRANSACTIONS, transactions);

  if (isSupabaseConfigured && supabase) {
    try {
      const rowsToInsert = [mapTransactionToRow(newTransaction)];
      if (adminFeeTx) {
        rowsToInsert.push(mapTransactionToRow(adminFeeTx));
      }
      await supabase.from('transactions').insert(rowsToInsert);
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
  }

  // CHECK AND SYNC CHILD ADMIN FEE TRANSACTION
  const childIdx = transactions.findIndex(t => t.parentTransactionId === id);
  let childToUpdate: Transaction | null = null;
  let childToDeleteId: string | null = null;
  let childToCreate: Transaction | null = null;

  const requiresAdminFee =
    updated.jenis === 'keluar' &&
    updated.jalurTransfer &&
    (updated.jalurTransfer === 'bi_fast' ||
     updated.jalurTransfer === 'online_rtgs' ||
     updated.jalurTransfer === 'virtual_account');

  if (requiresAdminFee) {
    let feeNominal = 0;
    let jalurLabel = '';
    if (updated.jalurTransfer === 'bi_fast') {
      feeNominal = 2500;
      jalurLabel = 'BI-FAST';
    } else if (updated.jalurTransfer === 'online_rtgs') {
      feeNominal = 6500;
      jalurLabel = 'Online/RTGS';
    } else if (updated.jalurTransfer === 'virtual_account') {
      feeNominal = updated.adminNominalCustom && updated.adminNominalCustom >= 0
        ? updated.adminNominalCustom
        : 1000;
      jalurLabel = 'Virtual Account';
    }

    if (feeNominal > 0) {
      if (childIdx !== -1) {
        // Update existing child entry
        childToUpdate = {
          ...transactions[childIdx],
          tanggal: updated.tanggal,
          jenis: 'keluar',
          deskripsi: `Biaya Admin Bank (${jalurLabel}) - ${updated.deskripsi}`,
          nominal: feeNominal,
          kategori: 'Biaya Admin Bank',
          tag: updated.tag,
          proyekId: updated.proyekId, // CRITICAL: Sync project allocation!
          penerimaDetail: updated.penerimaDetail,
          jalurTransfer: updated.jalurTransfer,
          status: updated.status,
          diupdatePada: now(),
        };
        transactions[childIdx] = childToUpdate;
      } else {
        // Create new child entry
        childToCreate = {
          id: generateId(),
          tanggal: updated.tanggal,
          jenis: 'keluar',
          deskripsi: `Biaya Admin Bank (${jalurLabel}) - ${updated.deskripsi}`,
          nominal: feeNominal,
          kategori: 'Biaya Admin Bank',
          tag: updated.tag,
          proyekId: updated.proyekId, // CRITICAL: Same project allocation!
          lampiran: [],
          status: updated.status,
          penerimaDetail: updated.penerimaDetail,
          jalurTransfer: updated.jalurTransfer,
          parentTransactionId: updated.id,
          dibuatPada: now(),
          diupdatePada: now(),
        };
        transactions.push(childToCreate);
      }
    } else if (childIdx !== -1) {
      childToDeleteId = transactions[childIdx].id;
      transactions.splice(childIdx, 1);
    }
  } else {
    // If sesama_bca or jenis === 'masuk', delete any existing child entry
    if (childIdx !== -1) {
      childToDeleteId = transactions[childIdx].id;
      transactions.splice(childIdx, 1);
    }
  }

  setItem(KEYS.TRANSACTIONS, transactions);

  if (isSupabaseConfigured && supabase) {
    try {
      await supabase.from('transactions').update(mapTransactionToRow(updated)).eq('id', id);

      if (childToUpdate) {
        await supabase.from('transactions').update(mapTransactionToRow(childToUpdate)).eq('id', childToUpdate.id);
      } else if (childToCreate) {
        await supabase.from('transactions').insert(mapTransactionToRow(childToCreate));
      } else if (childToDeleteId) {
        await supabase.from('transactions').delete().eq('id', childToDeleteId);
      }
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
  const filtered = transactions.filter(t => t.id !== id && t.parentTransactionId !== id);
  setItem(KEYS.TRANSACTIONS, filtered);

  if (isSupabaseConfigured && supabase) {
    try {
      // Supabase ON DELETE CASCADE handles deleting child rows with parent_transaction_id = id
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
