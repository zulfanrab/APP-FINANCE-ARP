// ============================================================
// ARKA Finance — Debt & Invoices Service (AP & AR Hub)
// Dual-Layer Storage: LocalStorage + Auto Supabase Sync
// ============================================================

import { supabase, isSupabaseConfigured } from './supabase';
import { type DebtItem, type DebtPaymentHistory, type Attachment } from '../types';
import { addTransaction } from './transactionService';

const DEBTS_KEY = 'arka_debts';

function getLocalDebts(): DebtItem[] {
  try {
    const raw = localStorage.getItem(DEBTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.warn('Gagal membaca cache lokal hutang-piutang:', err);
    return [];
  }
}

function setLocalDebts(items: DebtItem[]): void {
  try {
    localStorage.setItem(DEBTS_KEY, JSON.stringify(items));
  } catch (err) {
    console.warn('Gagal menyimpan cache lokal hutang-piutang:', err);
  }
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

function parsePaymentHistory(raw: any): DebtPaymentHistory[] {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string' && raw.trim().startsWith('[')) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    } catch { /* ignore */ }
  }
  return [];
}

function mapRowToDebt(row: any): DebtItem {
  const total = Number(row.total_nominal || 0);
  const dibayar = Number(row.dibayar_nominal || 0);
  const sisa = Math.max(0, total - dibayar);

  return {
    id: row.id,
    tipe: (row.tipe === 'hutang' ? 'hutang' : 'piutang') as 'piutang' | 'hutang',
    judul: row.judul || 'Tagihan / Hutang',
    kontakNama: row.kontak_nama || '',
    kontakHp: row.kontak_hp || undefined,
    proyekId: row.proyek_id || undefined,
    nomorInvoice: row.nomor_invoice || undefined,
    totalNominal: total,
    dibayarNominal: dibayar,
    sisaNominal: sisa,
    tanggalTerbit: row.tanggal_terbit || new Date().toISOString().split('T')[0],
    tanggalJatuhTempo: row.tanggal_jatuh_tempo || new Date().toISOString().split('T')[0],
    status: row.status || (sisa <= 0 ? 'lunas' : dibayar > 0 ? 'cicilan' : 'belum_lunas'),
    keterangan: row.keterangan || undefined,
    lampiran: parseLampiranField(row.lampiran),
    riwayatPembayaran: parsePaymentHistory(row.riwayat_pembayaran),
    dibuatPada: row.dibuat_pada || new Date().toISOString(),
    diupdatePada: row.diupdate_pada || new Date().toISOString(),
  };
}

function mapDebtToRow(item: DebtItem): any {
  return {
    id: item.id,
    tipe: item.tipe,
    judul: item.judul,
    kontak_nama: item.kontakNama,
    kontak_hp: item.kontakHp || null,
    proyek_id: item.proyekId || null,
    nomor_invoice: item.nomorInvoice || null,
    total_nominal: item.totalNominal,
    dibayar_nominal: item.dibayarNominal,
    sisa_nominal: item.sisaNominal,
    tanggal_terbit: item.tanggalTerbit,
    tanggal_jatuh_tempo: item.tanggalJatuhTempo,
    status: item.status,
    keterangan: item.keterangan || null,
    lampiran: Array.isArray(item.lampiran) ? JSON.stringify(item.lampiran) : null,
    riwayat_pembayaran: JSON.stringify(item.riwayatPembayaran || []),
    dibuat_pada: item.dibuatPada,
    diupdate_pada: item.diupdatePada,
  };
}

/** Get all debts & receivables */
export async function getDebts(): Promise<DebtItem[]> {
  const local = getLocalDebts();

  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('debts')
        .select('*')
        .order('tanggal_jatuh_tempo', { ascending: true });

      if (!error && data) {
        const remote = data.map(mapRowToDebt);
        setLocalDebts(remote);
        return remote;
      }
    } catch (err) {
      console.warn('Supabase debts table not ready, using local cache:', err);
    }
  }

  return local;
}

/** Get single debt item */
export async function getDebtById(id: string): Promise<DebtItem | null> {
  const debts = await getDebts();
  return debts.find(d => d.id === id) || null;
}

/** Add new debt/receivable */
export async function addDebt(item: Omit<DebtItem, 'id' | 'dibuatPada' | 'diupdatePada' | 'sisaNominal'>): Promise<DebtItem> {
  const now = new Date().toISOString();
  const id = 'debt_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
  const total = Number(item.totalNominal || 0);
  const dibayar = Number(item.dibayarNominal || 0);
  const sisa = Math.max(0, total - dibayar);

  let status = item.status;
  if (sisa <= 0) {
    status = 'lunas';
  } else if (dibayar > 0) {
    status = 'cicilan';
  } else {
    status = 'belum_lunas';
  }

  const newDebt: DebtItem = {
    ...item,
    id,
    totalNominal: total,
    dibayarNominal: dibayar,
    sisaNominal: sisa,
    status,
    riwayatPembayaran: item.riwayatPembayaran || [],
    dibuatPada: now,
    diupdatePada: now,
  };

  const local = getLocalDebts();
  const updated = [newDebt, ...local];
  setLocalDebts(updated);

  if (isSupabaseConfigured && supabase) {
    try {
      await supabase.from('debts').insert(mapDebtToRow(newDebt));
    } catch (err) {
      console.warn('Supabase debt insert fallback:', err);
    }
  }

  return newDebt;
}

