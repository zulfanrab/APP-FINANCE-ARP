// ============================================================
// ARKA Finance — Transaction Form (Input Transaksi)
// Includes: OCR scan, file upload, Rupiah auto-format
// ============================================================

import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Save, Upload, X, Camera, Loader2, Image, FileText,
  ScanLine, AlertCircle, ArrowLeft
} from 'lucide-react';
import Tesseract from 'tesseract.js';
import { addTransaction } from '../services/transactionService';
import { getProjects } from '../services/projectService';
import { type Project, type Attachment } from '../types';
import { Button, Card, formatRupiah } from '../components/ui';
import { useApp } from '../context/AppContext';

const CATEGORIES = [
  'Gaji & Honorarium',
  'Operasional Kantor',
  'Marketing & Promosi',
  'Transportasi',
  'Utilitas (Listrik/Air/Internet)',
  'Peralatan & Aset',
  'Pajak & Administrasi',
  'Konsumsi & Entertaintment',
  'Biaya Proyek',
  'Pemasukan Proyek',
  'Pemasukan Lainnya',
  'Pengeluaran Lainnya',
];

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
  const [loading, setLoading] = useState(false);
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
  });
  const [attachments, setAttachments] = useState<Attachment[]>([]);

  useEffect(() => {
    getProjects().then(p => setProjects(p.filter(pr => pr.status === 'aktif')));
  }, []);

  const setField = (key: string, value: string) => {
    setForm(f => ({ ...f, [key]: value }));
  };

  // File upload handler
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    for (const file of files) {
      if (file.size > 5 * 1024 * 1024) {
        addToast('error', `File ${file.name} terlalu besar (maks 5MB)`);
        continue;
      }
      const dataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = ev => resolve(ev.target?.result as string);
        reader.readAsDataURL(file);
      });
      setAttachments(prev => [...prev, { nama: file.name, tipe: file.type, dataUrl }]);
    }
    e.target.value = '';
  };

  const removeAttachment = (idx: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== idx));
  };

  // OCR handler
  const handleOcrScan = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setOcrLoading(true);
    setOcrProgress(0);
    setOcrResult('');
    try {
      const result = await Tesseract.recognize(file, 'ind+eng', {
        logger: m => {
          if (m.status === 'recognizing text') {
            setOcrProgress(Math.round(m.progress * 100));
          }
        },
      });

      const text = result.data.text;
      setOcrResult(text);

      // Try to extract amount from OCR text
      const nominalMatch = text.match(/(?:total|jumlah|rp\.?|idr)\s*[:\s]*([0-9.,]+)/i)
        ?? text.match(/([0-9]{3,}[.,][0-9]{2,})/);

      if (nominalMatch) {
        const raw = nominalMatch[1].replace(/\./g, '').replace(',', '');
        const amount = parseInt(raw, 10);
        if (!isNaN(amount) && amount > 0) {
          setField('nominalStr', new Intl.NumberFormat('id-ID').format(amount));
          addToast('info', `Nominal Rp ${formatRupiah(amount)} terdeteksi dari struk. Silakan verifikasi.`);
        }
      }

      // Try to extract description
      const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 3 && l.length < 60);
      if (lines.length > 0 && !form.deskripsi) {
        setField('deskripsi', lines[0]);
      }

      addToast('success', 'Scan struk selesai! Periksa dan edit hasil sebelum menyimpan.');
    } catch {
      addToast('error', 'Gagal memproses gambar. Coba dengan foto yang lebih jelas.');
    } finally {
      setOcrLoading(false);
      e.target.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const nominal = parseRupiahInput(form.nominalStr);
    if (!form.deskripsi.trim()) { addToast('error', 'Deskripsi wajib diisi'); return; }
    if (!nominal || nominal <= 0) { addToast('error', 'Nominal harus lebih dari 0'); return; }
    if (!form.kategori) { addToast('error', 'Kategori wajib dipilih'); return; }
    if (form.jenis === 'keluar' && !form.tag) { addToast('error', 'Tag pengeluaran wajib dipilih'); return; }

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
        lampiran: attachments,
      });
      triggerRefresh();
      addToast('success', 'Transaksi berhasil disimpan dan menunggu approval Owner!');
      navigate('/dashboard');
    } catch {
      addToast('error', 'Gagal menyimpan transaksi');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-xl border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition-colors">
          <ArrowLeft size={18} className="text-gray-600" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Input Transaksi</h1>
          <p className="text-sm text-gray-500">Semua transaksi akan menunggu approval Owner</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Basic Info */}
        <Card>
          <h2 className="text-base font-semibold text-gray-800 mb-4">Informasi Transaksi</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Jenis */}
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">Jenis Transaksi</label>
              <div className="grid grid-cols-2 gap-3">
                {(['masuk', 'keluar'] as const).map(j => (
                  <button
                    key={j}
                    type="button"
                    onClick={() => setField('jenis', j)}
                    className={`py-3 px-4 rounded-xl border-2 font-medium text-sm transition-all
                      ${form.jenis === j
                        ? j === 'masuk' ? 'border-green-500 bg-green-50 text-green-700' : 'border-red-500 bg-red-50 text-red-700'
                        : 'border-gray-200 text-gray-500 hover:border-gray-300'
                      }`}
                  >
                    {j === 'masuk' ? '▲ Pemasukan' : '▼ Pengeluaran'}
                  </button>
                ))}
              </div>
            </div>

            {/* Tanggal */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Tanggal</label>
              <input
                type="date"
                value={form.tanggal}
                onChange={e => setField('tanggal', e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                required
              />
            </div>

            {/* Nominal */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Nominal (Rp)</label>
              <input
                type="text"
                inputMode="numeric"
                value={form.nominalStr}
                onChange={e => setField('nominalStr', formatRupiahInput(e.target.value))}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="0"
                required
              />
              {form.nominalStr && (
                <p className="text-xs text-gray-400 mt-1">
                  {formatRupiah(parseRupiahInput(form.nominalStr))}
                </p>
              )}
            </div>

            {/* Deskripsi */}
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">Deskripsi</label>
              <input
                type="text"
                value={form.deskripsi}
                onChange={e => setField('deskripsi', e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="Deskripsi transaksi..."
                required
              />
            </div>

            {/* Kategori */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Kategori</label>
              <select
                value={form.kategori}
                onChange={e => setField('kategori', e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-white"
                required
              >
                <option value="">Pilih kategori...</option>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            {/* Tag (only for keluar) */}
            {form.jenis === 'keluar' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Tag Pengeluaran</label>
                <div className="grid grid-cols-2 gap-2">
                  {(['operasional', 'pribadi'] as const).map(t => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setField('tag', t)}
                      className={`py-2 px-3 rounded-xl border-2 text-xs font-medium transition-all
                        ${form.tag === t
                          ? t === 'operasional' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-purple-500 bg-purple-50 text-purple-700'
                          : 'border-gray-200 text-gray-500 hover:border-gray-300'
                        }`}
                    >
                      {t === 'operasional' ? '🏢 Operasional' : '👤 Pribadi Owner'}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Proyek */}
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">Proyek (Opsional)</label>
              <select
                value={form.proyekId}
                onChange={e => setField('proyekId', e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-white"
              >
                <option value="">Tidak terkait proyek</option>
                {projects.map(p => (
                  <option key={p.id} value={p.id}>{p.nama} — {p.klien}</option>
                ))}
              </select>
            </div>
          </div>
        </Card>

        {/* OCR Scan */}
        <Card>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 rounded-xl bg-primary-light flex items-center justify-center">
              <ScanLine size={18} className="text-primary" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-800">Scan dari Foto Struk</h2>
              <p className="text-xs text-gray-500">OCR akan mencoba mengisi Nominal & Deskripsi otomatis</p>
            </div>
          </div>

          {ocrLoading ? (
            <div className="bg-blue-50 rounded-xl p-4">
              <div className="flex items-center gap-3 mb-2">
                <Loader2 size={18} className="animate-spin text-blue-500" />
                <p className="text-sm text-blue-700 font-medium">Memproses gambar struk... {ocrProgress}%</p>
              </div>
              <div className="w-full bg-blue-200 rounded-full h-2">
                <div className="bg-blue-500 h-2 rounded-full transition-all" style={{ width: `${ocrProgress}%` }} />
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => ocrInputRef.current?.click()}
              className="w-full flex items-center justify-center gap-3 py-4 border-2 border-dashed border-gray-200 rounded-xl text-gray-500 hover:border-primary hover:text-primary hover:bg-primary-light transition-all"
            >
              <Camera size={20} />
              <span className="text-sm font-medium">Pilih Foto Struk untuk Discan</span>
            </button>
          )}

          {ocrResult && !ocrLoading && (
            <div className="mt-3 p-3 bg-gray-50 rounded-xl">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle size={14} className="text-amber-500" />
                <p className="text-xs font-medium text-gray-600">Teks terdeteksi (periksa & edit manual):</p>
              </div>
              <p className="text-xs text-gray-500 font-mono whitespace-pre-line line-clamp-3">{ocrResult}</p>
            </div>
          )}

          <input ref={ocrInputRef} type="file" accept="image/*" className="hidden" onChange={handleOcrScan} />
        </Card>

        {/* Lampiran */}
        <Card>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 rounded-xl bg-accent-light flex items-center justify-center">
              <Upload size={18} className="text-accent-dark" />
            </div>
            <h2 className="text-base font-semibold text-gray-800">Lampiran</h2>
          </div>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-full flex items-center justify-center gap-3 py-4 border-2 border-dashed border-gray-200 rounded-xl text-gray-500 hover:border-accent hover:text-accent-dark hover:bg-accent-light transition-all mb-3"
          >
            <Upload size={20} />
            <span className="text-sm font-medium">Upload Lampiran (bisa lebih dari 1 file)</span>
          </button>
          <input ref={fileInputRef} type="file" multiple accept="image/*,.pdf,.doc,.docx,.xls,.xlsx" className="hidden" onChange={handleFileChange} />

          {attachments.length > 0 && (
            <div className="space-y-2">
              {attachments.map((att, idx) => (
                <div key={idx} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                  {att.tipe.startsWith('image') ? (
                    <img src={att.dataUrl} alt={att.nama} className="w-10 h-10 object-cover rounded-lg flex-shrink-0" />
                  ) : (
                    <div className="w-10 h-10 bg-gray-200 rounded-lg flex items-center justify-center flex-shrink-0">
                      <FileText size={18} className="text-gray-500" />
                    </div>
                  )}
                  <p className="text-sm text-gray-700 flex-1 truncate">{att.nama}</p>
                  <button type="button" onClick={() => removeAttachment(idx)} className="text-gray-400 hover:text-red-500 transition-colors">
                    <X size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Submit */}
        <div className="flex gap-3">
          <Button type="button" variant="secondary" className="flex-1" onClick={() => navigate(-1)}>Batal</Button>
          <Button type="submit" loading={loading} icon={<Save size={16} />} className="flex-1">
            Simpan Transaksi
          </Button>
        </div>
      </form>
    </div>
  );
}
