// ============================================================
// ARKA Finance — Reports Page
// Includes Dual Export Options: Professional Accounting Excel (Jurnal) & Printable PDF KOP Surat
// ============================================================

import React, { useState, useEffect, useCallback } from 'react';
import {
  BarChart2, Download, Sparkles, Loader2, CalendarRange, TrendingUp, Printer, FileText
} from 'lucide-react';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend,
  LineChart, Line, XAxis, YAxis, CartesianGrid
} from 'recharts';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { getTransactions } from '../services/transactionService';
import { getProjects } from '../services/projectService';
import {
  getCategoryBreakdown, getCashflowTrend, buildAISummaryContext, cleanTextPunctuation, isMutasiInternal, isOmzetKlien, isOmzetRil, isOmzetSemu
} from '../services/analyticsService';
import { exportAccountingJournalExcel } from '../services/exportService';
import { type Transaction, type Project } from '../types';
import { Card, Button, LoadingSpinner, formatRupiah, formatDate, PdfReportModal } from '../components/ui';
import { useApp } from '../context/AppContext';

type PeriodType = 'bulan_ini' | '3_bulan' | 'custom';

const PIE_COLORS = ['#299775', '#DEB660', '#3b82f6', '#ef4444', '#8b5cf6', '#f59e0b', '#06b6d4', '#84cc16'];

const RUPIAH_TOOLTIP = ({ active, payload }: any) => {
  if (active && payload?.length) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl px-3 py-2 shadow-lg text-xs">
        <p className="font-medium">{payload[0].payload.kategori || payload[0].name}</p>
        <p className="text-gray-600">{formatRupiah(payload[0].value)}</p>
      </div>
    );
  }
  return null;
};

