// ============================================================
// ARKA Finance — Official Printable PDF & KOP Document Engine
// Matches Official Letterhead Details (Jl. Cibodas Raya No. 02, Antapani Kidul,
// +62 821-2984-9515, aksara.riksa.perdana@gmail.com, aksarariksapjk3.com)
// Universal Hidden-Iframe Printing for 100% Mobile HP & Desktop Compatibility
// ============================================================

import React, { useRef } from 'react';
import { Printer, FileText } from 'lucide-react';
import { Modal } from './Modal';
import { type Transaction, type Project } from '../../types';
import { formatDate, formatRupiah } from './index';
import { groupAndSortTransactions } from '../../services/transactionService';

interface PdfReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  periodText: string;
  transactions: Transaction[];
  project?: Project | null;
}

/** Explicit Saldo Currency Formatter with Safe Negative Support */
export function formatSaldoRupiah(amount: number): string {
  if (isNaN(amount) || amount === 0) return 'Rp 0';
  if (amount < 0) {
    return `-Rp ${Math.abs(amount).toLocaleString('id-ID')}`;
  }
  return `Rp ${amount.toLocaleString('id-ID')}`;
}

/** Check if a transaction is a Capital Allocation / Injection (Alokasi Modal Operasional) */
export function isCapitalInjectionTx(t: Transaction): boolean {
  const d = (t.deskripsi || '').toLowerCase();
  const k = (t.kategori || '').toLowerCase();
  return (
    d.startsWith('alokasi modal proyek:') ||
    d.startsWith('suntikan modal proyek:') ||
    d.includes('penerimaan alokasi modal') ||
    d.includes('penerimaan modal proyek') ||
    k === 'alokasi modal operasional proyek' ||
    k === 'suntikan modal proyek' ||
    k === 'alokasi modal proyek'
  );
}

