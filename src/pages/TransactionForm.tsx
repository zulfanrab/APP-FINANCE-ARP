// ============================================================
// ARKA Finance — Transaction Form (Input Transaksi)
// Includes: OCR scan, multi-file cloud upload, Rupiah auto-format & Custom Category Manager
// ============================================================

import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Save, Upload, X, Camera, Loader2, FileText,
  ScanLine, AlertCircle, ArrowLeft, CheckCircle2, Plus, Trash2, Tag
} from 'lucide-react';
import Tesseract from 'tesseract.js';
import { addTransaction } from '../services/transactionService';
import { getProjects } from '../services/projectService';
import { getCategories, addCategory, deleteCategory } from '../services/categoryService';
import { uploadAttachmentFile } from '../services/storageService';
import { type Project, type Attachment } from '../types';
import { Button, Card, formatRupiah } from '../components/ui';
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
    proyekId: '',
    lampiran: [] as Attachment[],
  });

  useEffect(() => {
    getProjects().then(setProjects);
    loadCategoryList();
  }, []);

  const loadCategoryList = async () => {
    const list = await getCategories();
    setCategories(list);
    if (!form.kategori && list.length > 0) {
      setForm(f => ({ ...f, kategori: list[0] }));
    }
  };

  const setField = (key: string, value: any) => setForm(f => ({ ...f, [key]: value }));

  const handleAddCategory = async () => {
    if (!newCatName.trim()) return;
    const updated = await addCategory(newCatName);
    setCategories(updated);
    setField('kategori', newCatName.trim());
    setNewCatName('');
    addToast('success', `Kategori "${newCatName.trim()}" ditambahkan`);
  };

  const handleDeleteCategory = async (catName: string) => {
    const updated = await deleteCategory(catName);
    setCategories(updated);
    addToast('success', `Kategori "${catName}" dihapus`);
  };

  // OCR Receipt Scan
  const handleOcrFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setOcrLoading(true);
    setOcrProgress(0);
    setOcrResult('');

    try {
      const result = await Tesseract.recognize(file, 'ind+eng', {
        logger: m => {
          if (m.status === 'recognizing text') setOcrProgress(Math.round(m.progress * 100));
        },
      });

      const text = result.data.text;
      setOcrResult(text);

      // Extract total numeric amount
      const matches = text.match(/(?:total|jumlah|rp\.?|bayar|net)\s*[:=]?\s*([0-9.,]+)/i) ||
                      text.match(/([0-9]{1,3}(?:\.[0-9]{3})+)/);

      if (matches && matches[1]) {
        const cleanedStr = matches[1].replace(/\D/g, '');
        if (cleanedStr) setField('nominalStr', formatRupiahInput(cleanedStr));
      }

      // Auto-upload scanned image
      const att = await uploadAttachmentFile(file, {
        tanggal: form.tanggal,
        tag: form.tag,
      });
      setForm(f => ({ ...f, lampiran: [...f.lampiran, att] }));
      addToast('success', 'Resi berhasil di-scan & ter-upload ke Drive!');
    } catch {
      addToast('error', 'Gagal membaca gambar resi');
    } finally {
      setOcrLoading(false);
    }
  };

  // Manual File Upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setUploadingFiles(true);
    try {
      for (const file of files) {
        const att = await uploadAttachmentFile(file, {
          tanggal: form.tanggal,
          tag: form.tag,
        });
        setForm(f => ({ ...f, lampiran: [...f.lampiran, att] }));
      }
      addToast('success', `${files.length} berkas berhasil diunggah ke Google Drive`);
    } catch {
      addToast('error', 'Gagal mengunggah beberapa berkas');
    } finally {
      setUploadingFiles(false);
    }
  };

  const removeAttachment = (idx: number) => {
    setForm(f => ({ ...f, lampiran: f.lampiran.filter((_, i) => i !== idx) }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const nominal = parseRupiahInput(form.nominalStr);

    if (!nominal || nominal <= 0) { addToast('error', 'Nominal harus lebih dari 0'); return; }
    if (!form.deskripsi.trim()) { addToast('error', 'Deskripsi wajib diisi'); return; }
    if (!form.kategori) { addToast('error', 'Pilih kategori transaksi'); return; }

    setLoading(true);
    try {
      await addTransaction({
        tanggal: form.tanggal,
        jenis: form.jenis,
        deskripsi: form.deskripsi.trim(),
        nominal,
        kategori: form.kategori,
        tag: form.jenis === 'keluar' ? form.tag : undefined,
        proyekId: form.proyekId || undefined,
        lampiran: form.lampiran,
      });

      addToast('success', 'Transaksi berhasil disimpan!');
      triggerRefresh();
      navigate('/dashboard');
    } catch {
      addToast('error', 'Gagal menyimpan transaksi');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-in pb-12">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate('/dashboard')}
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Jenis */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-gray-700 mb-2 uppercase tracking-wider">Jenis Transaksi</label>
              <div className="grid grid-cols-2 gap-3">
                {(['masuk', 'keluar'] as const).map(j => (
                  <button
                    key={j}
                    type="button"
                    onClick={() => setField('jenis', j)}
                    className={`py-3 px-4 rounded-xl border-2 font-bold text-sm transition-all active:scale-95
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
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Tanggal</label>
              <input
                type="date"
                value={form.tanggal}
                onChange={e => setField('tanggal', e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-white"
                required
              />
            </div>

            {/* Nominal */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Nominal (Rp) *</label>
              <input
                type="text"
                inputMode="numeric"
                value={form.nominalStr}
                onChange={e => setField('nominalStr', formatRupiahInput(e.target.value))}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-base font-extrabold text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary bg-white"
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
            {projects.length > 0 && (
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-gray-700 mb-1">Tautkan ke Proyek (Opsional)</label>
                <select
                  value={form.proyekId}
                  onChange={e => setField('proyekId', e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-white font-medium"
                >
                  <option value="">-- Tanpa Proyek --</option>
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>{p.nama} ({p.klien})</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </Card>

        {/* OCR Scan & Attachment Card */}
        <Card>
          <div className="flex items-center justify-between mb-4 pb-2 border-b border-gray-100">
            <h2 className="text-base font-bold text-gray-900">Lampiran Struk (Google Drive)</h2>
            <button
              type="button"
              onClick={() => ocrInputRef.current?.click()}
              className="px-3 py-1.5 rounded-xl bg-purple-50 hover:bg-purple-100 border border-purple-200 text-purple-700 text-xs font-semibold flex items-center gap-1.5 transition-all active:scale-95"
            >
              <ScanLine size={15} /> Scan Struk (AI OCR)
            </button>
            <input type="file" ref={ocrInputRef} accept="image/*" onChange={handleOcrFile} className="hidden" />
          </div>

          {ocrLoading && (
            <div className="p-4 bg-purple-50 rounded-2xl mb-4 text-center space-y-2">
              <Loader2 size={24} className="mx-auto animate-spin text-purple-600" />
              <p className="text-xs font-bold text-purple-800">Membaca Teks Struk via OCR... ({ocrProgress}%)</p>
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

            {form.lampiran.length > 0 && (
              <div className="space-y-2 pt-2">
                {form.lampiran.map((att, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs">
                    <div className="flex items-center gap-2 truncate min-w-0">
                      <CheckCircle2 size={16} className="text-emerald-600 flex-shrink-0" />
                      <span className="font-semibold text-gray-800 truncate">{att.nama}</span>
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
          <Button type="button" variant="secondary" onClick={() => navigate('/dashboard')}>
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
