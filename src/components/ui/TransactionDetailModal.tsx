// ============================================================
// ARKA Finance — Universal Transaction Detail & Edit Modal
// Full interactive detail view + inline edit with attachment manager
// Includes Recipient Autofill, Bank Auto-Detection & Auto-Split Admin Fee
// ============================================================

import React, { useState, useEffect, useRef } from 'react';
import {
  X, Edit3, Trash2, Calendar, FileText, Building2, FolderKanban,
  CheckCircle2, ArrowUpRight, ArrowDownLeft, Paperclip, Upload, Plus, Save, Loader2, Tag, AlertTriangle, Landmark, Zap
} from 'lucide-react';
import { Modal } from './Modal';
import { AttachmentViewer } from './AttachmentViewer';
import { type Transaction, type Project, type JalurTransfer } from '../../types';
import { updateTransaction, deleteTransaction, getTransactions } from '../../services/transactionService';
import { getProjects } from '../../services/projectService';
import { getCategories } from '../../services/categoryService';
import { uploadAttachmentFile, compressFileToAttachment } from '../../services/storageService';
import { formatRupiah, formatDate, StatusBadge } from './index';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { parseRecipientString, extractHistoricalRecipients } from '../../utils/bankHelper';

interface TransactionDetailModalProps {
  transaction: Transaction | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdate?: (updatedTx?: Transaction) => void;
}

interface StagedAttachment {
  nama: string;
  tipe: string;
  dataUrl: string;
  fileObj?: File;
}

function formatRupiahInput(value: string): string {
  const num = value.replace(/\D/g, '');
  if (!num) return '';
  return new Intl.NumberFormat('id-ID').format(Number(num));
}

function parseRupiahInput(value: string): number {
  return Number(value.replace(/\./g, '').replace(',', ''));
}

function getDriveFileId(url: string): string | null {
  if (!url) return null;
  const match = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) || url.match(/id=([a-zA-Z0-9_-]+)/);
  return match ? match[1] : null;
}

function normalizeAttachments(raw: any): { nama: string; tipe: string; dataUrl: string }[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string' && raw.trim().startsWith('[')) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    } catch { /* ignore */ }
  }
  return [];
}

