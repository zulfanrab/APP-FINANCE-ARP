// ============================================================
// ARKA Finance — Analytics Service
// Semua kalkulasi dihitung dari data transaksi real
// KAS UTAMA = hanya transaksi TANPA proyekId
// DANA PROYEK = hanya transaksi DENGAN proyekId (terpisah)
// ============================================================

import {
  type Transaction,
  type DashboardSummary,
  type MonthlyChartData,
  type CategoryBreakdown,
  type CashflowTrend,
} from '../types';

// ---- Helper ----
function isInMonth(dateStr: string, year: number, month: number): boolean {
  const d = new Date(dateStr);
  return d.getFullYear() === year && d.getMonth() === month;
}

function isApproved(t: Transaction): boolean {
  return t.status === 'disetujui' || t.status === 'selesai';
}

/** Check if a transaction is a "Suntikan Modal Proyek" (capital injection into project) */
export function isSuntikanModal(t: Transaction): boolean {
  return t.deskripsi.startsWith('Suntikan Modal Proyek:') || t.kategori === 'Suntikan Modal Proyek';
}

/** Check if a transaction is an internal cash transfer (Mutasi Internal) */
export function isMutasiInternal(t: Transaction): boolean {
  if (isSuntikanModal(t)) return true;
  if (t.kategori === 'Refund Dana Proyek ke Kas Utama') return true;
  if (t.kategori === 'Mutasi Internal / Transfer Kas') return true;
  return false;
}

/**
 * Check if a transaction belongs to KAS UTAMA (main company cash).
 * Kas Utama includes:
 * - All transactions WITHOUT proyekId
 * - Suntikan Modal transactions (they represent money leaving kas utama INTO a project)
 * Kas Utama excludes:
 * - All transactions WITH proyekId (those are internal project fund movements)
 */
export function isKasUtamaTransaction(t: Transaction): boolean {
  // Suntikan Modal always affects kas utama (it's the act of moving money OUT)
  if (isSuntikanModal(t)) return true;
  // Transactions tied to a project do NOT affect kas utama
  if (t.proyekId) return false;
  return true;
}

/**
 * Check if transaction is a "Refund Sisa Dana ke Kas Utama" from a completed project.
 */
export function isRefundToKasUtama(t: Transaction): boolean {
  return t.kategori === 'Refund Dana Proyek ke Kas Utama' && t.jenis === 'masuk' && !t.proyekId;
}

// ---- Dashboard Summary (COMBINED COMPANY CASH & REAL P&L) ----
export function getDashboardSummary(
  transactions: Transaction[],
  proyekAktifCount: number
): DashboardSummary {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  let sisaKasUtama = 0;
  let totalKasProyek = 0;

  let pemasukanBulanIni = 0;
  let pengeluaranOperasionalBulanIni = 0;
  let pribadiOwnerBulanIni = 0;

  // Calculate Kas Utama balance
  for (const t of transactions) {
    if (!isApproved(t)) continue;

    // Kas Utama Balance Calculation
    if (isKasUtamaTransaction(t)) {
      if (t.jenis === 'masuk') {
        sisaKasUtama += t.nominal;
      } else {
        sisaKasUtama -= t.nominal;
      }
    }

    // P&L Real Omzet & Expenses in current month (Excluding Internal Transfers)
    if (isInMonth(t.tanggal, year, month)) {
      if (!isMutasiInternal(t)) {
        if (t.jenis === 'masuk') {
          pemasukanBulanIni += t.nominal;
        } else {
          if (t.tag === 'operasional') pengeluaranOperasionalBulanIni += t.nominal;
          if (t.tag === 'pribadi') pribadiOwnerBulanIni += t.nominal;
        }
      } else if (t.tag === 'pribadi' && t.jenis === 'keluar') {
        pribadiOwnerBulanIni += t.nominal;
      }
    }
  }

  // Calculate total cash in all project pools
  const projectCashMap: Record<string, number> = {};
  for (const t of transactions) {
    if (!isApproved(t)) continue;
    if (!t.proyekId) continue; // Only project-bound transactions

    if (!projectCashMap[t.proyekId]) projectCashMap[t.proyekId] = 0;

    if (t.jenis === 'masuk') {
      projectCashMap[t.proyekId] += t.nominal;
    } else {
      projectCashMap[t.proyekId] -= t.nominal;
    }
  }

  for (const cash of Object.values(projectCashMap)) {
    totalKasProyek += cash;
  }

  const sisaKasTotal = sisaKasUtama + totalKasProyek;

  return {
    sisaKasTotal,
    sisaKasUtama,
    totalKasProyek,
    sisaKas: sisaKasTotal, // legacy compatibility
    totalPemasukanBulanIni: pemasukanBulanIni,
    totalPengeluaranOperasionalBulanIni: pengeluaranOperasionalBulanIni,
    totalPribadiOwnerBulanIni: pribadiOwnerBulanIni,
    proyekAktif: proyekAktifCount,
  };
}

