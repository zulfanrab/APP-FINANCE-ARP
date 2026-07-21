// ============================================================
// ARKA Finance — Owner Dashboard
// Includes Owner Quick Transaction / Prive Entry (Instant Approval)
// ============================================================

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Wallet, TrendingUp, TrendingDown, User, Clock, CheckCircle,
  XCircle, Upload, X, ChevronRight, AlertTriangle, PlusCircle, Paperclip, ExternalLink, Sparkles,
  Mic, MicOff, Loader2
} from 'lucide-react';
import { parseVoiceSentenceWithAI } from '../services/aiVoiceService';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend
} from 'recharts';
import {
  getTransactions, updateTransactionStatus, uploadBuktiTransfer, addTransaction
} from '../services/transactionService';
import { getProjects } from '../services/projectService';
import { getDashboardSummary, getMonthlyChartData } from '../services/analyticsService';
import { uploadAttachmentFile } from '../services/storageService';
import { type Transaction, type DashboardSummary, type MonthlyChartData, type Project, type Attachment } from '../types';
import { Card, Button, StatusBadge, LoadingSpinner, EmptyState, DashboardSkeleton, formatRupiah, formatDate, AttachmentViewer } from '../components/ui';
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

function formatRupiahInput(value: string): string {
  const num = value.replace(/\D/g, '');
  if (!num) return '';
  return new Intl.NumberFormat('id-ID').format(Number(num));
}

