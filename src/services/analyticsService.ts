// ============================================================
// ARKA Finance — Analytics Service
// Semua kalkulasi dihitung dari data transaksi real
// ============================================================

import {
  type Transaction,
  type DashboardSummary,
  type MonthlyChartData,
  type CategoryBreakdown,
  type CashflowTrend,
} from '../types';

// ---- Helper ----
function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}

function isInMonth(dateStr: string, year: number, month: number): boolean {
  const d = new Date(dateStr);
  return d.getFullYear() === year && d.getMonth() === month;
}

function isApproved(t: Transaction): boolean {
  return t.status === 'disetujui' || t.status === 'selesai';
}

// ---- Dashboard Summary ----
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

// ---- Monthly Chart (last N months) ----
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
      if (!isInMonth(t.tanggal, year, month)) continue;

      if (t.jenis === 'masuk') pemasukan += t.nominal;
      else pengeluaran += t.nominal;
    }

    result.push({ bulan: monthLabel, pemasukan, pengeluaran });
  }

  return result;
}

// ---- Category Breakdown (pengeluaran) ----
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

// ---- Cashflow Trend ----
export function getCashflowTrend(
  transactions: Transaction[],
  from: Date,
  to: Date
): CashflowTrend[] {
  // Calculate baseline kas before the period
  let kasAwal = 0;
  for (const t of transactions) {
    if (!isApproved(t)) continue;
    const d = new Date(t.tanggal);
    if (d >= from) continue;
    if (t.jenis === 'masuk') kasAwal += t.nominal;
    else kasAwal -= t.nominal;
  }

  // Build daily data
  const daily: Record<string, { pemasukan: number; pengeluaran: number }> = {};

  for (const t of transactions) {
    if (!isApproved(t)) continue;
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
    return isApproved(t) && d >= from && d <= to;
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
    if (isApproved(t) && t.jenis === 'keluar') prevKeluar += t.nominal;
  }

  const fmt = (n: number) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);

  const topCats = Object.entries(byCategory)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([k, v]) => `${k}: ${fmt(v)}`)
    .join(', ');

  return `Data keuangan perusahaan PT Aksara Riksa Perdana (ARP) periode ${from.toLocaleDateString('id-ID')} - ${to.toLocaleDateString('id-ID')}:
- Total Pemasukan: ${fmt(totalMasuk)}
- Total Pengeluaran: ${fmt(totalKeluar)}
- Saldo periode: ${fmt(totalMasuk - totalKeluar)}
- Jumlah transaksi: ${periodTx.length}
- Kategori pengeluaran terbesar: ${topCats || 'tidak ada'}
- Total pengeluaran bulan sebelumnya: ${fmt(prevKeluar)}

Buatkan ringkasan singkat 2-3 kalimat dalam Bahasa Indonesia yang profesional tentang kondisi cashflow, kategori pengeluaran terbesar, dan catatan jika ada pengeluaran tidak wajar dibanding periode sebelumnya. Gunakan tone profesional seperti laporan keuangan ringkas.`;
}
