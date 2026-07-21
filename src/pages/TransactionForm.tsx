// ============================================================
// ARKA Finance — Transaction Form (Input Transaksi)
// Includes: OCR scan, multi-file cloud upload, Rupiah auto-format & Custom Category Manager
// ============================================================

import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Save, Upload, X, Camera, Loader2, FileText,
  ScanLine, AlertCircle, ArrowLeft, CheckCircle2, Plus, Trash2, Tag, Building2, Lock, Zap, Clock, Calendar
} from 'lucide-react';
import Tesseract from 'tesseract.js';
import { addTransaction } from '../services/transactionService';
import { getProjects } from '../services/projectService';
import { getCategories, addCategory, deleteCategory } from '../services/categoryService';
import { uploadAttachmentFile } from '../services/storageService';
import { type Project, type Attachment } from '../types';
import { Button, Card, formatRupiah } from '../components/ui';
import { scanReceiptWithGemini } from '../services/aiOcrService';
import { Modal } from '../components/ui/Modal';
import { useApp } from '../context/AppContext';

function formatRupiahInput(value: string): string {
  const num = value.replace(/\D/g, '');
  if (!num) return '';
  return new Intl.NumberFormat('id-ID').format(Number(num));
}

function parseRupiahInput(value: string): number {
  return Number(value.replace(/\./g, '').replace(',', ''));
}

