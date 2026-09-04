// ============================================================
// ARKA Finance — Procurement Checklist Section
// Isolated fast rendering component with smooth inputs, item edit modal,
// and dedicated realization (harga aktual) modal workflow.
// ============================================================

import React, { useState, useMemo, useCallback } from 'react';
import {
  CheckSquare, Square, FileUp, ChevronDown, ChevronUp,
  PlusCircle, Edit3, Trash2, Ban, Layers, CheckCircle2, DollarSign, RefreshCw,
  Search, X, Filter
} from 'lucide-react';
import { type Project, type Transaction, type ProcurementItem } from '../../types';
import { Card, Button, formatRupiah, formatDate } from '../ui';
import { Modal } from '../ui/Modal';
import { isCapitalInjectionTx } from '../ui/PdfReportModal';

function formatRupiahInput(value: string): string {
  const num = value.replace(/\D/g, '');
  if (!num) return '';
  return new Intl.NumberFormat('id-ID').format(Number(num));
}

function parseRupiahNumber(value: string): number | undefined {
  const digits = value.replace(/\D/g, '');
  if (!digits) return undefined;
  const val = parseInt(digits, 10);
  return isNaN(val) ? undefined : val;
}

interface QuickAddFormProps {
  onAdd: (item: Omit<ProcurementItem, 'id' | 'isPurchased'>) => Promise<void>;
  injectionTxns: Transaction[];
  defaultSuratPengajuanId?: string;
}

// 1. ISOLATED QUICK ADD FORM (Prevents page re-renders on keystroke)
const QuickAddForm = React.memo(({ onAdd, injectionTxns, defaultSuratPengajuanId }: QuickAddFormProps) => {
  const [nama, setNama] = useState('');
  const [kuantitas, setKuantitas] = useState('1');
  const [satuan, setSatuan] = useState('');
  const [hargaRencana, setHargaRencana] = useState('');
  const [kategori, setKategori] = useState('Operational Cost');
  const [suratPengajuanId, setSuratPengajuanId] = useState(defaultSuratPengajuanId || '');
  const [submitting, setSubmitting] = useState(false);

  React.useEffect(() => {
    if (defaultSuratPengajuanId) {
      setSuratPengajuanId(defaultSuratPengajuanId);
    } else if (injectionTxns.length > 0 && !suratPengajuanId) {
      setSuratPengajuanId(injectionTxns[0].id);
    }
  }, [defaultSuratPengajuanId, injectionTxns]);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!nama.trim() || submitting) return;

    setSubmitting(true);
    try {
      await onAdd({
        nama: nama.trim(),
        kuantitas: parseInt(kuantitas, 10) || 1,
        satuan: satuan.trim() || undefined,
        hargaRencana: parseRupiahNumber(hargaRencana),
        kategori: kategori || 'Operational Cost',
        suratPengajuanId: suratPengajuanId || undefined,
      });
      setNama('');
      setKuantitas('1');
      setSatuan('');
      setHargaRencana('');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2.5 p-3 sm:p-4 bg-slate-50 border border-slate-200/80 rounded-2xl shadow-sm">
      <div className="w-full">
        <input
          type="text"
          value={nama}
          onChange={e => setNama(e.target.value)}
          className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-white shadow-sm font-medium"
          placeholder="Nama Barang / Kebutuhan (Cth: Kertas A4 / Wifi Kantor)"
        />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2 items-center">
        <div className="flex gap-1.5 col-span-2 sm:col-span-2 lg:col-span-2">
          <input
            type="number"
            min="1"
            value={kuantitas}
            onChange={e => setKuantitas(e.target.value)}
            className="w-16 border border-gray-200 rounded-xl px-2 py-2 text-sm text-center focus:outline-none focus:ring-2 focus:ring-primary bg-white shadow-sm font-bold text-gray-900"
            placeholder="Qty"
            title="Kuantitas"
          />
          <input
            type="text"
            value={satuan}
            onChange={e => setSatuan(e.target.value)}
            className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-white shadow-sm font-medium min-w-0"
            placeholder="Satuan (Pcs, Box...)"
            title="Satuan"
          />
        </div>
        <select
          value={kategori}
          onChange={e => setKategori(e.target.value)}
          className="col-span-2 sm:col-span-2 lg:col-span-1 border border-gray-200 rounded-xl px-2.5 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary bg-white text-gray-700 font-medium shadow-sm w-full truncate"
        >
          <option value="Operational Cost">📦 Operational Cost</option>
          <option value="Transportasi & Akomodasi">🚗 Transportasi & Akomodasi</option>
          <option value="Material & Perlengkapan Fisik">🧱 Material & Perlengkapan Fisik</option>
          <option value="Upah & Tenaga Kerja">👥 Upah & Tenaga Kerja</option>
          <option value="Utilities">⚡ Utilities</option>
          <option value="Overhead Cost">🏢 Overhead Cost</option>
          <option value="Biaya Lain-Lain">📑 Biaya Lain-Lain</option>
        </select>

        {injectionTxns.length > 0 && (
          <select
            value={suratPengajuanId}
            onChange={e => setSuratPengajuanId(e.target.value)}
            className="col-span-2 sm:col-span-2 lg:col-span-1 border border-blue-200 rounded-xl px-2.5 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary bg-blue-50/70 text-blue-900 font-bold shadow-sm w-full truncate"
            title="Tautkan item ini ke Surat Pengajuan tertentu"
          >
            <option value="">-- Tanpa Surat --</option>
            {injectionTxns.map((inj, idx) => (
              <option key={inj.id} value={inj.id}>
                📄 Surat #{idx + 1}: {inj.deskripsi.slice(0, 18)}
              </option>
            ))}
          </select>
        )}

        <input
          type="text"
          value={hargaRencana}
          onChange={e => setHargaRencana(formatRupiahInput(e.target.value))}
          className={`border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-white shadow-sm font-bold text-gray-900 ${injectionTxns.length > 0 ? 'col-span-2 sm:col-span-2 lg:col-span-1' : 'col-span-2 sm:col-span-2 lg:col-span-2'}`}
          placeholder="Total Rencana (Rp)"
        />

        <Button
          type="submit"
          variant="primary"
          size="sm"
          disabled={!nama.trim() || submitting}
          icon={<PlusCircle size={16} />}
          className="col-span-2 sm:col-span-2 lg:col-span-1 w-full justify-center shadow-sm py-2.5 font-bold"
        >
          {submitting ? 'Menambah...' : 'Tambah Item'}
        </Button>
      </div>
    </form>
  );
});

