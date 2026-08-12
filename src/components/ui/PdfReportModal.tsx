// ============================================================
// ARKA Finance — Official Printable PDF & KOP Document Engine
// Matches Official Letterhead Details (Jl. Cibodas Raya No. 02, Antapani Kidul,
// +62 821-2984-9515, aksara.riksa.perdana@gmail.com, aksarariksapjk3.com)
// Universal Hidden-Iframe Printing for 100% Mobile HP & Desktop Compatibility
// ============================================================

import React, { useRef, useState } from 'react';
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
  const [customPelaksanaName, setCustomPelaksanaName] = useState<string>('');
  const [selectedPengajuanTxId, setSelectedPengajuanTxId] = useState<string>('semua');

  // Digital Signature Images State (Base64 dataURL) with LocalStorage persistence
  const [sigPemohon, setSigPemohon] = useState<string>(() => localStorage.getItem('signature_pemohon') || '');
  const [sigFinance, setSigFinance] = useState<string>(() => localStorage.getItem('signature_finance') || '');
  const [sigDirektur, setSigDirektur] = useState<string>(() => localStorage.getItem('signature_direktur') || '');

  const handleSignatureUpload = (roleKey: 'pemohon' | 'finance' | 'direktur', file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      if (dataUrl) {
        if (roleKey === 'pemohon') {
          setSigPemohon(dataUrl);
          localStorage.setItem('signature_pemohon', dataUrl);
        } else if (roleKey === 'finance') {
          setSigFinance(dataUrl);
          localStorage.setItem('signature_finance', dataUrl);
        } else if (roleKey === 'direktur') {
          setSigDirektur(dataUrl);
          localStorage.setItem('signature_direktur', dataUrl);
        }
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSignatureClear = (roleKey: 'pemohon' | 'finance' | 'direktur') => {
    if (roleKey === 'pemohon') {
      setSigPemohon('');
      localStorage.removeItem('signature_pemohon');
    } else if (roleKey === 'finance') {
      setSigFinance('');
      localStorage.removeItem('signature_finance');
    } else if (roleKey === 'direktur') {
      setSigDirektur('');
      localStorage.removeItem('signature_direktur');
    }
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

      // Unfold & Flatten All Attachments per Transaction with Sequence Labeling
      for (const t of reportTxs) {
        const txAtts: Array<{ nama: string; tipe: string; dataUrl: string }> = [];

        // 1. Include Bukti Transfer if present
        if (t.buktiTransfer && t.buktiTransfer.trim()) {
          txAtts.push({
            nama: 'Bukti Transfer Bank',
            tipe: 'image/png',
            dataUrl: t.buktiTransfer.trim(),
          });
        }

        // 2. Include all items from Lampiran array
        const rawLampiran = t.lampiran;
        let parsedLampiran: any[] = [];
        if (Array.isArray(rawLampiran)) {
          parsedLampiran = rawLampiran;
        } else if (typeof rawLampiran === 'string' && (rawLampiran as string).trim().startsWith('[')) {
          try {
            const parsed = JSON.parse(rawLampiran as string);
            if (Array.isArray(parsed)) parsedLampiran = parsed;
          } catch { /* ignore */ }
        }

        parsedLampiran.forEach(att => {
          if (att && att.dataUrl && !txAtts.some(a => a.dataUrl === att.dataUrl)) {
            txAtts.push({
              nama: att.nama || 'Lampiran Transaksi',
              tipe: att.tipe || (att.dataUrl.toLowerCase().includes('.pdf') ? 'application/pdf' : 'image/jpeg'),
              dataUrl: att.dataUrl,
            });
          }
        });

        const totalAtts = txAtts.length;

        for (let i = 0; i < totalAtts; i++) {
          const att = txAtts[i];
          const isPdf =
            att.tipe?.includes('pdf') ||
            att.nama?.toLowerCase().endsWith('.pdf') ||
            att.dataUrl.toLowerCase().includes('.pdf');

          const seqLabel = totalAtts > 1 ? ` (Lampiran ${i + 1} dari ${totalAtts})` : '';

          let qrDataUrl = '';
          if (isPdf) {
            try {
              const qrTarget = att.dataUrl.startsWith('http') ? att.dataUrl : `PDF: ${att.nama}`;
              qrDataUrl = await QRCode.toDataURL(qrTarget, {
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
            qrDataUrl,
          });
        }
      }

      if (itemsToPrint.length > 0) {
        attachmentsHtml += `
          <div style="page-break-before: always; padding-top: 20px;">
            <div class="kop-container" style="text-align: center; padding-bottom: 8px; border-bottom: 2.5px solid #1A365D; margin-bottom: 2px;">
              <h1 class="company-title" style="font-family: 'Inter', sans-serif; font-size: 18px; font-weight: 900; color: #1A365D; letter-spacing: 0.5px; margin: 0; text-transform: uppercase;">LAMPIRAN DOKUMENTASI & STRUK</h1>
              <p class="company-info" style="font-size: 9.5px; color: #334155; margin-top: 4px; line-height: 1.5;">
                ${displayTitle} &middot; Periode: ${periodText}
              </p>
            </div>
            
            <div class="gallery-grid">
        `;

        itemsToPrint.forEach(item => {
          if (item.type === 'image') {
            const driveId = getDriveId(item.url);
            const fallbackSrc = driveId ? `https://drive.google.com/thumbnail?id=${driveId}&sz=w800` : item.url;
            attachmentsHtml += `
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
            // PDF Document QR Code Fallback Card
            attachmentsHtml += `
              <div class="gallery-item" style="background: #F8FAFC; border: 1.5px solid #CBD5E1; border-radius: 8px; padding: 10px;">
                <div class="img-wrapper" style="background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 6px; padding: 8px; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; height: auto; min-height: 200px;">
                  ${
                    item.qrDataUrl
                      ? `<img src="${item.qrDataUrl}" alt="Scan QR Code PDF" style="width: 110px; height: 110px; border: 1px solid #CBD5E1; padding: 4px; border-radius: 6px; background: #FFFFFF; margin-bottom: 6px;" />`
                      : `<div style="font-size: 32px; margin-bottom: 4px;">📄</div>`
                  }
                  <div style="font-size: 10px; font-weight: 800; color: #1E293B; word-break: break-all; max-width: 95%; margin-top: 2px;">
                    📄 ${item.nama}
                  </div>
                  <div style="font-size: 8.5px; font-weight: 700; color: #4F46E5; margin-top: 2px;">DOKUMEN PDF CLOUD ARCHIVE</div>
                  <div style="font-size: 8px; font-weight: 600; color: #475569; margin-top: 4px; padding: 3px 6px; background: #F1F5F9; border-radius: 4px; border: 1px dashed #CBD5E1;">
                    📱 Scan QR Code untuk melihat dokumen PDF asli di Google Drive / Cloud Archive
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

        attachmentsHtml += `
            </div>
          </div>
        `;
      }
    }

    const sanitizeName = (str: string) => str.replace(/[^a-zA-Z0-9_-]/g, '_');
    const dynamicDocTitle = project
      ? `Laporan_Realisasi_${sanitizeName(project.nama)}_${new Date().toISOString().split('T')[0]}`
      : `Laporan_Keuangan_${reportScope}_${new Date().toISOString().split('T')[0]}`;

    frameDoc.open();
    frameDoc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${dynamicDocTitle}</title>
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
              border-bottom: 2.5px solid #047857;
              margin-bottom: 2px;
            }
            .kop-line-secondary {
              border-bottom: 1px solid #A7F3D0;
              margin-bottom: 16px;
            }
            .company-title {
              font-family: 'Inter', sans-serif;
              font-size: 18px;
              font-weight: 900;
              color: #047857;
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
              color: #047857;
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
              display: flex !important;
              flex-direction: row !important;
              justify-content: space-between !important;
              align-items: stretch !important;
              gap: 12px;
              width: 100%;
              border: 1px solid #CBD5E1;
              border-radius: 10px;
              background-color: #F8FAFC;
              margin-bottom: 20px;
              padding: 12px;
              page-break-inside: avoid !important;
              break-inside: avoid !important;
            }
            .summary-card {
              flex: 1;
              display: flex;
              flex-direction: column;
              justify-content: center;
              border-radius: 8px;
              padding: 10px 8px;
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
              font-size: 8.5px;
              color: #475569;
              text-transform: uppercase;
              font-weight: 700;
              letter-spacing: 0.3px;
              margin-bottom: 4px;
            }
            .summary-val {
              font-size: 13.5px;
              font-weight: 800;
              margin: 0;
            }

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
              background-color: #047857 !important;
              color: #FFFFFF !important;
              font-size: 9px;
              font-weight: 700;
              text-transform: uppercase;
              letter-spacing: 0.4px;
              padding: 9px 8px;
              border: 1px solid #047857;
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
          {/* Digital Signatures Upload Bar (PDF Editor Style) */}
          <div className="p-3 bg-slate-900 text-white rounded-2xl space-y-2 border border-slate-800 shadow-md">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                ✍️ Upload Gambar Tanda Tangan Digital (Siap Tempel Otomatis di PDF)
              </span>
              <span className="text-[10px] text-slate-400">Tersimpan di peramban</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
              {/* Pemohon */}
              <div className="p-2 bg-slate-800/80 rounded-xl border border-slate-700/70 flex flex-col justify-between">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10.5px] font-bold text-slate-200">1. TTD Pemohon / Leader</span>
                  {sigPemohon && (
                    <button onClick={() => handleSignatureClear('pemohon')} className="text-[10px] text-rose-400 hover:underline">Hapus</button>
                  )}
                </div>
                {sigPemohon ? (
                  <div className="h-10 bg-white rounded-lg border border-slate-300 p-1 flex items-center justify-center">
                    <img src={sigPemohon} alt="TTD Pemohon" className="max-h-full max-w-full object-contain" />
                  </div>
                ) : (
                  <label className="h-10 bg-slate-700/60 hover:bg-slate-700 rounded-lg border border-dashed border-slate-500 flex items-center justify-center text-[10px] text-slate-300 cursor-pointer transition-colors">
                    + Drop / Upload File TTD
                    <input type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && handleSignatureUpload('pemohon', e.target.files[0])} />
                  </label>
                )}
              </div>

              {/* Finance */}
              <div className="p-2 bg-slate-800/80 rounded-xl border border-slate-700/70 flex flex-col justify-between">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10.5px] font-bold text-slate-200">2. TTD Keuangan (Finance)</span>
                  {sigFinance && (
                    <button onClick={() => handleSignatureClear('finance')} className="text-[10px] text-rose-400 hover:underline">Hapus</button>
                  )}
                </div>
                {sigFinance ? (
                  <div className="h-10 bg-white rounded-lg border border-slate-300 p-1 flex items-center justify-center">
                    <img src={sigFinance} alt="TTD Finance" className="max-h-full max-w-full object-contain" />
                  </div>
                ) : (
                  <label className="h-10 bg-slate-700/60 hover:bg-slate-700 rounded-lg border border-dashed border-slate-500 flex items-center justify-center text-[10px] text-slate-300 cursor-pointer transition-colors">
                    + Drop / Upload File TTD
                    <input type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && handleSignatureUpload('finance', e.target.files[0])} />
                  </label>
                )}
              </div>

              {/* Direktur */}
              <div className="p-2 bg-slate-800/80 rounded-xl border border-slate-700/70 flex flex-col justify-between">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10.5px] font-bold text-slate-200">3. TTD Direktur Utama</span>
                  {sigDirektur && (
                    <button onClick={() => handleSignatureClear('direktur')} className="text-[10px] text-rose-400 hover:underline">Hapus</button>
                  )}
                </div>
                {sigDirektur ? (
                  <div className="h-10 bg-white rounded-lg border border-slate-300 p-1 flex items-center justify-center">
                    <img src={sigDirektur} alt="TTD Direktur" className="max-h-full max-w-full object-contain" />
                  </div>
                ) : (
                  <label className="h-10 bg-slate-700/60 hover:bg-slate-700 rounded-lg border border-dashed border-slate-500 flex items-center justify-center text-[10px] text-slate-300 cursor-pointer transition-colors">
                    + Drop / Upload File TTD
                    <input type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && handleSignatureUpload('direktur', e.target.files[0])} />
                  </label>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Printable Document Preview Area */}
        <div className="max-h-[70vh] overflow-y-auto p-4 sm:p-6 bg-white border border-gray-200 rounded-2xl shadow-inner scrollbar-thin font-sans">
          <div ref={printRef} className="space-y-4 text-slate-900 font-sans">
            {/* EXACT OFFICIAL KOP HEADER FROM USER SCREENSHOT */}
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
                <table className="metadata-table my-3 text-left w-full border-collapse font-sans text-xs bg-slate-50 border border-slate-300 rounded-xl overflow-hidden shadow-xs">
                  <tbody>
                    <tr className="border-b border-slate-200">
                      <td className="p-2 px-3 font-bold text-slate-600 bg-slate-100 text-[9.5px] uppercase tracking-wider w-1/4">
                        INSTANSI / KLIEN TUJUAN
                      </td>
                      <td className="p-2 px-3 font-extrabold text-slate-900 w-1/4">
                        : {project.klien}
                      </td>
                      <td className="p-2 px-3 font-bold text-slate-600 bg-slate-100 text-[9.5px] uppercase tracking-wider w-1/4">
                        NO. SURAT PENGAJUAN
                      </td>
                      <td className="p-2 px-3 font-extrabold text-blue-900 font-mono w-1/4">
                        : {project.nomorSurat || '050/ARP/VII/OP/2026'}
                      </td>
                    </tr>
                    <tr>
                      <td className="p-2 px-3 font-bold text-slate-600 bg-slate-100 text-[9.5px] uppercase tracking-wider">
                        PEMOHON / LEADER TEKNIK
                      </td>
                      <td className="p-2 px-3 font-extrabold text-slate-900">
                        : {project.pemohonNama || 'Rama Regawa Sri Anggayana'}{project.pemohonJabatan ? ` (${project.pemohonJabatan})` : ''}
                      </td>
                      <td className="p-2 px-3 font-bold text-slate-600 bg-slate-100 text-[9.5px] uppercase tracking-wider">
                        PIC LAPANGAN / TEKNISI
                      </td>
                      <td className="p-2 px-3 font-extrabold text-slate-900">
                        : {project.teknisiPic || 'Fauzan'}
                      </td>
                    </tr>
                  </tbody>
                </table>
              )}
            </div>

            {/* EXECUTIVE FINANCIAL SUMMARY */}
            {project ? (
              isInternal ? (
                /* Internal / Kas Operasional: 3 Cards with Real Time Item Settlement Math */
                (() => {
                  const displayProcurementItems = (project.procurementItems || []);
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
                          {sisaDanaRiil > 0 ? 'Saldo Sisa (Wajib Refund)' : sisaDanaRiil < 0 ? 'Defisit (Reimbursement)' : 'Saldo Sisa Kas'}
                        </span>
                        <p className="summary-val text-sm font-black tabular-nums">
                          {formatSaldoRupiah(sisaDanaRiil)}
                        </p>
                      </div>
                    </div>
                  );
                })()
              ) : (
                /* External Project (e.g. Proyek Angkur): 5 Cards */
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
              /* Kas Utama: 4 Cards (Omzet Riil, Omzet Semu, Total Pengeluaran, Saldo Akhir) */
              <div className="summary-box flex flex-row justify-between items-stretch gap-2.5 bg-[#F8FAFC] border border-slate-300 rounded-2xl p-3 my-4 shadow-sm w-full page-break-inside-avoid">
                <div className="summary-card card-green flex-1 flex flex-col justify-center p-2.5 rounded-xl border text-center">
                  <span className="summary-label text-[8.5px] font-bold text-slate-500 uppercase tracking-wider block mb-1">💰 Omzet Riil Klien (P&L)</span>
                  <p className="summary-val text-xs sm:text-sm font-black tabular-nums">{formatRupiah(totalOmzetRil)}</p>
                </div>
                <div className="summary-card card-navy flex-1 flex flex-col justify-center p-2.5 rounded-xl border text-center">
                  <span className="summary-label text-[8.5px] font-bold text-slate-500 uppercase tracking-wider block mb-1">📥 Omzet Semu / Drop</span>
                  <p className="summary-val text-xs sm:text-sm font-black tabular-nums">{formatRupiah(totalOmzetSemu)}</p>
                </div>
                <div className="summary-card card-red flex-1 flex flex-col justify-center p-2.5 rounded-xl border text-center">
                  <span className="summary-label text-[8.5px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Total Kredit (Pengeluaran)</span>
                  <p className="summary-val text-xs sm:text-sm font-black tabular-nums">{formatRupiah(totalKredit)}</p>
                </div>
                <div className={`summary-card flex-1 flex flex-col justify-center p-2.5 rounded-xl border text-center ${sisaDana >= 0 ? 'card-green' : 'card-red'}`}>
                  <span className="summary-label text-[8.5px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Saldo Kas Akhir</span>
                  <p className="summary-val text-xs sm:text-sm font-black tabular-nums">
                    {formatSaldoRupiah(sisaDana)}
                  </p>
                </div>
              </div>
            )}

            {/* SECTION 1: MATRIKS REALISASI ITEM PENGADAAN & VARIANS RAB (Rencana vs Realita) */}
            {(() => {
              const displayProcurementItems = (project?.procurementItems || []).filter(item => {
                if (selectedPengajuanTxId === 'semua') return true;
                if (item.suratPengajuanId) {
                  return item.suratPengajuanId === selectedPengajuanTxId;
                }
                const ptx = approvedTx.filter(t => t.proyekId === project?.id);
                const allInjections = ptx.filter(t => isCapitalInjectionTx(t) || (t.jenis === 'masuk' && (t.kategori || '').toLowerCase().includes('mutasi')));
                const firstInj = allInjections[0];
                return !firstInj || firstInj.id === selectedPengajuanTxId;
              });

              if (displayProcurementItems.length === 0) return null;

              return (
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
              );
            })()}

            {/* SECTION 2: FORMAL ACCOUNTING JOURNAL TABLE */}
            <div className="overflow-x-auto my-4">
              <div className="border-b border-[#047857] pb-1 mb-2">
                <h3 className="text-xs font-bold text-[#047857] uppercase tracking-wider m-0">
                  📑 Jurnal Mutasi Realisasi Kas Lapangan (Rincian Transaksi Transparan)
                </h3>
              </div>
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

            {/* FORMAL 3-COLUMN SIGNATURE BOX WITH DIGITAL SIGNATURE IMAGE EMBEDDING */}
            <div className="signature-container my-8" style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
              <div className="signature-box" style={{ flex: '1', textAlign: 'center', padding: '0 8px' }}>
                <p className="text-xs text-slate-600 font-medium mb-1">Diajukan &amp; Pemohon:</p>
                <div className="signature-space" style={{ height: '55px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {sigPemohon ? (
                    <img src={sigPemohon} alt="Tanda Tangan Pemohon" style={{ maxHeight: '52px', maxWidth: '140px', objectFit: 'contain', margin: '0 auto' }} />
                  ) : null}
                </div>
                <div className="signature-line text-xs font-bold text-[#047857]">
                  {project?.pemohonNama || customPelaksanaName.trim() || 'Rama Regawa Sri Anggayana'}
                </div>
                <p className="text-[9.5px] text-slate-600 font-semibold mt-0.5">{project?.pemohonJabatan || 'Leader Teknik'}</p>
              </div>

              <div className="signature-box" style={{ flex: '1', textAlign: 'center', padding: '0 8px' }}>
                <p className="text-xs text-slate-600 font-medium mb-1">Diverifikasi &amp; Disiapkan:</p>
                <div className="signature-space" style={{ height: '55px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {sigFinance ? (
                    <img src={sigFinance} alt="Tanda Tangan Finance" style={{ maxHeight: '52px', maxWidth: '140px', objectFit: 'contain', margin: '0 auto' }} />
                  ) : null}
                </div>
                <div className="signature-line text-xs font-bold text-[#047857]">
                  Zulfan Rafly Baihaqi
                </div>
                <p className="text-[9.5px] text-slate-600 font-semibold mt-0.5">Admin Keuangan (Finance)</p>
              </div>

              <div className="signature-box" style={{ flex: '1', textAlign: 'center', padding: '0 8px' }}>
                <p className="text-xs text-slate-600 font-medium mb-1">Mengetahui &amp; Disetujui:</p>
                <div className="signature-space" style={{ height: '55px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {sigDirektur ? (
                    <img src={sigDirektur} alt="Tanda Tangan Direktur" style={{ maxHeight: '52px', maxWidth: '140px', objectFit: 'contain', margin: '0 auto' }} />
                  ) : null}
                </div>
                <div className="signature-line text-xs font-bold text-[#047857]">
                  Habsi Gufira Pradana
                </div>
                <p className="text-[9.5px] text-slate-600 font-semibold mt-0.5">Direktur Utama</p>
              </div>
            </div>

          </div>
        </div>
      </div>
    </Modal>
  );
}
