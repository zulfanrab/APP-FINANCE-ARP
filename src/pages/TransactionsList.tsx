// ============================================================
// ARKA Finance — Dedicated Transactions List Module
// Native Mobile Card View (MyBCA style) + Desktop Table
// Zero horizontal scroll on mobile with full multiline descriptions
// ============================================================

import React, { useEffect, useState } from 'react';
import { Search, Filter, Trash2, Calendar, FileText, ArrowUpRight, ArrowDownLeft } from 'lucide-react';
import { getTransactions, deleteTransaction } from '../services/transactionService';
import { type Transaction, type TransactionType, type TransactionStatus } from '../types';
import { Card, Button, StatusBadge, formatRupiah, formatDate, AttachmentViewer, DashboardSkeleton, EmptyState } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';

export function TransactionsList() {
  const { role } = useAuth();
  const { addToast, refreshKey, triggerRefresh } = useApp();

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
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
      const data = await getTransactions();
      setTransactions(data);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Yakin ingin menghapus transaksi ini?')) return;
    try {
      await deleteTransaction(id);
      addToast('success', 'Transaksi berhasil dihapus');
      triggerRefresh();
    } catch {
      addToast('error', 'Gagal menghapus transaksi');
    }
  };

  // Categories list
  const categories = Array.from(new Set(transactions.map(t => t.kategori)));

  // Filtered
  const filtered = transactions.filter(t => {
    if (search) {
      const q = search.toLowerCase();
      const matchDesc = t.deskripsi.toLowerCase().includes(q);
      const matchKat = t.kategori.toLowerCase().includes(q);
      const matchNom = t.nominal.toString().includes(q);
      if (!matchDesc && !matchKat && !matchNom) return false;
    }
    if (filterJenis !== 'semua' && t.jenis !== filterJenis) return false;
    if (filterKategori !== 'semua' && t.kategori !== filterKategori) return false;
    if (filterStatus !== 'semua' && t.status !== filterStatus) return false;
    return true;
  });

  if (loading) return <DashboardSkeleton />;

  return (
    <div className="space-y-6 animate-fade-in pb-16">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-3xl border border-gray-100 shadow-card">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Semua Transaksi</h1>
          <p className="text-xs text-gray-500 mt-0.5">Riwayat lengkap mutasi pengeluaran & pemasukan PT ARP ({filtered.length} data)</p>
        </div>
      </div>

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
              placeholder="Cari deskripsi, nominal, atau kategori..."
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
            description="Coba ubah kata kunci pencarian atau filter Anda"
          />
        ) : (
          <>
            {/* MOBILE CARD VIEW (MyBCA Style - Zero horizontal scroll, full multiline text) */}
            <div className="md:hidden space-y-3.5">
              {filtered.map(tx => (
                <div key={tx.id} className="p-4 bg-gray-50/80 border border-gray-200/80 rounded-2xl space-y-2.5 shadow-sm">
                  {/* Top Row: Date, Category Badge & Status */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[11px] text-gray-400 font-semibold">{formatDate(tx.tanggal)}</span>
                      <span className="text-[10px] px-2 py-0.5 bg-gray-200 text-gray-700 rounded-full font-bold">
                        {tx.kategori}
                      </span>
                      {tx.tag && (
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                          tx.tag === 'operasional' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                        }`}>
                          {tx.tag === 'operasional' ? 'Operasional' : 'Pribadi'}
                        </span>
                      )}
                    </div>
                    <StatusBadge status={tx.status} />
                  </div>

                  {/* Middle Row: Description & Nominal */}
                  <div className="flex items-start justify-between gap-3 pt-1">
                    <div className="flex items-start gap-2.5 flex-1">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                        tx.jenis === 'masuk' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {tx.jenis === 'masuk' ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}
                      </div>
                      <p className="text-sm font-bold text-gray-900 leading-snug break-words flex-1">
                        {tx.deskripsi}
                      </p>
                    </div>

                    <div className="text-right flex-shrink-0">
                      <p className={`font-extrabold text-base ${tx.jenis === 'masuk' ? 'text-emerald-600' : 'text-red-600'}`}>
                        {tx.jenis === 'masuk' ? '+' : '-'}{formatRupiah(tx.nominal)}
                      </p>
                    </div>
                  </div>

                  {/* Attachments */}
                  {tx.lampiran && tx.lampiran.length > 0 && (
                    <div className="pt-2 border-t border-gray-200/60">
                      <AttachmentViewer attachments={tx.lampiran} />
                    </div>
                  )}

                  {/* Bukti Transfer */}
                  {tx.buktiTransfer && (
                    <div className="pt-1">
                      <AttachmentViewer attachments={[{ nama: 'Bukti Transfer.png', tipe: 'image/png', dataUrl: tx.buktiTransfer }]} />
                    </div>
                  )}

                  {/* Admin Delete Option */}
                  {role === 'admin' && (
                    <div className="flex justify-end pt-2 border-t border-gray-200/60">
                      <button
                        onClick={() => handleDelete(tx.id)}
                        className="text-xs text-red-600 hover:text-red-700 font-semibold flex items-center gap-1 py-1 px-2 rounded-lg hover:bg-red-50 transition-colors"
                      >
                        <Trash2 size={13} /> Hapus
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* DESKTOP TABLE VIEW */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-50 text-gray-600 font-semibold uppercase text-xs border-b border-gray-100">
                  <tr>
                    <th className="px-4 py-3">Tanggal</th>
                    <th className="px-4 py-3">Deskripsi &amp; Lampiran</th>
                    <th className="px-4 py-3">Kategori</th>
                    <th className="px-4 py-3">Tag</th>
                    <th className="px-4 py-3 text-right">Nominal</th>
                    <th className="px-4 py-3">Status</th>
                    {role === 'admin' && <th className="px-4 py-3 text-center">Aksi</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filtered.map(tx => (
                    <tr key={tx.id} className="hover:bg-gray-50/80 transition-colors">
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{formatDate(tx.tanggal)}</td>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-gray-900">{tx.deskripsi}</p>
                        {tx.lampiran && tx.lampiran.length > 0 && (
                          <AttachmentViewer attachments={tx.lampiran} />
                        )}
                        {tx.buktiTransfer && (
                          <div className="mt-1">
                            <AttachmentViewer attachments={[{ nama: 'Bukti Transfer.png', tipe: 'image/png', dataUrl: tx.buktiTransfer }]} />
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-600 font-medium">{tx.kategori}</td>
                      <td className="px-4 py-3">
                        {tx.tag ? (
                          <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${
                            tx.tag === 'operasional' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                          }`}>
                            {tx.tag === 'operasional' ? 'Operasional' : 'Pribadi Owner'}
                          </span>
                        ) : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={`font-bold ${tx.jenis === 'masuk' ? 'text-emerald-600' : 'text-red-600'}`}>
                          {tx.jenis === 'masuk' ? '+' : '-'}{formatRupiah(tx.nominal)}
                        </span>
                      </td>
                      <td className="px-4 py-3"><StatusBadge status={tx.status} /></td>
                      {role === 'admin' && (
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => handleDelete(tx.id)}
                            className="text-red-500 hover:text-red-700 p-1.5 rounded-lg hover:bg-red-50 transition-colors"
                            title="Hapus Transaksi"
                          >
                            <Trash2 size={15} />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
