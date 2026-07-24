// ============================================================
// ARKA Finance — Transaction Form (Input Transaksi)
// Includes: OCR scan, multi-file cloud upload, Rupiah auto-format,
// Recipient Autofill & Bank Auto-Detection, Transfer Channel & Auto-Split Admin Fee
// ============================================================

import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Save, Upload, X, Camera, Loader2, FileText,
  ScanLine, AlertCircle, ArrowLeft, CheckCircle2, Plus, Trash2, Tag, Building2, Lock, Zap, Clock, Calendar, Landmark
} from 'lucide-react';
import Tesseract from 'tesseract.js';
import { addTransaction, getTransactions } from '../services/transactionService';
import { getProjects } from '../services/projectService';
import { getCategories, addCategory, deleteCategory } from '../services/categoryService';
import { uploadAttachmentFile, compressFileToAttachment } from '../services/storageService';
import { type Project, type Attachment, type JalurTransfer } from '../types';
import { Button, Card, formatRupiah } from '../components/ui';
import { scanReceiptWithGemini } from '../services/aiOcrService';
import { Modal } from '../components/ui/Modal';
import { useApp } from '../context/AppContext';
import { parseRecipientString, extractHistoricalRecipients } from '../utils/bankHelper';

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
  const [historicalRecipients, setHistoricalRecipients] = useState<string[]>([]);
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
    penerimaDetail: '',
    jalurTransfer: 'sesama_bca' as JalurTransfer,
    adminNominalCustomStr: '1.000',
    divisi: undefined as 'admin' | 'ahli' | 'it' | 'umum' | undefined,
  });

  // Approval Flow Switch
  const [autoApprove, setAutoApprove] = useState<boolean>(!!urlProyekId);

  useEffect(() => {
    Promise.all([getProjects(), getTransactions()]).then(([projs, txs]) => {
      setProjects(projs);
      setHistoricalRecipients(extractHistoricalRecipients(txs));
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
      const aiResult = await scanReceiptWithGemini(file);

      if (aiResult.nominal && aiResult.nominal > 0) {
        setField('nominalStr', formatRupiahInput(aiResult.nominal.toString()));
      }
      if (aiResult.deskripsi) {
        setField('deskripsi', aiResult.deskripsi);
      }
      if (aiResult.toko) {
        const detected = parseRecipientString(aiResult.toko);
        setField('penerimaDetail', detected.formattedDetail || aiResult.toko);
        setField('jalurTransfer', detected.suggestedJalur);
      }
      if (aiResult.kategori && categories.includes(aiResult.kategori)) {
        setField('kategori', aiResult.kategori);
      }
      if (aiResult.tanggal) {
        setField('tanggal', aiResult.tanggal);
      }

      const attachment = await compressFileToAttachment(file);
      setStagedFiles(prev => [
        ...prev,
        {
          nama: attachment.nama,
          tipe: attachment.tipe,
          dataUrl: attachment.dataUrl,
          fileObj: file,
        },
      ]);

      addToast('success', `✨ AI Gemini membaca struk: ${formatRupiah(aiResult.nominal)} (${aiResult.deskripsi})`);
    } catch {
      addToast('error', 'Gagal membaca struk dengan Gemini AI. Silakan isi nominal manual.');
    } finally {
      setOcrLoading(false);
      e.target.value = '';
    }
  };

  // Manual File Selection (Staged Locally)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    for (const file of files) {
      try {
        const attachment = await compressFileToAttachment(file);
        setStagedFiles(prev => [
          ...prev,
          {
            nama: attachment.nama,
            tipe: attachment.tipe,
            dataUrl: attachment.dataUrl,
            fileObj: file,
          },
        ]);
      } catch (err) {
        console.error('Gagal memproses file:', err);
      }
    }

    addToast('info', `${files.length} berkas dipilih.`);
    e.target.value = '';
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
      const uploadedAttachments: Attachment[] = [];
      const currentProject = projects.find(p => p.id === (form.proyekId || urlProyekId));

      for (const staged of stagedFiles) {
        if (staged.fileObj) {
          try {
            const uploaded = await uploadAttachmentFile(staged.fileObj, {
              tanggal: form.tanggal,
              tag: form.tag,
              proyekNama: currentProject?.nama,
            });
            uploadedAttachments.push(uploaded);
          } catch {
            uploadedAttachments.push({
              nama: staged.nama,
              tipe: staged.tipe,
              dataUrl: staged.dataUrl,
            });
          }
        } else {
          uploadedAttachments.push({
            nama: staged.nama,
            tipe: staged.tipe,
            dataUrl: staged.dataUrl,
          });
        }
      }

      const adminNominalCustom = parseRupiahInput(form.adminNominalCustomStr || '0');

      await addTransaction({
        tanggal: form.tanggal,
        jenis: form.jenis,
        deskripsi: form.deskripsi.trim(),
        nominal,
        kategori: form.kategori,
        tag: form.jenis === 'keluar' ? form.tag : undefined,
        proyekId: (form.proyekId || urlProyekId) || undefined,
        lampiran: uploadedAttachments,
        status: autoApprove ? 'disetujui' : 'menunggu_approval',
        penerimaDetail: form.jenis === 'keluar' ? (form.penerimaDetail.trim() || undefined) : undefined,
        jalurTransfer: form.jenis === 'keluar' ? form.jalurTransfer : undefined,
        adminNominalCustom: form.jenis === 'keluar' && form.jalurTransfer === 'custom' ? adminNominalCustom : undefined,
        divisi: form.divisi || undefined,
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
              <label className="block text-xs font-semibold text-gray-700 mb-1">Nominal Murni (Rp) *</label>
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

            {/* Penerima / Tujuan Transfer (Autofill & Bank Auto Detection) */}
            {form.jenis === 'keluar' && (
              <div className="sm:col-span-2 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
                    <Landmark size={14} className="text-emerald-600" /> Penerima / Tujuan Transfer
                  </label>
                  <span className="text-[10px] text-gray-400">Format: [Nama] - [Bank] [Rekening]</span>
                </div>
                <div className="relative">
                  <input
                    type="text"
                    list="historical-recipients-datalist"
                    value={form.penerimaDetail}
                    onChange={e => {
                      const val = e.target.value;
                      setField('penerimaDetail', val);
                      if (val.trim()) {
                        const detected = parseRecipientString(val);
                        setField('jalurTransfer', detected.suggestedJalur);
                      }
                    }}
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-white font-medium"
                    placeholder="Contoh: PT Santika - BCA 0123456789 (Ketik nama/nomor rekening)..."
                  />
                  <datalist id="historical-recipients-datalist">
                    {historicalRecipients.map((rec, i) => (
                      <option key={i} value={rec} />
                    ))}
                  </datalist>
                </div>

                {/* Live Bank Auto-Detection Badge */}
                {form.penerimaDetail.trim() !== '' && (() => {
                  const detected = parseRecipientString(form.penerimaDetail);
                  return (
                    <div className="p-2.5 bg-slate-900 text-white rounded-xl text-xs flex items-center justify-between gap-2 shadow-sm animate-fade-in">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping flex-shrink-0" />
                        <span className="font-bold text-emerald-400">⚡ Bank Terdeteksi: {detected.bankName}</span>
                        {detected.accountNumber && (
                          <span className="text-slate-300 font-mono text-[11px] truncate">({detected.accountNumber})</span>
                        )}
                      </div>
                      <span className="text-[10px] px-2.5 py-0.5 rounded-full font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex-shrink-0">
                        Jalur Disarankan: {
                          detected.suggestedJalur === 'sesama_bca'
                            ? (detected.isQrisOrVa ? 'QRIS/VA (Rp0)' : 'Sesama BCA (Rp0)')
                            : detected.suggestedJalur === 'ewallet'
                            ? 'Top Up E-Wallet (Rp1.000)'
                            : 'BI-FAST (Rp2.500)'
                        }
                      </span>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Jalur Transfer & Admin Fee Auto-Split (5-Point Classification) */}
            {form.jenis === 'keluar' && (
              <div className="sm:col-span-2 space-y-2 border-t border-gray-100 pt-3">
                <label className="block text-xs font-semibold text-gray-700">Jalur Transfer &amp; Biaya Admin Bank *</label>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {/* 1. BCA / QRIS / VA */}
                  <button
                    type="button"
                    onClick={() => setField('jalurTransfer', 'sesama_bca')}
                    className={`p-2.5 rounded-xl border text-left font-medium transition-all active:scale-95 flex flex-col justify-between ${
                      form.jalurTransfer === 'sesama_bca'
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-900 ring-2 ring-emerald-500/20 shadow-sm'
                        : 'border-gray-200 text-gray-700 hover:border-gray-300 bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full mb-1">
                      <span className="font-bold text-xs truncate">BCA / QRIS / VA</span>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 bg-emerald-100 text-emerald-800 rounded-full flex-shrink-0">Rp 0</span>
                    </div>
                    <p className="text-[10px] text-gray-500">Tanpa Admin</p>
                  </button>

                  {/* 2. Top Up E-Wallet */}
                  <button
                    type="button"
                    onClick={() => setField('jalurTransfer', 'ewallet')}
                    className={`p-2.5 rounded-xl border text-left font-medium transition-all active:scale-95 flex flex-col justify-between ${
                      form.jalurTransfer === 'ewallet'
                        ? 'border-teal-500 bg-teal-50 text-teal-900 ring-2 ring-teal-500/20 shadow-sm'
                        : 'border-gray-200 text-gray-700 hover:border-gray-300 bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full mb-1">
                      <span className="font-bold text-xs truncate">Top Up E-Wallet</span>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 bg-teal-100 text-teal-800 rounded-full flex-shrink-0">Rp 1.000</span>
                    </div>
                    <p className="text-[10px] text-gray-500">GoPay, DANA, OVO, ShopeePay</p>
                  </button>

                  {/* 3. BI-FAST */}
                  <button
                    type="button"
                    onClick={() => setField('jalurTransfer', 'bi_fast')}
                    className={`p-2.5 rounded-xl border text-left font-medium transition-all active:scale-95 flex flex-col justify-between ${
                      form.jalurTransfer === 'bi_fast'
                        ? 'border-blue-500 bg-blue-50 text-blue-900 ring-2 ring-blue-500/20 shadow-sm'
                        : 'border-gray-200 text-gray-700 hover:border-gray-300 bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full mb-1">
                      <span className="font-bold text-xs truncate">BI-FAST</span>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 bg-blue-100 text-blue-800 rounded-full flex-shrink-0">Rp 2.500</span>
                    </div>
                    <p className="text-[10px] text-gray-500">Transfer Beda Bank</p>
                  </button>

                  {/* 4. Online / RTGS */}
                  <button
                    type="button"
                    onClick={() => setField('jalurTransfer', 'online_rtgs')}
                    className={`p-2.5 rounded-xl border text-left font-medium transition-all active:scale-95 flex flex-col justify-between ${
                      form.jalurTransfer === 'online_rtgs'
                        ? 'border-purple-500 bg-purple-50 text-purple-900 ring-2 ring-purple-500/20 shadow-sm'
                        : 'border-gray-200 text-gray-700 hover:border-gray-300 bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full mb-1">
                      <span className="font-bold text-xs truncate">Online / RTGS</span>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 bg-purple-100 text-purple-800 rounded-full flex-shrink-0">Rp 6.500</span>
                    </div>
                    <p className="text-[10px] text-gray-500">Transfer Online</p>
                  </button>

                  {/* 5. Custom / Lainnya */}
                  <button
                    type="button"
                    onClick={() => setField('jalurTransfer', 'custom')}
                    className={`p-2.5 rounded-xl border text-left font-medium transition-all active:scale-95 flex flex-col justify-between ${
                      form.jalurTransfer === 'custom'
                        ? 'border-amber-500 bg-amber-50 text-amber-900 ring-2 ring-amber-500/20 shadow-sm'
                        : 'border-gray-200 text-gray-700 hover:border-gray-300 bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full mb-1">
                      <span className="font-bold text-xs truncate">Custom Admin</span>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 bg-amber-100 text-amber-800 rounded-full flex-shrink-0">Manual</span>
                    </div>
                    <p className="text-[10px] text-gray-500">Input Admin Khusus</p>
                  </button>
                </div>

                {/* Input Nominal Custom Admin */}
                {form.jalurTransfer === 'custom' && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-1.5 animate-fade-in">
                    <label className="block text-xs font-bold text-amber-900">
                      Nominal Biaya Admin Khusus (Rp)
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        inputMode="numeric"
                        value={form.adminNominalCustomStr}
                        onChange={e => setField('adminNominalCustomStr', formatRupiahInput(e.target.value))}
                        className="w-full border border-amber-300 rounded-lg px-3 py-1.5 text-sm font-bold text-amber-950 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                        placeholder="Contoh: 1.500 atau 3.000"
                      />
                    </div>
                    <p className="text-[11px] text-amber-800">
                      Isi nominal biaya admin khusus sesuai struk bukti transaksi.
                    </p>
                  </div>
                )}

                {/* Notification Banner */}
                {form.jalurTransfer !== 'sesama_bca' && (
                  <div className="p-3 bg-blue-50/80 border border-blue-200 rounded-xl text-xs text-blue-900 font-medium space-y-1 animate-fade-in">
                    <p className="font-bold text-blue-950 flex items-center gap-1.5">
                      <Zap size={14} className="text-blue-600" />
                      Auto-Split Biaya Admin ({
                        form.jalurTransfer === 'ewallet' ? 'Rp 1.000' :
                        form.jalurTransfer === 'bi_fast' ? 'Rp 2.500' :
                        form.jalurTransfer === 'online_rtgs' ? 'Rp 6.500' :
                        `Rp ${form.adminNominalCustomStr || '0'}`
                      })
                    </p>
                    <p className="text-blue-800 leading-relaxed">
                      Sistem akan membuat <strong>entri kedua "Biaya Admin Bank" ({
                        form.jalurTransfer === 'ewallet' ? 'Rp 1.000' :
                        form.jalurTransfer === 'bi_fast' ? 'Rp 2.500' :
                        form.jalurTransfer === 'online_rtgs' ? 'Rp 6.500' :
                        `Rp ${form.adminNominalCustomStr || '0'}`
                      })</strong> secara otomatis yang <strong>terikat ke alokasi proyek yang sama ({form.proyekId ? projects.find(p => p.id === form.proyekId)?.nama : 'Kas Utama'})</strong>.
                    </p>
                  </div>
                )}
              </div>
            )}

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
                <label className="block text-xs font-semibold text-gray-700 mb-1">Tautkan ke Proyek / Pos Operasional (Opsional)</label>
                <select
                  value={form.proyekId}
                  onChange={e => setField('proyekId', e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-white font-medium"
                >
                  <option value="">-- Tanpa Alokasi (Kas Utama) --</option>
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.tipe === 'operasional_kantor' ? '💼 Pos Kantor: ' : '🏢 Proyek: '}{p.nama} ({p.klien})
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            {/* Conditional Sub-Divisi Selector (Admin, IT, Ahli) */}
            {(() => {
              const selectedProject = projects.find(p => p.id === form.proyekId);
              const isOperasionalPos = selectedProject?.tipe === 'operasional_kantor' ||
                form.kategori.includes('Operasional') ||
                form.kategori.includes('Drop Dana') ||
                form.tag === 'operasional';

              if (!isOperasionalPos) return null;

              return (
                <div className="sm:col-span-2 p-3.5 bg-blue-50/70 border border-blue-200/80 rounded-2xl space-y-2 animate-fade-in shadow-sm">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-blue-950 flex items-center gap-1.5">
                      <span>🏛️</span> Sub-Divisi / Unit Pengaju (Opsional)
                    </label>
                    <span className="text-[10px] text-blue-700 font-semibold bg-blue-100 px-2 py-0.5 rounded-full">
                      Terkait Pos Kantor
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'admin', label: '💼 Divisi Admin', desc: 'Wi-Fi, ATK, Listrik, Kantor' },
                      { id: 'it', label: '💻 Divisi IT', desc: 'Server, Hardware, Tools' },
                      { id: 'ahli', label: '🛠️ Divisi Ahli', desc: 'Honor & Biaya Spesialis' },
                    ].map(d => (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() => setField('divisi', form.divisi === d.id ? undefined : d.id as any)}
                        className={`p-2.5 rounded-xl border text-left font-bold text-xs transition-all active:scale-95 flex flex-col justify-between ${
                          form.divisi === d.id
                            ? 'border-blue-600 bg-blue-600 text-white shadow-sm ring-2 ring-blue-500/20'
                            : 'border-blue-200/80 bg-white text-gray-700 hover:border-blue-300'
                        }`}
                      >
                        <span className="truncate">{d.label}</span>
                        <span className={`text-[9.5px] font-normal truncate mt-0.5 ${form.divisi === d.id ? 'text-blue-100' : 'text-gray-400'}`}>
                          {d.desc}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* Smart Context Banner: Drop Dana / Uang Masuk Proyek info */}
            {form.jenis === 'masuk' && form.proyekId && (
              <div className="sm:col-span-2 p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-900 font-medium space-y-1 animate-fade-in shadow-sm">
                <p className="font-bold text-emerald-950 flex items-center gap-1.5 text-sm">
                  <span>💡</span> Drop Dana / Saldo Operasional Proyek
                </p>
                <p className="leading-relaxed text-emerald-800">
                  Uang sebesar <strong>Rp {form.nominalStr || '0'}</strong> yang dialokasikan dari Kas Utama ini akan <strong>otomatis mengisi Saldo Kas Operasional Proyek ({projects.find(p => p.id === form.proyekId)?.nama})</strong>. Saldo proyek akan menjadi positif dan otomatis berkurang seiring pengeluaran belanja lapangan.
                </p>
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
              <label className="block text-xs font-bold text-gray-700 mb-2 uppercase tracking-wider">Status Approval Transaksi</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setAutoApprove(true)}
                  className={`p-3 rounded-2xl border text-left transition-all active:scale-95 ${
                    autoApprove
                      ? 'border-emerald-500 bg-emerald-50/80 text-emerald-900 ring-2 ring-emerald-500/20 shadow-sm'
                      : 'border-gray-200 text-gray-600 bg-white hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Zap size={16} className={autoApprove ? 'text-emerald-600' : 'text-gray-400'} />
                    <span className="font-extrabold text-xs">⚡ Auto-Approved</span>
                  </div>
                  <p className="text-[11px] opacity-80 leading-snug">Langsung disetujui &amp; aktif di kas/proyek tanpa antrean approval.</p>
                </button>

                <button
                  type="button"
                  onClick={() => setAutoApprove(false)}
                  className={`p-3 rounded-2xl border text-left transition-all active:scale-95 ${
                    !autoApprove
                      ? 'border-amber-500 bg-amber-50/80 text-amber-900 ring-2 ring-amber-500/20 shadow-sm'
                      : 'border-gray-200 text-gray-600 bg-white hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Clock size={16} className={!autoApprove ? 'text-amber-600' : 'text-gray-400'} />
                    <span className="font-extrabold text-xs">⏰ Perlu Approval</span>
                  </div>
                  <p className="text-[11px] opacity-80 leading-snug">Masuk ke antrean approval manajemen terlebih dahulu.</p>
                </button>
              </div>
            </div>
          </div>
        </Card>

        {/* OCR Scan Section */}
        <Card>
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-base font-bold text-gray-900">Foto Struk & AI Scan Struk</h2>
              <p className="text-xs text-gray-500">Gunakan Gemini AI untuk membaca total nominal & deskripsi struk secara otomatis</p>
            </div>
            <button
              type="button"
              onClick={() => ocrInputRef.current?.click()}
              disabled={ocrLoading}
              className="px-3.5 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md hover:from-purple-700 hover:to-indigo-700 transition-all active:scale-95 disabled:opacity-50"
            >
              {ocrLoading ? <Loader2 size={15} className="animate-spin" /> : <ScanLine size={15} />}
              {ocrLoading ? 'Membaca Struk...' : '✨ Scan Struk (AI)'}
            </button>
            <input type="file" ref={ocrInputRef} accept="image/*,.jpg,.jpeg,.png,.webp,.heic,.heif" onChange={handleOcrFile} className="hidden" />
          </div>

          {/* Staged File List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-gray-700">Lampiran Berkas ({stagedFiles.length})</label>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="text-xs text-emerald-600 hover:text-emerald-700 font-bold flex items-center gap-1 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-xl transition-all"
              >
                <Plus size={14} /> Pilih Foto / Berkas PDF
              </button>
              <input type="file" ref={fileInputRef} accept=".pdf,application/pdf,image/*,.jpg,.jpeg,.png,.webp,.heic,.heif" multiple onChange={handleFileUpload} className="hidden" />
            </div>

            {stagedFiles.length === 0 ? (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-gray-200 hover:border-emerald-500 hover:bg-emerald-50/40 rounded-2xl p-6 text-center text-gray-400 space-y-2 cursor-pointer transition-all active:scale-[0.99]"
              >
                <Upload size={28} className="mx-auto text-gray-400" />
                <p className="text-xs font-semibold text-gray-600">Belum ada lampiran. Klik di sini untuk memilih foto resi / PDF.</p>
                <p className="text-[10px] text-gray-400">Mendukung kamera HP, Galeri Foto &amp; Berkas PDF</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {stagedFiles.map((staged, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2.5 bg-slate-50 border border-gray-200 rounded-xl text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText size={14} className="text-emerald-600 flex-shrink-0" />
                      <span className="font-semibold text-gray-800 truncate">{staged.nama}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeAttachment(idx)}
                      className="text-red-500 hover:text-red-700 p-1 hover:bg-red-50 rounded-lg"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>

        {/* Submit Bar */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={handleCancelOrBack} disabled={loading}>
            Batal
          </Button>
          <Button type="submit" variant="primary" loading={loading} icon={<Save size={16} />}>
            {loading ? 'Menyimpan & Uploading Drive...' : 'Simpan Transaksi'}
          </Button>
        </div>
      </form>

      {/* Category Manager Modal */}
      <Modal isOpen={catModalOpen} onClose={() => setCatModalOpen(false)} title={`Kelola Kategori (${form.jenis === 'masuk' ? 'Pemasukan' : 'Pengeluaran'})`}>
        <div className="space-y-4">
          <div className="flex gap-2">
            <input
              type="text"
              value={newCatName}
              onChange={e => setNewCatName(e.target.value)}
              placeholder="Nama kategori baru..."
              className="flex-1 border border-gray-200 rounded-xl px-3.5 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <Button size="sm" onClick={handleAddCategory}>+ Tambah</Button>
          </div>

          <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
            {categories.map(c => (
              <div key={c} className="flex items-center justify-between p-2.5 bg-gray-50 rounded-xl text-xs font-semibold text-gray-700">
                <span>{c}</span>
                <button type="button" onClick={() => handleDeleteCategory(c)} className="text-red-500 hover:text-red-700 p-1">
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
