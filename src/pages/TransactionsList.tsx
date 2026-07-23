// ============================================================
// ARKA Finance — Dedicated Transactions List Module
// Native Mobile Card View + Desktop Table
// Clickable Items -> Full Detail & Edit Modal with Staged Uploads
// ============================================================

import React, { useEffect, useState } from 'react';
import { Search, Filter, Trash2, Calendar, FileText, ArrowUpRight, ArrowDownLeft, Building2, FolderKanban, ChevronRight } from 'lucide-react';
import { getTransactions, deleteTransaction, groupAndSortTransactions } from '../services/transactionService';
import { getProjects } from '../services/projectService';
import { type Transaction, type TransactionType, type TransactionStatus, type Project } from '../types';
import {
  Card, Button, StatusBadge, formatRupiah, formatDate, AttachmentViewer,
  TransactionListSkeleton, EmptyState, TransactionDetailModal
} from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';

export function TransactionsList() {
  const { role } = useAuth();
  const { addToast, refreshKey, triggerRefresh } = useApp();

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  // Selected Transaction for Detail/Edit Modal
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);

  // Filters & Scope
  const [scope, setScope] = useState<'semua' | 'kas_utama' | 'proyek'>('semua');
  const [search, setSearch] = useState('');
  const [filterJenis, setFilterJenis] = useState<TransactionType | 'semua'>('semua');
  const [filterKategori, setFilterKategori] = useState('semua');
  const [filterStatus, setFilterStatus] = useState<TransactionStatus | 'semua'>('semua');

  useEffect(() => {
    loadTransactions();
  }, [refreshKey]);

  const loadTransactions = async () => {
    setLoading(true);
    try {
      const [txs, projs] = await Promise.all([getTransactions(), getProjects()]);
      setTransactions(txs);
      setProjects(projs);
    } finally {
      setLoading(false);
    }
  };

  const getProjectName = (proyekId?: string): string => {
    if (!proyekId) return '';
    const p = projects.find(prj => prj.id === proyekId);
    return p ? p.nama : 'Proyek';
  };

  const categories = Array.from(new Set(transactions.map(t => t.kategori)));

  const filtered = transactions.filter(t => {
    const isSuntikan =
      t.deskripsi.startsWith('Suntikan Modal Proyek:') ||
      t.kategori === 'Suntikan Modal Proyek' ||
      t.kategori === 'Mutasi Internal / Transfer Kas' ||
      t.kategori === 'Refund Dana Proyek ke Kas Utama';

    if (scope === 'kas_utama' && t.proyekId && !isSuntikan) return false;
    if (scope === 'proyek' && !t.proyekId) return false;

    if (search) {
      const q = search.toLowerCase();
      const matchDesc = t.deskripsi.toLowerCase().includes(q);
      const matchKat = t.kategori.toLowerCase().includes(q);
      const matchNom = t.nominal.toString().includes(q);
      const matchPrj = getProjectName(t.proyekId).toLowerCase().includes(q);
      if (!matchDesc && !matchKat && !matchNom && !matchPrj) return false;
    }
    if (filterJenis !== 'semua' && t.jenis !== filterJenis) return false;
    if (filterKategori !== 'semua' && t.kategori !== filterKategori) return false;
    if (filterStatus !== 'semua' && t.status !== filterStatus) return false;
    return true;
  });

  const displaySorted = groupAndSortTransactions(filtered, 'desc');

  if (loading) return <TransactionListSkeleton />;

  return (
    <div className="space-y-6 animate-fade-in pb-16">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-3xl border border-gray-100 shadow-card">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Semua Transaksi</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Klik item mana saja untuk melihat detail &amp; mengedit transaksi ({filtered.length} data)
          </p>
        </div>

        {/* Scope Switcher Tabs */}
        <div className="flex items-center bg-gray-100 p-1.5 rounded-2xl gap-1 font-bold text-xs">
          <button
            type="button"
            onClick={() => setScope('semua')}
            className={`px-3 py-2 rounded-xl transition-all flex items-center gap-1.5 ${
              scope === 'semua' ? 'bg-slate-900 text-white shadow-sm' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            🌐 Semua
          </button>
          <button
            type="button"
            onClick={() => setScope('kas_utama')}
            className={`px-3 py-2 rounded-xl transition-all flex items-center gap-1.5 ${
              scope === 'kas_utama' ? 'bg-emerald-600 text-white shadow-sm' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Building2 size={14} /> Kas Utama
          </button>
          <button
            type="button"
            onClick={() => setScope('proyek')}
            className={`px-3 py-2 rounded-xl transition-all flex items-center gap-1.5 ${
              scope === 'proyek' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <FolderKanban size={14} /> Dana Proyek
          </button>
        </div>
      </div>

      {/* Scope Context Explanation Banner */}
      {scope === 'kas_utama' && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-900 font-medium">
          💡 <strong>Mode Kas Utama:</strong> Menampilkan transaksi brankas kantor &amp; kucuran modal ke proyek.
        </div>
      )}
      {scope === 'proyek' && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-2xl text-xs text-blue-900 font-medium">
          💡 <strong>Mode Internal Proyek:</strong> Menampilkan belanja &amp; refund internal dari dana proyek.
        </div>
      )}

      {/* Filter & Search Bar Card */}
      <Card className="!p-4">
        <div className="flex flex-col md:flex-row gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Cari deskripsi, nominal, atau proyek..."
              className="w-full pl-9 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {/* Jenis Filter Pills */}
          <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl text-xs font-semibold overflow-x-auto max-w-full">
            {(['semua', 'masuk', 'keluar'] as const).map(j => (
              <button
                key={j}
                onClick={() => setFilterJenis(j)}
                className={`px-3 py-1.5 rounded-lg transition-all capitalize ${
                  filterJenis === j ? 'bg-white text-gray-900 shadow-sm font-bold' : 'text-gray-500'
                }`}
              >
                {j === 'semua' ? 'Semua Jenis' : j === 'masuk' ? '▲ Pemasukan' : '▼ Pengeluaran'}
              </button>
            ))}
          </div>

          {/* Kategori Filter */}
          <select
            value={filterKategori}
            onChange={e => setFilterKategori(e.target.value)}
            className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="semua">Semua Kategori</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
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
            {/* MOBILE CARD VIEW (Directly Clickable) */}
            <div className="md:hidden space-y-3.5">
              {displaySorted.map(tx => {
                const isSuntikan = tx.deskripsi.startsWith('Suntikan Modal Proyek:') || tx.deskripsi.startsWith('Alokasi Modal Proyek:');
                const isKas = !tx.proyekId || isSuntikan;
                const prjName = getProjectName(tx.proyekId);

                return (
                  <div
                    key={tx.id}
                    onClick={() => setSelectedTx(tx)}
                    className="p-4 bg-gray-50/90 hover:bg-emerald-50/30 border border-gray-200/80 hover:border-emerald-300 rounded-2xl space-y-2.5 shadow-sm transition-all cursor-pointer active:scale-[0.99]"
                  >
                    {/* Top Row: Scope Badge, Date & Status */}
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {isKas ? (
                          <span className="text-[10px] px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full font-bold border border-emerald-200">
                            🏢 Kas Utama
                          </span>
                        ) : (
                          <span className="text-[10px] px-2 py-0.5 bg-blue-100 text-blue-800 rounded-full font-bold border border-blue-200 truncate max-w-[160px]">
                            🏗️ {prjName}
                          </span>
                        )}
                        <span className="text-[11px] text-gray-400 font-semibold">{formatDate(tx.tanggal)}</span>
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
                            {tx.deskripsi}
                          </p>
                          <div className="flex items-center gap-1.5 flex-wrap mt-0.5 min-w-0 max-w-full">
                            <p className="text-xs text-gray-500 font-medium whitespace-nowrap">{tx.kategori}</p>
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
                          {tx.jenis === 'masuk' ? '+' : '-'}{formatRupiah(tx.nominal)}
                        </p>
                        <ChevronRight size={16} className="text-gray-400 ml-0.5 flex-shrink-0" />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* DESKTOP TABLE VIEW (Directly Clickable Rows) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-50 text-gray-600 font-semibold uppercase text-xs border-b border-gray-100">
                  <tr>
                    <th className="px-4 py-3">Sumber Kas</th>
                    <th className="px-4 py-3">Tanggal</th>
                    <th className="px-4 py-3">Deskripsi &amp; Kategori</th>
                    <th className="px-4 py-3 text-right">Nominal</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-center">Detail</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {displaySorted.map(tx => {
                    const isSuntikan = tx.deskripsi.startsWith('Suntikan Modal Proyek:') || tx.deskripsi.startsWith('Alokasi Modal Proyek:');
                    const isKas = !tx.proyekId || isSuntikan;
                    const prjName = getProjectName(tx.proyekId);

                    return (
                      <tr
                        key={tx.id}
                        onClick={() => setSelectedTx(tx)}
                        className="hover:bg-emerald-50/40 transition-colors cursor-pointer"
                      >
                        <td className="px-4 py-3">
                          {isKas ? (
                            <span className="text-xs px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-full font-bold border border-emerald-200 whitespace-nowrap">
                              🏢 Kas Utama
                            </span>
                          ) : (
                            <span className="text-xs px-2.5 py-1 bg-blue-100 text-blue-800 rounded-full font-bold border border-blue-200 whitespace-nowrap">
                              🏗️ {prjName}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-600 whitespace-nowrap font-medium">{formatDate(tx.tanggal)}</td>
                        <td className="px-4 py-3">
                          <p className="font-bold text-gray-900 break-words">{tx.deskripsi}</p>
                          <div className="flex items-center gap-2 flex-wrap mt-0.5">
                            <p className="text-xs text-gray-500 font-medium">{tx.kategori}</p>
                            {tx.penerimaDetail && (
                              <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/60 truncate max-w-[280px]">
                                🏦 {tx.penerimaDetail}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          <span className={`font-extrabold tabular-nums ${tx.jenis === 'masuk' ? 'text-emerald-600' : 'text-red-600'}`}>
                            {tx.jenis === 'masuk' ? '+' : '-'}{formatRupiah(tx.nominal)}
                          </span>
                        </td>
                        <td className="px-4 py-3"><StatusBadge status={tx.status} /></td>
                        <td className="px-4 py-3 text-center text-gray-400">
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
      </Card>

      {/* Universal Detail & Edit Modal */}
      <TransactionDetailModal
        transaction={selectedTx}
        isOpen={!!selectedTx}
        onClose={() => setSelectedTx(null)}
        onUpdate={loadTransactions}
      />
    </div>
  );
}