/** Update existing debt item */
export async function updateDebt(item: DebtItem): Promise<DebtItem> {
  const now = new Date().toISOString();
  const total = Number(item.totalNominal || 0);
  const dibayar = Number(item.dibayarNominal || 0);
  const sisa = Math.max(0, total - dibayar);

  let status = item.status;
  if (sisa <= 0) {
    status = 'lunas';
  } else if (dibayar > 0) {
    status = 'cicilan';
  }

  const updatedDebt: DebtItem = {
    ...item,
    totalNominal: total,
    dibayarNominal: dibayar,
    sisaNominal: sisa,
    status,
    diupdatePada: now,
  };

  const local = getLocalDebts();
  const updated = local.map(d => (d.id === item.id ? updatedDebt : d));
  setLocalDebts(updated);

  if (isSupabaseConfigured && supabase) {
    try {
      await supabase.from('debts').update(mapDebtToRow(updatedDebt)).eq('id', item.id);
    } catch (err) {
      console.warn('Supabase debt update fallback:', err);
    }
  }

  return updatedDebt;
}

/** Delete debt item */
export async function deleteDebt(id: string): Promise<boolean> {
  const local = getLocalDebts();
  const updated = local.filter(d => d.id !== id);
  setLocalDebts(updated);

  if (isSupabaseConfigured && supabase) {
    try {
      await supabase.from('debts').delete().eq('id', id);
    } catch (err) {
      console.warn('Supabase debt delete fallback:', err);
    }
  }

  return true;
}

/** Record payment installment / settlement with optional auto-journaling */
export async function recordDebtPayment(
  debtId: string,
  payment: {
    nominal: number;
    tanggal?: string;
    catatan?: string;
    metodePembayaran?: string;
    rekeningId?: string;
    buktiBayar?: string;
    autoCreateCashTransaction?: boolean;
  }
): Promise<DebtItem | null> {
  const debt = await getDebtById(debtId);
  if (!debt) return null;

  const payNominal = Number(payment.nominal || 0);
  if (payNominal <= 0) return debt;

  const payDate = payment.tanggal || new Date().toISOString().split('T')[0];
  const paymentId = 'pay_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
  let linkedTxId = undefined;

  // Optional: Automatically trigger cash journal transaction in transactions table
  if (payment.autoCreateCashTransaction) {
    try {
      const isPiutang = debt.tipe === 'piutang';
      const createdTx = await addTransaction({
        tanggal: payDate,
        jenis: isPiutang ? 'masuk' : 'keluar',
        nominal: payNominal,
        deskripsi: isPiutang
          ? '[Pelunasan Piutang] ' + debt.judul + ' - ' + debt.kontakNama + (payment.catatan ? ' (' + payment.catatan + ')' : '')
          : '[Pembayaran Hutang] ' + debt.judul + ' - ' + debt.kontakNama + (payment.catatan ? ' (' + payment.catatan + ')' : ''),
        kategori: isPiutang ? 'Pembayaran Klien / Proyek' : 'Operasional Kantor',
        tag: 'operasional',
        proyekId: debt.proyekId || undefined,
        rekeningId: (payment.rekeningId as any) || (isPiutang ? 'bca_utama' : 'kas_admin'),
        lampiran: [],
        buktiTransfer: payment.buktiBayar || undefined,
        status: 'disetujui',
      });
      if (createdTx && createdTx.id) {
        linkedTxId = createdTx.id;
      }
    } catch (txErr) {
      console.warn('Gagal membuat transaksi jurnal otomatis untuk pelunasan hutang-piutang:', txErr);
    }
  }

  const paymentRecord: DebtPaymentHistory = {
    id: paymentId,
    tanggal: payDate,
    nominal: payNominal,
    catatan: payment.catatan,
    transaksiId: linkedTxId,
    metodePembayaran: payment.metodePembayaran,
    rekeningId: payment.rekeningId,
    buktiBayar: payment.buktiBayar,
  };

  const newDibayar = debt.dibayarNominal + payNominal;
  const newSisa = Math.max(0, debt.totalNominal - newDibayar);
  const newStatus = newSisa <= 0 ? 'lunas' : 'cicilan';

  const updatedDebt: DebtItem = {
    ...debt,
    dibayarNominal: newDibayar,
    sisaNominal: newSisa,
    status: newStatus,
    riwayatPembayaran: [paymentRecord, ...(debt.riwayatPembayaran || [])],
    diupdatePada: new Date().toISOString(),
  };

  return updateDebt(updatedDebt);
}
