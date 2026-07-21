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
function isSuntikanModal(t: Transaction): boolean {
  return t.deskripsi.startsWith('Suntikan Modal Proyek:');
}

/**
 * Check if a transaction belongs to KAS UTAMA (main company cash).
 * Kas Utama includes:
 * - All transactions WITHOUT proyekId
 * - Suntikan Modal transactions (they represent money leaving kas utama INTO a project)
 * Kas Utama excludes:
 * - All transactions WITH proyekId (those are internal project fund movements)
 */
function isKasUtamaTransaction(t: Transaction): boolean {
  // Suntikan Modal always affects kas utama (it's the act of moving money OUT)
  if (isSuntikanModal(t)) return true;
  // Transactions tied to a project do NOT affect kas utama
  if (t.proyekId) return false;
  return true;
}

/**
 * Check if transaction is a "Refund Sisa Dana ke Kas Utama" from a completed project.
 * These are special masuk transactions without proyekId that represent
 * money flowing back from project pool to kas utama.
 */
function isRefundToKasUtama(t: Transaction): boolean {
  return t.kategori === 'Refund Dana Proyek ke Kas Utama' && t.jenis === 'masuk' && !t.proyekId;
}

// ---- Dashboard Summary (KAS UTAMA ONLY) ----
export function getDashboardSummary(
  transactions: Transaction[],
  proyekAktifCount: number
): DashboardSummary {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  let totalMasuk = 0;
  let totalKeluar = 0;
  let pemasukanBulanIni = 0;
  let pengeluaranOperasionalBulanIni = 0;
  let pribadiOwnerBulanIni = 0;

  for (const t of transactions) {
    if (!isApproved(t)) continue;

    // ONLY count kas utama transactions for the main dashboard
    if (!isKasUtamaTransaction(t)) continue;

    if (t.jenis === 'masuk') {
      totalMasuk += t.nominal;
      if (isInMonth(t.tanggal, year, month)) {
        pemasukanBulanIni += t.nominal;
      }
    } else {
      totalKeluar += t.nominal;
      if (isInMonth(t.tanggal, year, month)) {
        if (t.tag === 'operasional') pengeluaranOperasionalBulanIni += t.nominal;
        if (t.tag === 'pribadi') pribadiOwnerBulanIni += t.nominal;
      }
    }
  }

  return {
    sisaKas: totalMasuk - totalKeluar,
    totalPemasukanBulanIni: pemasukanBulanIni,
    totalPengeluaranOperasionalBulanIni: pengeluaranOperasionalBulanIni,
    totalPribadiOwnerBulanIni: pribadiOwnerBulanIni,
    proyekAktif: proyekAktifCount,
  };
}

// ---- Monthly Chart (last N months) — KAS UTAMA ONLY ----
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
      if (!isKasUtamaTransaction(t)) continue;
      if (!isInMonth(t.tanggal, year, month)) continue;

      if (t.jenis === 'masuk') pemasukan += t.nominal;
      else pengeluaran += t.nominal;
    }

    result.push({ bulan: monthLabel, pemasukan, pengeluaran });
  }

  return result;
}

// ---- Category Breakdown (pengeluaran) — KAS UTAMA ONLY ----
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
    if (!isKasUtamaTransaction(t)) continue;

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
    if (isSuntikanModal(t)) continue;

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

// ---- Project Financial Summary ----
export interface ProjectFinancialSummary {
  modalDisuntikkan: number;
  totalPengeluaran: number;
  totalRefundMasuk: number;
  realisasiBersih: number;
  sisaDanaProyek: number;
}

export function getProjectFinancialSummary(
  transactions: Transaction[],
  anggaranModal: number
): ProjectFinancialSummary {
  let totalPengeluaran = 0;
  let totalRefundMasuk = 0;

  for (const t of transactions) {
    if (!isApproved(t)) continue;
    if (isSuntikanModal(t)) continue; // Exclude the injection itself

    if (t.jenis === 'keluar') {
      totalPengeluaran += t.nominal;
    } else if (t.jenis === 'masuk') {
      totalRefundMasuk += t.nominal;
    }
  }

  const realisasiBersih = totalPengeluaran - totalRefundMasuk;
  const sisaDanaProyek = anggaranModal - realisasiBersih;

  return {
    modalDisuntikkan: anggaranModal,
    totalPengeluaran,
    totalRefundMasuk,
    realisasiBersih,
    sisaDanaProyek,
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

  // Prev month
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

  return `Data keuangan perusahaan PT Aksara Riksa Perdana (ARP) periode ${from.toLocaleDateString('id-ID')} - ${to.toLocaleDateString('id-ID')}:
- Total Pemasukan Kas Utama: ${fmt(totalMasuk)}
- Total Pengeluaran Kas Utama: ${fmt(totalKeluar)}
- Saldo Kas Utama periode: ${fmt(totalMasuk - totalKeluar)}
- Jumlah transaksi kas utama: ${periodTx.length}
- Kategori pengeluaran terbesar: ${topCats || 'tidak ada'}
- Total pengeluaran bulan sebelumnya: ${fmt(prevKeluar)}

Catatan: Angka di atas HANYA mencakup kas utama perusahaan, TIDAK termasuk pengeluaran internal proyek (yang dikelola terpisah per amplop proyek).

Buatkan ringkasan singkat 2-3 kalimat dalam Bahasa Indonesia yang profesional tentang kondisi cashflow kas utama, kategori pengeluaran terbesar, dan catatan jika ada pengeluaran tidak wajar dibanding periode sebelumnya. Gunakan tone profesional seperti laporan keuangan ringkas.`;
}
