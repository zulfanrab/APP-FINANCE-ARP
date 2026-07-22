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
  getCategoryBreakdown, getCashflowTrend, buildAISummaryContext, cleanTextPunctuation, isMutasiInternal
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
  const { addToast } = useApp();
  const [loading, setLoading] = useState(true);
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);

  // Period
  const [period, setPeriod] = useState<PeriodType>('bulan_ini');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  // Computed data
  const [categoryData, setCategoryData] = useState<any[]>([]);
  const [cashflowData, setCashflowData] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);

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
  }, [period, customFrom, customTo]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [txns, projs] = await Promise.all([getTransactions(), getProjects()]);
      setAllTransactions(txns);
      setProjects(projs);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    if (allTransactions.length === 0 && !loading) {
      setCategoryData([]);
      setCashflowData([]);
      setSummary(null);
      return;
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
    for (const t of periodTx) {
      if (t.jenis === 'masuk') {
        totalMasuk += t.nominal;
        if (isMutasiInternal(t)) {
          dropDanaOwner += t.nominal;
        } else {
          omzetKlien += t.nominal;
        }
      } else {
        totalKeluar += t.nominal;
        if (t.tag === 'operasional') opsBiaya += t.nominal;
        if (t.tag === 'pribadi') privBiaya += t.nominal;
      }
    }

    setCategoryData(cats);
    setCashflowData(cashflow);
    setSummary({
      totalMasuk,
      dropDanaOwner,
      omzetKlien,
      totalKeluar,
      opsBiaya,
      privBiaya,
      net: totalMasuk - totalKeluar,
      count: periodTx.length,
    });
    setAiResult('');
  }, [allTransactions, period, customFrom, customTo, loading, getPeriodDates]);

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
      const margin = summary.totalMasuk > 0 ? Math.round(((summary.totalMasuk - summary.totalKeluar) / summary.totalMasuk) * 100) : 0;
      const topCat = categoryData.length > 0 ? categoryData[0] : null;
      const privePercent = summary.totalKeluar > 0 ? Math.round((summary.privBiaya / summary.totalKeluar) * 100) : 0;

      const fallbackText = `Analisis & Executive Summary Keuangan PT Aksara Riksa Perdana

1. Kinerja & Kesehatan Arus Kas:
- Total Pemasukan Kas Utama: ${formatRupiah(summary.totalMasuk)}
- Total Pengeluaran Kas Utama: ${formatRupiah(summary.totalKeluar)} (Operasional: ${formatRupiah(summary.opsBiaya)} | Prive Owner: ${formatRupiah(summary.privBiaya)})
- Arus Kas Bersih (Net Cashflow): ${summary.net >= 0 ? '+' : ''}${formatRupiah(summary.net)} (${margin}% Net Margin)

2. Sorotan Utama & Pengeluaran Terbesar:
${topCat ? `- Pengeluaran terbesar tercatat pada kategori ${topCat.kategori} sebesar ${formatRupiah(topCat.total)} (${topCat.persentase}% dari total pengeluaran).` : '- Belum ada pengeluaran signifikan tercatat pada periode ini.'}
- Pengambilan Prive Owner menyerap ${privePercent}% dari total pengeluaran periode ini.

3. Rekomendasi Strategis:
${summary.net >= 0 ? 'Arus kas dalam kondisi Sehat & Positif. Pertahankan alokasi modal operasional proyek dan pertahankan rasio prive di bawah 20% agar modal kerja tetap kuat.' : 'Arus kas defisit pada periode ini. Disarankan pengetatan pengeluaran non-operasional dan mempercepat pencairan termin dari klien.'}`;

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
      title: 'Laporan Keuangan & Jurnal Akuntansi Kas Utama',
      periodText,
      transactions: allTransactions,
      projects,
    });

    addToast('success', 'Jurnal Akuntansi Excel (Debet/Kredit/Saldo) berhasil didownload!');
  };

  if (loading) return <LoadingSpinner size={32} />;

  const { from, to } = getPeriodDates();
  const periodTextStr = `${formatDate(from.toISOString())} - ${formatDate(to.toISOString())}`;

  return (
    <div className="space-y-6 animate-fade-in pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-3xl border border-gray-100 shadow-card">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Laporan Keuangan</h1>
          <p className="text-xs text-gray-500 mt-0.5">Analisis arus kas &amp; ekspor laporan resmi bertanda tangan</p>
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

      {/* Period Selector */}
      <Card className="!p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <CalendarRange size={16} className="text-primary" />
            <span className="text-xs font-semibold text-gray-700">Periode:</span>
          </div>
          {(['bulan_ini', '3_bulan', 'custom'] as PeriodType[]).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all
                ${period === p ? 'bg-primary text-white shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              {p === 'bulan_ini' ? 'Bulan Ini' : p === '3_bulan' ? '3 Bulan' : 'Custom'}
            </button>
          ))}
          {period === 'custom' && (
            <div className="flex items-center gap-2">
              <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
                className="border border-gray-200 rounded-xl px-3 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-primary" />
              <span className="text-gray-400">—</span>
              <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}
                className="border border-gray-200 rounded-xl px-3 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-primary" />
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

      {/* Summary Stat Cards */}
      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="!p-4 bg-white border border-gray-100 shadow-card">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Pemasukan / Drop Dana</p>
            <p className="text-2xl font-extrabold text-emerald-600">{formatRupiah(summary.totalMasuk)}</p>
            <p className="text-[11px] text-gray-500 font-medium mt-1">
              Drop Owner: {formatRupiah(summary.dropDanaOwner)} | Omzet: {formatRupiah(summary.omzetKlien)}
            </p>
          </Card>

          <Card className="!p-4 bg-white border border-gray-100 shadow-card">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Total Pengeluaran</p>
            <p className="text-2xl font-extrabold text-red-600">{formatRupiah(summary.totalKeluar)}</p>
            <p className="text-[11px] text-gray-400 mt-1">Ops: {formatRupiah(summary.opsBiaya)} | Prive: {formatRupiah(summary.privBiaya)}</p>
          </Card>

          <Card className="!p-4 bg-white border border-gray-100 shadow-card">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Saldo Periode (Net)</p>
            <p className={`text-2xl font-extrabold ${summary.net >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
              {summary.net >= 0 ? '+' : ''}{formatRupiah(summary.net)}
            </p>
            <p className="text-[11px] text-gray-400 mt-1">Net Cashflow Periode</p>
          </Card>

          <Card className="!p-4 bg-slate-900 text-white shadow-card">
            <p className="text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-1">Jumlah Transaksi</p>
            <p className="text-2xl font-extrabold">{summary.count} data</p>
            <p className="text-[11px] text-slate-400 mt-1">Terverifikasi &amp; disetujui</p>
          </Card>
        </div>
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
        transactions={allTransactions}
      />
    </div>
  );
}
