// ============================================================
// ARKA Finance — Admin Dashboard
// Includes Kas Utama vs Dana Proyek Scope Badges & Clickable Rows -> TransactionDetailModal
// ============================================================

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Wallet, TrendingUp, TrendingDown, User, FolderOpen,
  ArrowUpDown, Download, Search, Filter, ChevronUp, ChevronDown, Trash2, FileText, ChevronRight, KeyRound
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { getTransactions, filterTransactions, deleteTransaction, groupAndSortTransactions } from '../services/transactionService';
import { getProjects } from '../services/projectService';
import { getDashboardSummary, getMonthlyChartData } from '../services/analyticsService';
import { classifyTransaction } from '../services/financialEngine';
import { setupStaffPin, hasStaffPin } from '../services/authService';
import {
  type Transaction, type FilterOptions, type DashboardSummary
} from '../types';
import {
  Card, Button, StatusBadge, LoadingSpinner, EmptyState, DashboardSkeleton,
  formatRupiah, formatDate, AttachmentViewer, TransactionDetailModal
} from '../components/ui';
import { Modal } from '../components/ui/Modal';
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
        <p className="text-xs sm:text-sm md:text-base lg:text-lg font-extrabold text-gray-900 tabular-nums tracking-tight whitespace-nowrap overflow-x-auto scrollbar-none">{value}</p>
        {sub && <p className="text-[11px] text-gray-400 mt-0.5 truncate font-medium">{sub}</p>}
      </div>
    </Card>
  );
}

