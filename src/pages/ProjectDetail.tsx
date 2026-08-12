// ============================================================
// ARKA Finance — Project Financial Hub / Detail Page
// Includes: Project Fund Isolation, Realisasi Report, Refund Flow, Excel Export
// ============================================================

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { GoogleGenerativeAI } from '@google/generative-ai';
import {
  ArrowLeft, Wallet, TrendingUp, TrendingDown, PlusCircle,
  Clock, CheckCircle2, AlertTriangle, Layers, Calendar, User,
  Building2, Trash2, Edit3, PieChart as PieIcon, ExternalLink,
  Download, ArrowUpRight, RotateCcw, Printer, Paperclip, Sparkles, FileText, CheckSquare, Square, ChevronDown, ChevronUp, FileUp, Ban
} from 'lucide-react';
import { getProjectById, updateProject, deleteProject } from '../services/projectService';
import { getTransactionsByProject, addTransaction, updateTransaction, deleteTransaction, groupAndSortTransactions } from '../services/transactionService';
import { getProjectFinancialSummary, getProjectCategoryBreakdown, buildProjectAISummaryContext, cleanTextPunctuation } from '../services/analyticsService';
import { exportProjectRealisasiExcel } from '../services/exportService';
import { uploadAttachmentFile } from '../services/storageService';
import { type Project, type Transaction, type ProcurementItem } from '../types';
import {
  Card, Button, StatusBadge, LoadingSpinner, EmptyState,
  formatRupiah, formatDate, AttachmentViewer, TransactionDetailModal, PdfReportModal
} from '../components/ui';
import { Modal } from '../components/ui/Modal';
import { ProcurementChecklistSection } from '../components/procurement/ProcurementChecklistSection';
import { isCapitalInjectionTx } from '../components/ui/PdfReportModal';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';

function formatRupiahInput(value: string): string {
  const num = value.replace(/\D/g, '');
  if (!num) return '';
  return new Intl.NumberFormat('id-ID').format(Number(num));
}

function splitIgnoreInParens(str: string, delimiter: string = ','): string[] {
  const parts: string[] = [];
  let current = '';
  let parenDepth = 0;
  let inQuotes = false;

  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    if (char === '"' || char === "'") {
      inQuotes = !inQuotes;
      current += char;
    } else if (char === '(' || char === '[' || char === '{') {
      parenDepth++;
      current += char;
    } else if (char === ')' || char === ']' || char === '}') {
      if (parenDepth > 0) parenDepth--;
      current += char;
    } else if (str.substring(i, i + delimiter.length) === delimiter && parenDepth === 0 && !inQuotes) {
      parts.push(current.trim());
      current = '';
      i += delimiter.length - 1;
    } else {
      current += char;
    }
  }
  if (current.trim() || parts.length > 0) {
    parts.push(current.trim());
  }
  return parts;
}

function parsePriceValue(str: string | undefined): number | undefined {
  if (!str) return undefined;
  const s = str.trim().toLowerCase();

  // Check for jt / juta, e.g. 1.5jt, 1,5 juta, 2jt
  const jtMatch = s.match(/^(?:rp\.?|idr|\b)?\s*([\d\.\,]+)\s*(?:jt|juta)$/);
  if (jtMatch) {
    const val = parseFloat(jtMatch[1].replace(',', '.'));
    return isNaN(val) ? undefined : Math.round(val * 1_000_000);
  }

  // Check for rb / k, e.g. 50rb, 50k, 150rb
  const rbMatch = s.match(/^(?:rp\.?|idr|\b)?\s*([\d\.\,]+)\s*(?:rb|k)$/);
  if (rbMatch) {
    const val = parseFloat(rbMatch[1].replace(',', '.'));
    return isNaN(val) ? undefined : Math.round(val * 1_000);
  }

  // Clean non-digits
  const digits = s.replace(/\D/g, '');
  if (!digits) return undefined;
  const num = parseInt(digits, 10);
  return isNaN(num) ? undefined : num;
}

