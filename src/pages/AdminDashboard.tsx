// ============================================================
// ARKA Finance — Admin Dashboard
// Includes Kas Utama vs Dana Proyek Scope Badges & Clickable Rows -> TransactionDetailModal
// ============================================================

import React, { useState, useEffect, useCallback } from 'react';
import {
  Wallet, TrendingUp, TrendingDown, User, FolderOpen,
  ArrowUpDown, Download, Search, Filter, ChevronUp, ChevronDown, Trash2, FileText, ChevronRight
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { getTransactions, filterTransactions, deleteTransaction } from '../services/transactionService';
import { getProjects } from '../services/projectService';
import { getDashboardSummary, getMonthlyChartData } from '../services/analyticsService';
import {
  type Transaction, type FilterOptions, type DashboardSummary
} from '../types';
import {
  Card, Button, StatusBadge, LoadingSpinner, EmptyState, DashboardSkeleton,
  formatRupiah, formatDate, AttachmentViewer, TransactionDetailModal
} from '../components/ui';
import { useApp } from '../context/AppContext';

type SortField = 'tanggal' | 'nominal' | 'deskripsi';
type SortDir = 'asc' | 'desc';

function SummaryCard({ label, value, icon, color, sub }: {
  label: string; value: string; icon: React.ReactNode; color: string; sub?: string;
}) {
  return (
    <Card className="flex items-start gap-3.5 p-4 sm:p-5 min-w-0">
      <div className={`w-11 h-11 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center flex-shrink-0 ${color}`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0 overflow-hidden">
        <p className="text-xs sm:text-sm text-gray-500 font-medium mb-0.5 truncate">{label}</p>
        <p className="text-base sm:text-lg lg:text-xl font-extrabold text-gray-900 truncate tabular-nums tracking-tight">{value}</p>
        {sub && <p className="text-[11px] text-gray-400 mt-0.5 truncate font-medium">{sub}</p>}
      </div>
    </Card>
  );
}

export function AdminDashboard() {
  const { addToast, refreshKey } = useApp();
  const [loading, setLoading] = useState(true);
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [filtered, setFiltered] = useState<Transaction[]>([]);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);

  // Selected Transaction Modal
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);

  // Filters
  const [filters, setFilters] = useState<FilterOptions>({ tag: 'semua', status: 'semua', jenis: 'semua' });
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Sort
  const [sortField, setSortField] = useState<SortField>('tanggal');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const [projectsList, setProjectsList] = useState<any[]>([]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [txns, projects] = await Promise.all([getTransactions(), getProjects()]);
      setAllTransactions(txns);
      setProjectsList(projects);
      const activeProjects = projects.filter(p => p.status === 'aktif').length;
      setSummary(getDashboardSummary(txns, activeProjects));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData, refreshKey]);

  // Apply filters + search
  useEffect(() => {
    let result = [...allTransactions];

    if (filters.jenis && filters.jenis !== 'semua') result = result.filter(t => t.jenis === filters.jenis);
    if (filters.tag && filters.tag !== 'semua') result = result.filter(t => t.tag === filters.tag);
    if (filters.status && filters.status !== 'semua') result = result.filter(t => t.status === filters.status);
    if (dateFrom) result = result.filter(t => new Date(t.tanggal) >= new Date(dateFrom));
    if (dateTo) {
      const to = new Date(dateTo);
      to.setHours(23, 59, 59, 999);
      result = result.filter(t => new Date(t.tanggal) <= to);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(t =>
        t.deskripsi.toLowerCase().includes(q) ||
        t.kategori.toLowerCase().includes(q)
      );
    }

    // Sort
    result.sort((a, b) => {
      let cmp = 0;
      if (sortField === 'tanggal') cmp = new Date(a.tanggal).getTime() - new Date(b.tanggal).getTime();
      if (sortField === 'nominal') cmp = a.nominal - b.nominal;
      if (sortField === 'deskripsi') cmp = a.deskripsi.localeCompare(b.deskripsi);
      return sortDir === 'asc' ? cmp : -cmp;
    });

    setFiltered(result);
  }, [allTransactions, filters, search, dateFrom, dateTo, sortField, sortDir]);

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('desc'); }
  };

  const handleExcelExport = () => {
    const rows = filtered.map(t => ({
      Tanggal: formatDate(t.tanggal),
      Deskripsi: t.deskripsi,
      Jenis: t.jenis === 'masuk' ? 'Pemasukan' : 'Pengeluaran',
      Kategori: t.kategori,
      Tag: t.tag === 'operasional' ? 'Operasional' : t.tag === 'pribadi' ? 'Pribadi Owner' : '-',
      'Nominal (Rp)': t.nominal,
      Status: t.status === 'menunggu_approval' ? 'Menunggu Approval'
        : t.status === 'disetujui' ? 'Disetujui'
        : t.status === 'ditolak' ? 'Ditolak' : 'Selesai',
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [{ wch: 15 }, { wch: 30 }, { wch: 15 }, { wch: 20 }, { wch: 18 }, { wch: 18 }, { wch: 18 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Transaksi');
    XLSX.writeFile(wb, `ARKA_Transaksi_${new Date().toISOString().split('T')[0]}.xlsx`);
    addToast('success', `Berhasil export ${filtered.length} transaksi ke Excel`);
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown size={12} className="text-gray-300" />;
    return sortDir === 'asc' ? <ChevronUp size={12} className="text-primary" /> : <ChevronDown size={12} className="text-primary" />;
  };

  if (loading) return <DashboardSkeleton />;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Dashboard Admin Keuangan</h1>
          <p className="text-gray-500 text-sm mt-1">Kelola semua transaksi keuangan</p>
        </div>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
          <SummaryCard label="Sisa Kas" value={formatRupiah(summary.sisaKas)} icon={<Wallet size={20} className="text-white" />} color="gradient-primary" />
          <SummaryCard label="Pemasukan Bulan Ini" value={formatRupiah(summary.totalPemasukanBulanIni)} icon={<TrendingUp size={20} className="text-white" />} color="bg-blue-500" />
          <SummaryCard label="Pengeluaran Ops" value={formatRupiah(summary.totalPengeluaranOperasionalBulanIni)} icon={<TrendingDown size={20} className="text-white" />} color="bg-amber-500" sub="Bulan ini" />
          <SummaryCard label="Pribadi Owner" value={formatRupiah(summary.totalPribadiOwnerBulanIni)} icon={<User size={20} className="text-white" />} color="bg-purple-500" sub="Bulan ini" />
          <SummaryCard label="Proyek Aktif" value={String(summary.proyekAktif)} icon={<FolderOpen size={20} className="text-white" />} color="bg-teal-500" />
        </div>
      )}

      {/* Transaction Table */}
      <Card className="!p-0 overflow-hidden">
        {/* Table Header + Filters */}
        <div className="p-4 border-b border-gray-100 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-gray-800">
              Semua Transaksi
              <span className="ml-2 text-sm font-normal text-gray-400">({filtered.length} data)</span>
            </h2>
            <Button variant="primary" size="sm" icon={<Download size={14} />} onClick={handleExcelExport}>
              Export Excel
            </Button>
          </div>

          {/* Filters Row */}
          <div className="flex flex-wrap gap-3">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Cari transaksi..."
                className="pl-8 pr-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary w-44"
              />
            </div>
            <select
              value={filters.jenis}
              onChange={e => setFilters(f => ({ ...f, jenis: e.target.value as any }))}
              className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-white"
            >
              <option value="semua">Semua Jenis</option>
              <option value="masuk">Pemasukan</option>
              <option value="keluar">Pengeluaran</option>
            </select>
            <select
              value={filters.tag}
              onChange={e => setFilters(f => ({ ...f, tag: e.target.value as any }))}
              className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-white"
            >
              <option value="semua">Semua Tag</option>
              <option value="operasional">Operasional</option>
              <option value="pribadi">Pribadi Owner</option>
            </select>
            <select
              value={filters.status}
              onChange={e => setFilters(f => ({ ...f, status: e.target.value as any }))}
              className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-white"
            >
              <option value="semua">Semua Status</option>
              <option value="menunggu_approval">Menunggu Approval</option>
              <option value="disetujui">Disetujui</option>
              <option value="ditolak">Ditolak</option>
              <option value="selesai">Selesai</option>
            </select>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
            {(search || dateFrom || dateTo || filters.tag !== 'semua' || filters.status !== 'semua' || filters.jenis !== 'semua') && (
              <Button variant="ghost" size="sm" onClick={() => { setSearch(''); setDateFrom(''); setDateTo(''); setFilters({ tag: 'semua', status: 'semua', jenis: 'semua' }); }}>
                Reset Filter
              </Button>
            )}
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          {filtered.length === 0 ? (
            <EmptyState
              icon={<FileText size={28} />}
              title="Tidak ada transaksi"
              description="Belum ada transaksi yang sesuai dengan filter Anda"
            />
          ) : (
            <>
              {/* Mobile Card List View (Clickable) */}
              <div className="md:hidden space-y-3 p-3">
                {filtered.map(tx => {
                  const isSuntikan = tx.deskripsi.startsWith('Suntikan Modal Proyek:');
                  const isKas = !tx.proyekId || isSuntikan;

                  return (
                    <div
                      key={tx.id}
                      onClick={() => setSelectedTx(tx)}
                      className="p-4 bg-gray-50/90 hover:bg-emerald-50/30 border border-gray-200/80 hover:border-emerald-300 rounded-2xl space-y-2 cursor-pointer transition-all active:scale-[0.99]"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {isKas ? (
                            <span className="text-[10px] px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full font-bold border border-emerald-200">
                              🏢 Kas Utama
                            </span>
                          ) : (
                            <span className="text-[10px] px-2 py-0.5 bg-blue-100 text-blue-800 rounded-full font-bold border border-blue-200">
                              🏗️ Dana Proyek
                            </span>
                          )}
                          <span className="text-[11px] text-gray-400 font-semibold">{formatDate(tx.tanggal)}</span>
                        </div>
                        <StatusBadge status={tx.status} />
                      </div>

                      <div className="flex items-start justify-between gap-2 pt-1 min-w-0">
                        <div className="flex-1 min-w-0 overflow-hidden">
                          <p className="text-sm font-bold text-gray-900 leading-snug break-words">
                            {tx.deskripsi}
                          </p>
                          <p className="text-xs text-gray-500 font-medium mt-0.5">{tx.kategori}</p>
                        </div>
                        <div className="text-right flex-shrink-0 flex items-center gap-1 min-w-max ml-1">
                          <p className={`font-extrabold text-xs sm:text-sm md:text-base whitespace-nowrap tabular-nums ${tx.jenis === 'masuk' ? 'text-emerald-600' : 'text-red-600'}`}>
                            {tx.jenis === 'masuk' ? '+' : '-'}{formatRupiah(tx.nominal)}
                          </p>
                          <ChevronRight size={16} className="text-gray-400 flex-shrink-0" />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Desktop Table View (Clickable Rows) */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-gray-50 text-gray-600 font-semibold uppercase text-xs border-b border-gray-100">
                    <tr>
                      <th className="text-left px-4 py-3 text-gray-500 font-medium">Sumber Kas</th>
                      <th className="text-left px-4 py-3 text-gray-500 font-medium">
                        <button onClick={() => handleSort('tanggal')} className="flex items-center gap-1 hover:text-gray-700">
                          Tanggal <SortIcon field="tanggal" />
                        </button>
                      </th>
                      <th className="text-left px-4 py-3 text-gray-500 font-medium">Deskripsi &amp; Kategori</th>
                      <th className="text-right px-4 py-3 text-gray-500 font-medium">
                        <button onClick={() => handleSort('nominal')} className="flex items-center gap-1 hover:text-gray-700 ml-auto">
                          Nominal <SortIcon field="nominal" />
                        </button>
                      </th>
                      <th className="text-left px-4 py-3 text-gray-500 font-medium">Status</th>
                      <th className="text-center px-4 py-3 text-gray-500 font-medium w-16">Detail</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {filtered.map(tx => {
                      const isSuntikan = tx.deskripsi.startsWith('Suntikan Modal Proyek:');
                      const isKas = !tx.proyekId || isSuntikan;

                      return (
                        <tr
                          key={tx.id}
                          onClick={() => setSelectedTx(tx)}
                          className="hover:bg-emerald-50/40 transition-colors cursor-pointer"
                        >
                          <td className="px-4 py-3">
                            {isKas ? (
                              <span className="text-xs px-2.5 py-0.5 bg-emerald-100 text-emerald-800 rounded-full font-bold border border-emerald-200 whitespace-nowrap">
                                🏢 Kas Utama
                              </span>
                            ) : (
                              <span className="text-xs px-2.5 py-0.5 bg-blue-100 text-blue-800 rounded-full font-bold border border-blue-200 whitespace-nowrap">
                                🏗️ Dana Proyek
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-gray-600 whitespace-nowrap font-medium">{formatDate(tx.tanggal)}</td>
                          <td className="px-4 py-3">
                            <p className="font-bold text-gray-900">{tx.deskripsi}</p>
                            <p className="text-xs text-gray-500 font-medium">{tx.kategori}</p>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className={`font-extrabold ${tx.jenis === 'masuk' ? 'text-emerald-600' : 'text-red-600'}`}>
                              {tx.jenis === 'masuk' ? '+' : '-'}{formatRupiah(tx.nominal)}
                            </span>
                          </td>
                          <td className="px-4 py-3"><StatusBadge status={tx.status} /></td>
                          <td className="px-4 py-3 text-center">
                            <ChevronRight size={18} className="mx-auto text-emerald-600" />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </Card>

      {/* Detail & Edit Modal */}
      <TransactionDetailModal
        transaction={selectedTx}
        isOpen={!!selectedTx}
        onClose={() => setSelectedTx(null)}
        onUpdate={loadData}
      />
    </div>
  );
}
