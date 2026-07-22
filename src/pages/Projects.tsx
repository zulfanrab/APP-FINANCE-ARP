// ============================================================
// ARKA Finance — Projects Page
// CRUD: tambah, edit, selesaikan proyek + kalkulasi profit & modal
// ============================================================

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, FolderOpen, Edit2, CheckCircle, Trash2,
  TrendingUp, TrendingDown, DollarSign, Calendar, Users, Wallet, ChevronRight
} from 'lucide-react';
import { getProjects, addProject, updateProject, completeProject, deleteProject } from '../services/projectService';
import { getTransactionsByProject } from '../services/transactionService';
import { getProjectFinancialSummary } from '../services/analyticsService';
import { type Project } from '../types';
import { Card, Button, Badge, LoadingSpinner, EmptyState, formatRupiah, formatDate, ProjectsSkeleton } from '../components/ui';
import { Modal } from '../components/ui/Modal';
import { useApp } from '../context/AppContext';

interface ProjectWithStats extends Project {
  totalPemasukan: number;
  totalPengeluaran: number;
  profit: number;
  sisaKas?: number;
}

function formatRupiahInput(value: string): string {
  const num = value.replace(/\D/g, '');
  if (!num) return '';
  return new Intl.NumberFormat('id-ID').format(Number(num));
}

function parseRupiahInput(value: string): number {
  return Number(value.replace(/\./g, '').replace(',', ''));
}

