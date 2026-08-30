// ============================================================
// ARKA Finance — Activity Log & Audit Trail Modal
// Comprehensive audit view for Head of Finance & Direksi
// ============================================================

import React, { useState, useEffect, useMemo } from 'react';
import {
  History,
  Search,
  Filter,
  UserCheck,
  ShieldCheck,
  Clock,
  RefreshCw,
  PlusCircle,
  Edit3,
  Trash2,
  CheckCircle2,
  XCircle,
  Receipt,
  KeyRound,
  FileSpreadsheet,
} from 'lucide-react';
import { Modal } from './Modal';
import { type ActivityLog, type ActivityAction } from '../../types';
import { getActivityLogs } from '../../services/activityLogService';
import { formatRupiah, formatDate } from './index';

interface ActivityLogModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ActivityLogModal({ isOpen, onClose }: ActivityLogModalProps) {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'semua' | 'staff' | 'admin_owner'>('semua');

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const data = await getActivityLogs();
      setLogs(data);
    } catch (err) {
      console.warn('Gagal memuat log aktivitas:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchLogs();
    }
  }, [isOpen]);

  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      // Role Filter
      if (roleFilter === 'staff' && log.pelakuRole !== 'staff') return false;
      if (roleFilter === 'admin_owner' && log.pelakuRole === 'staff') return false;

      // Search Filter
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchDesc = log.deskripsi.toLowerCase().includes(q);
        const matchLabel = log.pelakuLabel.toLowerCase().includes(q);
        const matchAction = log.aksi.toLowerCase().includes(q);
        return matchDesc || matchLabel || matchAction;
      }
      return true;
    });
  }, [logs, roleFilter, search]);

  const formatLogTime = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleString('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoString;
    }
  };

  const getActionBadge = (action: ActivityAction) => {
    switch (action) {
      case 'tambah_transaksi':
        return (
          <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full font-bold text-[10px] flex items-center gap-1">
            <PlusCircle size={11} /> Input Transaksi
          </span>
        );
      case 'edit_transaksi':
        return (
          <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded-full font-bold text-[10px] flex items-center gap-1">
            <Edit3 size={11} /> Edit Transaksi
          </span>
        );
      case 'hapus_transaksi':
        return (
          <span className="px-2 py-0.5 bg-rose-100 text-rose-800 rounded-full font-bold text-[10px] flex items-center gap-1">
            <Trash2 size={11} /> Hapus Data
          </span>
        );
      case 'approval_transaksi':
        return (
          <span className="px-2 py-0.5 bg-teal-100 text-teal-800 rounded-full font-bold text-[10px] flex items-center gap-1">
            <CheckCircle2 size={11} /> Approval
          </span>
        );
      case 'tolak_transaksi':
        return (
          <span className="px-2 py-0.5 bg-red-100 text-red-800 rounded-full font-bold text-[10px] flex items-center gap-1">
            <XCircle size={11} /> Ditolak
          </span>
        );
      case 'tambah_piutang':
      case 'tambah_hutang':
        return (
          <span className="px-2 py-0.5 bg-indigo-100 text-indigo-800 rounded-full font-bold text-[10px] flex items-center gap-1">
            <Receipt size={11} /> Hutang/Piutang
          </span>
        );
      case 'bayar_piutang':
      case 'bayar_hutang':
        return (
          <span className="px-2 py-0.5 bg-purple-100 text-purple-800 rounded-full font-bold text-[10px] flex items-center gap-1">
            <Receipt size={11} /> Cicilan/Lunas
          </span>
        );
      case 'ubah_pin_asisten':
        return (
          <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded-full font-bold text-[10px] flex items-center gap-1">
            <KeyRound size={11} /> Ganti PIN Staf
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded-full font-bold text-[10px]">
            {action}
          </span>
        );
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="📋 Log Aktivitas & Audit Trail Tim"
      size="xl"
    >
      <div className="space-y-4">
        {/* Banner */}
        <div className="p-3.5 bg-slate-900 text-white rounded-2xl flex items-center justify-between shadow-sm">
          <div className="space-y-0.5">
            <div className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
              <ShieldCheck size={15} />
              <span>Sistem Pengawasan Keuangan Real-Time</span>
            </div>
            <p className="text-[11px] text-slate-300">
              Setiap aksi input belanja, perubahan nota, dan cicilan tagihan tercatat otomatis secara transparan.
            </p>
          </div>

          <button
            onClick={fetchLogs}
            disabled={loading}
            className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition flex items-center gap-1"
            title="Refresh Log"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>

        {/* Filters & Search */}
        <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center justify-between">
          <div className="flex bg-slate-100 p-1 rounded-xl gap-1 text-xs font-bold">
            <button
              onClick={() => setRoleFilter('semua')}
              className={`px-3 py-1.5 rounded-lg transition ${
                roleFilter === 'semua'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Semua ({logs.length})
            </button>
            <button
              onClick={() => setRoleFilter('staff')}
              className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1 ${
                roleFilter === 'staff'
                  ? 'bg-teal-700 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              🤝 Khusus Asisten Keuangan ({logs.filter(l => l.pelakuRole === 'staff').length})
            </button>
            <button
              onClick={() => setRoleFilter('admin_owner')}
              className={`px-3 py-1.5 rounded-lg transition ${
                roleFilter === 'admin_owner'
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              💼 Atasan / Direksi
            </button>
          </div>

          <div className="relative flex-1 sm:max-w-xs">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Cari aktivitas atau nama..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>
        </div>

        {/* Log List */}
        <div className="max-h-[55vh] overflow-y-auto space-y-2 pr-1 divide-y divide-slate-100">
          {loading ? (
            <div className="py-12 text-center text-xs text-slate-400">
              Memuat log aktivitas...
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="py-12 text-center space-y-1">
              <History size={28} className="mx-auto text-slate-300" />
              <div className="text-xs font-bold text-slate-600">Belum ada catatan aktivitas.</div>
              <p className="text-[11px] text-slate-400">
                Aktivitas baru yang diinput oleh Asisten atau Admin akan langsung muncul di sini.
              </p>
            </div>
          ) : (
            filteredLogs.map(log => (
              <div key={log.id} className="pt-2.5 pb-2 px-2 hover:bg-slate-50 rounded-xl transition space-y-1.5">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    {getActionBadge(log.aksi)}
                    <span
                      className={`text-[11px] font-bold px-2 py-0.5 rounded-md ${
                        log.pelakuRole === 'staff'
                          ? 'bg-teal-50 text-teal-700 border border-teal-200'
                          : log.pelakuRole === 'owner'
                          ? 'bg-amber-50 text-amber-800 border border-amber-200'
                          : 'bg-slate-100 text-slate-800 border border-slate-200'
                      }`}
                    >
                      {log.pelakuLabel}
                    </span>
                  </div>

                  <div className="flex items-center gap-1 text-[10px] text-slate-400 font-medium">
                    <Clock size={11} />
                    <span>{formatLogTime(log.waktu)}</span>
                  </div>
                </div>

                <div className="flex items-start justify-between gap-3 pl-1">
                  <p className="text-xs text-slate-800 font-medium leading-relaxed">
                    {log.deskripsi}
                  </p>

                  {log.nominal !== undefined && log.nominal > 0 && (
                    <span className="text-xs font-black text-slate-900 whitespace-nowrap tabular-nums">
                      {formatRupiah(log.nominal)}
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </Modal>
  );
}
