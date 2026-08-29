// ============================================================
// ARKA Finance — Official Printable PDF & KOP Document Engine
// Matches Official Letterhead Details (Jl. Cibodas Raya No. 02, Antapani Kidul,
// +62 821-2984-9515, aksara.riksa.perdana@gmail.com, aksarariksapjk3.com)
// Universal Hidden-Iframe Printing for 100% Mobile HP & Desktop Compatibility
// ============================================================

import React, { useRef, useState, useEffect } from 'react';
import { Printer, FileText } from 'lucide-react';
import QRCode from 'qrcode';
import { Modal } from './Modal';
import { type Transaction, type Project } from '../../types';
import { formatDate, formatRupiah } from './index';
import { groupAndSortTransactions } from '../../services/transactionService';
import { isMutasiInternal, isOmzetRil } from '../../services/analyticsService';
import { classifyTransaction } from '../../services/financialEngine';

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

/** Check if a transaction is a Capital Allocation / Injection (Alokasi Modal Operasional / Drop Dana Surat Pengajuan) */
export function isCapitalInjectionTx(t: Transaction): boolean {
  if (t.jenis !== 'masuk') return false;
  const k = (t.kategori || '').toLowerCase();
  const d = (t.deskripsi || '').toLowerCase();

  // STRICT RULE: Exclude any refund / sisa panjar / pengembalian dana from being treated as a Surat Pengajuan!
  if (k.includes('refund') || k.includes('pengembalian') || d.includes('refund') || d.includes('sisa panjar') || d.includes('sisa dana')) {
    return false;
  }

  return isMutasiInternal(t) || k.includes('mutasi') || d.includes('modal') || d.includes('pengajuan') || d.includes('drop dana') || d.includes('surat pengajuan') || d.includes('budget');
}

export interface AccountingPageChunk {
  pageNumber: number;
  isFirstPage: boolean;
  isLastPage: boolean;
  rows: {
    no: number | string;
    tanggal: string;
    deskripsi: string;
    kategori: string;
    debet: number;
    kredit: number;
    saldo: number;
  }[];
  pindahanDebet?: number;
  pindahanKredit?: number;
  pindahanSaldo?: number;
  dipindahkanDebet?: number;
  dipindahkanKredit?: number;
  dipindahkanSaldo?: number;
}

/**
 * Standard Indonesian Accounting Page Chunker
 * Splits transactions across physical paper pages and computes:
 * - "JUMLAH DIPINDAHKAN KE HALAMAN BERIKUTNYA" at bottom of split page
 * - "PINDAHAN DARI HALAMAN SEBELUMNYA" at top of subsequent page
 */
