// ============================================================
// ARKA Finance — Trash Bin Page (Kotak Sampah / Riwayat Terhapus)
// Desktop Sub-menu untuk memulihkan / menghapus permanen transaksi
// ============================================================

import React, { useState, useEffect, useMemo } from 'react';
import {
  Trash2, RotateCcw, AlertTriangle, Search, Filter, RefreshCw, Trash, ArrowLeft
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { type Transaction } from '../types';
import {
  getDeletedTransactions,
  restoreTransaction,
  permanentDeleteTransaction,
  emptyTrashBin
} from '../services/transactionService';
import {
  Card, Button, StatusBadge, LoadingSpinner, EmptyState,
  formatRupiah, formatDate, TransactionDetailModal
} from '../components/ui';
import { Modal } from '../components/ui/Modal';
import { useApp } from '../context/AppContext';

export function TrashPage() {
  const navigate = useNavigate();
  const { addToast, triggerRefresh } = useApp();
  const [deletedTxs, setDeletedTxs] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);

  // Modal State
  const [confirmPermanentModal, setConfirmPermanentModal] = useState<Transaction | null>(null);
  const [confirmEmptyModal, setConfirmEmptyModal] = useState<boolean>(false);
  const [actionSaving, setActionSaving] = useState<boolean>(false);

  const fetchDeleted = async () => {
    setLoading(true);
    try {
      const data = await getDeletedTransactions();
      setDeletedTxs(data);
    } catch {
      addToast('error', 'Gagal memuat data kotak sampah');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDeleted();
  }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return deletedTxs;
    const q = search.toLowerCase().trim();
    return deletedTxs.filter(
      t =>
        t.deskripsi.toLowerCase().includes(q) ||
        t.kategori.toLowerCase().includes(q) ||
        formatRupiah(t.nominal).toLowerCase().includes(q)
    );
  }, [deletedTxs, search]);

  const handleRestore = async (tx: Transaction) => {
    setActionSaving(true);
    try {
      await restoreTransaction(tx.id);
      addToast('success', `✅ Transaksi "${tx.deskripsi}" berhasil dipulihkan!`);
      triggerRefresh();
      await fetchDeleted();
    } catch {
      addToast('error', 'Gagal memulihkan transaksi');
    } finally {
      setActionSaving(false);
    }
  };

  const handlePermanentDelete = async () => {
    if (!confirmPermanentModal) return;
    setActionSaving(true);
    try {
      await permanentDeleteTransaction(confirmPermanentModal.id);
      addToast('info', `Transaksi "${confirmPermanentModal.deskripsi}" dihapus secara permanen`);
      setConfirmPermanentModal(null);
      triggerRefresh();
      await fetchDeleted();
    } catch {
      addToast('error', 'Gagal menghapus transaksi secara permanen');
    } finally {
      setActionSaving(false);
    }
  };

  const handleEmptyTrash = async () => {
    setActionSaving(true);
    try {
      await emptyTrashBin();
      addToast('info', 'Kotak sampah berhasil dikosongkan secara permanen');
      setConfirmEmptyModal(false);
      triggerRefresh();
      await fetchDeleted();
    } catch {
      addToast('error', 'Gagal mengosongkan kotak sampah');
    } finally {
      setActionSaving(false);
    }
  };

  if (loading) return <LoadingSpinner size={32} />;

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 text-white p-6 rounded-3xl shadow-xl border border-white/10">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/transaksi')}
              className="p-1.5 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
              title="Kembali ke Riwayat Transaksi"
            >
              <ArrowLeft size={18} />
            </button>
            <h1 className="text-xl font-extrabold flex items-center gap-2 text-white">
              <Trash2 size={22} className="text-red-400" /> Kotak Sampah & Riwayat Terhapus
            </h1>
          </div>
          <p className="text-xs text-slate-400 pl-9">
            Daftar transaksi yang pernah dihapus. Anda dapat memulihkan (restore) data transaksi kembali ke laporan utama kapan saja.
          </p>
        </div>

        {deletedTxs.length > 0 && (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setConfirmEmptyModal(true)}
            icon={<Trash size={15} className="text-red-400" />}
            className="!bg-red-500/10 hover:!bg-red-500/20 !text-red-300 border border-red-500/20 whitespace-nowrap self-start sm:self-auto"
          >
            Kosongkan Kotak Sampah
          </Button>
        )}
      </div>

      {/* Filter & Controls */}
      <Card className="!p-4 bg-white shadow-sm border border-gray-100 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative flex-1 w-full">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Cari deskripsi, nominal, atau kategori transaksi terhapus..."
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-primary bg-gray-50/50"
          />
        </div>
        <div className="flex items-center gap-2 text-xs font-semibold text-gray-500 self-end sm:self-auto">
          <span>{filtered.length} Transaksi Terhapus</span>
          <button
            onClick={fetchDeleted}
            className="p-2 text-gray-500 hover:text-slate-900 rounded-lg hover:bg-gray-100 transition-colors"
            title="Refresh Data"
          >
            <RefreshCw size={14} />
          </button>
        </div>
      </Card>

      {/* Main List */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={<Trash2 size={36} className="text-slate-400" />}
          title="Kotak Sampah Kosong"
          description={search ? 'Tidak ada transaksi terhapus yang cocok dengan pencarian' : 'Semua transaksi aman. Tidak ada transaksi yang pernah dihapus.'}
        />
      ) : (
        <div className="space-y-3">
          {filtered.map(tx => (
            <div
              key={tx.id}
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-white border border-red-100 hover:border-red-300 rounded-2xl transition-all shadow-xs"
            >
              <div className="flex items-start gap-3 flex-1 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-red-50 text-red-600 flex items-center justify-center flex-shrink-0 mt-0.5 border border-red-100">
                  <Trash2 size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                      tx.jenis === 'masuk' ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {tx.jenis === 'masuk' ? '📥 Uang Masuk' : '📤 Uang Keluar'}
                    </span>
                    <span className="text-xs text-gray-400 font-medium">{formatDate(tx.tanggal)}</span>
                    <span className="text-[10px] text-red-500 font-semibold bg-red-50 px-2 py-0.5 rounded-md border border-red-200">
                      🗑️ Terhapus: {tx.deletedAt ? formatDate(tx.deletedAt) : 'Baru Saja'}
                    </span>
                  </div>
                  <p className="font-bold text-gray-900 truncate text-sm">{tx.deskripsi}</p>
                  <p className="text-xs text-gray-500 mt-0.5">Kategori: {tx.kategori}</p>
                </div>
              </div>

              <div className="flex items-center justify-between sm:justify-end gap-4 border-t sm:border-t-0 pt-3 sm:pt-0 border-gray-100">
                <div className="text-left sm:text-right">
                  <p className={`text-base font-extrabold ${tx.jenis === 'masuk' ? 'text-blue-700' : 'text-slate-800'}`}>
                    {tx.jenis === 'masuk' ? '+' : '-'}{formatRupiah(tx.nominal)}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="primary"
                    size="sm"
                    loading={actionSaving}
                    onClick={() => handleRestore(tx)}
                    icon={<RotateCcw size={14} />}
                    className="!bg-emerald-600 hover:!bg-emerald-700 !text-white text-xs whitespace-nowrap shadow-sm"
                  >
                    Kembalikan (Restore)
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={actionSaving}
                    onClick={() => setConfirmPermanentModal(tx)}
                    className="!bg-red-50 hover:!bg-red-100 !text-red-700 border border-red-200 text-xs whitespace-nowrap"
                  >
                    Hapus Permanen
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MODAL 1: CONFIRM PERMANENT DELETE */}
      <Modal
        isOpen={!!confirmPermanentModal}
        onClose={() => setConfirmPermanentModal(null)}
        title="Hapus Transaksi Secara Permanen?"
      >
        {confirmPermanentModal && (
          <div className="space-y-4">
            <div className="p-4 bg-red-50 border border-red-200 text-red-900 rounded-2xl space-y-2">
              <div className="flex items-center gap-2 text-red-700 font-bold">
                <AlertTriangle size={18} />
                <span>Peringatan Permanen!</span>
              </div>
              <p className="text-xs leading-relaxed text-red-800">
                Transaksi <strong>"{confirmPermanentModal.deskripsi}"</strong> sebesar <strong>{formatRupiah(confirmPermanentModal.nominal)}</strong> akan dihapus permanen dari sistem dan tidak dapat dipulihkan lagi.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" size="sm" onClick={() => setConfirmPermanentModal(null)}>Batal</Button>
              <Button
                variant="primary"
                size="sm"
                loading={actionSaving}
                onClick={handlePermanentDelete}
                className="!bg-red-600 hover:!bg-red-700 text-white"
              >
                Hapus Permanen
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* MODAL 2: CONFIRM EMPTY TRASH */}
      <Modal
        isOpen={confirmEmptyModal}
        onClose={() => setConfirmEmptyModal(false)}
        title="Kosongkan Kotak Sampah?"
      >
        <div className="space-y-4">
          <div className="p-4 bg-red-50 border border-red-200 text-red-900 rounded-2xl space-y-2">
            <div className="flex items-center gap-2 text-red-700 font-bold">
              <AlertTriangle size={18} />
              <span>Peringatan Tindakan Masif!</span>
            </div>
            <p className="text-xs leading-relaxed text-red-800">
              Apakah Anda yakin ingin memusnahkan semua <strong>{deletedTxs.length} transaksi</strong> di kotak sampah secara permanen? Aksi ini tidak dapat dibatalkan.
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" size="sm" onClick={() => setConfirmEmptyModal(false)}>Batal</Button>
            <Button
              variant="primary"
              size="sm"
              loading={actionSaving}
              onClick={handleEmptyTrash}
              className="!bg-red-600 hover:!bg-red-700 text-white"
            >
              Ya, Kosongkan Permanen
            </Button>
          </div>
        </div>
      </Modal>

      {/* Transaction Detail Modal */}
      <TransactionDetailModal
        transaction={selectedTx}
        isOpen={!!selectedTx}
        onClose={() => setSelectedTx(null)}
        onUpdate={() => fetchDeleted()}
      />
    </div>
  );
}
