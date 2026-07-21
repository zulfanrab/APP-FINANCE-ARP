// ============================================================
// ARKA Finance — Professional Accounting Export Service
// Generates Proper General Journal (Jurnal Umum), Debet/Kredit,
// Kumulatif Balance, Executive Summaries & Project Realisasi Workbooks
// ============================================================

import * as XLSX from 'xlsx';
import { type Transaction, type Project } from '../types';
import { formatDate, formatRupiah } from '../components/ui';

interface ExportJournalOptions {
  title: string;
  companyName?: string;
  periodText: string;
  transactions: Transaction[];
  projects?: Project[];
  fileName?: string;
}

/**
 * Export a formal Corporate Accounting Journal Excel Workbook
 */
export function exportAccountingJournalExcel({
  title,
  companyName = 'PT AKSARA RIKSA PERDANA (ARP)',
  periodText,
  transactions,
  projects = [],
  fileName,
}: ExportJournalOptions) {
  const wb = XLSX.utils.book_new();

  // Sort transactions chronologically for accounting journal (oldest to newest)
  const sorted = [...transactions].sort(
    (a, b) => new Date(a.tanggal).getTime() - new Date(b.tanggal).getTime()
  );

  // Calculate cumulative balance & debet/kredit totals
  let runningBalance = 0;
  let totalDebet = 0;
  let totalKredit = 0;

  // Build Sheet 1: JURNAL UMUM (Accounting Journal Style)
  const journalRows: any[][] = [
    [companyName],
    [title.toUpperCase()],
    [`PERIODE: ${periodText}`],
    [`DITERBITKAN: ${new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`],
    [], // Blank spacing row
    [
      'NO',
      'TANGGAL',
      'NO. REFERENSI',
      'URAIAN / DESKRIPSI TRANSAKSI',
      'KATEGORI AKUN',
      'SUMBER KAS',
      'TAG PERUNTUKAN',
      'DEBET (PEMASUKAN - RP)',
      'KREDIT (PENGELUARAN - RP)',
      'SALDO KUMULATIF (RP)',
      'STATUS',
    ],
  ];

  sorted.forEach((t, idx) => {
    const isMasuk = t.jenis === 'masuk';
    const debet = isMasuk ? t.nominal : 0;
    const kredit = !isMasuk ? t.nominal : 0;

    totalDebet += debet;
    totalKredit += kredit;
    runningBalance += debet - kredit;

    const projectName = t.proyekId
      ? projects.find(p => p.id === t.proyekId)?.nama || 'Dana Proyek'
      : 'Kas Utama';

    journalRows.push([
      idx + 1,
      formatDate(t.tanggal),
      t.id.slice(-8).toUpperCase(),
      t.deskripsi,
      t.kategori,
      projectName,
      t.tag === 'operasional' ? 'Operasional' : t.tag === 'pribadi' ? 'Pribadi Owner' : '-',
      debet || '',
      kredit || '',
      runningBalance,
      t.status === 'selesai' ? 'Selesai' : t.status === 'disetujui' ? 'Disetujui' : t.status,
    ]);
  });

  // Footer summary row
  journalRows.push([]);
  journalRows.push([
    '',
    '',
    '',
    'TOTAL MUTASI & SALDO AKHIR',
    '',
    '',
    '',
    totalDebet,
    totalKredit,
    runningBalance,
    'VALID',
  ]);

  const wsJournal = XLSX.utils.aoa_to_sheet(journalRows);
  wsJournal['!cols'] = [
    { wch: 6 },  // No
    { wch: 14 }, // Tanggal
    { wch: 14 }, // Ref
    { wch: 40 }, // Deskripsi
    { wch: 22 }, // Kategori
    { wch: 25 }, // Sumber Kas
    { wch: 16 }, // Tag
    { wch: 22 }, // Debet
    { wch: 22 }, // Kredit
    { wch: 22 }, // Saldo
    { wch: 14 }, // Status
  ];
  XLSX.utils.book_append_sheet(wb, wsJournal, 'Jurnal Umum');

  // Build Sheet 2: RINGKASAN EXECUTIVE (Financial Summary)
  const summaryRows: any[][] = [
    [companyName],
    ['RINGKASAN EKSEKUTIF KEUANGAN'],
    [`PERIODE: ${periodText}`],
    [],
    ['KOMPONEN KEUANGAN', 'NOMINAL (RP)', 'KETERANGAN / MARGIN'],
    ['Total Debet (Pemasukan Kas)', totalDebet, 'Semua arus dana masuk disetujui'],
    ['Total Kredit (Pengeluaran Kas)', totalKredit, 'Semua arus dana keluar disetujui'],
    ['Net Cashflow / Saldo Periode', totalDebet - totalKredit, totalDebet > 0 ? `${Math.round(((totalDebet - totalKredit) / totalDebet) * 100)}% Net Margin` : '-'],
    ['Saldo Kumulatif Akhir', runningBalance, 'Posisi Kas Terakhir'],
    ['Total Transaksi Terverifikasi', sorted.length, 'Baris data jurnal'],
  ];

  const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
  wsSummary['!cols'] = [{ wch: 32 }, { wch: 22 }, { wch: 35 }];
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Ringkasan Eksekutif');

  // Generate File
  const defaultFileName = fileName || `Jurnal_Akuntansi_ARKA_${new Date().toISOString().split('T')[0]}.xlsx`;
  XLSX.writeFile(wb, defaultFileName);
}

