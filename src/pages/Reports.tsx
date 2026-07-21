// ============================================================
// ARKA Finance — Reports Page
// Laporan keuangan + AI Summary via Gemini API
// ============================================================

import React, { useState, useEffect, useCallback } from 'react';
import {
  BarChart2, Download, Sparkles, Loader2, CalendarRange, TrendingUp
} from 'lucide-react';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend,
  LineChart, Line, XAxis, YAxis, CartesianGrid
} from 'recharts';
import * as XLSX from 'xlsx';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { getTransactions } from '../services/transactionService';
import { getProjects } from '../services/projectService';
import {
  getCategoryBreakdown, getCashflowTrend, getDashboardSummary, buildAISummaryContext
} from '../services/analyticsService';
import { type Transaction, type Project } from '../types';
import { Card, Button, LoadingSpinner, formatRupiah, formatDate } from '../components/ui';
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

  // AI
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState('');

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

    // Summary for period — KAS UTAMA ONLY (exclude project-internal transactions)
    const periodTx = allTransactions.filter(t => {
      const d = new Date(t.tanggal);
      const approved = t.status === 'disetujui' || t.status === 'selesai';
      if (!approved || d < from || d > to) return false;
      // Only include kas utama transactions:
      // - Transactions without proyekId
      // - Suntikan Modal (represents money leaving kas utama)
      // Exclude: project-internal transactions (have proyekId and are not suntikan)
      if (t.proyekId && !t.deskripsi.startsWith('Suntikan Modal Proyek:')) return false;
      return true;
    });

    let totalMasuk = 0, totalKeluar = 0, opsBiaya = 0, privBiaya = 0;
    for (const t of periodTx) {
      if (t.jenis === 'masuk') totalMasuk += t.nominal;
      else {
        totalKeluar += t.nominal;
        if (t.tag === 'operasional') opsBiaya += t.nominal;
        if (t.tag === 'pribadi') privBiaya += t.nominal;
      }
    }

    setCategoryData(cats);
    setCashflowData(cashflow);
    setSummary({ totalMasuk, totalKeluar, opsBiaya, privBiaya, net: totalMasuk - totalKeluar, count: periodTx.length });
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
          setAiResult(text);
          addToast('success', 'Ringkasan AI Gemini berhasil dibuat!');
          return;
        } catch (apiErr: any) {
          console.warn('Gemini API call failed, switching to Smart AI Engine:', apiErr);
        }
      }

      // Smart Fallback Financial AI Engine
      const margin = summary.totalMasuk > 0 ? Math.round(((summary.totalMasuk - summary.totalKeluar) / summary.totalMasuk) * 100) : 0;
      const topCat = categoryData.length > 0 ? categoryData[0] : null;
      const privePercent = summary.totalKeluar > 0 ? Math.round((summary.privBiaya / summary.totalKeluar) * 100) : 0;

      const fallbackText = `### 📊 Analisis & Executive Summary Keuangan PT Aksara Riksa Perdana

**1. Kinerja & Kesehatan Arus Kas:**
* **Total Pemasukan:** ${formatRupiah(summary.totalMasuk)}
* **Total Pengeluaran:** ${formatRupiah(summary.totalKeluar)} (Operasional: ${formatRupiah(summary.opsBiaya)} | Prive Owner: ${formatRupiah(summary.privBiaya)})
* **Arus Kas Bersih (Net Cashflow):** ${summary.net >= 0 ? '+' : ''}${formatRupiah(summary.net)} (${margin}% Net Margin)

**2. Sorotan Utama & Pengeluaran Terbesar:**
${topCat ? `* Pengeluaran terbesar tercatat pada kategori **${topCat.kategori}** sebesar **${formatRupiah(topCat.total)}** (${topCat.persentase}% dari total pengeluaran).` : '* Belum ada pengeluaran signifikan tercatat pada periode ini.'}
* Pengambilan Prive Owner menyerap **${privePercent}%** dari total pengeluaran periode ini.

**3. Rekomendasi Strategis:**
${summary.net >= 0 ? '✅ **Arus kas dalam kondisi Sehat & Positif.** Pertahankan alokasi modal operasional proyek dan pertahankan rasio prive di bawah 20% agar modal kerja tetap kuat.' : '⚠️ **Arus kas defisit pada periode ini.** Disarankan pengetatan pengeluaran non-operasional dan mempercepat pencairan termin dari klien.'}

*Catatan: ${apiKey ? 'Menggunakan ARKA Financial Analytics Engine.' : 'Masukkan VITE_GEMINI_API_KEY di .env / Vercel untuk analisis naratif mendalam via Gemini AI.'}`;

      setAiResult(fallbackText);
      addToast('success', 'Ringkasan Analisis Keuangan berhasil dibuat!');
    } finally {
      setAiLoading(false);
    }
  };

  const handleExportExcel = () => {
    const { from, to } = getPeriodDates();
    // KAS UTAMA ONLY — exclude project-internal transactions
    const periodTx = allTransactions.filter(t => {
      const d = new Date(t.tanggal);
      const approved = t.status === 'disetujui' || t.status === 'selesai';
      if (!approved || d < from || d > to) return false;
      if (t.proyekId && !t.deskripsi.startsWith('Suntikan Modal Proyek:')) return false;
      return true;
    });

    const wb = XLSX.utils.book_new();

    // Sheet 1: Ringkasan
    const ringkasanData = [
      ['LAPORAN KEUANGAN KAS UTAMA — ARKA', ''],
      ['PT Aksara Riksa Perdana', ''],
      ['(Tidak termasuk transaksi internal proyek)', ''],
      ['', ''],
      ['Periode', `${formatDate(from.toISOString())} — ${formatDate(to.toISOString())}`],
      ['', ''],
      ['Total Pemasukan', summary?.totalMasuk ?? 0],
      ['Total Pengeluaran', summary?.totalKeluar ?? 0],
      ['Saldo Periode', summary?.net ?? 0],
      ['Pengeluaran Operasional', summary?.opsBiaya ?? 0],
      ['Pengeluaran Pribadi Owner', summary?.privBiaya ?? 0],
      ['Jumlah Transaksi', summary?.count ?? 0],
    ];
    const wsRingkasan = XLSX.utils.aoa_to_sheet(ringkasanData);
    wsRingkasan['!cols'] = [{ wch: 25 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, wsRingkasan, 'Ringkasan');

    // Sheet 2: Detail Transaksi
    const detailRows = periodTx.map(t => ({
      Tanggal: formatDate(t.tanggal),
      Deskripsi: t.deskripsi,
      Jenis: t.jenis === 'masuk' ? 'Pemasukan' : 'Pengeluaran',
      Kategori: t.kategori,
      Tag: t.tag === 'operasional' ? 'Operasional' : t.tag === 'pribadi' ? 'Pribadi Owner' : '-',
      'Nominal (Rp)': t.nominal,
      Status: t.status,
    }));
    const wsDetail = XLSX.utils.json_to_sheet(detailRows);
    wsDetail['!cols'] = [{ wch: 15 }, { wch: 30 }, { wch: 15 }, { wch: 20 }, { wch: 18 }, { wch: 18 }, { wch: 18 }];
    XLSX.utils.book_append_sheet(wb, wsDetail, 'Detail Transaksi');

    // Sheet 3: Per Proyek
    const projectRows = projects.map(p => {
      const ptx = periodTx.filter(t => t.proyekId === p.id);
      const masuk = ptx.filter(t => t.jenis === 'masuk').reduce((s, t) => s + t.nominal, 0);
      const keluar = ptx.filter(t => t.jenis === 'keluar').reduce((s, t) => s + t.nominal, 0);
      return {
        'Nama Proyek': p.nama,
        Klien: p.klien,
        Status: p.status === 'aktif' ? 'Aktif' : 'Selesai',
        'Total Pemasukan': masuk,
        'Total Pengeluaran': keluar,
        Profit: masuk - keluar,
      };
    });
    const wsProject = XLSX.utils.json_to_sheet(projectRows);
    wsProject['!cols'] = [{ wch: 25 }, { wch: 20 }, { wch: 10 }, { wch: 18 }, { wch: 18 }, { wch: 15 }];
    XLSX.utils.book_append_sheet(wb, wsProject, 'Per Proyek');

    XLSX.writeFile(wb, `ARKA_Laporan_${new Date().toISOString().split('T')[0]}.xlsx`);
    addToast('success', 'Laporan Excel berhasil diexport (3 sheet)!');
  };

  if (loading) return <LoadingSpinner size={32} />;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Laporan Keuangan</h1>
          <p className="text-sm text-gray-500 mt-1">Analisis dan ringkasan keuangan per periode</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" icon={<Download size={14} />} onClick={handleExportExcel}>Export Excel</Button>
          <Button variant="accent" icon={aiLoading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />} onClick={handleAiSummary} disabled={aiLoading}>
            {aiLoading ? 'Membuat...' : 'Ringkasan AI'}
          </Button>
        </div>
      </div>

      {/* Period Selector */}
      <Card className="!p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <CalendarRange size={16} className="text-primary" />
            <span className="text-sm font-medium text-gray-700">Periode:</span>
          </div>
          {(['bulan_ini', '3_bulan', 'custom'] as PeriodType[]).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-4 py-1.5 rounded-xl text-sm font-medium transition-all
                ${period === p ? 'bg-primary text-white shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              {p === 'bulan_ini' ? 'Bulan Ini' : p === '3_bulan' ? '3 Bulan' : 'Custom'}
            </button>
          ))}
          {period === 'custom' && (
            <>
              <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
                className="border border-gray-200 rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
              <span className="text-gray-400">—</span>
              <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}
                className="border border-gray-200 rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
            </>
          )}
        </div>
      </Card>

      {/* AI Summary */}
      {aiResult && (
        <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/20">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-xl gradient-primary flex items-center justify-center">
              <Sparkles size={18} className="text-white" />
            </div>
            <h2 className="text-base font-semibold text-gray-800">Ringkasan AI — Gemini</h2>
          </div>
          <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">{aiResult}</p>
        </Card>
      )}

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          {[
            { label: 'Total Pemasukan', value: summary.totalMasuk, color: 'text-green-600', bg: 'bg-green-50' },
            { label: 'Total Pengeluaran', value: summary.totalKeluar, color: 'text-red-600', bg: 'bg-red-50' },
            { label: 'Saldo Periode', value: summary.net, color: summary.net >= 0 ? 'text-primary' : 'text-red-600', bg: 'bg-primary-light' },
            { label: 'Jumlah Transaksi', value: summary.count, color: 'text-gray-800', bg: 'bg-gray-50', isCount: true },
          ].map(item => (
            <Card key={item.label} className={`${item.bg}`}>
              <p className="text-xs text-gray-500 mb-1">{item.label}</p>
              <p className={`text-xl font-bold ${item.color}`}>
                {(item as any).isCount ? item.value : formatRupiah(item.value as number)}
              </p>
            </Card>
          ))}
        </div>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Pie Chart */}
        <Card>
          <h2 className="text-base font-semibold text-gray-800 mb-4">Distribusi Pengeluaran per Kategori</h2>
          {categoryData.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-gray-400 text-sm">Tidak ada data pengeluaran</div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={categoryData}
                  dataKey="nominal"
                  nameKey="kategori"
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={3}
                  label={({ kategori, percentage }: any) => `${percentage}%`}
                >
                  {categoryData.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<RUPIAH_TOOLTIP />} />
                <Legend
                  formatter={(value) => <span className="text-xs text-gray-600">{value}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Card>

        {/* Line Chart */}
        <Card>
          <h2 className="text-base font-semibold text-gray-800 mb-4">Tren Cashflow</h2>
          {cashflowData.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-gray-400 text-sm">Tidak ada data cashflow</div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={cashflowData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                <XAxis dataKey="tanggal" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis
                  tickFormatter={v => v >= 1000000 ? `${(v / 1000000).toFixed(1)}jt` : `${(v / 1000).toFixed(0)}rb`}
                  tick={{ fontSize: 11 }} axisLine={false} tickLine={false}
                />
                <Tooltip content={({ active, payload, label }) => {
                  if (active && payload?.length) {
                    return (
                      <div className="bg-white border border-gray-200 rounded-xl px-3 py-2 shadow-lg text-xs">
                        <p className="font-medium mb-1">{label}</p>
                        {payload.map((p: any) => (
                          <p key={p.name} style={{ color: p.stroke }}>
                            {p.name === 'kasKumulatif' ? 'Saldo' : p.name === 'pemasukan' ? 'Masuk' : 'Keluar'}: {formatRupiah(p.value)}
                          </p>
                        ))}
                      </div>
                    );
                  }
                  return null;
                }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="kasKumulatif" stroke="#299775" strokeWidth={2.5} dot={false} name="kasKumulatif" />
                <Line type="monotone" dataKey="pemasukan" stroke="#3b82f6" strokeWidth={1.5} dot={false} name="pemasukan" strokeDasharray="4 2" />
                <Line type="monotone" dataKey="pengeluaran" stroke="#ef4444" strokeWidth={1.5} dot={false} name="pengeluaran" strokeDasharray="4 2" />
              </LineChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

      {/* Category Table */}
      {categoryData.length > 0 && (
        <Card>
          <h2 className="text-base font-semibold text-gray-800 mb-4">Rincian per Kategori Pengeluaran</h2>
          <div className="space-y-3">
            {categoryData.map((cat, i) => (
              <div key={cat.kategori} className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                <p className="text-sm text-gray-700 flex-1">{cat.kategori}</p>
                <div className="w-40 bg-gray-100 rounded-full h-2 overflow-hidden">
                  <div className="h-2 rounded-full" style={{ width: `${cat.percentage}%`, background: PIE_COLORS[i % PIE_COLORS.length] }} />
                </div>
                <p className="text-sm font-semibold text-gray-800 w-28 text-right">{formatRupiah(cat.nominal)}</p>
                <p className="text-xs text-gray-400 w-10 text-right">{cat.percentage}%</p>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