export function Projects() {
  const navigate = useNavigate();
  const { addToast, triggerRefresh, refreshKey } = useApp();
  const [projects, setProjects] = useState<ProjectWithStats[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Project | null>(null);  const [tabFilter, setTabFilter] = useState<'semua' | 'proyek_klien' | 'operasional_kantor'>('semua');

  // Form
  const [form, setForm] = useState({
    nama: '',
    klien: '',
    tipe: 'proyek_klien' as 'proyek_klien' | 'operasional_kantor',
    anggaranStr: '',
    tanggalMulai: '',
    deskripsi: '',
  });
  const [saving, setSaving] = useState(false);

  const loadProjects = useCallback(async () => {
    setLoading(true);
    try {
      const raw = await getProjects();
      const withStats = await Promise.all(
        raw.map(async p => {
          const txns = await getTransactionsByProject(p.id);
          const financials = getProjectFinancialSummary(txns, p.anggaran || 0);
          return { 
            ...p, 
            anggaran: financials.modalDisuntikkan,
            totalPemasukan: financials.pemasukanKlien, 
            totalPengeluaran: financials.totalPengeluaran, 
            profit: financials.labaRugiProyek,
            sisaKas: financials.sisaDanaProyek
          };
        })
      );
      setProjects(withStats);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadProjects(); }, [loadProjects, refreshKey]);

  const openAdd = (defaultTipe: 'proyek_klien' | 'operasional_kantor' = 'proyek_klien') => {
    setEditingProject(null);
    setForm({
      nama: '',
      klien: defaultTipe === 'operasional_kantor' ? 'Internal Kantor' : '',
      tipe: defaultTipe,
      anggaranStr: '',
      tanggalMulai: new Date().toISOString().split('T')[0],
      deskripsi: '',
    });
    setModalOpen(true);
  };

  const openEdit = (e: React.MouseEvent, p: Project) => {
    e.stopPropagation();
    setEditingProject(p);
    setForm({
      nama: p.nama,
      klien: p.klien,
      tipe: p.tipe ?? 'proyek_klien',
      anggaranStr: p.anggaran ? new Intl.NumberFormat('id-ID').format(p.anggaran) : '',
      tanggalMulai: p.tanggalMulai,
      deskripsi: p.deskripsi ?? '',
    });
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nama.trim()) { addToast('error', 'Nama alokasi/proyek wajib diisi'); return; }

    const klienFinal = form.klien.trim() || (form.tipe === 'operasional_kantor' ? 'Internal Kantor' : 'Klien');
    const anggaran = parseRupiahInput(form.anggaranStr);
    setSaving(true);
    try {
      if (editingProject) {
        await updateProject(editingProject.id, {
          nama: form.nama.trim(),
          klien: klienFinal,
          tipe: form.tipe,
          anggaran: anggaran || 0,
          tanggalMulai: form.tanggalMulai,
          deskripsi: form.deskripsi.trim(),
        });
        addToast('success', 'Alokasi berhasil diperbarui');
      } else {
        await addProject({
          nama: form.nama.trim(),
          klien: klienFinal,
          tipe: form.tipe,
          anggaran: anggaran || 0,
          tanggalMulai: form.tanggalMulai,
          deskripsi: form.deskripsi.trim(),
        });
        addToast('success', 'Alokasi baru berhasil ditambahkan');
      }
      setModalOpen(false);
      triggerRefresh();
      loadProjects();
    } finally {
      setSaving(false);
    }
  };

  const handleComplete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    await completeProject(id);
    addToast('success', 'Ditandai selesai');
    loadProjects();
    triggerRefresh();
  };

  const handleDelete = async (p: Project) => {
    await deleteProject(p.id);
    addToast('success', `Alokasi "${p.nama}" dihapus`);
    setDeleteConfirm(null);
    loadProjects();
    triggerRefresh();
  };

  if (loading) return <ProjectsSkeleton />;

  const filteredProjects = projects.filter(p => {
    if (tabFilter === 'proyek_klien') return (p.tipe ?? 'proyek_klien') === 'proyek_klien';
    if (tabFilter === 'operasional_kantor') return p.tipe === 'operasional_kantor';
    return true;
  });

  const activeProjects = filteredProjects.filter(p => p.status === 'aktif');
  const completedProjects = filteredProjects.filter(p => p.status === 'selesai');

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Proyek &amp; Pos Operasional</h1>
          <p className="text-gray-500 text-xs mt-0.5">Kelola alokasi modal proyek klien dan anggaran rutin operasional kantor</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" icon={<Plus size={15} />} onClick={() => openAdd('operasional_kantor')}>
            + Pos Kantor
          </Button>
          <Button variant="primary" icon={<Plus size={15} />} onClick={() => openAdd('proyek_klien')}>
            + Proyek Klien
          </Button>
        </div>
      </div>

      {/* Category Type Filter Tabs */}
      <div className="flex items-center gap-2 p-1.5 bg-gray-100/80 rounded-2xl w-fit border border-gray-200/60">
        <button
          onClick={() => setTabFilter('semua')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            tabFilter === 'semua'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          🌐 Semua Alokasi ({projects.length})
        </button>
        <button
          onClick={() => setTabFilter('proyek_klien')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            tabFilter === 'proyek_klien'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          🏢 Proyek Klien ({projects.filter(p => (p.tipe ?? 'proyek_klien') === 'proyek_klien').length})
        </button>
        <button
          onClick={() => setTabFilter('operasional_kantor')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            tabFilter === 'operasional_kantor'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          💼 Operasional Kantor ({projects.filter(p => p.tipe === 'operasional_kantor').length})
        </button>
      </div>

      {/* Active Projects / Pos */}
      <div>
        <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
          Alokasi Aktif ({activeProjects.length})
        </h2>
        {activeProjects.length === 0 ? (
          <Card>
            <EmptyState
              icon={<FolderOpen size={28} />}
              title="Belum ada alokasi aktif"
              description="Tambahkan proyek klien atau pos operasional kantor baru"
              action={
                <div className="flex gap-2">
                  <Button icon={<Plus size={16} />} onClick={() => openAdd('proyek_klien')}>Tambah Proyek</Button>
                </div>
              }
            />
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
            {activeProjects.map(p => (
              <ProjectCard
                key={p.id}
                project={p}
                onSelect={() => navigate(`/proyek/${p.id}`)}
                onEdit={(e) => openEdit(e, p)}
                onComplete={(e) => handleComplete(e, p.id)}
                onDelete={(e) => { e.stopPropagation(); setDeleteConfirm(p); }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Completed Projects */}
      {completedProjects.length > 0 && (
        <div>
          <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
            Alokasi Selesai ({completedProjects.length})
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
            {completedProjects.map(p => (
              <ProjectCard
                key={p.id}
                project={p}
                onSelect={() => navigate(`/proyek/${p.id}`)}
                onEdit={(e) => openEdit(e, p)}
                onComplete={(e) => handleComplete(e, p.id)}
                onDelete={(e) => { e.stopPropagation(); setDeleteConfirm(p); }}
                completed
              />
            ))}
          </div>
        </div>
      )}

      {/* Add/Edit Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingProject ? 'Edit Alokasi / Pos' : 'Tambah Alokasi Baru'}
      >
        <form onSubmit={handleSave} className="space-y-4">
          {/* Tipe Selector */}
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-2">Tipe Alokasi *</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setForm(f => ({ ...f, tipe: 'proyek_klien' }))}
                className={`p-3 rounded-xl border text-left font-bold text-xs transition-all ${
                  form.tipe === 'proyek_klien'
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-900 ring-2 ring-emerald-500/20'
                    : 'border-gray-200 text-gray-600 hover:border-gray-300'
                }`}
              >
                🏢 Proyek Klien
                <p className="text-[10px] font-normal text-gray-500 mt-0.5">Pekerjaan beromzet &amp; untung-rugi</p>
              </button>

              <button
                type="button"
                onClick={() => setForm(f => ({ ...f, tipe: 'operasional_kantor', klien: 'Internal Kantor' }))}
                className={`p-3 rounded-xl border text-left font-bold text-xs transition-all ${
                  form.tipe === 'operasional_kantor'
                    ? 'border-blue-500 bg-blue-50 text-blue-900 ring-2 ring-blue-500/20'
                    : 'border-gray-200 text-gray-600 hover:border-gray-300'
                }`}
              >
                💼 Operasional Kantor
                <p className="text-[10px] font-normal text-gray-500 mt-0.5">Anggaran &amp; pengeluaran rutin kantor</p>
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {form.tipe === 'operasional_kantor' ? 'Nama Pos Operasional *' : 'Nama Proyek *'}
            </label>
            <input
              type="text"
              value={form.nama}
              onChange={e => setForm(f => ({ ...f, nama: e.target.value }))}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder={form.tipe === 'operasional_kantor' ? 'Contoh: Operasional Kantor Juli 2026' : 'Contoh: Pekerjaan Angkur PT Santika'}
              required autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {form.tipe === 'operasional_kantor' ? 'Unit / Penanggung Jawab *' : 'Nama Klien *'}
            </label>
            <input
              type="text"
              value={form.klien}
              onChange={e => setForm(f => ({ ...f, klien: e.target.value }))}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder={form.tipe === 'operasional_kantor' ? 'Contoh: Internal Kantor / Admin' : 'Contoh: PT Santika / Bapak Budi'}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {form.tipe === 'operasional_kantor' ? 'Plafon / Drop Dana Kantor dari Pak Fatwa (Rp)' : 'Modal awal dari Pak Fatwa (Rp)'}
            </label>
            <input
              type="text"
              inputMode="numeric"
              value={form.anggaranStr}
              onChange={e => setForm(f => ({ ...f, anggaranStr: formatRupiahInput(e.target.value) }))}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary font-semibold text-emerald-700"
              placeholder="0"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tanggal Mulai / Periode</label>
            <input
              type="date"
              value={form.tanggalMulai}
              onChange={e => setForm(f => ({ ...f, tanggalMulai: e.target.value }))}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Deskripsi (Opsional)</label>
            <textarea
              value={form.deskripsi}
              onChange={e => setForm(f => ({ ...f, deskripsi: e.target.value }))}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
              rows={3}
              placeholder="Rincian pos operasional..."
            />
          </div>

          <div className="flex gap-3 justify-end pt-2">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>Batal</Button>
            <Button type="submit" loading={saving}>{editingProject ? 'Simpan Perubahan' : 'Tambah Alokasi'}</Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirm Modal */}
      <Modal isOpen={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} title="Hapus Proyek" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Apakah Anda yakin ingin menghapus alokasi <strong>"{deleteConfirm?.nama}"</strong>?
            Transaksi yang terkait tidak akan ikut terhapus.
          </p>
          <div className="flex gap-3 justify-end">
            <Button variant="secondary" onClick={() => setDeleteConfirm(null)}>Batal</Button>
            <Button variant="danger" icon={<Trash2 size={14} />} onClick={() => deleteConfirm && handleDelete(deleteConfirm)}>Hapus</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function ProjectCard({ project, onSelect, onEdit, onComplete, onDelete, completed = false }: {
  project: ProjectWithStats;
  onSelect: () => void;
  onEdit: (e: React.MouseEvent) => void;
  onComplete: (e: React.MouseEvent) => void;
  onDelete: (e: React.MouseEvent) => void;
  completed?: boolean;
}) {
  const isKantor = project.tipe === 'operasional_kantor';
  const sisaModal = (project.sisaKas !== undefined) ? project.sisaKas : ((project.anggaran || 0) - project.totalPengeluaran);

  return (
    <Card
      onClick={onSelect}
      className={`relative cursor-pointer hover:border-emerald-500/40 transition-all duration-200 hover:shadow-card-hover group ${completed ? 'opacity-75' : ''}`}
    >
      {/* Header Badge & Action Tools */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-1.5 flex-wrap">
          <Badge variant={completed ? 'gray' : isKantor ? 'blue' : 'green'}>
            {completed ? 'Selesai' : isKantor ? '💼 Pos Kantor' : '🏢 Proyek Klien'}
          </Badge>
        </div>
        <div className="flex gap-1" onClick={e => e.stopPropagation()}>
          <button onClick={onEdit} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
            <Edit2 size={14} />
          </button>
          {!completed && (
            <button onClick={onComplete} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-emerald-100 text-gray-400 hover:text-emerald-600 transition-colors" title="Tandai Selesai">
              <CheckCircle size={14} />
            </button>
          )}
          <button onClick={onDelete} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-red-100 text-gray-400 hover:text-red-600 transition-colors">
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      <h3 className="font-bold text-gray-900 mb-1 group-hover:text-emerald-600 transition-colors flex items-center justify-between">
        <span>{project.nama}</span>
        <ChevronRight size={16} className="text-gray-300 group-hover:text-emerald-500 group-hover:translate-x-1 transition-all" />
      </h3>
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
        <Users size={13} />
        <span>{project.klien}</span>
      </div>
      <div className="flex items-center gap-2 text-xs text-gray-400 mb-4">
        <Calendar size={12} />
        <span>Mulai: {formatDate(project.tanggalMulai)}</span>
      </div>

      {/* Financial stats */}
      <div className="grid grid-cols-3 gap-2 pt-3 border-t border-gray-100">
        <div className="text-center">
          <div className="flex items-center justify-center gap-1 mb-1">
            <Wallet size={12} className="text-blue-500" />
            <p className="text-[11px] text-gray-500 font-medium">Sisa Kas</p>
          </div>
          <p className={`text-xs font-extrabold truncate ${sisaModal >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
            {formatRupiah(sisaModal)}
          </p>
        </div>
        <div className="text-center">
          <div className="flex items-center justify-center gap-1 mb-1">
            <TrendingDown size={12} className="text-red-500" />
            <p className="text-[11px] text-gray-500 font-medium">Terpakai</p>
          </div>
          <p className="text-xs font-extrabold text-red-600 truncate">{formatRupiah(project.totalPengeluaran)}</p>
        </div>
        <div className="text-center">
          <div className="flex items-center justify-center gap-1 mb-1">
            <TrendingUp size={12} className="text-emerald-500" />
            <p className="text-[11px] text-gray-500 font-medium">{isKantor ? 'Drop Dana' : 'Profit'}</p>
          </div>
          <p className={`text-xs font-extrabold truncate ${isKantor || project.profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
            {isKantor ? formatRupiah(project.anggaran || 0) : formatRupiah(project.profit)}
          </p>
        </div>
      </div>
    </Card>
  );
}
