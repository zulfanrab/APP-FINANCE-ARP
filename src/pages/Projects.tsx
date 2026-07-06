// ============================================================
// ARKA Finance — Projects Page
// CRUD: tambah, edit, selesaikan proyek + kalkulasi profit
// ============================================================

import React, { useState, useEffect, useCallback } from 'react';
import {
  Plus, FolderOpen, Edit2, CheckCircle, Trash2,
  TrendingUp, TrendingDown, DollarSign, Calendar, Users
} from 'lucide-react';
import { getProjects, addProject, updateProject, completeProject, deleteProject } from '../services/projectService';
import { getTransactionsByProject } from '../services/transactionService';
import { type Project } from '../types';
import { Card, Button, Badge, LoadingSpinner, EmptyState, formatRupiah, formatDate } from '../components/ui';
import { Modal } from '../components/ui/Modal';
import { useApp } from '../context/AppContext';

interface ProjectWithStats extends Project {
  totalPemasukan: number;
  totalPengeluaran: number;
  profit: number;
}

export function Projects() {
  const { addToast, triggerRefresh, refreshKey } = useApp();
  const [projects, setProjects] = useState<ProjectWithStats[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Project | null>(null);

  // Form
  const [form, setForm] = useState({ nama: '', klien: '', tanggalMulai: '', deskripsi: '' });
  const [saving, setSaving] = useState(false);

  const loadProjects = useCallback(async () => {
    setLoading(true);
    try {
      const raw = await getProjects();
      const withStats = await Promise.all(
        raw.map(async p => {
          const txns = await getTransactionsByProject(p.id);
          const approved = txns.filter(t => t.status === 'disetujui' || t.status === 'selesai');
          const totalPemasukan = approved.filter(t => t.jenis === 'masuk').reduce((s, t) => s + t.nominal, 0);
          const totalPengeluaran = approved.filter(t => t.jenis === 'keluar').reduce((s, t) => s + t.nominal, 0);
          return { ...p, totalPemasukan, totalPengeluaran, profit: totalPemasukan - totalPengeluaran };
        })
      );
      setProjects(withStats);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadProjects(); }, [loadProjects, refreshKey]);

  const openAdd = () => {
    setEditingProject(null);
    setForm({ nama: '', klien: '', tanggalMulai: new Date().toISOString().split('T')[0], deskripsi: '' });
    setModalOpen(true);
  };

  const openEdit = (p: Project) => {
    setEditingProject(p);
    setForm({ nama: p.nama, klien: p.klien, tanggalMulai: p.tanggalMulai, deskripsi: p.deskripsi ?? '' });
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nama.trim()) { addToast('error', 'Nama proyek wajib diisi'); return; }
    if (!form.klien.trim()) { addToast('error', 'Nama klien wajib diisi'); return; }
    setSaving(true);
    try {
      if (editingProject) {
        await updateProject(editingProject.id, {
          nama: form.nama.trim(),
          klien: form.klien.trim(),
          tanggalMulai: form.tanggalMulai,
          deskripsi: form.deskripsi.trim(),
        });
        addToast('success', 'Proyek berhasil diperbarui');
      } else {
        await addProject({
          nama: form.nama.trim(),
          klien: form.klien.trim(),
          tanggalMulai: form.tanggalMulai,
          deskripsi: form.deskripsi.trim(),
        });
        addToast('success', 'Proyek baru berhasil ditambahkan');
      }
      setModalOpen(false);
      triggerRefresh();
      loadProjects();
    } finally {
      setSaving(false);
    }
  };

  const handleComplete = async (id: string) => {
    await completeProject(id);
    addToast('success', 'Proyek ditandai selesai');
    loadProjects();
    triggerRefresh();
  };

  const handleDelete = async (p: Project) => {
    await deleteProject(p.id);
    addToast('success', `Proyek "${p.nama}" dihapus`);
    setDeleteConfirm(null);
    loadProjects();
    triggerRefresh();
  };

  if (loading) return <LoadingSpinner size={32} />;

  const activeProjects = projects.filter(p => p.status === 'aktif');
  const completedProjects = projects.filter(p => p.status === 'selesai');

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Proyek</h1>
          <p className="text-gray-500 text-sm mt-1">Kelola proyek dan lihat kalkulasi profit</p>
        </div>
        <Button icon={<Plus size={16} />} onClick={openAdd}>Tambah Proyek</Button>
      </div>

      {/* Active Projects */}
      <div>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
          Proyek Aktif ({activeProjects.length})
        </h2>
        {activeProjects.length === 0 ? (
          <Card>
            <EmptyState
              icon={<FolderOpen size={28} />}
              title="Belum ada proyek aktif"
              description="Tambahkan proyek baru untuk mulai mencatat keuangan per proyek"
              action={<Button icon={<Plus size={16} />} onClick={openAdd}>Tambah Proyek</Button>}
            />
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
            {activeProjects.map(p => (
              <ProjectCard key={p.id} project={p} onEdit={openEdit} onComplete={handleComplete} onDelete={setDeleteConfirm} />
            ))}
          </div>
        )}
      </div>

      {/* Completed Projects */}
      {completedProjects.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
            Proyek Selesai ({completedProjects.length})
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
            {completedProjects.map(p => (
              <ProjectCard key={p.id} project={p} onEdit={openEdit} onComplete={handleComplete} onDelete={setDeleteConfirm} completed />
            ))}
          </div>
        </div>
      )}

      {/* Add/Edit Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingProject ? 'Edit Proyek' : 'Tambah Proyek Baru'}
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Nama Proyek *</label>
            <input
              type="text"
              value={form.nama}
              onChange={e => setForm(f => ({ ...f, nama: e.target.value }))}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Nama proyek..."
              required autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Nama Klien *</label>
            <input
              type="text"
              value={form.klien}
              onChange={e => setForm(f => ({ ...f, klien: e.target.value }))}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Nama klien / perusahaan..."
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Tanggal Mulai</label>
            <input
              type="date"
              value={form.tanggalMulai}
              onChange={e => setForm(f => ({ ...f, tanggalMulai: e.target.value }))}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Deskripsi (Opsional)</label>
            <textarea
              value={form.deskripsi}
              onChange={e => setForm(f => ({ ...f, deskripsi: e.target.value }))}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
              rows={3}
              placeholder="Deskripsi singkat proyek..."
            />
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>Batal</Button>
            <Button type="submit" loading={saving}>{editingProject ? 'Simpan Perubahan' : 'Tambah Proyek'}</Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirm Modal */}
      <Modal isOpen={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} title="Hapus Proyek" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Apakah Anda yakin ingin menghapus proyek <strong>"{deleteConfirm?.nama}"</strong>?
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

function ProjectCard({ project, onEdit, onComplete, onDelete, completed = false }: {
  project: ProjectWithStats;
  onEdit: (p: Project) => void;
  onComplete: (id: string) => void;
  onDelete: (p: Project) => void;
  completed?: boolean;
}) {
  return (
    <Card className={`relative ${completed ? 'opacity-70' : ''}`}>
      {/* Status badge */}
      <div className="flex items-start justify-between mb-3">
        <Badge variant={completed ? 'gray' : 'green'}>
          {completed ? 'Selesai' : 'Aktif'}
        </Badge>
        <div className="flex gap-1">
          <button onClick={() => onEdit(project)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
            <Edit2 size={14} />
          </button>
          {!completed && (
            <button onClick={() => onComplete(project.id)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-green-100 text-gray-400 hover:text-green-600 transition-colors" title="Tandai Selesai">
              <CheckCircle size={14} />
            </button>
          )}
          <button onClick={() => onDelete(project)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-red-100 text-gray-400 hover:text-red-600 transition-colors">
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      <h3 className="font-bold text-gray-800 mb-1">{project.nama}</h3>
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
        <Users size={13} />
        <span>{project.klien}</span>
      </div>
      <div className="flex items-center gap-2 text-xs text-gray-400 mb-4">
        <Calendar size={12} />
        <span>Mulai: {formatDate(project.tanggalMulai)}</span>
        {project.tanggalSelesai && <span>· Selesai: {formatDate(project.tanggalSelesai)}</span>}
      </div>

      {/* Financial stats */}
      <div className="grid grid-cols-3 gap-2 pt-3 border-t border-gray-100">
        <div className="text-center">
          <div className="flex items-center justify-center gap-1 mb-1">
            <TrendingUp size={12} className="text-green-500" />
            <p className="text-xs text-gray-500">Masuk</p>
          </div>
          <p className="text-sm font-semibold text-green-600 truncate">{formatRupiah(project.totalPemasukan)}</p>
        </div>
        <div className="text-center">
          <div className="flex items-center justify-center gap-1 mb-1">
            <TrendingDown size={12} className="text-red-500" />
            <p className="text-xs text-gray-500">Keluar</p>
          </div>
          <p className="text-sm font-semibold text-red-600 truncate">{formatRupiah(project.totalPengeluaran)}</p>
        </div>
        <div className="text-center">
          <div className="flex items-center justify-center gap-1 mb-1">
            <DollarSign size={12} className="text-primary" />
            <p className="text-xs text-gray-500">Profit</p>
          </div>
          <p className={`text-sm font-bold truncate ${project.profit >= 0 ? 'text-primary' : 'text-red-600'}`}>
            {formatRupiah(project.profit)}
          </p>
        </div>
      </div>
    </Card>
  );
}