// ---- Monthly Chart (last N months) — REAL P&L ONLY ----
export function getMonthlyChartData(
  transactions: Transaction[],
  months: number = 6
): MonthlyChartData[] {
  const result: MonthlyChartData[] = [];
  const now = new Date();

  for (let i = months - 1; i >= 0; i--) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const year = date.getFullYear();
    const month = date.getMonth();

    const monthLabel = date.toLocaleDateString('id-ID', { month: 'short', year: '2-digit' });

    let pemasukan = 0;
    let pengeluaran = 0;

    for (const t of transactions) {
      if (!isApproved(t)) continue;
      if (isMutasiInternal(t)) continue; // Exclude internal transfers from P&L chart
      if (!isInMonth(t.tanggal, year, month)) continue;

      if (t.jenis === 'masuk') pemasukan += t.nominal;
      else pengeluaran += t.nominal;
    }

    result.push({ bulan: monthLabel, pemasukan, pengeluaran });
  }

  return result;
}

// ---- Category Breakdown (pengeluaran) — REAL EXPENSES ONLY ----
export function getCategoryBreakdown(
  transactions: Transaction[],
  from: Date,
  to: Date
): CategoryBreakdown[] {
  const map: Record<string, number> = {};
  let total = 0;

  for (const t of transactions) {
    if (!isApproved(t)) continue;
    if (t.jenis !== 'keluar') continue;
    if (isMutasiInternal(t)) continue; // Exclude internal transfers from expense breakdown

    const d = new Date(t.tanggal);
    if (d < from || d > to) continue;

    const key = t.kategori || 'Lainnya';
    map[key] = (map[key] ?? 0) + t.nominal;
    total += t.nominal;
  }

  if (total === 0) return [];

  return Object.entries(map)
    .map(([kategori, nominal]) => ({
      kategori,
      nominal,
      percentage: Math.round((nominal / total) * 100),
    }))
    .sort((a, b) => b.nominal - a.nominal);
}

// ---- Category Breakdown PER PROYEK ----
export function getProjectCategoryBreakdown(
  transactions: Transaction[]
): CategoryBreakdown[] {
  const map: Record<string, number> = {};
  let total = 0;

  for (const t of transactions) {
    if (!isApproved(t)) continue;
    if (t.jenis !== 'keluar') continue;
    if (isMutasiInternal(t)) continue;

    const key = t.kategori || 'Lainnya';
    map[key] = (map[key] ?? 0) + t.nominal;
    total += t.nominal;
  }

  if (total === 0) return [];

  return Object.entries(map)
    .map(([kategori, nominal]) => ({
      kategori,
      nominal,
      percentage: Math.round((nominal / total) * 100),
    }))
    .sort((a, b) => b.nominal - a.nominal);
}

// ---- Project Financial Summary (P&L & CASH FLOW SEPARATION) ----
export interface ProjectFinancialSummary {
  modalDisuntikkan: number;
  pemasukanKlien: number;
  totalPengeluaran: number;
  totalRefundMasuk: number;
  realisasiBersih: number;
  sisaDanaProyek: number;
  labaRugiProyek: number;
}

