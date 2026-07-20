// ============================================================
// ARKA Finance — Project Financial Hub / Detail Page
// Tailored for Admin (full powerful management) & Owner (clean & elegant)
// ============================================================

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Wallet, TrendingUp, TrendingDown, PlusCircle,
  Clock, CheckCircle2, AlertTriangle, Layers, Calendar, User,
  Building2, Trash2, Edit3, PieChart as PieIcon, ExternalLink
} from 'lucide-react';
import { getProjectById, updateProject, deleteProject } from '../services/projectService';
import { getTransactionsByProject, deleteTransaction } from '../services/transactionService';
import { type Project, type Transaction } from '../types';
import {
  Card, Button, StatusBadge, LoadingSpinner, EmptyState,
  formatRupiah, formatDate, AttachmentViewer
} from '../components/ui';
import { Modal } from '../components/ui/Modal';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';

function formatRupiahInput(value: string): string {
  const num = value.replace(/\D/g, '');
  if (!num) return '';
  return new Intl.NumberFormat('id-ID').format(Number(num));
}

export function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { role } = useAuth();
  const { addToast } = useApp();

  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState<Project | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [filterType, setFilterType] = useState<'semua' | 'masuk' | 'keluar'>('semua');

  // Edit Budget Modal
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editBudgetStr, setEditBudgetStr] = useState('');
  const [editNama, setEditNama] = useState('');
  const [editKlien, setEditKlien] = useState('');

  const loadProjectData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [prj, txs] = await Promise.all([
        getProjectById(id),
        getTransactionsByProject(id),
      ]);
      setProject(prj);
      setTransactions(txs);
      if (prj) {
        setEditNama(prj.nama);
        setEditKlien(prj.klien);
        setEditBudgetStr(prj.anggaran ? new Intl.NumberFormat('id-ID').format(prj.anggaran) : '0');
      }
    } catch {
      addToast('error', 'Gagal memuat data proyek');
    } finally {
      setLoading(false);
    }
  }, [id, addToast]);

  useEffect(() => {
    loadProjectData();
  }, [loadProjectData]);

  if (loading) return <LoadingSpinner size={32} />;

  if (!project) {
    return (
      <div className="max-w-xl mx-auto py-12 text-center space-y-4">
        <AlertTriangle size={48} className="mx-auto text-amber-500" />
        <h2 className="text-xl font-bold text-gray-800">Proyek Tidak Ditemukan</h2>
        <Button onClick={() => navigate('/proyek')} icon={<ArrowLeft size={16} />}>
          Kembali ke Daftar Proyek
        </Button>
      </div>
    );
  }

  // Financial Calculations (Excluding initial capital injection from internal operational expenses)
  const anggaranModal = project.anggaran || 0;
  const pemasukanKlien = transactions
    .filter(t => t.jenis === 'masuk' && t.status !== 'ditolak')
    .reduce((sum, t) => sum + t.nominal, 0);

  const pengeluaranTotal = transactions
    .filter(t => t.jenis === 'keluar' && t.status !== 'ditolak' && !t.deskripsi.startsWith('Suntikan Modal Proyek:'))
    .reduce((sum, t) => sum + t.nominal, 0);

  const sisaAnggaranModal = anggaranModal - pengeluaranTotal;
  const profitNetto = pemasukanKlien - pengeluaranTotal;
  const usagePercentage = anggaranModal > 0 ? Math.min(Math.round((pengeluaranTotal / anggaranModal) * 100), 100) : 0;

  const filteredTx = transactions.filter(t => {
    if (t.deskripsi.startsWith('Suntikan Modal Proyek:')) return false;
    if (filterType === 'masuk') return t.jenis === 'masuk';
    if (filterType === 'keluar') return t.jenis === 'keluar';
    return true;
  });

  const handleSaveEdit = async () => {
    const numericBudget = Number(editBudgetStr.replace(/\D/g, ''));
    try {
      await updateProject(project.id, {
        nama: editNama.trim(),
        klien: editKlien.trim(),
        anggaran: numericBudget,
      });
      addToast('success', 'Detail proyek & anggaran berhasil diperbarui');
      setEditModalOpen(false);
      loadProjectData();
    } catch {
      addToast('error', 'Gagal mengupdate proyek');
    }
  };

  const handleDeleteProject = async () => {
    if (window.confirm(`Yakin ingin menghapus proyek "${project.nama}"?`)) {
      try {
        await deleteProject(project.id);
        addToast('success', 'Proyek berhasil dihapus');
        navigate('/proyek');
      } catch {
        addToast('error', 'Gagal menghapus proyek');
      }
    }
  };

  const handleDeleteTx = async (txId: string) => {
    if (window.confirm('Yakin ingin menghapus transaksi ini?')) {
      try {
        await deleteTransaction(txId);
        addToast('success', 'Transaksi berhasil dihapus');
        loadProjectData();
      } catch {
        addToast('error', 'Gagal menghapus transaksi');
      }
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-fade-in pb-12">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-3xl border border-gray-100 shadow-card">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/proyek')}
            className="w-10 h-10 rounded-2xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-600 transition-all active:scale-95 flex-shrink-0"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-gray-900 tracking-tight">{project.nama}</h1>
              <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold ${project.status === 'aktif' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>
                {project.status === 'aktif' ? '● Aktif' : '✓ Selesai'}
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1.5">
              <Building2 size={13} className="text-gray-400" /> Klien: <strong className="text-gray-700">{project.klien}</strong> · Ditambahkan: {formatDate(project.tanggalMulai)}
            </p>
          </div>
        </div>

        {role === 'admin' && (
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" icon={<Edit3 size={15} />} onClick={() => setEditModalOpen(true)}>
              Edit Anggaran
            </Button>
            <Button variant="danger" size="sm" icon={<Trash2 size={15} />} onClick={handleDeleteProject}>
              Hapus
            </Button>
          </div>
        )}
      </div>

      {/* ADMIN VIEW: Powerful Financial Hub */}
      {role === 'admin' ? (
        <div className="space-y-6">
          {/* Financial Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="!p-4 bg-gradient-to-br from-emerald-600 to-teal-700 text-white border-none shadow-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-emerald-100 uppercase tracking-wider">Anggaran Modal Owner</span>
                <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center">
                  <Wallet size={18} className="text-white" />
                </div>
              </div>
              <p className="text-2xl font-extrabold tracking-tight">{formatRupiah(anggaranModal)}</p>
              <p className="text-[11px] text-emerald-200 mt-1">Dikucurkan oleh Pak Fatwa</p>
            </Card>

            <Card className="!p-4 bg-white border border-gray-100 shadow-card">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Pengeluaran Terpakai</span>
                <div className="w-8 h-8 rounded-xl bg-red-50 text-red-500 flex items-center justify-center">
                  <TrendingDown size={18} />
                </div>
              </div>
              <p className="text-2xl font-bold text-red-600 tracking-tight">{formatRupiah(pengeluaranTotal)}</p>
              <p className="text-[11px] text-gray-400 mt-1">{transactions.filter(t => t.jenis === 'keluar').length} transaksi belanja</p>
            </Card>

            <Card className="!p-4 bg-white border border-gray-100 shadow-card">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Sisa Modal di Admin</span>
                <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-500 flex items-center justify-center">
                  <Wallet size={18} />
                </div>
              </div>
              <p className={`text-2xl font-bold tracking-tight ${sisaAnggaranModal >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                {formatRupiah(sisaAnggaranModal)}
              </p>
              <p className="text-[11px] text-gray-400 mt-1">Bisa dipakai belanja proyek</p>
            </Card>

            <Card className="!p-4 bg-white border border-gray-100 shadow-card">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Profit Bersih (Net Margin)</span>
                <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <TrendingUp size={18} />
                </div>
              </div>
              <p className={`text-2xl font-bold tracking-tight ${profitNetto >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {profitNetto >= 0 ? '+' : ''}{formatRupiah(profitNetto)}
              </p>
              <p className="text-[11px] text-gray-400 mt-1">Pemasukan Klien - Pengeluaran</p>
            </Card>
          </div>

          {/* Budget Usage Progress Bar */}
          <Card className="!p-5 border border-gray-100 shadow-card">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <PieIcon size={18} className="text-primary" />
                <h3 className="text-sm font-bold text-gray-800">Pemakaian Anggaran Modal ({usagePercentage}%)</h3>
              </div>
              <span className="text-xs font-bold text-gray-600">
                {formatRupiah(pengeluaranTotal)} / {formatRupiah(anggaranModal)}
              </span>
            </div>

            <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden p-0.5">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  usagePercentage > 90
                    ? 'bg-red-500'
                    : usagePercentage > 75
                    ? 'bg-amber-500'
                    : 'bg-emerald-500'
                }`}
                style={{ width: `${usagePercentage}%` }}
              />
            </div>
          </Card>
        </div>
      ) : (
        /* OWNER VIEW: Super Clean & Elegant Summary */
        <div className="space-y-6">
          <Card className="!p-6 bg-slate-900 text-white rounded-3xl border border-white/10 shadow-2xl">
            <h2 className="text-base font-bold text-emerald-400 mb-4 flex items-center gap-2">
              👑 Ringkasan Keuangan Proyek (Owner Overview)
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              <div>
                <p className="text-xs text-slate-400 mb-1">Total Pemasukan Klien</p>
                <p className="text-2xl font-extrabold text-white">{formatRupiah(pemasukanKlien)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 mb-1">Total Pengeluaran Proyek</p>
                <p className="text-2xl font-extrabold text-amber-400">{formatRupiah(pengeluaranTotal)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 mb-1">Profit Bersih (Cuan Proyek)</p>
                <p className={`text-2xl font-extrabold ${profitNetto >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {profitNetto >= 0 ? '+' : ''}{formatRupiah(profitNetto)}
                </p>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-white/10 flex items-center justify-between text-xs text-slate-400">
              <span>Modal Diberikan: <strong className="text-white">{formatRupiah(anggaranModal)}</strong></span>
              <span>Sisa Modal Admin: <strong className="text-emerald-300">{formatRupiah(sisaAnggaranModal)}</strong></span>
            </div>
          </Card>
        </div>
      )}

      {/* Transactions Section */}
      <Card className="!p-5 border border-gray-100 shadow-card">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5 pb-4 border-b border-gray-100">
          <div>
            <h2 className="text-base font-bold text-gray-900">Daftar Transaksi Proyek ({filteredTx.length})</h2>
            <p className="text-xs text-gray-500 mt-0.5">Semua pengeluaran & pemasukan terkait proyek ini</p>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl text-xs font-semibold">
              <button
                onClick={() => setFilterType('semua')}
                className={`px-3 py-1.5 rounded-lg transition-all ${filterType === 'semua' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}
              >
                Semua
              </button>
              <button
                onClick={() => setFilterType('keluar')}
                className={`px-3 py-1.5 rounded-lg transition-all ${filterType === 'keluar' ? 'bg-white text-red-600 shadow-sm' : 'text-gray-500'}`}
              >
                Pengeluaran
              </button>
              <button
                onClick={() => setFilterType('masuk')}
                className={`px-3 py-1.5 rounded-lg transition-all ${filterType === 'masuk' ? 'bg-white text-emerald-600 shadow-sm' : 'text-gray-500'}`}
              >
                Pemasukan
              </button>
            </div>

            {role === 'admin' && (
              <Button
                variant="primary"
                size="sm"
                icon={<PlusCircle size={15} />}
                onClick={() => navigate('/transaksi/baru')}
              >
                + Input Pengeluaran
              </Button>
            )}
          </div>
        </div>

        {filteredTx.length === 0 ? (
          <EmptyState icon={<Layers size={28} />} title="Belum Ada Transaksi Proyek" description="Semua transaksi pengeluaran/pemasukan proyek akan tampil di sini" />
        ) : (
          <div className="space-y-3">
            {filteredTx.map(tx => (
              <div key={tx.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-gray-50/70 hover:bg-gray-100/80 border border-gray-100 rounded-2xl transition-all">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${tx.jenis === 'masuk' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                      {tx.jenis === 'masuk' ? '+ Pemasukan Klien' : '- Pengeluaran Proyek'}
                    </span>
                    <span className="text-xs text-gray-500 font-medium">{formatDate(tx.tanggal)}</span>
                    <StatusBadge status={tx.status} />
                  </div>
                  <p className="font-bold text-gray-900 truncate text-sm">{tx.deskripsi}</p>
                  <p className="text-xs text-gray-500">{tx.kategori}</p>

                  {/* Attachment Viewer */}
                  {tx.lampiran && tx.lampiran.length > 0 && (
                    <AttachmentViewer attachments={tx.lampiran} />
                  )}
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-gray-200">
                  <span className={`font-extrabold text-base ${tx.jenis === 'masuk' ? 'text-emerald-600' : 'text-red-600'}`}>
                    {tx.jenis === 'masuk' ? '+' : '-'}{formatRupiah(tx.nominal)}
                  </span>

                  {role === 'admin' && (
                    <button
                      onClick={() => handleDeleteTx(tx.id)}
                      className="text-gray-400 hover:text-red-500 p-1.5 rounded-xl hover:bg-red-50 transition-colors"
                      title="Hapus Transaksi"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Edit Budget Modal */}
      <Modal isOpen={editModalOpen} onClose={() => setEditModalOpen(false)} title="Edit Detail & Anggaran Proyek">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Nama Proyek</label>
            <input
              type="text"
              value={editNama}
              onChange={e => setEditNama(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Nama Klien</label>
            <input
              type="text"
              value={editKlien}
              onChange={e => setEditKlien(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Anggaran Modal dari Pak Fatwa (Rp)</label>
            <input
              type="text"
              inputMode="numeric"
              value={editBudgetStr}
              onChange={e => setEditBudgetStr(formatRupiahInput(e.target.value))}
              className="w-full border border-gray-200 rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary font-bold text-emerald-700"
            />
          </div>

          <div className="flex gap-2 justify-end pt-3">
            <Button variant="secondary" size="sm" onClick={() => setEditModalOpen(false)}>Batal</Button>
            <Button variant="primary" size="sm" onClick={handleSaveEdit}>Simpan Perubahan</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
