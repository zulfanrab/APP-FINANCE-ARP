// ============================================================
// ARKA Finance — Owner Dashboard
// ============================================================

import React, { useState, useEffect, useCallback } from 'react';
import {
  Wallet, TrendingUp, TrendingDown, User, Clock, CheckCircle,
  XCircle, Upload, X, ChevronRight, AlertTriangle
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend
} from 'recharts';
import {
  getTransactions, updateTransactionStatus, uploadBuktiTransfer, filterTransactions
} from '../services/transactionService';
import { getProjects } from '../services/projectService';
import { getDashboardSummary, getMonthlyChartData } from '../services/analyticsService';
import { type Transaction, type DashboardSummary, type MonthlyChartData } from '../types';
import { Card, Button, StatusBadge, LoadingSpinner, EmptyState, formatRupiah, formatDate, AttachmentViewer } from '../components/ui';

import { Modal } from '../components/ui/Modal';
import { useApp } from '../context/AppContext';

function SummaryCard({ label, value, icon, color, sub }: {
  label: string; value: string; icon: React.ReactNode; color: string; sub?: string;
}) {
  return (
    <Card className="flex items-start gap-4">
      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 ${color}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-sm text-gray-500 mb-0.5">{label}</p>
        <p className="text-xl font-bold text-gray-800 truncate">{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </Card>
  );
}

const RUPIAH_TOOLTIP = ({ active, payload, label }: any) => {
  if (active && payload?.length) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl px-4 py-3 shadow-lg text-sm">
        <p className="font-medium text-gray-700 mb-2">{label}</p>
        {payload.map((p: any) => (
          <p key={p.name} style={{ color: p.fill }}>
            {p.name === 'pemasukan' ? 'Pemasukan' : 'Pengeluaran'}: {formatRupiah(p.value)}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export function OwnerDashboard() {
  const { addToast, refreshKey } = useApp();
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [chartData, setChartData] = useState<MonthlyChartData[]>([]);
  const [pendingApproval, setPendingApproval] = useState<Transaction[]>([]);
  const [pendingTransfer, setPendingTransfer] = useState<Transaction[]>([]);

  // Reject modal state
  const [rejectModal, setRejectModal] = useState<{ open: boolean; txId: string }>({ open: false, txId: '' });
  const [rejectNote, setRejectNote] = useState('');

  // Transfer proof modal state
  const [transferModal, setTransferModal] = useState<{ open: boolean; txId: string }>({ open: false, txId: '' });
  const [transferFile, setTransferFile] = useState<string | null>(null);
  const [transferFileName, setTransferFileName] = useState('');
  const [transferLoading, setTransferLoading] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [txns, projects] = await Promise.all([getTransactions(), getProjects()]);
      const activeProjects = projects.filter(p => p.status === 'aktif').length;
      setSummary(getDashboardSummary(txns, activeProjects));
      setChartData(getMonthlyChartData(txns, 6));
      setPendingApproval(txns.filter(t => t.status === 'menunggu_approval'));
      setPendingTransfer(txns.filter(t => t.status === 'disetujui'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData, refreshKey]);

  const handleApprove = async (id: string) => {
    await updateTransactionStatus(id, 'disetujui');
    addToast('success', 'Transaksi berhasil disetujui');
    loadData();
  };

  const handleReject = async () => {
    if (!rejectNote.trim()) { addToast('error', 'Harap isi alasan penolakan'); return; }
    await updateTransactionStatus(rejectModal.txId, 'ditolak', rejectNote.trim());
    addToast('success', 'Transaksi ditolak');
    setRejectModal({ open: false, txId: '' });
    setRejectNote('');
    loadData();
  };

  const handleTransferFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setTransferFileName(file.name);
    const reader = new FileReader();
    reader.onload = ev => setTransferFile(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleUploadTransfer = async () => {
    if (!transferFile) { addToast('error', 'Pilih file bukti transfer terlebih dahulu'); return; }
    setTransferLoading(true);
    try {
      await uploadBuktiTransfer(transferModal.txId, transferFile);
      addToast('success', 'Bukti transfer berhasil diunggah, transaksi selesai!');
      setTransferModal({ open: false, txId: '' });
      setTransferFile(null);
      setTransferFileName('');
      loadData();
    } finally {
      setTransferLoading(false);
    }
  };

  if (loading) return <LoadingSpinner size={32} />;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Dashboard Owner</h1>
        <p className="text-gray-500 text-sm mt-1">Ringkasan keuangan PT Aksara Riksa Perdana</p>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <SummaryCard
            label="Sisa Kas"
            value={formatRupiah(summary.sisaKas)}
            icon={<Wallet size={22} className="text-white" />}
            color="gradient-primary"
            sub="Total saldo semua transaksi selesai"
          />
          <SummaryCard
            label="Pemasukan Bulan Ini"
            value={formatRupiah(summary.totalPemasukanBulanIni)}
            icon={<TrendingUp size={22} className="text-white" />}
            color="bg-blue-500"
          />
          <SummaryCard
            label="Pengeluaran Operasional"
            value={formatRupiah(summary.totalPengeluaranOperasionalBulanIni)}
            icon={<TrendingDown size={22} className="text-white" />}
            color="bg-amber-500"
            sub="Bulan ini"
          />
          <SummaryCard
            label="Pribadi Owner (Prive)"
            value={formatRupiah(summary.totalPribadiOwnerBulanIni)}
            icon={<User size={22} className="text-white" />}
            color="bg-purple-500"
            sub="Bulan ini"
          />
        </div>
      )}

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Chart */}
        <Card className="xl:col-span-2 !p-4">
          <h2 className="text-base font-semibold text-gray-800 mb-4 px-2">Pemasukan vs Pengeluaran (6 Bulan)</h2>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
              <XAxis dataKey="bulan" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis
                tickFormatter={(v) => v >= 1000000 ? `${(v / 1000000).toFixed(0)}jt` : `${(v / 1000).toFixed(0)}rb`}
                tick={{ fontSize: 11 }} axisLine={false} tickLine={false}
              />
              <Tooltip content={<RUPIAH_TOOLTIP />} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="pemasukan" fill="#299775" radius={[4, 4, 0, 0]} name="pemasukan" />
              <Bar dataKey="pengeluaran" fill="#DEB660" radius={[4, 4, 0, 0]} name="pengeluaran" />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        {/* Pending Summary */}
        <Card className="flex flex-col gap-4">
          <h2 className="text-base font-semibold text-gray-800">Status Transaksi</h2>
          <div className="flex items-center justify-between p-3 bg-amber-50 rounded-xl">
            <div className="flex items-center gap-2">
              <Clock size={16} className="text-amber-500" />
              <span className="text-sm text-gray-700">Menunggu Approval</span>
            </div>
            <span className="font-bold text-amber-600">{pendingApproval.length}</span>
          </div>
          <div className="flex items-center justify-between p-3 bg-blue-50 rounded-xl">
            <div className="flex items-center gap-2">
              <Upload size={16} className="text-blue-500" />
              <span className="text-sm text-gray-700">Menunggu Transfer</span>
            </div>
            <span className="font-bold text-blue-600">{pendingTransfer.length}</span>
          </div>
        </Card>
      </div>

      {/* Pending Approval */}
      <Card>
        <div className="flex items-center gap-2 mb-4">
          <Clock size={18} className="text-amber-500" />
          <h2 className="text-base font-semibold text-gray-800">Menunggu Approval ({pendingApproval.length})</h2>
        </div>
        {pendingApproval.length === 0 ? (
          <EmptyState icon={<CheckCircle size={28} />} title="Tidak ada transaksi yang menunggu" />
        ) : (
          <div className="space-y-3">
            {pendingApproval.map(tx => (
              <div key={tx.id} className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 border border-gray-100 rounded-xl hover:bg-gray-50 transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${tx.jenis === 'masuk' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {tx.jenis === 'masuk' ? '+ Masuk' : '- Keluar'}
                    </span>
                    {tx.tag && (
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full capitalize">{tx.tag === 'pribadi' ? 'Pribadi Owner' : 'Operasional'}</span>
                    )}
                  </div>
                  <p className="font-medium text-gray-800 truncate">{tx.deskripsi}</p>
                  <p className="text-sm text-gray-500">{formatDate(tx.tanggal)} · {tx.kategori}</p>
                  {tx.lampiran && tx.lampiran.length > 0 && (
                    <AttachmentViewer attachments={tx.lampiran} />
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <p className={`font-bold text-lg ${tx.jenis === 'masuk' ? 'text-green-600' : 'text-red-600'}`}>
                    {tx.jenis === 'masuk' ? '+' : '-'}{formatRupiah(tx.nominal)}
                  </p>
                  <Button
                    variant="primary"
                    size="sm"
                    icon={<CheckCircle size={14} />}
                    onClick={() => handleApprove(tx.id)}
                  >
                    Setujui
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    icon={<XCircle size={14} />}
                    onClick={() => setRejectModal({ open: true, txId: tx.id })}
                  >
                    Tolak
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Pending Transfer */}
      <Card>
        <div className="flex items-center gap-2 mb-4">
          <Upload size={18} className="text-blue-500" />
          <h2 className="text-base font-semibold text-gray-800">Disetujui — Menunggu Transfer ({pendingTransfer.length})</h2>
        </div>
        {pendingTransfer.length === 0 ? (
          <EmptyState icon={<CheckCircle size={28} />} title="Tidak ada transaksi menunggu transfer" />
        ) : (
          <div className="space-y-3">
            {pendingTransfer.map(tx => (
              <div key={tx.id} className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 border border-blue-100 rounded-xl bg-blue-50/30">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-800 truncate">{tx.deskripsi}</p>
                  <p className="text-sm text-gray-500">{formatDate(tx.tanggal)} · {tx.kategori}</p>
                  {tx.lampiran && tx.lampiran.length > 0 && (
                    <AttachmentViewer attachments={tx.lampiran} />
                  )}
                  {tx.buktiTransfer && (
                    <div className="mt-2">
                      <p className="text-xs font-semibold text-emerald-700 mb-1">Bukti Transfer:</p>
                      <AttachmentViewer attachments={[{ nama: 'Bukti Transfer.png', tipe: 'image/png', dataUrl: tx.buktiTransfer }]} />
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <p className="font-bold text-lg text-red-600">-{formatRupiah(tx.nominal)}</p>
                  <Button
                    variant="primary"
                    size="sm"
                    icon={<Upload size={14} />}
                    onClick={() => setTransferModal({ open: true, txId: tx.id })}
                  >
                    Tandai Sudah Transfer
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Reject Modal */}
      <Modal isOpen={rejectModal.open} onClose={() => setRejectModal({ open: false, txId: '' })} title="Tolak Transaksi">
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-3 bg-red-50 rounded-xl">
            <AlertTriangle size={18} className="text-red-500 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-red-700">Harap berikan alasan penolakan yang jelas agar Admin Keuangan dapat menindaklanjuti.</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Alasan Penolakan</label>
            <textarea
              value={rejectNote}
              onChange={e => setRejectNote(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-red-400"
              rows={3}
              placeholder="Masukkan alasan penolakan..."
              autoFocus
            />
          </div>
          <div className="flex gap-3 justify-end">
            <Button variant="secondary" onClick={() => setRejectModal({ open: false, txId: '' })}>Batal</Button>
            <Button variant="danger" icon={<XCircle size={16} />} onClick={handleReject}>Tolak Transaksi</Button>
          </div>
        </div>
      </Modal>

      {/* Transfer Proof Modal */}
      <Modal isOpen={transferModal.open} onClose={() => { setTransferModal({ open: false, txId: '' }); setTransferFile(null); setTransferFileName(''); }} title="Upload Bukti Transfer">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">Upload foto atau screenshot bukti transfer untuk menyelesaikan transaksi ini.</p>
          <label className="block">
            <div className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors
              ${transferFile ? 'border-primary bg-primary-light' : 'border-gray-200 hover:border-primary hover:bg-gray-50'}`}>
              <Upload size={24} className="mx-auto text-gray-400 mb-2" />
              <p className="text-sm text-gray-600">{transferFileName || 'Klik untuk pilih file'}</p>
              <p className="text-xs text-gray-400 mt-1">JPG, PNG, PDF (maks 5MB)</p>
            </div>
            <input type="file" accept="image/*,.pdf" className="hidden" onChange={handleTransferFileChange} />
          </label>
          {transferFile && transferFile.startsWith('data:image') && (
            <img src={transferFile} alt="preview" className="w-full rounded-xl max-h-48 object-contain bg-gray-50 border" />
          )}
          <div className="flex gap-3 justify-end">
            <Button variant="secondary" onClick={() => { setTransferModal({ open: false, txId: '' }); setTransferFile(null); setTransferFileName(''); }}>Batal</Button>
            <Button loading={transferLoading} icon={<CheckCircle size={16} />} onClick={handleUploadTransfer}>Tandai Selesai</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