export function getProjectFinancialSummary(
  transactions: Transaction[],
  anggaranModal: number
): ProjectFinancialSummary {
  let modalDisuntikkan = anggaranModal;
  let pemasukanKlien = 0;
  let totalPengeluaran = 0;
  let totalRefundMasuk = 0;

  for (const t of transactions) {
    if (!isApproved(t)) continue;

    if (isSuntikanModal(t)) {
      modalDisuntikkan = Math.max(modalDisuntikkan, t.nominal);
      continue;
    }

    if (t.kategori === 'Refund Dana Proyek ke Kas Utama') {
      if (t.jenis === 'keluar') {
        totalRefundMasuk += t.nominal;
      }
      continue;
    }

    if (isMutasiInternal(t)) {
      continue;
    }

    // Real transactions
    if (t.jenis === 'keluar') {
      totalPengeluaran += t.nominal;
    } else if (t.jenis === 'masuk') {
      pemasukanKlien += t.nominal;
    }
  }

  const realisasiBersih = totalPengeluaran - totalRefundMasuk;
  // Saldo Kas Proyek (Liquidity)
  const sisaDanaProyek = modalDisuntikkan + pemasukanKlien - totalPengeluaran - totalRefundMasuk;
  // Laba-Rugi Proyek (P&L: Invoice Klien - Real Expenses)
  const labaRugiProyek = pemasukanKlien - totalPengeluaran;

  return {
    modalDisuntikkan,
    pemasukanKlien,
    totalPengeluaran,
    totalRefundMasuk,
    realisasiBersih,
    sisaDanaProyek,
    labaRugiProyek,
  };
}

