// ============================================================
// ARKA Finance — Dedicated Transactions List Module
// Native Mobile Card View + Desktop Table
// Clickable Items -> Full Detail & Edit Modal with Staged Uploads
// ============================================================

import React, { useEffect, useState, useRef } from 'react';
import {
  Search, Filter, Trash2, Calendar, FileText, ArrowUpRight, ArrowDownLeft,
  Building2, FolderKanban, ChevronRight, GripVertical, ChevronUp, ChevronDown,
  SlidersHorizontal, RotateCcw, Paperclip, Wallet, Briefcase, X, CheckCircle2
} from 'lucide-react';
import { getTransactions, deleteTransaction, groupAndSortTransactions, saveTransactionCustomOrder } from '../services/transactionService';
import { getProjects } from '../services/projectService';
import { type Transaction, type TransactionType, type TransactionStatus, type Project } from '../types';
import {
  Card, Button, StatusBadge, formatRupiah, formatDate, AttachmentViewer,
  TransactionListSkeleton, EmptyState, TransactionDetailModal
} from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import { isOmzetRil, isOmzetSemu } from '../services/analyticsService';

export function TransactionsList() {
  const { role } = useAuth();
  const { transactions: rawTransactions, projects, loading: globalLoading, addToast, triggerRefresh } = useApp();

  // Selected Transaction for Detail/Edit Modal
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);

  // Filters & Scope
  const [scope, setScope] = useState<'semua' | 'kas_utama' | 'proyek'>('semua');
  const [search, setSearch] = useState('');
  const [filterJenis, setFilterJenis] = useState<TransactionType | 'semua' | 'omzet_ril' | 'omzet_semu'>('semua');
  const [filterKategori, setFilterKategori] = useState('semua');
  const [filterProyekId, setFilterProyekId] = useState('semua');
  const [filterDivisi, setFilterDivisi] = useState<'semua' | 'admin' | 'it' | 'ahli' | 'umum'>('semua');
  const [filterRekening, setFilterRekening] = useState('semua');
  const [filterLampiran, setFilterLampiran] = useState<'semua' | 'ada' | 'tanpa'>('semua');
  const [datePreset, setDatePreset] = useState<'semua' | 'hari_ini' | 'bulan_ini' | 'bulan_lalu' | 'tahun_ini' | 'custom'>('semua');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [isAdvancedFilterOpen, setIsAdvancedFilterOpen] = useState(false);

  // Pagination State
  const [page, setPage] = useState(1);
  const pageSize = 15;

  // Drag & Drop / Reorder State
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  const getProjectName = (proyekId?: string): string => {
    if (!proyekId) return '';
    const p = projects.find(prj => prj.id === proyekId);
    return p ? p.nama : 'Proyek';
  };

  const categories = React.useMemo(() => {
    return Array.from(new Set(rawTransactions.map(t => t.kategori).filter(Boolean)));
  }, [rawTransactions]);

  // Count Active Filters
  const activeFiltersCount = React.useMemo(() => {
    let count = 0;
    if (scope !== 'semua') count++;
    if (filterJenis !== 'semua') count++;
    if (filterKategori !== 'semua') count++;
    if (filterProyekId !== 'semua') count++;
    if (filterDivisi !== 'semua') count++;
    if (filterRekening !== 'semua') count++;
    if (filterLampiran !== 'semua') count++;
    if (datePreset !== 'semua') count++;
    if (dateFrom || dateTo) count++;
    if (search.trim()) count++;
    return count;
  }, [scope, filterJenis, filterKategori, filterProyekId, filterDivisi, filterRekening, filterLampiran, datePreset, dateFrom, dateTo, search]);

  const resetAllFilters = () => {
    setSearch('');
    setScope('semua');
    setFilterJenis('semua');
    setFilterKategori('semua');
    setFilterProyekId('semua');
    setFilterDivisi('semua');
    setFilterRekening('semua');
    setFilterLampiran('semua');
    setDatePreset('semua');
    setDateFrom('');
    setDateTo('');
  };

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [scope, search, filterJenis, filterKategori, filterProyekId, filterDivisi, filterRekening, filterLampiran, datePreset, dateFrom, dateTo]);

  const filtered = React.useMemo(() => {
    if (!rawTransactions || !Array.isArray(rawTransactions)) return [];

    const todayStr = new Date().toISOString().split('T')[0];
    const now = new Date();
    const currentYearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevYearMonth = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, '0')}`;
    const currentYear = `${now.getFullYear()}`;

    return rawTransactions.filter(t => {
      if (!t || typeof t !== 'object') return false;

      const deskripsi = t.deskripsi || '';
      const kategori = t.kategori || '';
      const nominal = t.nominal != null ? Number(t.nominal) : 0;
      const tanggal = t.tanggal || '';

      const isSuntikan =
        deskripsi.startsWith('Suntikan Modal Proyek:') ||
        deskripsi.startsWith('Alokasi Modal Proyek:') ||
        kategori === 'Suntikan Modal Proyek' ||
        kategori === 'Mutasi Internal / Transfer Kas' ||
        kategori === 'Refund Dana Proyek ke Kas Utama';

      if (scope === 'kas_utama' && t.proyekId && !isSuntikan) return false;
      if (scope === 'proyek' && !t.proyekId) return false;

      // Project filter
      if (filterProyekId !== 'semua') {
        if (t.proyekId !== filterProyekId) return false;
      }

      // Search Query
      if (search.trim()) {
        const q = search.toLowerCase().trim();
        const matchDesc = deskripsi.toLowerCase().includes(q);
        const matchKat = kategori.toLowerCase().includes(q);
        const matchNom = nominal.toString().includes(q);
        const matchPrj = getProjectName(t.proyekId).toLowerCase().includes(q);
        const matchPen = (t.penerimaDetail || '').toLowerCase().includes(q);
        const matchTgl = tanggal.includes(q);
        if (!matchDesc && !matchKat && !matchNom && !matchPrj && !matchPen && !matchTgl) return false;
      }
      
      // Jenis Filter
      if (filterJenis === 'masuk') {
        if (t.jenis !== 'masuk') return false;
      } else if (filterJenis === 'omzet_ril') {
        if (t.jenis !== 'masuk' || !isOmzetRil(t)) return false;
      } else if (filterJenis === 'omzet_semu') {
        if (t.jenis !== 'masuk' || !isOmzetSemu(t)) return false;
      } else if (filterJenis === 'keluar') {
        if (t.jenis !== 'keluar') return false;
      }

      // Kategori Filter
      if (filterKategori !== 'semua' && kategori !== filterKategori) return false;

      // Sub-Divisi Filter
      if (filterDivisi !== 'semua' && t.divisi !== filterDivisi) return false;

      // Rekening / Saku Filter
      if (filterRekening !== 'semua' && t.rekeningId !== filterRekening) return false;

      // Lampiran Filter
      if (filterLampiran === 'ada') {
        const hasAtt = (Array.isArray(t.lampiran) && t.lampiran.length > 0) || Boolean(t.buktiTransfer);
        if (!hasAtt) return false;
      } else if (filterLampiran === 'tanpa') {
        const hasAtt = (Array.isArray(t.lampiran) && t.lampiran.length > 0) || Boolean(t.buktiTransfer);
        if (hasAtt) return false;
      }

      // Date Preset Filter
      if (datePreset === 'hari_ini') {
        if (tanggal !== todayStr) return false;
      } else if (datePreset === 'bulan_ini') {
        if (!tanggal.startsWith(currentYearMonth)) return false;
      } else if (datePreset === 'bulan_lalu') {
        if (!tanggal.startsWith(prevYearMonth)) return false;
      } else if (datePreset === 'tahun_ini') {
        if (!tanggal.startsWith(currentYear)) return false;
      } else if (datePreset === 'custom') {
        if (dateFrom && tanggal < dateFrom) return false;
        if (dateTo && tanggal > dateTo) return false;
      }

      return true;
    });
  }, [rawTransactions, scope, search, filterJenis, filterKategori, filterProyekId, filterDivisi, filterRekening, filterLampiran, datePreset, dateFrom, dateTo, projects]);

  // Live Summary from filtered items
  const filterSummary = React.useMemo(() => {
    let masuk = 0;
    let keluar = 0;
    filtered.forEach(t => {
      const nom = Number(t?.nominal) || 0;
      if (t?.jenis === 'masuk') masuk += nom;
      else if (t?.jenis === 'keluar') keluar += nom;
    });
    return {
      masuk,
      keluar,
      net: masuk - keluar,
    };
  }, [filtered]);

  const displaySorted = React.useMemo(() => {
    return groupAndSortTransactions(filtered, 'desc');
  }, [filtered]);

  const totalPages = Math.max(1, Math.ceil(displaySorted.length / pageSize));
  const paginatedSorted = React.useMemo(() => {
    const start = (page - 1) * pageSize;
    return displaySorted.slice(start, start + pageSize);
  }, [displaySorted, page, pageSize]);

  const handleReorderList = async (newList: Transaction[]) => {
    const withUrutan = newList.map((t, idx) => ({
      ...t,
      urutan: idx + 1,
    }));

    const orderedIds = withUrutan.map(t => t.id);
    await saveTransactionCustomOrder(orderedIds);
    addToast('success', 'Urutan posisi transaksi diperbarui!');
    triggerRefresh();
  };

  const handleMoveUp = async (e: React.MouseEvent, index: number) => {
    e.stopPropagation();
    if (index <= 0) return;
    const newList = [...displaySorted];
    const temp = newList[index];
    newList[index] = newList[index - 1];
    newList[index - 1] = temp;
    await handleReorderList(newList);
  };

  const handleMoveDown = async (e: React.MouseEvent, index: number) => {
    e.stopPropagation();
    if (index >= displaySorted.length - 1) return;
    const newList = [...displaySorted];
    const temp = newList[index];
    newList[index] = newList[index + 1];
    newList[index + 1] = temp;
    await handleReorderList(newList);
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIdx(index);
    e.dataTransfer.setData('text/plain', index.toString());
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverIdx !== index) {
      setDragOverIdx(index);
    }
  };

  const handleDrop = async (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    e.stopPropagation();

    const dataIndexStr = e.dataTransfer.getData('text/plain');
    const sourceIndex = draggedIdx !== null ? draggedIdx : (dataIndexStr ? parseInt(dataIndexStr, 10) : null);

    if (sourceIndex === null || isNaN(sourceIndex) || sourceIndex === targetIndex) {
      setDraggedIdx(null);
      setDragOverIdx(null);
      return;
    }

    const newList = [...displaySorted];
    const [movedItem] = newList.splice(sourceIndex, 1);
    newList.splice(targetIndex, 0, movedItem);

    setDraggedIdx(null);
    setDragOverIdx(null);
    await handleReorderList(newList);
  };

  if (globalLoading) return <TransactionListSkeleton />;

  return (
    <div className="space-y-5 animate-fade-in pb-16">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-3xl border border-gray-100 shadow-card">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Semua Transaksi</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Kelola, telusuri, dan atur posisi transaksi ({filtered.length} dari {rawTransactions.length} data)
          </p>
        </div>

        {/* Scope Switcher Tabs */}
        <div className="flex items-center bg-gray-100 p-1.5 rounded-2xl gap-1 font-bold text-xs">
          <button
            type="button"
            onClick={() => setScope('semua')}
            className={`px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5 ${
              scope === 'semua' ? 'bg-slate-900 text-white shadow-sm' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            🌐 Semua
          </button>
          <button
            type="button"
            onClick={() => setScope('kas_utama')}
            className={`px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5 ${
              scope === 'kas_utama' ? 'bg-emerald-600 text-white shadow-sm' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Building2 size={14} /> Kas Utama
          </button>
          <button
            type="button"
            onClick={() => setScope('proyek')}
            className={`px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5 ${
              scope === 'proyek' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <FolderKanban size={14} /> Dana Proyek
          </button>
        </div>
      </div>

      {/* Scope Banner Info */}
      {scope === 'kas_utama' && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-900 font-medium flex items-center gap-2">
          <span>💡</span> <span><strong>Mode Kas Utama:</strong> Menampilkan transaksi brankas kas utama &amp; kucuran modal ke proyek.</span>
        </div>
      )}
      {scope === 'proyek' && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-2xl text-xs text-blue-900 font-medium flex items-center gap-2">
          <span>💡</span> <span><strong>Mode Dana Proyek:</strong> Menampilkan realisasi belanja &amp; refund operasional seluruh proyek.</span>
        </div>
      )}

      {/* Modern Filter & Search Hub Card */}
      <Card className="!p-4 sm:!p-5 border border-gray-100 shadow-card space-y-4">
        {/* Row 1: Search + Quick Type Pills + Advanced Filter Toggle */}
        <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center">
          {/* Search Input with Clear Button */}
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Cari deskripsi, nominal, nama proyek, toko, penerima..."
              className="w-full pl-9 pr-9 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary focus:bg-white transition-all"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Jenis Filter Pills */}
          <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl text-xs font-semibold overflow-x-auto max-w-full">
            {[
              { id: 'semua', label: 'Semua Transaksi' },
              { id: 'omzet_ril', label: '💰 Omzet Riil' },
              { id: 'omzet_semu', label: '📥 Drop Dana' },
              { id: 'keluar', label: '▼ Pengeluaran' },
            ].map(j => (
              <button
                key={j.id}
                onClick={() => setFilterJenis(j.id as any)}
                className={`px-3 py-1.5 rounded-lg transition-all capitalize whitespace-nowrap ${
                  filterJenis === j.id ? 'bg-white text-gray-900 shadow-sm font-bold' : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                {j.label}
              </button>
            ))}
          </div>

          {/* Advanced Filter Toggle Button */}
          <button
            type="button"
            onClick={() => setIsAdvancedFilterOpen(prev => !prev)}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all border ${
              isAdvancedFilterOpen || activeFiltersCount > (scope !== 'semua' ? 1 : 0) + (filterJenis !== 'semua' ? 1 : 0) + (search ? 1 : 0)
                ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
            }`}
          >
            <SlidersHorizontal size={14} />
            <span>Filter Lanjutan</span>
            {activeFiltersCount > 0 && (
              <span className="w-5 h-5 rounded-full bg-emerald-600 text-white text-[10px] flex items-center justify-center font-black">
                {activeFiltersCount}
              </span>
            )}
            {isAdvancedFilterOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>

        {/* Row 2: Expanded Advanced Filter Grid */}
        {isAdvancedFilterOpen && (
          <div className="pt-3 border-t border-gray-100 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2.5 animate-fade-in text-xs font-semibold">
            {/* Filter Proyek Spesifik */}
            <div>
              <label className="text-[10.5px] font-bold text-gray-500 block mb-1">🏢 Proyek Spesifik</label>
              <select
                value={filterProyekId}
                onChange={e => setFilterProyekId(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-2.5 py-2 text-xs font-medium text-gray-800 focus:outline-none focus:ring-2 focus:ring-primary focus:bg-white"
              >
                <option value="semua">Semua Proyek &amp; Kas</option>
                {projects.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.tipe === 'operasional_kantor' ? '💼 Pos: ' : '🏢 Proyek: '}{p.nama}
                  </option>
                ))}
              </select>
            </div>

            {/* Filter Kategori */}
            <div>
              <label className="text-[10.5px] font-bold text-gray-500 block mb-1">🏷️ Kategori</label>
              <select
                value={filterKategori}
                onChange={e => setFilterKategori(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-2.5 py-2 text-xs font-medium text-gray-800 focus:outline-none focus:ring-2 focus:ring-primary focus:bg-white"
              >
                <option value="semua">Semua Kategori</option>
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            {/* Filter Sub-Divisi */}
            <div>
              <label className="text-[10.5px] font-bold text-gray-500 block mb-1">👥 Sub-Divisi</label>
              <select
                value={filterDivisi}
                onChange={e => setFilterDivisi(e.target.value as any)}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-2.5 py-2 text-xs font-medium text-gray-800 focus:outline-none focus:ring-2 focus:ring-primary focus:bg-white"
              >
                <option value="semua">Semua Sub-Divisi</option>
                <option value="admin">💼 Admin</option>
                <option value="it">💻 IT</option>
                <option value="ahli">🛠️ Ahli</option>
                <option value="umum">🌐 Umum</option>
              </select>
            </div>

            {/* Filter Saku / Rekening */}
            <div>
              <label className="text-[10.5px] font-bold text-gray-500 block mb-1">🏦 Saku / Rekening</label>
              <select
                value={filterRekening}
                onChange={e => setFilterRekening(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-2.5 py-2 text-xs font-medium text-gray-800 focus:outline-none focus:ring-2 focus:ring-primary focus:bg-white"
              >
                <option value="semua">Semua Saku</option>
                <option value="bca_utama">🏦 BCA Utama</option>
                <option value="bri_utama">🏦 BRI Utama</option>
                <option value="kas_admin">💵 Kas Operasional Admin</option>
              </select>
            </div>

            {/* Filter Bukti / Lampiran */}
            <div>
              <label className="text-[10.5px] font-bold text-gray-500 block mb-1">📎 Status Lampiran</label>
              <select
                value={filterLampiran}
                onChange={e => setFilterLampiran(e.target.value as any)}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-2.5 py-2 text-xs font-medium text-gray-800 focus:outline-none focus:ring-2 focus:ring-primary focus:bg-white"
              >
                <option value="semua">Semua (Ada/Tanpa)</option>
                <option value="ada">📎 Ada Foto / PDF</option>
                <option value="tanpa">⚠️ Tanpa Lampiran</option>
              </select>
            </div>

            {/* Filter Rentang Waktu */}
            <div>
              <label className="text-[10.5px] font-bold text-gray-500 block mb-1">📅 Periode Waktu</label>
              <select
                value={datePreset}
                onChange={e => setDatePreset(e.target.value as any)}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-2.5 py-2 text-xs font-medium text-gray-800 focus:outline-none focus:ring-2 focus:ring-primary focus:bg-white"
              >
                <option value="semua">Semua Waktu</option>
                <option value="hari_ini">Hari Ini</option>
                <option value="bulan_ini">Bulan Ini</option>
                <option value="bulan_lalu">Bulan Lalu</option>
                <option value="tahun_ini">Tahun Ini</option>
                <option value="custom">⚙️ Custom Tanggal...</option>
              </select>
            </div>

            {/* Custom Date Inputs */}
            {datePreset === 'custom' && (
              <div className="sm:col-span-2 md:col-span-3 lg:col-span-6 flex flex-wrap items-center gap-2 p-2.5 bg-gray-100/70 rounded-xl border border-gray-200">
                <span className="text-[11px] font-bold text-gray-600">Rentang Tanggal:</span>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={e => setDateFrom(e.target.value)}
                  className="bg-white border border-gray-300 rounded-lg px-2 py-1 text-xs text-gray-800 font-medium"
                />
                <span className="text-xs text-gray-400">s/d</span>
                <input
                  type="date"
                  value={dateTo}
                  onChange={e => setDateTo(e.target.value)}
                  className="bg-white border border-gray-300 rounded-lg px-2 py-1 text-xs text-gray-800 font-medium"
                />
              </div>
            )}
          </div>
        )}

        {/* Row 3: Live Subtotal Summary Strip & Reset Button */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-2 border-t border-gray-100">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-gray-500 font-medium">Hasil Filter ({filtered.length} transaksi):</span>
            <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-lg font-bold border border-emerald-200/60">
              Masuk: {formatRupiah(filterSummary.masuk)}
            </span>
            <span className="px-2.5 py-1 bg-red-50 text-red-700 rounded-lg font-bold border border-red-200/60">
              Keluar: {formatRupiah(filterSummary.keluar)}
            </span>
            <span className="px-2.5 py-1 bg-blue-50 text-blue-700 rounded-lg font-bold border border-blue-200/60">
              Net: {filterSummary.net >= 0 ? '+' : ''}{formatRupiah(filterSummary.net)}
            </span>
          </div>

          {activeFiltersCount > 0 && (
            <button
              type="button"
              onClick={resetAllFilters}
              className="text-xs font-bold text-red-600 hover:text-red-700 flex items-center gap-1.5 px-3 py-1 bg-red-50 hover:bg-red-100 rounded-xl transition-all border border-red-200/60"
            >
              <RotateCcw size={12} />
              <span>Reset Filter ({activeFiltersCount})</span>
            </button>
          )}
        </div>
      </Card>

      {/* Transaction List Section */}
      <Card className="!p-4 sm:!p-6">
        {filtered.length === 0 ? (
          <EmptyState
            icon={<FileText size={28} />}
            title="Tidak ada transaksi ditemukan"
            description="Coba ubah filter atau pencarian Anda"
          />
        ) : (
          <>
            {/* MOBILE CARD VIEW WITH DRAG & DROP & UP/DOWN REORDER CONTROLS */}
            <div className="md:hidden space-y-3.5">
              {paginatedSorted.map((tx, idx) => {
                const desc = tx.deskripsi || '';
                const isSuntikan = desc.startsWith('Suntikan Modal Proyek:') || desc.startsWith('Alokasi Modal Proyek:');
                const isKas = !tx.proyekId || isSuntikan;
                const prjName = getProjectName(tx.proyekId);

                return (
                  <div
                    key={tx.id}
                    draggable={true}
                    onDragStart={(e) => handleDragStart(e, idx)}
                    onDragOver={(e) => handleDragOver(e, idx)}
                    onDrop={(e) => handleDrop(e, idx)}
                    onClick={() => setSelectedTx(tx)}
                    className={`p-4 bg-white border rounded-2xl shadow-xs space-y-2.5 transition-all cursor-pointer ${
                      dragOverIdx === idx ? 'bg-emerald-50 border-emerald-500 ring-2 ring-emerald-500/20' : 'border-gray-100 hover:border-gray-200'
                    } ${draggedIdx === idx ? 'opacity-40' : 'opacity-100'}`}
                  >
                    {/* Top Row: Scope Badge, Date & Status */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {/* Drag Handle */}
                        <span 
                          onClick={e => e.stopPropagation()} 
                          className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-emerald-600 p-0.5" 
                          title="Geser posisi"
                        >
                          <GripVertical size={14} />
                        </span>
                        {isKas ? (
                          <span className="text-[11px] px-2.5 py-0.5 bg-emerald-100 text-emerald-800 rounded-full font-bold border border-emerald-200">
                            🏢 Kas Utama
                          </span>
                        ) : (
                          <span className="text-[11px] px-2.5 py-0.5 bg-blue-100 text-blue-800 rounded-full font-bold border border-blue-200">
                            🏗️ {prjName}
                          </span>
                        )}
                        <span className="text-[11px] text-gray-400 font-semibold">{formatDate(tx.tanggal || '')}</span>
                      </div>
                      <StatusBadge status={tx.status} />
                    </div>

                    {/* Middle Row: Description & Nominal */}
                    <div className="flex items-start justify-between gap-2 pt-1 min-w-0">
                      <div className="flex items-start gap-2 flex-1 min-w-0 overflow-hidden">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                          tx.jenis === 'masuk' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                        }`}>
                          {tx.jenis === 'masuk' ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-gray-900 leading-snug break-words">
                            {tx.deskripsi || '-'}
                          </p>
                          <div className="flex items-center gap-1.5 flex-wrap mt-0.5 min-w-0 max-w-full">
                            <p className="text-xs text-gray-500 font-medium whitespace-nowrap">{tx.kategori || '-'}</p>
                            {tx.jenis === 'masuk' && (
                              isOmzetRil(tx) ? (
                                <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-300">
                                  💰 Omzet Riil
                                </span>
                              ) : (
                                <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full border border-amber-300">
                                  📥 Omzet Semu
                                </span>
                              )
                            )}
                            {tx.penerimaDetail && (
                              <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/60 truncate max-w-full">
                                🏦 {tx.penerimaDetail}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="text-right flex-shrink-0 flex items-center gap-1 min-w-max ml-1">
                        <p className={`font-extrabold text-xs sm:text-sm md:text-base whitespace-nowrap tabular-nums ${tx.jenis === 'masuk' ? 'text-emerald-600' : 'text-red-600'}`}>
                          {tx.jenis === 'masuk' ? '+' : '-'}{formatRupiah(tx.nominal || 0)}
                        </p>
                        <ChevronRight size={16} className="text-gray-400 ml-0.5 flex-shrink-0" />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* DESKTOP TABLE VIEW WITH DRAG & DROP REORDERING */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm text-left table-fixed">
                <colgroup>
                  <col className="w-14" />
                  <col className="w-32" />
                  <col className="w-28" />
                  <col className="w-auto" />
                  <col className="w-36" />
                  <col className="w-24" />
                  <col className="w-12" />
                </colgroup>
                <thead className="bg-gray-50 text-gray-600 font-semibold uppercase text-xs border-b border-gray-100">
                  <tr>
                    <th className="px-2 py-3 text-center whitespace-nowrap">Urutan</th>
                    <th className="px-3 py-3 whitespace-nowrap">Sumber Kas</th>
                    <th className="px-3 py-3 whitespace-nowrap">Tanggal</th>
                    <th className="px-4 py-3">Deskripsi &amp; Kategori</th>
                    <th className="px-3 py-3 text-right whitespace-nowrap">Nominal</th>
                    <th className="px-3 py-3 text-center whitespace-nowrap">Status</th>
                    <th className="px-2 py-3 text-center whitespace-nowrap">Detail</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {paginatedSorted.map((tx, idx) => {
                    const desc = tx.deskripsi || '';
                    const isSuntikan = desc.startsWith('Suntikan Modal Proyek:') || desc.startsWith('Alokasi Modal Proyek:');
                    const isKas = !tx.proyekId || isSuntikan;
                    const prjName = getProjectName(tx.proyekId);

                    return (
                      <tr
                        key={tx.id}
                        draggable={true}
                        onDragStart={(e) => handleDragStart(e, idx)}
                        onDragOver={(e) => handleDragOver(e, idx)}
                        onDrop={(e) => handleDrop(e, idx)}
                        onClick={() => setSelectedTx(tx)}
                        className={`hover:bg-emerald-50/40 transition-colors cursor-pointer ${
                          dragOverIdx === idx ? 'bg-emerald-100/70 border-y-2 border-emerald-500' : ''
                        } ${draggedIdx === idx ? 'opacity-40' : 'opacity-100'}`}
                      >
                        {/* Drag & Reorder Column */}
                        <td className="px-2 py-3 text-center" onClick={e => e.stopPropagation()}>
                          <div className="flex items-center gap-0.5 justify-center">
                            <span className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-emerald-600 p-0.5" title="Geser untuk mengatur urutan">
                              <GripVertical size={14} />
                            </span>
                            <div className="flex flex-col">
                              <button
                                type="button"
                                disabled={idx === 0}
                                onClick={(e) => handleMoveUp(e, idx)}
                                className="p-0.5 hover:bg-gray-200 rounded text-gray-500 disabled:opacity-20 transition-colors"
                                title="Naikkan"
                              >
                                <ChevronUp size={11} />
                              </button>
                              <button
                                type="button"
                                disabled={idx === displaySorted.length - 1}
                                onClick={(e) => handleMoveDown(e, idx)}
                                className="p-0.5 hover:bg-gray-200 rounded text-gray-500 disabled:opacity-20 transition-colors"
                                title="Turunkan"
                              >
                                <ChevronDown size={11} />
                              </button>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap truncate">
                          {isKas ? (
                            <span className="text-xs px-2.5 py-0.5 bg-emerald-100 text-emerald-800 rounded-full font-bold border border-emerald-200 whitespace-nowrap">
                              🏢 Kas Utama
                            </span>
                          ) : (
                            <span className="text-xs px-2.5 py-0.5 bg-blue-100 text-blue-800 rounded-full font-bold border border-blue-200 whitespace-nowrap truncate block max-w-full" title={prjName}>
                              🏗️ {prjName}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-gray-600 whitespace-nowrap font-medium text-xs">{formatDate(tx.tanggal || '')}</td>
                        <td className="px-4 py-3 min-w-0">
                          <p className="font-bold text-gray-900 break-words leading-tight">{tx.deskripsi || '-'}</p>
                          <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                            <p className="text-xs text-gray-500 font-medium">{tx.kategori || '-'}</p>
                            {tx.jenis === 'masuk' && (
                              isOmzetRil(tx) ? (
                                <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-300 whitespace-nowrap">
                                  💰 Omzet Riil
                                </span>
                              ) : (
                                <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full border border-amber-300 whitespace-nowrap">
                                  📥 Drop Dana
                                </span>
                              )
                            )}
                            {tx.penerimaDetail && (
                              <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/60 truncate max-w-[220px]">
                                🏦 {tx.penerimaDetail}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-3 text-right whitespace-nowrap">
                          <span className={`font-extrabold tabular-nums ${tx.jenis === 'masuk' ? 'text-emerald-600' : 'text-red-600'}`}>
                            {tx.jenis === 'masuk' ? '+' : '-'}{formatRupiah(tx.nominal || 0)}
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

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-6 pt-4 border-t border-gray-100 text-xs font-semibold text-gray-600">
                <p>
                  Menampilkan {((page - 1) * pageSize) + 1} - {Math.min(page * pageSize, displaySorted.length)} dari {displaySorted.length} transaksi
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                  >
                    Sebelumnya
                  </Button>
                  <span className="px-3 py-1 bg-gray-100 rounded-lg text-gray-800 font-bold">
                    Halaman {page} dari {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  >
                    Selanjutnya
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </Card>

      {/* Universal Detail & Edit Modal */}
      <TransactionDetailModal
        transaction={selectedTx}
        isOpen={!!selectedTx}
        onClose={() => setSelectedTx(null)}
        onUpdate={(updated) => {
          triggerRefresh();
          if (updated) setSelectedTx(updated);
        }}
      />
    </div>
  );
}