interface Props {
  project: Project;
  transactions: Transaction[];
  onOpenImportModal: () => void;
  onUpdateProcurementItems: (newItems: ProcurementItem[]) => Promise<void>;
  addToast: (type: 'success' | 'error' | 'info', message: string) => void;
}

export function ProcurementChecklistSection({
  project,
  transactions,
  onOpenImportModal,
  onUpdateProcurementItems,
  addToast,
}: Props) {
  // Accordion Expand State
  const [expanded, setExpanded] = useState(() => {
    const saved = localStorage.getItem(`procurement_expanded_${project.id}`);
    return saved !== null ? saved === 'true' : true;
  });

  const toggleExpanded = () => {
    setExpanded(prev => {
      const next = !prev;
      localStorage.setItem(`procurement_expanded_${project.id}`, String(next));
      return next;
    });
  };

  // Batch Selection State
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [batchItemPengajuanId, setBatchItemPengajuanId] = useState<string>('');
  const [batchItemSaving, setBatchItemSaving] = useState<boolean>(false);

  // Edit Item Modal State
  const [editingItem, setEditingItem] = useState<ProcurementItem | null>(null);
  const [editNama, setEditNama] = useState('');
  const [editKuantitas, setEditKuantitas] = useState('1');
  const [editSatuan, setEditSatuan] = useState('');
  const [editHargaRencana, setEditHargaRencana] = useState('');
  const [editKategori, setEditKategori] = useState('Operational Cost');
  const [editSuratPengajuanId, setEditSuratPengajuanId] = useState<string>('');
  const [editSaving, setEditSaving] = useState(false);

  // Realization Modal State
  const [realizingItem, setRealizingItem] = useState<ProcurementItem | null>(null);
  const [realisasiHargaInput, setRealisasiHargaInput] = useState('');
  const [realisasiSaving, setRealisasiSaving] = useState(false);

  // 1. ADD ITEM
  const handleAddItem = useCallback(async (newItemData: Omit<ProcurementItem, 'id' | 'isPurchased'>) => {
    const existing = project.procurementItems || [];
    const item: ProcurementItem = {
      ...newItemData,
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      isPurchased: false,
    };
    try {
      await onUpdateProcurementItems([...existing, item]);
      addToast('success', `Item "${item.nama}" berhasil ditambahkan`);
    } catch {
      addToast('error', 'Gagal menambahkan item pengadaan');
    }
  }, [project.procurementItems, onUpdateProcurementItems, addToast]);

  // 2. OPEN EDIT MODAL
  const openEditModal = (item: ProcurementItem) => {
    setEditingItem(item);
    setEditNama(item.nama);
    setEditKuantitas(String(item.kuantitas || 1));
    setEditSatuan(item.satuan || '');
    setEditHargaRencana(item.hargaRencana ? new Intl.NumberFormat('id-ID').format(item.hargaRencana) : '');
    setEditKategori(item.kategori || 'Operational Cost');
    setEditSuratPengajuanId(item.suratPengajuanId || '');
  };

  const handleSaveEditItem = async () => {
    if (!editingItem || !editNama.trim()) return;
    setEditSaving(true);
    try {
      const items = (project.procurementItems || []).map(item => {
        if (item.id === editingItem.id) {
          return {
            ...item,
            nama: editNama.trim(),
            kuantitas: parseInt(editKuantitas, 10) || 1,
            satuan: editSatuan.trim() || undefined,
            hargaRencana: parseRupiahNumber(editHargaRencana),
            kategori: editKategori,
            suratPengajuanId: editSuratPengajuanId || undefined,
          };
        }
        return item;
      });
      await onUpdateProcurementItems(items);
      addToast('success', 'Item berhasil diperbarui');
      setEditingItem(null);
    } catch {
      addToast('error', 'Gagal memperbarui item');
    } finally {
      setEditSaving(false);
    }
  };

  // 3. OPEN REALIZATION MODAL / WORKFLOW
  const openRealizationModal = (item: ProcurementItem) => {
    setRealizingItem(item);
    // Pre-fill with existing hargaAktual or fallback to hargaRencana
    const initialPrice = item.hargaAktual !== undefined
      ? item.hargaAktual
      : (item.hargaRencana !== undefined ? item.hargaRencana : 0);
    setRealisasiHargaInput(initialPrice > 0 ? new Intl.NumberFormat('id-ID').format(initialPrice) : '');
  };

  const handleSaveRealization = async () => {
    if (!realizingItem) return;
    setRealisasiSaving(true);
    try {
      const hAktual = parseRupiahNumber(realisasiHargaInput);
      const items = (project.procurementItems || []).map(item => {
        if (item.id === realizingItem.id) {
          return {
            ...item,
            isPurchased: true,
            isCancelled: false,
            hargaAktual: hAktual !== undefined ? hAktual : item.hargaRencana,
          };
        }
        return item;
      });
      await onUpdateProcurementItems(items);
      addToast('success', `Status realisasi untuk "${realizingItem.nama}" berhasil disimpan`);
      setRealizingItem(null);
    } catch {
      addToast('error', 'Gagal menyimpan realisasi');
    } finally {
      setRealisasiSaving(false);
    }
  };

  const handleCancelRealization = async (itemId: string) => {
    try {
      const items = (project.procurementItems || []).map(item => {
        if (item.id === itemId) {
          return {
            ...item,
            isPurchased: false,
            hargaAktual: undefined,
          };
        }
        return item;
      });
      await onUpdateProcurementItems(items);
      addToast('info', 'Status realisasi dibatalkan');
      setRealizingItem(null);
    } catch {
      addToast('error', 'Gagal membatalkan status realisasi');
    }
  };

  // 4. TOGGLE CANCEL ITEM (Tandai Batal Beli)
  const handleToggleCancelItem = async (itemId: string, currentCancelled?: boolean) => {
    try {
      const items = (project.procurementItems || []).map(item => {
        if (item.id === itemId) {
          return {
            ...item,
            isCancelled: !currentCancelled,
            isPurchased: false,
          };
        }
        return item;
      });
      await onUpdateProcurementItems(items);
      addToast('info', !currentCancelled ? 'Item ditandai dibatalkan' : 'Item diaktifkan kembali');
    } catch {
      addToast('error', 'Gagal mengubah status pembatalan item');
    }
  };

  // 5. DELETE ITEM
  const handleDeleteItem = async (itemId: string) => {
    try {
      const items = (project.procurementItems || []).filter(item => item.id !== itemId);
      await onUpdateProcurementItems(items);
      addToast('success', 'Item berhasil dihapus');
    } catch {
      addToast('error', 'Gagal menghapus item');
    }
  };

  // 6. BATCH & SINGLE TAGGING TO SURAT PENGAJUAN
  const handleSingleTagItem = async (itemId: string, targetSuratId: string) => {
    try {
      const items = (project.procurementItems || []).map(item =>
        item.id === itemId ? { ...item, suratPengajuanId: targetSuratId || undefined } : item
      );
      await onUpdateProcurementItems(items);
      addToast('success', 'Tautan Surat Pengajuan berhasil diperbarui');
    } catch {
      addToast('error', 'Gagal memperbarui tautan Surat Pengajuan');
    }
  };

  const handleBatchTagItems = async () => {
    if (!batchItemPengajuanId || selectedItemIds.length === 0) return;
    setBatchItemSaving(true);
    try {
      const items = (project.procurementItems || []).map(item =>
        selectedItemIds.includes(item.id) ? { ...item, suratPengajuanId: batchItemPengajuanId } : item
      );
      await onUpdateProcurementItems(items);
      addToast('success', `Berhasil menautkan ${selectedItemIds.length} item pengadaan ke Surat Pengajuan!`);
      setSelectedItemIds([]);
      setBatchItemPengajuanId('');
    } catch {
      addToast('error', 'Gagal menautkan item pengadaan');
    } finally {
      setBatchItemSaving(false);
    }
  };

  const procurementItems = project.procurementItems || [];

  // Filter States
  const [filterSuratPengajuan, setFilterSuratPengajuan] = useState<string>('semua');
  const [searchItem, setSearchItem] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<'semua' | 'unpurchased' | 'purchased' | 'cancelled'>('semua');

  const injectionTxns = useMemo(() => {
    return transactions
      .filter(t => t.proyekId === project.id && isCapitalInjectionTx(t))
      .sort((a, b) => new Date(a.tanggal).getTime() - new Date(b.tanggal).getTime());
  }, [transactions, project.id]);

  // Filtered Items Calculation
  const filteredProcurementItems = useMemo(() => {
    return procurementItems.filter(item => {
      // 1. Filter Surat Pengajuan
      if (filterSuratPengajuan === 'unlinked') {
        if (item.suratPengajuanId) return false;
      } else if (filterSuratPengajuan !== 'semua') {
        if (item.suratPengajuanId !== filterSuratPengajuan) return false;
      }

      // 2. Filter Status
      if (filterStatus === 'purchased' && (!item.isPurchased || item.isCancelled)) return false;
      if (filterStatus === 'unpurchased' && (item.isPurchased || item.isCancelled)) return false;
      if (filterStatus === 'cancelled' && !item.isCancelled) return false;

      // 3. Search Query
      if (searchItem.trim()) {
        const q = searchItem.toLowerCase();
        const matchName = (item.nama || '').toLowerCase().includes(q);
        const matchKat = (item.kategori || '').toLowerCase().includes(q);
        const matchSat = (item.satuan || '').toLowerCase().includes(q);
        if (!matchName && !matchKat && !matchSat) return false;
      }

      return true;
    });
  }, [procurementItems, filterSuratPengajuan, filterStatus, searchItem]);

  // Group items by category from filtered list
  const groupedItems = useMemo(() => {
    return filteredProcurementItems.reduce((acc, item) => {
      const cat = item.kategori || 'Operational Cost';
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(item);
      return acc;
    }, {} as Record<string, ProcurementItem[]>);
  }, [filteredProcurementItems]);

  const categories = useMemo(() => Object.keys(groupedItems), [groupedItems]);

  const progress = useMemo(() => {
    const total = filteredProcurementItems.length;
    const purchased = filteredProcurementItems.filter(i => i.isPurchased && !i.isCancelled).length;
    const pct = total === 0 ? 0 : Math.round((purchased / total) * 100);
    return { total, purchased, pct };
  }, [filteredProcurementItems]);

  return (
    <Card className="!p-5 border border-gray-100 shadow-card animate-fade-in">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 pb-3 border-b border-gray-100">
        <div>
          <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
            <CheckSquare className="text-blue-600" size={18} /> Daftar Kebutuhan Pengadaan
          </h2>
          <p className="text-xs text-gray-500 mt-1">Checklist kesesuaian belanja dengan realisasi anggaran lapangan.</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              icon={expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              onClick={toggleExpanded}
            >
              {expanded ? 'Tutup Checklist' : 'Buka Checklist'}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              icon={<FileUp size={15} className="text-emerald-600" />}
              onClick={onOpenImportModal}
            >
              Import Teks Praktis
            </Button>
          </div>
          <div className="flex flex-col items-end gap-1 ml-1">
            <span className="text-xs font-bold text-gray-700">
              Progress: {progress.purchased} / {progress.total} Item ({progress.pct}%)
            </span>
            <div className="w-28 bg-gray-200 rounded-full h-2 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  progress.pct === 100 ? 'bg-emerald-500' : 'bg-blue-500'
                }`}
                style={{ width: `${progress.pct}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {expanded && (
        <div className="space-y-4 pt-1">
          {/* Batch Tagging Control Bar */}
          {selectedItemIds.length > 0 && injectionTxns.length > 0 && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 animate-fade-in my-2 shadow-sm">
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-900">
                <CheckSquare size={16} className="text-emerald-600" />
                <span>{selectedItemIds.length} Item Pengadaan Terpilih</span>
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <select
                  value={batchItemPengajuanId}
                  onChange={e => setBatchItemPengajuanId(e.target.value)}
                  className="px-3 py-1.5 bg-white border border-emerald-300 text-emerald-900 rounded-xl text-xs font-bold shadow-sm focus:outline-none"
                >
                  <option value="">-- Tautkan ke Surat Pengajuan --</option>
                  {injectionTxns.map((inj, idx) => (
                    <option key={inj.id} value={inj.id}>
                      📄 Pengajuan #{idx + 1}: {inj.deskripsi.slice(0, 30)} ({formatDate(inj.tanggal)})
                    </option>
                  ))}
                </select>
                <Button
                  variant="primary"
                  size="sm"
                  disabled={!batchItemPengajuanId || batchItemSaving}
                  loading={batchItemSaving}
                  onClick={handleBatchTagItems}
                >
                  📌 Tautkan ({selectedItemIds.length})
                </Button>
                <Button variant="secondary" size="sm" onClick={() => setSelectedItemIds([])}>
                  Batal
                </Button>
              </div>
            </div>
          )}

          {/* Isolated Quick Add Form */}
          <QuickAddForm
            onAdd={handleAddItem}
            injectionTxns={injectionTxns}
            defaultSuratPengajuanId={filterSuratPengajuan !== 'semua' && filterSuratPengajuan !== 'unlinked' ? filterSuratPengajuan : undefined}
          />

          {/* Quick Filter Bar (Surat Pengajuan, Status & Search) */}
          {procurementItems.length > 0 && (
            <div className="p-3 bg-gray-50/90 border border-gray-200/80 rounded-2xl flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 shadow-2xs">
              {/* Left: Surat Pengajuan Selector & Search */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 flex-1 min-w-0">
                {/* Surat Pengajuan Filter Dropdown */}
                {injectionTxns.length > 0 && (
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-[11px] font-bold text-gray-500 whitespace-nowrap">📄 Surat:</span>
                    <select
                      value={filterSuratPengajuan}
                      onChange={e => setFilterSuratPengajuan(e.target.value)}
                      className="px-2.5 py-1.5 bg-white border border-gray-300 rounded-xl text-xs font-bold text-gray-800 shadow-xs focus:outline-none focus:ring-2 focus:ring-blue-500 max-w-[200px] truncate"
                    >
                      <option value="semua">🌐 Semua Surat ({procurementItems.length})</option>
                      <option value="unlinked">⚠️ Belum Ditautkan ({procurementItems.filter(i => !i.suratPengajuanId).length})</option>
                      {injectionTxns.map((inj, idx) => {
                        const count = procurementItems.filter(i => i.suratPengajuanId === inj.id).length;
                        return (
                          <option key={inj.id} value={inj.id}>
                            Pengajuan #{idx + 1}: {inj.deskripsi.slice(0, 20)} ({count})
                          </option>
                        );
                      })}
                    </select>
                  </div>
                )}

                {/* Search Item Bar */}
                <div className="relative flex-1 min-w-[140px]">
                  <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={searchItem}
                    onChange={e => setSearchItem(e.target.value)}
                    placeholder="Cari item pengadaan..."
                    className="w-full pl-8 pr-7 py-1.5 bg-white border border-gray-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs"
                  />
                  {searchItem && (
                    <button
                      type="button"
                      onClick={() => setSearchItem('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>
              </div>

              {/* Right: Status Pill Tabs */}
              <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-gray-200/70 text-xs font-semibold overflow-x-auto self-start md:self-auto">
                <button
                  type="button"
                  onClick={() => setFilterStatus('semua')}
                  className={`px-2.5 py-1 rounded-lg transition-all whitespace-nowrap text-[11px] font-bold ${
                    filterStatus === 'semua' ? 'bg-slate-900 text-white shadow-xs' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Semua ({filteredProcurementItems.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterStatus('unpurchased')}
                  className={`px-2.5 py-1 rounded-lg transition-all whitespace-nowrap text-[11px] font-bold ${
                    filterStatus === 'unpurchased' ? 'bg-blue-600 text-white shadow-xs' : 'text-gray-600 hover:text-blue-700'
                  }`}
                >
                  🛒 Belum Beli
                </button>
                <button
                  type="button"
                  onClick={() => setFilterStatus('purchased')}
                  className={`px-2.5 py-1 rounded-lg transition-all whitespace-nowrap text-[11px] font-bold ${
                    filterStatus === 'purchased' ? 'bg-emerald-600 text-white shadow-xs' : 'text-gray-600 hover:text-emerald-700'
                  }`}
                >
                  ✅ Sudah Beli
                </button>
                <button
                  type="button"
                  onClick={() => setFilterStatus('cancelled')}
                  className={`px-2.5 py-1 rounded-lg transition-all whitespace-nowrap text-[11px] font-bold ${
                    filterStatus === 'cancelled' ? 'bg-rose-600 text-white shadow-xs' : 'text-gray-600 hover:text-rose-700'
                  }`}
                >
                  🚫 Batal
                </button>
              </div>
            </div>
          )}

          {/* Item List by Category */}
          {procurementItems.length === 0 ? (
            <div className="text-center py-8 px-4 border border-dashed border-gray-200 rounded-2xl bg-gray-50/50 my-3 space-y-2">
              <p className="text-sm font-semibold text-gray-700">Belum ada item checklist pengadaan</p>
              <p className="text-xs text-gray-500 max-w-md mx-auto">
                Gunakan form di atas untuk menambah item satu per satu, atau klik tombol di bawah untuk import dari teks WhatsApp/Excel.
              </p>
              <Button
                variant="secondary"
                size="sm"
                icon={<FileUp size={15} className="text-emerald-600" />}
                onClick={onOpenImportModal}
                className="mt-2"
              >
                Import Teks Praktis Sekarang
              </Button>
            </div>
          ) : filteredProcurementItems.length === 0 ? (
            <div className="text-center py-8 px-4 border border-dashed border-gray-200 rounded-2xl bg-gray-50/50 my-3 space-y-2">
              <p className="text-sm font-semibold text-gray-700">Tidak ada item yang sesuai dengan filter</p>
              <p className="text-xs text-gray-500">Coba ubah pilihan surat pengajuan, status, atau kata kunci pencarian Anda.</p>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setFilterSuratPengajuan('semua');
                  setFilterStatus('semua');
                  setSearchItem('');
                }}
                className="mt-1"
              >
                Reset Filter Pengadaan
              </Button>
            </div>
          ) : (
            <div className="space-y-5 mt-4">
              {categories.map(catName => {
                const catItems = groupedItems[catName];
                const catTotal = catItems.length;
                const catPurchased = catItems.filter(i => i.isPurchased).length;
                const catRencana = catItems.reduce((s, i) => s + (i.hargaRencana || 0), 0);
                const catAktual = catItems.reduce((s, i) => s + (i.hargaAktual || 0), 0);

                return (
                  <div key={catName} className="space-y-2 border border-gray-200/80 rounded-2xl p-4 bg-slate-50/50">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2 border-b border-gray-200 gap-1">
                      <div className="flex items-center gap-2">
                        <Layers size={16} className="text-blue-600" />
                        <h3 className="text-sm font-bold text-gray-800 tracking-tight">{catName}</h3>
                        <span className="text-[10px] font-bold px-2 py-0.5 bg-blue-100/70 text-blue-700 rounded-full border border-blue-200/60">
                          {catPurchased}/{catTotal} Item
                        </span>
                      </div>
                      {catRencana > 0 && (
                        <span className="text-[11px] font-medium text-gray-500">
                          Rencana: <strong className="text-gray-700">{formatRupiah(catRencana)}</strong>
                          {catAktual > 0 && (
                            <> · Realisasi: <strong className="text-emerald-700">{formatRupiah(catAktual)}</strong></>
                          )}
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-1 gap-2 pt-1">
                      {catItems.map(item => (
                        <div
                          key={item.id}
                          className={`flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-xl border transition-all ${
                            selectedItemIds.includes(item.id)
                              ? 'bg-emerald-100/70 border-emerald-300 shadow-sm'
                              : item.isCancelled
                              ? 'bg-gray-100/70 border-gray-300 opacity-75'
                              : item.isPurchased
                              ? 'bg-emerald-50/60 border-emerald-200 shadow-xs'
                              : 'bg-white border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          {/* Item Checkbox & Name */}
                          <div className="flex items-start sm:items-center gap-3 flex-1 min-w-0">
                            <input
                              type="checkbox"
                              checked={selectedItemIds.includes(item.id)}
                              onChange={e => {
                                if (e.target.checked) {
                                  setSelectedItemIds(prev => [...prev, item.id]);
                                } else {
                                  setSelectedItemIds(prev => prev.filter(i => i !== item.id));
                                }
                              }}
                              className="w-4 h-4 mt-0.5 sm:mt-0 rounded text-emerald-600 focus:ring-emerald-500 border-gray-300 cursor-pointer"
                            />
                            <div className="flex items-start sm:items-center gap-2.5 flex-1 min-w-0">
                              {item.isCancelled ? (
                                <Ban size={18} className="text-gray-400 flex-shrink-0 mt-0.5 sm:mt-0" />
                              ) : item.isPurchased ? (
                                <CheckCircle2 size={18} className="text-emerald-600 flex-shrink-0 mt-0.5 sm:mt-0" />
                              ) : (
                                <Square size={18} className="text-gray-400 flex-shrink-0 mt-0.5 sm:mt-0" />
                              )}
                              <div className="flex flex-col min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span
                                    className={`text-sm font-semibold ${
                                      item.isCancelled
                                        ? 'text-gray-400 line-through'
                                        : item.isPurchased
                                        ? 'text-gray-800'
                                        : 'text-gray-900'
                                    }`}
                                  >
                                    {item.nama}
                                  </span>
                                  {item.kuantitas > 1 && (
                                    <span className="text-xs font-bold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded-md border border-slate-200">
                                      {item.kuantitas} {item.satuan || 'pcs'}
                                    </span>
                                  )}
                                  {item.hargaRencana !== undefined && item.hargaRencana > 0 && (
                                    <span className="text-xs text-gray-500 font-medium">
                                      (Est: {formatRupiah(item.hargaRencana)})
                                    </span>
                                  )}
                                </div>
                                {injectionTxns.length > 0 && (
                                  <div className="mt-1 flex items-center gap-1.5">
                                    <select
                                      value={item.suratPengajuanId || ''}
                                      onChange={e => handleSingleTagItem(item.id, e.target.value)}
                                      onClick={e => e.stopPropagation()}
                                      className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border transition-all cursor-pointer ${
                                        item.suratPengajuanId
                                          ? 'bg-blue-50 text-blue-800 border-blue-300 hover:bg-blue-100'
                                          : 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100'
                                      }`}
                                    >
                                      <option value="">⚠️ Belum Ditautkan ke Surat</option>
                                      {injectionTxns.map((inj, idx) => (
                                        <option key={inj.id} value={inj.id}>
                                          📌 Taut ke Surat #{idx + 1}: {inj.deskripsi.slice(0, 25)}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Right Side Actions: Realisasi, Edit, Cancel, Delete */}
                          <div className="flex items-center gap-2 mt-2 sm:mt-0 sm:ml-4 self-end sm:self-auto flex-wrap">
                            {/* Realization Badge / Button */}
                            {item.isPurchased ? (
                              <button
                                type="button"
                                onClick={() => openRealizationModal(item)}
                                className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-lg text-xs font-bold border border-emerald-300 hover:bg-emerald-200 transition-colors"
                                title="Klik untuk edit nominal realisasi riil"
                              >
                                <CheckCircle2 size={13} className="text-emerald-700" />
                                <span>Realisasi: {item.hargaAktual !== undefined ? formatRupiah(item.hargaAktual) : 'Sudah Beli'}</span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                disabled={item.isCancelled}
                                onClick={() => openRealizationModal(item)}
                                className="flex items-center gap-1 px-2.5 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg text-xs font-bold border border-blue-200 transition-colors disabled:opacity-50"
                                title="Klik untuk input harga realisasi pembelian"
                              >
                                <DollarSign size={13} className="text-blue-600" />
                                <span>Input Realisasi</span>
                              </button>
                            )}

                            {/* Edit Item Button */}
                            <button
                              type="button"
                              onClick={() => openEditModal(item)}
                              className="p-1.5 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg border border-gray-200 transition-colors"
                              title="Edit Detail Item"
                            >
                              <Edit3 size={15} />
                            </button>

                            {/* Toggle Cancel Button */}
                            <button
                              type="button"
                              onClick={() => handleToggleCancelItem(item.id, item.isCancelled)}
                              className={`px-2 py-1 rounded-lg text-[10.5px] font-bold border transition-all ${
                                item.isCancelled
                                  ? 'bg-blue-50 text-blue-700 border-blue-200'
                                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200 border-gray-200'
                              }`}
                              title={item.isCancelled ? 'Aktifkan Kembali Item' : 'Tandai Dibatalkan'}
                            >
                              {item.isCancelled ? '🔄 Aktifkan' : '🚫 Batal'}
                            </button>

                            {/* Delete Button */}
                            <button
                              type="button"
                              onClick={() => handleDeleteItem(item.id)}
                              className="text-gray-400 hover:text-red-600 p-1.5 rounded-lg border border-transparent hover:bg-red-50 transition-colors"
                              title="Hapus Item"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* MODAL 1: EDIT ITEM DETAILS */}
      <Modal
        isOpen={!!editingItem}
        onClose={() => setEditingItem(null)}
        title="Edit Item Pengadaan"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Nama Barang / Kebutuhan:</label>
            <input
              type="text"
              value={editNama}
              onChange={e => setEditNama(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary font-medium"
              placeholder="Contoh: Semen Padang"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Kuantitas (Qty):</label>
              <input
                type="number"
                min="1"
                value={editKuantitas}
                onChange={e => setEditKuantitas(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary font-bold"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Satuan:</label>
              <input
                type="text"
                value={editSatuan}
                onChange={e => setEditSatuan(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="Sak, Pcs, Unit, Load, dll"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Kategori Pos Belanja:</label>
            <select
              value={editKategori}
              onChange={e => setEditKategori(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3.5 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary bg-white font-medium"
            >
              <option value="Operational Cost">📦 Operational Cost</option>
              <option value="Transportasi & Akomodasi">🚗 Transportasi & Akomodasi</option>
              <option value="Material & Perlengkapan Fisik">🧱 Material & Perlengkapan Fisik</option>
              <option value="Upah & Tenaga Kerja">👥 Upah & Tenaga Kerja</option>
              <option value="Utilities">⚡ Utilities</option>
              <option value="Overhead Cost">🏢 Overhead Cost</option>
              <option value="Biaya Lain-Lain">📑 Biaya Lain-Lain</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Estimasi Harga Rencana (Rp):</label>
            <input
              type="text"
              value={editHargaRencana}
              onChange={e => setEditHargaRencana(formatRupiahInput(e.target.value))}
              className="w-full border border-gray-200 rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary font-bold text-gray-900"
              placeholder="0"
            />
          </div>

          {injectionTxns.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Tautkan ke Surat Pengajuan Tujuan:</label>
              <select
                value={editSuratPengajuanId}
                onChange={e => setEditSuratPengajuanId(e.target.value)}
                className="w-full border border-blue-200 rounded-xl px-3.5 py-2 text-xs font-bold text-blue-900 bg-blue-50/70 focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">-- Tanpa Surat Pengajuan (Umum) --</option>
                {injectionTxns.map((inj, idx) => (
                  <option key={inj.id} value={inj.id}>
                    📌 Surat Pengajuan #{idx + 1}: {inj.deskripsi.slice(0, 35)}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
            <Button variant="secondary" size="sm" onClick={() => setEditingItem(null)}>
              Batal
            </Button>
            <Button
              variant="primary"
              size="sm"
              loading={editSaving}
              onClick={handleSaveEditItem}
              disabled={!editNama.trim() || editSaving}
            >
              Simpan Perubahan
            </Button>
          </div>
        </div>
      </Modal>

      {/* MODAL 2: INPUT REALISASI HARGA AKTUAL */}
      <Modal
        isOpen={!!realizingItem}
        onClose={() => setRealizingItem(null)}
        title="Input / Edit Realisasi Pembelian"
      >
        {realizingItem && (
          <div className="space-y-4">
            <div className="p-3 bg-slate-900 text-white rounded-2xl space-y-1">
              <p className="text-xs text-slate-400">Item Pengadaan:</p>
              <p className="text-base font-bold text-emerald-400">{realizingItem.nama}</p>
              <div className="flex justify-between text-xs text-slate-300 pt-1 border-t border-slate-800">
                <span>Qty: {realizingItem.kuantitas} {realizingItem.satuan || 'pcs'}</span>
                <span>Estimasi Rencana: {realizingItem.hargaRencana ? formatRupiah(realizingItem.hargaRencana) : '-'}</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Nominal Harga Realisasi Riil Pembelian (Rp):
              </label>
              <input
                type="text"
                autoFocus
                value={realisasiHargaInput}
                onChange={e => setRealisasiHargaInput(formatRupiahInput(e.target.value))}
                onKeyDown={e => e.key === 'Enter' && handleSaveRealization()}
                className="w-full border border-gray-200 rounded-xl p-3 text-lg font-extrabold focus:outline-none focus:ring-2 focus:ring-emerald-500 text-emerald-900 bg-emerald-50/30"
                placeholder="Masukkan nominal belanja riil..."
              />
              <p className="text-[10.5px] text-gray-500 mt-1">
                Tekan tombol Simpan Realisasi di bawah untuk memperbarui status item menjadi <strong>Sudah Beli</strong>.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-3 border-t border-gray-100">
              {realizingItem.isPurchased ? (
                <button
                  type="button"
                  onClick={() => handleCancelRealization(realizingItem.id)}
                  className="text-xs font-bold text-red-600 hover:text-red-800 flex items-center gap-1 py-1"
                >
                  <RefreshCw size={13} /> Batalkan Status Realisasi
                </button>
              ) : <div />}

              <div className="flex gap-2 w-full sm:w-auto justify-end">
                <Button variant="secondary" size="sm" onClick={() => setRealizingItem(null)}>
                  Batal
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  loading={realisasiSaving}
                  onClick={handleSaveRealization}
                  className="!bg-emerald-600 hover:!bg-emerald-700"
                >
                  ✅ Simpan Realisasi
                </Button>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </Card>
  );
}
