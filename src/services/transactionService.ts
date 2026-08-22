// ============================================================
// ARKA Finance — Transaction Service (LocalStorage + Supabase Sync)
// Includes: Auto-Split Admin Fee, Parent-Child Relational Sync,
// Project Allocation Binding & Cascade Delete Handling
// ============================================================

import { type Transaction, type TransactionStatus, type FilterOptions, type Project, type Attachment } from '../types';
import { getItem, setItem, KEYS } from './storage';
import { supabase, isSupabaseConfigured } from './supabase';
import { getProjects, addProject } from './projectService';
import { calculateCompanyLedger, classifyTransaction, type UnifiedCompanyLedger } from './financialEngine';

function generateId(): string {
  return `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function now(): string {
  return new Date().toISOString();
}

async function safeSupabaseInsert(table: string, payload: any[]) {
  if (!supabase) return { error: null };
  let retryRows = [...payload];
  let { error } = await supabase.from(table).insert(retryRows);
  
  while (error && (error.message?.includes('does not exist') || error.message?.includes('schema cache') || error.message?.includes('Could not find'))) {
    const match = error.message.match(/column "(.*?)"/) || error.message.match(/the '(.*?)' column/);
    if (match && match[1]) {
      const missingCol = match[1];
      console.warn(`Supabase missing "${missingCol}" column. Retrying insert without it...`);
      retryRows = retryRows.map(r => {
        const copy = { ...r };
        delete copy[missingCol];
        return copy;
      });
      const retryRes = await supabase.from(table).insert(retryRows);
      error = retryRes.error;
    } else {
      break;
    }
  }
  return { error };
}

async function safeSupabaseUpdate(table: string, row: any, id: string): Promise<{ error: any }> {
  if (!supabase) return { error: null };
  const retryRow = { ...row };

  // Always stringify lampiran array for maximum PostgreSQL column type compatibility (JSONB & TEXT)
  if (Array.isArray(retryRow.lampiran)) {
    try {
      retryRow.lampiran = JSON.stringify(retryRow.lampiran);
    } catch { /* fallback */ }
  }

  const performUpdate = async (): Promise<{ error: any }> => {
    let { error } = await supabase!.from(table).update(retryRow).eq('id', id);

    while (error && (error.message?.includes('does not exist') || error.message?.includes('schema cache') || error.message?.includes('Could not find'))) {
      const match = error.message.match(/column "(.*?)"/) || error.message.match(/the '(.*?)' column/);
      if (match && match[1]) {
        const missingCol = match[1];
        if (['lampiran', 'nominal', 'deskripsi', 'status', 'tanggal', 'kategori', 'rekening_id', 'rekening_tujuan_id'].includes(missingCol)) {
          console.error(`Cannot strip core column "${missingCol}" from Supabase update payload!`);
          break;
        }
        console.warn(`Supabase missing "${missingCol}" column. Retrying update without it...`);
        delete retryRow[missingCol];
        const retryRes = await supabase!.from(table).update(retryRow).eq('id', id);
        error = retryRes.error;
      } else {
        break;
      }
    }
    return { error };
  };

  const timeoutPromise = new Promise<{ error: any }>((resolve) =>
    setTimeout(() => {
      console.warn(`Supabase update timeout on table "${table}" (id: ${id}). Proceeding with local cache.`);
      resolve({ error: null });
    }, 7000)
  );

  return Promise.race([performUpdate(), timeoutPromise]);
}

function parseLampiranField(raw: any): Attachment[] {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string' && raw.trim().startsWith('[')) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    } catch { /* ignore */ }
  }
  return [];
}

function mapRowToTransaction(row: any): Transaction {
  const recId = (row.rekening_id && typeof row.rekening_id === 'string' && row.rekening_id.trim()) 
    ? row.rekening_id 
    : (row.jenis === 'masuk' ? 'bca_utama' : (row.proyek_id ? 'kas_admin' : 'bca_utama'));

  return {
    id: row.id,
    tanggal: row.tanggal,
    jenis: row.jenis,
    deskripsi: row.deskripsi,
    nominal: Number(row.nominal),
    kategori: row.kategori,
    tag: row.tag ?? undefined,
    proyekId: row.proyek_id ?? undefined,
    suratPengajuanId: row.surat_pengajuan_id || row.suratPengajuanId || undefined,
    lampiran: parseLampiranField(row.lampiran),
    status: row.status,
    buktiTransfer: row.bukti_transfer ?? undefined,
    catatanPenolakan: row.catatan_penolakan ?? undefined,
    penerimaDetail: row.penerima_detail ?? undefined,
    jalurTransfer: row.jalur_transfer ?? undefined,
    rekeningId: recId,
    rekeningTujuanId: row.rekening_tujuan_id ?? undefined,
    adminNominalCustom: row.admin_nominal_custom ? Number(row.admin_nominal_custom) : undefined,
    parentTransactionId: row.parent_transaction_id ?? undefined,
    divisi: row.divisi ?? undefined,
    urutan: row.urutan ? Number(row.urutan) : undefined,
    isDeleted: Boolean(row.is_deleted),
    deletedAt: row.deleted_at ?? undefined,
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
    surat_pengajuan_id: t.suratPengajuanId ?? null,
    lampiran: t.lampiran ?? [],
    status: t.status,
    bukti_transfer: t.buktiTransfer ?? null,
    catatan_penolakan: t.catatanPenolakan ?? null,
    penerima_detail: t.penerimaDetail ?? null,
    jalur_transfer: t.jalurTransfer ?? null,
    rekening_id: t.rekeningId ?? (t.jenis === 'masuk' ? 'bca_utama' : (t.proyekId ? 'kas_admin' : 'bca_utama')),
    rekening_tujuan_id: t.rekeningTujuanId ?? null,
    parent_transaction_id: t.parentTransactionId ?? null,
    urutan: t.urutan ?? null,
    is_deleted: t.isDeleted ?? false,
    deleted_at: t.deletedAt ?? null,
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

function withTimeout<T>(promise: PromiseLike<T>, timeoutMs: number = 3000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Operation timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    Promise.resolve(promise)
      .then(res => {
        clearTimeout(timer);
        resolve(res);
      })
      .catch(err => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

export async function getTransactions(includeDeleted: boolean = false): Promise<Transaction[]> {
  const localData = getItem<Transaction[]>(KEYS.TRANSACTIONS, []);
  const trashTxs = getItem<Transaction[]>(KEYS.TRASH_TRANSACTIONS, []);
  const trashIds = new Set(trashTxs.map(t => t.id));
  const timeoutMs = localData.length === 0 ? 10000 : 4000;

  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await withTimeout(
        supabase
          .from('transactions')
          .select('*')
          .order('tanggal', { ascending: false }),
        timeoutMs
      );

      if (!error && data) {
        const localMap = new Map(localData.map(t => [t.id, t]));
        const remoteTxs = data
          .filter(row => !trashIds.has(row.id)) // CRITICAL: Never resurrect deleted items that are in trash
          .map(row => {
            const tx = mapRowToTransaction(row);
            const local = localMap.get(tx.id);
            if (local) {
              // CRITICAL: Always preserve local attachments if local has equal/more items than remote
              const localAtts = parseLampiranField(local.lampiran);
              const remoteAtts = parseLampiranField(tx.lampiran);

              if (localAtts.length >= remoteAtts.length && localAtts.length > 0) {
                tx.lampiran = localAtts;
              }
              if (!tx.buktiTransfer && local.buktiTransfer) {
                tx.buktiTransfer = local.buktiTransfer;
              }
              if (!tx.suratPengajuanId && local.suratPengajuanId) {
                tx.suratPengajuanId = local.suratPengajuanId;
              }
            }
            return tx;
          });
        const remoteIds = new Set(remoteTxs.map(t => t.id));

        // Only keep local transactions that were explicitly created offline and never synced to Supabase
        const unsyncedLocal = localData.filter(
          t => !remoteIds.has(t.id) && !trashIds.has(t.id) && (t as any).isLocalUnsynced === true
        );

        if (unsyncedLocal.length > 0) {
          console.info(`Found ${unsyncedLocal.length} unsynced local transactions. Resyncing to Supabase...`);
          const rowsToInsert = unsyncedLocal.map(mapTransactionToRow);
          safeSupabaseInsert('transactions', rowsToInsert).then(({ error: syncErr }) => {
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
        return includeDeleted ? [...merged, ...trashTxs] : merged;
      } else if (error) {
        console.warn('Supabase select transactions error:', error);
      }
    } catch (err) {
      console.warn('Supabase transactions fetch error, falling back to local storage:', err);
    }
  }

  const sorted = [...localData].filter(t => !trashIds.has(t.id)).sort(
    (a, b) => new Date(b.tanggal).getTime() - new Date(a.tanggal).getTime()
  );
  return includeDeleted ? [...sorted, ...trashTxs] : sorted;
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
  _nominal?: number,
  _tanggal?: string
): Promise<string> {
  const labelMap: Record<string, string> = {
    it: 'Operasional Divisi IT',
    admin: 'Operasional Divisi Admin',
    ahli: 'Operasional Divisi Ahli',
    umum: 'Operasional Kantor Umum',
  };

  const targetNama = labelMap[divisi] || 'Operasional Kantor';

  const allProjects = await getProjects(false);
  const existing = allProjects.find(
    p => p.tipe === 'operasional_kantor' && (p.nama === targetNama || p.nama.toLowerCase().includes(divisi.toLowerCase()))
  );

  if (existing && !existing.isDeleted) {
    return existing.id;
  }

  // Do NOT auto-create zombie projects if user hasn't explicitly made one!
  return '';
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

  // HARD GUARDRAIL: Validate balance before allowing outflow/mutasi
  const isTargetApproved = newTransaction.status === 'disetujui' || newTransaction.status === 'selesai';

  if (isTargetApproved) {
    const projects = getItem<Project[]>(KEYS.PROJECTS, []);
    const currentLedger = calculateCompanyLedger(transactions, projects);
    const classification = classifyTransaction(newTransaction);

    let feeNominalPreview = 0;
    if (
      newTransaction.jenis === 'keluar' &&
      newTransaction.jalurTransfer &&
      newTransaction.jalurTransfer !== 'sesama_bca'
    ) {
      if (newTransaction.jalurTransfer === 'ewallet') feeNominalPreview = 1000;
      else if (newTransaction.jalurTransfer === 'bi_fast') feeNominalPreview = 2500;
      else if (newTransaction.jalurTransfer === 'online_rtgs') feeNominalPreview = 6500;
      else if (newTransaction.jalurTransfer === 'custom') feeNominalPreview = newTransaction.adminNominalCustom || 0;
    }

    const sourceRekening = newTransaction.rekeningId || 'kas_admin';
    const sakuBalance = currentLedger.accountBalances[sourceRekening] || 0;
    
    // PHYSICAL CASH VALIDATION (Primary Guardrail)
    if (newTransaction.jenis === 'keluar' || classification.isMutasiInternal) {
       const totalOutflowRequired = newTransaction.nominal + feeNominalPreview;
       if (Math.round(totalOutflowRequired) > Math.round(sakuBalance)) {
         const namaSaku = sourceRekening === 'bca_utama' ? 'BCA Utama' : sourceRekening === 'bri_utama' ? 'BRI Utama' : 'Kas Admin';
         throw new Error(`Saldo ${namaSaku} Tidak Mencukupi!`);
       }
    }

    // VIRTUAL BUDGET VALIDATION (Dual Deduction for Real Field/Contract Projects ONLY)
    if (newTransaction.proyekId && newTransaction.jenis === 'keluar' && !classification.isMutasiInternal) {
      const targetProj = projects.find(p => p.id === newTransaction.proyekId);
      const isOperasionalKantor = targetProj?.tipe === 'operasional_kantor';
      
      // Skip project balance check for internal office/division operations!
      if (!isOperasionalKantor) {
        const projectBalance = currentLedger.projectCashMap[newTransaction.proyekId] || 0;
        if (Math.round(newTransaction.nominal) > Math.round(projectBalance)) {
          throw new Error('Saldo Kas Proyek Tidak Mencukupi!');
        }
      }
    }
  }

  transactions.unshift(newTransaction);

  // AUTO-SPLIT BIAYA ADMIN BANK IF JALUR TRANSFER REQUIRES FEE (IDEMPOTENT CHECK)
  const isAlreadyAdminFee =
    newTransaction.kategori === 'Biaya Admin Bank' ||
    Boolean(newTransaction.parentTransactionId) ||
    newTransaction.deskripsi.toLowerCase().includes('biaya admin bank');

  let adminFeeTx: Transaction | null = null;
  if (
    !isAlreadyAdminFee &&
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
        rekeningId: newTransaction.rekeningId, // CRITICAL: Bound to the SAME pocket!
        proyekId: newTransaction.proyekId, // CRITICAL: Bound to the SAME project allocation!
        divisi: newTransaction.divisi, // CRITICAL: Inherit the SAME division
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
      
      const { error } = await safeSupabaseInsert('transactions', rowsToInsert);

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
  } else {
    transactions.unshift(updated);
  }

  // CHECK AND SYNC CHILD ADMIN FEE TRANSACTION (IDEMPOTENT CHECK)
  const isAlreadyAdminFee =
    updated.kategori === 'Biaya Admin Bank' ||
    Boolean(updated.parentTransactionId) ||
    updated.deskripsi.toLowerCase().includes('biaya admin bank');

  const childIdx = transactions.findIndex(t => t.parentTransactionId === id);
  let childToUpdate: Transaction | null = null;
  let childToDeleteId: string | null = null;
  let childToCreate: Transaction | null = null;

  const requiresAdminFee =
    !isAlreadyAdminFee &&
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
          rekeningId: updated.rekeningId, // CRITICAL: Sync pocket allocation!
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
          rekeningId: updated.rekeningId,
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
      const { error } = await safeSupabaseUpdate('transactions', row, id);

      if (error) throw new Error(`Supabase update error: ${error.message}`);

      if (childToUpdate) {
        await safeSupabaseUpdate('transactions', mapTransactionToRow(childToUpdate), childToUpdate.id);
      } else if (childToCreate) {
        await safeSupabaseInsert('transactions', [mapTransactionToRow(childToCreate)]);
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

export async function getDeletedTransactions(): Promise<Transaction[]> {
  const trash = getItem<Transaction[]>(KEYS.TRASH_TRANSACTIONS, []);
  const allTxs = getItem<Transaction[]>(KEYS.TRANSACTIONS, []);
  const legacyDeleted = allTxs.filter(t => t.isDeleted === true);

  const map = new Map<string, Transaction>();
  trash.forEach(t => map.set(t.id, t));
  legacyDeleted.forEach(t => map.set(t.id, t));

  return Array.from(map.values()).sort(
    (a, b) =>
      new Date(b.deletedAt || b.diupdatePada || b.tanggal).getTime() -
      new Date(a.deletedAt || a.diupdatePada || a.tanggal).getTime()
  );
}

export async function deleteTransaction(id: string): Promise<void> {
  const transactions = getItem<Transaction[]>(KEYS.TRANSACTIONS, []);
  const nowStr = new Date().toISOString();

  const toDelete = transactions.filter(t => t.id === id || t.parentTransactionId === id);
  const remaining = transactions.filter(t => t.id !== id && t.parentTransactionId !== id);

  // 1. Move to Trash Storage
  const currentTrash = getItem<Transaction[]>(KEYS.TRASH_TRANSACTIONS, []);
  const newTrashItems = toDelete.map(t => ({
    ...t,
    isDeleted: true,
    deletedAt: nowStr,
    diupdatePada: nowStr,
  }));
  const trashMap = new Map(currentTrash.map(t => [t.id, t]));
  newTrashItems.forEach(t => trashMap.set(t.id, t));

  setItem(KEYS.TRASH_TRANSACTIONS, Array.from(trashMap.values()));
  setItem(KEYS.TRANSACTIONS, remaining);

  // 2. Actually DELETE from Supabase so it NEVER resurfaces on getTransactions
  if (isSupabaseConfigured && supabase) {
    try {
      const deleteIds = toDelete.map(t => t.id);
      if (deleteIds.length > 0) {
        await supabase.from('transactions').delete().in('id', deleteIds);
      } else {
        await supabase.from('transactions').delete().eq('id', id);
      }
    } catch (err: any) {
      console.warn('Supabase delete transaction warning:', err);
    }
  }
}

export async function restoreTransaction(id: string): Promise<void> {
  const currentTrash = getItem<Transaction[]>(KEYS.TRASH_TRANSACTIONS, []);
  const toRestore = currentTrash.filter(t => t.id === id || t.parentTransactionId === id);
  const remainingTrash = currentTrash.filter(t => t.id !== id && t.parentTransactionId !== id);

  setItem(KEYS.TRASH_TRANSACTIONS, remainingTrash);

  const transactions = getItem<Transaction[]>(KEYS.TRANSACTIONS, []);
  const restoredItems = toRestore.map(t => ({ ...t, isDeleted: false, deletedAt: undefined }));
  const txMap = new Map(transactions.map(t => [t.id, t]));
  restoredItems.forEach(t => txMap.set(t.id, t));

  const updatedTxs = Array.from(txMap.values());
  setItem(KEYS.TRANSACTIONS, updatedTxs);

  // Re-insert into Supabase
  if (isSupabaseConfigured && supabase && restoredItems.length > 0) {
    try {
      const rows = restoredItems.map(mapTransactionToRow);
      await safeSupabaseInsert('transactions', rows);
    } catch (err: any) {
      console.warn('Supabase restore transaction warning:', err);
    }
  }
}

export async function permanentDeleteTransaction(id: string): Promise<void> {
  const currentTrash = getItem<Transaction[]>(KEYS.TRASH_TRANSACTIONS, []);
  setItem(KEYS.TRASH_TRANSACTIONS, currentTrash.filter(t => t.id !== id && t.parentTransactionId !== id));

  const transactions = getItem<Transaction[]>(KEYS.TRANSACTIONS, []);
  setItem(KEYS.TRANSACTIONS, transactions.filter(t => t.id !== id && t.parentTransactionId !== id));

  if (isSupabaseConfigured && supabase) {
    try {
      await supabase.from('transactions').delete().eq('id', id);
      await supabase.from('transactions').delete().eq('parent_transaction_id', id);
    } catch (err: any) {
      console.warn('Supabase permanent delete error:', err);
    }
  }
}

export async function emptyTrashBin(): Promise<void> {
  const currentTrash = getItem<Transaction[]>(KEYS.TRASH_TRANSACTIONS, []);
  const trashIds = currentTrash.map(t => t.id);
  setItem(KEYS.TRASH_TRANSACTIONS, []);

  const transactions = getItem<Transaction[]>(KEYS.TRANSACTIONS, []);
  setItem(KEYS.TRANSACTIONS, transactions.filter(t => !t.isDeleted));

  if (isSupabaseConfigured && supabase && trashIds.length > 0) {
    try {
      await supabase.from('transactions').delete().in('id', trashIds);
    } catch (err: any) {
      console.warn('Supabase empty trash error:', err);
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

/**
 * Display Sorting & Grouping for Parent-Child Transactions (e.g. Main Transaction & its Auto-Split Admin Fee).
 * - Parent transactions (where parentTransactionId is null/undefined) are sorted by date & created_at.
 * - Each Child transaction (where parentTransactionId === parent.id) is attached IMMEDIATELY below its parent.
 * - Preserves running balance calculation order.
 */
export function groupAndSortTransactions(
  transactions: Transaction[],
  order: 'asc' | 'desc' = 'asc'
): Transaction[] {
  if (!transactions || !Array.isArray(transactions) || transactions.length === 0) return [];

  const cleanTransactions = transactions.filter(t => t && typeof t === 'object' && t.id);

  const parentTxs: Transaction[] = [];
  const childrenMap = new Map<string, Transaction[]>();
  const processedChildIds = new Set<string>();

  // 1. Index children by parentTransactionId
  for (const t of cleanTransactions) {
    if (t.parentTransactionId) {
      const existing = childrenMap.get(t.parentTransactionId) || [];
      existing.push(t);
      childrenMap.set(t.parentTransactionId, existing);
    } else {
      parentTxs.push(t);
    }
  }

  // 2. Sort parent transactions by urutan (if custom order is defined), then date & created_at
  const sortedParents = [...parentTxs].sort((a, b) => {
    if (a.urutan != null && b.urutan != null && a.urutan !== b.urutan) {
      return a.urutan - b.urutan; // urutan 1 is always top position!
    }
    if (a.urutan != null && b.urutan == null) return -1;
    if (a.urutan == null && b.urutan != null) return 1;

    const timeA = a.tanggal ? new Date(a.tanggal).getTime() : 0;
    const timeB = b.tanggal ? new Date(b.tanggal).getTime() : 0;
    if (timeA !== timeB && !isNaN(timeA) && !isNaN(timeB)) {
      return order === 'asc' ? timeA - timeB : timeB - timeA;
    }
    const createdA = a.dibuatPada || a.tanggal ? new Date(a.dibuatPada || a.tanggal).getTime() : 0;
    const createdB = b.dibuatPada || b.tanggal ? new Date(b.dibuatPada || b.tanggal).getTime() : 0;
    return order === 'asc' ? (createdA || 0) - (createdB || 0) : (createdB || 0) - (createdA || 0);
  });

  // 3. Glue children immediately below their parent
  const result: Transaction[] = [];

  for (const parent of sortedParents) {
    result.push(parent);

    const children = childrenMap.get(parent.id);
    if (children && children.length > 0) {
      const sortedChildren = [...children].sort((a, b) => {
        const createdA = a.dibuatPada || a.tanggal ? new Date(a.dibuatPada || a.tanggal).getTime() : 0;
        const createdB = b.dibuatPada || b.tanggal ? new Date(b.dibuatPada || b.tanggal).getTime() : 0;
        return (createdA || 0) - (createdB || 0);
      });

      for (const child of sortedChildren) {
        result.push(child);
        processedChildIds.add(child.id);
      }
    }
  }

  // 4. Preserve orphan children whose parent is not present in the current array
  for (const t of cleanTransactions) {
    if (t.parentTransactionId && !processedChildIds.has(t.id)) {
      result.push(t);
    }
  }

  return result;
}

/**
 * Saves custom Drag & Drop transaction ordering
 * Updates LocalStorage and syncs to Supabase seamlessly
 */
export async function saveTransactionCustomOrder(orderedIds: string[]): Promise<Transaction[]> {
  const transactions = getItem<Transaction[]>(KEYS.TRANSACTIONS, []);
  const orderMap = new Map(orderedIds.map((id, index) => [id, index + 1]));

  const updatedTransactions = transactions.map(t => {
    if (orderMap.has(t.id)) {
      return { ...t, urutan: orderMap.get(t.id), diupdatePada: now() };
    }
    return t;
  });

  setItem(KEYS.TRANSACTIONS, updatedTransactions);

  if (isSupabaseConfigured && supabase) {
    try {
      const updates = Array.from(orderMap.entries()).map(([id, urutan]) =>
        safeSupabaseUpdate('transactions', { urutan }, id)
      );
      await Promise.all(updates);
    } catch (err) {
      console.warn('Supabase reorder sync warning:', err);
    }
  }

  return updatedTransactions;
}