/**
 * Export a formal Project Realisasi Accounting Excel Workbook
 */
export function exportProjectRealisasiExcel(project: Project, transactions: Transaction[]) {
  const wb = XLSX.utils.book_new();
  const companyName = 'PT AKSARA RIKSA PERDANA (ARP)';

  const approvedTx = transactions.filter(
    t => (t.status === 'disetujui' || t.status === 'selesai') && !t.deskripsi.startsWith('Suntikan Modal Proyek:')
  );

  let totalPengeluaran = 0;
  let totalRefund = 0;

  approvedTx.forEach(t => {
    if (t.jenis === 'keluar') totalPengeluaran += t.nominal;
    else if (t.jenis === 'masuk') totalRefund += t.nominal;
  });

  const modalDisuntikkan = project.anggaran || 0;
  const realisasiBersih = totalPengeluaran - totalRefund;
  const sisaDana = modalDisuntikkan - realisasiBersih;

  // Sheet 1: LAPORAN REALISASI PROYEK
  const rows: any[][] = [
    [companyName],
    ['LAPORAN REALISASI & PERTANGGUNGJAWABAN DANA PROYEK'],
    [`PROYEK: ${project.nama.toUpperCase()}`],
    [`KLIEN: ${project.klien}`],
    [`DITERBITKAN: ${new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}`],
    [],
    ['--- KARTU DANA PROYEK ---'],
    ['Anggaran Modal Disuntikkan (Pak Fatwa)', modalDisuntikkan],
    ['Total Pengeluaran Belanja Lapangan', totalPengeluaran],
    ['Total Refund / Uang Kembali', totalRefund],
    ['REALISASI BERSIH PROYEK', realisasiBersih],
    ['SISA DANA PROYEK DI ADMIN', sisaDana],
    [],
    ['--- RINCIAN TRANSAKSI REALISASI LAPANGAN ---'],
    ['NO', 'TANGGAL', 'DESKRIPSI BELANJA / REFUND', 'KATEGORI', 'PENGELUARAN (RP)', 'REFUND MASUK (RP)', 'STATUS'],
  ];

  approvedTx.forEach((t, idx) => {
    rows.push([
      idx + 1,
      formatDate(t.tanggal),
      t.deskripsi,
      t.kategori,
      t.jenis === 'keluar' ? t.nominal : '',
      t.jenis === 'masuk' ? t.nominal : '',
      t.status === 'selesai' ? 'Selesai' : 'Disetujui',
    ]);
  });

  rows.push([]);
  rows.push(['', '', 'TOTAL REALISASI LAPANGAN', '', totalPengeluaran, totalRefund, 'OK']);

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [
    { wch: 6 },
    { wch: 14 },
    { wch: 40 },
    { wch: 22 },
    { wch: 22 },
    { wch: 22 },
    { wch: 14 },
  ];
  XLSX.utils.book_append_sheet(wb, ws, 'Realisasi Proyek');

  XLSX.writeFile(wb, `Laporan_Realisasi_${project.nama.replace(/\s+/g, '_')}.xlsx`);
}
