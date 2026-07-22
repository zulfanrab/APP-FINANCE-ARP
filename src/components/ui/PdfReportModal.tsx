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

  if (!isOpen) return null;

  const companyName = 'PT. AKSARA RIKSA PERDANA';
  const companyAddress = 'Jl. Cibodas Raya No. 02, Antapani Kidul, Kecamatan Antapani, Kota Bandung, Jawa Barat 40291';
  const companyPhone = '+62 821-2984-9515';
  const companyEmail = 'aksara.riksa.perdana@gmail.com';
  const companyWebsite = 'aksarariksapjk3.com';

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
    // ============================================================
    // PROJECT REALISASI MATH: Starts with Modal Disuntikkan (Anggaran)
    // ============================================================
    modalAwal = project.anggaran || 0;

    const ptx = approvedTx.filter(
      t => t.proyekId === project.id && !t.deskripsi.startsWith('Suntikan Modal Proyek:')
    );

    const sortedPtx = [...ptx].sort(
      (a, b) => new Date(a.tanggal).getTime() - new Date(b.tanggal).getTime()
    );

    let currentBalance = modalAwal;

    // Initial Capital Row
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
    // ============================================================
    // KAS UTAMA JOURNAL MATH
    // ============================================================
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
            @page {
              size: A4;
              margin: 12mm;
            }
            body {
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
              color: #0F172A;
              font-size: 11px;
              line-height: 1.4;
              margin: 0;
              padding: 0;
              background: #fff;
            }
            .kop-container {
              text-align: center;
              padding-bottom: 8px;
              border-bottom: 2.5px solid #0F172A;
              margin-bottom: 2px;
            }
            .kop-line-secondary {
              border-bottom: 1px solid #94A3B8;
              margin-bottom: 16px;
            }
            .company-title {
              font-size: 18px;
              font-weight: 900;
              color: #0F172A;
              letter-spacing: 0.5px;
              margin: 0;
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
              font-size: 14px;
              font-weight: 800;
              color: #0F172A;
              text-transform: uppercase;
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
              border: 1px solid #E2E8F0;
              border-radius: 8px;
              background-color: #F8FAFC;
              margin-bottom: 16px;
              padding: 10px;
            }
            .summary-cell {
              display: table-cell;
              width: 25%;
              text-align: center;
              vertical-align: middle;
            }
            .summary-label {
              font-size: 8.5px;
              color: #64748B;
              text-transform: uppercase;
              font-weight: 700;
            }
            .summary-val {
              font-size: 13px;
              font-weight: 800;
              margin-top: 2px;
            }
            .val-masuk { color: #166534; }
            .val-keluar { color: #991B1B; }
            .val-net { color: #0284C7; }
            table.journal-table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 25px;
            }
            table.journal-table th {
              background-color: #0F172A;
              color: #ffffff;
              font-size: 9px;
              font-weight: 700;
              text-transform: uppercase;
              padding: 8px 6px;
              border: 1px solid #0F172A;
            }
            table.journal-table td {
              padding: 7px 6px;
              border: 1px solid #CBD5E1;
              font-size: 10px;
            }
            table.journal-table tr:nth-child(even) {
              background-color: #F8FAFC;
            }
            .text-right { text-align: right; }
            .text-center { text-align: center; }
            .font-bold { font-weight: 700; }
            .signature-container {
              display: table;
              width: 100%;
              margin-top: 35px;
              page-break-inside: avoid;
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
              border-top: 1px solid #0F172A;
              width: 160px;
              margin: 0 auto;
              padding-top: 4px;
              font-weight: 700;
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
        <div className="max-h-[70vh] overflow-y-auto p-4 sm:p-6 bg-white border border-gray-200 rounded-2xl shadow-inner scrollbar-thin">
          <div ref={printRef} className="space-y-4 text-slate-900">
            {/* EXACT OFFICIAL KOP HEADER FROM USER SCREENSHOT */}
            <div>
              <div className="kop-container text-center pb-2 border-b-2 border-slate-900">
                <h1 className="company-title text-xl font-black text-slate-900 tracking-tight uppercase">
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
              <h2 className="doc-title text-base font-extrabold text-slate-900 uppercase tracking-wide">{title}</h2>
              <p className="doc-subtitle text-xs text-slate-600 mt-1">
                {subtitle} · Periode: <strong className="text-slate-800">{periodText}</strong>
              </p>
              {project && (
                <p className="text-xs font-bold text-blue-700 mt-0.5">
                  NAMA PROYEK: {project.nama.toUpperCase()} | KLIEN: {project.klien.toUpperCase()}
                </p>
              )}
            </div>

            {/* EXECUTIVE FINANCIAL SUMMARY */}
            {project ? (
              <div className="summary-box bg-slate-50 border border-slate-200 rounded-xl p-3 grid grid-cols-2 sm:grid-cols-5 gap-2 text-center my-4">
                <div>
                  <span className="summary-label text-[9px] font-bold text-slate-500 uppercase">Modal Disuntikkan</span>
                  <p className="summary-val text-sm font-black text-purple-800">{formatRupiah(modalAwal)}</p>
                </div>
                <div>
                  <span className="summary-label text-[9px] font-bold text-slate-500 uppercase">Invoice Klien</span>
                  <p className="summary-val val-masuk text-sm font-black text-blue-700">{formatRupiah(totalDebet > modalAwal ? totalDebet - modalAwal : 0)}</p>
                </div>
                <div>
                  <span className="summary-label text-[9px] font-bold text-slate-500 uppercase">Pengeluaran Riil</span>
                  <p className="summary-val val-keluar text-sm font-black text-red-700">{formatRupiah(totalKredit)}</p>
                </div>
                <div>
                  <span className="summary-label text-[9px] font-bold text-slate-500 uppercase">Laba - Rugi (P&L)</span>
                  <p className={`summary-val text-sm font-black ${((totalDebet > modalAwal ? totalDebet - modalAwal : 0) - totalKredit) >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                    {formatRupiah((totalDebet > modalAwal ? totalDebet - modalAwal : 0) - totalKredit)}
                  </p>
                </div>
                <div>
                  <span className="summary-label text-[9px] font-bold text-slate-500 uppercase">Saldo Kas Proyek</span>
                  <p className={`summary-val val-net text-sm font-black ${sisaDana >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                    {formatRupiah(sisaDana)}
                  </p>
                </div>
              </div>
            ) : (
              <div className="summary-box bg-slate-50 border border-slate-200 rounded-xl p-3 grid grid-cols-3 gap-2 text-center my-4">
                <div>
                  <span className="summary-label text-[9px] font-bold text-slate-500 uppercase">Total Debet (Pemasukan)</span>
                  <p className="summary-val val-masuk text-sm font-black text-emerald-700">{formatRupiah(totalDebet)}</p>
                </div>
                <div>
                  <span className="summary-label text-[9px] font-bold text-slate-500 uppercase">Total Kredit (Pengeluaran)</span>
                  <p className="summary-val val-keluar text-sm font-black text-red-700">{formatRupiah(totalKredit)}</p>
                </div>
                <div>
                  <span className="summary-label text-[9px] font-bold text-slate-500 uppercase">Saldo Akhir Periode</span>
                  <p className={`summary-val val-net text-sm font-black ${sisaDana >= 0 ? 'text-blue-700' : 'text-red-700'}`}>
                    {formatRupiah(sisaDana)}
                  </p>
                </div>
              </div>
            )}

            {/* FORMAL ACCOUNTING JOURNAL TABLE */}
            <div className="overflow-x-auto">
              <table className="journal-table w-full border-collapse text-xs my-4">
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

          </div>
        </div>
      </div>
    </Modal>
  );
}