export function TransactionForm() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const urlProyekId = searchParams.get('proyekId');

  const { addToast, triggerRefresh } = useApp();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const ocrInputRef = useRef<HTMLInputElement>(null);

  const [projects, setProjects] = useState<Project[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState(false);

  // Category Manager Modal
  const [catModalOpen, setCatModalOpen] = useState(false);
  const [newCatName, setNewCatName] = useState('');

  // OCR
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [ocrResult, setOcrResult] = useState('');

  // Form fields
  const [form, setForm] = useState({
    tanggal: new Date().toISOString().split('T')[0],
    jenis: 'keluar' as 'masuk' | 'keluar',
    deskripsi: '',
    nominalStr: '',
    kategori: '',
    tag: 'operasional' as 'operasional' | 'pribadi',
    proyekId: urlProyekId || '',
    lampiran: [] as Attachment[],
  });

  // Approval Flow Switch
  const [autoApprove, setAutoApprove] = useState<boolean>(!!urlProyekId);

  useEffect(() => {
    getProjects().then(projs => {
      setProjects(projs);
      if (urlProyekId) {
        setForm(f => ({ ...f, proyekId: urlProyekId }));
        setAutoApprove(true);
      }
    });
  }, [urlProyekId]);

  useEffect(() => {
    if (form.proyekId) {
      setAutoApprove(true); // Project internal transactions are auto-approved by default
    }
  }, [form.proyekId]);

  useEffect(() => {
    loadCategoryList(form.jenis);
  }, [form.jenis]);

  const loadCategoryList = async (jenis: 'masuk' | 'keluar') => {
    const list = await getCategories(jenis);
    setCategories(list);
    if (list.length > 0) {
      setForm(f => ({ ...f, kategori: list[0] }));
    }
  };

  const setField = (key: string, value: any) => setForm(f => ({ ...f, [key]: value }));

  const handleAddCategory = async () => {
    if (!newCatName.trim()) return;
    const updated = await addCategory(newCatName, form.jenis);
    setCategories(updated);
    setField('kategori', newCatName.trim());
    setNewCatName('');
    addToast('success', `Kategori "${newCatName.trim()}" ditambahkan`);
  };

  const handleDeleteCategory = async (catName: string) => {
    const updated = await deleteCategory(catName, form.jenis);
    setCategories(updated);
    addToast('success', `Kategori "${catName}" dihapus`);
  };

  interface StagedFormAttachment {
    nama: string;
    tipe: string;
    dataUrl: string;
    fileObj?: File;
  }

  const [stagedFiles, setStagedFiles] = useState<StagedFormAttachment[]>([]);

  // AI Gemini Receipt Scan (99.9% Precision)
  const handleOcrFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setOcrLoading(true);

    try {
      // 1. Scan with Gemini Vision AI
      const aiResult = await scanReceiptWithGemini(file);

      if (aiResult.nominal && aiResult.nominal > 0) {
        setField('nominalStr', formatRupiahInput(aiResult.nominal.toString()));
      }
      if (aiResult.deskripsi) {
        setField('deskripsi', aiResult.deskripsi);
      }
      if (aiResult.kategori && categories.includes(aiResult.kategori)) {
        setField('kategori', aiResult.kategori);
      }
      if (aiResult.tanggal) {
        setField('tanggal', aiResult.tanggal);
      }

      // 2. Stage file locally (Do NOT upload to Drive yet)
      const reader = new FileReader();
      reader.onload = () => {
        setStagedFiles(prev => [
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

      addToast('success', `✨ AI Gemini membaca struk: ${formatRupiah(aiResult.nominal)} (${aiResult.deskripsi})`);
    } catch {
      addToast('error', 'Gagal membaca struk dengan Gemini AI. Silakan isi nominal manual.');
    } finally {
      setOcrLoading(false);
    }
  };

  // Manual File Selection (Staged Locally)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = () => {
        setStagedFiles(prev => [
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

    addToast('info', `${files.length} berkas dipilih (akan diunggah ke Drive saat disimpan).`);
  };

  const removeAttachment = (idx: number) => {
    setStagedFiles(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const nominal = parseRupiahInput(form.nominalStr);

    if (!nominal || nominal <= 0) { addToast('error', 'Nominal harus lebih dari 0'); return; }
    if (!form.deskripsi.trim()) { addToast('error', 'Deskripsi wajib diisi'); return; }
    if (!form.kategori) { addToast('error', 'Pilih kategori transaksi'); return; }

    setLoading(true);
    try {
      // Defer Upload to Google Drive until user clicks Simpan Transaksi!
      const uploadedAttachments: Attachment[] = [];
      for (const staged of stagedFiles) {
        if (staged.fileObj) {
          const uploaded = await uploadAttachmentFile(staged.fileObj, {
            tanggal: form.tanggal,
            tag: form.tag,
          });
          uploadedAttachments.push(uploaded);
        } else {
          uploadedAttachments.push({
            nama: staged.nama,
            tipe: staged.tipe,
            dataUrl: staged.dataUrl,
          });
        }
      }

      await addTransaction({
        tanggal: form.tanggal,
        jenis: form.jenis,
        deskripsi: form.deskripsi.trim(),
        nominal,
        kategori: form.kategori,
        tag: form.jenis === 'keluar' ? form.tag : undefined,
        lampiran: uploadedAttachments,
        status: autoApprove ? 'disetujui' : 'menunggu_approval',
      });

      addToast('success', 'Transaksi & berkas berhasil disimpan!');
      triggerRefresh();

      if (form.proyekId) {
        navigate(`/proyek/${form.proyekId}`);
      } else if (urlProyekId) {
        navigate(`/proyek/${urlProyekId}`);
      } else if (searchParams.get('returnUrl')) {
        navigate(searchParams.get('returnUrl')!);
      } else {
        navigate(-1);
      }
    } catch {
      addToast('error', 'Gagal menyimpan transaksi');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelOrBack = () => {
    if (form.proyekId) {
      navigate(`/proyek/${form.proyekId}`);
    } else if (urlProyekId) {
      navigate(`/proyek/${urlProyekId}`);
    } else if (searchParams.get('returnUrl')) {
      navigate(searchParams.get('returnUrl')!);
    } else {
      navigate(-1);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-in pb-12">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleCancelOrBack}
          className="w-10 h-10 rounded-2xl bg-white border border-gray-200 flex items-center justify-center text-gray-600 hover:bg-gray-100 transition-all active:scale-95 shadow-sm"
        >
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Input Transaksi Baru</h1>
          <p className="text-xs text-gray-500 mt-0.5">Catat pengeluaran/pemasukan dengan bukti lampiran Google Drive</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Basic Info Card */}
        <Card>
          <h2 className="text-base font-bold text-gray-900 mb-4 pb-2 border-b border-gray-100">Informasi Utama</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-full overflow-hidden">
            {/* Jenis */}
            <div className="sm:col-span-2 min-w-0">
              <label className="block text-xs font-bold text-gray-700 mb-2 uppercase tracking-wider">Jenis Transaksi</label>
              <div className="grid grid-cols-2 gap-2 max-w-full">
                {(['masuk', 'keluar'] as const).map(j => (
                  <button
                    key={j}
                    type="button"
                    onClick={() => setField('jenis', j)}
                    className={`py-2.5 px-3 rounded-xl border-2 font-bold text-xs sm:text-sm transition-all active:scale-95 truncate
                      ${form.jenis === j
                        ? j === 'masuk' ? 'border-emerald-500 bg-emerald-50 text-emerald-700 shadow-sm' : 'border-red-500 bg-red-50 text-red-700 shadow-sm'
                        : 'border-gray-200 text-gray-500 hover:border-gray-300 bg-white'
                      }`}
                  >
                    {j === 'masuk' ? '▲ Pemasukan' : '▼ Pengeluaran'}
                  </button>
                ))}
              </div>
            </div>

            {/* Tanggal */}
            <div className="min-w-0">
              <label className="block text-xs font-semibold text-gray-700 mb-1">Tanggal *</label>
              <div className="relative flex items-center">
                <Calendar size={16} className="absolute left-3.5 text-gray-400 pointer-events-none z-10" />
                <input
                  type="date"
                  value={form.tanggal}
                  onChange={e => setField('tanggal', e.target.value)}
                  className="w-full border border-gray-200 rounded-xl pl-10 pr-3 py-2.5 text-sm font-semibold text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-primary box-border"
                  required
                />
              </div>
            </div>

            {/* Nominal */}
            <div className="min-w-0">
              <label className="block text-xs font-semibold text-gray-700 mb-1">Nominal (Rp) *</label>
              <input
                type="text"
                inputMode="numeric"
                value={form.nominalStr}
                onChange={e => setField('nominalStr', formatRupiahInput(e.target.value))}
                className="w-full max-w-full box-border border border-gray-200 rounded-xl px-3 py-2.5 text-base font-extrabold text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary bg-white min-w-0"
                placeholder="0"
                required
              />
            </div>

            {/* Deskripsi */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-gray-700 mb-1">Deskripsi / Keterangan *</label>
              <input
                type="text"
                value={form.deskripsi}
                onChange={e => setField('deskripsi', e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-white"
                placeholder="Misal: Pembelian semen 50 sak untuk proyek A..."
                required
              />
            </div>

            {/* Kategori Custom Select */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-gray-700">Kategori *</label>
                <button
                  type="button"
                  onClick={() => setCatModalOpen(true)}
                  className="text-xs text-emerald-600 hover:text-emerald-700 font-semibold flex items-center gap-1"
                >
                  <Tag size={12} /> + Kelola Kategori
                </button>
              </div>
              <select
                value={form.kategori}
                onChange={e => setField('kategori', e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-white font-medium"
                required
              >
                <option value="">-- Pilih Kategori --</option>
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            {/* Tag (only for keluar) */}
            {form.jenis === 'keluar' && (
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Peruntukan Pengeluaran</label>
                <div className="grid grid-cols-2 gap-2">
                  {(['operasional', 'pribadi'] as const).map(t => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setField('tag', t)}
                      className={`py-2.5 px-3 rounded-xl border font-semibold text-xs transition-all active:scale-95
                        ${form.tag === t
                          ? t === 'operasional' ? 'border-blue-600 bg-blue-50 text-blue-700 shadow-sm' : 'border-purple-600 bg-purple-50 text-purple-700 shadow-sm'
                          : 'border-gray-200 text-gray-500 hover:border-gray-300 bg-white'
                        }`}
                    >
                      {t === 'operasional' ? '🏢 Operasional' : '👤 Prive Owner'}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Proyek Link */}
            {urlProyekId ? (
              <div className="sm:col-span-2 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 p-3.5 rounded-2xl flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center flex-shrink-0">
                    <Building2 size={18} />
                  </div>
                  <div>
                    <p className="text-[11px] font-bold text-blue-600 uppercase tracking-wider">Tertaut Otomatis ke Proyek</p>
                    <p className="text-sm font-extrabold text-gray-900">
                      {projects.find(p => p.id === urlProyekId)?.nama || 'Proyek'}
                    </p>
                  </div>
                </div>
                <span className="text-xs font-semibold px-3 py-1 bg-blue-100 text-blue-800 rounded-xl flex items-center gap-1">
                  <Lock size={12} /> Terkunci
                </span>
              </div>
            ) : projects.length > 0 ? (
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-gray-700 mb-1">Tautkan ke Proyek (Opsional)</label>
                <select
                  value={form.proyekId}
                  onChange={e => setField('proyekId', e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-white font-medium"
                >
                  <option value="">-- Tanpa Proyek (Kas Utama) --</option>
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>{p.nama} ({p.klien})</option>
                  ))}
                </select>
              </div>
            ) : null}

            {/* Smart Context Banner: Refund info */}
            {form.jenis === 'masuk' && form.proyekId && (
              <div className="sm:col-span-2 p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-800 font-medium space-y-1">
                <p className="font-bold text-emerald-900">📥 Pencatatan Uang Masuk ke Dana Proyek</p>
                <p>Transaksi ini akan menambah saldo dana proyek (contoh: pengembalian sisa dana dari pekerja lapangan, refund pembelian, dll). Dana ini <strong>TIDAK</strong> masuk ke kas utama perusahaan.</p>
              </div>
            )}
            {form.jenis === 'keluar' && form.proyekId && (
              <div className="sm:col-span-2 p-3 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-800 font-medium space-y-1">
                <p className="font-bold text-amber-900">📤 Pengeluaran dari Dana Proyek</p>
                <p>Transaksi ini hanya mengurangi saldo dana proyek, <strong>TIDAK</strong> mengurangi kas utama perusahaan.</p>
              </div>
            )}

            {/* Status Approval Selector */}
            <div className="sm:col-span-2 border-t border-gray-100 pt-4 mt-2">
              <label className="block text-xs font-bold text-gray-700 mb-2 uppercase tracking-wider">
                Status Approval Transaksi
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setAutoApprove(true)}
                  className={`p-3.5 rounded-2xl border text-left transition-all active:scale-[0.99] ${
                    autoApprove
                      ? 'border-emerald-600 bg-emerald-50/80 text-emerald-900 ring-2 ring-emerald-500/20 shadow-sm font-semibold'
                      : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-xs flex items-center gap-1.5 text-emerald-800">
                      <Zap size={14} className="text-emerald-600" /> Langsung Disetujui (Auto-Approved)
                    </span>
                    {autoApprove && <CheckCircle2 size={16} className="text-emerald-600 flex-shrink-0" />}
                  </div>
                  <p className="text-[11px] text-emerald-700 leading-snug">
                    {form.proyekId
                      ? 'Otomatis aktif untuk proyek (karena modal 20jt sudah disetujui Pak Fatwa).'
                      : 'Transaksi langsung aktif tanpa perlu persetujuan Pak Fatwa.'}
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setAutoApprove(false)}
                  className={`p-3.5 rounded-2xl border text-left transition-all active:scale-[0.99] ${
                    !autoApprove
                      ? 'border-amber-600 bg-amber-50/80 text-amber-900 ring-2 ring-amber-500/20 shadow-sm font-semibold'
                      : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-xs flex items-center gap-1.5 text-amber-800">
                      <Clock size={14} className="text-amber-600" /> Perlu Approval Pak Fatwa (Owner)
                    </span>
                    {!autoApprove && <CheckCircle2 size={16} className="text-amber-600 flex-shrink-0" />}
                  </div>
                  <p className="text-[11px] text-amber-700 leading-snug">
                    Masuk ke antrean "Menunggu Approval" untuk dikonfirmasi Pak Fatwa.
                  </p>
                </button>
              </div>
            </div>
          </div>
        </Card>

        {/* OCR Scan & Attachment Card */}
        <Card>
          <div className="flex items-center justify-between mb-4 pb-2 border-b border-gray-100">
            <h2 className="text-base font-bold text-gray-900">Lampiran Struk (Google Drive)</h2>
            <button
              type="button"
              onClick={() => ocrInputRef.current?.click()}
              className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-md transition-all active:scale-95"
            >
              <ScanLine size={15} /> ✨ Scan Struk AI Gemini
            </button>
            <input type="file" ref={ocrInputRef} accept="image/*" onChange={handleOcrFile} className="hidden" />
          </div>

          {ocrLoading && (
            <div className="p-4 bg-purple-50 border border-purple-200 rounded-2xl mb-4 text-center space-y-2 animate-pulse">
              <Loader2 size={24} className="mx-auto animate-spin text-purple-600" />
              <p className="text-xs font-extrabold text-purple-900">✨ Gemini AI Vision sedang membaca Foto Struk...</p>
              <p className="text-[11px] text-purple-700">Mengekstrak Total Nominal, Nama Toko, Tanggal &amp; Deskripsi secara presisi</p>
            </div>
          )}

          {/* Upload Dropzone */}
          <div className="space-y-3">
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-gray-200 hover:border-emerald-500 bg-gray-50/50 hover:bg-emerald-50/30 rounded-2xl p-6 text-center cursor-pointer transition-all duration-200"
            >
              <Upload size={28} className="mx-auto text-gray-400 mb-2" />
              <p className="text-sm font-semibold text-gray-700">Pilih Foto Struk / Nota PDF</p>
              <p className="text-xs text-gray-400 mt-1">Otomatis ter-upload & tersimpan aman di Google Drive Anda</p>
            </div>
            <input type="file" ref={fileInputRef} multiple accept="image/*,application/pdf" onChange={handleFileUpload} className="hidden" />

            {/* Attachment Items List */}
            {uploadingFiles && (
              <div className="flex items-center justify-center p-3 text-xs text-emerald-700 font-semibold bg-emerald-50 rounded-xl gap-2">
                <Loader2 size={16} className="animate-spin" /> Uploading ke Google Drive...
              </div>
            )}

            {stagedFiles.length > 0 && (
              <div className="space-y-2 pt-2">
                <p className="text-xs font-bold text-gray-500">Berkas Dipilih ({stagedFiles.length}):</p>
                {stagedFiles.map((att, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs">
                    <div className="flex items-center gap-2 truncate min-w-0">
                      <CheckCircle2 size={16} className="text-emerald-600 flex-shrink-0" />
                      <span className="font-semibold text-gray-800 truncate">{att.nama}</span>
                      <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold">
                        Diunggah saat simpan
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeAttachment(idx)}
                      className="text-gray-400 hover:text-red-500 p-1 transition-colors"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>

        {/* Submit */}
        <div className="flex gap-3 justify-end pt-2">
          <Button type="button" variant="secondary" onClick={handleCancelOrBack}>
            Batal
          </Button>
          <Button type="submit" variant="primary" loading={loading} icon={<Save size={16} />}>
            Simpan Transaksi
          </Button>
        </div>
      </form>

      {/* Category Manager Modal */}
      <Modal isOpen={catModalOpen} onClose={() => setCatModalOpen(false)} title="Kelola Kategori Custom">
        <div className="space-y-4">
          <div className="flex gap-2">
            <input
              type="text"
              value={newCatName}
              onChange={e => setNewCatName(e.target.value)}
              placeholder="Nama kategori baru..."
              className="flex-1 border border-gray-200 rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <Button variant="primary" size="sm" icon={<Plus size={14} />} onClick={handleAddCategory}>
              Tambah
            </Button>
          </div>

          <div className="max-h-60 overflow-y-auto space-y-1.5 pt-2">
            {categories.map(cat => (
              <div key={cat} className="flex items-center justify-between p-2.5 bg-gray-50 rounded-xl border border-gray-100 text-xs font-medium text-gray-800">
                <span>{cat}</span>
                <button
                  type="button"
                  onClick={() => handleDeleteCategory(cat)}
                  className="text-gray-400 hover:text-red-500 p-1 transition-colors"
                  title="Hapus Kategori"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>

          <div className="flex justify-end pt-2">
            <Button variant="secondary" size="sm" onClick={() => setCatModalOpen(false)}>Selesai</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
