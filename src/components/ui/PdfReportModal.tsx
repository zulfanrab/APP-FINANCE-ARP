// ============================================================
// ARKA Finance — Official Printable PDF & KOP Document Engine
// Matches Official KOP Image 100%: PT. AKSARA RIKSA PERDANA
// Fixes Mobile Safari / Android Chrome PDF Download & Print Popup Bug
// ============================================================

import React, { useRef, useState } from 'react';
import { Printer, FileText, CheckCircle2, Download, Loader2 } from 'lucide-react';
import { Modal } from './Modal';
import { type Transaction, type Project } from '../../types';
import { formatDate, formatRupiah } from './index';
import { OFFICIAL_COMPANY_INFO } from '../../services/exportService';

interface PdfReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  periodText: string;
  transactions: Transaction[];
  project?: Project | null;
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
  const [printing, setPrinting] = useState(false);

  if (!isOpen) return null;

  const companyName = OFFICIAL_COMPANY_INFO.name;
  const printDate = new Date().toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

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
    // PROJECT REALISASI MATH
    modalAwal = project.anggaran || 0;

    const ptx = approvedTx.filter(
      t => t.proyekId === project.id && !t.deskripsi.startsWith('Suntikan Modal Proyek:')
    );

    const sortedPtx = [...ptx].sort(
      (a, b) => new Date(a.tanggal).getTime() - new Date(b.tanggal).getTime()
    );

    let currentBalance = modalAwal;

    tableRows.push({
      no: 1,
      tanggal: formatDate(project.tanggalMulai),
      deskripsi: 'Penerimaan Modal Proyek (Disuntikkan Pak Fatwa)',
      kategori: 'Modal Disuntikkan',
      debet: modalAwal,
      kredit: 0,
      saldo: currentBalance,
    });

    totalDebet += modalAwal;

    sortedPtx.forEach((t, idx) => {
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
        no: idx + 2,
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
    // KAS UTAMA JOURNAL MATH
    const mainTx = approvedTx.filter(
      t => !t.proyekId || t.deskripsi.startsWith('Suntikan Modal Proyek:')
    );

    const sortedMain = [...mainTx].sort(
      (a, b) => new Date(a.tanggal).getTime() - new Date(b.tanggal).getTime()
    );

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

  /**
   * UNIVERSAL MOBILE & DESKTOP PRINT / PDF DOWNLOAD HANDLER
   * Resolves Mobile iOS Safari & Android Chrome popup block & print failure bugs
   */
  const handlePrint = () => {
    const content = printRef.current;
    if (!content) return;

    setPrinting(true);

    // 1. Create temporary printable container on main DOM
    const printContainer = document.createElement('div');
    printContainer.id = 'arka-printable-pdf-root';
    printContainer.innerHTML = content.innerHTML;

    // 2. Add high-precision print CSS style sheet
    const styleEl = document.createElement('style');
    styleEl.id = 'arka-printable-pdf-styles';
    styleEl.innerHTML = `
      @media print {
        body > *:not(#arka-printable-pdf-root) {
          display: none !important;
        }
        #arka-printable-pdf-root {
          display: block !important;
          position: absolute !important;
          left: 0 !important;
          top: 0 !important;
          width: 100% !important;
          margin: 0 !important;
          padding: 10mm !important;
          background: #ffffff !important;
          font-family: Arial, Helvetica, sans-serif !important;
          font-size: 11px !important;
          color: #0F172A !important;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        @page {
          size: A4 portrait;
          margin: 10mm;
        }
        .kop-container {
          text-align: center !important;
          padding-bottom: 8px !important;
          border-bottom: 2px solid #0F172A !important;
        }
        .company-title {
          font-size: 18px !important;
          font-weight: 900 !important;
          color: #0F172A !important;
          margin: 0 !important;
        }
        .company-info {
          font-size: 9px !important;
          color: #334155 !important;
          margin-top: 3px !important;
        }
        table.journal-table {
          width: 100% !important;
          border-collapse: collapse !important;
          margin-top: 15px !important;
        }
        table.journal-table th {
          background-color: #0F172A !important;
          color: #ffffff !important;
          padding: 6px !important;
          border: 1px solid #0F172A !important;
          font-size: 9px !important;
        }
        table.journal-table td {
          padding: 6px !important;
          border: 1px solid #94A3B8 !important;
          font-size: 9.5px !important;
        }
        .signature-container {
          display: table !important;
          width: 100% !important;
          margin-top: 35px !important;
          page-break-inside: avoid !important;
        }
        .signature-box {
          display: table-cell !important;
          width: 50% !important;
          text-align: center !important;
        }
      }
    `;

    document.head.appendChild(styleEl);
    document.body.appendChild(printContainer);

    // 3. Trigger native print / save as PDF sheet
    setTimeout(() => {
      window.print();

      // Clean up after print sheet closes
      setTimeout(() => {
        if (document.body.contains(printContainer)) {
          document.body.removeChild(printContainer);
        }
        if (document.head.contains(styleEl)) {
          document.head.removeChild(styleEl);
        }
        setPrinting(false);
      }, 500);
    }, 200);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Cetak Laporan PDF Resmi" size="xl">
      <div className="space-y-4">
        {/* Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 bg-slate-100 rounded-2xl border border-slate-200">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
            <FileText size={16} className="text-emerald-600 flex-shrink-0" />
            <span>Format Akuntansi Resmi bertanda tangan (Presisi Mobile &amp; Desktop)</span>
          </div>
          <button
            onClick={handlePrint}
            disabled={printing}
            className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-md transition-all active:scale-95 disabled:opacity-50"
          >
            {printing ? <Loader2 size={15} className="animate-spin" /> : <Printer size={15} />}
            <span>Cetak / Download PDF</span>
          </button>
        </div>

        {/* Printable Document Preview Area */}
        <div className="max-h-[70vh] overflow-y-auto p-4 sm:p-6 bg-white border border-gray-200 rounded-2xl shadow-inner scrollbar-thin">
          <div ref={printRef} className="space-y-4 text-slate-900">
            {/* OFFICIAL MATCHED KOP SURAT (MATCHES IMAGE 100%) */}
            <div>
              <div className="kop-container text-center pb-2.5 border-b-2 border-slate-900">
                <h1 className="company-title text-xl sm:text-2xl font-black text-slate-900 tracking-tight uppercase">
                  {companyName}
                </h1>
                <p className="company-info text-[10px] sm:text-xs font-semibold text-slate-700 mt-1 leading-snug">
                  {OFFICIAL_COMPANY_INFO.address}
                </p>
                <p className="company-info text-[10px] text-slate-600 mt-0.5 font-medium">
                  📞 Telp: <strong>{OFFICIAL_COMPANY_INFO.phone}</strong> · ✉️ Email: <strong>{OFFICIAL_COMPANY_INFO.email}</strong> · 🌐 Web: <strong>{OFFICIAL_COMPANY_INFO.website}</strong>
                </p>
              </div>
              <div className="border-b border-slate-300 mt-0.5 mb-4" />
            </div>

            {/* DOCUMENT TITLE & METADATA */}
            <div className="doc-header text-center my-3">
              <h2 className="doc-title text-sm sm:text-base font-black text-slate-900 uppercase tracking-wide">{title}</h2>
              <p className="doc-subtitle text-xs text-slate-600 mt-1">
                {subtitle} · Periode: <strong className="text-slate-800">{periodText}</strong>
              </p>
              {project && (
                <p className="text-xs font-extrabold text-blue-700 mt-1 uppercase">
                  NAMA PROYEK: {project.nama} | KLIEN: {project.klien}
                </p>
              )}
            </div>

            {/* EXECUTIVE FINANCIAL SUMMARY */}
            {project ? (
              <div className="summary-box bg-slate-50 border border-slate-200 rounded-xl p-3 grid grid-cols-2 sm:grid-cols-4 gap-2 text-center my-4">
                <div className="p-1.5">
                  <span className="summary-label text-[9px] font-bold text-slate-500 uppercase">Modal Disuntikkan</span>
                  <p className="summary-val text-xs sm:text-sm font-black text-slate-900">{formatRupiah(modalAwal)}</p>
                </div>
                <div className="p-1.5">
                  <span className="summary-label text-[9px] font-bold text-slate-500 uppercase">Total Belanja Lapangan</span>
                  <p className="summary-val val-keluar text-xs sm:text-sm font-black text-red-700">{formatRupiah(totalKredit)}</p>
                </div>
                <div className="p-1.5">
                  <span className="summary-label text-[9px] font-bold text-slate-500 uppercase">Total Refund Masuk</span>
                  <p className="summary-val val-masuk text-xs sm:text-sm font-black text-emerald-700">{formatRupiah(Math.max(0, totalDebet - modalAwal))}</p>
                </div>
                <div className="p-1.5">
                  <span className="summary-label text-[9px] font-bold text-slate-500 uppercase">Sisa Dana Proyek</span>
                  <p className={`summary-val val-net text-xs sm:text-sm font-black ${sisaDana >= 0 ? 'text-blue-700' : 'text-red-700'}`}>
                    {formatRupiah(sisaDana)}
                  </p>
                </div>
              </div>
            ) : (
              <div className="summary-box bg-slate-50 border border-slate-200 rounded-xl p-3 grid grid-cols-3 gap-2 text-center my-4">
                <div className="p-1.5">
                  <span className="summary-label text-[9px] font-bold text-slate-500 uppercase">Total Debet (Pemasukan)</span>
                  <p className="summary-val val-masuk text-xs sm:text-sm font-black text-emerald-700">{formatRupiah(totalDebet)}</p>
                </div>
                <div className="p-1.5">
                  <span className="summary-label text-[9px] font-bold text-slate-500 uppercase">Total Kredit (Pengeluaran)</span>
                  <p className="summary-val val-keluar text-xs sm:text-sm font-black text-red-700">{formatRupiah(totalKredit)}</p>
                </div>
                <div className="p-1.5">
                  <span className="summary-label text-[9px] font-bold text-slate-500 uppercase">Saldo Akhir Periode</span>
                  <p className={`summary-val val-net text-xs sm:text-sm font-black ${sisaDana >= 0 ? 'text-blue-700' : 'text-red-700'}`}>
                    {formatRupiah(sisaDana)}
                  </p>
                </div>
              </div>
            )}

            {/* FORMAL ACCOUNTING JOURNAL TABLE */}
            <div className="overflow-x-auto">
              <table className="journal-table w-full border-collapse text-xs my-3">
                <thead>
                  <tr className="bg-slate-900 text-white text-[10px] uppercase">
                    <th className="p-2 border border-slate-900 text-center w-8">No</th>
                    <th className="p-2 border border-slate-900 text-left w-20">Tanggal</th>
                    <th className="p-2 border border-slate-900 text-left">Uraian / Deskripsi Transaksi</th>
                    <th className="p-2 border border-slate-900 text-left w-28">Kategori</th>
                    <th className="p-2 border border-slate-900 text-right w-24">Debet (+)</th>
                    <th className="p-2 border border-slate-900 text-right w-24">Kredit (-)</th>
                    <th className="p-2 border border-slate-900 text-right w-28">Saldo Sisa (Rp)</th>
                  </tr>
                </thead>
                <tbody>
                  {tableRows.map((row, idx) => (
                    <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                      <td className="p-2 border border-slate-200 text-center text-slate-500">{row.no}</td>
                      <td className="p-2 border border-slate-200 font-medium whitespace-nowrap">{row.tanggal}</td>
                      <td className="p-2 border border-slate-200 font-bold text-slate-800">{row.deskripsi}</td>
                      <td className="p-2 border border-slate-200 text-slate-600">{row.kategori}</td>
                      <td className="p-2 border border-slate-200 text-right font-semibold text-emerald-700">
                        {row.debet > 0 ? formatRupiah(row.debet) : '-'}
                      </td>
                      <td className="p-2 border border-slate-200 text-right font-semibold text-red-700">
                        {row.kredit > 0 ? formatRupiah(row.kredit) : '-'}
                      </td>
                      <td className="p-2 border border-slate-200 text-right font-black text-slate-900">
                        {formatRupiah(row.saldo)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-100 font-extrabold border-t-2 border-slate-900">
                    <td colSpan={4} className="p-2.5 border border-slate-300 text-right uppercase text-slate-700">
                      TOTAL &amp; POSISI SISA DANA
                    </td>
                    <td className="p-2.5 border border-slate-300 text-right text-emerald-700">{formatRupiah(totalDebet)}</td>
                    <td className="p-2.5 border border-slate-300 text-right text-red-700">{formatRupiah(totalKredit)}</td>
                    <td className="p-2.5 border border-slate-300 text-right text-blue-700">{formatRupiah(sisaDana)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* OFFICIAL SIGNATURE BLOCK */}
            <div className="signature-container grid grid-cols-2 gap-8 pt-8 mt-6 border-t border-slate-200">
              <div className="text-center space-y-12">
                <div>
                  <p className="text-xs text-slate-500 font-medium">Dibuat Oleh,</p>
                  <p className="text-xs font-bold text-slate-800">Admin Keuangan PT ARP</p>
                </div>
                <div className="signature-line border-t border-slate-900 w-40 mx-auto pt-1 font-bold text-xs">
                  ( Admin Keuangan )
                </div>
              </div>

              <div className="text-center space-y-12">
                <div>
                  <p className="text-xs text-slate-500 font-medium">Bandung, {printDate}</p>
                  <p className="text-xs font-bold text-slate-800">Mengetahui &amp; Menyetujui,</p>
                </div>
                <div className="signature-line border-t border-slate-900 w-40 mx-auto pt-1 font-bold text-xs">
                  Pak Fatwa (Direktur/Owner)
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