function parseBulkImportText(text: string): ProcurementItem[] {
  if (!text || !text.trim()) return [];
  const lines = text.split('\n');
  const items: ProcurementItem[] = [];
  let currentCategory = 'Operational Cost';

  const knownUnits = [
    'sak', 'pcs', 'unit', 'roll', 'box', 'pack', 'm', 'm2', 'm3', 'kg', 'liter', 'l',
    'trus', 'colt', 'bh', 'buah', 'orang', 'malam', 'pasang', 'set', 'ls', 'paket',
    'lembar', 'btg', 'batang', 'rim', 'zak', 'drum', 'galon', 'meter', 'cm', 'load', 'kamar', 'hari', 'isi'
  ];

  for (const rawLine of lines) {
    let line = rawLine.trim();
    if (!line) continue;

    // Detect if line is a Category Header
    const isHeaderLine =
      (line.startsWith('#') ||
        line.startsWith('[') ||
        line.startsWith('---') ||
        (line.endsWith(':') && !line.includes(',') && !line.includes('|') && !line.includes('\t') && !line.includes(';'))) &&
      !line.includes('|');

    if (isHeaderLine) {
      let cleanCategory = line.replace(/^[#\-\[\:\*]+|[#\-\]\:\*]+$/g, '').trim();
      cleanCategory = cleanCategory.replace(/[\u{1F300}-\u{1F9FF}]/gu, '').trim();
      if (cleanCategory) {
        currentCategory = cleanCategory;
      }
      continue;
    }

    // Clean leading list numbering: "1.", "1)", "1.-", "-", "*", "•", "[1]", "1.1", etc.
    line = line.replace(/^([\d+\.\-\*\)\•\>]|\[\d+\])+\s*/, '').trim();
    if (!line) continue;

    // Multi-delimiter splitting with paren-awareness (| \t ; , " - " " : ")
    let parts: string[] = [];
    if (line.includes('|')) {
      parts = splitIgnoreInParens(line, '|');
    } else if (line.includes('\t')) {
      parts = splitIgnoreInParens(line, '\t');
    } else if (line.includes(';')) {
      parts = splitIgnoreInParens(line, ';');
    } else if (line.includes(',')) {
      parts = splitIgnoreInParens(line, ',');
    } else if (line.includes(' - ')) {
      parts = splitIgnoreInParens(line, ' - ');
    } else if (line.includes(' : ')) {
      parts = splitIgnoreInParens(line, ' : ');
    } else {
      parts = [line];
    }

    let nama = 'Item Pengadaan';
    let kuantitas = 1;
    let satuan: string | undefined = undefined;
    let hargaRencana: number | undefined = undefined;
    let itemCategory = currentCategory;

    if (parts.length >= 2) {
      nama = parts[0] || 'Item Pengadaan';

      // Qty & Satuan from part 1
      const qtyMatch = parts[1].match(/^(\d+)\s*(.*)$/);
      if (qtyMatch) {
        kuantitas = parseInt(qtyMatch[1], 10) || 1;
        if (qtyMatch[2] && qtyMatch[2].trim()) {
          satuan = qtyMatch[2].trim();
        }
      } else {
        const numPart = parts[1].replace(/\D/g, '');
        if (numPart) kuantitas = parseInt(numPart, 10) || 1;
      }

      if (parts.length >= 3) {
        const parsedVal = parsePriceValue(parts[2]);
        if (!satuan && parts[2] && parsedVal === undefined) {
          satuan = parts[2].trim();
        } else if (parsedVal !== undefined) {
          hargaRencana = parsedVal;
        }
      }

      if (parts.length >= 4 && hargaRencana === undefined) {
        hargaRencana = parsePriceValue(parts[3]);
      }

      if (parts.length >= 5 && parts[4]) {
        const catOverride = parts[4].replace(/[\u{1F300}-\u{1F9FF}]/gu, '').trim();
        if (catOverride && isNaN(Number(catOverride))) itemCategory = catOverride;
      }
    } else {
      // Single un-delimited text string line
      let rest = line;

      // Extract category override if present at end in parentheses e.g. (Material)
      const catMatch = rest.match(/\(([^)]+)\)$/);
      if (catMatch) {
        const potentialCat = catMatch[1].replace(/[\u{1F300}-\u{1F9FF}]/gu, '').trim();
        if (potentialCat) itemCategory = potentialCat;
        rest = rest.replace(/\(([^)]+)\)$/, '').trim();
      }

      // Extract price at the end or after @ / Rp / IDR / Rp.
      const priceRegex = /(?:@|rp\.?|idr|\b)?\s*([\d\.\,]+\s*(?:jt|juta|rb|k)?)\s*$/i;
      const priceMatch = rest.match(priceRegex);
      if (priceMatch) {
        const candidatePriceStr = priceMatch[1];
        const parsedP = parsePriceValue(candidatePriceStr);
        if (parsedP !== undefined && parsedP > 0) {
          hargaRencana = parsedP;
          rest = rest.substring(0, rest.lastIndexOf(priceMatch[0])).trim();
        }
      }

      // Extract Qty and Satuan from remaining text e.g. "Semen 10 sak"
      const qtyUnitRegex = new RegExp(`(\\d+)\\s*(${knownUnits.join('|')})?`, 'i');
      const qtyMatch = rest.match(qtyUnitRegex);
      if (qtyMatch) {
        kuantitas = parseInt(qtyMatch[1], 10) || 1;
        if (qtyMatch[2]) satuan = qtyMatch[2];
        rest = rest.replace(qtyMatch[0], '').trim();
      }

      nama = rest.replace(/^[,\-\s:|]+|[,\-\s:|]+$/g, '').trim() || line;
    }

    nama = nama.replace(/^[,\-\s:|]+|[,\-\s:|]+$/g, '').trim();
    if (!nama) continue;

    items.push({
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      nama,
      kuantitas: kuantitas > 0 ? kuantitas : 1,
      satuan: satuan || undefined,
      hargaRencana,
      kategori: itemCategory,
      isPurchased: false,
    });
  }

  return items;
}