// ---- Cashflow Trend — KAS UTAMA ONLY ----
export function getCashflowTrend(
  transactions: Transaction[],
  from: Date,
  to: Date
): CashflowTrend[] {
  // Calculate baseline kas before the period
  let kasAwal = 0;
  for (const t of transactions) {
    if (!isApproved(t)) continue;
    if (!isKasUtamaTransaction(t)) continue;
    const d = new Date(t.tanggal);
    if (d >= from) continue;
    if (t.jenis === 'masuk') kasAwal += t.nominal;
    else kasAwal -= t.nominal;
  }

  // Build daily data
  const daily: Record<string, { pemasukan: number; pengeluaran: number }> = {};

  for (const t of transactions) {
    if (!isApproved(t)) continue;
    if (!isKasUtamaTransaction(t)) continue;
    const d = new Date(t.tanggal);
    if (d < from || d > to) continue;

    const key = t.tanggal.split('T')[0];
    if (!daily[key]) daily[key] = { pemasukan: 0, pengeluaran: 0 };

    if (t.jenis === 'masuk') daily[key].pemasukan += t.nominal;
    else daily[key].pengeluaran += t.nominal;
  }

  // Aggregate by weeks if range > 31 days, else by day
  const days = Math.round((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
  const result: CashflowTrend[] = [];
  let kasKumulatif = kasAwal;

  if (days <= 31) {
    // Daily
    for (
      let d = new Date(from);
      d <= to;
      d = new Date(d.getTime() + 86400000)
    ) {
      const key = d.toISOString().split('T')[0];
      const { pemasukan = 0, pengeluaran = 0 } = daily[key] ?? {};
      kasKumulatif += pemasukan - pengeluaran;
      result.push({
        tanggal: d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' }),
        kasKumulatif,
        pemasukan,
        pengeluaran,
      });
    }
  } else {
    // Weekly aggregation
    const weekMap: Record<string, { pemasukan: number; pengeluaran: number; label: string }> = {};
    for (const [dateStr, vals] of Object.entries(daily)) {
      const d = new Date(dateStr);
      const weekStart = new Date(d);
      weekStart.setDate(d.getDate() - d.getDay());
      const weekKey = weekStart.toISOString().split('T')[0];
      if (!weekMap[weekKey]) {
        weekMap[weekKey] = {
          pemasukan: 0,
          pengeluaran: 0,
          label: weekStart.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' }),
        };
      }
      weekMap[weekKey].pemasukan += vals.pemasukan;
      weekMap[weekKey].pengeluaran += vals.pengeluaran;
    }
    for (const [, v] of Object.entries(weekMap).sort(([a], [b]) => a.localeCompare(b))) {
      kasKumulatif += v.pemasukan - v.pengeluaran;
      result.push({ tanggal: v.label, kasKumulatif, pemasukan: v.pemasukan, pengeluaran: v.pengeluaran });
    }
  }

  return result;
}

/**
 * Clean disruptive markdown symbols (*, #, `, _, ~) from text outputs
 */
export function cleanTextPunctuation(text: string): string {
  if (!text) return '';
  return text
    .replace(/#{1,6}\s?/g, '')
    .replace(/\*{1,3}/g, '')
    .replace(/_{1,3}/g, '')
    .replace(/`{1,3}/g, '')
    .replace(/~{1,2}/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .trim();
}

// ---- Transaction Summary for AI ----
export function buildAISummaryContext(
  transactions: Transaction[],
  from: Date,
  to: Date,
  prevMonthTransactions: Transaction[]
): string {
  const periodTx = transactions.filter(t => {
    const d = new Date(t.tanggal);
    return isApproved(t) && isKasUtamaTransaction(t) && d >= from && d <= to;
  });

  let totalMasuk = 0;
  let totalKeluar = 0;
  const byCategory: Record<string, number> = {};

  for (const t of periodTx) {
    if (t.jenis === 'masuk') totalMasuk += t.nominal;
    else {
      totalKeluar += t.nominal;
      byCategory[t.kategori] = (byCategory[t.kategori] ?? 0) + t.nominal;
    }
  }

  let prevKeluar = 0;
  for (const t of prevMonthTransactions) {
    if (isApproved(t) && isKasUtamaTransaction(t) && t.jenis === 'keluar') prevKeluar += t.nominal;
  }

  const fmt = (n: number) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);

  const topCats = Object.entries(byCategory)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([k, v]) => `${k}: ${fmt(v)}`)
    .join(', ');

  return `Data keuangan Kas Utama PT Aksara Riksa Perdana (ARP) periode ${from.toLocaleDateString('id-ID')} - ${to.toLocaleDateString('id-ID')}:
- Total Pemasukan Kas Utama: ${fmt(totalMasuk)}
- Total Pengeluaran Kas Utama: ${fmt(totalKeluar)}
- Arus Kas Bersih (Net Cashflow): ${fmt(totalMasuk - totalKeluar)}
- Total Pengeluaran Bulan Sebelumnya: ${fmt(prevKeluar)}
- Kategori Pengeluaran Terbesar: ${topCats || 'Tidak ada'}

Instruksi Penting:
Buatkan analisis keuangan eksekutif yang singkat, padat, dan sangat rapi dalam Bahasa Indonesia.
ATURAN WAJIB: SANGAT DILARANG menggunakan tanda baca simbol seperti hashtag, bintang, underscore, atau backtick. Tulislah dalam bentuk teks narasi bersih, jelas, dan profesional tanpa simbol-simbol markdown tersebut.`;
}

/**
 * Builds AI Prompt specifically for Individual Project Financial Analysis
 */
export function buildProjectAISummaryContext(
  projectNama: string,
  klien: string,
  anggaran: number,
  transactions: Transaction[]
): string {
  let totalBelanja = 0;
  let totalRefund = 0;
  const categoryMap: Record<string, number> = {};

  for (const t of transactions) {
    const isApproved = t.status === 'disetujui' || t.status === 'selesai';
    if (!isApproved) continue;
    if (t.deskripsi.startsWith('Suntikan Modal Proyek:')) continue;

    if (t.jenis === 'keluar') {
      totalBelanja += t.nominal;
      categoryMap[t.kategori] = (categoryMap[t.kategori] ?? 0) + t.nominal;
    } else if (t.jenis === 'masuk') {
      totalRefund += t.nominal;
    }
  }

  const realisasiBersih = totalBelanja - totalRefund;
  const sisaDana = anggaran - realisasiBersih;
  const persentaseTerpakai = anggaran > 0 ? Math.round((realisasiBersih / anggaran) * 100) : 0;

  const fmt = (n: number) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);

  const topCats = Object.entries(categoryMap)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 4)
    .map(([k, v]) => `${k}: ${fmt(v)}`)
    .join(', ');

  return `Laporan Analisis Realisasi Anggaran Proyek PT Aksara Riksa Perdana:
- Nama Proyek: ${projectNama}
- Klien: ${klien}
- Modal Anggaran Disuntikkan: ${fmt(anggaran)}
- Total Pengeluaran Lapangan: ${fmt(totalBelanja)}
- Total Refund / Pengembalian: ${fmt(totalRefund)}
- Realisasi Bersih Terpakai: ${fmt(realisasiBersih)} (${persentaseTerpakai}% dari anggaran)
- Sisa Dana Proyek Saat Ini: ${fmt(sisaDana)}
- Rincian Pengeluaran Terbesar: ${topCats || 'Belum ada pengeluaran'}

Instruksi Penting:
Berikan evaluasi kesehatan finansial khusus proyek ini dalam 2-3 paragraf singkat dan rapi.
ATURAN WAJIB: SANGAT DILARANG menggunakan simbol hashtag, bintang, underscore, atau backtick. Gunakan penulisan kalimat naratif bersih yang enak dibaca tanpa simbol-simbol dekoratif tersebut.`;
}

