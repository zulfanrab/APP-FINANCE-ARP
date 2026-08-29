import React, { useState, useEffect, useMemo } from 'react';
import {
  Receipt,
  Plus,
  Search,
  Calendar,
  DollarSign,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Trash2,
  Edit2,
  CreditCard,
  ArrowUpRight,
  ArrowDownLeft,
  FileSpreadsheet,
  Building2,
  Phone,
  Info,
  RefreshCw,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { type DebtItem, type DebtType, type DebtStatus, type Project } from '../types';
import {
  getDebts,
  addDebt,
  updateDebt,
  deleteDebt,
  recordDebtPayment,
} from '../services/debtService';
import { getProjects } from '../services/projectService';
import { formatDate, formatRupiah } from '../components/ui';
import { Modal } from '../components/ui/Modal';
import { useApp } from '../context/AppContext';
import { calculateCompanyLedger } from '../services/financialEngine';

function formatInputRupiah(value: string): string {
  const num = value.replace(/\D/g, '');
  if (!num) return '';
  return new Intl.NumberFormat('id-ID').format(Number(num));
}

function parseFormattedRupiah(value: string): number {
  return Number(value.replace(/\./g, '').replace(',', ''));
}

export default function DebtHub() {
  const { transactions } = useApp();
  const [debts, setDebts] = useState<DebtItem[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<DebtType>('piutang');
  const [statusFilter, setStatusFilter] = useState<string>('semua');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProyekId, setSelectedProyekId] = useState<string>('semua');

  // Modals state
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedDebt, setSelectedDebt] = useState<DebtItem | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    id: '',
    tipe: 'piutang' as DebtType,
    judul: '',
    kontakNama: '',
    kontakHp: '',
    proyekId: '',
    nomorInvoice: '',
    totalNominalFormatted: '',
    tanggalTerbit: new Date().toISOString().split('T')[0],
    tanggalJatuhTempo: new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0],
    keterangan: '',
  });

  // Payment Form State
  const [payData, setPayData] = useState({
    nominalFormatted: '',
    tanggal: new Date().toISOString().split('T')[0],
    catatan: '',
    rekeningId: 'bca_utama',
    autoCreateCash: true,
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const [dList, pList] = await Promise.all([getDebts(), getProjects()]);
      setDebts(dList);
      setProjects(pList);
    } catch (err) {
      console.error('Gagal memuat data hutang piutang:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Check Overdue Status
  const getCalculatedStatus = (item: DebtItem): DebtStatus => {
    if (item.sisaNominal <= 0) return 'lunas';
    const today = new Date().toISOString().split('T')[0];
    if (item.tanggalJatuhTempo < today) return 'jatuh_tempo';
    if (item.dibayarNominal > 0) return 'cicilan';
    return 'belum_lunas';
  };

  // Metrics Calculations
  const metrics = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const piutangs = debts.filter(d => d.tipe === 'piutang');
    const hutangs = debts.filter(d => d.tipe === 'hutang');

    const totalPiutangNominal = piutangs.reduce((sum, d) => sum + d.totalNominal, 0);
    const sisaPiutangNominal = piutangs.reduce((sum, d) => sum + d.sisaNominal, 0);
    const dibayarPiutangNominal = piutangs.reduce((sum, d) => sum + d.dibayarNominal, 0);

    const totalHutangNominal = hutangs.reduce((sum, d) => sum + d.totalNominal, 0);
    const sisaHutangNominal = hutangs.reduce((sum, d) => sum + d.sisaNominal, 0);
    const dibayarHutangNominal = hutangs.reduce((sum, d) => sum + d.dibayarNominal, 0);

    const overdueCount = debts.filter(d => d.sisaNominal > 0 && d.tanggalJatuhTempo < today).length;
    const overdueNominal = debts
      .filter(d => d.sisaNominal > 0 && d.tanggalJatuhTempo < today)
      .reduce((sum, d) => sum + d.sisaNominal, 0);

    const netReceivablePayable = sisaPiutangNominal - sisaHutangNominal;
    const ledger = calculateCompanyLedger(transactions, projects);
    const liquidPlusNet = ledger.sisaKasTotal + netReceivablePayable;

    return {
      totalPiutangNominal,
      sisaPiutangNominal,
      dibayarPiutangNominal,
      totalHutangNominal,
      sisaHutangNominal,
      dibayarHutangNominal,
      overdueCount,
      overdueNominal,
      netReceivablePayable,
      liquidPlusNet,
    };
  }, [debts, transactions, projects]);

  // Filtered List
  const filteredDebts = useMemo(() => {
    return debts
      .filter(d => d.tipe === activeTab)
      .filter(d => {
        const computedStatus = getCalculatedStatus(d);
        if (statusFilter === 'semua') return true;
        if (statusFilter === 'jatuh_tempo') return computedStatus === 'jatuh_tempo';
        if (statusFilter === 'belum_lunas') return computedStatus === 'belum_lunas';
        if (statusFilter === 'cicilan') return computedStatus === 'cicilan';
        if (statusFilter === 'lunas') return computedStatus === 'lunas';
        return true;
      })
      .filter(d => {
        if (selectedProyekId === 'semua') return true;
        return d.proyekId === selectedProyekId;
      })
      .filter(d => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        return (
          d.judul.toLowerCase().includes(q) ||
          d.kontakNama.toLowerCase().includes(q) ||
          (d.nomorInvoice && d.nomorInvoice.toLowerCase().includes(q)) ||
          (d.keterangan && d.keterangan.toLowerCase().includes(q))
        );
      })
      .sort((a, b) => {
        const aStatus = getCalculatedStatus(a);
        const bStatus = getCalculatedStatus(b);
        if (aStatus === 'jatuh_tempo' && bStatus !== 'jatuh_tempo') return -1;
        if (bStatus === 'jatuh_tempo' && aStatus !== 'jatuh_tempo') return 1;
        return new Date(a.tanggalJatuhTempo).getTime() - new Date(b.tanggalJatuhTempo).getTime();
      });
  }, [debts, activeTab, statusFilter, selectedProyekId, searchQuery]);

  // Handle Open Create / Edit Form
  const handleOpenCreate = (type: DebtType) => {
    setFormData({
      id: '',
      tipe: type,
      judul: '',
      kontakNama: '',
      kontakHp: '',
      proyekId: '',
      nomorInvoice: '',
      totalNominalFormatted: '',
      tanggalTerbit: new Date().toISOString().split('T')[0],
      tanggalJatuhTempo: new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0],
      keterangan: '',
    });
    setIsFormModalOpen(true);
  };

  const handleOpenEdit = (item: DebtItem) => {
    setFormData({
      id: item.id,
      tipe: item.tipe,
      judul: item.judul,
      kontakNama: item.kontakNama,
      kontakHp: item.kontakHp || '',
      proyekId: item.proyekId || '',
      nomorInvoice: item.nomorInvoice || '',
      totalNominalFormatted: formatInputRupiah(item.totalNominal.toString()),
      tanggalTerbit: item.tanggalTerbit,
      tanggalJatuhTempo: item.tanggalJatuhTempo,
      keterangan: item.keterangan || '',
    });
    setIsFormModalOpen(true);
  };

  const handleSaveForm = async (e: React.FormEvent) => {
    e.preventDefault();
    const nominal = parseFormattedRupiah(formData.totalNominalFormatted);
    if (nominal <= 0) {
      alert('Mohon masukkan total nominal tagihan yang valid.');
      return;
    }
    if (!formData.judul.trim() || !formData.kontakNama.trim()) {
      alert('Mohon isi judul dan nama klien/vendor.');
      return;
    }

    if (formData.id) {
      const existing = debts.find(d => d.id === formData.id);
      if (existing) {
        await updateDebt({
          ...existing,
          tipe: formData.tipe,
          judul: formData.judul.trim(),
          kontakNama: formData.kontakNama.trim(),
          kontakHp: formData.kontakHp.trim() || undefined,
          proyekId: formData.proyekId || undefined,
          nomorInvoice: formData.nomorInvoice.trim() || undefined,
          totalNominal: nominal,
          tanggalTerbit: formData.tanggalTerbit,
          tanggalJatuhTempo: formData.tanggalJatuhTempo,
          keterangan: formData.keterangan.trim() || undefined,
        });
      }
    } else {
      await addDebt({
        tipe: formData.tipe,
        judul: formData.judul.trim(),
        kontakNama: formData.kontakNama.trim(),
        kontakHp: formData.kontakHp.trim() || undefined,
        proyekId: formData.proyekId || undefined,
        nomorInvoice: formData.nomorInvoice.trim() || undefined,
        totalNominal: nominal,
        dibayarNominal: 0,
        tanggalTerbit: formData.tanggalTerbit,
        tanggalJatuhTempo: formData.tanggalJatuhTempo,
        status: 'belum_lunas',
        keterangan: formData.keterangan.trim() || undefined,
        riwayatPembayaran: [],
      });
    }

    setIsFormModalOpen(false);
    loadData();
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Apakah Anda yakin ingin menghapus data tagihan ini?')) {
      await deleteDebt(id);
      loadData();
    }
  };

  // Handle Open Payment Modal
  const handleOpenPayment = (item: DebtItem) => {
    setSelectedDebt(item);
    setPayData({
      nominalFormatted: formatInputRupiah(item.sisaNominal.toString()),
      tanggal: new Date().toISOString().split('T')[0],
      catatan: item.sisaNominal > 0 ? `Pelunasan tagihan ${item.nomorInvoice || ''}` : '',
      rekeningId: item.tipe === 'piutang' ? 'bca_utama' : 'kas_admin',
      autoCreateCash: true,
    });
    setIsPaymentModalOpen(true);
  };

  const handleSavePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDebt) return;
    const nominal = parseFormattedRupiah(payData.nominalFormatted);
    if (nominal <= 0) {
      alert('Mohon masukkan nominal pembayaran yang valid.');
      return;
    }
    if (nominal > selectedDebt.sisaNominal) {
      if (!window.confirm(`Nominal pembayaran (Rp ${nominal.toLocaleString('id-ID')}) melebihi sisa tagihan (Rp ${selectedDebt.sisaNominal.toLocaleString('id-ID')}). Lanjutkan?`)) {
        return;
      }
    }

    await recordDebtPayment(selectedDebt.id, {
      nominal,
      tanggal: payData.tanggal,
      catatan: payData.catatan.trim() || undefined,
      rekeningId: payData.rekeningId,
      autoCreateCashTransaction: payData.autoCreateCash,
    });

    setIsPaymentModalOpen(false);
    setSelectedDebt(null);
    loadData();
  };

  // Handle Open Detail Modal
  const handleOpenDetail = (item: DebtItem) => {
    setSelectedDebt(item);
    setIsDetailModalOpen(true);
  };

  // Export to Excel
  const handleExportExcel = () => {
    const exportData = debts.map((d, idx) => {
      const p = projects.find(proj => proj.id === d.proyekId);
      const computed = getCalculatedStatus(d);
      return {
        No: idx + 1,
        'Jenis Tagihan': d.tipe === 'piutang' ? 'Piutang Klien (AR)' : 'Hutang Vendor (AP)',
        'Judul Tagihan': d.judul,
        'Klien / Vendor': d.kontakNama,
        'No. HP Kontak': d.kontakHp || '-',
        'No. Invoice / PO': d.nomorInvoice || '-',
        'Proyek Terkait': p ? p.nama : '-',
        'Total Nominal': d.totalNominal,
        'Sudah Dibayar': d.dibayarNominal,
        'Sisa Tagihan': d.sisaNominal,
        'Tgl Terbit': d.tanggalTerbit,
        'Tgl Jatuh Tempo': d.tanggalJatuhTempo,
        'Status': computed.toUpperCase(),
        'Keterangan': d.keterangan || '-',
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Hutang_Piutang');
    XLSX.writeFile(workbook, `Rekap_Hutang_Piutang_ARP_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header & Page Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-950 p-6 rounded-3xl text-white shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Receipt size={22} />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-black tracking-tight">Hub Hutang &amp; Piutang (AP &amp; AR)</h1>
              <p className="text-xs text-slate-300">
                Manajemen Invoice Klien, Piutang Usaha &amp; Kewajiban Vendor PT. Aksara Riksa Perdana
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={loadData}
            title="Refresh Data"
            className="p-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl transition text-xs font-semibold flex items-center gap-1.5"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
          <button
            onClick={handleExportExcel}
            className="px-3.5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl transition text-xs font-bold flex items-center gap-2 shadow-lg shadow-emerald-900/30"
          >
            <FileSpreadsheet size={15} />
            <span>Export Excel</span>
          </button>
          <button
            onClick={() => handleOpenCreate(activeTab)}
            className="px-4 py-2.5 bg-white text-slate-900 hover:bg-slate-100 rounded-xl transition text-xs font-black flex items-center gap-2 shadow-lg"
          >
            <Plus size={16} className="text-emerald-600 font-bold" />
            <span>Tambah {activeTab === 'piutang' ? 'Piutang Klien' : 'Hutang Vendor'}</span>
          </button>
        </div>
      </div>

      {/* Top Executive KPI Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Piutang Belum Tertagih */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Piutang Klien (AR)</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <ArrowUpRight size={18} />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-xl font-black text-slate-900">
              {formatRupiah(metrics.sisaPiutangNominal)}
            </div>
            <div className="text-[11px] font-medium text-slate-500 mt-1 flex items-center justify-between">
              <span>Total Invoice: {formatRupiah(metrics.totalPiutangNominal)}</span>
              <span className="text-emerald-600 font-bold">Terbayar: {formatRupiah(metrics.dibayarPiutangNominal)}</span>
            </div>
          </div>
        </div>

        {/* Total Hutang Vendor Belum Dibayar */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Hutang Usaha (AP)</span>
            <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
              <ArrowDownLeft size={18} />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-xl font-black text-rose-600">
              {formatRupiah(metrics.sisaHutangNominal)}
            </div>
            <div className="text-[11px] font-medium text-slate-500 mt-1 flex items-center justify-between">
              <span>Kewajiban: {formatRupiah(metrics.totalHutangNominal)}</span>
              <span className="text-slate-600 font-bold">Lunas: {formatRupiah(metrics.dibayarHutangNominal)}</span>
            </div>
          </div>
        </div>

        {/* Posisi Bersih AR - AP */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Posisi Bersih (Net AR - AP)</span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <DollarSign size={18} />
            </div>
          </div>
          <div className="mt-3">
            <div className={`text-xl font-black ${metrics.netReceivablePayable >= 0 ? 'text-blue-600' : 'text-amber-600'}`}>
              {formatRupiah(metrics.netReceivablePayable)}
            </div>
            <div className="text-[11px] font-medium text-slate-500 mt-1">
              {metrics.netReceivablePayable >= 0 ? 'Surplus Piutang Klien' : 'Defisit Kewajiban Hutang'}
            </div>
          </div>
        </div>

        {/* Alert Overdue / Jatuh Tempo */}
        <div className={`p-5 rounded-2xl border shadow-sm relative overflow-hidden ${metrics.overdueCount > 0 ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-200'}`}>
          <div className="flex items-center justify-between">
            <span className={`text-xs font-bold uppercase tracking-wider ${metrics.overdueCount > 0 ? 'text-amber-800' : 'text-slate-500'}`}>
              Jatuh Tempo (Overdue)
            </span>
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${metrics.overdueCount > 0 ? 'bg-amber-200 text-amber-900' : 'bg-slate-200 text-slate-600'}`}>
              <AlertTriangle size={18} />
            </div>
          </div>
          <div className="mt-3">
            <div className={`text-xl font-black ${metrics.overdueCount > 0 ? 'text-amber-900' : 'text-slate-700'}`}>
              {metrics.overdueCount} Tagihan
            </div>
            <div className="text-[11px] font-semibold text-amber-700 mt-1">
              {metrics.overdueCount > 0 ? `Nominal: ${formatRupiah(metrics.overdueNominal)}` : 'Semua tagihan aman'}
            </div>
          </div>
        </div>
      </div>

      {/* Main Tab Switcher & Search Filter Bar */}
      <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-sm space-y-4">
        {/* Tabs */}
        <div className="flex items-center justify-between flex-wrap gap-3 border-b border-slate-100 pb-4">
          <div className="flex items-center bg-slate-100 p-1 rounded-2xl">
            <button
              onClick={() => setActiveTab('piutang')}
              className={`px-5 py-2.5 rounded-xl text-xs font-black transition flex items-center gap-2 ${activeTab === 'piutang' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
            >
              <TrendingUp size={16} className={activeTab === 'piutang' ? 'text-emerald-600' : ''} />
              <span>💰 Tagihan &amp; Piutang Klien (AR)</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-100 text-emerald-800 font-bold">
                {debts.filter(d => d.tipe === 'piutang' && d.sisaNominal > 0).length}
              </span>
            </button>
            <button
              onClick={() => setActiveTab('hutang')}
              className={`px-5 py-2.5 rounded-xl text-xs font-black transition flex items-center gap-2 ${activeTab === 'hutang' ? 'bg-white text-rose-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
            >
              <TrendingDown size={16} className={activeTab === 'hutang' ? 'text-rose-600' : ''} />
              <span>📉 Kewajiban &amp; Hutang Vendor (AP)</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] bg-rose-100 text-rose-800 font-bold">
                {debts.filter(d => d.tipe === 'hutang' && d.sisaNominal > 0).length}
              </span>
            </button>
          </div>

          {/* Quick Add Button */}
          <button
            onClick={() => handleOpenCreate(activeTab)}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition"
          >
            <Plus size={15} />
            <span>Tambah {activeTab === 'piutang' ? 'Tagihan Baru' : 'Hutang Baru'}</span>
          </button>
        </div>

        {/* Filter Toolbar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
          {/* Search Input */}
          <div className="relative">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Cari Klien, Vendor, No. Invoice..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="semua">🔍 Semua Status Tagihan</option>
              <option value="belum_lunas">⏳ Belum Lunas</option>
              <option value="cicilan">🔄 Dalam Proses Cicilan</option>
              <option value="jatuh_tempo">⚠️ Jatuh Tempo (Overdue)</option>
              <option value="lunas">✅ Sudah Lunas</option>
            </select>
          </div>

          {/* Project Filter */}
          <div>
            <select
              value={selectedProyekId}
              onChange={e => setSelectedProyekId(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="semua">🏢 Semua Proyek Klien</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>
                  {p.nama}
                </option>
              ))}
            </select>
          </div>

          {/* Reset / Count Display */}
          <div className="flex items-center justify-between px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-600">
            <span>Ditemukan: {filteredDebts.length} Data</span>
            {(searchQuery || statusFilter !== 'semua' || selectedProyekId !== 'semua') && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setStatusFilter('semua');
                  setSelectedProyekId('semua');
                }}
                className="text-rose-600 hover:underline text-[11px]"
              >
                Reset Filter
              </button>
            )}
          </div>
        </div>

        {/* Data Table */}
        <div className="overflow-x-auto rounded-2xl border border-slate-200">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-100 text-slate-700 text-[11px] font-black uppercase tracking-wider border-b border-slate-200">
                <th className="py-3.5 px-4">Kontak &amp; Judul Tagihan</th>
                <th className="py-3.5 px-4">No. Invoice / PO</th>
                <th className="py-3.5 px-4 text-right">Total Tagihan</th>
                <th className="py-3.5 px-4 text-right">Sisa Belum Lunas</th>
                <th className="py-3.5 px-4">Jatuh Tempo</th>
                <th className="py-3.5 px-4 text-center">Status</th>
                <th className="py-3.5 px-4 text-center">Aksi Cepat</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredDebts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400 font-medium">
                    Tidak ada data {activeTab === 'piutang' ? 'piutang klien' : 'hutang vendor'} yang sesuai filter.
                  </td>
                </tr>
              ) : (
                filteredDebts.map(d => {
                  const computedStatus = getCalculatedStatus(d);
                  const p = projects.find(proj => proj.id === d.proyekId);

                  return (
                    <tr key={d.id} className="hover:bg-slate-50/80 transition">
                      {/* Title & Contact */}
                      <td className="py-3.5 px-4">
                        <div className="font-extrabold text-slate-900">{d.judul}</div>
                        <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5">
                          <span className="font-semibold text-slate-700">{d.kontakNama}</span>
                          {d.kontakHp && (
                            <span className="flex items-center gap-0.5 text-slate-400">
                              <Phone size={10} /> {d.kontakHp}
                            </span>
                          )}
                          {p && (
                            <span className="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-medium">
                              📁 {p.nama}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Invoice No */}
                      <td className="py-3.5 px-4 font-mono text-[11px] font-bold text-slate-700">
                        {d.nomorInvoice || '-'}
                      </td>

                      {/* Total */}
                      <td className="py-3.5 px-4 text-right font-extrabold text-slate-800">
                        {formatRupiah(d.totalNominal)}
                      </td>

                      {/* Sisa */}
                      <td className="py-3.5 px-4 text-right">
                        <div className={`font-black ${d.sisaNominal > 0 ? (d.tipe === 'piutang' ? 'text-emerald-700' : 'text-rose-700') : 'text-slate-400'}`}>
                          {formatRupiah(d.sisaNominal)}
                        </div>
                        {d.dibayarNominal > 0 && d.sisaNominal > 0 && (
                          <div className="text-[10px] text-slate-400 font-medium">
                            Terbayar: {formatRupiah(d.dibayarNominal)}
                          </div>
                        )}
                      </td>

                      {/* Due Date */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5">
                          <Calendar size={13} className="text-slate-400" />
                          <span className={`font-bold ${computedStatus === 'jatuh_tempo' ? 'text-rose-600 font-black' : 'text-slate-700'}`}>
                            {formatDate(d.tanggalJatuhTempo)}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          Terbit: {formatDate(d.tanggalTerbit)}
                        </div>
                      </td>

                      {/* Status Badge */}
                      <td className="py-3.5 px-4 text-center">
                        {computedStatus === 'lunas' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800">
                            <CheckCircle2 size={12} /> LUNAS
                          </span>
                        )}
                        {computedStatus === 'cicilan' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-blue-100 text-blue-800">
                            <Clock size={12} /> CICILAN
                          </span>
                        )}
                        {computedStatus === 'belum_lunas' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-slate-100 text-slate-800">
                            ⏳ BELUM BAYAR
                          </span>
                        )}
                        {computedStatus === 'jatuh_tempo' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-rose-100 text-rose-800 animate-pulse">
                            <AlertTriangle size={12} /> JATUH TEMPO
                          </span>
                        )}
                      </td>

                      {/* Action Buttons */}
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {d.sisaNominal > 0 && (
                            <button
                              onClick={() => handleOpenPayment(d)}
                              title="Catat Pembayaran / Cicilan"
                              className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg font-bold text-[11px] flex items-center gap-1 transition"
                            >
                              <CreditCard size={13} />
                              <span>Bayar</span>
                            </button>
                          )}
                          <button
                            onClick={() => handleOpenDetail(d)}
                            title="Lihat Riwayat &amp; Detail"
                            className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition"
                          >
                            <Info size={14} />
                          </button>
                          <button
                            onClick={() => handleOpenEdit(d)}
                            title="Edit Data"
                            className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            onClick={() => handleDelete(d.id)}
                            title="Hapus Data"
                            className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg transition"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal 1: Tambah / Edit Tagihan */}
      <Modal
        isOpen={isFormModalOpen}
        onClose={() => setIsFormModalOpen(false)}
        title={formData.id ? 'Edit Tagihan / Hutang' : `Tambah ${formData.tipe === 'piutang' ? 'Piutang Klien' : 'Hutang Vendor'} Baru`}
        size="lg"
      >
        <form onSubmit={handleSaveForm} className="space-y-4">
          <div className="flex items-center gap-2 p-1 bg-slate-100 rounded-xl">
            <button
              type="button"
              onClick={() => setFormData({ ...formData, tipe: 'piutang' })}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition ${formData.tipe === 'piutang' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-600'}`}
            >
              💰 Piutang Klien (AR)
            </button>
            <button
              type="button"
              onClick={() => setFormData({ ...formData, tipe: 'hutang' })}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition ${formData.tipe === 'hutang' ? 'bg-white text-rose-700 shadow-sm' : 'text-slate-600'}`}
            >
              📉 Hutang Vendor (AP)
            </button>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Judul Tagihan / Transaksi <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="Contoh: Tagihan Invoice #082 - Riksa Uji PT HM Sampoerna"
              value={formData.judul}
              onChange={e => setFormData({ ...formData, judul: e.target.value })}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Nama Klien / Vendor / Pihak Terkait <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="Nama Perusahaan / Kontak"
                value={formData.kontakNama}
                onChange={e => setFormData({ ...formData, kontakNama: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Nomor HP / WhatsApp (Opsional)</label>
              <input
                type="text"
                placeholder="0812-xxxx-xxxx"
                value={formData.kontakHp}
                onChange={e => setFormData({ ...formData, kontakHp: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Nomor Invoice / Kontrak / PO</label>
              <input
                type="text"
                placeholder="Contoh: INV/ARP/2026/082"
                value={formData.nomorInvoice}
                onChange={e => setFormData({ ...formData, nomorInvoice: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Hubungkan ke Proyek (Opsional)</label>
              <select
                value={formData.proyekId}
                onChange={e => setFormData({ ...formData, proyekId: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              >
                <option value="">-- Non Proyek / Umum --</option>
                {projects.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.nama}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Total Nominal Tagihan (Rp) <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="0"
              value={formData.totalNominalFormatted}
              onChange={e => setFormData({ ...formData, totalNominalFormatted: formatInputRupiah(e.target.value) })}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-black text-emerald-700 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Tanggal Terbit / Faktur</label>
              <input
                type="date"
                required
                value={formData.tanggalTerbit}
                onChange={e => setFormData({ ...formData, tanggalTerbit: e.target.value })}
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Tanggal Jatuh Tempo</label>
              <input
                type="date"
                required
                value={formData.tanggalJatuhTempo}
                onChange={e => setFormData({ ...formData, tanggalJatuhTempo: e.target.value })}
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Catatan / Keterangan Tambahan</label>
            <textarea
              rows={2}
              placeholder="Tambahkan catatan khusus bila ada..."
              value={formData.keterangan}
              onChange={e => setFormData({ ...formData, keterangan: e.target.value })}
              className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setIsFormModalOpen(false)}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition"
            >
              Batal
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-md transition"
            >
              Simpan Data
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal 2: Catat Pembayaran / Pelunasan */}
      <Modal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        title={selectedDebt?.tipe === 'piutang' ? 'Catat Pembayaran Masuk (Pelunasan Piutang)' : 'Catat Pembayaran Keluar (Bayar Hutang)'}
      >
        {selectedDebt && (
          <form onSubmit={handleSavePayment} className="space-y-4">
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl">
              <div className="text-xs font-bold text-slate-500 uppercase">Tagihan Terkait</div>
              <div className="text-sm font-extrabold text-slate-900 mt-0.5">{selectedDebt.judul}</div>
              <div className="flex items-center justify-between text-xs mt-2 pt-2 border-t border-slate-200">
                <span className="text-slate-600">Sisa Tagihan:</span>
                <span className="font-black text-rose-600">{formatRupiah(selectedDebt.sisaNominal)}</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Nominal Pembayaran (Rp) <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={payData.nominalFormatted}
                onChange={e => setPayData({ ...payData, nominalFormatted: formatInputRupiah(e.target.value) })}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-black text-emerald-700 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Tanggal Pembayaran</label>
                <input
                  type="date"
                  required
                  value={payData.tanggal}
                  onChange={e => setPayData({ ...payData, tanggal: e.target.value })}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Rekening Kas / Saku</label>
                <select
                  value={payData.rekeningId}
                  onChange={e => setPayData({ ...payData, rekeningId: e.target.value })}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                >
                  <option value="bca_utama">🏦 BCA Utama</option>
                  <option value="kas_admin">💵 Kas Kecil Admin</option>
                  <option value="bri_operasional">💳 BRI Operasional</option>
                  <option value="mandiri_operasional">💳 Mandiri</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Catatan Pembayaran (Opsional)</label>
              <input
                type="text"
                placeholder="Contoh: DP 50% atau Pelunasan Tahap 2"
                value={payData.catatan}
                onChange={e => setPayData({ ...payData, catatan: e.target.value })}
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>

            {/* Auto Create Cash Transaction Checkbox */}
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-start gap-2.5">
              <input
                type="checkbox"
                id="autoCreateCash"
                checked={payData.autoCreateCash}
                onChange={e => setPayData({ ...payData, autoCreateCash: e.target.checked })}
                className="mt-0.5 rounded text-emerald-600 focus:ring-emerald-500"
              />
              <label htmlFor="autoCreateCash" className="text-xs text-emerald-900 font-semibold cursor-pointer">
                <strong>Otomatis catat transaksi di Jurnal Kas</strong>
                <p className="text-[11px] text-emerald-700 font-normal mt-0.5">
                  {selectedDebt.tipe === 'piutang'
                    ? 'Sistem akan otomatis mencatat uang masuk (Omzet Klien) ke rekening terpilih.'
                    : 'Sistem akan otomatis mencatat pengeluaran kas di rekening terpilih.'}
                </p>
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setIsPaymentModalOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition"
              >
                Batal
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-md transition"
              >
                Simpan Pembayaran
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* Modal 3: Detail & Riwayat Pembayaran */}
      <Modal
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        title="Detail &amp; Riwayat Cicilan Tagihan"
        size="lg"
      >
        {selectedDebt && (
          <div className="space-y-4">
            <div className="p-4 bg-slate-900 text-white rounded-2xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider">
                  {selectedDebt.tipe === 'piutang' ? 'Piutang Klien (AR)' : 'Hutang Usaha (AP)'}
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-white/20 text-white">
                  {getCalculatedStatus(selectedDebt).toUpperCase()}
                </span>
              </div>
              <h2 className="text-base font-extrabold">{selectedDebt.judul}</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2 border-t border-slate-800 text-xs">
                <div>
                  <div className="text-slate-400 text-[10px]">Kontak / Pihak:</div>
                  <div className="font-bold">{selectedDebt.kontakNama}</div>
                </div>
                <div>
                  <div className="text-slate-400 text-[10px]">No. Invoice:</div>
                  <div className="font-mono font-bold">{selectedDebt.nomorInvoice || '-'}</div>
                </div>
                <div>
                  <div className="text-slate-400 text-[10px]">Jatuh Tempo:</div>
                  <div className="font-bold">{formatDate(selectedDebt.tanggalJatuhTempo)}</div>
                </div>
              </div>
            </div>

            {/* Financial Progress Bar */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="text-slate-600">Total: {formatRupiah(selectedDebt.totalNominal)}</span>
                <span className="text-emerald-700">Terbayar: {formatRupiah(selectedDebt.dibayarNominal)}</span>
                <span className="text-rose-700">Sisa: {formatRupiah(selectedDebt.sisaNominal)}</span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden">
                <div
                  className="bg-emerald-500 h-2.5 rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.min(100, Math.round((selectedDebt.dibayarNominal / selectedDebt.totalNominal) * 100)) || 0}%`,
                  }}
                />
              </div>
            </div>

            {/* Payment History Timeline */}
            <div>
              <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider mb-2">
                Riwayat Pembayaran &amp; Cicilan ({selectedDebt.riwayatPembayaran?.length || 0})
              </h3>
              {!selectedDebt.riwayatPembayaran || selectedDebt.riwayatPembayaran.length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                  Belum ada catatan pembayaran atau cicilan untuk tagihan ini.
                </div>
              ) : (
                <div className="space-y-2">
                  {selectedDebt.riwayatPembayaran.map((pay, pIdx) => (
                    <div
                      key={pay.id || pIdx}
                      className="p-3 bg-white border border-slate-200 rounded-xl flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="space-y-0.5">
                        <div className="font-extrabold text-slate-900">{formatRupiah(pay.nominal)}</div>
                        <div className="text-[11px] text-slate-500">
                          {formatDate(pay.tanggal)} {pay.catatan && `· ${pay.catatan}`}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded text-[10px] font-bold">
                          ✅ Tercatat
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setIsDetailModalOpen(false)}
                className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition"
              >
                Tutup
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