export function PdfReportModal({
  isOpen,
  onClose,
  title,
  subtitle = 'Dokumen Keuangan Resmi PT. Aksara Riksa Perdana',
  periodText,
  transactions,
  project,
}: PdfReportModalProps) {
  const printRef = useRef<HTMLDivElement>(null);

  if (!isOpen) return null;

  const companyName = 'PT. AKSARA RIKSA PERDANA';
  const companyAddress = 'Jl. Cibodas Raya No. 02, Antapani Kidul, Kecamatan Antapani, Kota Bandung, Jawa Barat 40291';
  const companyPhone = '+62 821-2984-9515';
  const companyEmail = 'aksara.riksa.perdana@gmail.com';
  const companyWebsite = 'aksarariksapjk3.com';

  // Filter approved transactions
  const approvedTx = transactions.filter(t => t.status === 'disetujui' || t.status === 'selesai');

  let tableRows: {
    no: number | string;
    tanggal: string;
    deskripsi: string;
    kategori: string;
    debet: number;
    kredit: number;
    saldo: number;
  }[] = [];

  let modalAwal = 0;
  let totalDebet = 0;
  let totalKredit = 0;
  let sisaDana = 0;

  if (project) {
    // ============================================================
    // PROJECT REALISASI MATH: Starts with Modal Disuntikkan (Anggaran)
    // ============================================================
    modalAwal = project.anggaran || 0;

    const ptx = approvedTx.filter(t => t.proyekId === project.id);
    const sortedPtx = groupAndSortTransactions(ptx, 'asc');

    let currentBalance = 0;

    // Initial Capital Row if modalAwal > 0 and no explicit injection transaction exists in sortedPtx
    const hasInjectionTx = sortedPtx.some(t => isCapitalInjectionTx(t));

    if (modalAwal > 0 && !hasInjectionTx) {
      currentBalance = modalAwal;
      tableRows.push({
        no: 1,
        tanggal: formatDate(project.tanggalMulai),
        deskripsi: 'Penerimaan Alokasi Modal Operasional Proyek',
        kategori: 'Alokasi Modal Operasional',
        debet: modalAwal,
        kredit: 0,
        saldo: currentBalance,
      });
      totalDebet += modalAwal;
    }

    sortedPtx.forEach((t) => {
      const isInjection = isCapitalInjectionTx(t);
      const isMasuk = t.jenis === 'masuk' || isInjection; // CAPITAL INJECTION IS ALWAYS DEBET (MASUK)!

      const debet = isMasuk ? t.nominal : 0;
      const kredit = !isMasuk ? t.nominal : 0;

      if (isMasuk) {
        currentBalance += t.nominal;
        totalDebet += t.nominal;
      } else {
        currentBalance -= t.nominal;
        totalKredit += t.nominal;
      }

      tableRows.push({
        no: tableRows.length + 1,
        tanggal: formatDate(t.tanggal),
        deskripsi: t.deskripsi,
        kategori: t.kategori,
        debet,
        kredit,
        saldo: currentBalance,
      });
    });

    sisaDana = currentBalance;
  } else {
    // ============================================================
    // KAS UTAMA JOURNAL MATH
    // ============================================================
    const mainTx = approvedTx.filter(
      t => !t.proyekId || isCapitalInjectionTx(t) || t.kategori === 'Mutasi Internal / Transfer Kas' || t.kategori === 'Refund Dana Proyek ke Kas Utama'
    );

    const sortedMain = groupAndSortTransactions(mainTx, 'asc');

    let currentBalance = 0;

    sortedMain.forEach((t, idx) => {
      const isMasuk = t.jenis === 'masuk';
      const debet = isMasuk ? t.nominal : 0;
      const kredit = !isMasuk ? t.nominal : 0;

      if (isMasuk) {
        currentBalance += t.nominal;
        totalDebet += t.nominal;
      } else {
        currentBalance -= t.nominal;
        totalKredit += t.nominal;
      }

      tableRows.push({
        no: idx + 1,
        tanggal: formatDate(t.tanggal),
        deskripsi: t.deskripsi,
        kategori: t.kategori,
        debet,
        kredit,
        saldo: currentBalance,
      });
    });

    sisaDana = currentBalance;
  }

  // Universal Hidden-Iframe Printing (Works 100% on Mobile HP & Desktop Browsers without popup blocking!)
  const handlePrint = () => {
    const content = printRef.current;
    if (!content) return;

    let iframe = document.getElementById('arka-pdf-print-iframe') as HTMLIFrameElement;
    if (!iframe) {
      iframe = document.createElement('iframe');
      iframe.id = 'arka-pdf-print-iframe';
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      document.body.appendChild(iframe);
    }

    const frameDoc = iframe.contentWindow?.document || iframe.contentDocument;
    if (!frameDoc) return;

    frameDoc.open();
    frameDoc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${title} - ${companyName}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
            @page {
              size: A4 portrait;
              margin: 12mm 10mm 12mm 10mm;
            }
            * {
              box-sizing: border-box;
            }
            body {
              font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif !important;
              color: #0F172A;
              font-size: 10.5px;
              line-height: 1.45;
              margin: 0;
              padding: 0;
              background: #ffffff;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            .tabular-nums, td, th, .summary-val {
              font-variant-numeric: tabular-nums !important;
              -moz-font-feature-settings: "tnum" !important;
              -webkit-font-feature-settings: "tnum" !important;
              font-feature-settings: "tnum" !important;
            }
            .kop-container {
              text-align: center;
              padding-bottom: 8px;
              border-bottom: 2.5px solid #1A365D;
              margin-bottom: 2px;
            }
            .kop-line-secondary {
              border-bottom: 1px solid #94A3B8;
              margin-bottom: 16px;
            }
            .company-title {
              font-family: 'Inter', sans-serif;
              font-size: 18px;
              font-weight: 900;
              color: #1A365D;
              letter-spacing: 0.5px;
              margin: 0;
              text-transform: uppercase;
            }
            .company-info {
              font-size: 9.5px;
              color: #334155;
              margin-top: 4px;
              line-height: 1.5;
            }
            .doc-header {
              text-align: center;
              margin: 14px 0 16px 0;
            }
            .doc-title {
              font-size: 13.5px;
              font-weight: 800;
              color: #1A365D;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              margin: 0;
            }
            .doc-subtitle {
              font-size: 10px;
              color: #475569;
              margin-top: 4px;
            }
            .summary-box {
              display: table;
              width: 100%;
              border: 1px solid #CBD5E1;
              border-radius: 10px;
              background-color: #F8FAFC;
              margin-bottom: 18px;
              padding: 10px 6px;
              page-break-inside: avoid;
              break-inside: avoid;
            }
            .summary-cell {
              display: table-cell;
              text-align: center;
              vertical-align: middle;
              padding: 4px 6px;
            }
            .summary-label {
              font-size: 8.5px;
              color: #475569;
              text-transform: uppercase;
              font-weight: 700;
              letter-spacing: 0.3px;
            }
            .summary-val {
              font-size: 13.5px;
              font-weight: 800;
              margin-top: 3px;
            }
            .val-masuk { color: #047857; }
            .val-keluar { color: #BE123C; }
            .val-net { color: #1E40AF; }

            table.journal-table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 25px;
              page-break-inside: auto;
            }
            table.journal-table thead {
              display: table-header-group;
            }
            table.journal-table tbody {
              display: table-row-group;
            }
            table.journal-table tr {
              page-break-inside: avoid !important;
              break-inside: avoid !important;
            }
            table.journal-table th {
              background-color: #1A365D !important;
              color: #FFFFFF !important;
              font-size: 9px;
              font-weight: 700;
              text-transform: uppercase;
              letter-spacing: 0.4px;
              padding: 9px 8px;
              border: 1px solid #1A365D;
              line-height: 1.3;
              vertical-align: middle;
            }
            table.journal-table td {
              padding: 8px 8px;
              border: 1px solid #E2E8F0;
              font-size: 9.5px;
              line-height: 1.4;
              vertical-align: top;
              word-wrap: break-word;
              overflow-wrap: break-word;
              page-break-inside: avoid !important;
              break-inside: avoid !important;
            }
            table.journal-table tbody tr:nth-child(even) {
              background-color: #F8FAFC !important;
            }
            table.journal-table tbody tr:nth-child(odd) {
              background-color: #FFFFFF !important;
            }
            .text-right { text-align: right !important; }
            .text-center { text-align: center !important; }
            .text-left { text-align: left !important; }
            .font-bold { font-weight: 700; }
            .font-extrabold { font-weight: 800; }
            .signature-container {
              display: table;
              width: 100%;
              margin-top: 35px;
              page-break-inside: avoid;
              break-inside: avoid;
            }
            .signature-box {
              display: table-cell;
              width: 50%;
              text-align: center;
              vertical-align: top;
            }
            .signature-space {
              height: 55px;
            }
            .signature-line {
              border-top: 1px solid #1A365D;
              width: 170px;
              margin: 0 auto;
              padding-top: 4px;
              font-weight: 700;
              color: #1A365D;
            }
          </style>
        </head>
        <body>
          ${content.innerHTML}
        </body>
      </html>
    `);

    frameDoc.close();

    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    }, 350);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Cetak Laporan PDF Resmi" size="xl">
      <div className="space-y-4">
        {/* Controls */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3.5 bg-slate-100 rounded-2xl border border-slate-200">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
            <FileText size={16} className="text-emerald-600 flex-shrink-0" />
            <span>Format PDF KOP Resmi (Siap Cetak / Save PDF di HP &amp; PC)</span>
          </div>
          <button
            onClick={handlePrint}
            className="w-full sm:w-auto px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 shadow-md transition-all active:scale-95"
          >
            <Printer size={16} /> Cetak / Download PDF
          </button>
        </div>

        {/* Printable Document Preview Area */}
        <div className="max-h-[70vh] overflow-y-auto p-4 sm:p-6 bg-white border border-gray-200 rounded-2xl shadow-inner scrollbar-thin font-sans">
          <div ref={printRef} className="space-y-4 text-slate-900 font-sans">
            {/* EXACT OFFICIAL KOP HEADER FROM USER SCREENSHOT */}
            <div>
              <div className="kop-container text-center pb-2 border-b-[2.5px] border-[#1A365D]">
                <h1 className="company-title text-xl font-black text-[#1A365D] tracking-tight uppercase">
                  {companyName}
                </h1>
                <p className="company-info text-[10.5px] font-medium text-slate-700 mt-1 leading-relaxed">
                  {companyAddress}<br />
                  📞 {companyPhone} &nbsp;·&nbsp; ✉️ {companyEmail} &nbsp;·&nbsp; 🌐 {companyWebsite}
                </p>
              </div>
              <div className="kop-line-secondary border-b border-slate-300 mt-0.5 mb-4" />
            </div>

            {/* DOCUMENT TITLE & METADATA */}
            <div className="doc-header text-center my-3">
              <h2 className="doc-title text-base font-extrabold text-[#1A365D] uppercase tracking-wide">{title}</h2>
              <p className="doc-subtitle text-xs text-slate-600 mt-1">
                {subtitle} · Periode: <strong className="text-slate-800">{periodText}</strong>
              </p>
              {project && (
                <p className="text-xs font-bold text-blue-800 mt-0.5">
                  NAMA PROYEK: {project.nama.toUpperCase()} | KLIEN: {project.klien.toUpperCase()}
                </p>
              )}
            </div>

            {/* EXECUTIVE FINANCIAL SUMMARY */}
            {project ? (
              <div className="summary-box bg-[#F8FAFC] border border-slate-300 rounded-2xl p-4 grid grid-cols-2 sm:grid-cols-5 gap-3 text-center my-4 shadow-sm">
                <div className="p-2 bg-white rounded-xl border border-slate-100">
                  <span className="summary-label text-[9px] font-bold text-slate-500 uppercase tracking-wider block">Alokasi Modal Operasional</span>
                  <p className="summary-val text-sm font-black text-purple-800 tabular-nums mt-1">{formatRupiah(modalAwal)}</p>
                </div>
                <div className="p-2 bg-white rounded-xl border border-slate-100">
                  <span className="summary-label text-[9px] font-bold text-slate-500 uppercase tracking-wider block">Invoice Klien</span>
                  <p className="summary-val text-sm font-black text-emerald-700 tabular-nums mt-1">{formatRupiah(totalDebet > modalAwal ? totalDebet - modalAwal : 0)}</p>
                </div>
                <div className="p-2 bg-white rounded-xl border border-slate-100">
                  <span className="summary-label text-[9px] font-bold text-slate-500 uppercase tracking-wider block">Pengeluaran Riil</span>
                  <p className="summary-val text-sm font-black text-rose-700 tabular-nums mt-1">{formatRupiah(totalKredit)}</p>
                </div>
                <div className="p-2 bg-white rounded-xl border border-slate-100">
                  <span className="summary-label text-[9px] font-bold text-slate-500 uppercase tracking-wider block">Laba - Rugi (P&L)</span>
                  <p className={`summary-val text-sm font-black tabular-nums mt-1 ${((totalDebet > modalAwal ? totalDebet - modalAwal : 0) - totalKredit) >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                    {formatSaldoRupiah((totalDebet > modalAwal ? totalDebet - modalAwal : 0) - totalKredit)}
                  </p>
                </div>
                <div className="p-2 bg-white rounded-xl border border-slate-100">
                  <span className="summary-label text-[9px] font-bold text-slate-500 uppercase tracking-wider block">Saldo Kas Proyek</span>
                  <p className={`summary-val text-sm font-black tabular-nums mt-1 ${sisaDana >= 0 ? 'text-blue-800' : 'text-rose-700'}`}>
                    {formatSaldoRupiah(sisaDana)}
                  </p>
                </div>
              </div>
            ) : (
              <div className="summary-box bg-[#F8FAFC] border border-slate-300 rounded-2xl p-4 grid grid-cols-3 gap-3 text-center my-4 shadow-sm">
                <div className="p-2 bg-white rounded-xl border border-slate-100">
                  <span className="summary-label text-[9px] font-bold text-slate-500 uppercase tracking-wider block">Total Debet (Pemasukan)</span>
                  <p className="summary-val text-sm font-black text-emerald-700 tabular-nums mt-1">{formatRupiah(totalDebet)}</p>
                </div>
                <div className="p-2 bg-white rounded-xl border border-slate-100">
                  <span className="summary-label text-[9px] font-bold text-slate-500 uppercase tracking-wider block">Total Kredit (Pengeluaran)</span>
                  <p className="summary-val text-sm font-black text-rose-700 tabular-nums mt-1">{formatRupiah(totalKredit)}</p>
                </div>
                <div className="p-2 bg-white rounded-xl border border-slate-100">
                  <span className="summary-label text-[9px] font-bold text-slate-500 uppercase tracking-wider block">Saldo Akhir Periode</span>
                  <p className={`summary-val text-sm font-black tabular-nums mt-1 ${sisaDana >= 0 ? 'text-blue-800' : 'text-rose-700'}`}>
                    {formatSaldoRupiah(sisaDana)}
                  </p>
                </div>
              </div>
            )}

            {/* FORMAL ACCOUNTING JOURNAL TABLE */}
            <div className="overflow-x-auto">
              <table className="journal-table w-full border-collapse text-xs my-4 font-sans">
                <thead>
                  <tr className="bg-[#1A365D] text-white text-[9.5px] uppercase tracking-wider font-bold">
                    <th className="p-2.5 border border-[#1A365D] text-center w-10">No</th>
                    <th className="p-2.5 border border-[#1A365D] text-center w-24">Tanggal</th>
                    <th className="p-2.5 border border-[#1A365D] text-left">Uraian / Deskripsi Transaksi</th>
                    <th className="p-2.5 border border-[#1A365D] text-left w-32">Kategori</th>
                    <th className="p-2.5 border border-[#1A365D] text-right w-28">Debet (+)</th>
                    <th className="p-2.5 border border-[#1A365D] text-right w-28">Kredit (-)</th>
                    <th className="p-2.5 border border-[#1A365D] text-right w-32">Saldo Sisa (Rp)</th>
                  </tr>
                </thead>
                <tbody>
                  {tableRows.map((row, idx) => (
                    <tr key={idx} className={idx % 2 === 0 ? 'bg-white hover:bg-emerald-50/20' : 'bg-[#F8FAFC] hover:bg-emerald-50/20'}>
                      <td className="p-2.5 border border-slate-200 text-center text-slate-500 font-medium tabular-nums">{row.no}</td>
                      <td className="p-2.5 border border-slate-200 text-center font-medium whitespace-nowrap text-slate-700 tabular-nums">{row.tanggal}</td>
                      <td className="p-2.5 border border-slate-200 text-left font-bold text-slate-900 break-words">{row.deskripsi}</td>
                      <td className="p-2.5 border border-slate-200 text-left text-slate-600 font-medium">{row.kategori}</td>
                      <td className="p-2.5 border border-slate-200 text-right font-semibold text-emerald-700 tabular-nums">
                        {row.debet > 0 ? formatRupiah(row.debet) : '-'}
                      </td>
                      <td className="p-2.5 border border-slate-200 text-right font-semibold text-rose-700 tabular-nums">
                        {row.kredit > 0 ? formatRupiah(row.kredit) : '-'}
                      </td>
                      <td className={`p-2.5 border border-slate-200 text-right font-black tabular-nums ${row.saldo >= 0 ? 'text-slate-900' : 'text-rose-700'}`}>
                        {formatSaldoRupiah(row.saldo)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-100 font-extrabold border-t-2 border-[#1A365D]">
                    <td colSpan={4} className="p-3 border border-slate-300 text-right uppercase text-slate-700 tracking-wider">
                      TOTAL &amp; POSISI SISA DANA
                    </td>
                    <td className="p-3 border border-slate-300 text-right text-emerald-700 font-extrabold tabular-nums">{formatRupiah(totalDebet)}</td>
                    <td className="p-3 border border-slate-300 text-right text-rose-700 font-extrabold tabular-nums">{formatRupiah(totalKredit)}</td>
                    <td className={`p-3 border border-slate-300 text-right font-black tabular-nums ${sisaDana >= 0 ? 'text-blue-900' : 'text-rose-700'}`}>
                      {formatSaldoRupiah(sisaDana)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* FORMAL SIGNATURE BOX AT BOTTOM */}
            <div className="signature-container my-8">
              <div className="signature-box">
                <p className="text-xs text-slate-600 font-medium mb-1">Disiapkan Oleh:</p>
                <div className="signature-space"></div>
                <div className="signature-line text-xs font-bold text-[#1A365D]">
                  Admin Keuangan PT ARP
                </div>
              </div>
              <div className="signature-box">
                <p className="text-xs text-slate-600 font-medium mb-1">Disetujui Oleh:</p>
                <div className="signature-space"></div>
                <div className="signature-line text-xs font-bold text-[#1A365D]">
                  Manajemen / Direksi
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </Modal>
  );
}
