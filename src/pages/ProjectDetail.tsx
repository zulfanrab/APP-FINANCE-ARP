// ============================================================
// ARKA Finance — Project Financial Hub / Detail Page
// Includes: Project Fund Isolation, Realisasi Report, Refund Flow, Excel Export
// ============================================================

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { GoogleGenerativeAI } from '@google/generative-ai';
import {
  ArrowLeft, Wallet, TrendingUp, TrendingDown, PlusCircle,
  Clock, CheckCircle2, AlertTriangle, Layers, Calendar, User,
  Building2, Trash2, Edit3, PieChart as PieIcon, ExternalLink,
  Download, ArrowUpRight, RotateCcw, Printer, Paperclip, Sparkles
} from 'lucide-react';
import { getProjectById, updateProject, deleteProject } from '../services/projectService';
import { getTransactionsByProject, addTransaction, deleteTransaction, groupAndSortTransactions } from '../services/transactionService';
import { getProjectFinancialSummary, getProjectCategoryBreakdown, buildProjectAISummaryContext, cleanTextPunctuation } from '../services/analyticsService';
import { exportProjectRealisasiExcel } from '../services/exportService';
import { type Project, type Transaction } from '../types';
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

export function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { role } = useAuth();
  const { addToast } = useApp();

  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState<Project | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [filterType, setFilterType] = useState<'semua' | 'masuk' | 'keluar'>('semua');
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);

  // Edit Budget Modal
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editBudgetStr, setEditBudgetStr] = useState('');
  const [editNama, setEditNama] = useState('');
  const [editKlien, setEditKlien] = useState('');

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

  const loadProjectData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
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
        setEditBudgetStr(prj.anggaran ? new Intl.NumberFormat('id-ID').format(prj.anggaran) : '0');
      }
    } catch {
      addToast('error', 'Gagal memuat data proyek');
    } finally {
      setLoading(false);
    }
  }, [id, addToast]);

  useEffect(() => {
    loadProjectData();
  }, [loadProjectData]);

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
  const usagePercentage = anggaranModal > 0 ? Math.min(Math.round((financials.realisasiBersih / anggaranModal) * 100), 100) : 0;

  const filteredTx = transactions.filter(t => {
    if (filterType === 'masuk') return t.jenis === 'masuk';
    if (filterType === 'keluar') return t.jenis === 'keluar';
    return true;
  });

  const handleSaveEdit = async () => {
    const numericBudget = Number(editBudgetStr.replace(/\D/g, ''));
    try {
      await updateProject(project.id, {
        nama: editNama.trim(),
        klien: editKlien.trim(),
        anggaran: numericBudget,
      });
      addToast('success', 'Detail proyek & anggaran berhasil diperbarui');
      setEditModalOpen(false);
      loadProjectData();
    } catch {
      addToast('error', 'Gagal mengupdate proyek');
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
              <p className={`text-sm sm:text-base lg:text-lg font-extrabold truncate tabular-nums ${financials.sisaDanaProyek >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {formatRupiah(financials.sisaDanaProyek)}
              </p>
              <p className="text-[10px] text-slate-400 truncate mt-0.5">Arus Kas / Likuiditas</p>
            </div>

            {/* 2. Laba - Rugi Proyek (P&L) */}
            <div className="p-3.5 bg-gradient-to-br from-emerald-900/30 to-teal-900/30 border border-emerald-500/40 rounded-2xl min-w-0 shadow-sm">
              <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider mb-1 truncate">Laba - Rugi Proyek (P&L)</p>
              <p className={`text-sm sm:text-base lg:text-lg font-extrabold truncate tabular-nums ${financials.labaRugiProyek >= 0 ? 'text-emerald-800' : 'text-red-700'}`}>
                {financials.labaRugiProyek >= 0 ? '+' : ''}{formatRupiah(financials.labaRugiProyek)}
              </p>
              <p className="text-[10px] text-emerald-700 truncate mt-0.5">Omzet Klien - Pengeluaran</p>
            </div>

            {/* 3. Pendapatan Riil Klien */}
            <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-2xl min-w-0">
              <p className="text-[10px] font-bold text-blue-700 uppercase tracking-wider mb-1 truncate">Invoice / Termin Klien</p>
              <p className="text-sm sm:text-base lg:text-lg font-extrabold text-blue-700 truncate tabular-nums">+{formatRupiah(financials.pemasukanKlien)}</p>
              <p className="text-[10px] text-blue-600 truncate mt-0.5">Omzet Riil Klien</p>
            </div>

            {/* 4. Alokasi Modal Operasional (Transfer Internal) */}
            <div className="p-3.5 bg-purple-50 border border-purple-200 rounded-2xl min-w-0">
              <p className="text-[10px] font-bold text-purple-700 uppercase tracking-wider mb-1 truncate">Alokasi Modal Operasional</p>
              <p className="text-sm sm:text-base lg:text-lg font-extrabold text-purple-800 truncate tabular-nums">{formatRupiah(financials.modalDisuntikkan)}</p>
              <p className="text-[10px] text-purple-600 truncate mt-0.5">Transfer Internal</p>
            </div>

            {/* 5. Total Pengeluaran Riil */}
            <div className="p-3.5 bg-red-50 border border-red-200 rounded-2xl min-w-0">
              <p className="text-[10px] font-bold text-red-700 uppercase tracking-wider mb-1 truncate">Total Pengeluaran</p>
              <p className="text-sm sm:text-base lg:text-lg font-extrabold text-red-700 truncate tabular-nums">{formatRupiah(financials.totalPengeluaran)}</p>
              <p className="text-[10px] text-red-600 truncate mt-0.5">Beban Lapangan & Material</p>
            </div>
          </div>

          {/* Usage Progress Bar */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-bold text-gray-700">Pemakaian Dana ({usagePercentage}%)</span>
              <span className="text-xs font-semibold text-gray-500">
                {formatRupiah(financials.realisasiBersih)} / {formatRupiah(anggaranModal)}
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
            <label className="block text-xs font-semibold text-gray-700 mb-1">Anggaran Modal Operasional (Rp)</label>
            <input
              type="text"
              inputMode="numeric"
              value={editBudgetStr}
              onChange={e => setEditBudgetStr(formatRupiahInput(e.target.value))}
              className="w-full border border-gray-200 rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary font-bold text-emerald-700"
            />
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
        onUpdate={loadProjectData}
      />

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
