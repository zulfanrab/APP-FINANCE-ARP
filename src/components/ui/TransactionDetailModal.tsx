// ============================================================
// ARKA Finance — Universal Transaction Detail & Edit Modal
// Full interactive detail view + inline edit with attachment manager
// Staged Google Drive uploads (uploads only on Save confirmation)
// ============================================================

import React, { useState, useEffect, useRef } from 'react';
import {
  X, Edit3, Trash2, Calendar, FileText, Building2, FolderKanban,
  CheckCircle2, ArrowUpRight, ArrowDownLeft, Paperclip, Upload, Plus, Save, Loader2, Tag, AlertTriangle
} from 'lucide-react';
import { Modal } from './Modal';
import { AttachmentViewer } from './AttachmentViewer';
import { type Transaction, type Project } from '../../types';
import { updateTransaction, deleteTransaction } from '../../services/transactionService';
import { getProjects } from '../../services/projectService';
import { getCategories } from '../../services/categoryService';
import { uploadAttachmentFile } from '../../services/storageService';
import { formatRupiah, formatDate, StatusBadge } from './index';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';

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

  // Edit Form state
  const [editForm, setEditForm] = useState({
    tanggal: '',
    jenis: 'keluar' as 'masuk' | 'keluar',
    deskripsi: '',
    nominalStr: '',
    kategori: '',
    tag: 'operasional' as 'operasional' | 'pribadi',
    proyekId: '',
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
      });
      setStagedAttachments(
        (transaction.lampiran || []).map(att => ({
          nama: att.nama,
          tipe: att.tipe,
          dataUrl: att.dataUrl,
        }))
      );
      getProjects().then(setProjects);
      getCategories(transaction.jenis).then(setCategories);
    }
  }, [transaction, isOpen]);

  if (!transaction) return null;

  const isSuntikan = transaction.deskripsi.startsWith('Suntikan Modal Proyek:');
  const isKasUtama = !transaction.proyekId || isSuntikan;
  const projectObj = projects.find(p => p.id === transaction.proyekId);

  // Staged local file selection (NO INSTANT DRIVE UPLOAD)
  const handleSelectFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = () => {
        setStagedAttachments(prev => [
          ...prev,
          {
            nama: file.name,
            tipe: file.type || 'image/png',
            dataUrl: reader.result as string,
            fileObj: file,
          },
        ]);
      };
      reader.readAsDataURL(file);
    });

    addToast('info', `${files.length} berkas dipilih. Klik "Simpan Perubahan" untuk mengunggah ke Google Drive.`);
  };

  const handleRemoveStagedAttachment = (idx: number) => {
    setStagedAttachments(prev => prev.filter((_, i) => i !== idx));
  };

  // Submit edits
  const handleSaveEdit = async () => {
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
      // Upload any new staged files to Google Drive
      const finalAttachments = [];
      for (const att of stagedAttachments) {
        if (att.fileObj) {
          const uploaded = await uploadAttachmentFile(att.fileObj, {
            tanggal: editForm.tanggal,
            tag: editForm.tag,
          });
          finalAttachments.push(uploaded);
        } else {
          finalAttachments.push({
            nama: att.nama,
            tipe: att.tipe,
            dataUrl: att.dataUrl,
          });
        }
      }

      await updateTransaction(transaction.id, {
        tanggal: editForm.tanggal,
        jenis: editForm.jenis,
        deskripsi: editForm.deskripsi.trim(),
        nominal,
        kategori: editForm.kategori,
        tag: editForm.jenis === 'keluar' ? editForm.tag : undefined,
        proyekId: editForm.proyekId || undefined,
        lampiran: finalAttachments,
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

              <div>
                <p className="text-xs text-slate-400 mb-0.5">Nominal Transaksi</p>
                <p className={`text-3xl font-extrabold ${transaction.jenis === 'masuk' ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {transaction.jenis === 'masuk' ? '+' : '-'}{formatRupiah(transaction.nominal)}
                </p>
              </div>

              <div className="pt-2 border-t border-white/10 flex items-center justify-between text-xs text-slate-300">
                <span>Tanggal: <strong className="text-white">{formatDate(transaction.tanggal)}</strong></span>
                <span>Kategori: <strong className="text-emerald-300">{transaction.kategori}</strong></span>
              </div>
            </div>

            {/* Rejection Note from Pak Fatwa */}
            {transaction.status === 'ditolak' && transaction.catatanPenolakan && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-2xl space-y-1.5 text-xs text-red-900 shadow-sm animate-fade-in">
                <div className="flex items-center gap-1.5 font-bold text-red-700">
                  <AlertTriangle size={15} />
                  <span>Komentar / Alasan Penolakan dari Pak Fatwa (Owner):</span>
                </div>
                <p className="font-semibold text-slate-800 bg-white p-3 rounded-xl border border-red-200 italic leading-relaxed">
                  "{transaction.catatanPenolakan}"
                </p>
              </div>
            )}

            {/* Description Card */}
            <div className="p-4 bg-gray-50 border border-gray-100 rounded-2xl space-y-2">
              <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Deskripsi / Keterangan</h4>
              <p className="text-sm font-semibold text-gray-900 leading-relaxed whitespace-pre-wrap">{transaction.deskripsi}</p>

              {transaction.tag && (
                <div className="pt-2 flex items-center gap-2 text-xs">
                  <span className="text-gray-400">Peruntukan:</span>
                  <span className={`px-2.5 py-0.5 rounded-full font-semibold ${
                    transaction.tag === 'operasional' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'
                  }`}>
                    {transaction.tag === 'operasional' ? '🏢 Operasional' : '👤 Prive Owner'}
                  </span>
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
              ✏️ Anda sedang mengubah data transaksi. Semua perubahan termasuk lampiran akan diperbarui secara real-time.
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
                <label className="block text-xs font-semibold text-gray-700 mb-1">Tautkan ke Proyek</label>
                <select
                  value={editForm.proyekId}
                  onChange={e => setEditForm(f => ({ ...f, proyekId: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs font-medium bg-white"
                >
                  <option value="">-- Tanpa Proyek (Kas Utama) --</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.nama}</option>)}
                </select>
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
                  <Plus size={14} /> Tambah Foto
                </button>
                <input type="file" ref={fileInputRef} accept="image/*,application/pdf" multiple onChange={handleSelectFiles} className="hidden" />
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
              >
                Batal Edit
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                disabled={saving}
                className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 shadow-md"
              >
                {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                <span>Simpan Perubahan</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