export function TransactionDetailModal({
  transaction,
  isOpen,
  onClose,
  onUpdate,
}: TransactionDetailModalProps) {
  const { role } = useAuth();
  const { addToast, triggerRefresh } = useApp();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Internal transaction state — survives parent re-renders
  const [currentTx, setCurrentTx] = useState<Transaction | null>(null);
  const prevTxIdRef = useRef<string | null>(null);

  const [projects, setProjects] = useState<Project[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [historicalRecipients, setHistoricalRecipients] = useState<string[]>([]);

  const [stagedAttachments, setStagedAttachments] = useState<StagedAttachment[]>([]);
  const [dragActive, setDragActive] = useState(false);

  // Edit Form state
  const [editForm, setEditForm] = useState({
    tanggal: '',
    jenis: 'keluar' as 'masuk' | 'keluar',
    deskripsi: '',
    nominalStr: '',
    kategori: '',
    tag: 'operasional' as 'operasional' | 'pribadi',
    proyekId: '',
    penerimaDetail: '',
    jalurTransfer: 'sesama_bca' as JalurTransfer,
    adminNominalCustomStr: '1.000',
    divisi: undefined as 'admin' | 'ahli' | 'it' | 'umum' | undefined,
  });

  useEffect(() => {
    getStoredRole().then(r => setRole(r));
  }, []);

  const populateFormAndAttachments = (targetTx: Transaction) => {
    setEditForm({
      tanggal: targetTx.tanggal,
      jenis: targetTx.jenis,
      deskripsi: targetTx.deskripsi,
      nominalStr: formatRupiahInput(targetTx.nominal.toString()),
      kategori: targetTx.kategori,
      tag: targetTx.tag || 'operasional',
      proyekId: targetTx.proyekId || '',
      penerimaDetail: targetTx.penerimaDetail || '',
      jalurTransfer: targetTx.jalurTransfer || 'sesama_bca',
      adminNominalCustomStr: targetTx.adminNominalCustom ? formatRupiahInput(targetTx.adminNominalCustom.toString()) : '1.000',
      divisi: targetTx.divisi || undefined,
    });

    const parsedLampiran = normalizeAttachments(targetTx.lampiran);
    const initialStaged: StagedAttachment[] = [];

    if (targetTx.buktiTransfer && targetTx.buktiTransfer.trim()) {
      initialStaged.push({
        nama: 'Bukti Transfer Bank',
        tipe: 'image/png',
        dataUrl: targetTx.buktiTransfer,
      });
    }

    parsedLampiran.forEach(att => {
      if (att && att.dataUrl && !initialStaged.some(a => a.dataUrl === att.dataUrl)) {
        initialStaged.push({
          nama: att.nama || 'Lampiran',
          tipe: att.tipe || 'image/jpeg',
          dataUrl: att.dataUrl,
        });
      }
    });

    setStagedAttachments(initialStaged);
  };

  const handleStartEditing = () => {
    const targetTx = currentTx || transaction;
    if (targetTx) {
      populateFormAndAttachments(targetTx);
    }
    setIsEditing(true);
  };

  // CRITICAL: Only reset form when a DIFFERENT transaction is opened or updated
  useEffect(() => {
    const txId = transaction?.id ?? null;
    if (isOpen && transaction) {
      const isNewTx = txId !== prevTxIdRef.current;
      const isUpdatedTx = currentTx && (
        normalizeAttachments(transaction.lampiran).length > normalizeAttachments(currentTx.lampiran).length ||
        transaction.diupdatePada !== currentTx.diupdatePada
      );

      if (isNewTx || isUpdatedTx) {
        prevTxIdRef.current = txId;
        setCurrentTx(transaction);
        if (isNewTx) setIsEditing(false);
        populateFormAndAttachments(transaction);

        Promise.all([getProjects(), getCategories(transaction.jenis), getTransactions()]).then(
          ([projs, cats, txs]) => {
            setProjects(projs);
            setCategories(cats);
            setHistoricalRecipients(extractHistoricalRecipients(txs));
          }
        );
      }
    }
    if (!isOpen) {
      prevTxIdRef.current = null;
    }
  }, [transaction?.id, isOpen]);

  // Use currentTx for display; fallback to prop
  const displayTx = currentTx || transaction;
  if (!displayTx) return null;

  const projectObj = projects.find(p => p.id === displayTx.proyekId);
  const isKasUtama = !displayTx.proyekId;

  // Instant zero-lag Blob Object URL file staging for mobile HP
  const handleSelectFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const newStaged: StagedAttachment[] = files.map(file => ({
      nama: file.name,
      tipe: file.type || (file.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg'),
      dataUrl: '',
      previewUrl: URL.createObjectURL(file),
      fileObj: file,
    }));

    setStagedAttachments(prev => [...prev, ...newStaged]);
    addToast('success', `✅ ${newStaged.length} foto/berkas berhasil dilampirkan.`);
    e.target.value = '';
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const files = Array.from(e.dataTransfer.files);
      const newStaged: StagedAttachment[] = files.map(file => ({
        nama: file.name,
        tipe: file.type || (file.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg'),
        dataUrl: '',
        previewUrl: URL.createObjectURL(file),
        fileObj: file,
      }));
      setStagedAttachments(prev => [...prev, ...newStaged]);
      addToast('success', `✅ ${newStaged.length} foto/berkas berhasil dilampirkan.`);
    }
  };

  const handleRemoveStagedAttachment = (idx: number) => {
    setStagedAttachments(prev => {
      const target = prev[idx];
      if (target?.previewUrl) {
        URL.revokeObjectURL(target.previewUrl);
      }
      return prev.filter((_, i) => i !== idx);
    });
  };

  const handleSave = async () => {
    (document.activeElement as HTMLElement)?.blur(); // Dismiss mobile keyboard smoothly
    const nominal = parseRupiahInput(editForm.nominalStr);
    if (!nominal || nominal <= 0) {
      addToast('error', 'Nominal harus lebih dari 0');
      return;
    }
    if (!editForm.deskripsi.trim()) {
      addToast('error', 'Deskripsi wajib diisi');
      return;
    }

    setSaving(true);
    await new Promise(r => setTimeout(r, 40)); // Yield to main thread so loading spinner renders smoothly
    try {
      const finalAttachments = [];
      const currentProject = projects.find(p => p.id === editForm.proyekId);

      for (const att of stagedAttachments) {
        if (att.fileObj) {
          try {
            const uploaded = await uploadAttachmentFile(att.fileObj, {
              tanggal: editForm.tanggal,
              tag: editForm.tag,
              proyekNama: currentProject?.nama,
            });
            if (uploaded && uploaded.dataUrl) {
              finalAttachments.push(uploaded);
            } else {
              const fallbackAtt = await compressFileToAttachment(att.fileObj);
              finalAttachments.push(fallbackAtt);
            }
          } catch {
            try {
              const fallbackAtt = await compressFileToAttachment(att.fileObj);
              finalAttachments.push(fallbackAtt);
            } catch {
              finalAttachments.push({
                nama: att.nama,
                tipe: att.tipe,
                dataUrl: att.dataUrl || '',
              });
            }
          }
        } else {
          finalAttachments.push({
            nama: att.nama,
            tipe: att.tipe,
            dataUrl: att.dataUrl,
          });
        }
      }

      const adminNominalCustom = parseRupiahInput(editForm.adminNominalCustomStr || '0');

      const updatedTx = await updateTransaction(displayTx.id, {
        tanggal: editForm.tanggal,
        jenis: editForm.jenis,
        deskripsi: editForm.deskripsi.trim(),
        nominal,
        kategori: editForm.kategori,
        tag: editForm.jenis === 'keluar' ? editForm.tag : undefined,
        proyekId: editForm.proyekId || undefined,
        lampiran: finalAttachments,
        penerimaDetail: editForm.jenis === 'keluar' ? (editForm.penerimaDetail.trim() || undefined) : undefined,
        jalurTransfer: editForm.jenis === 'keluar' ? editForm.jalurTransfer : undefined,
        adminNominalCustom: editForm.jenis === 'keluar' && editForm.jalurTransfer === 'custom' ? adminNominalCustom : undefined,
        divisi: editForm.divisi || undefined,
      });

      // Update internal state so the view mode immediately reflects the saved data
      setCurrentTx(updatedTx);
      setStagedAttachments(
        (updatedTx.lampiran || []).map(att => ({
          nama: att.nama,
          tipe: att.tipe,
          dataUrl: att.dataUrl,
        }))
      );

      addToast('success', `Transaksi diperbarui! (${finalAttachments.length} lampiran tersimpan)`);
      setIsEditing(false);
      triggerRefresh();
      if (onUpdate) onUpdate(updatedTx);
    } catch (err: any) {
      addToast('error', err?.message || 'Gagal memperbarui transaksi');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (window.confirm(`Yakin ingin menghapus transaksi "${displayTx.deskripsi}"?`)) {
      setDeleting(true);
      try {
        await deleteTransaction(displayTx.id);
        addToast('success', 'Transaksi berhasil dihapus');
        triggerRefresh();
        if (onUpdate) onUpdate();
        onClose();
      } catch {
        addToast('error', 'Gagal menghapus transaksi');
      } finally {
        setDeleting(false);
      }
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isEditing ? 'Edit Transaksi' : 'Detail Transaksi'} size="lg">
      <div className="space-y-5">
        {!isEditing ? (
          /* ================= VIEW MODE ================= */
          <div className="space-y-5">
            {/* Top Info Header */}
            <div className="p-4 bg-slate-900 text-white rounded-2xl space-y-3 shadow-md">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                {isKasUtama ? (
                  <span className="text-xs px-3 py-1 bg-emerald-500/20 text-emerald-300 rounded-full font-bold border border-emerald-500/40">
                    🏢 Kas Utama Perusahaan
                  </span>
                ) : (
                  <span className="text-xs px-3 py-1 bg-blue-500/20 text-blue-300 rounded-full font-bold border border-blue-500/40">
                    🏗️ {projectObj ? projectObj.nama : 'Internal Proyek'}
                  </span>
                )}
                <StatusBadge status={displayTx.status} />
              </div>

              <div className="min-w-0">
                <p className="text-xs text-slate-400 mb-0.5">Nominal Transaksi</p>
                <p className={`text-2xl sm:text-3xl font-extrabold truncate tabular-nums tracking-tight ${displayTx.jenis === 'masuk' ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {displayTx.jenis === 'masuk' ? '+' : '-'}{formatRupiah(displayTx.nominal)}
                </p>
              </div>

              <div className="pt-2 border-t border-white/10 flex items-center justify-between text-xs text-slate-300 gap-2 flex-wrap min-w-0">
                <span className="truncate">Tanggal: <strong className="text-white">{formatDate(displayTx.tanggal)}</strong></span>
                <span className="truncate">Kategori: <strong className="text-emerald-300">{displayTx.kategori}</strong></span>
              </div>
            </div>

            {/* Rejection Note from Management */}
            {displayTx.status === 'ditolak' && displayTx.catatanPenolakan && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-2xl space-y-1.5 text-xs text-red-900 shadow-sm animate-fade-in">
                <div className="flex items-center gap-1.5 font-bold text-red-700">
                  <AlertTriangle size={15} />
                  <span>Komentar / Alasan Penolakan Manajemen:</span>
                </div>
                <p className="font-semibold text-slate-800 bg-white p-3 rounded-xl border border-red-200 italic leading-relaxed break-words">
                  "{displayTx.catatanPenolakan}"
                </p>
              </div>
            )}

            {/* Recipient Details & Transfer Channel */}
            {displayTx.penerimaDetail && (
              <div className="p-3.5 bg-emerald-50/80 border border-emerald-200/90 rounded-2xl space-y-1 text-xs min-w-0">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider flex items-center gap-1">
                    <Landmark size={12} /> Penerima / Tujuan Transfer
                  </span>
                  {displayTx.jalurTransfer && (
                    <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 truncate max-w-full">
                      {displayTx.jalurTransfer === 'sesama_bca' ? '⚡ BCA/QRIS/VA (Rp0)' : displayTx.jalurTransfer === 'ewallet' ? '⚡ Top Up E-Wallet (Rp 1.000)' : displayTx.jalurTransfer === 'bi_fast' ? '⚡ BI-FAST (Rp 2.500)' : displayTx.jalurTransfer === 'online_rtgs' ? '⚡ Online/RTGS (Rp 6.500)' : '⚡ Custom Admin'}
                    </span>
                  )}
                </div>
                <p className="text-sm font-extrabold text-slate-900 break-words">{displayTx.penerimaDetail}</p>
              </div>
            )}

            {/* Parent Relational Link Badge (If this transaction is an Admin Fee Child Entry) */}
            {displayTx.parentTransactionId && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-2xl text-xs text-blue-900 font-medium flex items-center justify-between">
                <span className="flex items-center gap-1.5 font-bold">
                  <Zap size={14} className="text-blue-600" /> Entri Biaya Admin Bank (Terikat ke Transaksi Utama)
                </span>
                <span className="text-[10px] font-extrabold px-2.5 py-0.5 bg-blue-200 text-blue-900 rounded-full">Auto-Split</span>
              </div>
            )}

            {/* Description Card */}
            <div className="p-4 bg-gray-50 border border-gray-100 rounded-2xl space-y-2">
              <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Deskripsi / Keterangan</h4>
              <p className="text-sm font-semibold text-gray-900 leading-relaxed whitespace-pre-wrap">{displayTx.deskripsi}</p>

              {displayTx.tag && (
                <div className="pt-2 flex items-center gap-2 text-xs flex-wrap">
                  <span className="text-gray-400">Peruntukan:</span>
                  <span className={`px-2.5 py-0.5 rounded-full font-semibold ${
                    displayTx.tag === 'operasional' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'
                  }`}>
                    {displayTx.tag === 'operasional' ? '🏢 Operasional' : '👤 Non-Operasional / Prive'}
                  </span>
                  {displayTx.divisi && (
                    <span className="px-2.5 py-0.5 rounded-full font-bold bg-indigo-100 text-indigo-900 border border-indigo-200">
                      {displayTx.divisi === 'admin' ? '💼 Divisi Admin' : displayTx.divisi === 'it' ? '💻 Divisi IT' : displayTx.divisi === 'ahli' ? '🛠️ Divisi Ahli' : '🌐 Umum'}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Attachments Section */}
            <div className="p-4 bg-gray-50 border border-gray-100 rounded-2xl space-y-3">
              <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center justify-between">
                <span>Lampiran &amp; Bukti Resi ({displayTx.lampiran?.length || 0})</span>
                <span className="text-[10px] text-emerald-600 font-semibold">Google Drive Sync</span>
              </h4>

              {normalizeAttachments(displayTx.lampiran).length > 0 ? (
                <AttachmentViewer attachments={normalizeAttachments(displayTx.lampiran)} />
              ) : (
                <p className="text-xs text-gray-400 italic">Tidak ada lampiran foto/berkas pada transaksi ini.</p>
              )}

              {displayTx.buktiTransfer && (
                <div className="pt-2 border-t border-gray-200">
                  <p className="text-xs font-bold text-gray-500 mb-1">Bukti Transfer Bank:</p>
                  <AttachmentViewer attachments={[{ nama: 'Bukti Transfer.png', tipe: 'image/png', dataUrl: displayTx.buktiTransfer }]} />
                </div>
              )}
            </div>

            {/* Footer Action Buttons */}
            <div className="flex items-center justify-between pt-3 border-t border-gray-100 gap-2">
              {role === 'admin' ? (
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleting}
                  className="px-3.5 py-2 rounded-xl text-red-600 hover:bg-red-50 text-xs font-bold flex items-center gap-1.5 transition-colors"
                >
                  <Trash2 size={15} /> Hapus
                </button>
              ) : <div />}

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleStartEditing}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 shadow-md"
                >
                  <Edit3 size={15} /> Edit Transaksi
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold transition-all"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* ================= EDIT MODE ================= */
          <div className="space-y-4 animate-fade-in">
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-900 font-medium">
              ✏️ Anda sedang mengubah data transaksi. Perubahan alokasi proyek atau jalur transfer akan secara otomatis menyelaraskan entri biaya admin bank terkait.
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Jenis Transaksi */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Jenis Transaksi</label>
                <select
                  value={editForm.jenis}
                  onChange={e => {
                    const newJenis = e.target.value as 'masuk' | 'keluar';
                    setEditForm(f => ({ ...f, jenis: newJenis }));
                    getCategories(newJenis).then(setCategories);
                  }}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs font-bold bg-white"
                >
                  <option value="keluar">▼ Pengeluaran</option>
                  <option value="masuk">▲ Pemasukan</option>
                </select>
              </div>

              {/* Tanggal */}
              <div className="min-w-0">
                <label className="block text-xs font-semibold text-gray-700 mb-1">Tanggal *</label>
                <div className="relative flex items-center">
                  <Calendar size={14} className="absolute left-3 text-gray-400 pointer-events-none z-10" />
                  <input
                    type="date"
                    value={editForm.tanggal}
                    onChange={e => setEditForm(f => ({ ...f, tanggal: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl pl-9 pr-3 py-2 text-xs font-semibold text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-primary box-border"
                    required
                  />
                </div>
              </div>

              {/* Nominal */}
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-gray-700 mb-1">Nominal (Rp)</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={editForm.nominalStr}
                  onChange={e => setEditForm(f => ({ ...f, nominalStr: formatRupiahInput(e.target.value) }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-base font-extrabold text-gray-900 bg-white"
                />
              </div>

              {/* Deskripsi */}
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-gray-700 mb-1">Deskripsi / Keterangan</label>
                <input
                  type="text"
                  value={editForm.deskripsi}
                  onChange={e => setEditForm(f => ({ ...f, deskripsi: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3.5 py-2 text-xs font-medium bg-white"
                />
              </div>

              {/* Penerima Detail in Edit Mode */}
              {editForm.jenis === 'keluar' && (
                <div className="sm:col-span-2 space-y-2">
                  <label className="block text-xs font-semibold text-gray-700">
                    Penerima / Tujuan Transfer (Format: [Nama] - [Bank] [Nomor Rekening])
                  </label>
                  <input
                    type="text"
                    list="modal-historical-recipients-datalist"
                    value={editForm.penerimaDetail}
                    onChange={e => {
                      const val = e.target.value;
                      setEditForm(f => ({ ...f, penerimaDetail: val }));
                      if (val.trim()) {
                        const detected = parseRecipientString(val);
                        setEditForm(f => ({ ...f, jalurTransfer: detected.suggestedJalur }));
                      }
                    }}
                    className="w-full border border-gray-200 rounded-xl px-3.5 py-2 text-xs font-medium bg-white"
                    placeholder="Contoh: PT Santika - BCA 0123456789..."
                  />
                  <datalist id="modal-historical-recipients-datalist">
                    {historicalRecipients.map((rec, i) => (
                      <option key={i} value={rec} />
                    ))}
                  </datalist>

                  {editForm.penerimaDetail.trim() !== '' && (() => {
                    const detected = parseRecipientString(editForm.penerimaDetail);
                    return (
                      <div className="p-2 bg-slate-900 text-white rounded-xl text-[11px] flex items-center justify-between gap-2 shadow-sm">
                        <span className="font-bold text-emerald-400">⚡ Bank Terdeteksi: {detected.bankName}</span>
                        <span className="text-[10px] text-slate-300">
                          Jalur: {
                            detected.suggestedJalur === 'sesama_bca'
                              ? (detected.isQrisOrVa ? 'QRIS/VA (Rp0)' : 'BCA (Rp0)')
                              : detected.suggestedJalur === 'ewallet'
                              ? 'E-Wallet (Rp1.000)'
                              : 'BI-FAST (Rp2.500)'
                          }
                        </span>
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* Jalur Transfer in Edit Mode (5-Point Classification) */}
              {editForm.jenis === 'keluar' && (
                <div className="sm:col-span-2 space-y-2 border-t border-gray-100 pt-2">
                  <label className="block text-xs font-semibold text-gray-700">Jalur Transfer &amp; Biaya Admin Bank</label>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
                    <button
                      type="button"
                      onClick={() => setEditForm(f => ({ ...f, jalurTransfer: 'sesama_bca' }))}
                      className={`p-2 rounded-xl border text-center text-[11px] font-semibold transition-all ${
                        editForm.jalurTransfer === 'sesama_bca'
                          ? 'border-emerald-500 bg-emerald-50 text-emerald-900 ring-2 ring-emerald-500/20'
                          : 'border-gray-200 text-gray-700 bg-white'
                      }`}
                    >
                      BCA/QRIS/VA (Rp 0)
                    </button>

                    <button
                      type="button"
                      onClick={() => setEditForm(f => ({ ...f, jalurTransfer: 'ewallet' }))}
                      className={`p-2 rounded-xl border text-center text-[11px] font-semibold transition-all ${
                        editForm.jalurTransfer === 'ewallet'
                          ? 'border-teal-500 bg-teal-50 text-teal-900 ring-2 ring-teal-500/20'
                          : 'border-gray-200 text-gray-700 bg-white'
                      }`}
                    >
                      E-Wallet (Rp 1.000)
                    </button>

                    <button
                      type="button"
                      onClick={() => setEditForm(f => ({ ...f, jalurTransfer: 'bi_fast' }))}
                      className={`p-2 rounded-xl border text-center text-[11px] font-semibold transition-all ${
                        editForm.jalurTransfer === 'bi_fast'
                          ? 'border-blue-500 bg-blue-50 text-blue-900 ring-2 ring-blue-500/20'
                          : 'border-gray-200 text-gray-700 bg-white'
                      }`}
                    >
                      BI-FAST (Rp 2.500)
                    </button>

                    <button
                      type="button"
                      onClick={() => setEditForm(f => ({ ...f, jalurTransfer: 'online_rtgs' }))}
                      className={`p-2 rounded-xl border text-center text-[11px] font-semibold transition-all ${
                        editForm.jalurTransfer === 'online_rtgs'
                          ? 'border-purple-500 bg-purple-50 text-purple-900 ring-2 ring-purple-500/20'
                          : 'border-gray-200 text-gray-700 bg-white'
                      }`}
                    >
                      Online (Rp 6.500)
                    </button>

                    <button
                      type="button"
                      onClick={() => setEditForm(f => ({ ...f, jalurTransfer: 'custom' }))}
                      className={`p-2 rounded-xl border text-center text-[11px] font-semibold transition-all ${
                        editForm.jalurTransfer === 'custom'
                          ? 'border-amber-500 bg-amber-50 text-amber-900 ring-2 ring-amber-500/20'
                          : 'border-gray-200 text-gray-700 bg-white'
                      }`}
                    >
                      Custom Admin
                    </button>
                  </div>

                  {editForm.jalurTransfer === 'custom' && (
                    <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl space-y-1 animate-fade-in">
                      <label className="block text-[11px] font-bold text-amber-900">
                        Nominal Biaya Admin Khusus (Rp)
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={editForm.adminNominalCustomStr}
                        onChange={e => setEditForm(f => ({ ...f, adminNominalCustomStr: formatRupiahInput(e.target.value) }))}
                        className="w-full border border-amber-300 rounded-lg px-2.5 py-1 text-xs font-bold text-amber-950 bg-white"
                        placeholder="Contoh: 1.500 atau 3.000"
                      />
                    </div>
                  )}

                  {editForm.jalurTransfer !== 'sesama_bca' && (
                    <div className="p-2 bg-blue-50 border border-blue-200 rounded-xl text-[11px] text-blue-900 font-medium leading-tight">
                      ℹ️ Entri biaya admin bank ({
                        editForm.jalurTransfer === 'ewallet' ? 'Rp 1.000' :
                        editForm.jalurTransfer === 'bi_fast' ? 'Rp 2.500' :
                        editForm.jalurTransfer === 'online_rtgs' ? 'Rp 6.500' :
                        `Rp ${editForm.adminNominalCustomStr || '0'}`
                      }) akan otomatis disesuaikan dan <strong>tetap terikat ke alokasi proyek yang sama</strong>.
                    </div>
                  )}
                </div>
              )}

              {/* Kategori */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Kategori</label>
                <select
                  value={editForm.kategori}
                  onChange={e => setEditForm(f => ({ ...f, kategori: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs font-medium bg-white"
                >
                  {editForm.jenis === 'keluar' ? (
                    categories.map(c => <option key={c} value={c}>{c}</option>)
                  ) : (
                    <>
                      <optgroup label="💰 PENDAPATAN / OMZET KLIEN (Laba-Rugi P&L)">
                        <option value="Pembayaran Klien / Proyek">Pembayaran Klien / Proyek</option>
                        <option value="DP / Termijn Proyek">DP / Termijn Proyek</option>
                        <option value="Pelunasan Proyek">Pelunasan Proyek</option>
                      </optgroup>
                      <optgroup label="📥 MODAL & DROP DANA (Menambah Kas)">
                        <option value="Drop Dana Kas Utama / Holding">Drop Dana Kas Utama / Holding</option>
                        <option value="Setoran Modal Owner / Direksi">Setoran Modal Owner / Direksi</option>
                        <option value="Saldo Awal">Saldo Awal</option>
                      </optgroup>
                      <optgroup label="🔄 MUTASI INTERNAL & REFUND">
                        <option value="Mutasi Internal / Transfer Kas">Mutasi Internal / Transfer Kas</option>
                        <option value="Refund Sisa Dana Proyek ke Kas Utama">Refund Sisa Dana Proyek ke Kas Utama</option>
                      </optgroup>
                      
                      {/* Render any custom/extra categories not in the standard list */}
                      {(() => {
                        const isStandardCategory = (cat: string) => {
                          const name = cat.toLowerCase().trim();
                          if (name.includes('setoran modal')) return true; // Matches both old and new variations
                          return [
                            'pembayaran klien / proyek', 'dp / termijn proyek', 'pelunasan proyek',
                            'drop dana kas utama / holding', 'saldo awal',
                            'mutasi internal / transfer kas', 'refund sisa dana proyek ke kas utama'
                          ].includes(name);
                        };
                        const extraCats = categories.filter(c => !isStandardCategory(c));
                        if (extraCats.length === 0) return null;
                        return (
                          <optgroup label="KATEGORI TAMBAHAN">
                            {extraCats.map(c => <option key={c} value={c}>{c}</option>)}
                          </optgroup>
                        );
                      })()}
                    </>
                  )}
                </select>
              </div>

              {/* Proyek Link */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Tautkan ke Proyek / Pos</label>
                <select
                  value={editForm.proyekId}
                  onChange={e => setEditForm(f => ({ ...f, proyekId: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs font-medium bg-white"
                >
                  <option value="">-- Tanpa Proyek (Kas Utama) --</option>
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.tipe === 'operasional_kantor' ? '💼 Pos: ' : '🏢 Proyek: '}{p.nama}
                    </option>
                  ))}
                </select>
              </div>

              {/* Sub-Divisi Selector in Edit Mode */}
              <div className="sm:col-span-2 border-t border-gray-100 pt-2.5 mt-1">
                <label className="block text-xs font-bold text-gray-700 mb-1">Sub-Divisi Pengaju</label>
                <div className="grid grid-cols-4 gap-1.5">
                  {[
                    { id: undefined, label: '🌐 Umum' },
                    { id: 'admin', label: '💼 Admin' },
                    { id: 'it', label: '💻 IT' },
                    { id: 'ahli', label: '🛠️ Ahli' },
                  ].map(d => (
                    <button
                      key={d.label}
                      type="button"
                      onClick={() => setEditForm(f => ({ ...f, divisi: d.id as any }))}
                      className={`p-2 rounded-xl border text-center text-xs font-bold transition-all ${
                        editForm.divisi === d.id
                          ? 'border-blue-600 bg-blue-600 text-white shadow-sm ring-2 ring-blue-500/20'
                          : 'border-gray-200 text-gray-700 bg-white'
                      }`}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Staged Attachment Manager */}
            <div 
              className={`p-4 transition-colors border-2 ${
                dragActive ? 'border-emerald-500 bg-emerald-50/50 border-dashed' : 'border-gray-200 bg-gray-50 border-solid'
              } rounded-2xl space-y-3`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div>
                  <label className="text-xs font-bold text-gray-700 uppercase tracking-wider block">Kelola Lampiran Foto / Nota</label>
                  <p className="text-[10px] text-gray-500 font-medium mt-0.5">Unggah foto struk, nota, atau bukti transfer baru</p>
                </div>
                <div>
                  <label
                    htmlFor="modal-edit-file-input"
                    className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-sm cursor-pointer select-none"
                  >
                    <Plus size={15} />
                    <span>Tambah Foto / PDF</span>
                  </label>
                  <input
                    id="modal-edit-file-input"
                    type="file"
                    ref={fileInputRef}
                    accept=".pdf,application/pdf,image/*,.jpg,.jpeg,.png,.webp,.heic,.heif"
                    multiple
                    onChange={handleSelectFiles}
                    className="hidden"
                  />
                </div>
              </div>

              {stagedAttachments.length === 0 ? (
                <label
                  htmlFor="modal-edit-file-input"
                  className="block p-5 border-2 border-dashed border-gray-200 hover:border-emerald-500 hover:bg-emerald-50/40 rounded-xl text-center bg-white cursor-pointer transition-all active:scale-[0.99] space-y-1.5 select-none"
                >
                  <div className="w-8 h-8 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
                    <Plus size={18} />
                  </div>
                  <p className="text-xs font-bold text-gray-700">Belum ada lampiran.</p>
                  <p className="text-[10px] text-gray-400">Klik di sini atau tombol "+ Tambah Foto" untuk melampirkan resi/nota/PDF.</p>
                </label>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[220px] overflow-y-auto pr-1">
                  {stagedAttachments.map((att, idx) => {
                    const isPdf = att.tipe?.includes('pdf') || att.nama?.toLowerCase().endsWith('.pdf');
                    const isDrive = att.dataUrl?.includes('drive.google.com');
                    const driveId = isDrive ? getDriveFileId(att.dataUrl) : null;
                    const imgSrc = att.previewUrl || (isDrive && driveId
                      ? `https://lh3.googleusercontent.com/d/${driveId}`
                      : att.dataUrl);

                    return (
                      <div key={idx} className="flex items-center justify-between p-2 bg-white border border-gray-200 rounded-xl text-xs gap-2 shadow-sm hover:border-gray-300 transition-all">
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          {!isPdf && imgSrc ? (
                            <img
                              src={imgSrc}
                              alt={att.nama}
                              className="w-10 h-10 object-cover rounded-lg border border-gray-200 flex-shrink-0 bg-slate-900"
                              onError={(e) => {
                                const target = e.currentTarget;
                                if (isDrive && driveId && !target.dataset.fallback) {
                                  target.dataset.fallback = 'true';
                                  target.src = `https://drive.google.com/thumbnail?id=${driveId}&sz=w800`;
                                }
                              }}
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700 flex-shrink-0 font-bold text-[10px]">
                              PDF
                            </div>
                          )}
                          <div className="flex flex-col min-w-0">
                            <span className="font-bold text-gray-800 truncate" title={att.nama}>{att.nama}</span>
                            <span className="text-[10px] text-gray-400 font-medium">
                              {att.fileObj ? '⭐ Foto Baru (Diunggah)' : 'Foto Terlampir'}
                            </span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveStagedAttachment(idx)}
                          className="text-red-500 hover:text-red-700 p-1.5 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0"
                          title="Hapus Lampiran Ini"
                        >
                          <X size={15} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Edit Footer Buttons */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold"
                disabled={saving}
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md transition-all active:scale-95 disabled:opacity-50"
              >
                {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                {saving ? 'Menyimpan...' : 'Simpan Perubahan'}
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