export function Reports() {
  const { transactions: allTransactions, projects, loading: globalLoading, addToast } = useApp();

  // Period
  type ReportPeriod = 'bulan_ini' | 'bulan_lalu' | 'pilih_bulan' | '3_bulan' | 'custom';
  const [period, setPeriod] = useState<ReportPeriod>('bulan_ini');
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [omzetTab, setOmzetTab] = useState<'semua' | 'riil' | 'semu'>('semua');

  // AI & PDF
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState('');
  const [pdfModalOpen, setPdfModalOpen] = useState(false);

  const getPeriodDates = useCallback((): { from: Date; to: Date } => {
    const now = new Date();
    if (period === 'bulan_ini') {
      return {
        from: new Date(now.getFullYear(), now.getMonth(), 1),
        to: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999),
      };
    }
    if (period === 'bulan_lalu') {
      return {
        from: new Date(now.getFullYear(), now.getMonth() - 1, 1),
        to: new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999),
      };
    }
    if (period === 'pilih_bulan' && selectedMonth) {
      const [y, m] = selectedMonth.split('-').map(Number);
      return {
        from: new Date(y, m - 1, 1),
        to: new Date(y, m, 0, 23, 59, 59, 999),
      };
    }
    if (period === '3_bulan') {
      return {
        from: new Date(now.getFullYear(), now.getMonth() - 2, 1),
        to: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999),
      };
    }
    if (period === 'custom' && customFrom && customTo) {
      const to = new Date(customTo);
      to.setHours(23, 59, 59, 999);
      return { from: new Date(customFrom), to };
    }
    return {
      from: new Date(now.getFullYear(), now.getMonth(), 1),
      to: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999),
    };
  }, [period, selectedMonth, customFrom, customTo]);

  const { categoryData, cashflowData, summary, omzetRilTx, omzetSemuTx, periodTransactions } = React.useMemo(() => {
    if (allTransactions.length === 0) {
      return { categoryData: [], cashflowData: [], summary: null, omzetRilTx: [], omzetSemuTx: [], periodTransactions: [] };
    }

    const { from, to } = getPeriodDates();
    const cats = getCategoryBreakdown(allTransactions, from, to);
    const cashflow = getCashflowTrend(allTransactions, from, to);

    // Summary for period — KAS OPERASIONAL & PERTANGGUNGJAWABAN
    const periodTx = allTransactions.filter(t => {
      const d = new Date(t.tanggal);
      const approved = t.status === 'disetujui' || t.status === 'selesai';
      if (!approved || d < from || d > to) return false;
      return true;
    });

    let totalMasuk = 0, dropDanaOwner = 0, omzetKlien = 0, totalKeluar = 0, opsBiaya = 0, privBiaya = 0;
    let adminDivisiBiaya = 0, itDivisiBiaya = 0, ahliDivisiBiaya = 0;

    const rList: Transaction[] = [];
    const sList: Transaction[] = [];

    for (const t of periodTx) {
      if (t.jenis === 'masuk') {
        totalMasuk += t.nominal;
        if (isOmzetRil(t)) {
          omzetKlien += t.nominal;
          rList.push(t);
        } else {
          dropDanaOwner += t.nominal;
          sList.push(t);
        }
      } else {
        if (!isMutasiInternal(t)) {
          totalKeluar += t.nominal;
          if (t.tag === 'operasional') opsBiaya += t.nominal;
          if (t.tag === 'pribadi') privBiaya += t.nominal;
        }

        const proj = projects.find(p => p.id === t.proyekId);
        const isKasUtamaOrOps = !t.proyekId || proj?.tipe === 'operasional_kantor';
        
        if (isKasUtamaOrOps) {
          if (t.divisi === 'admin' || proj?.nama.toLowerCase().includes('admin')) adminDivisiBiaya += t.nominal;
          else if (t.divisi === 'it' || proj?.nama.toLowerCase().includes('it')) itDivisiBiaya += t.nominal;
          else if (t.divisi === 'ahli' || proj?.nama.toLowerCase().includes('ahli')) ahliDivisiBiaya += t.nominal;
        }
      }
    }

    const netPnL = omzetKlien - totalKeluar;

    const summaryObj = {
      totalMasuk,
      dropDanaOwner,
      omzetKlien,
      totalKeluar,
      opsBiaya,
      privBiaya,
      adminDivisiBiaya,
      itDivisiBiaya,
      ahliDivisiBiaya,
      net: netPnL,
      count: periodTx.length,
      omzetRilCount: rList.length,
      omzetSemuCount: sList.length,
    };

    return {
      categoryData: cats,
      cashflowData: cashflow,
      summary: summaryObj,
      omzetRilTx: rList,
      omzetSemuTx: sList,
      periodTransactions: periodTx,
    };
  }, [allTransactions, projects, getPeriodDates]);

  const handleAiSummary = async () => {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    setAiLoading(true);
    setAiResult('');
    try {
      const { from, to } = getPeriodDates();
      const prevFrom = new Date(from);
      prevFrom.setMonth(prevFrom.getMonth() - 1);
      const prevTo = new Date(from);
      prevTo.setDate(prevTo.getDate() - 1);
      const prevTx = allTransactions.filter(t => {
        const d = new Date(t.tanggal);
        return d >= prevFrom && d <= prevTo;
      });

      if (apiKey && apiKey.trim().length > 10) {
        try {
          const prompt = buildAISummaryContext(allTransactions, from, to, prevTx);
          const genAI = new GoogleGenerativeAI(apiKey);
          const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
          const result = await model.generateContent(prompt);
          const text = result.response.text();
          setAiResult(cleanTextPunctuation(text));
          addToast('success', 'Ringkasan AI Gemini 1.5 Flash berhasil dibuat!');
          return;
        } catch (apiErr: any) {
          console.warn('Gemini API call failed, switching to Smart AI Engine:', apiErr);
        }
      }

      // Smart Fallback Financial AI Engine (Clean Text without Markdown Symbols)
      const sum = summary || {
        totalMasuk: 0,
        omzetKlien: 0,
        dropDanaOwner: 0,
        totalKeluar: 0,
        opsBiaya: 0,
        privBiaya: 0,
        net: 0,
      };
      const margin = sum.omzetKlien > 0 ? Math.round(((sum.omzetKlien - sum.totalKeluar) / sum.omzetKlien) * 100) : 0;
      const topCat = categoryData.length > 0 ? categoryData[0] : null;
      const privePercent = sum.totalKeluar > 0 ? Math.round((sum.privBiaya / sum.totalKeluar) * 100) : 0;

      const fallbackText = `Analisis & Executive Summary Keuangan PT Aksara Riksa Perdana

1. Kinerja & Audit Omzet Usaha:
- Total Pemasukan Kas: ${formatRupiah(sum.totalMasuk)}
- 💰 Omzet Riil Klien (P&L): ${formatRupiah(sum.omzetKlien)} (${sum.totalMasuk > 0 ? Math.round((sum.omzetKlien / sum.totalMasuk) * 100) : 0}% dari Total Pemasukan)
- 📥 Omzet Semu / Drop Dana: ${formatRupiah(sum.dropDanaOwner)} (${sum.totalMasuk > 0 ? Math.round((sum.dropDanaOwner / sum.totalMasuk) * 100) : 0}% Pemasukan Non-Omzet / Transfer)

2. Kinerja Beban & Laba Bersih P&L:
- Total Pengeluaran: ${formatRupiah(sum.totalKeluar)} (Operasional: ${formatRupiah(sum.opsBiaya)} | Prive Owner: ${formatRupiah(sum.privBiaya)})
- Laba Bersih Usaha (Omzet Riil - Pengeluaran): ${sum.net >= 0 ? '+' : ''}${formatRupiah(sum.net)} (${margin}% Net Profit Margin)

3. Sorotan Audit & Rekomendasi:
${topCat ? `- Pengeluaran terbesar tercatat pada kategori ${topCat.kategori} sebesar ${formatRupiah(topCat.nominal)} (${topCat.percentage}% dari total pengeluaran).` : '- Belum ada pengeluaran signifikan tercatat pada periode ini.'}
- Pengambilan Prive Owner menyerap ${privePercent}% dari total pengeluaran periode ini.
${sum.net >= 0 ? 'Arus kas dan Laba Bersih P&L Sehat. Pertahankan rasio Omzet Riil terhadap total penerimaan agar tidak tergantung pada drop dana modal.' : 'Laba bersih P&L defisit pada periode ini. Percepat pelunasan invoice klien dan batasi pengeluaran non-operasional.'}`;

      setAiResult(cleanTextPunctuation(fallbackText));
      addToast('success', 'Ringkasan Analisis Keuangan berhasil dibuat!');
    } finally {
      setAiLoading(false);
    }
  };

  const handleExportExcel = () => {
    const { from, to } = getPeriodDates();
    const periodText = `${formatDate(from.toISOString())} - ${formatDate(to.toISOString())}`;

    exportAccountingJournalExcel({
      title: 'Laporan Keuangan & Jurnal Akuntansi Konsolidasi',
      periodText,
      transactions: periodTransactions,
      projects,
      isConsolidated: true,
    });

    addToast('success', 'Jurnal Akuntansi Excel Konsolidasi berhasil didownload!');
  };

  if (globalLoading) return <LoadingSpinner size={32} />;

  const { from, to } = getPeriodDates();
  const periodTextStr = `${formatDate(from.toISOString())} - ${formatDate(to.toISOString())}`;

  return (
    <div className="space-y-6 animate-fade-in pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-3xl border border-gray-100 shadow-card">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Laporan Keuangan</h1>
          <p className="text-xs text-gray-500 mt-0.5">Analisis omzet riil vs semu, arus kas &amp; ekspor laporan resmi</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" icon={<Download size={15} />} onClick={handleExportExcel}>
            Export Excel Jurnal
          </Button>
          <Button variant="primary" size="sm" icon={<Printer size={15} />} onClick={() => setPdfModalOpen(true)}>
            Cetak PDF / KOP Surat
          </Button>
          <Button variant="accent" size="sm" icon={aiLoading ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />} onClick={handleAiSummary} disabled={aiLoading}>
            {aiLoading ? 'Membuat...' : 'AI Gemini Analisis'}
          </Button>
        </div>
      </div>

      {/* Period Selector Toolbar */}
      <Card className="!p-4 bg-white border border-gray-100 shadow-card">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <CalendarRange size={16} className="text-primary" />
            <span className="text-xs font-bold text-gray-700">Filter Periode:</span>
          </div>

          <button
            onClick={() => setPeriod('bulan_ini')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              period === 'bulan_ini' ? 'bg-primary text-white shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            📅 Bulan Ini
          </button>

          <button
            onClick={() => setPeriod('bulan_lalu')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              period === 'bulan_lalu' ? 'bg-primary text-white shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            ⏮️ Bulan Lalu
          </button>

          <button
            onClick={() => setPeriod('pilih_bulan')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              period === 'pilih_bulan' ? 'bg-primary text-white shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            🗓️ Pilih Bulan
          </button>

          {period === 'pilih_bulan' && (
            <div className="flex items-center gap-2 animate-fade-in">
              <input
                type="month"
                value={selectedMonth}
                onChange={e => setSelectedMonth(e.target.value)}
                className="border border-gray-300 rounded-xl px-3 py-1 text-xs font-bold text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-primary shadow-xs"
              />
            </div>
          )}

          <button
            onClick={() => setPeriod('3_bulan')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              period === '3_bulan' ? 'bg-primary text-white shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            📊 3 Bulan
          </button>

          <button
            onClick={() => setPeriod('custom')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              period === 'custom' ? 'bg-primary text-white shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            🎯 Custom Rentang
          </button>

          {period === 'custom' && (
            <div className="flex items-center gap-2 animate-fade-in">
              <input
                type="date"
                value={customFrom}
                onChange={e => setCustomFrom(e.target.value)}
                className="border border-gray-300 rounded-xl px-3 py-1 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <span className="text-gray-400 font-bold">—</span>
              <input
                type="date"
                value={customTo}
                onChange={e => setCustomTo(e.target.value)}
                className="border border-gray-300 rounded-xl px-3 py-1 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          )}
        </div>
      </Card>

      {/* AI Summary Banner Result */}
      {aiResult && (
        <Card className="!p-6 bg-gradient-to-br from-purple-950 via-slate-900 to-slate-900 text-white rounded-3xl border border-purple-500/30 shadow-2xl animate-fade-in">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-white/10">
            <div className="flex items-center gap-2 text-purple-300 font-bold text-sm">
              <Sparkles size={18} className="text-purple-400" /> Executive Financial AI Analysis
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

      {/* Summary Stat Cards — Explicit Omzet Riil vs Semu */}
      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <Card className="!p-4 bg-white border border-gray-100 shadow-card">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Total Pemasukan Kas</p>
            <p className="text-2xl font-extrabold text-slate-900">{formatRupiah(summary.totalMasuk)}</p>
            <p className="text-[11px] text-gray-500 font-medium mt-1 truncate">
              Riil: <strong className="text-emerald-700">{formatRupiah(summary.omzetKlien)}</strong> | Semu: <strong className="text-amber-700">{formatRupiah(summary.dropDanaOwner)}</strong>
            </p>
          </Card>

          <Card className="!p-4 bg-emerald-50/60 border border-emerald-200/80 shadow-card">
            <p className="text-xs font-bold text-emerald-800 uppercase tracking-wider mb-1 flex items-center justify-between">
              <span>💰 Omzet Riil (Klien)</span>
              <span className="text-[10px] px-2 py-0.5 bg-emerald-200 text-emerald-900 rounded-full font-bold">P&amp;L</span>
            </p>
            <p className="text-2xl font-extrabold text-emerald-700">{formatRupiah(summary.omzetKlien)}</p>
            <p className="text-[11px] text-emerald-700 font-medium mt-1">
              {summary.omzetRilCount} transaksi pembayaran klien
            </p>
          </Card>

          <Card className="!p-4 bg-amber-50/60 border border-amber-200/80 shadow-card">
            <p className="text-xs font-bold text-amber-800 uppercase tracking-wider mb-1 flex items-center justify-between">
              <span>📥 Drop Dana / Modal Kas</span>
              <span className="text-[10px] px-2 py-0.5 bg-amber-200 text-amber-900 rounded-full font-bold">Transfer Kas</span>
            </p>
            <p className="text-2xl font-extrabold text-amber-700">{formatRupiah(summary.dropDanaOwner)}</p>
            <p className="text-[11px] text-amber-700 font-medium mt-1">
              {summary.omzetSemuCount} transfer modal, suntikan kas &amp; refund
            </p>
          </Card>

          <Card className="!p-4 bg-white border border-gray-100 shadow-card">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Total Pengeluaran (Beban)</p>
            <p className="text-2xl font-extrabold text-red-600">{formatRupiah(summary.totalKeluar)}</p>
            <p className="text-[11px] text-gray-400 mt-1">Ops: {formatRupiah(summary.opsBiaya)} | Prive: {formatRupiah(summary.privBiaya)}</p>
          </Card>

          <Card className="!p-4 bg-white border border-gray-100 shadow-card">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Laba Bersih Usaha (P&amp;L)</p>
            <p className={`text-2xl font-extrabold ${summary.net >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
              {summary.net >= 0 ? '+' : ''}{formatRupiah(summary.net)}
            </p>
            <p className="text-[11px] text-gray-400 mt-1">Pendapatan Klien - Total Pengeluaran</p>
          </Card>
        </div>
      )}

      {/* 📊 AUDIT SECTION: ANALISIS PENETAPAN OMZET RIIL VS DROP DANA MODAL */}
      {summary && (
        <Card className="!p-5 border border-emerald-100 shadow-card bg-white space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-gray-100">
            <div>
              <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <span>🔍</span> Klasifikasi Kas: Pendapatan Klien vs Drop Dana Modal
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Pemisahan penerimaan riil klien (pendapatan P&amp;L) dengan transfer modal kerja &amp; perputaran kas operasional
              </p>
            </div>

            <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl text-xs font-semibold">
              <button
                onClick={() => setOmzetTab('semua')}
                className={`px-3 py-1 rounded-lg transition-all ${omzetTab === 'semua' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600'}`}
              >
                Semua ({summary.omzetRilCount + summary.omzetSemuCount})
              </button>
              <button
                onClick={() => setOmzetTab('riil')}
                className={`px-3 py-1 rounded-lg transition-all ${omzetTab === 'riil' ? 'bg-emerald-600 text-white shadow-sm' : 'text-gray-600 hover:text-emerald-700'}`}
              >
                💰 Omzet Klien ({summary.omzetRilCount})
              </button>
              <button
                onClick={() => setOmzetTab('semu')}
                className={`px-3 py-1 rounded-lg transition-all ${omzetTab === 'semu' ? 'bg-amber-600 text-white shadow-sm' : 'text-gray-600 hover:text-amber-700'}`}
              >
                📥 Drop Dana Modal ({summary.omzetSemuCount})
              </button>
            </div>
          </div>

          {/* Visual Percentage Progress Bar */}
          <div className="space-y-1.5 p-3.5 bg-gray-50 rounded-2xl border border-gray-100">
            <div className="flex justify-between text-xs font-bold">
              <span className="text-emerald-700 flex items-center gap-1">
                💰 Pendapatan Klien: {formatRupiah(summary.omzetKlien)} ({summary.totalMasuk > 0 ? Math.round((summary.omzetKlien / summary.totalMasuk) * 100) : 0}%)
              </span>
              <span className="text-amber-700 flex items-center gap-1">
                📥 Drop Dana Modal: {formatRupiah(summary.dropDanaOwner)} ({summary.totalMasuk > 0 ? Math.round((summary.dropDanaOwner / summary.totalMasuk) * 100) : 0}%)
              </span>
            </div>
            <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden flex">
              <div
                className="h-full bg-emerald-500 transition-all duration-500"
                style={{ width: `${summary.totalMasuk > 0 ? (summary.omzetKlien / summary.totalMasuk) * 100 : 0}%` }}
              />
              <div
                className="h-full bg-amber-400 transition-all duration-500"
                style={{ width: `${summary.totalMasuk > 0 ? (summary.dropDanaOwner / summary.totalMasuk) * 100 : 0}%` }}
              />
            </div>
          </div>

          {/* Table of Classified Inflows */}
          <div className="overflow-x-auto">
            {(() => {
              const displayList = omzetTab === 'riil'
                ? omzetRilTx
                : omzetTab === 'semu'
                ? omzetSemuTx
                : [...omzetRilTx, ...omzetSemuTx].sort((a, b) => new Date(b.tanggal).getTime() - new Date(a.tanggal).getTime());

              if (displayList.length === 0) {
                return <p className="text-xs text-gray-400 text-center py-6">Tidak ada transaksi pemasukan pada kategori ini</p>;
              }

              return (
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-50 text-gray-500 uppercase font-semibold border-b border-gray-100">
                    <tr>
                      <th className="px-3 py-2">Tanggal</th>
                      <th className="px-3 py-2">Uraian / Deskripsi</th>
                      <th className="px-3 py-2">Kategori</th>
                      <th className="px-3 py-2">Klasifikasi Omzet</th>
                      <th className="px-3 py-2 text-right">Nominal (Rp)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {displayList.map(t => {
                      const isReal = isOmzetRil(t);
                      return (
                        <tr key={t.id} className="hover:bg-gray-50/80 transition-colors">
                          <td className="px-3 py-2.5 whitespace-nowrap font-medium text-gray-600">{formatDate(t.tanggal)}</td>
                          <td className="px-3 py-2.5 font-semibold text-gray-900 max-w-xs truncate">{t.deskripsi}</td>
                          <td className="px-3 py-2.5 text-gray-500">{t.kategori}</td>
                          <td className="px-3 py-2.5 whitespace-nowrap">
                            {isReal ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                💰 Omzet Riil (Klien)
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                                📥 Omzet Semu (Drop/Mutasi)
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-right font-extrabold text-gray-900 tabular-nums">
                            {formatRupiah(t.nominal)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              );
            })()}
          </div>
        </Card>
      )}

      {/* Realisasi Pengeluaran Per Divisi (Admin, IT, Ahli) */}
      {summary && (
        <Card className="!p-5 border border-gray-100 shadow-card bg-white">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
              <span>🏛️</span> Realisasi Pengeluaran Per Divisi
            </h3>
            <span className="text-xs font-bold px-2.5 py-1 bg-blue-100 text-blue-800 rounded-full border border-blue-200">
              Divisi Unit
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3.5 bg-blue-50/80 border border-blue-200/90 rounded-2xl">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-blue-900">💼 Divisi Admin</span>
              </div>
              <p className="text-lg font-extrabold text-blue-950">{formatRupiah(summary.adminDivisiBiaya || 0)}</p>
              <p className="text-[10.5px] text-blue-700 font-medium mt-0.5">Wi-Fi, ATK, Listrik, Kantor</p>
            </div>

            <div className="p-3.5 bg-indigo-50/80 border border-indigo-200/90 rounded-2xl">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-indigo-900">💻 Divisi IT</span>
              </div>
              <p className="text-lg font-extrabold text-indigo-950">{formatRupiah(summary.itDivisiBiaya || 0)}</p>
              <p className="text-[10.5px] text-indigo-700 font-medium mt-0.5">Server, Hardware, Tools</p>
            </div>

            <div className="p-3.5 bg-purple-50/80 border border-purple-200/90 rounded-2xl">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-purple-900">🛠️ Divisi Ahli</span>
              </div>
              <p className="text-lg font-extrabold text-purple-950">{formatRupiah(summary.ahliDivisiBiaya || 0)}</p>
              <p className="text-[10.5px] text-purple-700 font-medium mt-0.5">Honorarium &amp; Spesialis</p>
            </div>
          </div>
        </Card>
      )}

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Category breakdown pie */}
        <Card className="!p-5 border border-gray-100 shadow-card">
          <h3 className="text-base font-bold text-gray-900 mb-4">Pengeluaran Per Kategori</h3>
          {categoryData.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-12">Belum ada data pengeluaran pada periode ini</p>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryData}
                    dataKey="nominal"
                    nameKey="kategori"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label={({ kategori, percentage }: any) => `${kategori} (${percentage}%)`}
                  >
                    {categoryData.map((_, idx) => (
                      <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<RUPIAH_TOOLTIP />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        {/* Cashflow trend line */}
        <Card className="!p-5 border border-gray-100 shadow-card">
          <h3 className="text-base font-bold text-gray-900 mb-4">Tren Arus Kas Kumulatif</h3>
          {cashflowData.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-12">Belum ada tren data untuk periode ini</p>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={cashflowData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="tanggal" stroke="#94a3b8" fontSize={11} />
                  <YAxis stroke="#94a3b8" fontSize={11} tickFormatter={v => `Rp${(v / 1000000).toFixed(0)}M`} />
                  <Tooltip formatter={(v: any) => formatRupiah(Number(v))} />
                  <Line type="monotone" dataKey="kasKumulatif" stroke="#299775" strokeWidth={3} dot={false} name="Saldo Kas" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
      </div>

      {/* Official PDF & KOP Surat Report Modal */}
      <PdfReportModal
        isOpen={pdfModalOpen}
        onClose={() => setPdfModalOpen(false)}
        title="Laporan Keuangan & Jurnal Transaksi Kas Utama"
        periodText={periodTextStr}
        transactions={periodTransactions}
      />
    </div>
  );
}
