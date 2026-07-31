// ============================================================
// ARKA Finance — Dedicated Transactions List Module
// Native Mobile Card View + Desktop Table
// Clickable Items -> Full Detail & Edit Modal with Staged Uploads
// ============================================================

import React, { useEffect, useState, useRef } from 'react';
import { Search, Filter, Trash2, Calendar, FileText, ArrowUpRight, ArrowDownLeft, Building2, FolderKanban, ChevronRight, GripVertical, ChevronUp, ChevronDown } from 'lucide-react';
import { getTransactions, deleteTransaction, groupAndSortTransactions, saveTransactionCustomOrder } from '../services/transactionService';
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

  const isFirstLoadRef = useRef(true);

  const loadTransactions = async () => {
    if (isFirstLoadRef.current) {
      setLoading(true);
    }
    try {
      const [txs, projs] = await Promise.all([getTransactions(), getProjects()]);
      setTransactions(txs);
      setProjects(projs);
    } finally {
      if (isFirstLoadRef.current) {
        setLoading(false);
        isFirstLoadRef.current = false;
      }
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

  // Drag & Drop / Reorder State
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  const handleReorderList = async (newList: Transaction[]) => {
    const withUrutan = newList.map((t, idx) => ({
      ...t,
      urutan: idx + 1,
    }));

    setTransactions(prev => {
      const remaining = prev.filter(t => !withUrutan.some(n => n.id === t.id));
      return [...withUrutan, ...remaining];
    });

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

  if (loading) return <TransactionListSkeleton />;

  return (
    <div className="space-y-6 animate-fade-in pb-16">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-3xl border border-gray-100 shadow-card">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Semua Transaksi</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Geser (Drag &amp; Drop) atau panah panah untuk mengatur urutan posisi transaksi ({filtered.length} data)
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

      {/* Scope Banner Info */}
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
            {/* MOBILE CARD VIEW WITH DRAG & DROP & UP/DOWN REORDER CONTROLS */}
            <div className="md:hidden space-y-3.5">
              {displaySorted.map((tx, idx) => {
                const isSuntikan = tx.deskripsi.startsWith('Suntikan Modal Proyek:') || tx.deskripsi.startsWith('Alokasi Modal Proyek:');
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
                    className={`p-4 border rounded-2xl space-y-2.5 shadow-sm transition-all cursor-pointer ${
                      dragOverIdx === idx
                        ? 'border-emerald-500 bg-emerald-50/70 ring-2 ring-emerald-400'
                        : 'bg-gray-50/90 hover:bg-emerald-50/30 border-gray-200/80 hover:border-emerald-300'
                    } ${draggedIdx === idx ? 'opacity-40 scale-[0.98]' : 'opacity-100'}`}
                  >
                    {/* Top Drag Control Bar */}
                    <div className="flex items-center justify-between gap-2 border-b border-gray-200/70 pb-2">
                      <div className="flex items-center gap-1 text-gray-400 cursor-grab active:cursor-grabbing select-none" title="Geser (Drag) untuk mengubah urutan">
                        <GripVertical size={16} className="text-gray-400 hover:text-emerald-600" />
                        <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Urutan #{idx + 1}</span>
                      </div>
                      <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={(e) => handleMoveUp(e, idx)}
                          className="p-1 hover:bg-gray-200 active:bg-gray-300 rounded-lg text-gray-600 transition-colors disabled:opacity-20 disabled:hover:bg-transparent"
                          title="Pindahkan Ke Atas"
                        >
                          <ChevronUp size={15} />
                        </button>
                        <button
                          type="button"
                          disabled={idx === displaySorted.length - 1}
                          onClick={(e) => handleMoveDown(e, idx)}
                          className="p-1 hover:bg-gray-200 active:bg-gray-300 rounded-lg text-gray-600 transition-colors disabled:opacity-20 disabled:hover:bg-transparent"
                          title="Pindahkan Ke Bawah"
                        >
                          <ChevronDown size={15} />
                        </button>
                      </div>
                    </div>

                    {/* Scope Badge, Date & Status */}
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

            {/* DESKTOP TABLE VIEW WITH DRAG & DROP REORDERING */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-50 text-gray-600 font-semibold uppercase text-xs border-b border-gray-100">
                  <tr>
                    <th className="px-3 py-3 w-16 text-center">Urutan</th>
                    <th className="px-4 py-3">Sumber Kas</th>
                    <th className="px-4 py-3">Tanggal</th>
                    <th className="px-4 py-3">Deskripsi &amp; Kategori</th>
                    <th className="px-4 py-3 text-right">Nominal</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-center">Detail</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {displaySorted.map((tx, idx) => {
                    const isSuntikan = tx.deskripsi.startsWith('Suntikan Modal Proyek:') || tx.deskripsi.startsWith('Alokasi Modal Proyek:');
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
                        <td className="px-3 py-3 w-16" onClick={e => e.stopPropagation()}>
                          <div className="flex items-center gap-1 justify-center">
                            <span className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-emerald-600 p-1" title="Geser (Drag & Drop) untuk mengatur urutan">
                              <GripVertical size={16} />
                            </span>
                            <div className="flex flex-col gap-0.5">
                              <button
                                type="button"
                                disabled={idx === 0}
                                onClick={(e) => handleMoveUp(e, idx)}
                                className="p-0.5 hover:bg-gray-200 rounded text-gray-500 disabled:opacity-20 transition-colors"
                                title="Naikkan Urutan"
                              >
                                <ChevronUp size={12} />
                              </button>
                              <button
                                type="button"
                                disabled={idx === displaySorted.length - 1}
                                onClick={(e) => handleMoveDown(e, idx)}
                                className="p-0.5 hover:bg-gray-200 rounded text-gray-500 disabled:opacity-20 transition-colors"
                                title="Turunkan Urutan"
                              >
                                <ChevronDown size={12} />
                              </button>
                            </div>
                          </div>
                        </td>
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
        onUpdate={(updated) => {
          loadTransactions();
          if (updated) setSelectedTx(updated);
        }}
      />
    </div>
  );
}
