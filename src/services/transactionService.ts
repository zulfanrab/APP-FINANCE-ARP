// ============================================================
// ARKA Finance — Transaction Service (LocalStorage + Supabase Sync)
// Includes: Auto-Split Admin Fee, Parent-Child Relational Sync,
// Project Allocation Binding & Cascade Delete Handling
// ============================================================

import { type Transaction, type TransactionStatus, type FilterOptions } from '../types';
import { getItem, setItem, KEYS } from './storage';
import { supabase, isSupabaseConfigured } from './supabase';
import { getProjects, addProject } from './projectService';

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
    divisi: row.divisi ?? undefined,
    dibuatPada: row.dibuat_pada,
    diupdatePada: row.diupdate_pada,
  };
}

function mapTransactionToRow(t: Transaction): any {
  const row: any = {
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
    parent_transaction_id: t.parentTransactionId ?? null,
    dibuat_pada: t.dibuatPada,
    diupdate_pada: t.diupdatePada,
  };

  if (t.adminNominalCustom !== undefined && t.adminNominalCustom !== null) {
    row.admin_nominal_custom = t.adminNominalCustom;
  }
  if (t.divisi) {
    row.divisi = t.divisi;
  }

  return row;
}

export async function getTransactions(): Promise<Transaction[]> {
  const localData = getItem<Transaction[]>(KEYS.TRANSACTIONS, []);

  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .order('tanggal', { ascending: false });

      if (!error && data) {
        const remoteTxs = data.map(mapRowToTransaction);
        const remoteIds = new Set(remoteTxs.map(t => t.id));

        // Only keep local transactions that were explicitly created offline and never synced to Supabase
        const unsyncedLocal = localData.filter(
          t => !remoteIds.has(t.id) && (t as any).isLocalUnsynced === true
        );

        if (unsyncedLocal.length > 0) {
          console.info(`Found ${unsyncedLocal.length} unsynced local transactions. Resyncing to Supabase...`);
          const rowsToInsert = unsyncedLocal.map(mapTransactionToRow);
          supabase.from('transactions').insert(rowsToInsert).then(({ error: syncErr }) => {
            if (!syncErr) {
              unsyncedLocal.forEach(ut => delete (ut as any).isLocalUnsynced);
              setItem(KEYS.TRANSACTIONS, [...remoteTxs, ...unsyncedLocal]);
            }
          });
        }

        const merged = [...remoteTxs, ...unsyncedLocal].sort(
          (a, b) => new Date(b.tanggal).getTime() - new Date(a.tanggal).getTime()
        );

        setItem(KEYS.TRANSACTIONS, merged);
        return merged;
      } else if (error) {
        console.warn('Supabase select transactions error:', error);
      }
    } catch (err) {
      console.warn('Supabase transactions fetch error, falling back to local storage:', err);
    }
  }

  return [...localData].sort(
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

export async function ensurePosOperasionalForDivisi(
  divisi: 'admin' | 'ahli' | 'it' | 'umum',
  nominal: number,
  tanggal: string
): Promise<string> {
  const labelMap: Record<string, string> = {
    it: 'Operasional Divisi IT',
    admin: 'Operasional Divisi Admin',
    ahli: 'Operasional Divisi Ahli',
    umum: 'Operasional Kantor Umum',
  };

  const targetNama = labelMap[divisi] || 'Operasional Kantor';

  const projects = await getProjects();
  const existing = projects.find(
    p => p.tipe === 'operasional_kantor' && (p.nama === targetNama || p.nama.toLowerCase().includes(divisi.toLowerCase()))
  );

  if (existing) {
    return existing.id;
  }

  // Auto-create Pos Operasional for this Division on the fly!
  const created = await addProject({
    nama: targetNama,
    klien: 'Internal Kantor',
    tipe: 'operasional_kantor',
    anggaran: nominal,
    tanggalMulai: tanggal || new Date().toISOString().split('T')[0],
    deskripsi: `Pos Operasional Kantor untuk ${targetNama}`,
  });

  return created.id;
}

export async function addTransaction(
  data: Omit<Transaction, 'id' | 'status' | 'dibuatPada' | 'diupdatePada'> & { status?: TransactionStatus }
): Promise<Transaction> {
  let proyekIdFinal = data.proyekId;

  // AUTO-ASSIGN / AUTO-CREATE POS OPERASIONAL IF DIVISI IS SELECTED WITHOUT PROYEK_ID
  if (!proyekIdFinal && data.divisi) {
    try {
      proyekIdFinal = await ensurePosOperasionalForDivisi(data.divisi, data.nominal, data.tanggal);
    } catch (err) {
      console.warn('Auto-create Pos Operasional error:', err);
    }
  }

  const newTransaction: Transaction = {
    ...data,
    proyekId: proyekIdFinal,
    id: generateId(),
    status: data.status ?? 'menunggu_approval',
    dibuatPada: now(),
    diupdatePada: now(),
  };

  const transactions = getItem<Transaction[]>(KEYS.TRANSACTIONS, []);
  transactions.unshift(newTransaction);

  // AUTO-SPLIT BIAYA ADMIN BANK IF JALUR TRANSFER REQUIRES FEE
  let adminFeeTx: Transaction | null = null;
  if (
    newTransaction.jenis === 'keluar' &&
    newTransaction.jalurTransfer &&
    newTransaction.jalurTransfer !== 'sesama_bca'
  ) {
    let feeNominal = 0;
    let jalurLabel = '';
    if (newTransaction.jalurTransfer === 'ewallet') {
      feeNominal = 1000;
      jalurLabel = 'Top Up E-Wallet';
    } else if (newTransaction.jalurTransfer === 'bi_fast') {
      feeNominal = 2500;
      jalurLabel = 'BI-FAST';
    } else if (newTransaction.jalurTransfer === 'online_rtgs') {
      feeNominal = 6500;
      jalurLabel = 'Online/RTGS';
    } else if (newTransaction.jalurTransfer === 'custom') {
      feeNominal = newTransaction.adminNominalCustom && newTransaction.adminNominalCustom >= 0
        ? newTransaction.adminNominalCustom
        : 0;
      jalurLabel = 'Admin Custom';
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
      transactions.unshift(adminFeeTx);
    }
  }

  setItem(KEYS.TRANSACTIONS, transactions);

  if (isSupabaseConfigured && supabase) {
    try {
      const rowsToInsert = [mapTransactionToRow(newTransaction)];
      if (adminFeeTx) {
        rowsToInsert.push(mapTransactionToRow(adminFeeTx));
      }
      let { error } = await supabase.from('transactions').insert(rowsToInsert);
      
      // Auto-fallback: if Supabase fails because 'divisi' column doesn't exist yet, retry without 'divisi' key in payload
      if (error && (error.message?.includes('divisi') || error.details?.includes('divisi'))) {
        console.warn('Supabase missing "divisi" column in DB schema cache. Retrying insert without "divisi" column...');
        const retryRows = rowsToInsert.map(r => {
          const copy = { ...r };
          delete copy.divisi;
          return copy;
        });
        const retryRes = await supabase.from('transactions').insert(retryRows);
        error = retryRes.error;
      }

      if (error) {
        console.error('Supabase add transaction error:', error);
        throw new Error(`Gagal Sinkronisasi Cloud (Supabase Error: ${error.message})`);
      }
    } catch (err: any) {
      console.error('Supabase add transaction error:', err);
      throw err;
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
    updated.jalurTransfer !== 'sesama_bca';

  if (requiresAdminFee) {
    let feeNominal = 0;
    let jalurLabel = '';
    if (updated.jalurTransfer === 'ewallet') {
      feeNominal = 1000;
      jalurLabel = 'Top Up E-Wallet';
    } else if (updated.jalurTransfer === 'bi_fast') {
      feeNominal = 2500;
      jalurLabel = 'BI-FAST';
    } else if (updated.jalurTransfer === 'online_rtgs') {
      feeNominal = 6500;
      jalurLabel = 'Online/RTGS';
    } else if (updated.jalurTransfer === 'custom') {
      feeNominal = updated.adminNominalCustom && updated.adminNominalCustom >= 0
        ? updated.adminNominalCustom
        : 0;
      jalurLabel = 'Admin Custom';
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
      const row = mapTransactionToRow(updated);
      let { error } = await supabase.from('transactions').update(row).eq('id', id);

      if (error && (error.message?.includes('divisi') || error.details?.includes('divisi'))) {
        const copy = { ...row };
        delete copy.divisi;
        const retryRes = await supabase.from('transactions').update(copy).eq('id', id);
        error = retryRes.error;
      }

      if (error) throw new Error(`Supabase update error: ${error.message}`);

      if (childToUpdate) {
        await supabase.from('transactions').update(mapTransactionToRow(childToUpdate)).eq('id', childToUpdate.id);
      } else if (childToCreate) {
        await supabase.from('transactions').insert(mapTransactionToRow(childToCreate));
      } else if (childToDeleteId) {
        await supabase.from('transactions').delete().eq('id', childToDeleteId);
      }
    } catch (err: any) {
      console.error('Supabase update transaction error:', err);
      throw err;
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
      const { error } = await supabase.from('transactions').delete().eq('id', id);
      if (error) throw new Error(`Supabase delete error: ${error.message}`);
    } catch (err: any) {
      console.error('Supabase delete transaction error:', err);
      throw err;
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