export function AdminDashboard() {
  const { transactions: allTransactions, projects: projectsList, loading: globalLoading, addToast, triggerRefresh } = useApp();
  
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

  // Memoized Summary Calculation
  const summary: DashboardSummary = React.useMemo(() => {
    const activeProjects = projectsList.filter(p => p.status === 'aktif').length;
    return getDashboardSummary(allTransactions, activeProjects, projectsList);
  }, [allTransactions, projectsList]);

  const getProjectName = (id?: string) => {
    if (!id) return '';
    const p = projectsList.find(item => item.id === id);
    return p ? p.nama : 'Proyek';
  };

  // Memoized Filtered & Sorted Transactions
  const filtered = React.useMemo(() => {
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
    if (sortField === 'tanggal') {
      result = groupAndSortTransactions(result, sortDir);
    } else {
      result.sort((a, b) => {
        let cmp = 0;
        if (sortField === 'nominal') cmp = a.nominal - b.nominal;
        if (sortField === 'deskripsi') cmp = a.deskripsi.localeCompare(b.deskripsi);
        return sortDir === 'asc' ? cmp : -cmp;
      });
    }

    return result;
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

  // Staff PIN State
  const [isStaffPinModalOpen, setIsStaffPinModalOpen] = useState(false);
  const [staffPinInput, setStaffPinInput] = useState('');
  const [staffPinSaving, setStaffPinSaving] = useState(false);
  const [hasExistingStaffPin, setHasExistingStaffPin] = useState(false);

  useEffect(() => {
    hasStaffPin().then(exists => setHasExistingStaffPin(exists));
  }, []);

  const handleSaveStaffPin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (staffPinInput.length !== 6 || !/^\d+$/.test(staffPinInput)) {
      alert('PIN Asisten harus berupa 6 digit angka!');
      return;
    }
    setStaffPinSaving(true);
    try {
      await setupStaffPin(staffPinInput);
      addToast('success', 'PIN Asisten Keuangan berhasil disimpan!');
      setHasExistingStaffPin(true);
      setIsStaffPinModalOpen(false);
      setStaffPinInput('');
    } catch (err) {
      addToast('error', 'Gagal menyimpan PIN Asisten');
    } finally {
      setStaffPinSaving(false);
    }
  };

  if (globalLoading) return <DashboardSkeleton />;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Dashboard Admin Keuangan</h1>
          <p className="text-gray-500 text-sm mt-1">Kelola semua transaksi keuangan</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsStaffPinModalOpen(true)}
            className="px-3.5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm transition"
          >
            <KeyRound size={15} className="text-emerald-400" />
            <span>{hasExistingStaffPin ? '🔑 Ubah PIN Asisten' : '🔑 Buat PIN Asisten'}</span>
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <SummaryCard label="Total Kas Perusahaan" value={formatRupiah((summary.accountBalances?.bca_utama || 0) + (summary.accountBalances?.bri_utama || 0) + (summary.accountBalances?.kas_admin || 0))} icon={<Wallet size={20} className="text-white" />} color="gradient-primary" sub={`BCA: ${formatRupiah(summary.accountBalances?.bca_utama || 0)} · BRI: ${formatRupiah(summary.accountBalances?.bri_utama || 0)} · Kas: ${formatRupiah(summary.accountBalances?.kas_admin || 0)}`} />
            <SummaryCard label="Pemasukan Bulan Ini" value={formatRupiah(summary.totalPemasukanBulanIni)} icon={<TrendingUp size={20} className="text-white" />} color="bg-blue-500" sub={`Drop Dana: ${formatRupiah(summary.totalDropDanaBulanIni || 0)} | Omzet: ${formatRupiah(summary.totalOmzetBulanIni || 0)}`} />
            <SummaryCard label="Pengeluaran Ops" value={formatRupiah(summary.totalPengeluaranOperasionalBulanIni)} icon={<TrendingDown size={20} className="text-white" />} color="bg-amber-500" sub="Bulan ini" />
            <SummaryCard label="Pribadi Owner" value={formatRupiah(summary.totalPribadiOwnerBulanIni)} icon={<User size={20} className="text-white" />} color="bg-purple-500" sub="Bulan ini" />
          </div>
          
          {/* Sub-cards Saldo Rekening Fisik */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <SummaryCard label="Saldo BCA Utama" value={formatRupiah(summary.accountBalances?.bca_utama || 0)} icon={<Wallet size={20} className="text-white" />} color="bg-indigo-500" />
            <SummaryCard label="Saldo BRI Utama" value={formatRupiah(summary.accountBalances?.bri_utama || 0)} icon={<Wallet size={20} className="text-white" />} color="bg-blue-600" />
            <SummaryCard label="Saldo Kas Admin" value={formatRupiah(summary.accountBalances?.kas_admin || 0)} icon={<Wallet size={20} className="text-white" />} color="bg-emerald-500" sub={`Dana Bebas: ${formatRupiah(Math.max(0, (summary.accountBalances?.kas_admin || 0) - (summary.totalKasProyek > 0 ? summary.totalKasProyek : 0)))} · Teralokasi: ${formatRupiah(summary.totalKasProyek > 0 ? summary.totalKasProyek : 0)}`} />
          </div>
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
              <option value="pribadi">Non-Operasional / Prive</option>
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
              description="Coba ubah filter atau pencarian Anda"
            />
          ) : (
            <>
              {/* Mobile Card List View (Clickable) */}
              <div className="md:hidden space-y-3 p-3">
                {filtered.map(tx => {
                  const classification = classifyTransaction(tx);
                  const isKas = !tx.proyekId || classification.isKasUtamaTransaction || classification.isMutasiInternal;

                  return (
                    <div
                      key={tx.id}
                      onClick={() => setSelectedTx(tx)}
                      className="p-3.5 bg-gray-50 hover:bg-emerald-50/30 border border-gray-200/80 rounded-2xl space-y-2 cursor-pointer transition-all active:scale-[0.99]"
                    >
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {isKas ? (
                            <span className="text-[10px] px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full font-bold border border-emerald-200">
                              🏢 Kas Utama
                            </span>
                          ) : (
                            <span className="text-[10px] px-2 py-0.5 bg-blue-100 text-blue-800 rounded-full font-bold border border-blue-200 truncate max-w-[140px]">
                              🏗️ {getProjectName(tx.proyekId)}
                            </span>
                          )}
                          <span className="text-[11px] text-gray-400 font-semibold">{formatDate(tx.tanggal)}</span>
                        </div>
                        <StatusBadge status={tx.status} />
                      </div>

                      <div className="flex items-center justify-between pt-1">
                        <div>
                          <p className="font-bold text-gray-900 text-xs line-clamp-1">{tx.deskripsi}</p>
                          <p className="text-[11px] text-gray-500">{tx.kategori}</p>
                        </div>
                        <p className={`font-extrabold text-sm whitespace-nowrap tabular-nums ${tx.jenis === 'masuk' ? 'text-emerald-600' : 'text-red-600'}`}>
                          {tx.jenis === 'masuk' ? '+' : '-'}{formatRupiah(tx.nominal)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Desktop Table View (Clickable Rows) */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm text-left table-fixed">
                  <colgroup>
                    <col className="w-32" />
                    <col className="w-28" />
                    <col className="w-auto" />
                    <col className="w-36" />
                    <col className="w-24" />
                    <col className="w-12" />
                  </colgroup>
                  <thead className="bg-gray-50 text-gray-600 font-semibold uppercase text-xs border-b border-gray-100">
                    <tr>
                      <th className="text-left px-3 py-3 text-gray-500 font-medium whitespace-nowrap">Sumber Kas</th>
                      <th className="text-left px-3 py-3 text-gray-500 font-medium whitespace-nowrap">
                        <button onClick={() => handleSort('tanggal')} className="flex items-center gap-1 hover:text-gray-700">
                          Tanggal <SortIcon field="tanggal" />
                        </button>
                      </th>
                      <th className="text-left px-4 py-3 text-gray-500 font-medium">Deskripsi &amp; Kategori</th>
                      <th className="text-right px-3 py-3 text-gray-500 font-medium whitespace-nowrap">
                        <button onClick={() => handleSort('nominal')} className="flex items-center gap-1 hover:text-gray-700 ml-auto">
                          Nominal <SortIcon field="nominal" />
                        </button>
                      </th>
                      <th className="text-center px-3 py-3 text-gray-500 font-medium whitespace-nowrap">Status</th>
                      <th className="text-center px-2 py-3 text-gray-500 font-medium whitespace-nowrap">Detail</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {filtered.map(tx => {
                      const classification = classifyTransaction(tx);
                      const isKas = !tx.proyekId || classification.isKasUtamaTransaction || classification.isMutasiInternal;

                      return (
                        <tr
                          key={tx.id}
                          onClick={() => setSelectedTx(tx)}
                          className="hover:bg-emerald-50/40 transition-colors cursor-pointer"
                        >
                          <td className="px-3 py-3 whitespace-nowrap truncate">
                            {isKas ? (
                              <span className="text-xs px-2.5 py-0.5 bg-emerald-100 text-emerald-800 rounded-full font-bold border border-emerald-200 whitespace-nowrap">
                                🏢 Kas Utama
                              </span>
                            ) : (
                              <span className="text-xs px-2.5 py-0.5 bg-blue-100 text-blue-800 rounded-full font-bold border border-blue-200 whitespace-nowrap truncate block max-w-full">
                                🏗️ Dana Proyek
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-3 text-gray-600 whitespace-nowrap font-medium text-xs">{formatDate(tx.tanggal)}</td>
                          <td className="px-4 py-3 min-w-0">
                            <p className="font-bold text-gray-900 break-words leading-tight">{tx.deskripsi}</p>
                            <p className="text-xs text-gray-500 font-medium mt-0.5">{tx.kategori}</p>
                          </td>
                          <td className="px-3 py-3 text-right whitespace-nowrap">
                            <span className={`font-extrabold tabular-nums ${tx.jenis === 'masuk' ? 'text-emerald-600' : 'text-red-600'}`}>
                              {tx.jenis === 'masuk' ? '+' : '-'}{formatRupiah(tx.nominal)}
                            </span>
                          </td>
                          <td className="px-3 py-3 text-center whitespace-nowrap"><StatusBadge status={tx.status} /></td>
                          <td className="px-2 py-3 text-center text-gray-400">
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
        onUpdate={(updated) => {
          triggerRefresh();
          if (updated) setSelectedTx(updated);
        }}
      />

      {/* Staff PIN Management Modal */}
      <Modal
        isOpen={isStaffPinModalOpen}
        onClose={() => setIsStaffPinModalOpen(false)}
        title="🔑 Pengaturan PIN Khusus Asisten Keuangan"
      >
        <form onSubmit={handleSaveStaffPin} className="space-y-4">
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-900 space-y-1">
            <p className="font-bold flex items-center gap-1.5">
              🤝 Pemisahan Akses Staf / Asisten
            </p>
            <p className="leading-relaxed text-emerald-800">
              PIN ini digunakan khusus oleh Asisten Keuangan untuk login. Asisten dapat membantu input transaksi, nota belanja, dan hutang-piutang, namun <strong>saldo rekening induk master (BCA/BRI) &amp; laporan pusat akan disembunyikan otomatis</strong>.
            </p>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">
              Masukkan 6 Digit PIN Asisten:
            </label>
            <input
              type="password"
              maxLength={6}
              placeholder="Contoh: 112233"
              value={staffPinInput}
              onChange={e => setStaffPinInput(e.target.value.replace(/\D/g, ''))}
              className="w-full text-center font-mono text-xl tracking-[0.5em] px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-emerald-500 focus:ring-0 outline-none"
              required
            />
          </div>

          <div className="flex gap-2 justify-end pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsStaffPinModalOpen(false)}
            >
              Batal
            </Button>
            <Button
              type="submit"
              disabled={staffPinSaving || staffPinInput.length !== 6}
            >
              {staffPinSaving ? 'Menyimpan...' : 'Simpan PIN Asisten'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