export function splitTransactionsIntoAccountingPages(
  rows: { no: number | string; tanggal: string; deskripsi: string; kategori: string; debet: number; kredit: number; saldo: number }[],
  isF4: boolean = true,
  hasProcurementItems: boolean = false,
  hasKopAndSummary: boolean = true
): AccountingPageChunk[] {
  // If everything fits on a single page
  const singlePageLimit = hasProcurementItems
    ? (isF4 ? 14 : 10)
    : (isF4 ? 18 : 14);

  if (rows.length <= singlePageLimit) {
    return [{
      pageNumber: 1,
      isFirstPage: true,
      isLastPage: true,
      rows: rows,
    }];
  }

  // Multi-page layout limits strictly calibrated to prevent accidental browser overflow:
  // Page 1: Kop + Info + Summary + (Optional Procurement Matrix) + Table
  const firstPageLimit = hasProcurementItems
    ? (isF4 ? 12 : 9)
    : (isF4 ? 18 : 14);

  // Subsequent pages: Top Pindahan Header + Table + Bottom Dipindahkan Footer
  const subsequentPageLimit = isF4 ? 26 : 21;

  const chunks: AccountingPageChunk[] = [];
  let currentIndex = 0;
  let runningDebet = 0;
  let runningKredit = 0;
  let pageNumber = 1;

  while (currentIndex < rows.length) {
    const limit = pageNumber === 1 ? firstPageLimit : subsequentPageLimit;
    const chunkRows = rows.slice(currentIndex, currentIndex + limit);
    const isLastPage = currentIndex + limit >= rows.length;
    const isFirstPage = pageNumber === 1;

    const prevDebet = runningDebet;
    const prevKredit = runningKredit;
    const prevSaldo = runningDebet - runningKredit;

    chunkRows.forEach(r => {
      runningDebet += r.debet;
      runningKredit += r.kredit;
    });

    const currentDebet = runningDebet;
    const currentKredit = runningKredit;
    const currentSaldo = runningDebet - runningKredit;

    chunks.push({
      pageNumber,
      isFirstPage,
      isLastPage,
      rows: chunkRows,
      pindahanDebet: isFirstPage ? undefined : prevDebet,
      pindahanKredit: isFirstPage ? undefined : prevKredit,
      pindahanSaldo: isFirstPage ? undefined : prevSaldo,
      dipindahkanDebet: isLastPage ? undefined : currentDebet,
      dipindahkanKredit: isLastPage ? undefined : currentKredit,
      dipindahkanSaldo: isLastPage ? undefined : currentSaldo,
    });

    currentIndex += limit;
    pageNumber++;
  }

  return chunks;
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
  const [reportScope, setReportScope] = useState<'konsolidasi' | 'kas_utama'>('konsolidasi');
  const [paperSize, setPaperSize] = useState<'f4' | 'a4'>('f4');
  const [customPelaksanaName, setCustomPelaksanaName] = useState<string>('');
  const [selectedPengajuanTxId, setSelectedPengajuanTxId] = useState<string>('semua');

  // Digital Signature Images & Flexible Otorisasi Config State
  const [sigCount, setSigCount] = useState<number>(() => {
    const saved = localStorage.getItem('signature_slot_count');
    return saved ? parseInt(saved, 10) : 3;
  });

  const updateSigCount = (count: number) => {
    setSigCount(count);
    localStorage.setItem('signature_slot_count', String(count));
  };

  // Slot 1: Teknisi / PIC Lapangan
  const [sig1Header, setSig1Header] = useState<string>(() => localStorage.getItem('sig1_header') || 'Diajukan / Teknisi:');
  const [sig1Nama, setSig1Nama] = useState<string>(() => localStorage.getItem('sig1_nama') || (project?.teknisiPic || 'Fauzan'));
  const [sig1Jabatan, setSig1Jabatan] = useState<string>(() => localStorage.getItem('sig1_jabatan') || 'PIC Lapangan / Teknisi');
  const [sig1Img, setSig1Img] = useState<string>(() => localStorage.getItem('signature_slot1') || '');

  // Slot 2: Leader Teknik
  const [sig2Header, setSig2Header] = useState<string>(() => localStorage.getItem('sig2_header') || 'Mengetahui (Leader):');
  const [sig2Nama, setSig2Nama] = useState<string>(() => localStorage.getItem('sig2_nama') || (project?.pemohonNama || 'Rama Regawa Sri Anggayana'));
  const [sig2Jabatan, setSig2Jabatan] = useState<string>(() => localStorage.getItem('sig2_jabatan') || (project?.pemohonJabatan || 'Leader Teknik'));
  const [sig2Img, setSig2Img] = useState<string>(() => localStorage.getItem('signature_slot2') || localStorage.getItem('signature_pemohon') || '');

  // Slot 3: Admin Keuangan
  const [sig3Header, setSig3Header] = useState<string>(() => localStorage.getItem('sig3_header') || 'Diverifikasi & Disiapkan:');
  const [sig3Nama, setSig3Nama] = useState<string>(() => localStorage.getItem('sig3_nama') || 'Zulfan Rafly Baihaqi');
  const [sig3Jabatan, setSig3Jabatan] = useState<string>(() => localStorage.getItem('sig3_jabatan') || 'Admin Keuangan (Finance)');
  const [sig3Img, setSig3Img] = useState<string>(() => localStorage.getItem('signature_slot3') || localStorage.getItem('signature_finance') || '');

  // Slot 4: Direktur Utama
  const [sig4Header, setSig4Header] = useState<string>(() => localStorage.getItem('sig4_header') || 'Menyetujui & Disetujui:');
  const [sig4Nama, setSig4Nama] = useState<string>(() => localStorage.getItem('sig4_nama') || 'Habsi Gufira Pradana');
  const [sig4Jabatan, setSig4Jabatan] = useState<string>(() => localStorage.getItem('sig4_jabatan') || 'Direktur Utama');
  const [sig4Img, setSig4Img] = useState<string>(() => localStorage.getItem('signature_slot4') || localStorage.getItem('signature_direktur') || '');

  // Paraf Pembuat Draft (Dekat Lead Teknik)
  const [parafEnabled, setParafEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem('paraf_enabled');
    return saved !== null ? saved === 'true' : true;
  });
  const [parafNama, setParafNama] = useState<string>(() => localStorage.getItem('paraf_nama') || (project?.teknisiPic || 'Fauzan'));
  const [parafImg, setParafImg] = useState<string>(() => localStorage.getItem('signature_paraf') || '');

  // Editable Document Metadata (Allows instant on-the-fly adjustment before print)
  const [docPerihal, setDocPerihal] = useState<string>(() => project?.nama || '');
  const [docNomorSurat, setDocNomorSurat] = useState<string>(() => project?.nomorSurat || '');
  const [docKlien, setDocKlien] = useState<string>(() => project?.klien || '');
  const [docPemohon, setDocPemohon] = useState<string>(() => project?.pemohonNama || 'Rama Regawa Sri Anggayana');
  const [docPic, setDocPic] = useState<string>(() => project?.teknisiPic || 'Fauzan');

  useEffect(() => {
    if (project) {
      setDocPerihal(project.nama || '');
      setDocNomorSurat(project.nomorSurat || '');
      setDocKlien(project.klien || '');
      setDocPemohon(project.pemohonNama || 'Rama Regawa Sri Anggayana');
      setDocPic(project.teknisiPic || 'Fauzan');
    }
  }, [project]);

  const handleParafUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      if (dataUrl) {
        setParafImg(dataUrl);
        localStorage.setItem('signature_paraf', dataUrl);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleParafClear = () => {
    setParafImg('');
    localStorage.removeItem('signature_paraf');
  };

  const handleSignatureUpload = (slotNum: 1 | 2 | 3 | 4, file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      if (dataUrl) {
        if (slotNum === 1) { setSig1Img(dataUrl); localStorage.setItem('signature_slot1', dataUrl); }
        else if (slotNum === 2) { setSig2Img(dataUrl); localStorage.setItem('signature_slot2', dataUrl); localStorage.setItem('signature_pemohon', dataUrl); }
        else if (slotNum === 3) { setSig3Img(dataUrl); localStorage.setItem('signature_slot3', dataUrl); localStorage.setItem('signature_finance', dataUrl); }
        else if (slotNum === 4) { setSig4Img(dataUrl); localStorage.setItem('signature_slot4', dataUrl); localStorage.setItem('signature_direktur', dataUrl); }
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSignatureClear = (slotNum: 1 | 2 | 3 | 4) => {
    if (slotNum === 1) { setSig1Img(''); localStorage.removeItem('signature_slot1'); }
    else if (slotNum === 2) { setSig2Img(''); localStorage.removeItem('signature_slot2'); localStorage.removeItem('signature_pemohon'); }
    else if (slotNum === 3) { setSig3Img(''); localStorage.removeItem('signature_slot3'); localStorage.removeItem('signature_finance'); }
    else if (slotNum === 4) { setSig4Img(''); localStorage.removeItem('signature_slot4'); localStorage.removeItem('signature_direktur'); }
  };

  if (!isOpen) return null;

  const companyName = 'PT. AKSARA RIKSA PERDANA';
  const companyAddress = 'Jl. Cibodas Raya No. 02, Antapani Kidul, Kecamatan Antapani, Kota Bandung, Jawa Barat 40291';
  const companyPhone = '+62 821-2984-9515';
  const companyEmail = 'aksara.riksa.perdana@gmail.com';
  const companyWebsite = 'aksarariksapjk3.com';

  // Dynamic Terminology Check: Internal Office/Operational Pos vs External Project vs General Consolidation
  const isInternal = Boolean(
    project && (
      project.tipe === 'operasional_kantor' ||
      (project.nama || '').toLowerCase().includes('kantor') ||
      (project.nama || '').toLowerCase().includes('operasional') ||
      (project.klien || '').toLowerCase().includes('admin') ||
      (project.klien || '').toLowerCase().includes('internal')
    )
  );

  let displayTitle = title;
  let displaySubtitle = subtitle;

  if (isInternal) {
    displayTitle = 'LAPORAN REALISASI & PERTANGGUNGJAWABAN KAS OPERASIONAL';
    displaySubtitle = subtitle.includes('Dokumen Keuangan Resmi') ? 'Dokumen Pertanggungjawaban Kas Operasional Internal' : subtitle;
  } else if (!project && reportScope === 'konsolidasi') {
    displayTitle = 'LAPORAN KEUANGAN KONSOLIDASI & AKUNTANSI PUSAT';
    displaySubtitle = 'Dokumen Keuangan Resmi Konsolidasi Seluruh Mutasi Kas Utama & Proyek (Lengkap 100% Transaksi)';
  } else if (!project && reportScope === 'kas_utama') {
    displayTitle = 'LAPORAN KEUANGAN & JURNAL KAS UTAMA';
    displaySubtitle = 'Dokumen Keuangan Resmi Mutasi Induk Kas Utama (Non-Proyek)';
  }

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
  let totalOmzetRil = 0;
  let totalOmzetSemu = 0;
  let sisaDana = 0;
  let modalDisuntikkan = 0;
  let pemasukanKlien = 0;
  let totalRefundMasuk = 0;
  let totalPengeluaranRiil = 0;

  if (project) {
    // ============================================================
    // PROJECT REALISASI MATH: Starts with Modal Disuntikkan (Anggaran)
    // ============================================================
    modalAwal = project.anggaran || 0;

    let ptx = approvedTx.filter(t => t.proyekId === project.id);

    // Filter out internal capital refund/drain transactions so they don't corrupt the operational P&L report
    ptx = ptx.filter(t => {
      const k = (t.kategori || '').toLowerCase();
      const d = (t.deskripsi || '').toLowerCase();
      return !(t.jenis === 'keluar' && (
        k.includes('refund dana proyek') ||
        k.includes('refund sisa dana') ||
        d.includes('penarikan sisa dana')
      ));
    });

    // If a specific Surat Pengajuan is selected for LPJ filter
    if (selectedPengajuanTxId !== 'semua') {
      const allInjections = ptx.filter(t => isCapitalInjectionTx(t) || (t.jenis === 'masuk' && (t.kategori || '').toLowerCase().includes('mutasi')));
      const targetInjectionTx = allInjections.find(t => t.id === selectedPengajuanTxId);
      if (targetInjectionTx) {
        const injectionDate = new Date(targetInjectionTx.tanggal);
        const nextInjection = allInjections
          .filter(t => t.id !== selectedPengajuanTxId && new Date(t.tanggal) > injectionDate)
          .sort((a, b) => new Date(a.tanggal).getTime() - new Date(b.tanggal).getTime())[0];
        const nextInjectionDate = nextInjection ? new Date(nextInjection.tanggal) : null;

        ptx = ptx.filter(t => {
          if (t.id === selectedPengajuanTxId) return true;
          // Explicit tag check
          if (t.suratPengajuanId) {
            return t.suratPengajuanId === selectedPengajuanTxId;
          }
          // Date bounds check: paid on/after injection date AND before next injection date
          const txDate = new Date(t.tanggal);
          if (txDate < injectionDate) return false;
          if (nextInjectionDate && txDate >= nextInjectionDate) return false;
          return true;
        });

        displaySubtitle = `LPJ Khusus Pengajuan: ${targetInjectionTx.deskripsi} (${formatDate(targetInjectionTx.tanggal)})`;
      }
    }

    const sortedPtx = groupAndSortTransactions(ptx, 'asc');

    let currentBalance = 0;

    // Initial Capital Row if modalAwal > 0 and no explicit initial injection transaction exists in sortedPtx
    const hasExplicitInitialFunding = sortedPtx.some(t => 
      isCapitalInjectionTx(t) && (t.nominal === modalAwal || (t.deskripsi || '').toLowerCase().includes('alokasi modal proyek'))
    );

    if (modalAwal > 0 && !hasExplicitInitialFunding) {
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
      modalDisuntikkan += modalAwal;
    }

    const isClientIncomeCategory = (kat: string) => {
      const lower = (kat || '').toLowerCase();
      return (
        lower.includes('pembayaran') ||
        lower.includes('termijn') ||
        lower.includes('termin') ||
        lower.includes('pelunasan') ||
        lower.includes('klien') ||
        lower.includes('invoice') ||
        lower.includes('dp')
      );
    };

    sortedPtx.forEach((t) => {
      const isInjection = isCapitalInjectionTx(t);
      const isMasuk = t.jenis === 'masuk' || isInjection; // CAPITAL INJECTION IS ALWAYS DEBET (MASUK)!

      const debet = isMasuk ? t.nominal : 0;
      const kredit = !isMasuk ? t.nominal : 0;

      if (isMasuk) {
        currentBalance += t.nominal;
        totalDebet += t.nominal;
        if (isInjection || !isClientIncomeCategory(t.kategori)) {
          modalDisuntikkan += t.nominal;
          totalOmzetSemu += t.nominal;
        } else {
          pemasukanKlien += t.nominal;
          totalOmzetRil += t.nominal;
        }
      } else {
        currentBalance -= t.nominal;
        totalKredit += t.nominal;
        if ((t.kategori || '').toLowerCase().includes('refund')) {
           totalRefundMasuk += t.nominal;
        }
        if (!isMutasiInternal(t)) {
          totalPengeluaranRiil += t.nominal;
        }
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
    // GENERAL REPORT MATH (MODE A: KONSOLIDASI 100% vs MODE B: KAS UTAMA ONLY)
    // ============================================================
    const mainTx = reportScope === 'konsolidasi'
      ? approvedTx
      : approvedTx.filter(
          t => !t.proyekId || isCapitalInjectionTx(t) || t.kategori === 'Mutasi Internal / Transfer Kas' || t.kategori === 'Refund Dana Proyek ke Kas Utama'
        );

    const sortedMain = groupAndSortTransactions(mainTx, 'asc');

    let currentBalance = 0;

    sortedMain.forEach((t, idx) => {
      let debet = 0;
      let kredit = 0;

      if (reportScope === 'konsolidasi') {
        if (t.jenis === 'masuk') debet = t.nominal;
        else kredit = t.nominal;
      } else {
        const classification = classifyTransaction(t);
        if (!t.proyekId) {
          if (t.jenis === 'masuk') debet = t.nominal;
          else kredit = t.nominal;
        } else {
          if (classification.isCapitalInjectionToProject) {
            kredit = t.nominal; // Money out of Kas Utama
          } else if (classification.isRefundToKasUtama) {
            debet = t.nominal; // Money in to Kas Utama
          }
        }
      }

      currentBalance += debet - kredit;
      totalDebet += debet;
      totalKredit += kredit;

      if (debet > 0) {
        if (isOmzetRil(t)) {
          totalOmzetRil += debet;
        } else {
          totalOmzetSemu += debet;
        }
      }

      if (!isMutasiInternal(t) && kredit > 0) {
        totalPengeluaranRiil += kredit;
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
  const handlePrint = async (withAttachments: boolean = false) => {
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

    let attachmentsHtml = '';
    
    if (withAttachments) {
      // Find all transactions with attachments or receipts based on report context
      const reportTxs = project 
        ? groupAndSortTransactions(approvedTx.filter(t => t.proyekId === project?.id), 'asc') 
        : (reportScope === 'konsolidasi'
            ? groupAndSortTransactions(approvedTx, 'asc')
            : groupAndSortTransactions(approvedTx.filter(t => !t.proyekId || isCapitalInjectionTx(t) || t.kategori === 'Mutasi Internal / Transfer Kas' || t.kategori === 'Refund Dana Proyek ke Kas Utama'), 'asc')
          );

      const itemsToPrint: Array<{
        type: 'image' | 'pdf';
        url: string;
        nama: string;
        seqLabel: string;
        tanggal: string;
        deskripsi: string;
        nominal: number;
        jenis?: string;
        kategori?: string;
        isClientPayment?: boolean;
        isDropDana?: boolean;
        isFieldExpense?: boolean;
        hasOnlineLink?: boolean;
        qrDataUrl?: string;
      }> = [];

      const getDriveId = (url: string): string | null => {
        if (!url) return null;
        const match = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) || url.match(/id=([a-zA-Z0-9_-]+)/);
        return match ? match[1] : null;
      };

      const resolveUrl = (url: string): string => {
        if (!url) return '';
        if (url.includes('drive.google.com')) {
          const driveId = getDriveId(url);
          if (driveId) return `https://lh3.googleusercontent.com/d/${driveId}`;
        }
        return url;
      };

      const extractAttachmentObjects = (t: Transaction): Array<{ nama: string; tipe: string; dataUrl: string }> => {
        const result: Array<{ nama: string; tipe: string; dataUrl: string }> = [];

        // 1. Check buktiTransfer
        if (t.buktiTransfer && typeof t.buktiTransfer === 'string' && t.buktiTransfer.trim()) {
          const bt = t.buktiTransfer.trim();
          const isPdf = bt.toLowerCase().includes('.pdf') || bt.startsWith('data:application/pdf');
          result.push({
            nama: 'Bukti Transfer Bank',
            tipe: isPdf ? 'application/pdf' : 'image/png',
            dataUrl: bt,
          });
        }

        // 2. Check lampiran field
        const raw = t.lampiran;
        let list: any[] = [];
        if (Array.isArray(raw)) {
          list = raw;
        } else if (typeof raw === 'string') {
          const strVal: string = raw as string;
          const trimmed = strVal.trim();
          if (trimmed.startsWith('[')) {
            try {
              const parsed = JSON.parse(trimmed);
              if (Array.isArray(parsed)) list = parsed;
            } catch { /* ignore */ }
          } else if (trimmed) {
            list = [trimmed];
          }
        }

        list.forEach(item => {
          if (!item) return;
          if (typeof item === 'string') {
            const url = item.trim();
            if (!url) return;
            if (!result.some(r => r.dataUrl === url)) {
              const isPdf = url.toLowerCase().includes('.pdf') || url.startsWith('data:application/pdf');
              result.push({
                nama: isPdf ? 'Dokumen PDF' : 'Struk / Lampiran Foto',
                tipe: isPdf ? 'application/pdf' : 'image/jpeg',
                dataUrl: url,
              });
            }
          } else if (typeof item === 'object') {
            const url = item.dataUrl || item.url || item.fileUrl || item.link || '';
            if (typeof url === 'string' && url.trim() && !result.some(r => r.dataUrl === url.trim())) {
              const cleanUrl = url.trim();
              const isPdf = (item.tipe || item.type || '').includes('pdf') || (item.nama || item.name || '').toLowerCase().endsWith('.pdf') || cleanUrl.toLowerCase().includes('.pdf') || cleanUrl.startsWith('data:application/pdf');
              result.push({
                nama: item.nama || item.name || (isPdf ? 'Dokumen PDF' : 'Struk / Lampiran Foto'),
                tipe: item.tipe || item.type || (isPdf ? 'application/pdf' : 'image/jpeg'),
                dataUrl: cleanUrl,
              });
            }
          }
        });

        return result;
      };

      // Unfold & Flatten All Attachments per Transaction with Sequence Labeling
      for (const t of reportTxs) {
        const txAtts = extractAttachmentObjects(t);
        const totalAtts = txAtts.length;

        const isClientPayment = t.jenis === 'masuk' && isOmzetRil(t);
        const isDropDana = (t.jenis === 'masuk' && !isOmzetRil(t)) || isMutasiInternal(t) || (t.kategori || '').toLowerCase().includes('mutasi') || (t.deskripsi || '').toLowerCase().includes('mutasi') || (t.deskripsi || '').toLowerCase().includes('drop dana');
        const isFieldExpense = t.jenis === 'keluar' && !isDropDana;

        for (let i = 0; i < totalAtts; i++) {
          const att = txAtts[i];
          const isPdf =
            att.tipe?.includes('pdf') ||
            att.nama?.toLowerCase().endsWith('.pdf') ||
            att.dataUrl.toLowerCase().includes('.pdf') ||
            att.dataUrl.startsWith('data:application/pdf');

          const seqLabel = totalAtts > 1 ? ` (Lampiran ${i + 1} dari ${totalAtts})` : '';

          let qrDataUrl = '';
          const hasOnlineLink = att.dataUrl.startsWith('http://') || att.dataUrl.startsWith('https://');

          if (isPdf && hasOnlineLink) {
            try {
              qrDataUrl = await QRCode.toDataURL(att.dataUrl, {
                width: 300,
                margin: 1,
                color: { dark: '#0F172A', light: '#FFFFFF' },
              });
            } catch (qrErr) {
              console.warn('Gagal meng-generate QR code PDF:', qrErr);
            }
          }

          itemsToPrint.push({
            type: isPdf ? 'pdf' : 'image',
            url: isPdf ? att.dataUrl : resolveUrl(att.dataUrl),
            nama: att.nama || (isPdf ? 'Dokumen PDF' : 'Lampiran Foto'),
            seqLabel,
            tanggal: t.tanggal,
            deskripsi: t.deskripsi,
            nominal: t.nominal,
            jenis: t.jenis,
            kategori: t.kategori,
            isClientPayment,
            isDropDana,
            isFieldExpense,
            hasOnlineLink,
            qrDataUrl,
          });
        }
      }

      if (itemsToPrint.length > 0) {
        const clientPaymentItems = itemsToPrint.filter(i => i.isClientPayment);
        const dropDanaItems = itemsToPrint.filter(i => i.isDropDana);
        const fieldExpenseItems = itemsToPrint.filter(i => i.isFieldExpense);

        attachmentsHtml += `
          <div style="page-break-before: always; padding-top: 10px;">
            <div class="kop-container" style="text-align: center; padding-bottom: 8px; border-bottom: 2.5px solid #047857; margin-bottom: 2px;">
              <h1 class="company-title" style="font-family: 'Inter', sans-serif; font-size: 16px; font-weight: 900; color: #047857; letter-spacing: 0.5px; margin: 0; text-transform: uppercase;">LAMPIRAN DOKUMENTASI &amp; STRUK BUKTI AUDIT</h1>
              <p class="company-info" style="font-size: 9.5px; color: #334155; margin-top: 4px; line-height: 1.5;">
                ${displayTitle} &middot; Periode: ${periodText}
              </p>
            </div>
        `;

        const renderItemGrid = (items: typeof itemsToPrint, sectionTitle: string) => {
          if (items.length === 0) return '';
          let gridHtml = `
            <div style="margin-top: 16px; page-break-inside: avoid;">
              <div style="background: #F1F5F9; border-left: 4px solid #047857; padding: 6px 10px; margin-bottom: 12px;">
                <h3 style="margin: 0; font-size: 11px; font-weight: 800; color: #0F172A; text-transform: uppercase; letter-spacing: 0.3px;">${sectionTitle}</h3>
              </div>
              <div class="gallery-grid">
          `;

          items.forEach(item => {
            if (item.type === 'image') {
              const driveId = getDriveId(item.url);
              const fallbackSrc = driveId ? `https://drive.google.com/thumbnail?id=${driveId}&sz=w800` : item.url;
              gridHtml += `
                <div class="gallery-item">
                  <div class="img-wrapper">
                    <img src="${item.url}" alt="${item.nama}" onerror="this.onerror=null;this.src='${fallbackSrc}';" />
                  </div>
                  <div class="caption">
                    <div class="caption-date">[${formatDate(item.tanggal)}]</div>
                    <div class="caption-desc">${item.deskripsi}${item.seqLabel}</div>
                    <div class="caption-nom">${formatSaldoRupiah(item.nominal)}</div>
                  </div>
                </div>
              `;
            } else {
              gridHtml += `
                <div class="gallery-item" style="background: #F8FAFC; border: 1.5px solid #CBD5E1; border-radius: 8px; padding: 10px;">
                  <div class="img-wrapper" style="background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 6px; padding: 8px; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; height: auto; min-height: 180px;">
                    ${
                      item.qrDataUrl
                        ? `<img src="${item.qrDataUrl}" alt="Scan QR Code PDF" style="width: 100px; height: 100px; border: 1px solid #CBD5E1; padding: 4px; border-radius: 6px; background: #FFFFFF; margin-bottom: 6px;" />`
                        : `<div style="font-size: 36px; margin-bottom: 6px;">📄</div>`
                    }
                    <div style="font-size: 10px; font-weight: 800; color: #1E293B; word-break: break-all; max-width: 95%; margin-top: 2px;">
                      📄 ${item.nama}
                    </div>
                    <div style="font-size: 8.5px; font-weight: 700; color: #047857; margin-top: 2px;">
                      ${item.hasOnlineLink ? 'DOKUMEN PDF CLOUD ONLINE' : 'DOKUMEN PDF ARSIP SISTEM'}
                    </div>
                    <div style="font-size: 8px; font-weight: 600; color: #475569; margin-top: 4px; padding: 3px 6px; background: #F1F5F9; border-radius: 4px; border: 1px dashed #CBD5E1;">
                      ${item.hasOnlineLink ? '📱 Scan QR Code untuk membuka dokumen PDF di HP' : '💾 Dokumen tersimpan aman di database arsip internal'}
                    </div>
                  </div>
                  <div class="caption" style="margin-top: 6px;">
                    <div class="caption-date">[${formatDate(item.tanggal)}]</div>
                    <div class="caption-desc">${item.deskripsi}${item.seqLabel}</div>
                    <div class="caption-nom">${formatSaldoRupiah(item.nominal)}</div>
                  </div>
                </div>
              `;
            }
          });

          gridHtml += `
              </div>
            </div>
          `;
          return gridHtml;
        };

        if (clientPaymentItems.length > 0) {
          attachmentsHtml += renderItemGrid(
            clientPaymentItems,
            '📌 BAGIAN A: BUKTI PEMBAYARAN & INVOICE PELUNASAN KLIEN (Penerimaan Omzet Usaha)'
          );
        }
        if (dropDanaItems.length > 0) {
          attachmentsHtml += renderItemGrid(
            dropDanaItems,
            '📌 BAGIAN B: OTORISASI DROP DANA & PERPUTARAN KAS MODAL (Transfer Kas Internal & Panjar)'
          );
        }
        if (fieldExpenseItems.length > 0) {
          attachmentsHtml += renderItemGrid(
            fieldExpenseItems,
            '📌 BAGIAN C: STRUK, NOTA & BUKTI FISIK BELANJA LAPANGAN (Teknisi / Pelaksana / Operasional)'
          );
        }
        if (clientPaymentItems.length === 0 && dropDanaItems.length === 0 && fieldExpenseItems.length === 0) {
          attachmentsHtml += renderItemGrid(itemsToPrint, '📌 LAMPIRAN BUKTI TRANSAKSI & STRUK');
        }

        attachmentsHtml += `
          </div>
        `;
      }
    }

    const sanitizeName = (str: string) => str.replace(/[^a-zA-Z0-9_-]/g, '_');
    const dateFormatted = new Date().toISOString().split('T')[0];
    const dynamicDocTitle = project
      ? (selectedPengajuanTxId !== 'semua'
          ? `Laporan_Realisasi_${sanitizeName(project.nama)}_LPJ_${dateFormatted}`
          : `Laporan_Realisasi_${sanitizeName(project.nama)}_${dateFormatted}`)
      : `Laporan_Keuangan_${reportScope === 'konsolidasi' ? 'Konsolidasi' : 'Kas_Utama'}_${dateFormatted}`;

    const prevDocTitle = document.title;
    document.title = dynamicDocTitle;

    frameDoc.open();
    frameDoc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${dynamicDocTitle}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
            @page {
              size: ${paperSize === 'f4' ? '215mm 330mm' : 'A4 portrait'};
              margin: 8mm 10mm 8mm 10mm;
            }
            .page-break-divider {
              page-break-after: always !important;
              break-after: page !important;
              height: 0px !important;
              margin: 0 !important;
              padding: 0 !important;
              display: block !important;
            }
            .accounting-page-container {
              page-break-inside: avoid !important;
              break-inside: avoid !important;
            }
            /* Anti-Orphan Heading & Section Rules */
            h1, h2, h3, h4, h5, h6, .doc-header, .section-title, .table-title {
              page-break-after: avoid !important;
              break-after: avoid !important;
              page-break-inside: avoid !important;
              break-inside: avoid !important;
            }
            .page-break-inside-avoid, .summary-box, .signature-container, .kop-container {
              page-break-inside: avoid !important;
              break-inside: avoid !important;
            }
            * {
              box-sizing: border-box;
            }
            body {
              font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif !important;
              color: #0F172A;
              font-size: 10px;
              line-height: 1.4;
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
              padding-bottom: 6px;
              border-bottom: 2px solid #047857;
              margin-bottom: 2px;
            }
            .kop-line-secondary {
              border-bottom: 1px solid #A7F3D0;
              margin-bottom: 10px;
            }
            .company-title {
              font-family: 'Inter', sans-serif;
              font-size: 17px;
              font-weight: 900;
              color: #047857;
              letter-spacing: 0.5px;
              margin: 0;
              text-transform: uppercase;
            }
            .company-info {
              font-size: 9px;
              color: #334155;
              margin-top: 3px;
              line-height: 1.4;
            }
            .doc-header {
              text-align: center;
              margin: 8px 0 10px 0;
            }
            .doc-title {
              font-size: 12.5px;
              font-weight: 800;
              color: #047857;
              text-transform: uppercase;
              letter-spacing: 0.4px;
              margin: 0;
            }
            .doc-subtitle {
              font-size: 9.5px;
              color: #475569;
              margin-top: 3px;
            }
            .summary-box {
              display: flex !important;
              flex-direction: row !important;
              justify-content: space-between !important;
              align-items: stretch !important;
              gap: 8px;
              width: 100%;
              border: 1px solid #CBD5E1;
              border-radius: 10px;
              background-color: #F8FAFC;
              margin-bottom: 12px;
              padding: 8px 10px;
              page-break-inside: avoid !important;
              break-inside: avoid !important;
            }
            .summary-card {
              flex: 1;
              display: flex;
              flex-direction: column;
              justify-content: center;
              border-radius: 8px;
              padding: 6px 6px;
              text-align: center;
              border: 1px solid #E2E8F0;
              background-color: #FFFFFF;
            }
            .card-green {
              background-color: #ECFDF5 !important;
              border-color: #D1FAE5 !important;
            }
            .card-green .summary-val {
              color: #059669 !important;
            }
            .card-red {
              background-color: #FEF2F2 !important;
              border-color: #FEE2E2 !important;
            }
            .card-red .summary-val {
              color: #DC2626 !important;
            }
            .card-navy {
              background-color: #F8FAFC !important;
              border-color: #E2E8F0 !important;
            }
            .card-navy .summary-val {
              color: #1E3A8A !important;
            }
            .summary-label {
              font-size: 8px;
              color: #475569;
              text-transform: uppercase;
              font-weight: 700;
              letter-spacing: 0.2px;
              margin-bottom: 2px;
            }
            .summary-val {
              font-size: 12.5px;
              font-weight: 800;
              margin: 0;
            }

            table.journal-table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 8px;
              page-break-inside: avoid !important;
              break-inside: avoid !important;
            }
            table.journal-table thead {
              display: table-header-group !important;
            }
            table.journal-table tfoot {
              display: table-row-group !important;
            }
            table.journal-table tbody {
              display: table-row-group !important;
            }
            table.journal-table tr {
              page-break-inside: avoid !important;
              break-inside: avoid !important;
            }
            table.journal-table th {
              background-color: #047857 !important;
              color: #FFFFFF !important;
              font-size: 8.5px;
              font-weight: 700;
              text-transform: uppercase;
              letter-spacing: 0.3px;
              padding: 5.5px 5px;
              border: 1px solid #047857;
              line-height: 1.2;
              vertical-align: middle;
            }
            table.journal-table td {
              padding: 5px 5px;
              border: 1px solid #E2E8F0;
              font-size: 9px;
              line-height: 1.3;
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
              display: flex;
              width: 100%;
              margin-top: 20px;
              page-break-inside: avoid !important;
              break-inside: avoid !important;
            }
            .signature-box {
              text-align: center;
              vertical-align: top;
            }
            .signature-space {
              height: 50px;
            }
            .signature-line {
              border-top: 1.5px solid #047857;
              width: 170px;
              margin: 0 auto;
              padding-top: 4px;
              font-weight: 700;
              color: #047857;
            }
            .gallery-grid {
              display: flex;
              flex-wrap: wrap;
              gap: 15px;
              margin-top: 20px;
            }
            .gallery-item {
              width: calc(50% - 7.5px);
              border: 1px solid #CBD5E1;
              border-radius: 8px;
              padding: 10px;
              background: #F8FAFC;
              page-break-inside: avoid !important;
              break-inside: avoid !important;
              box-sizing: border-box;
              margin-bottom: 10px;
            }
            .img-wrapper {
              width: 100%;
              height: 200px;
              display: flex;
              align-items: center;
              justify-content: center;
              background: #F1F5F9;
              border-radius: 4px;
              overflow: hidden;
              margin-bottom: 10px;
            }
            .img-wrapper img {
              max-width: 100%;
              max-height: 100%;
              object-fit: contain;
            }
            .caption {
              text-align: left;
            }
            .caption-date {
              font-size: 8.5px;
              color: #64748B;
              font-weight: 600;
              margin-bottom: 2px;
            }
            .caption-desc {
              font-size: 10px;
              color: #0F172A;
              font-weight: 700;
              line-height: 1.3;
              margin-bottom: 4px;
            }
            .caption-nom {
              font-size: 11px;
              color: #DC2626;
              font-weight: 800;
            }
          </style>
        </head>
        <body>
          ${content.innerHTML}
          ${attachmentsHtml}
        </body>
      </html>
    `);

    frameDoc.close();

    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();

      const restoreDocTitle = () => {
        document.title = prevDocTitle;
      };
      window.addEventListener('afterprint', restoreDocTitle, { once: true });
      setTimeout(restoreDocTitle, 4000);
    }, 350);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Cetak Laporan PDF Resmi" size="xl">
      <div className="space-y-4">
        {/* Controls */}
        <div className="flex flex-col gap-3 p-3.5 bg-slate-100 rounded-2xl border border-slate-200">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
              <FileText size={16} className="text-emerald-600 flex-shrink-0" />
              <span>Format PDF KOP Resmi (Siap Cetak / Save PDF di HP &amp; PC)</span>
            </div>
            <div className="flex w-full sm:w-auto gap-2 flex-wrap items-center">
              {!project ? (
                <select
                  value={reportScope}
                  onChange={e => setReportScope(e.target.value as 'konsolidasi' | 'kas_utama')}
                  className="px-3 py-2 bg-white border border-slate-300 text-slate-900 rounded-xl text-xs font-bold shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="konsolidasi">🌐 Laporan Konsolidasi (Lengkap 100% Transaksi)</option>
                  <option value="kas_utama">🏢 Laporan Kas Utama (Induk / Non-Proyek)</option>
                </select>
              ) : (
                (() => {
                  const ptx = approvedTx.filter(t => t.proyekId === project.id);
                  const injections = ptx
                    .filter(t => isCapitalInjectionTx(t) || (t.jenis === 'masuk' && (t.kategori || '').toLowerCase().includes('mutasi')))
                    .sort((a, b) => new Date(a.tanggal).getTime() - new Date(b.tanggal).getTime());
                  if (injections.length > 1) {
                    return (
                      <select
                        value={selectedPengajuanTxId}
                        onChange={e => setSelectedPengajuanTxId(e.target.value)}
                        className="px-3 py-2 bg-white border border-slate-300 text-slate-900 rounded-xl text-xs font-bold shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      >
                        <option value="semua">🌐 Akumulasi Total Proyek (Semua Pengajuan)</option>
                        {injections.map((inj, idx) => (
                          <option key={inj.id} value={inj.id}>
                            📄 LPJ Pengajuan #{idx + 1}: {inj.deskripsi.slice(0, 30)} ({formatDate(inj.tanggal)})
                          </option>
                        ))}
                      </select>
                    );
                  }
                  return null;
                })()
              )}
              <select
                value={paperSize}
                onChange={e => setPaperSize(e.target.value as 'f4' | 'a4')}
                className="px-3 py-2 bg-white border border-slate-300 text-slate-900 rounded-xl text-xs font-bold shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                title="Pilih Ukuran Kertas"
              >
                <option value="f4">📄 Ukuran F4 / Folio (215 × 330 mm)</option>
                <option value="a4">📄 Ukuran A4 (210 × 297 mm)</option>
              </select>
              <button
                onClick={() => handlePrint(false)}
                className="flex-1 sm:flex-none px-4 py-2.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-all active:scale-95"
              >
                <FileText size={16} /> Cetak Standar
              </button>
              <button
                onClick={() => handlePrint(true)}
                className="flex-1 sm:flex-none px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 shadow-md transition-all active:scale-95"
              >
                <Printer size={16} /> Cetak + Lampiran
              </button>
            </div>
          </div>

          {/* Quick Document Metadata Customizer for Project / Pos Kantor */}
          {project && (
            <div className="p-3 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  📝 Sesuaikan Keterangan Kop &amp; Pengajuan Sebelum Cetak
                </span>
                <span className="text-[10px] text-slate-400 font-medium">Bisa diedit manual langsung di sini</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 mb-0.5">
                    {isInternal ? 'Perihal / Judul Pengajuan' : 'Nama Pekerjaan / Proyek'}
                  </label>
                  <input
                    type="text"
                    value={docPerihal}
                    onChange={e => setDocPerihal(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    placeholder="Contoh: Permohonan Budget Operasional..."
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 mb-0.5">No. Surat Pengajuan</label>
                  <input
                    type="text"
                    value={docNomorSurat}
                    onChange={e => setDocNomorSurat(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs font-mono text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    placeholder="Contoh: 050/ARP/VII/OP/2026"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 mb-0.5">
                    {isInternal ? 'Peruntukan / Instansi' : 'Instansi / Klien Tujuan'}
                  </label>
                  <input
                    type="text"
                    value={docKlien}
                    onChange={e => setDocKlien(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    placeholder="Contoh: DJKA Area Bogor-Sukabumi / Internal"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 mb-0.5">
                    {isInternal ? 'Pemohon / Pengaju' : 'Pemohon / Leader Teknik'}
                  </label>
                  <input
                    type="text"
                    value={docPemohon}
                    onChange={e => setDocPemohon(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    placeholder="Nama Pemohon..."
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 mb-0.5">
                    {isInternal ? 'PIC / Penanggung Jawab' : 'PIC Lapangan / Teknisi'}
                  </label>
                  <input
                    type="text"
                    value={docPic}
                    onChange={e => setDocPic(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    placeholder="Nama PIC..."
                  />
                </div>
              </div>
            </div>
          )}

          {/* Digital Signatures Upload & Otorisasi Control Bar */}
          <div className="p-3.5 bg-slate-900 text-white rounded-2xl space-y-3 border border-slate-800 shadow-md">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-slate-800 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-emerald-400">
                      ✍️ Pengaturan Otorisasi &amp; Drop Tanda Tangan Digital (Fleksibel)
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-1 bg-slate-800 p-1 rounded-xl text-[10.5px] font-bold">
                    <button
                      type="button"
                      onClick={() => updateSigCount(0)}
                      className={`px-2.5 py-1 rounded-lg transition-all ${sigCount === 0 ? 'bg-rose-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                    >
                      🚫 Tanpa TTD
                    </button>
                    <button
                      type="button"
                      onClick={() => updateSigCount(1)}
                      className={`px-2.5 py-1 rounded-lg transition-all ${sigCount === 1 ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                    >
                      👤 1 Kolom (Dibuat Oleh: Finance Saja)
                    </button>
                    <button
                      type="button"
                      onClick={() => updateSigCount(2)}
                      className={`px-2.5 py-1 rounded-lg transition-all ${sigCount === 2 ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                    >
                      2 Kolom (Finance + Direktur)
                    </button>
                    <button
                      type="button"
                      onClick={() => updateSigCount(3)}
                      className={`px-2.5 py-1 rounded-lg transition-all ${sigCount === 3 ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                    >
                      3 Kolom (Standar)
                    </button>
                    <button
                      type="button"
                      onClick={() => updateSigCount(4)}
                      className={`px-2.5 py-1 rounded-lg transition-all ${sigCount === 4 ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                    >
                      4 Kolom (Lengkap)
                    </button>
                  </div>
                </div>

                {sigCount === 0 ? (
                  <div className="p-3 bg-slate-800/60 rounded-xl border border-slate-700/70 text-center text-slate-300 text-xs">
                    💡 <strong>Mode Tanpa Tanda Tangan:</strong> Dokumen PDF akan dicetak bersih tanpa area tanda tangan atau persetujuan pihak mana pun. Cocok untuk rekapitulasi data cepat &amp; arsip pribadi.
                  </div>
                ) : (
                  <div className={`grid grid-cols-1 ${sigCount === 4 ? 'sm:grid-cols-4' : sigCount === 3 ? 'sm:grid-cols-3' : sigCount === 2 ? 'sm:grid-cols-2' : 'sm:grid-cols-1'} gap-2`}>
                    {/* Slot 1: Teknisi (If 4 columns) */}
                    {sigCount === 4 && (
                      <div className="p-2 bg-slate-800/80 rounded-xl border border-slate-700/70 flex flex-col justify-between space-y-1.5">
                        <div className="flex items-center justify-between">
                          <input
                            type="text"
                            value={sig1Header}
                            onChange={e => { setSig1Header(e.target.value); localStorage.setItem('sig1_header', e.target.value); }}
                            className="bg-transparent text-[10px] font-bold text-emerald-400 w-full focus:outline-none focus:border-b border-emerald-500"
                          />
                          {sig1Img && (
                            <button onClick={() => handleSignatureClear(1)} className="text-[10px] text-rose-400 hover:underline flex-shrink-0 ml-1">Hapus</button>
                          )}
                        </div>
                        {sig1Img ? (
                          <div className="h-9 bg-white rounded-lg border border-slate-300 p-1 flex items-center justify-center">
                            <img src={sig1Img} alt="TTD Teknisi" className="max-h-full max-w-full object-contain" />
                          </div>
                        ) : (
                          <label className="h-9 bg-slate-700/60 hover:bg-slate-700 rounded-lg border border-dashed border-slate-500 flex items-center justify-center text-[9.5px] text-slate-300 cursor-pointer transition-colors">
                            + Drop TTD Teknisi
                            <input type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && handleSignatureUpload(1, e.target.files[0])} />
                          </label>
                        )}
                        <input
                          type="text"
                          value={sig1Nama}
                          placeholder="Nama Teknisi/PIC"
                          onChange={e => { setSig1Nama(e.target.value); localStorage.setItem('sig1_nama', e.target.value); }}
                          className="bg-slate-900/90 text-slate-100 text-[10px] font-bold px-2 py-1 rounded border border-slate-700 w-full focus:outline-none"
                        />
                      </div>
                    )}

                    {/* Slot 2: Leader Teknik */}
                    {sigCount >= 3 && (
                      <div className="p-2 bg-slate-800/80 rounded-xl border border-slate-700/70 flex flex-col justify-between space-y-1.5">
                        <div className="flex items-center justify-between">
                          <input
                            type="text"
                            value={sig2Header}
                            onChange={e => { setSig2Header(e.target.value); localStorage.setItem('sig2_header', e.target.value); }}
                            className="bg-transparent text-[10px] font-bold text-emerald-400 w-full focus:outline-none focus:border-b border-emerald-500"
                          />
                          {sig2Img && (
                            <button onClick={() => handleSignatureClear(2)} className="text-[10px] text-rose-400 hover:underline flex-shrink-0 ml-1">Hapus</button>
                          )}
                        </div>
                        {sig2Img ? (
                          <div className="h-9 bg-white rounded-lg border border-slate-300 p-1 flex items-center justify-center">
                            <img src={sig2Img} alt="TTD Leader" className="max-h-full max-w-full object-contain" />
                          </div>
                        ) : (
                          <label className="h-9 bg-slate-700/60 hover:bg-slate-700 rounded-lg border border-dashed border-slate-500 flex items-center justify-center text-[9.5px] text-slate-300 cursor-pointer transition-colors">
                            + Drop TTD Leader
                            <input type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && handleSignatureUpload(2, e.target.files[0])} />
                          </label>
                        )}
                        <input
                          type="text"
                          value={sig2Nama}
                          placeholder="Nama Leader Teknik"
                          onChange={e => { setSig2Nama(e.target.value); localStorage.setItem('sig2_nama', e.target.value); }}
                          className="bg-slate-900/90 text-slate-100 text-[10px] font-bold px-2 py-1 rounded border border-slate-700 w-full focus:outline-none"
                        />
                      </div>
                    )}

                    {/* Slot 3: Admin Keuangan / Dibuat Oleh (Finance) */}
                    <div className="p-2 bg-slate-800/80 rounded-xl border border-slate-700/70 flex flex-col justify-between space-y-1.5">
                      <div className="flex items-center justify-between">
                        <input
                          type="text"
                          value={sig3Header}
                          onChange={e => { setSig3Header(e.target.value); localStorage.setItem('sig3_header', e.target.value); }}
                          className="bg-transparent text-[10px] font-bold text-emerald-400 w-full focus:outline-none focus:border-b border-emerald-500"
                        />
                        {sig3Img && (
                          <button onClick={() => handleSignatureClear(3)} className="text-[10px] text-rose-400 hover:underline flex-shrink-0 ml-1">Hapus</button>
                        )}
                      </div>
                      {sig3Img ? (
                        <div className="h-9 bg-white rounded-lg border border-slate-300 p-1 flex items-center justify-center">
                          <img src={sig3Img} alt="TTD Finance" className="max-h-full max-w-full object-contain" />
                        </div>
                      ) : (
                        <label className="h-9 bg-slate-700/60 hover:bg-slate-700 rounded-lg border border-dashed border-slate-500 flex items-center justify-center text-[9.5px] text-slate-300 cursor-pointer transition-colors">
                          + Drop TTD Finance
                          <input type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && handleSignatureUpload(3, e.target.files[0])} />
                        </label>
                      )}
                      <input
                        type="text"
                        value={sig3Nama}
                        placeholder="Nama Finance"
                        onChange={e => { setSig3Nama(e.target.value); localStorage.setItem('sig3_nama', e.target.value); }}
                        className="bg-slate-900/90 text-slate-100 text-[10px] font-bold px-2 py-1 rounded border border-slate-700 w-full focus:outline-none"
                      />
                    </div>

                    {/* Slot 4: Direktur Utama */}
                    {sigCount >= 2 && (
                      <div className="p-2 bg-slate-800/80 rounded-xl border border-slate-700/70 flex flex-col justify-between space-y-1.5">
                        <div className="flex items-center justify-between">
                          <input
                            type="text"
                            value={sig4Header}
                            onChange={e => { setSig4Header(e.target.value); localStorage.setItem('sig4_header', e.target.value); }}
                            className="bg-transparent text-[10px] font-bold text-emerald-400 w-full focus:outline-none focus:border-b border-emerald-500"
                          />
                          {sig4Img && (
                            <button onClick={() => handleSignatureClear(4)} className="text-[10px] text-rose-400 hover:underline flex-shrink-0 ml-1">Hapus</button>
                          )}
                        </div>
                        {sig4Img ? (
                          <div className="h-9 bg-white rounded-lg border border-slate-300 p-1 flex items-center justify-center">
                            <img src={sig4Img} alt="TTD Direktur" className="max-h-full max-w-full object-contain" />
                          </div>
                        ) : (
                          <label className="h-9 bg-slate-700/60 hover:bg-slate-700 rounded-lg border border-dashed border-slate-500 flex items-center justify-center text-[9.5px] text-slate-300 cursor-pointer transition-colors">
                            + Drop TTD Direktur
                            <input type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && handleSignatureUpload(4, e.target.files[0])} />
                          </label>
                        )}
                        <input
                          type="text"
                          value={sig4Nama}
                          placeholder="Nama Direktur"
                          onChange={e => { setSig4Nama(e.target.value); localStorage.setItem('sig4_nama', e.target.value); }}
                          className="bg-slate-900/90 text-slate-100 text-[10px] font-bold px-2 py-1 rounded border border-slate-700 w-full focus:outline-none"
                        />
                      </div>
                    )}
                  </div>
                )}

                  {/* Opsi Tambahan: Paraf Pembuat Draft (Dekat TTD Leader) */}
                  <div className="p-2 bg-slate-800/80 rounded-xl border border-amber-500/40 flex flex-col justify-between space-y-1.5 col-span-2 sm:col-span-1">
                    <div className="flex items-center justify-between">
                      <label className="flex items-center space-x-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={parafEnabled}
                          onChange={e => {
                            setParafEnabled(e.target.checked);
                            localStorage.setItem('paraf_enabled', String(e.target.checked));
                          }}
                          className="rounded text-amber-500 focus:ring-amber-400 w-3 h-3"
                        />
                        <span className="text-[10px] font-bold text-amber-400">✍️ Paraf Draft</span>
                      </label>
                      {parafImg && (
                        <button onClick={handleParafClear} className="text-[10px] text-rose-400 hover:underline flex-shrink-0 ml-1">Hapus</button>
                      )}
                    </div>
                    {parafEnabled && (
                      <>
                        {parafImg ? (
                          <div className="h-9 bg-white rounded-lg border border-amber-300 p-1 flex items-center justify-center">
                            <img src={parafImg} alt="Paraf Draft" className="max-h-full max-w-full object-contain" />
                          </div>
                        ) : (
                          <label className="h-9 bg-amber-950/30 hover:bg-amber-900/40 rounded-lg border border-dashed border-amber-500/60 flex items-center justify-center text-[9.5px] text-amber-200 cursor-pointer transition-colors">
                            + Drop Paraf
                            <input type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && handleParafUpload(e.target.files[0])} />
                          </label>
                        )}
                        <input
                          type="text"
                          value={parafNama}
                          placeholder="Nama Pembuat Draft (Paraf)"
                          onChange={e => { setParafNama(e.target.value); localStorage.setItem('paraf_nama', e.target.value); }}
                          className="bg-slate-900/90 text-amber-200 text-[10px] font-bold px-2 py-1 rounded border border-amber-500/50 w-full focus:outline-none"
                        />
                      </>
                    )}
                  </div>
                </div>
              </div>

        {/* Printable Document Preview Area */}
        <div className="max-h-[70vh] overflow-y-auto p-4 sm:p-6 bg-white border border-gray-200 rounded-2xl shadow-inner scrollbar-thin font-sans">
          <div ref={printRef} className="space-y-4 text-slate-900 font-sans">
            {(() => {
              const allProcItems = project?.procurementItems || [];
              const hasItemsExplicitlyForSelectedSurat = allProcItems.some(i => i.suratPengajuanId === selectedPengajuanTxId);
              const displayProcurementItems = allProcItems.filter(item => {
                if (selectedPengajuanTxId === 'semua') return true;
                if (hasItemsExplicitlyForSelectedSurat) {
                  return item.suratPengajuanId === selectedPengajuanTxId;
                }
                return true;
              });
              const hasProcurementSection = displayProcurementItems.length > 0;

              const accountingChunks = splitTransactionsIntoAccountingPages(
                tableRows,
                paperSize === 'f4',
                hasProcurementSection,
                Boolean(project)
              );

              return accountingChunks.map((chunk, chunkIdx) => (
                <div key={chunkIdx} className="accounting-page-container">
                  {/* HEADER & SUMMARY ONLY ON PAGE 1 */}
                  {chunk.isFirstPage && (
                    <>
                      {/* EXACT OFFICIAL KOP HEADER */}
                      <div>
                        <div className="kop-container text-center pb-2 border-b-[2.5px] border-[#047857]">
                          <h1 className="company-title text-xl font-black text-[#047857] tracking-tight uppercase">
                            {companyName}
                          </h1>
                          <p className="company-info text-[10.5px] font-medium text-slate-700 mt-1 leading-relaxed">
                            {companyAddress}<br />
                            📞 {companyPhone} &nbsp;·&nbsp; ✉️ {companyEmail} &nbsp;·&nbsp; 🌐 {companyWebsite}
                          </p>
                        </div>
                        <div className="kop-line-secondary border-b border-emerald-200 mt-0.5 mb-4" />
                      </div>

                      {/* DOCUMENT TITLE & METADATA */}
                      <div className="doc-header text-center my-3">
                        <h2 className="doc-title text-base font-extrabold text-[#047857] uppercase tracking-wide">{displayTitle}</h2>
                        <p className="doc-subtitle text-xs text-slate-600 mt-1">
                          {displaySubtitle} · Periode: <strong className="text-slate-800">{periodText}</strong>
                        </p>
                        
                        {project && (
                          <div className="my-3 rounded-xl overflow-hidden bg-slate-50/70 p-3 text-left font-sans text-xs border border-slate-300">
                            <table className="w-full border-collapse">
                              <tbody>
                                <tr>
                                  <td className="py-1.5 pr-2 font-bold text-slate-600 text-[10.5px] uppercase tracking-wider w-44">
                                    {isInternal ? 'Perihal / Judul Pengajuan' : 'Nama Pekerjaan / Proyek'}
                                  </td>
                                  <td className="py-1.5 px-1 font-bold text-slate-800 w-3">:</td>
                                  <td className="py-1.5 font-extrabold text-slate-900 text-xs">{docPerihal || project.nama}</td>
                                </tr>
                                <tr>
                                  <td className="py-1.5 pr-2 font-bold text-slate-600 text-[10.5px] uppercase tracking-wider">No. Surat Pengajuan</td>
                                  <td className="py-1.5 px-1 font-bold text-slate-800">:</td>
                                  <td className="py-1.5 font-extrabold text-blue-900 font-mono text-xs">{docNomorSurat || project.nomorSurat || '050/ARP/VII/OP/2026'}</td>
                                </tr>
                                {((docKlien || project.klien) && (docKlien || project.klien) !== '-') && (
                                  <tr>
                                    <td className="py-1.5 pr-2 font-bold text-slate-600 text-[10.5px] uppercase tracking-wider">
                                      {isInternal ? 'Peruntukan / Instansi' : 'Instansi / Klien Tujuan'}
                                    </td>
                                    <td className="py-1.5 px-1 font-bold text-slate-800">:</td>
                                    <td className="py-1.5 font-extrabold text-slate-900">{docKlien || project.klien}</td>
                                  </tr>
                                )}
                                <tr>
                                  <td className="py-1.5 pr-2 font-bold text-slate-600 text-[10.5px] uppercase tracking-wider">
                                    {isInternal ? 'Pemohon / Pengaju' : 'Pemohon / Leader Teknik'}
                                  </td>
                                  <td className="py-1.5 px-1 font-bold text-slate-800">:</td>
                                  <td className="py-1.5 font-extrabold text-slate-900">{docPemohon || project.pemohonNama || 'Rama Regawa Sri Anggayana'}</td>
                                </tr>
                                <tr>
                                  <td className="py-1.5 pr-2 font-bold text-slate-600 text-[10.5px] uppercase tracking-wider">
                                    {isInternal ? 'PIC / Penanggung Jawab' : 'PIC Lapangan / Teknisi'}
                                  </td>
                                  <td className="py-1.5 px-1 font-bold text-slate-800">:</td>
                                  <td className="py-1.5 font-extrabold text-slate-900">{docPic || project.teknisiPic || 'Fauzan'}</td>
                                </tr>
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>

                      {/* EXECUTIVE FINANCIAL SUMMARY */}
                      {project ? (
                        isInternal ? (
                          (() => {
                            const hasPurchasedItems = displayProcurementItems.some(i => i.isPurchased && (i.hargaAktual || 0) > 0);
                            const totalAktualItem = displayProcurementItems.reduce((acc, item) => acc + (item.hargaAktual || 0), 0);
                            const totalBelanjaRiil = hasPurchasedItems ? totalAktualItem : (totalPengeluaranRiil - totalRefundMasuk);
                            const dropDana = modalDisuntikkan > 0 ? modalDisuntikkan : displayProcurementItems.reduce((acc, item) => acc + (item.hargaRencana || 0), 0);
                            const sisaDanaRiil = dropDana - totalBelanjaRiil;

                            return (
                              <div className="summary-box flex flex-row justify-between items-stretch gap-3 bg-[#F8FAFC] border border-slate-300 rounded-2xl p-3 my-4 shadow-sm w-full page-break-inside-avoid">
                                <div className="summary-card card-green flex-1 flex flex-col justify-center p-3 rounded-xl border text-center">
                                  <span className="summary-label text-[9px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Alokasi / Drop Dana Kas</span>
                                  <p className="summary-val text-sm font-black tabular-nums">{formatRupiah(dropDana)}</p>
                                </div>
                                <div className="summary-card card-red flex-1 flex flex-col justify-center p-3 rounded-xl border text-center">
                                  <span className="summary-label text-[9px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Total Belanja Riil Item</span>
                                  <p className="summary-val text-sm font-black tabular-nums">{formatRupiah(totalBelanjaRiil)}</p>
                                </div>
                                <div className={`summary-card flex-1 flex flex-col justify-center p-3 rounded-xl border text-center ${sisaDanaRiil >= 0 ? 'card-green' : 'card-red'}`}>
                                  <span className="summary-label text-[9px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                                    {sisaDanaRiil > 0 ? 'Sisa Saldo Kas (Refund)' : sisaDanaRiil < 0 ? 'Kekurangan Dana (Reimburse)' : 'Saldo Kas Akhir (Nihil)'}
                                  </span>
                                  <p className="summary-val text-sm font-black tabular-nums">
                                    {formatSaldoRupiah(sisaDanaRiil)}
                                  </p>
                                  <span className="text-[8px] font-semibold text-slate-500 mt-0.5 block">
                                    {sisaDanaRiil > 0 ? '(Sisa Dana Refund ke Perusahaan)' : sisaDanaRiil < 0 ? '(Reimbursement Penggantian Kas)' : '(Pas Sesuai Anggaran)'}
                                  </span>
                                </div>
                              </div>
                            );
                          })()
                        ) : (
                          <div className="summary-box flex flex-row justify-between items-stretch gap-3 bg-[#F8FAFC] border border-slate-300 rounded-2xl p-3 my-4 shadow-sm w-full page-break-inside-avoid">
                            <div className="summary-card card-green flex-1 flex flex-col justify-center p-3 rounded-xl border text-center">
                              <span className="summary-label text-[9px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Alokasi Modal Operasional</span>
                              <p className="summary-val text-sm font-black tabular-nums">{formatRupiah(modalDisuntikkan)}</p>
                            </div>
                            <div className="summary-card card-navy flex-1 flex flex-col justify-center p-3 rounded-xl border text-center">
                              <span className="summary-label text-[9px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Invoice Klien</span>
                              <p className="summary-val text-sm font-black tabular-nums">{formatRupiah(pemasukanKlien)}</p>
                            </div>
                            <div className="summary-card card-red flex-1 flex flex-col justify-center p-3 rounded-xl border text-center">
                              <span className="summary-label text-[9px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Pengeluaran Riil</span>
                              <p className="summary-val text-sm font-black tabular-nums">{formatRupiah(totalPengeluaranRiil - totalRefundMasuk)}</p>
                            </div>
                            <div className={`summary-card flex-1 flex flex-col justify-center p-3 rounded-xl border text-center ${pemasukanKlien - (totalPengeluaranRiil - totalRefundMasuk) >= 0 ? 'card-green' : 'card-red'}`}>
                              <span className="summary-label text-[9px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Laba - Rugi (P&L)</span>
                              <p className="summary-val text-sm font-black tabular-nums">
                                {formatSaldoRupiah(pemasukanKlien - (totalPengeluaranRiil - totalRefundMasuk))}
                              </p>
                            </div>
                            <div className={`summary-card flex-1 flex flex-col justify-center p-3 rounded-xl border text-center ${sisaDana >= 0 ? 'card-green' : 'card-red'}`}>
                              <span className="summary-label text-[9px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Saldo Kas Proyek</span>
                              <p className="summary-val text-sm font-black tabular-nums">
                                {formatSaldoRupiah(sisaDana)}
                              </p>
                            </div>
                          </div>
                        )
                      ) : (
                        <div className="summary-box flex flex-row justify-between items-stretch gap-2.5 bg-[#F8FAFC] border border-slate-300 rounded-2xl p-3 my-4 shadow-sm w-full page-break-inside-avoid">
                          <div className="summary-card card-green flex-1 flex flex-col justify-center p-2.5 rounded-xl border text-center">
                            <span className="summary-label text-[8.5px] font-bold text-slate-500 uppercase tracking-wider block mb-1">💰 Pendapatan Klien (P&L)</span>
                            <p className="summary-val text-xs sm:text-sm font-black tabular-nums">{formatRupiah(totalOmzetRil)}</p>
                          </div>
                          <div className="summary-card card-navy flex-1 flex flex-col justify-center p-2.5 rounded-xl border text-center">
                            <span className="summary-label text-[8.5px] font-bold text-slate-500 uppercase tracking-wider block mb-1">📥 Drop Dana &amp; Modal</span>
                            <p className="summary-val text-xs sm:text-sm font-black tabular-nums">{formatRupiah(totalOmzetSemu)}</p>
                          </div>
                          <div className="summary-card card-red flex-1 flex flex-col justify-center p-2.5 rounded-xl border text-center">
                            <span className="summary-label text-[8.5px] font-bold text-slate-500 uppercase tracking-wider block mb-1">📉 Total Beban Pengeluaran</span>
                            <p className="summary-val text-xs sm:text-sm font-black tabular-nums">{formatRupiah(totalKredit)}</p>
                          </div>
                          <div className={`summary-card flex-1 flex flex-col justify-center p-2.5 rounded-xl border text-center ${sisaDana >= 0 ? 'card-green' : 'card-red'}`}>
                            <span className="summary-label text-[8.5px] font-bold text-slate-500 uppercase tracking-wider block mb-1">🏦 Saldo Kas Akhir (Aset)</span>
                            <p className="summary-val text-xs sm:text-sm font-black tabular-nums">
                              {formatSaldoRupiah(sisaDana)}
                            </p>
                          </div>
                        </div>
                      )}

                      {/* SECTION 1: MATRIKS REALISASI ITEM PENGADAAN & VARIANS RAB */}
                      {hasProcurementSection && (
                        <div className="my-5 page-break-inside-avoid">
                          <div className="border-b border-[#047857] pb-1 mb-2 flex items-center justify-between">
                            <h3 className="text-xs font-bold text-[#047857] uppercase tracking-wider m-0">
                              📋 Matriks Realisasi Item Pengadaan &amp; Varians RAB (Estimasi Rencana vs Realisasi Riil)
                            </h3>
                            <span className="text-[10px] text-slate-500 font-semibold">Checklist Cross-Check Item Belanja</span>
                          </div>
                          <table className="journal-table w-full border-collapse text-xs mb-4 font-sans">
                            <thead>
                              <tr className="bg-slate-800 text-white text-[9px] uppercase tracking-wider font-bold">
                                <th className="p-2 border border-slate-800 text-center w-8">No</th>
                                <th className="p-2 border border-slate-800 text-left">Nama Item / Kebutuhan Pengadaan</th>
                                <th className="p-2 border border-slate-800 text-center w-20">Volume / Satuan</th>
                                <th className="p-2 border border-slate-800 text-right w-28">Harga Rencana (RAB)</th>
                                <th className="p-2 border border-slate-800 text-right w-28">Harga Realisasi (Riil)</th>
                                <th className="p-2 border border-slate-800 text-right w-32">Varians (Selisih)</th>
                                <th className="p-2 border border-slate-800 text-center w-20">Status Belanja</th>
                              </tr>
                            </thead>
                            <tbody>
                              {displayProcurementItems.map((item, idx) => {
                                const budget = item.hargaRencana || 0;
                                const actual = item.hargaAktual || 0;
                                const selisih = budget > 0 && actual > 0 ? budget - actual : 0;
                                return (
                                  <tr key={item.id || idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                                    <td className="p-2 border border-slate-200 text-center text-slate-500 font-medium tabular-nums">{idx + 1}</td>
                                    <td className="p-2 border border-slate-200 text-left font-bold text-slate-900">
                                      <div>{item.nama}</div>
                                      {item.kategori && <div className="text-[9px] text-slate-400 font-normal mt-0.5">{item.kategori}</div>}
                                    </td>
                                    <td className="p-2 border border-slate-200 text-center text-slate-700 font-medium">
                                      {item.kuantitas} {item.satuan || ' unit'}
                                    </td>
                                    <td className="p-2 border border-slate-200 text-right font-semibold text-slate-700 tabular-nums">
                                      {budget > 0 ? formatRupiah(budget) : '-'}
                                    </td>
                                    <td className="p-2 border border-slate-200 text-right font-bold text-slate-900 tabular-nums">
                                      {item.isCancelled ? '🚫 Dibatalkan' : actual > 0 ? formatRupiah(actual) : item.isPurchased ? 'Terbeli (Nota Ada)' : 'Belum Belanja'}
                                    </td>
                                    <td className={`p-2 border border-slate-200 text-right font-extrabold tabular-nums ${!item.isCancelled && selisih > 0 ? 'text-emerald-700' : !item.isCancelled && selisih < 0 ? 'text-rose-700' : 'text-slate-500'}`}>
                                      {!item.isCancelled && selisih > 0 ? `+${formatRupiah(selisih)} (Hemat)` : !item.isCancelled && selisih < 0 ? `-${formatRupiah(Math.abs(selisih))} (Over)` : '-'}
                                    </td>
                                    <td className="p-2 border border-slate-200 text-center text-[9px] font-bold">
                                      {item.isCancelled ? (
                                        <span className="text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-300">🚫 Dibatalkan</span>
                                      ) : item.isPurchased ? (
                                        <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">✅ Terbeli</span>
                                      ) : (
                                        <span className="text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">⏳ Pending</span>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                            <tfoot>
                              <tr className="bg-slate-100 font-bold border-t-2 border-slate-800">
                                <td colSpan={3} className="p-2 border border-slate-300 text-right uppercase text-slate-700 tracking-wider">
                                  TOTAL ESTIMASI RAB VS REALISASI ITEM
                                </td>
                                <td className="p-2 border border-slate-300 text-right text-slate-800 font-extrabold tabular-nums">
                                  {formatRupiah(displayProcurementItems.reduce((acc, item) => acc + (item.hargaRencana || 0), 0))}
                                </td>
                                <td className="p-2 border border-slate-300 text-right text-blue-900 font-black tabular-nums">
                                  {formatRupiah(displayProcurementItems.reduce((acc, item) => acc + (item.hargaAktual || 0), 0))}
                                </td>
                                <td colSpan={2} className="p-2 border border-slate-300 text-center text-[10px] text-slate-600 font-semibold">
                                  Audit Verified by Finance
                                </td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      )}
                    </>
                  )}

                  {/* SECTION 2: FORMAL ACCOUNTING JOURNAL TABLE FOR THIS CHUNK */}
                  <div className="overflow-x-auto my-4">
                    {chunk.isFirstPage && (
                      <div className="border-b border-[#047857] pb-1 mb-2">
                        <h3 className="text-xs font-bold text-[#047857] uppercase tracking-wider m-0">
                          📑 Jurnal Mutasi Realisasi Kas Lapangan (Rincian Transaksi Transparan)
                        </h3>
                      </div>
                    )}
                    <table className="journal-table w-full border-collapse text-xs mb-4 font-sans">
                      <thead>
                        <tr className="bg-[#047857] text-white text-[9.5px] uppercase tracking-wider font-bold">
                          <th className="p-2.5 border border-[#047857] text-center w-10">No</th>
                          <th className="p-2.5 border border-[#047857] text-center w-24">Tanggal</th>
                          <th className="p-2.5 border border-[#047857] text-left">Uraian / Deskripsi Transaksi</th>
                          <th className="p-2.5 border border-[#047857] text-left w-32">Kategori</th>
                          <th className="p-2.5 border border-[#047857] text-right w-28">Debet (+)</th>
                          <th className="p-2.5 border border-[#047857] text-right w-28">Kredit (-)</th>
                          <th className="p-2.5 border border-[#047857] text-right w-32">Saldo Sisa (Rp)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {/* 1. Baris PINDAHAN jika halaman 2+ (Paling Atas) */}
                        {!chunk.isFirstPage && (
                          <tr className="bg-slate-100 font-bold border-y-2 border-slate-400">
                            <td className="p-2.5 border border-slate-200 text-center font-bold text-slate-500">-</td>
                            <td className="p-2.5 border border-slate-200 text-center font-bold text-slate-500">-</td>
                            <td className="p-2.5 border border-slate-200 text-left font-bold text-[#047857] italic uppercase tracking-wider">
                              PINDAHAN DARI HALAMAN SEBELUMNYA
                            </td>
                            <td className="p-2.5 border border-slate-200 text-left text-slate-600 font-medium">Saldo Pindahan</td>
                            <td className="p-2.5 border border-slate-200 text-right font-bold text-emerald-700 tabular-nums">
                              {chunk.pindahanDebet ? formatRupiah(chunk.pindahanDebet) : '-'}
                            </td>
                            <td className="p-2.5 border border-slate-200 text-right font-bold text-rose-700 tabular-nums">
                              {chunk.pindahanKredit ? formatRupiah(chunk.pindahanKredit) : '-'}
                            </td>
                            <td className={`p-2.5 border border-slate-200 text-right font-black tabular-nums ${(chunk.pindahanSaldo || 0) >= 0 ? 'text-slate-900' : 'text-rose-700'}`}>
                              {formatSaldoRupiah(chunk.pindahanSaldo || 0)}
                            </td>
                          </tr>
                        )}

                        {/* 2. Baris Transaksi di Halaman Ini */}
                        {chunk.rows.map((row, idx) => (
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

                        {/* 3. Baris JUMLAH DIPINDAHKAN jika BUKAN halaman terakhir (Paling Bawah Halaman Ini) */}
                        {!chunk.isLastPage && (
                          <tr className="bg-slate-100 font-bold border-y-2 border-slate-400">
                            <td className="p-2.5 border border-slate-200 text-center font-bold text-slate-500">-</td>
                            <td className="p-2.5 border border-slate-200 text-center font-bold text-slate-500">-</td>
                            <td className="p-2.5 border border-slate-200 text-left font-bold text-[#047857] italic uppercase tracking-wider">
                              JUMLAH DIPINDAHKAN KE HALAMAN BERIKUTNYA
                            </td>
                            <td className="p-2.5 border border-slate-200 text-left text-slate-600 font-medium">Saldo Dipindahkan</td>
                            <td className="p-2.5 border border-slate-200 text-right font-bold text-emerald-700 tabular-nums">
                              {chunk.dipindahkanDebet ? formatRupiah(chunk.dipindahkanDebet) : '-'}
                            </td>
                            <td className="p-2.5 border border-slate-200 text-right font-bold text-rose-700 tabular-nums">
                              {chunk.dipindahkanKredit ? formatRupiah(chunk.dipindahkanKredit) : '-'}
                            </td>
                            <td className={`p-2.5 border border-slate-200 text-right font-black tabular-nums ${(chunk.dipindahkanSaldo || 0) >= 0 ? 'text-slate-900' : 'text-rose-700'}`}>
                              {formatSaldoRupiah(chunk.dipindahkanSaldo || 0)}
                            </td>
                          </tr>
                        )}
                      </tbody>

                      {/* 4. TOTAL AKHIR HANYA DI HALAMAN TERAKHIR */}
                      {chunk.isLastPage && (
                        <tfoot>
                          <tr className="bg-slate-100 font-extrabold border-t-2 border-[#1A365D]">
                            <td colSpan={4} className="p-3 border border-slate-300 text-right uppercase text-slate-700 tracking-wider">
                              {isInternal ? (
                                sisaDana > 0 
                                  ? 'TOTAL & STATUS KAS AKHIR (REFUND)' 
                                  : sisaDana < 0 
                                  ? 'TOTAL & STATUS KAS AKHIR (REIMBURSE)' 
                                  : 'TOTAL & POSISI SISA DANA (NIHIL)'
                              ) : (
                                'TOTAL & POSISI SISA DANA'
                              )}
                            </td>
                            <td className="p-3 border border-slate-300 text-right text-emerald-700 font-extrabold tabular-nums">{formatRupiah(totalDebet)}</td>
                            <td className="p-3 border border-slate-300 text-right text-rose-700 font-extrabold tabular-nums">{formatRupiah(totalKredit)}</td>
                            <td className={`p-3 border border-slate-300 text-right font-black tabular-nums ${sisaDana >= 0 ? 'text-blue-900' : 'text-rose-700'}`}>
                              <div>{formatSaldoRupiah(sisaDana)}</div>
                              {isInternal && (
                                <div className={`text-[8.5px] font-extrabold uppercase mt-0.5 tracking-wider ${sisaDana > 0 ? 'text-emerald-700' : sisaDana < 0 ? 'text-rose-700' : 'text-slate-500'}`}>
                                  {sisaDana > 0 ? '📥 [REFUND]' : sisaDana < 0 ? '📤 [REIMBURSE]' : '[NIHIL]'}
                                </div>
                              )}
                            </td>
                          </tr>
                        </tfoot>
                      )}
                    </table>
                  </div>

                  {/* 5. FORMAL SIGNATURE BOX HANYA DI HALAMAN TERAKHIR JIKA SIGCOUNT > 0 */}
                  {chunk.isLastPage && sigCount > 0 && (
                    <div
                      className="signature-container my-8"
                      style={{
                        display: 'flex',
                        justifyContent: sigCount === 1 ? 'flex-end' : 'space-between',
                        width: '100%',
                        gap: '8px'
                      }}
                    >
                      {/* Slot 1: Teknisi (If 4 columns) */}
                      {sigCount === 4 && (
                        <div className="signature-box" style={{ flex: '1', textAlign: 'center', padding: '0 4px' }}>
                          <p className="text-xs text-slate-600 font-medium mb-1">{sig1Header}</p>
                          <div className="signature-space" style={{ height: '55px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {sig1Img ? (
                              <img src={sig1Img} alt="TTD Slot 1" style={{ maxHeight: '52px', maxWidth: '120px', objectFit: 'contain', margin: '0 auto' }} />
                            ) : null}
                          </div>
                          <div className="signature-line text-xs font-bold text-[#047857]">
                            {sig1Nama}
                          </div>
                          <p className="text-[9.5px] text-slate-600 font-semibold mt-0.5">{sig1Jabatan}</p>
                        </div>
                      )}

                      {/* Slot 2: Leader Teknik */}
                      {sigCount >= 3 && (
                        <div className="signature-box" style={{ flex: '1', textAlign: 'center', padding: '0 4px', position: 'relative' }}>
                          {parafEnabled && (
                            <div style={{
                              position: 'absolute',
                              top: '-2px',
                              right: '2px',
                              border: '1px dashed #94a3b8',
                              borderRadius: '4px',
                              padding: '1px 3px',
                              backgroundColor: '#ffffff',
                              textAlign: 'center',
                              maxWidth: '56px',
                              boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                              zIndex: 5
                            }}>
                              <span style={{ fontSize: '6.5px', fontWeight: '700', color: '#64748b', display: 'block', lineHeight: 1 }}>Paraf</span>
                              {parafImg ? (
                                <img src={parafImg} alt="Paraf" style={{ maxHeight: '18px', maxWidth: '48px', objectFit: 'contain', margin: '1px auto' }} />
                              ) : (
                                <div style={{ height: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                  <span style={{ fontSize: '6.5px', fontStyle: 'italic', color: '#94a3b8' }}>[Paraf]</span>
                                </div>
                              )}
                              <span style={{ fontSize: '6px', fontWeight: '600', color: '#334155', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{parafNama}</span>
                            </div>
                          )}
                          <p className="text-xs text-slate-600 font-medium mb-1">{sig2Header}</p>
                          <div className="signature-space" style={{ height: '55px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {sig2Img ? (
                              <img src={sig2Img} alt="TTD Slot 2" style={{ maxHeight: '52px', maxWidth: '120px', objectFit: 'contain', margin: '0 auto' }} />
                            ) : null}
                          </div>
                          <div className="signature-line text-xs font-bold text-[#047857]">
                            {sig2Nama}
                          </div>
                          <p className="text-[9.5px] text-slate-600 font-semibold mt-0.5">{sig2Jabatan}</p>
                        </div>
                      )}

                      {/* Slot 3: Admin Keuangan / Dibuat Oleh (Finance) */}
                      <div
                        className="signature-box"
                        style={{
                          flex: sigCount === 1 ? '0 0 220px' : '1',
                          textAlign: 'center',
                          padding: '0 4px'
                        }}
                      >
                        <p className="text-xs text-slate-600 font-medium mb-1">{sig3Header}</p>
                        <div className="signature-space" style={{ height: '55px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {sig3Img ? (
                            <img src={sig3Img} alt="TTD Slot 3" style={{ maxHeight: '52px', maxWidth: '120px', objectFit: 'contain', margin: '0 auto' }} />
                          ) : null}
                        </div>
                        <div className="signature-line text-xs font-bold text-[#047857]">
                          {sig3Nama}
                        </div>
                        <p className="text-[9.5px] text-slate-600 font-semibold mt-0.5">{sig3Jabatan}</p>
                      </div>

                      {/* Slot 4: Direktur Utama */}
                      {sigCount >= 2 && (
                        <div className="signature-box" style={{ flex: '1', textAlign: 'center', padding: '0 4px' }}>
                          <p className="text-xs text-slate-600 font-medium mb-1">{sig4Header}</p>
                          <div className="signature-space" style={{ height: '55px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {sig4Img ? (
                              <img src={sig4Img} alt="TTD Slot 4" style={{ maxHeight: '52px', maxWidth: '120px', objectFit: 'contain', margin: '0 auto' }} />
                            ) : null}
                          </div>
                          <div className="signature-line text-xs font-bold text-[#047857]">
                            {sig4Nama}
                          </div>
                          <p className="text-[9.5px] text-slate-600 font-semibold mt-0.5">{sig4Jabatan}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* 6. FORCED PHYSICAL PAGE BREAK ANTAR HALAMAN */}
                  {!chunk.isLastPage && (
                    <div className="page-break-divider" style={{ pageBreakAfter: 'always', breakAfter: 'page', height: '0px' }} />
                  )}
                </div>
              ));
            })()}
          </div>
        </div>
      </div>
    </Modal>
  );
}