function parseRupiahInput(value: string): number {
  return Number(value.replace(/\./g, '').replace(',', ''));
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
  const [projectsList, setProjectsList] = useState<Project[]>([]);

  // Reject modal state
  const [rejectModal, setRejectModal] = useState<{ open: boolean; txId: string }>({ open: false, txId: '' });
  const [rejectNote, setRejectNote] = useState('');

  // Transfer proof modal state
  const [transferModal, setTransferModal] = useState<{ open: boolean; txId: string }>({ open: false, txId: '' });
  const [transferFile, setTransferFile] = useState<string | null>(null);
  const [transferFileName, setTransferFileName] = useState('');
  const [transferLoading, setTransferLoading] = useState(false);

  // Owner Quick Entry Modal
  const [quickModalOpen, setQuickModalOpen] = useState(false);
  const [quickForm, setQuickForm] = useState({
    mode: 'prive' as 'prive' | 'operasional' | 'setoran',
    nominalStr: '',
    deskripsi: '',
    proyekId: '',
  });
  const [quickFileLoading, setQuickFileLoading] = useState(false);
  const [quickAttachments, setQuickAttachments] = useState<Attachment[]>([]);
  const [quickSaving, setQuickSaving] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [txns, prjs] = await Promise.all([getTransactions(), getProjects()]);
      setProjectsList(prjs);
      const activePrjCount = prjs.filter(p => p.status === 'aktif').length;
      setSummary(getDashboardSummary(txns, activePrjCount));
      setChartData(getMonthlyChartData(txns));
      setPendingApproval(txns.filter(t => t.status === 'menunggu_approval'));
      setPendingTransfer(txns.filter(t => t.status === 'disetujui'));
    } catch {
      addToast('error', 'Gagal memuat data dashboard');
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => { loadData(); }, [loadData, refreshKey]);

  const handleApprove = async (txId: string) => {
    try {
      await updateTransactionStatus(txId, 'disetujui');
      addToast('success', 'Transaksi disetujui');
      loadData();
    } catch {
      addToast('error', 'Gagal memproses persetujuan');
    }
  };

  const handleReject = async () => {
    if (!rejectNote.trim()) { addToast('error', 'Masukkan alasan penolakan'); return; }
    try {
      await updateTransactionStatus(rejectModal.txId, 'ditolak', rejectNote.trim());
      addToast('success', 'Transaksi ditolak');
      setRejectModal({ open: false, txId: '' });
      setRejectNote('');
      loadData();
    } catch {
      addToast('error', 'Gagal menolak transaksi');
    }
  };

  const handleTransferFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setTransferFileName(file.name);
    setTransferLoading(true);
    try {
      const att = await uploadAttachmentFile(file, {
        tanggal: new Date().toISOString().split('T')[0],
        tag: 'Bukti_Transfer',
      });
      setTransferFile(att.dataUrl);
      addToast('success', 'Bukti transfer berhasil diunggah ke Google Drive');
    } catch {
      addToast('error', 'Gagal mengunggah bukti transfer');
    } finally {
      setTransferLoading(false);
    }
  };

  const handleUploadTransfer = async () => {
    setTransferLoading(true);
    try {
      await uploadBuktiTransfer(transferModal.txId, transferFile || '');
      addToast('success', 'Transaksi berhasil ditandai selesai/sudah transfer!');
      setTransferModal({ open: false, txId: '' });
      setTransferFile(null);
      setTransferFileName('');
      loadData();
    } finally {
      setTransferLoading(false);
    }
  };

  // Quick Attachment Upload for Owner
  const handleQuickFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setQuickFileLoading(true);
    try {
      const att = await uploadAttachmentFile(file, {
        tanggal: new Date().toISOString().split('T')[0],
        tag: quickForm.mode === 'prive' ? 'pribadi' : 'operasional',
      });
      setQuickAttachments(prev => [...prev, att]);
      addToast('success', 'Lampiran berhasil diunggah ke Google Drive');
    } catch {
      addToast('error', 'Gagal mengunggah lampiran');
    } finally {
      setQuickFileLoading(false);
    }
  };

  // Voice Recognition for Pak Fatwa
  const [isListening, setIsListening] = useState(false);
  const [voiceText, setVoiceText] = useState('');
  const [voiceParsing, setVoiceParsing] = useState(false);

  const handleVoiceInput = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      addToast('error', 'Browser tidak mendukung Speech Recognition. Gunakan Chrome / Safari.');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'id-ID';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    setIsListening(true);
    setVoiceText('');

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onresult = async (event: any) => {
      const transcript = event.results[0][0].transcript;
      setVoiceText(transcript);
      setIsListening(false);
      setVoiceParsing(true);

      try {
        const result = await parseVoiceSentenceWithAI(transcript);
        if (result.nominal > 0) {
          setQuickForm(f => ({
            ...f,
            nominalStr: formatRupiahInput(result.nominal.toString()),
            deskripsi: result.deskripsi,
            mode: result.jenisQuick,
          }));
          addToast('success', `✨ AI Suara: ${result.deskripsi} (${formatRupiah(result.nominal)})`);
        } else {
          setQuickForm(f => ({ ...f, deskripsi: transcript }));
          addToast('info', `Suara terdeteksi: "${transcript}". Silakan masukkan nominal.`);
        }
      } catch {
        addToast('error', 'Gagal memproses suara dengan AI.');
      } finally {
        setVoiceParsing(false);
      }
    };

    recognition.onerror = () => {
      setIsListening(false);
      addToast('error', 'Gagal merekam suara. Pastikan izin mikrofon aktif.');
    };

    recognition.start();
  };

  const handleProcessCustomVoiceText = async (text: string) => {
    if (!text.trim()) return;
    setVoiceParsing(true);
    try {
      const result = await parseVoiceSentenceWithAI(text);
      if (result.nominal > 0) {
        setQuickForm(f => ({
          ...f,
          nominalStr: formatRupiahInput(result.nominal.toString()),
          deskripsi: result.deskripsi,
          mode: result.jenisQuick,
        }));
        addToast('success', `✨ AI Suara: ${result.deskripsi} (${formatRupiah(result.nominal)})`);
      } else {
        setQuickForm(f => ({ ...f, deskripsi: text }));
        addToast('info', `Perintah terdeteksi: "${text}". Silakan masukkan nominal.`);
      }
    } catch {
      addToast('error', 'Gagal memproses perintah dengan AI.');
    } finally {
      setVoiceParsing(false);
    }
  };

  // Owner Quick Save Transaction (Instant Finish, No Approval Needed)
  const handleQuickSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const nominal = parseRupiahInput(quickForm.nominalStr);
    if (!nominal || nominal <= 0) {
      addToast('error', 'Masukkan nominal yang valid');
      return;
    }
    if (!quickForm.deskripsi.trim()) {
      addToast('error', 'Masukkan keterangan singkat');
      return;
    }

    setQuickSaving(true);
    try {
      let jenis: 'masuk' | 'keluar' = 'keluar';
      let kategori = 'Prive Owner';
      let tag: 'operasional' | 'pribadi' = 'pribadi';

      if (quickForm.mode === 'prive') {
        jenis = 'keluar';
        kategori = 'Prive Owner';
        tag = 'pribadi';
      } else if (quickForm.mode === 'operasional') {
        jenis = 'keluar';
        kategori = 'Operasional Direct Owner';
        tag = 'operasional';
      } else if (quickForm.mode === 'setoran') {
        jenis = 'masuk';
        kategori = 'Setoran Modal Owner';
        tag = 'operasional';
      }

      await addTransaction({
        tanggal: new Date().toISOString().split('T')[0],
        jenis,
        deskripsi: quickForm.deskripsi.trim(),
        nominal,
        kategori,
        tag,
        proyekId: quickForm.proyekId || undefined,
        lampiran: quickAttachments,
        status: 'selesai', // Directly finished, no approval needed!
      });

      addToast('success', 'Transaksi Owner berhasil dicatat & langsung aktif!');
      setQuickModalOpen(false);
      setQuickForm({ mode: 'prive', nominalStr: '', deskripsi: '', proyekId: '' });
      setQuickAttachments([]);
      loadData();
    } catch {
      addToast('error', 'Gagal mencatat transaksi');
    } finally {
      setQuickSaving(false);
    }
  };

  if (loading) return <DashboardSkeleton />;

  const getDaysPending = (dateStr: string): number => {
    const txDate = new Date(dateStr).getTime();
    const now = new Date().getTime();
    return Math.max(0, Math.floor((now - txDate) / (1000 * 60 * 60 * 24)));
  };

  const overdueApprovalList = pendingApproval.filter(tx => getDaysPending(tx.tanggal) >= 2);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-3xl border border-gray-100 shadow-card">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Dashboard Owner</h1>
          <p className="text-gray-500 text-xs mt-0.5">Ringkasan real-time &amp; kontrol keuangan PT Aksara Riksa Perdana</p>
        </div>

        <Button
          variant="primary"
          icon={<PlusCircle size={15} />}
          onClick={() => setQuickModalOpen(true)}
          className="!bg-slate-900 hover:!bg-slate-800 text-white font-medium text-xs rounded-xl shadow-md border border-slate-800"
        >
          Input Transaksi / Prive
        </Button>
      </div>

      {/* Overdue Approval Alert Banner */}
      {overdueApprovalList.length > 0 && (
        <div className="p-4 bg-amber-500/10 border-2 border-amber-500/40 rounded-3xl flex items-center justify-between gap-3 text-amber-900 shadow-md">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500 text-white flex items-center justify-center font-bold flex-shrink-0">
              <AlertTriangle size={20} />
            </div>
            <div>
              <h3 className="font-bold text-sm text-amber-900 flex items-center gap-2">
                <span>Perhatian Pak Fatwa: Terdapat {overdueApprovalList.length} Transaksi Menunggu Persetujuan &gt;2 Hari</span>
                <span className="w-2 h-2 rounded-full bg-red-500 animate-ping inline-block" />
              </h3>
              <p className="text-xs text-amber-800/80 mt-0.5">Mohon tinjau pengajuan transaksi Admin di bawah untuk memperlancar arus kas.</p>
            </div>
          </div>
        </div>
      )}

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

        {/* Quick Stats */}
        <Card className="flex flex-col justify-between">
          <div>
            <h2 className="text-base font-semibold text-gray-800 mb-4">Status Transaksi</h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-amber-50 rounded-xl">
                <div className="flex items-center gap-2 text-amber-700">
                  <Clock size={16} />
                  <span className="text-sm font-medium">Perlu Persetujuan</span>
                </div>
                <span className="text-lg font-bold text-amber-800">{pendingApproval.length}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-blue-50 rounded-xl">
                <div className="flex items-center gap-2 text-blue-700">
                  <Wallet size={16} />
                  <span className="text-sm font-medium">Perlu Transfer</span>
                </div>
                <span className="text-lg font-bold text-blue-800">{pendingTransfer.length}</span>
              </div>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-gray-100 text-xs text-gray-400">
            Catatan: Transaksi yang belum disetujui tidak mempengaruhi saldo sisa kas.
          </div>
        </Card>
      </div>

      {/* Pending Approval Section */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Clock size={18} className="text-amber-500" />
            <h2 className="text-base font-semibold text-gray-800">Menunggu Persetujuan ({pendingApproval.length})</h2>
          </div>
          {pendingApproval.length > 0 && (
            <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full font-medium">
              Membutuhkan tindakan Anda
            </span>
          )}
        </div>

        {pendingApproval.length === 0 ? (
          <EmptyState
            icon={<CheckCircle size={28} />}
            title="Tidak Ada Transaksi Gantung"
            description="Semua pengajuan transaksi dari Admin sudah diproses"
          />
        ) : (
          <div className="divide-y divide-gray-100">
            {pendingApproval.map(tx => (
              <div key={tx.id} className="py-4 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold ${
                      tx.jenis === 'masuk' ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-red-100 text-red-700'
                    }`}>
                      {tx.jenis === 'masuk' ? '📥 Konfirmasi Uang Masuk Bank' : 'Pengeluaran Operasional'}
                    </span>
                    <span className="text-xs text-gray-400">{formatDate(tx.tanggal)}</span>
                    {getDaysPending(tx.tanggal) >= 2 && (
                      <span className="px-2 py-0.5 rounded-full bg-red-100 border border-red-300 text-red-700 text-[10px] font-extrabold flex items-center gap-1 animate-pulse">
                        <AlertTriangle size={11} /> Pending {getDaysPending(tx.tanggal)} Hari
                      </span>
                    )}
                  </div>
                  <p className="font-bold text-gray-900 truncate">{tx.deskripsi}</p>
                  <p className="text-xs text-gray-500 mt-0.5 font-medium">Kategori: {tx.kategori}</p>
                  {tx.lampiran && tx.lampiran.length > 0 && (
                    <AttachmentViewer attachments={tx.lampiran} />
                  )}
                </div>

                <div className="flex flex-col sm:flex-row items-end sm:items-center justify-between gap-3">
                  <div className="text-right">
                    <p className={`font-extrabold text-base ${tx.jenis === 'masuk' ? 'text-emerald-600' : 'text-red-600'}`}>
                      {tx.jenis === 'masuk' ? '+' : '-'}{formatRupiah(tx.nominal)}
                    </p>
                    {tx.jenis === 'masuk' && (
                      <p className="text-[10px] text-emerald-700 font-semibold mt-0.5">Memerlukan Konfirmasi Masuk Rekening Bank</p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setRejectModal({ open: true, txId: tx.id })}
                      className="px-3 py-1.5 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 text-xs font-semibold flex items-center gap-1 transition-colors"
                    >
                      <XCircle size={14} /> {tx.jenis === 'masuk' ? 'Belum Masuk' : 'Tolak'}
                    </button>
                    <button
                      onClick={() => handleApprove(tx.id)}
                      className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1 shadow-sm transition-all active:scale-95"
                    >
                      <CheckCircle size={14} /> {tx.jenis === 'masuk' ? 'Konfirmasi Uang Masuk' : 'Setujui'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Pending Transfer Section */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Wallet size={18} className="text-blue-500" />
            <h2 className="text-base font-semibold text-gray-800">Menunggu Transfer Selesai ({pendingTransfer.length})</h2>
          </div>
        </div>

        {pendingTransfer.length === 0 ? (
          <EmptyState
            icon={<CheckCircle size={28} />}
            title="Semua Transfer Selesai"
            description="Tidak ada transaksi disetujui yang belum ditransfer"
          />
        ) : (
          <div className="divide-y divide-gray-100">
            {pendingTransfer.map(tx => (
              <div key={tx.id} className="py-4 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <StatusBadge status={tx.status} />
                    <span className="text-xs text-gray-400">{formatDate(tx.tanggal)}</span>
                  </div>
                  <p className="font-semibold text-gray-800 truncate">{tx.deskripsi}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{tx.kategori}</p>
                  {tx.lampiran && tx.lampiran.length > 0 && (
                    <AttachmentViewer attachments={tx.lampiran} />
                  )}
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-4">
                  <p className="font-bold text-base text-red-600">-{formatRupiah(tx.nominal)}</p>
                  <button
                    onClick={() => setTransferModal({ open: true, txId: tx.id })}
                    className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all active:scale-95"
                  >
                    <Upload size={14} /> Tandai Sudah Transfer
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Reject Modal */}
      <Modal isOpen={rejectModal.open} onClose={() => setRejectModal({ open: false, txId: '' })} title="Tolak Transaksi">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">Berikan alasan penolakan untuk transaksi ini agar Admin dapat mengetahuinya.</p>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Alasan Penolakan *</label>
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
      <Modal isOpen={transferModal.open} onClose={() => { setTransferModal({ open: false, txId: '' }); setTransferFile(null); setTransferFileName(''); }} title="Upload Bukti Transfer (Opsional)">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">Upload foto atau screenshot bukti transfer untuk menyelesaikan transaksi ini (Opsional).</p>
          <label className="block">
            <div className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors
              ${transferFile ? 'border-primary bg-primary-light' : 'border-gray-200 hover:border-primary hover:bg-gray-50'}`}>
              <Upload size={24} className="mx-auto text-gray-400 mb-2" />
              <p className="text-sm text-gray-600">{transferFileName || 'Klik untuk pilih file'}</p>
              <p className="text-xs text-gray-400 mt-1">JPG, PNG, PDF (maks 5MB)</p>
            </div>
            <input type="file" accept="image/*,application/pdf" onChange={handleTransferFileChange} className="hidden" />
          </label>

          <div className="flex gap-3 justify-end">
            <Button variant="secondary" onClick={() => { setTransferModal({ open: false, txId: '' }); setTransferFile(null); setTransferFileName(''); }}>Batal</Button>
            <Button variant="primary" icon={<CheckCircle size={16} />} loading={transferLoading} onClick={handleUploadTransfer}>
              Konfirmasi Sudah Transfer
            </Button>
          </div>
        </div>
      </Modal>

      {/* Owner Quick Entry Modal (Instant Finished Transaction with AI Voice Input) */}
      <Modal isOpen={quickModalOpen} onClose={() => setQuickModalOpen(false)} title="Catat Transaksi Owner / Prive">
        <form onSubmit={handleQuickSave} className="space-y-4">
          {/* AI Voice Input Banner */}
          <div className="p-3.5 bg-slate-900 text-white rounded-2xl space-y-2 border border-emerald-500/40 shadow-md">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold flex-shrink-0">
                  <Mic size={18} />
                </div>
                <div>
                  <p className="text-xs font-bold text-white">Input Pakai Suara (AI Voice)</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={voiceText}
                onChange={e => setVoiceText(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleProcessCustomVoiceText(voiceText);
                  }
                }}
                placeholder='Bicara atau ketik contoh: "Tarik prive 5 juta"...'
                className="flex-1 bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-400 placeholder:text-slate-400"
              />
              <button
                type="button"
                onClick={handleVoiceInput}
                className={`px-3 py-2 rounded-xl font-bold text-xs flex items-center gap-1 transition-all active:scale-95 shadow-md flex-shrink-0 ${
                  isListening ? 'bg-red-500 text-white animate-pulse' : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950'
                }`}
                title="Bicara Lewat Mikrofon"
              >
                {isListening ? <MicOff size={15} /> : <Mic size={15} />}
                <span>{isListening ? 'Merekam...' : 'Bicara'}</span>
              </button>
              <button
                type="button"
                onClick={() => handleProcessCustomVoiceText(voiceText)}
                disabled={voiceParsing || !voiceText.trim()}
                className="px-3 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-1 transition-all active:scale-95 shadow-md flex-shrink-0"
              >
                {voiceParsing ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                <span>Ekstrak AI</span>
              </button>
            </div>
          </div>

          {isListening && (
              <div className="p-2 bg-red-500/20 border border-red-500/40 rounded-xl text-center animate-pulse">
                <p className="text-xs font-extrabold text-red-300">🔴 Mendengarkan Suara Pak Fatwa...</p>
                <p className="text-[10px] text-red-200 mt-0.5">Ucapkan contoh: "Beli bensin dan tol 150 ribu operasional" atau "Tarik prive 5 juta"</p>
              </div>
            )}

            {voiceText && !isListening && (
              <div className="p-2 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs text-emerald-300">
                <strong>Suara Terdeteksi:</strong> "{voiceText}"
              </div>
            )}

          <div className="p-3 bg-slate-50 border border-gray-100 rounded-2xl text-xs text-gray-600 leading-relaxed font-medium">
            Pencatatan oleh Owner otomatis berstatus <strong>Selesai</strong> dan langsung aktif di kas perusahaan.
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wider">Peruntukan Transaksi</label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setQuickForm(f => ({ ...f, mode: 'prive' }))}
                className={`py-2 px-3 rounded-xl text-xs font-semibold border transition-all text-center ${
                  quickForm.mode === 'prive'
                    ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                    : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                }`}
              >
                Prive / Pribadi
              </button>
              <button
                type="button"
                onClick={() => setQuickForm(f => ({ ...f, mode: 'operasional' }))}
                className={`py-2 px-3 rounded-xl text-xs font-semibold border transition-all text-center ${
                  quickForm.mode === 'operasional'
                    ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                    : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                }`}
              >
                Operasional Direct
              </button>
              <button
                type="button"
                onClick={() => setQuickForm(f => ({ ...f, mode: 'setoran' }))}
                className={`py-2 px-3 rounded-xl text-xs font-semibold border transition-all text-center ${
                  quickForm.mode === 'setoran'
                    ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                    : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                }`}
              >
                Setoran Modal
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Nominal (Rp) *</label>
            <input
              type="text"
              inputMode="numeric"
              value={quickForm.nominalStr}
              onChange={e => setQuickForm(f => ({ ...f, nominalStr: formatRupiahInput(e.target.value) }))}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-base font-extrabold text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="0"
              required
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Keterangan Singkat *</label>
            <input
              type="text"
              value={quickForm.deskripsi}
              onChange={e => setQuickForm(f => ({ ...f, deskripsi: e.target.value }))}
              className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder={quickForm.mode === 'prive' ? 'Tarik tunai keperluan pribadi' : 'Keterangan belanja...'}
              required
            />
          </div>

          {projectsList.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Tautkan ke Proyek (Opsional)</label>
              <select
                value={quickForm.proyekId}
                onChange={e => setQuickForm(f => ({ ...f, proyekId: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-white"
              >
                <option value="">-- Tanpa Proyek --</option>
                {projectsList.map(p => (
                  <option key={p.id} value={p.id}>{p.nama} ({p.klien})</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Lampiran Struk / Nota (Opsional)</label>
            <div className="flex items-center gap-2">
              <label className="px-3 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-xs font-semibold text-gray-700 cursor-pointer flex items-center gap-1.5 transition-colors">
                <Paperclip size={14} />
                <span>{quickFileLoading ? 'Mengunggah...' : 'Pilih Foto Struk'}</span>
                <input type="file" accept="image/*,application/pdf" onChange={handleQuickFileUpload} className="hidden" disabled={quickFileLoading} />
              </label>
            </div>
            {quickAttachments.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {quickAttachments.map((att, idx) => (
                  <span key={idx} className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-1 rounded-lg flex items-center gap-1 font-medium">
                    <CheckCircle size={12} /> {att.nama}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-2 justify-end pt-3">
            <Button type="button" variant="secondary" onClick={() => setQuickModalOpen(false)}>Batal</Button>
            <Button type="submit" variant="primary" loading={quickSaving}>Simpan & Aktifkan</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
