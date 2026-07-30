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
  Download, ArrowUpRight, RotateCcw, Printer, Paperclip, Sparkles, FileText, CheckSquare, Square, ChevronDown, ChevronUp
} from 'lucide-react';
import { getProjectById, updateProject, deleteProject } from '../services/projectService';
import { getTransactionsByProject, addTransaction, deleteTransaction, groupAndSortTransactions } from '../services/transactionService';
import { getProjectFinancialSummary, getProjectCategoryBreakdown, buildProjectAISummaryContext, cleanTextPunctuation } from '../services/analyticsService';
import { exportProjectRealisasiExcel } from '../services/exportService';
import { uploadAttachmentFile } from '../services/storageService';
import { type Project, type Transaction, type ProcurementItem } from '../types';
import {
  Card, Button, StatusBadge, LoadingSpinner, EmptyState,
  formatRupiah, formatDate, AttachmentViewer, TransactionDetailModal, PdfReportModal
} from '../components/ui';
import { Modal } from '../components/ui/Modal';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';

function formatRupiahInput(value: string): string {
  const num = value.replace(/\D/g, '');
  if (!num) return '';
  return new Intl.NumberFormat('id-ID').format(Number(num));
}

function parseBulkImportText(text: string): ProcurementItem[] {
  if (!text || !text.trim()) return [];
  const lines = text.split('\n');
  const items: ProcurementItem[] = [];
  let currentCategory = 'Operational Cost';

  for (const rawLine of lines) {
    let line = rawLine.trim();
    if (!line) continue;

    // Detect if this line is a Category Header (starts with #, [, --- or ends with : without commas/pipes)
    const isHeaderLine =
      (line.startsWith('#') ||
        line.startsWith('[') ||
        line.startsWith('---') ||
        (line.endsWith(':') && !line.includes(','))) &&
      !line.includes('|');

    if (isHeaderLine) {
      let cleanCategory = line.replace(/^[#\-\[\:\*]+|[#\-\]\:\*]+$/g, '').trim();
      // Remove leading emojis if present (e.g. 🚗 Transportasi & Akomodasi -> Transportasi & Akomodasi)
      cleanCategory = cleanCategory.replace(/[\u{1F300}-\u{1F9FF}]/gu, '').trim();
      if (cleanCategory) {
        currentCategory = cleanCategory;
      }
      continue; // Skip adding header line as an item!
    }

    // Remove leading bullet points or numbers like "1.", "1)", "-", "*"
    line = line.replace(/^[\d+\.\-\*\)]+\s*/, '').trim();
    if (!line) continue;

    // Split by pipe '|', comma ',', or tab '\t'
    let parts: string[] = [];
    if (line.includes('|')) {
      parts = line.split('|').map(p => p.trim());
    } else if (line.includes(',')) {
      parts = line.split(',').map(p => p.trim());
    } else if (line.includes('\t')) {
      parts = line.split('\t').map(p => p.trim());
    } else {
      parts = [line];
    }

    const nama = parts[0] || 'Item Pengadaan';
    let kuantitas = 1;
    let satuan: string | undefined = undefined;
    let hargaRencana: number | undefined = undefined;
    let itemCategory = currentCategory;

    if (parts.length >= 2) {
      const qtyMatch = parts[1].match(/^(\d+)\s*(.*)$/);
      if (qtyMatch) {
        kuantitas = parseInt(qtyMatch[1]) || 1;
        if (qtyMatch[2] && qtyMatch[2].trim()) {
          satuan = qtyMatch[2].trim();
        }
      }
    }

    if (parts.length >= 3) {
      if (!satuan && parts[2] && !/^\d+$/.test(parts[2].replace(/\D/g, ''))) {
        satuan = parts[2].trim();
      } else if (!hargaRencana && parts[2]) {
        const num = parts[2].replace(/\D/g, '');
        if (num) hargaRencana = parseInt(num);
      }
    }

    if (parts.length >= 4 && hargaRencana === undefined) {
      const num = parts[3].replace(/\D/g, '');
      if (num) hargaRencana = parseInt(num);
    }

    if (parts.length >= 5 && parts[4]) {
      const catOverride = parts[4].replace(/[\u{1F300}-\u{1F9FF}]/gu, '').trim();
      if (catOverride) itemCategory = catOverride;
    }

    items.push({
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      nama,
      kuantitas,
      satuan,
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
  const { addToast, refreshKey } = useApp();

  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState<Project | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [filterType, setFilterType] = useState<'semua' | 'masuk' | 'keluar'>('semua');
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);

  // Edit Modal
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editNama, setEditNama] = useState('');
  const [editKlien, setEditKlien] = useState('');
  const [editPdfFile, setEditPdfFile] = useState<File | null>(null);

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
  const [procurementExpanded, setProcurementExpanded] = useState(true);

  // Refund & PDF Modal
  const [refundModalOpen, setRefundModalOpen] = useState(false);
  const [refundSaving, setRefundSaving] = useState(false);
  const [pdfModalOpen, setPdfModalOpen] = useState(false);

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

  const isFirstLoadRef = useRef(true);

  const loadProjectData = useCallback(async () => {
    if (!id) return;
    if (isFirstLoadRef.current) {
      setLoading(true);
    }
    try {
      const [prj, txs] = await Promise.all([
        getProjectById(id),
        getTransactionsByProject(id),
      ]);
      setProject(prj);
      setTransactions(txs);
      if (prj) {
        setEditNama(prj.nama);
        setEditKlien(prj.klien);
        setEditPdfFile(null);
      }
    } catch {
      addToast('error', 'Gagal memuat data proyek');
    } finally {
      if (isFirstLoadRef.current) {
        setLoading(false);
        isFirstLoadRef.current = false;
      }
    }
  }, [id, addToast]);

  useEffect(() => {
    loadProjectData();
  }, [loadProjectData, refreshKey]);

  if (loading) return <LoadingSpinner size={32} />;

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

  // Legacy compatibility
  const pemasukanKlien = transactions
    .filter(t => t.jenis === 'masuk' && t.status !== 'ditolak')
    .reduce((sum, t) => sum + t.nominal, 0);
  const profitNetto = pemasukanKlien - financials.realisasiBersih;
  const totalModalDinamis = financials.modalDisuntikkan || project.anggaran || 0;
  const usagePercentage = totalModalDinamis > 0 ? Math.min(Math.round((financials.realisasiBersih / totalModalDinamis) * 100), 100) : 0;

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
        klien: editKlien.trim(),
        anggaran: 0,
        suratPengajuanPdf: pdfUrl,
      });
      addToast('success', 'Detail proyek berhasil diperbarui');
      setEditModalOpen(false);
      loadProjectData();
    } catch {
      addToast('error', 'Gagal mengupdate proyek');
    }
  };

  const handleAddChecklist = async () => {
    if (!newChecklistItem.trim() || !project) return;
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
      loadProjectData();
      addToast('success', 'Item berhasil ditambahkan');
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
        loadProjectData();
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
      loadProjectData();
    } catch {
      addToast('error', 'Gagal menyimpan harga aktual');
    }
  };

  const handleImportBulkText = async () => {
    if (!importText.trim() || !project) return;
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
      loadProjectData();
      addToast('success', `${parsedItems.length} item pengadaan berhasil di-import!`);
    } catch {
      addToast('error', 'Gagal memproses import teks');
    } finally {
      setImporting(false);
    }
  };

  const handleDeleteChecklist = async (itemId: string) => {
    if (!project) return;
    try {
      const items = (project.procurementItems || []).filter(item => item.id !== itemId);
      await updateProject(project.id, { procurementItems: items });
      loadProjectData();
    } catch {
      addToast('error', 'Gagal menghapus checklist');
    }
  };

  const handleDeleteProject = async () => {
    if (window.confirm(`Yakin ingin menghapus proyek "${project.nama}"?`)) {
      try {
        await deleteProject(project.id);
        addToast('success', 'Proyek berhasil dihapus');
        navigate('/proyek');
      } catch {
        addToast('error', 'Gagal menghapus proyek');
      }
    }
  };

  const handleDeleteTx = async (txId: string) => {
    if (window.confirm('Yakin ingin menghapus transaksi ini?')) {
      try {
        await deleteTransaction(txId);
        addToast('success', 'Transaksi berhasil dihapus');
        loadProjectData();
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
      loadProjectData();
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
        <Card className="!p-5 border border-gray-100 shadow-card animate-fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 pb-3 border-b border-gray-100">
            <div>
              <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <CheckSquare className="text-blue-600" size={18} /> Daftar Kebutuhan Pengadaan
              </h2>
              <p className="text-xs text-gray-500 mt-1">Checklist *cross-check* kesesuaian belanja dengan surat pengajuan.</p>
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="secondary"
                size="sm"
                icon={<FileText size={15} className="text-purple-600" />}
                onClick={() => setImportModalOpen(true)}
              >
                Import Teks Praktis
              </Button>
              <button
                onClick={() => setProcurementExpanded(!procurementExpanded)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-semibold transition-colors border border-gray-200"
                title={procurementExpanded ? 'Kecilkan / Sembunyikan' : 'Buka Checklist'}
              >
                <span>{procurementExpanded ? 'Tutup' : 'Buka List'}</span>
                {procurementExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
              </button>
              {(() => {
                const items = project.procurementItems || [];
                const total = items.length;
                const purchased = items.filter(i => i.isPurchased).length;
                const pct = total === 0 ? 0 : Math.round((purchased / total) * 100);
                return (
                  <div className="flex flex-col items-end gap-1 ml-1">
                    <span className="text-xs font-bold text-gray-700">Progress: {purchased} / {total} Item ({pct}%)</span>
                    <div className="w-28 bg-gray-200 rounded-full h-2 overflow-hidden">
                      <div className={`h-full rounded-full transition-all duration-500 ${pct === 100 ? 'bg-emerald-500' : 'bg-blue-500'}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
  
          {procurementExpanded && (
            <div className="space-y-4 animate-fade-in">
            <div className="flex flex-col lg:flex-row gap-2">
              <input
                type="text"
                value={newChecklistItem}
                onChange={e => setNewChecklistItem(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddChecklist()}
                className="flex-[2] border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="Nama Barang (Cth: Semen)"
              />
              <div className="flex gap-1.5 flex-1 flex-wrap sm:flex-nowrap">
                <input
                  type="number"
                  min="1"
                  value={newChecklistKuantitas}
                  onChange={e => setNewChecklistKuantitas(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAddChecklist()}
                  className="w-14 border border-gray-200 rounded-xl px-2 py-2 text-sm text-center focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Qty"
                  title="Kuantitas"
                />
                <input
                  type="text"
                  value={newChecklistSatuan}
                  onChange={e => setNewChecklistSatuan(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAddChecklist()}
                  className="w-20 border border-gray-200 rounded-xl px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Satuan"
                  title="Satuan (Pcs, Sak, Unit, Roll, dll)"
                />
                <select
                  value={newChecklistKategori}
                  onChange={e => setNewChecklistKategori(e.target.value)}
                  className="border border-gray-200 rounded-xl px-2.5 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary bg-white text-gray-700 font-medium"
                >
                  <option value="Operational Cost">📦 Operational Cost</option>
                  <option value="Transportasi & Akomodasi">🚗 Transportasi & Akomodasi</option>
                  <option value="Material & Perlengkapan Fisik">🧱 Material & Perlengkapan Fisik</option>
                  <option value="Upah & Tenaga Kerja">👥 Upah & Tenaga Kerja</option>
                  <option value="Utilities">⚡ Utilities</option>
                  <option value="Overhead Cost">🏢 Overhead Cost</option>
                  <option value="Biaya Lain-Lain">📑 Biaya Lain-Lain</option>
                </select>
                <input
                  type="text"
                  value={newChecklistHargaRencana}
                  onChange={e => setNewChecklistHargaRencana(formatRupiahInput(e.target.value))}
                  onKeyDown={e => e.key === 'Enter' && handleAddChecklist()}
                  className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary min-w-[120px]"
                  placeholder="Harga Rencana (Rp)"
                />
              </div>
              <Button variant="primary" size="sm" onClick={handleAddChecklist} icon={<PlusCircle size={16} />} className="whitespace-nowrap">Tambah</Button>
            </div>
  
            {(() => {
              const items = project.procurementItems || [];
              if (items.length === 0) {
                return (
                  <div className="text-center py-6 text-sm text-gray-500 italic">
                    Belum ada item checklist. Tambahkan item di atas atau gunakan tombol Import Teks Praktis.
                  </div>
                );
              }

              // Group items by Category Segment
              const grouped = items.reduce((acc, item) => {
                const cat = item.kategori || 'Operational Cost';
                if (!acc[cat]) acc[cat] = [];
                acc[cat].push(item);
                return acc;
              }, {} as Record<string, ProcurementItem[]>);

              const categories = Object.keys(grouped);

              return (
                <div className="space-y-5 mt-4">
                  {categories.map(catName => {
                    const catItems = grouped[catName];
                    const catTotal = catItems.length;
                    const catPurchased = catItems.filter(i => i.isPurchased).length;
                    const catRencana = catItems.reduce((s, i) => s + (i.hargaRencana || 0), 0);
                    const catAktual = catItems.reduce((s, i) => s + (i.hargaAktual || 0), 0);

                    return (
                      <div key={catName} className="space-y-2 border border-gray-200/80 rounded-2xl p-4 bg-slate-50/50">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2 border-b border-gray-200 gap-1">
                          <div className="flex items-center gap-2">
                            <Layers size={16} className="text-blue-600" />
                            <h3 className="text-sm font-bold text-gray-800 tracking-tight">{catName}</h3>
                            <span className="text-[10px] font-bold px-2 py-0.5 bg-blue-100/70 text-blue-700 rounded-full border border-blue-200/60">
                              {catPurchased}/{catTotal} Item
                            </span>
                          </div>
                          {catRencana > 0 && (
                            <span className="text-[11px] font-medium text-gray-500">
                              Est: <strong className="text-gray-700">{formatRupiah(catRencana)}</strong>
                              {catAktual > 0 && <> · Realisasi: <strong className="text-emerald-700">{formatRupiah(catAktual)}</strong></>}
                            </span>
                          )}
                        </div>

                        <div className="grid grid-cols-1 gap-2 pt-1">
                          {catItems.map(item => (
                            <div key={item.id} className={`flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-xl border transition-all ${item.isPurchased ? 'bg-emerald-50/50 border-emerald-200' : 'bg-white border-gray-200 hover:border-gray-300'}`}>
                              <div 
                                className="flex items-start sm:items-center gap-3 cursor-pointer flex-1 min-w-0"
                                onClick={() => handleToggleChecklist(item.id, item.isPurchased)}
                              >
                                {item.isPurchased ? (
                                  <CheckSquare size={18} className="text-emerald-500 flex-shrink-0 mt-0.5 sm:mt-0" />
                                ) : (
                                  <Square size={18} className="text-gray-400 flex-shrink-0 mt-0.5 sm:mt-0" />
                                )}
                                <div className="flex flex-col">
                                  <span className={`text-sm font-medium ${item.isPurchased ? 'text-gray-400 line-through' : 'text-gray-700'}`}>
                                    {item.kuantitas} {item.satuan ? item.satuan : 'x'} {item.nama}
                                  </span>
                                  {item.hargaRencana !== undefined && (
                                    <span className={`text-[10px] ${item.isPurchased ? 'text-gray-400' : 'text-gray-500'}`}>
                                      Rencana: {formatRupiah(item.hargaRencana)}
                                    </span>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-center gap-2 mt-2 sm:mt-0 sm:ml-4 self-end sm:self-auto">
                                {editingHargaAktual === item.id ? (
                                  <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-blue-200 shadow-sm animate-fade-in">
                                    <span className="text-xs text-gray-500 ml-1">Rp</span>
                                    <input
                                      type="text"
                                      autoFocus
                                      value={aktualHargaValue}
                                      onChange={e => setAktualHargaValue(formatRupiahInput(e.target.value))}
                                      onKeyDown={e => e.key === 'Enter' && handleSaveHargaAktual(item.id)}
                                      className="w-24 text-sm border-none focus:outline-none focus:ring-0 py-0.5"
                                      placeholder="Aktual"
                                    />
                                    <button onClick={() => handleSaveHargaAktual(item.id)} className="p-1 bg-blue-100 text-blue-600 rounded-md hover:bg-blue-200">
                                      <CheckSquare size={14} />
                                    </button>
                                  </div>
                                ) : (
                                  item.isPurchased && item.hargaAktual !== undefined && (
                                    <div className="flex items-center gap-2 mr-2">
                                      <span className="text-xs font-semibold text-gray-700">Aktual: {formatRupiah(item.hargaAktual)}</span>
                                      {item.hargaRencana !== undefined && (
                                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                          item.hargaAktual < item.hargaRencana ? 'bg-emerald-100 text-emerald-700' :
                                          item.hargaAktual > item.hargaRencana ? 'bg-red-100 text-red-700' :
                                          'bg-gray-100 text-gray-600'
                                        }`}>
                                          {item.hargaAktual < item.hargaRencana ? `Hemat ${formatRupiah(item.hargaRencana - item.hargaAktual)}` :
                                           item.hargaAktual > item.hargaRencana ? `Over ${formatRupiah(item.hargaAktual - item.hargaRencana)}` :
                                           'Sesuai'}
                                        </span>
                                      )}
                                    </div>
                                  )
                                )}
                                
                                <button onClick={() => handleDeleteChecklist(item.id)} className="text-gray-300 hover:text-red-500 p-1.5 rounded-md transition-colors border border-transparent hover:bg-red-50">
                                  <Trash2 size={15} />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
          )}
        </Card>

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
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {/* 1. Saldo Kas Proyek Saat Ini */}
            <div className="p-3.5 bg-slate-900 border border-slate-700 rounded-2xl min-w-0 shadow-sm">
              <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider mb-1 truncate">Sisa Saldo Kas Proyek</p>
              <p className={`text-xs sm:text-sm lg:text-base font-extrabold tabular-nums whitespace-nowrap overflow-x-auto scrollbar-none ${financials.sisaDanaProyek >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {formatRupiah(financials.sisaDanaProyek)}
              </p>
              <p className="text-[10px] text-slate-400 truncate mt-0.5">Arus Kas / Likuiditas</p>
            </div>

            {/* 2. Laba - Rugi Proyek (P&L) */}
            <div className="p-3.5 bg-gradient-to-br from-emerald-900/30 to-teal-900/30 border border-emerald-500/40 rounded-2xl min-w-0 shadow-sm">
              <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider mb-1 truncate">Laba - Rugi Proyek (P&L)</p>
              <p className={`text-xs sm:text-sm lg:text-base font-extrabold tabular-nums whitespace-nowrap overflow-x-auto scrollbar-none ${financials.labaRugiProyek >= 0 ? 'text-emerald-800' : 'text-red-700'}`}>
                {financials.labaRugiProyek >= 0 ? '+' : ''}{formatRupiah(financials.labaRugiProyek)}
              </p>
              <p className="text-[10px] text-emerald-700 truncate mt-0.5">Omzet Klien - Pengeluaran</p>
            </div>

            {/* 3. Pendapatan Riil Klien */}
            <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-2xl min-w-0">
              <p className="text-[10px] font-bold text-blue-700 uppercase tracking-wider mb-1 truncate">Invoice / Termin Klien</p>
              <p className="text-xs sm:text-sm lg:text-base font-extrabold text-blue-700 tabular-nums whitespace-nowrap overflow-x-auto scrollbar-none">+{formatRupiah(financials.pemasukanKlien)}</p>
              <p className="text-[10px] text-blue-600 truncate mt-0.5">Omzet Riil Klien</p>
            </div>

            {/* 4. Alokasi Modal Operasional (Transfer Internal) */}
            <div className="p-3.5 bg-purple-50 border border-purple-200 rounded-2xl min-w-0">
              <p className="text-[10px] font-bold text-purple-700 uppercase tracking-wider mb-1 truncate">Alokasi Modal Operasional</p>
              <p className="text-xs sm:text-sm lg:text-base font-extrabold text-purple-800 tabular-nums whitespace-nowrap overflow-x-auto scrollbar-none">{formatRupiah(financials.modalDisuntikkan)}</p>
              <p className="text-[10px] text-purple-600 truncate mt-0.5">Transfer Internal</p>
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
              <p className="text-2xl font-extrabold text-white">{formatRupiah(pemasukanKlien)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400 mb-1">Realisasi Pengeluaran</p>
              <p className="text-2xl font-extrabold text-amber-400">{formatRupiah(financials.realisasiBersih)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400 mb-1">Profit Bersih (Cuan)</p>
              <p className={`text-2xl font-extrabold ${profitNetto >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {profitNetto >= 0 ? '+' : ''}{formatRupiah(profitNetto)}
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

          return (
            <div className="space-y-3">
              {displaySortedTx.map(tx => (
              <div
                key={tx.id}
                onClick={() => setSelectedTx(tx)}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-gray-50/70 hover:bg-emerald-50/30 border border-gray-100 hover:border-emerald-300 rounded-2xl transition-all cursor-pointer active:scale-[0.99]"
              >
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

                <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-gray-200">
                  <span className={`font-extrabold text-base ${tx.jenis === 'masuk' ? 'text-emerald-600' : 'text-red-600'}`}>
                    {tx.jenis === 'masuk' ? '+' : '-'}{formatRupiah(tx.nominal)}
                  </span>

                  {role === 'admin' && (
                    <button
                      onClick={() => handleDeleteTx(tx.id)}
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
            <label className="block text-xs font-semibold text-gray-700 mb-1">Nama Proyek</label>
            <input
              type="text"
              value={editNama}
              onChange={e => setEditNama(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Nama Klien</label>
            <input
              type="text"
              value={editKlien}
              onChange={e => setEditKlien(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
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
          loadProjectData();
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
            Tempel teks dari AI Assistant / catatan Anda (1 item per baris). Sistem akan otomatis memecah nama, kuantitas, satuan, dan harga rencana.
          </p>
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-[11px] font-mono text-slate-700 space-y-1">
            <p className="font-bold text-slate-900 mb-1">Contoh Format Pemisah Header Kategori (#):</p>
            <p className="text-blue-600 font-bold"># Transportasi & Akomodasi</p>
            <p>Sewa Mobil Inova, 2, Unit, 1.500.000</p>
            <p>Penginapan Mess Lapangan, 3, Malam, 1.200.000</p>
            <p className="text-blue-600 font-bold pt-1"># Material & Perlengkapan Fisik</p>
            <p>Crimping Ferrule & Rompi, 10, Box, 450.000</p>
            <p className="text-blue-600 font-bold pt-1"># Upah & Tenaga Kerja</p>
            <p>Upah Harian Tenaga Lapangan, 5, Orang, 2.500.000</p>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Tempel Teks Multi-baris:</label>
            <textarea
              rows={8}
              value={importText}
              onChange={e => setImportText(e.target.value)}
              placeholder="Paste teks daftar kebutuhan di sini..."
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
        subtitle={`Klien: ${project.klien}`}
        periodText={`Per ${formatDate(new Date().toISOString())}`}
        transactions={transactions}
        project={project}
      />
    </div>
  );
}
