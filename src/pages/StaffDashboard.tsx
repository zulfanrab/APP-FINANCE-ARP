import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Wallet,
  PlusCircle,
  FolderKanban,
  Receipt,
  ArrowLeftRight,
  TrendingDown,
  TrendingUp,
  Clock,
  CheckCircle2,
  AlertCircle,
  FileText,
  Lock,
  Building2,
  Calendar,
  Sparkles,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { formatRupiah, formatDate } from '../components/ui';
import { calculateCompanyLedger, isApproved } from '../services/financialEngine';

export function StaffDashboard() {
  const navigate = useNavigate();
  const { transactions, projects, loading } = useApp();

  const ledger = useMemo(() => {
    return calculateCompanyLedger(transactions, projects);
  }, [transactions, projects]);

  const kasAdminSaldo = ledger.accountBalances.kas_admin || 0;

  // Filter approved transactions for operational kas admin / projects
  const recentOperationalTxs = useMemo(() => {
    return transactions
      .filter(t => t.rekeningId === 'kas_admin' || Boolean(t.proyekId))
      .slice(0, 8);
  }, [transactions]);

  // Operational metrics for Staff
  const operationalMetrics = useMemo(() => {
    const today = new Date();
    const currentMonth = today.toISOString().slice(0, 7);

    const monthlyExpenses = transactions
      .filter(t => isApproved(t) && t.jenis === 'keluar' && t.tanggal.startsWith(currentMonth))
      .reduce((sum, t) => sum + t.nominal, 0);

    const activeProjectsCount = projects.filter(p => p.status === 'aktif').length;

    const pendingApprovalCount = transactions.filter(t => t.status === 'menunggu_approval').length;

    return {
      monthlyExpenses,
      activeProjectsCount,
      pendingApprovalCount,
    };
  }, [transactions, projects]);

  return (
    <div className="space-y-6 pb-12">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-teal-950 to-slate-900 p-6 rounded-3xl text-white shadow-xl relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs">
              <Sparkles size={15} />
              <span>Workspace Operasional Keuangan</span>
            </div>
            <h1 className="text-xl md:text-2xl font-black tracking-tight">
              Halo, Asisten Keuangan PT ARP 🤝
            </h1>
            <p className="text-xs text-slate-300 max-w-xl">
              Pusat pencatatan transaksi harian, pengelolaan nota &amp; struk belanja, serta monitoring pengajuan dan piutang proyek.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/transaksi/baru')}
              className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-xl text-xs flex items-center gap-2 shadow-lg transition"
            >
              <PlusCircle size={16} />
              <span>Input Transaksi Baru</span>
            </button>
          </div>
        </div>
      </div>

      {/* Wallet / Kas Card Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Saku Kas Admin Aktif (Yang boleh diakses penuh) */}
        <div className="bg-white p-5 rounded-2xl border-2 border-emerald-500/40 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider">
              💵 Kas Kecil Admin (Petty Cash)
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Wallet size={18} />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-slate-900">
              {formatRupiah(kasAdminSaldo)}
            </div>
            <div className="text-[11px] font-semibold text-emerald-600 mt-1">
              Kas Operasional Harian Terkelola
            </div>
          </div>
        </div>

        {/* Master Rekening Bank (Protected / Hidden) */}
        <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              🏦 Rekening Induk BCA &amp; BRI Pusat
            </span>
            <div className="w-8 h-8 rounded-xl bg-slate-200 text-slate-600 flex items-center justify-center">
              <Lock size={16} />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-lg font-mono font-black text-slate-400">
              ••••••••••••••••
            </div>
            <div className="text-[11px] font-semibold text-slate-500 mt-1 flex items-center gap-1">
              <Lock size={12} className="text-slate-400" />
              <span>Terlindungi (Akses Master Head of Finance)</span>
            </div>
          </div>
        </div>

        {/* Proyek Aktif & Surat Pengajuan */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              📁 Proyek Lapangan Aktif
            </span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <FolderKanban size={18} />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-slate-900">
              {operationalMetrics.activeProjectsCount} Proyek
            </div>
            <div className="text-[11px] font-semibold text-blue-600 mt-1">
              Siap untuk Pengajuan &amp; LPJ
            </div>
          </div>
        </div>
      </div>

      {/* Quick Access Tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <button
          onClick={() => navigate('/transaksi/baru')}
          className="p-4 bg-white hover:bg-slate-50 border border-slate-200 rounded-2xl text-left transition flex flex-col justify-between group shadow-sm"
        >
          <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-2 group-hover:scale-110 transition">
            <PlusCircle size={20} />
          </div>
          <div>
            <div className="text-xs font-black text-slate-900">Input Pengeluaran</div>
            <div className="text-[10px] text-slate-500 mt-0.5">Upload struk &amp; bensin</div>
          </div>
        </button>

        <button
          onClick={() => navigate('/hutang-piutang')}
          className="p-4 bg-white hover:bg-slate-50 border border-slate-200 rounded-2xl text-left transition flex flex-col justify-between group shadow-sm"
        >
          <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-2 group-hover:scale-110 transition">
            <Receipt size={20} />
          </div>
          <div>
            <div className="text-xs font-black text-slate-900">Hutang &amp; Piutang</div>
            <div className="text-[10px] text-slate-500 mt-0.5">Tagihan klien &amp; vendor</div>
          </div>
        </button>

        <button
          onClick={() => navigate('/proyek')}
          className="p-4 bg-white hover:bg-slate-50 border border-slate-200 rounded-2xl text-left transition flex flex-col justify-between group shadow-sm"
        >
          <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center mb-2 group-hover:scale-110 transition">
            <FolderKanban size={20} />
          </div>
          <div>
            <div className="text-xs font-black text-slate-900">Surat Pengajuan LPJ</div>
            <div className="text-[10px] text-slate-500 mt-0.5">Kelola anggaran tim</div>
          </div>
        </button>

        <button
          onClick={() => navigate('/transaksi')}
          className="p-4 bg-white hover:bg-slate-50 border border-slate-200 rounded-2xl text-left transition flex flex-col justify-between group shadow-sm"
        >
          <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center mb-2 group-hover:scale-110 transition">
            <ArrowLeftRight size={20} />
          </div>
          <div>
            <div className="text-xs font-black text-slate-900">Riwayat Mutasi</div>
            <div className="text-[10px] text-slate-500 mt-0.5">Cek seluruh belanja</div>
          </div>
        </button>
      </div>

      {/* Recent Operational Feed */}
      <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Clock size={16} className="text-emerald-600" />
            <h2 className="text-sm font-black text-slate-900">Aktivitas Belanja Operasional Terbaru</h2>
          </div>
          <button
            onClick={() => navigate('/transaksi')}
            className="text-xs font-bold text-emerald-600 hover:underline"
          >
            Lihat Semua →
          </button>
        </div>

        <div className="divide-y divide-slate-100">
          {recentOperationalTxs.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400">
              Belum ada transaksi operasional.
            </div>
          ) : (
            recentOperationalTxs.map(t => {
              const p = projects.find(proj => proj.id === t.proyekId);
              return (
                <div key={t.id} className="py-3 flex items-center justify-between gap-3 hover:bg-slate-50 rounded-xl px-2 transition">
                  <div className="space-y-0.5 min-w-0">
                    <div className="text-xs font-bold text-slate-900 truncate">
                      {t.deskripsi}
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-slate-500">
                      <span>{formatDate(t.tanggal)}</span>
                      <span>·</span>
                      <span className="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded font-medium">
                        {t.kategori}
                      </span>
                      {p && (
                        <span className="px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded font-semibold">
                          📁 {p.nama}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="text-right flex-shrink-0">
                    <div className={`text-xs font-black ${t.jenis === 'masuk' ? 'text-emerald-600' : 'text-slate-800'}`}>
                      {t.jenis === 'masuk' ? '+' : '-'}{formatRupiah(t.nominal)}
                    </div>
                    <div className="text-[10px]">
                      {t.status === 'disetujui' && (
                        <span className="text-emerald-600 font-bold">✅ Disetujui</span>
                      )}
                      {t.status === 'menunggu_approval' && (
                        <span className="text-amber-600 font-bold">⏳ Menunggu</span>
                      )}
                      {t.status === 'ditolak' && (
                        <span className="text-rose-600 font-bold">❌ Ditolak</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