export function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { role } = useAuth();
  const { transactions: allTransactions, projects: allProjects, loading: globalLoading, addToast, triggerRefresh } = useApp();

  const project = React.useMemo(() => {
    return allProjects.find(p => p.id === id) || null;
  }, [allProjects, id]);

  const transactions = React.useMemo(() => {
    return allTransactions.filter(t => t.proyekId === id);
  }, [allTransactions, id]);

  const [filterType, setFilterType] = useState<'semua' | 'masuk' | 'keluar'>('semua');
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);

  // Edit Modal
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editNama, setEditNama] = useState('');
  const [editNomorSurat, setEditNomorSurat] = useState('');
  const [editKlien, setEditKlien] = useState('');
  const [editPemohonNama, setEditPemohonNama] = useState('');
  const [editPemohonJabatan, setEditPemohonJabatan] = useState('');
  const [editTeknisiPic, setEditTeknisiPic] = useState('');
  const [editAnggaran, setEditAnggaran] = useState('');
  const [editPdfFile, setEditPdfFile] = useState<File | null>(null);

  useEffect(() => {
    if (project) {
      setEditNama(project.nama);
      setEditNomorSurat(project.nomorSurat ?? '');
      setEditKlien(project.klien);
      setEditPemohonNama(project.pemohonNama ?? '');
      setEditPemohonJabatan(project.pemohonJabatan ?? '');
      setEditTeknisiPic(project.teknisiPic ?? '');
      setEditAnggaran(project.anggaran ? String(project.anggaran) : '');
      setEditPdfFile(null);
    }
  }, [project]);

  // Procurement Checklist
  const [newChecklistItem, setNewChecklistItem] = useState('');
  const [newChecklistKuantitas, setNewChecklistKuantitas] = useState('1');
  const [newChecklistSatuan, setNewChecklistSatuan] = useState('');
  const [newChecklistHargaRencana, setNewChecklistHargaRencana] = useState('');
  const [newChecklistKategori, setNewChecklistKategori] = useState('Operational Cost');
  
  const [editingHargaAktual, setEditingHargaAktual] = useState<string | null>(null);
  const [aktualHargaValue, setAktualHargaValue] = useState('');

  // Bulk Import Modal & Accordion State
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [importing, setImporting] = useState(false);
  const [procurementExpanded, setProcurementExpanded] = useState(() => {
    const saved = localStorage.getItem(`procurement_expanded_${id}`);
    return saved !== null ? saved === 'true' : true;
  });

  const toggleProcurementExpanded = () => {
    setProcurementExpanded(prev => {
      const next = !prev;
      localStorage.setItem(`procurement_expanded_${id}`, String(next));
      return next;
    });
  };

  // Refund & PDF Modal
  const [refundModalOpen, setRefundModalOpen] = useState(false);
  const [refundNominal, setRefundNominal] = useState('');
  const [refundDeskripsi, setRefundDeskripsi] = useState('');
  const [refundSaving, setRefundSaving] = useState(false);
  const [pdfModalOpen, setPdfModalOpen] = useState(false);

  // Batch Transaction Tagging State
  const [selectedTxIds, setSelectedTxIds] = useState<string[]>([]);
  const [batchPengajuanId, setBatchPengajuanId] = useState<string>('');
  const [batchSaving, setBatchSaving] = useState<boolean>(false);

  // Batch Procurement Item Tagging State
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [batchItemPengajuanId, setBatchItemPengajuanId] = useState<string>('');
  const [batchItemSaving, setBatchItemSaving] = useState<boolean>(false);

  const handleBatchTagTransactions = async () => {
    if (!batchPengajuanId || selectedTxIds.length === 0) return;
    setBatchSaving(true);
    try {
      await Promise.all(
        selectedTxIds.map(txId => updateTransaction(txId, { suratPengajuanId: batchPengajuanId }))
      );
      addToast('success', `Berhasil menautkan ${selectedTxIds.length} transaksi ke Surat Pengajuan!`);
      setSelectedTxIds([]);
      setBatchPengajuanId('');
      triggerRefresh();
    } catch {
      addToast('error', 'Gagal menautkan transaksi');
    } finally {
      setBatchSaving(false);
    }
  };

  const handleBatchTagProcurementItems = async () => {
    if (!project || !batchItemPengajuanId || selectedItemIds.length === 0) return;
    setBatchItemSaving(true);
    try {
      const items = (project.procurementItems || []).map(item =>
        selectedItemIds.includes(item.id) ? { ...item, suratPengajuanId: batchItemPengajuanId } : item
      );
      await updateProject(project.id, { procurementItems: items });
      addToast('success', `Berhasil menautkan ${selectedItemIds.length} item pengadaan ke Surat Pengajuan!`);
      setSelectedItemIds([]);
      setBatchItemPengajuanId('');
      triggerRefresh();
    } catch {
      addToast('error', 'Gagal menautkan item pengadaan');
    } finally {
      setBatchItemSaving(false);
    }
  };

  // AI Project Analysis
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState('');

  const handleProjectAiAnalysis = async () => {
    if (!project) return;
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    setAiLoading(true);
    setAiResult('');

    try {
      if (apiKey && apiKey.trim().length > 10) {
        try {
          const prompt = buildProjectAISummaryContext(project.nama, project.klien, project.anggaran || 0, transactions);
          const genAI = new GoogleGenerativeAI(apiKey);
          const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
          const result = await model.generateContent(prompt);
          const text = result.response.text();
          setAiResult(cleanTextPunctuation(text));
          addToast('success', 'Analisis AI Gemini 1.5 Flash untuk proyek berhasil dibuat!');
          return;
        } catch (err) {
          console.warn('Gemini 1.5 Flash API error, falling back:', err);
        }
      }

      // Smart Fallback Project AI Engine
      const summary = getProjectFinancialSummary(transactions, project.anggaran || 0);
      const percent = (project.anggaran && project.anggaran > 0) ? Math.round((summary.realisasiBersih / project.anggaran) * 100) : 0;

      const fallbackText = `Analisis Kesehatan Keuangan Proyek ${project.nama}

1. Status Modal & Realisasi Lapangan:
- Alokasi Modal Operasional: ${formatRupiah(summary.modalDisuntikkan)}
- Total Pengeluaran Lapangan: ${formatRupiah(summary.totalPengeluaran)}
- Pengembalian / Refund Uang: ${formatRupiah(summary.totalRefundMasuk)}
- Realisasi Bersih Terpakai: ${formatRupiah(summary.realisasiBersih)} (${percent}% dari anggaran)
- Sisa Dana Proyek: ${formatRupiah(summary.sisaDanaProyek)}

2. Evaluasi & Rekomendasi:
${summary.sisaDanaProyek >= 0 ? 'Penggunaan anggaran proyek berjalan sangat efisien dan masih dalam batas alokasi modal operasional. Pertahankan pencatatan bukti nota secara konsisten.' : 'Pengeluaran proyek telah melebihi alokasi modal awal. Disarankan untuk mengevaluasi kembali pos belanja lapangan bersama tim.'}`;

      setAiResult(cleanTextPunctuation(fallbackText));
      addToast('success', 'Analisis Kesehatan Proyek berhasil dibuat!');
    } finally {
      setAiLoading(false);
    }
  };

  if (globalLoading) return <LoadingSpinner size={32} />;

  if (!project) {
    return (
      <div className="max-w-xl mx-auto py-12 text-center space-y-4">
        <AlertTriangle size={48} className="mx-auto text-amber-500" />
        <h2 className="text-xl font-bold text-gray-800">Proyek Tidak Ditemukan</h2>
        <Button onClick={() => navigate('/proyek')} icon={<ArrowLeft size={16} />}>
          Kembali ke Daftar Proyek
        </Button>
      </div>
    );
  }

  // Financial Calculations using proper isolated project fund logic
  const anggaranModal = project.anggaran || 0;
  const financials = getProjectFinancialSummary(transactions, anggaranModal);
  const categoryBreakdown = getProjectCategoryBreakdown(transactions);

  // Target Invoice / Pagu Acuan
  const totalModalDinamis = project.anggaran || financials.modalDisuntikkan || 0;
  const labaProyeksi = (project.anggaran && project.anggaran > 0)
    ? (project.anggaran - financials.totalPengeluaran)
    : financials.labaRugiProyek;

  const usagePercentage = totalModalDinamis > 0 ? Math.min(Math.round((financials.totalPengeluaran / totalModalDinamis) * 100), 100) : 0;

  const filteredTx = transactions.filter(t => {
    if (filterType === 'masuk') return t.jenis === 'masuk';
    if (filterType === 'keluar') return t.jenis === 'keluar';
    return true;
  });

  const handleSaveEdit = async () => {
    if (!project) return;
    try {
      let pdfUrl = project.suratPengajuanPdf;
      if (editPdfFile) {
        const result = await uploadAttachmentFile(editPdfFile, {
          tanggal: project.tanggalMulai,
          proyekNama: editNama.trim(),
        });
        pdfUrl = result.dataUrl;
      }
      await updateProject(project.id, {
        nama: editNama.trim(),
        nomorSurat: editNomorSurat.trim() || undefined,
        klien: editKlien.trim(),
        pemohonNama: editPemohonNama.trim() || undefined,
        pemohonJabatan: editPemohonJabatan.trim() || undefined,
        teknisiPic: editTeknisiPic.trim() || undefined,
        anggaran: editAnggaran ? parseInt(editAnggaran.replace(/\D/g, ''), 10) || 0 : 0,
        suratPengajuanPdf: pdfUrl,
      });
      addToast('success', 'Detail proyek berhasil diperbarui');
      setEditModalOpen(false);
      triggerRefresh();
    } catch {
      addToast('error', 'Gagal mengupdate proyek');
    }
  };

  const handleAddChecklist = async () => {
    if (!project) return;
    if (!newChecklistItem.trim()) {
      addToast('error', 'Silakan isi nama barang/kebutuhan terlebih dahulu');
      return;
    }
    try {
      const items = project.procurementItems || [];
      const newItem: ProcurementItem = {
        id: Date.now().toString(),
        nama: newChecklistItem.trim(),
        kuantitas: parseInt(newChecklistKuantitas) || 1,
        satuan: newChecklistSatuan.trim() || undefined,
        hargaRencana: newChecklistHargaRencana ? parseInt(newChecklistHargaRencana.replace(/\D/g, '')) : undefined,
        kategori: newChecklistKategori || 'Operational Cost',
        isPurchased: false
      };
      await updateProject(project.id, {
        procurementItems: [...items, newItem]
      });
      setNewChecklistItem('');
      setNewChecklistKuantitas('1');
      setNewChecklistSatuan('');
      setNewChecklistHargaRencana('');
      setProcurementExpanded(true);
      localStorage.setItem(`procurement_expanded_${id}`, 'true');
      triggerRefresh();
      addToast('success', 'Item pengadaan berhasil ditambahkan');
    } catch {
      addToast('error', 'Gagal menambahkan checklist');
    }
  };

  const handleToggleChecklist = async (itemId: string, itemPurchased: boolean) => {
    if (!project) return;
    if (!itemPurchased) {
      setEditingHargaAktual(itemId);
      setAktualHargaValue('');
    } else {
      try {
        const items = (project.procurementItems || []).map(item => 
          item.id === itemId ? { ...item, isPurchased: false, hargaAktual: undefined } : item
        );
        await updateProject(project.id, { procurementItems: items });
        triggerRefresh();
      } catch {
        addToast('error', 'Gagal memperbarui status checklist');
      }
    }
  };

  const handleSaveHargaAktual = async (itemId: string) => {
    if (!project) return;
    try {
      const hAktual = aktualHargaValue ? parseInt(aktualHargaValue.replace(/\D/g, '')) : undefined;
      const items = (project.procurementItems || []).map(item => 
        item.id === itemId ? { ...item, isPurchased: true, hargaAktual: hAktual } : item
      );
      await updateProject(project.id, { procurementItems: items });
      setEditingHargaAktual(null);
      setAktualHargaValue('');
      triggerRefresh();
    } catch {
      addToast('error', 'Gagal menyimpan harga aktual');
    }
  };

  const handleToggleCancelChecklist = async (itemId: string, currentCancelled?: boolean) => {
    if (!project) return;
    try {
      const items = (project.procurementItems || []).map(item => 
        item.id === itemId ? { ...item, isCancelled: !currentCancelled, isPurchased: false } : item
      );
      await updateProject(project.id, { procurementItems: items });
      triggerRefresh();
      addToast('info', !currentCancelled ? 'Item ditandai dibatalkan / tidak dipakai' : 'Item diaktifkan kembali');
    } catch {
      addToast('error', 'Gagal mengubah status pembatalan item');
    }
  };

  const handleImportBulkText = async () => {
    if (!project) return;
    if (!importText.trim()) {
      addToast('error', 'Tempel teks daftar kebutuhan terlebih dahulu');
      return;
    }
    setImporting(true);
    try {
      const parsedItems = parseBulkImportText(importText);
      if (parsedItems.length === 0) {
        addToast('error', 'Tidak ada item yang dapat diproses. Cek format teks.');
        setImporting(false);
        return;
      }
      const existing = project.procurementItems || [];
      await updateProject(project.id, {
        procurementItems: [...existing, ...parsedItems]
      });
      setImportText('');
      setImportModalOpen(false);
      setProcurementExpanded(true);
      localStorage.setItem(`procurement_expanded_${id}`, 'true');
      triggerRefresh();
      addToast('success', `${parsedItems.length} item pengadaan berhasil di-import!`);
    } catch (err: any) {
      console.error('Failed to import bulk text:', err);
      addToast('error', `Gagal memproses import teks: ${err?.message || 'Terjadi kesalahan'}`);
    } finally {
      setImporting(false);
    }
  };

  const handleDeleteChecklist = async (itemId: string) => {
    if (!project) return;
    try {
      const items = (project.procurementItems || []).filter(item => item.id !== itemId);
      await updateProject(project.id, { procurementItems: items });
      triggerRefresh();
    } catch {
      addToast('error', 'Gagal menghapus checklist');
    }
  };

  const handleDeleteProject = async () => {
    if (window.confirm(`Yakin ingin menghapus proyek "${project.nama}"?`)) {
      try {
        await deleteProject(project.id);
        addToast('success', `Proyek "${project.nama}" dihapus`);
        navigate('/proyek');
        triggerRefresh();
      } catch {
        addToast('error', 'Gagal menghapus proyek');
      }
    }
  };

  const handleReactivateProject = async () => {
    if (!project) return;
    try {
      await updateProject(project.id, { status: 'aktif', tanggalSelesai: undefined });
      addToast('success', `Proyek "${project.nama}" diaktifkan kembali!`);
      triggerRefresh();
    } catch {
      addToast('error', 'Gagal mengaktifkan proyek');
    }
  };

  const handleCompleteProject = async () => {
    if (!project) return;
    try {
      await updateProject(project.id, { status: 'selesai', tanggalSelesai: new Date().toISOString().split('T')[0] });
      addToast('success', `Proyek "${project.nama}" ditandai selesai!`);
      triggerRefresh();
    } catch {
      addToast('error', 'Gagal menyelesaikan proyek');
    }
  };

  const handleDeleteTx = async (txId: string) => {
    if (window.confirm('Yakin ingin menghapus transaksi ini?')) {
      try {
        await deleteTransaction(txId);
        addToast('success', 'Transaksi berhasil dihapus');
        triggerRefresh();
      } catch {
        addToast('error', 'Gagal menghapus transaksi');
      }
    }
  };

  // REFUND: Tarik sisa dana proyek ke kas utama
  const handleRefundToKasUtama = async () => {
    if (financials.sisaDanaProyek <= 0) {
      addToast('error', 'Tidak ada sisa dana proyek untuk ditarik');
      return;
    }

    setRefundSaving(true);
    try {
      const sisaDana = financials.sisaDanaProyek;

      // 1. Record keluar from project pool (drain remaining funds)
      await addTransaction({
        tanggal: new Date().toISOString().split('T')[0],
        jenis: 'keluar',
        deskripsi: `Penarikan Sisa Dana Proyek: ${project.nama} → Kas Utama`,
        nominal: sisaDana,
        kategori: 'Refund Dana Proyek ke Kas Utama',
        tag: 'operasional',
        proyekId: project.id,
        lampiran: [],
        status: 'selesai',
      });

      // 2. Record masuk to kas utama (money flows back to main cash)
      await addTransaction({
        tanggal: new Date().toISOString().split('T')[0],
        jenis: 'masuk',
        deskripsi: `Refund Sisa Dana Proyek: ${project.nama} (${formatRupiah(sisaDana)})`,
        nominal: sisaDana,
        kategori: 'Refund Dana Proyek ke Kas Utama',
        lampiran: [],
        status: 'selesai',
      });

      addToast('success', `✅ Sisa dana ${formatRupiah(sisaDana)} berhasil ditarik ke Kas Utama!`);
      setRefundModalOpen(false);
      triggerRefresh();
    } catch {
      addToast('error', 'Gagal menarik sisa dana ke Kas Utama');
    } finally {
      setRefundSaving(false);
    }
  };



  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-fade-in pb-12">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-3xl border border-gray-100 shadow-card">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/proyek')}
            className="w-10 h-10 rounded-2xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-600 transition-all active:scale-95 flex-shrink-0"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-gray-900 tracking-tight">{project.nama}</h1>
              <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold ${project.status === 'aktif' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>
                {project.status === 'aktif' ? '● Aktif' : '✓ Selesai'}
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1.5">
              <Building2 size={13} className="text-gray-400" /> Klien: <strong className="text-gray-700">{project.klien}</strong> · Ditambahkan: {formatDate(project.tanggalMulai)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="secondary"
            size="sm"
            icon={aiLoading ? <LoadingSpinner size={14} /> : <Sparkles size={15} className="text-purple-600" />}
            onClick={handleProjectAiAnalysis}
            disabled={aiLoading}
          >
            {aiLoading ? 'Menganalisis...' : 'Analisis AI Proyek'}
          </Button>
          {project.suratPengajuanPdf && (
            <Button
              variant="secondary"
              size="sm"
              icon={<FileText size={15} className="text-blue-600" />}
              onClick={() => window.open(project.suratPengajuanPdf, '_blank')}
            >
              Lihat PDF Pengajuan
            </Button>
          )}
          <Button
            variant="secondary"
            size="sm"
            icon={<Download size={15} />}
            onClick={() => exportProjectRealisasiExcel(project, transactions)}
          >
            Export Excel Jurnal
          </Button>
          <Button
            variant="primary"
            size="sm"
            icon={<Printer size={15} />}
            onClick={() => setPdfModalOpen(true)}
          >
            Cetak PDF Realisasi
          </Button>
          {role === 'admin' && (
            <>
              {project.status === 'selesai' ? (
                <Button variant="secondary" size="sm" icon={<RotateCcw size={15} className="text-emerald-600" />} onClick={handleReactivateProject}>
                  Aktifkan Kembali
                </Button>
              ) : (
                <Button variant="secondary" size="sm" icon={<CheckCircle2 size={15} className="text-emerald-600" />} onClick={handleCompleteProject}>
                  Tandai Selesai
                </Button>
              )}
              <Button variant="secondary" size="sm" icon={<Edit3 size={15} />} onClick={() => setEditModalOpen(true)}>
                Edit
              </Button>
              <Button variant="danger" size="sm" icon={<Trash2 size={15} />} onClick={handleDeleteProject}>
                Hapus
              </Button>
            </>
          )}
        </div>
      </div>

      {/* AI Summary Banner Result for Project */}
      {aiResult && (
        <Card className="!p-6 bg-gradient-to-br from-purple-950 via-slate-900 to-slate-900 text-white rounded-3xl border border-purple-500/30 shadow-2xl animate-fade-in">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-white/10">
            <div className="flex items-center gap-2 text-purple-300 font-bold text-sm">
              <Sparkles size={18} className="text-purple-400" /> Executive Project AI Analysis
            </div>
            <span className="text-[10px] px-2.5 py-1 bg-purple-500/20 text-purple-300 rounded-full font-bold border border-purple-500/30">
              Gemini 1.5 Flash Vision Engine
            </span>
          </div>
          <div className="text-xs text-slate-200 leading-relaxed whitespace-pre-wrap font-medium">
            {aiResult}
          </div>
        </Card>
      )}

      {/* ====== PROCUREMENT CHECKLIST ====== */}
      <ProcurementChecklistSection
        project={project}
        transactions={transactions}
        onOpenImportModal={() => setImportModalOpen(true)}
        onUpdateProcurementItems={async (newItems) => {
          await updateProject(project.id, { procurementItems: newItems });
          triggerRefresh();
        }}
        addToast={addToast}
      />

      {/* ====== PROJECT FINANCIAL REPORT (Laporan Realisasi) ====== */}
      <Card className="!p-0 border border-gray-100 shadow-card overflow-hidden">
        <div className="p-5 bg-gradient-to-r from-slate-900 to-slate-800 text-white">
          <h2 className="text-base font-bold text-emerald-400 flex items-center gap-2 mb-1">
            📊 Laporan Keuangan & Realisasi Proyek
          </h2>
          <p className="text-xs text-slate-400">Dana proyek terpisah dari kas utama perusahaan</p>
        </div>

        <div className="p-5 space-y-5">
          {/* Summary Cards Row — P&L vs Cash Flow */}
          <div className={`grid gap-3 ${project.tipe === 'operasional_kantor' ? 'grid-cols-1 sm:grid-cols-3' : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5'}`}>
            {/* 1. Saldo Kas Proyek Saat Ini */}
            <div className="p-3.5 bg-slate-900 border border-slate-700 rounded-2xl min-w-0 shadow-sm">
              <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider mb-1 truncate">
                {project.tipe === 'operasional_kantor' ? 'Sisa Saldo Kas Ops' : 'Sisa Saldo Kas Proyek'}
              </p>
              <p className={`text-xs sm:text-sm lg:text-base font-extrabold tabular-nums whitespace-nowrap overflow-x-auto scrollbar-none ${financials.sisaDanaProyek >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {formatRupiah(financials.sisaDanaProyek)}
              </p>
              <p className="text-[10px] text-slate-400 truncate mt-0.5">Arus Kas / Likuiditas</p>
            </div>

            {/* Render Omset & P&L ONLY for Proyek Klien */}
            {project.tipe !== 'operasional_kantor' && (
              <>
                {/* 2. Laba - Rugi Proyek (P&L) */}
                <div className="p-3.5 bg-gradient-to-br from-emerald-900/30 to-teal-900/30 border border-emerald-500/40 rounded-2xl min-w-0 shadow-sm">
                  <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider mb-1 truncate">
                    {project.anggaran ? 'Proyeksi Laba (P&L)' : 'Laba - Rugi Proyek (P&L)'}
                  </p>
                  <p className={`text-xs sm:text-sm lg:text-base font-extrabold tabular-nums whitespace-nowrap overflow-x-auto scrollbar-none ${labaProyeksi >= 0 ? 'text-emerald-800' : 'text-red-700'}`}>
                    {labaProyeksi >= 0 ? '+' : ''}{formatRupiah(labaProyeksi)}
                  </p>
                  <p className="text-[10px] text-emerald-700 truncate mt-0.5">
                    {project.anggaran ? 'Target Invoice - Belanja' : 'Omzet Klien - Belanja'}
                  </p>
                </div>

                {/* 3. Target Invoice / Pendapatan Riil Klien */}
                <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-2xl min-w-0">
                  <p className="text-[10px] font-bold text-blue-700 uppercase tracking-wider mb-1 truncate">
                    {project.anggaran ? 'Target Invoice' : 'Invoice / Termin Klien'}
                  </p>
                  <p className="text-xs sm:text-sm lg:text-base font-extrabold text-blue-700 tabular-nums whitespace-nowrap overflow-x-auto scrollbar-none">
                    {project.anggaran && project.anggaran > 0 ? formatRupiah(project.anggaran) : financials.pemasukanKlien > 0 ? `+${formatRupiah(financials.pemasukanKlien)}` : 'Belum Set'}
                  </p>
                  <p className="text-[10px] text-blue-600 truncate mt-0.5">
                    {project.anggaran ? 'Acuan Tagihan Pekerjaan' : 'Omzet Riil Klien'}
                  </p>
                </div>
              </>
            )}

            {/* 4. Alokasi Modal Operasional (Transfer Internal) */}
            <div className="p-3.5 bg-purple-50 border border-purple-200 rounded-2xl min-w-0">
              <p className="text-[10px] font-bold text-purple-700 uppercase tracking-wider mb-1 truncate">
                {project.tipe === 'operasional_kantor' ? 'Pagu Modal Kantor' : 'Alokasi Modal Operasional'}
              </p>
              <p className="text-xs sm:text-sm lg:text-base font-extrabold text-purple-800 tabular-nums whitespace-nowrap overflow-x-auto scrollbar-none">
                {formatRupiah(financials.modalDisuntikkan)}
              </p>
              <p className="text-[10px] text-purple-600 truncate mt-0.5">Drop Modal Kas Admin</p>
            </div>

            {/* 5. Total Pengeluaran Riil */}
            <div className="p-3.5 bg-red-50 border border-red-200 rounded-2xl min-w-0">
              <p className="text-[10px] font-bold text-red-700 uppercase tracking-wider mb-1 truncate">Total Pengeluaran</p>
              <p className="text-xs sm:text-sm lg:text-base font-extrabold text-red-700 tabular-nums whitespace-nowrap overflow-x-auto scrollbar-none">{formatRupiah(financials.totalPengeluaran)}</p>
              <p className="text-[10px] text-red-600 truncate mt-0.5">Beban Lapangan & Material</p>
            </div>
          </div>

          {/* Usage Progress Bar */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-bold text-gray-700">Pemakaian Dana ({usagePercentage}%)</span>
              <span className="text-xs font-semibold text-gray-500">
                {formatRupiah(financials.realisasiBersih)} / {formatRupiah(totalModalDinamis)}
              </span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden p-0.5">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  usagePercentage > 90 ? 'bg-red-500' : usagePercentage > 75 ? 'bg-amber-500' : 'bg-emerald-500'
                }`}
                style={{ width: `${usagePercentage}%` }}
              />
            </div>
          </div>

          {/* Category Breakdown */}
          {categoryBreakdown.length > 0 && (
            <div>
              <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Komposisi Pengeluaran</h3>
              <div className="space-y-1.5">
                {categoryBreakdown.map(cat => (
                  <div key={cat.kategori} className="flex items-center gap-3">
                    <span className="text-xs text-gray-600 font-medium w-40 truncate">{cat.kategori}</span>
                    <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${cat.percentage}%` }} />
                    </div>
                    <span className="text-xs font-bold text-gray-700 w-24 text-right">{formatRupiah(cat.nominal)}</span>
                    <span className="text-[10px] text-gray-400 w-10 text-right">{cat.percentage}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Refund Button */}
          {financials.sisaDanaProyek > 0 && (
            <div className="pt-3 border-t border-gray-100">
              <button
                onClick={() => setRefundModalOpen(true)}
                className="w-full sm:w-auto px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95 shadow-md"
              >
                <ArrowUpRight size={15} /> Tarik Sisa Dana {formatRupiah(financials.sisaDanaProyek)} ke Kas Utama
              </button>
              <p className="text-[10px] text-gray-400 mt-1.5">Dana akan dipindahkan dari pool proyek kembali ke kas utama perusahaan</p>
            </div>
          )}
        </div>
      </Card>

      {/* Profit Overview (Owner) */}
      {role === 'owner' && (
        <Card className="!p-6 bg-slate-900 text-white rounded-3xl border border-white/10 shadow-2xl">
          <h2 className="text-base font-bold text-emerald-400 mb-4 flex items-center gap-2">
            👑 Profit Proyek (Owner Overview)
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div>
              <p className="text-xs text-slate-400 mb-1">Total Pemasukan Klien</p>
              <p className="text-2xl font-extrabold text-white">{formatRupiah(financials.pemasukanKlien)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400 mb-1">Realisasi Pengeluaran</p>
              <p className="text-2xl font-extrabold text-amber-400">{formatRupiah(financials.totalPengeluaran)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400 mb-1">Profit Proyek (P&L)</p>
              <p className={`text-2xl font-extrabold ${labaProyeksi >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {labaProyeksi >= 0 ? '+' : ''}{formatRupiah(labaProyeksi)}
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Transactions Section */}
      <Card className="!p-5 border border-gray-100 shadow-card">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5 pb-4 border-b border-gray-100">
          <div>
            <h2 className="text-base font-bold text-gray-900">Daftar Transaksi Proyek ({filteredTx.length})</h2>
            <p className="text-xs text-gray-500 mt-0.5">Pengeluaran & refund internal — TIDAK mempengaruhi kas utama</p>
          </div>

          <div className="flex flex-wrap items-center justify-between sm:justify-end gap-2 w-full sm:w-auto">
            <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl text-xs font-semibold overflow-x-auto max-w-full">
              <button
                onClick={() => setFilterType('semua')}
                className={`px-3 py-1.5 rounded-lg transition-all ${filterType === 'semua' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}
              >
                Semua
              </button>
              <button
                onClick={() => setFilterType('keluar')}
                className={`px-3 py-1.5 rounded-lg transition-all ${filterType === 'keluar' ? 'bg-white text-red-600 shadow-sm' : 'text-gray-500'}`}
              >
                Pengeluaran
              </button>
              <button
                onClick={() => setFilterType('masuk')}
                className={`px-3 py-1.5 rounded-lg transition-all ${filterType === 'masuk' ? 'bg-white text-emerald-600 shadow-sm' : 'text-gray-500'}`}
              >
                Refund / Masuk
              </button>
            </div>

            {role === 'admin' && (
              <Button
                variant="primary"
                size="sm"
                icon={<PlusCircle size={15} />}
                onClick={() => navigate(`/transaksi/baru?proyekId=${project.id}`)}
                className="w-full sm:w-auto justify-center"
              >
                + Input Transaksi
              </Button>
            )}
          </div>
        </div>

        {(() => {
          const displaySortedTx = groupAndSortTransactions(filteredTx, 'desc');
          if (displaySortedTx.length === 0) {
            return <EmptyState icon={<Layers size={28} />} title="Belum Ada Transaksi Proyek" description="Semua transaksi pengeluaran/refund proyek akan tampil di sini" />;
          }

          const injectionTxns = transactions
            .filter(t => t.proyekId === project.id && isCapitalInjectionTx(t))
            .sort((a, b) => new Date(a.tanggal).getTime() - new Date(b.tanggal).getTime());

          return (
            <div className="space-y-3">
              {/* Batch Action Floating Control Bar */}
              {selectedTxIds.length > 0 && injectionTxns.length > 0 && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 animate-fade-in mb-3 shadow-sm">
                  <div className="flex items-center gap-2 text-xs font-bold text-blue-900">
                    <CheckSquare size={16} className="text-blue-600" />
                    <span>{selectedTxIds.length} Transaksi Terpilih</span>
                  </div>
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <select
                      value={batchPengajuanId}
                      onChange={e => setBatchPengajuanId(e.target.value)}
                      className="px-3 py-1.5 bg-white border border-blue-300 text-blue-900 rounded-xl text-xs font-bold shadow-sm focus:outline-none"
                    >
                      <option value="">-- Pilih Surat Pengajuan Tujuan --</option>
                      {injectionTxns.map((inj, idx) => (
                        <option key={inj.id} value={inj.id}>
                          📄 Pengajuan #{idx + 1}: {inj.deskripsi.slice(0, 30)} ({formatDate(inj.tanggal)})
                        </option>
                      ))}
                    </select>
                    <Button
                      variant="primary"
                      size="sm"
                      disabled={!batchPengajuanId || batchSaving}
                      loading={batchSaving}
                      onClick={handleBatchTagTransactions}
                    >
                      📌 Tautkan ({selectedTxIds.length})
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setSelectedTxIds([])}
                    >
                      Batal
                    </Button>
                  </div>
                </div>
              )}

              {/* Transaction Rows with Checkboxes */}
              {displaySortedTx.map(tx => (
              <div
                key={tx.id}
                onClick={() => setSelectedTx(tx)}
                className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 border rounded-2xl transition-all cursor-pointer active:scale-[0.99] ${
                  selectedTxIds.includes(tx.id) ? 'bg-blue-50/80 border-blue-300 shadow-sm' : 'bg-gray-50/70 hover:bg-emerald-50/30 border-gray-100 hover:border-emerald-300'
                }`}
              >
                <div className="flex items-start sm:items-center gap-3 flex-1 min-w-0">
                  {injectionTxns.length > 0 && (
                    <div onClick={e => e.stopPropagation()} className="pt-0.5 sm:pt-0">
                      <input
                        type="checkbox"
                        checked={selectedTxIds.includes(tx.id)}
                        onChange={e => {
                          if (e.target.checked) {
                            setSelectedTxIds(prev => [...prev, tx.id]);
                          } else {
                            setSelectedTxIds(prev => prev.filter(i => i !== tx.id));
                          }
                        }}
                        className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-gray-300 cursor-pointer"
                      />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                        tx.jenis === 'masuk'
                          ? 'bg-blue-100 text-blue-700 border border-blue-200'
                          : tx.kategori === 'Refund Dana Proyek ke Kas Utama'
                          ? 'bg-purple-100 text-purple-700 border border-purple-200'
                          : 'bg-red-100 text-red-700'
                      }`}>
                        {tx.jenis === 'masuk' ? '📥 Refund / Dana Masuk' : tx.kategori === 'Refund Dana Proyek ke Kas Utama' ? '📤 Tarik ke Kas Utama' : '📤 Pengeluaran Proyek'}
                      </span>
                      {tx.suratPengajuanId && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200 flex items-center gap-1">
                          📌 TertaUt Pengajuan
                        </span>
                      )}
                      <span className="text-xs text-gray-500 font-medium">{formatDate(tx.tanggal)}</span>
                      <StatusBadge status={tx.status} />
                    </div>
                    <p className="font-bold text-gray-900 truncate text-sm">{tx.deskripsi}</p>
                    {tx.lampiran && tx.lampiran.length > 0 && (
                      <div className="pt-1.5 flex items-center gap-1.5 text-xs text-emerald-700 font-semibold">
                        <Paperclip size={13} className="text-emerald-600" />
                        <span>{tx.lampiran.length} Lampiran Struk</span>
                        <span className="text-[10px] text-gray-400 font-normal">· Klik untuk lihat foto</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-gray-200">
                  <span className={`font-extrabold text-base ${tx.jenis === 'masuk' ? 'text-emerald-600' : 'text-red-600'}`}>
                    {tx.jenis === 'masuk' ? '+' : '-'}{formatRupiah(tx.nominal)}
                  </span>

                  {role === 'admin' && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteTx(tx.id);
                      }}
                      className="text-gray-400 hover:text-red-500 p-1.5 rounded-xl hover:bg-red-50 transition-colors"
                      title="Hapus Transaksi"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
          );
        })()}
      </Card>

      {/* Edit Budget Modal */}
      <Modal isOpen={editModalOpen} onClose={() => setEditModalOpen(false)} title="Edit Detail & Anggaran Proyek">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              {project?.tipe === 'operasional_kantor' ? 'Nama Pos Operasional' : 'Nama Proyek'}
            </label>
            <input
              type="text"
              value={editNama}
              onChange={e => setEditNama(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary font-semibold"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Klien Utama / Instansi Tujuan</label>
              <input
                type="text"
                value={editKlien}
                onChange={e => setEditKlien(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary font-medium"
                placeholder="Contoh: DJKA Area Bogor dan Sukabumi"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">No. Surat Pengajuan (Opsional)</label>
              <input
                type="text"
                value={editNomorSurat}
                onChange={e => setEditNomorSurat(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary font-mono text-slate-800"
                placeholder="Contoh: 050/ARP/VII/OP/2026"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-200/80">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Pemohon / Leader Teknik</label>
              <input
                type="text"
                value={editPemohonNama}
                onChange={e => setEditPemohonNama(e.target.value)}
                className="w-full bg-white border border-gray-200 rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="Contoh: Rama Regawa Sri Anggayana"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">PIC Lapangan / Teknisi</label>
              <input
                type="text"
                value={editTeknisiPic}
                onChange={e => setEditTeknisiPic(e.target.value)}
                className="w-full bg-white border border-gray-200 rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="Contoh: Fauzan"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              {project?.tipe === 'operasional_kantor' ? 'Pagu Alokasi Modal Kantor (Rp)' : 'Target Invoice / Nilai Kontrak Pekerjaan (Rp)'}
            </label>
            <input
              type="text"
              value={editAnggaran ? new Intl.NumberFormat('id-ID').format(parseInt(editAnggaran.replace(/\D/g, '') || '0')) : ''}
              onChange={e => {
                const raw = e.target.value.replace(/\D/g, '');
                setEditAnggaran(raw);
              }}
              className="w-full border border-gray-200 rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary font-bold text-gray-900"
              placeholder={project?.tipe === 'operasional_kantor' ? 'Contoh: 15.000.000' : 'Contoh: 35.000.000'}
            />
            <p className="text-[10px] text-gray-400 mt-1">
              {project?.tipe === 'operasional_kantor' 
                ? 'Nominal pagu batas alokasi operasional kantor (acuan target).' 
                : 'Nominal nilai pekerjaan/invoice terencana untuk menghitung proyeksi laba & persentase terpakai.'}
            </p>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Dokumen Pengajuan / Kontrak (PDF, Opsional)
            </label>
            <input
              type="file"
              accept=".pdf,application/pdf"
              onChange={e => {
                const file = e.target.files?.[0];
                if (file) setEditPdfFile(file);
              }}
              className="w-full border border-gray-200 rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary file:mr-4 file:py-1 file:px-3 file:rounded-full file:border-0 file:text-[10px] file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
            {project?.suratPengajuanPdf && !editPdfFile && (
              <p className="text-[10px] text-slate-500 mt-1.5 italic">Proyek ini sudah memiliki dokumen PDF terlampir. Unggah file baru untuk menggantinya.</p>
            )}
          </div>

          <div className="flex gap-2 justify-end pt-3">
            <Button variant="secondary" size="sm" onClick={() => setEditModalOpen(false)}>Batal</Button>
            <Button variant="primary" size="sm" onClick={handleSaveEdit}>Simpan Perubahan</Button>
          </div>
        </div>
      </Modal>

      {/* Refund Confirmation Modal */}
      <Modal isOpen={refundModalOpen} onClose={() => setRefundModalOpen(false)} title="Tarik Sisa Dana Proyek ke Kas Utama">
        <div className="space-y-4">
          <div className="p-4 bg-slate-900 text-white rounded-2xl space-y-2">
            <p className="text-xs text-slate-400">Sisa dana proyek yang akan ditarik:</p>
            <p className="text-3xl font-extrabold text-emerald-400">{formatRupiah(financials.sisaDanaProyek)}</p>
            <p className="text-xs text-slate-400">Proyek: <strong className="text-white">{project.nama}</strong></p>
          </div>

          <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-800 font-medium space-y-1">
            <p className="font-bold">⚠️ Perhatian:</p>
            <ul className="list-disc list-inside space-y-0.5 text-amber-700">
              <li>Sisa dana proyek akan dipindahkan <strong>kembali ke Kas Utama</strong> perusahaan</li>
              <li>Saldo dana proyek akan menjadi <strong>Rp 0</strong></li>
              <li>Aksi ini akan tercatat di laporan kedua sisi (proyek & kas utama)</li>
            </ul>
          </div>

          <div className="flex gap-2 justify-end pt-2">
            <Button variant="secondary" size="sm" onClick={() => setRefundModalOpen(false)}>Batal</Button>
            <Button
              variant="primary"
              size="sm"
              icon={<ArrowUpRight size={15} />}
              loading={refundSaving}
              onClick={handleRefundToKasUtama}
            >
              Konfirmasi Tarik ke Kas Utama
            </Button>
          </div>
        </div>
      </Modal>

      {/* Transaction Detail & Edit Modal */}
      <TransactionDetailModal
        transaction={selectedTx}
        isOpen={!!selectedTx}
        onClose={() => setSelectedTx(null)}
        onUpdate={(updated) => {
          triggerRefresh();
          if (updated) setSelectedTx(updated);
        }}
      />

      {/* Modal Import Bulk Teks */}
      <Modal
        isOpen={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        title="Import Teks Praktis (Bulk Insert Pengadaan)"
      >
        <div className="space-y-4">
          <p className="text-xs text-gray-600 leading-relaxed">
            Tempel teks dari AI Assistant, WhatsApp, Excel, atau catatan Anda. Sistem otomatis memecah nama item, kuantitas, satuan, harga rencana (termasuk format 1.5jt, 50rb, Rp), serta kategori.
          </p>
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-[11px] font-mono text-slate-700 space-y-1">
            <p className="font-bold text-slate-900 mb-1">💡 Contoh Format Bebas yang Didukung:</p>
            <p className="text-blue-600 font-bold"># Transportasi & Akomodasi</p>
            <p>1. Sewa Mobil Inova, 2, Unit, 1.500.000</p>
            <p>2. Penginapan Mess Lapangan - 3 Malam - 1.2jt</p>
            <p className="text-blue-600 font-bold pt-1"># Material & Perlengkapan Fisik</p>
            <p>Semen Padang 10 sak Rp 75.000</p>
            <p>Crimping Ferrule : 10 box : 450rb</p>
            <p className="text-blue-600 font-bold pt-1"># Upah & Tenaga Kerja</p>
            <p>Upah Harian Tenaga Lapangan, 5, Orang, 2.500.000</p>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Tempel Teks Multi-baris:</label>
            <textarea
              rows={8}
              value={importText}
              onChange={e => setImportText(e.target.value)}
              placeholder="Paste teks daftar kebutuhan di sini (1 item per baris)..."
              className="w-full border border-gray-200 rounded-xl p-3 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
            <Button variant="secondary" size="sm" onClick={() => setImportModalOpen(false)}>
              Batal
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={importing ? <LoadingSpinner size={14} /> : <CheckSquare size={16} />}
              onClick={handleImportBulkText}
              disabled={importing || !importText.trim()}
            >
              {importing ? 'Memproses...' : 'Proses & Import Item'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Official PDF Realisasi Modal */}
      <PdfReportModal
        isOpen={pdfModalOpen}
        onClose={() => setPdfModalOpen(false)}
        title={`Laporan Realisasi & Pertanggungjawaban Dana Proyek`}
        subtitle={project.tipe === 'operasional_kantor' ? 'Dokumen Pertanggungjawaban Kas Operasional Internal' : 'Dokumen Realisasi Proyek Klien'}
        periodText={`Per ${formatDate(new Date().toISOString())}`}
        transactions={transactions}
        project={project}
      />
    </div>
  );
}
