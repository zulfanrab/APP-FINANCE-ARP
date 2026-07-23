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
  onUpdate?: () => void;
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

  const [projects, setProjects] = useState<Project[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [historicalRecipients, setHistoricalRecipients] = useState<string[]>([]);

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

  const [stagedAttachments, setStagedAttachments] = useState<StagedAttachment[]>([]);

  useEffect(() => {
    if (transaction && isOpen) {
      setIsEditing(false);
      setEditForm({
        tanggal: transaction.tanggal,
        jenis: transaction.jenis,
        deskripsi: transaction.deskripsi,
        nominalStr: formatRupiahInput(transaction.nominal.toString()),
        kategori: transaction.kategori,
        tag: transaction.tag || 'operasional',
        proyekId: transaction.proyekId || '',
        penerimaDetail: transaction.penerimaDetail || '',
        jalurTransfer: transaction.jalurTransfer || 'sesama_bca',
        adminNominalCustomStr: transaction.adminNominalCustom ? formatRupiahInput(transaction.adminNominalCustom.toString()) : '1.000',
        divisi: transaction.divisi || undefined,
      });
      setStagedAttachments(
        (transaction.lampiran || []).map(att => ({
          nama: att.nama,
          tipe: att.tipe,
          dataUrl: att.dataUrl,
        }))
      );
      Promise.all([getProjects(), getCategories(transaction.jenis), getTransactions()]).then(
        ([projs, cats, txs]) => {
          setProjects(projs);
          setCategories(cats);
          setHistoricalRecipients(extractHistoricalRecipients(txs));
        }
      );
    }
  }, [transaction, isOpen]);

  if (!transaction) return null;

  const projectObj = projects.find(p => p.id === transaction.proyekId);
  const isKasUtama = !transaction.proyekId;

  const handleSelectFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    for (const file of files) {
      try {
        const attachment = await compressFileToAttachment(file);
        setStagedAttachments(prev => [
          ...prev,
          {
            nama: attachment.nama,
            tipe: attachment.tipe,
            dataUrl: attachment.dataUrl,
            fileObj: file,
          },
        ]);
      } catch (err) {
        console.error('Gagal memproses lampiran:', err);
      }
    }
    addToast('info', `${files.length} foto/berkas dipilih.`);
    e.target.value = '';
  };

  const handleRemoveStagedAttachment = (idx: number) => {
    setStagedAttachments(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSave = async () => {
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
            finalAttachments.push(uploaded);
          } catch {
            finalAttachments.push({
              nama: att.nama,
              tipe: att.tipe,
              dataUrl: att.dataUrl,
            });
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

      await updateTransaction(transaction.id, {
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

      addToast('success', 'Transaksi berhasil diperbarui!');
      triggerRefresh();
      if (onUpdate) onUpdate();
      setIsEditing(false);
      onClose();
    } catch {
      addToast('error', 'Gagal memperbarui transaksi');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (window.confirm(`Yakin ingin menghapus transaksi "${transaction.deskripsi}"?`)) {
      setDeleting(true);
      try {
        await deleteTransaction(transaction.id);
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
                <StatusBadge status={transaction.status} />
              </div>

              <div className="min-w-0">
                <p className="text-xs text-slate-400 mb-0.5">Nominal Transaksi</p>
                <p className={`text-2xl sm:text-3xl font-extrabold truncate tabular-nums tracking-tight ${transaction.jenis === 'masuk' ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {transaction.jenis === 'masuk' ? '+' : '-'}{formatRupiah(transaction.nominal)}
                </p>
              </div>

              <div className="pt-2 border-t border-white/10 flex items-center justify-between text-xs text-slate-300 gap-2 flex-wrap min-w-0">
                <span className="truncate">Tanggal: <strong className="text-white">{formatDate(transaction.tanggal)}</strong></span>
                <span className="truncate">Kategori: <strong className="text-emerald-300">{transaction.kategori}</strong></span>
              </div>
            </div>

            {/* Rejection Note from Management */}
            {transaction.status === 'ditolak' && transaction.catatanPenolakan && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-2xl space-y-1.5 text-xs text-red-900 shadow-sm animate-fade-in">
                <div className="flex items-center gap-1.5 font-bold text-red-700">
                  <AlertTriangle size={15} />
                  <span>Komentar / Alasan Penolakan Manajemen:</span>
                </div>
                <p className="font-semibold text-slate-800 bg-white p-3 rounded-xl border border-red-200 italic leading-relaxed break-words">
                  "{transaction.catatanPenolakan}"
                </p>
              </div>
            )}

            {/* Recipient Details & Transfer Channel */}
            {transaction.penerimaDetail && (
              <div className="p-3.5 bg-emerald-50/80 border border-emerald-200/90 rounded-2xl space-y-1 text-xs min-w-0">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider flex items-center gap-1">
                    <Landmark size={12} /> Penerima / Tujuan Transfer
                  </span>
                  {transaction.jalurTransfer && (
                    <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 truncate max-w-full">
                      {transaction.jalurTransfer === 'sesama_bca' ? '⚡ BCA/QRIS/VA (Rp0)' : transaction.jalurTransfer === 'ewallet' ? '⚡ Top Up E-Wallet (Rp 1.000)' : transaction.jalurTransfer === 'bi_fast' ? '⚡ BI-FAST (Rp 2.500)' : transaction.jalurTransfer === 'online_rtgs' ? '⚡ Online/RTGS (Rp 6.500)' : '⚡ Custom Admin'}
                    </span>
                  )}
                </div>
                <p className="text-sm font-extrabold text-slate-900 break-words">{transaction.penerimaDetail}</p>
              </div>
            )}

            {/* Parent Relational Link Badge (If this transaction is an Admin Fee Child Entry) */}
            {transaction.parentTransactionId && (
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
              <p className="text-sm font-semibold text-gray-900 leading-relaxed whitespace-pre-wrap">{transaction.deskripsi}</p>

              {transaction.tag && (
                <div className="pt-2 flex items-center gap-2 text-xs flex-wrap">
                  <span className="text-gray-400">Peruntukan:</span>
                  <span className={`px-2.5 py-0.5 rounded-full font-semibold ${
                    transaction.tag === 'operasional' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'
                  }`}>
                    {transaction.tag === 'operasional' ? '🏢 Operasional' : '👤 Non-Operasional / Prive'}
                  </span>
                  {transaction.divisi && (
                    <span className="px-2.5 py-0.5 rounded-full font-bold bg-indigo-100 text-indigo-900 border border-indigo-200">
                      {transaction.divisi === 'admin' ? '💼 Divisi Admin' : transaction.divisi === 'it' ? '💻 Divisi IT' : transaction.divisi === 'ahli' ? '🛠️ Divisi Ahli' : '🌐 Umum'}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Attachments Section */}
            <div className="p-4 bg-gray-50 border border-gray-100 rounded-2xl space-y-3">
              <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center justify-between">
                <span>Lampiran &amp; Bukti Resi ({transaction.lampiran?.length || 0})</span>
                <span className="text-[10px] text-emerald-600 font-semibold">Google Drive Sync</span>
              </h4>

              {transaction.lampiran && transaction.lampiran.length > 0 ? (
                <AttachmentViewer attachments={transaction.lampiran} />
              ) : (
                <p className="text-xs text-gray-400 italic">Tidak ada lampiran foto/berkas pada transaksi ini.</p>
              )}

              {transaction.buktiTransfer && (
                <div className="pt-2 border-t border-gray-200">
                  <p className="text-xs font-bold text-gray-500 mb-1">Bukti Transfer Bank:</p>
                  <AttachmentViewer attachments={[{ nama: 'Bukti Transfer.png', tipe: 'image/png', dataUrl: transaction.buktiTransfer }]} />
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
                  onClick={() => setIsEditing(true)}
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
                  {categories.map(c => <option key={c} value={c}>{c}</option>)}
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
            <div className="p-4 bg-gray-50 border border-gray-200 rounded-2xl space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">Kelola Lampiran Foto / Nota</label>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1 transition-all"
                >
                  <Plus size={14} /> Tambah Foto / PDF
                </button>
                <input type="file" ref={fileInputRef} accept="image/*,application/pdf,.pdf,.jpg,.jpeg,.png,.webp,.heic,.heif" multiple onChange={handleSelectFiles} className="hidden" />
              </div>

              {stagedAttachments.length === 0 ? (
                <p className="text-xs text-gray-400 italic">Belum ada lampiran. Klik "Tambah Foto" untuk menambahkan resi baru.</p>
              ) : (
                <div className="space-y-2">
                  {stagedAttachments.map((att, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2.5 bg-white border border-gray-200 rounded-xl text-xs">
                      <div className="flex items-center gap-2 min-w-0">
                        <Paperclip size={14} className="text-gray-400 flex-shrink-0" />
                        <span className="font-semibold text-gray-800 truncate">{att.nama}</span>
                        {att.fileObj && (
                          <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold">
                            Baru (Diunggah saat simpan)
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveStagedAttachment(idx)}
                        className="text-red-500 hover:text-red-700 p-1 hover:bg-red-50 rounded-lg"
                        title="Hapus Lampiran Ini"
                      >
                        <X size={15} />
                      </button>
                    </div>
                  ))}
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
