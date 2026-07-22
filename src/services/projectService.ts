// ============================================================
// ARKA Finance — Project Service (LocalStorage + Supabase Sync)
// ============================================================

import { type Project, type Transaction } from '../types';
import { getItem, setItem, KEYS } from './storage';
import { supabase, isSupabaseConfigured } from './supabase';

function generateId(): string {
  return `prj_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function now(): string {
  return new Date().toISOString();
}

function mapRowToProject(row: any): Project {
  return {
    id: row.id,
    nama: row.nama,
    klien: row.klien,
    anggaran: row.anggaran ? Number(row.anggaran) : 0,
    tanggalMulai: row.tanggal_mulai,
    tanggalSelesai: row.tanggal_selesai ?? undefined,
    status: row.status,
    deskripsi: row.deskripsi ?? undefined,
    dibuatPada: row.dibuat_pada,
    diupdatePada: row.diupdate_pada,
  };
}

function mapProjectToRow(p: Project): any {
  return {
    id: p.id,
    nama: p.nama,
    klien: p.klien,
    anggaran: p.anggaran ?? 0,
    tanggal_mulai: p.tanggalMulai,
    tanggal_selesai: p.tanggalSelesai ?? null,
    status: p.status,
    deskripsi: p.deskripsi ?? null,
    dibuat_pada: p.dibuatPada,
    diupdate_pada: p.diupdatePada,
  };
}

export async function syncProjectBudgetTransaction(project: Project): Promise<void> {
  if (!project.anggaran || project.anggaran <= 0) return;

  const newTx: Transaction = {
    id: `txn_modal_${project.id}`,
    tanggal: project.tanggalMulai || new Date().toISOString().split('T')[0],
    jenis: 'keluar',
    deskripsi: `Suntikan Modal Proyek: ${project.nama}`,
    nominal: project.anggaran,
    kategori: 'Biaya Proyek',
    tag: 'operasional',
    proyekId: project.id,
    lampiran: [],
    status: 'selesai',
    dibuatPada: now(),
    diupdatePada: now(),
  };

  const transactions = getItem<Transaction[]>(KEYS.TRANSACTIONS, []);
  const idx = transactions.findIndex(t => t.id === newTx.id || (t.proyekId === project.id && t.deskripsi.startsWith('Suntikan Modal Proyek:')));

  if (idx !== -1) {
    transactions[idx] = {
      ...transactions[idx],
      nominal: project.anggaran,
      deskripsi: `Suntikan Modal Proyek: ${project.nama}`,
      diupdatePada: now(),
    };
  } else {
    transactions.push(newTx);
  }
  setItem(KEYS.TRANSACTIONS, transactions);

  if (isSupabaseConfigured && supabase) {
    try {
      await supabase.from('transactions').upsert({
        id: newTx.id,
        tanggal: newTx.tanggal,
        jenis: newTx.jenis,
        deskripsi: newTx.deskripsi,
        nominal: project.anggaran,
        kategori: newTx.kategori,
        tag: newTx.tag,
        proyek_id: newTx.proyekId,
        lampiran: [],
        status: newTx.status,
        dibuat_pada: newTx.dibuatPada,
        diupdate_pada: newTx.diupdatePada,
      });
    } catch (err) {
      console.warn('Supabase sync modal transaction error:', err);
    }
  }
}

export async function getProjects(): Promise<Project[]> {
  const localData = getItem<Project[]>(KEYS.PROJECTS, []);

  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .order('dibuat_pada', { ascending: false });

      if (!error && data) {
        const remoteProjects = data.map(mapRowToProject);
        const remoteIds = new Set(remoteProjects.map(p => p.id));
        const unsyncedLocal = localData.filter(p => !remoteIds.has(p.id));

        const merged = [...remoteProjects, ...unsyncedLocal].sort(
          (a, b) => new Date(b.dibuatPada).getTime() - new Date(a.dibuatPada).getTime()
        );

        setItem(KEYS.PROJECTS, merged);
        return merged;
      }
    } catch (err) {
      console.warn('Supabase projects fetch error, falling back to local storage:', err);
    }
  }

  return [...localData].sort(
    (a, b) => new Date(b.dibuatPada).getTime() - new Date(a.dibuatPada).getTime()
  );
}

export async function getProjectById(id: string): Promise<Project | null> {
  const all = await getProjects();
  return all.find(p => p.id === id) ?? null;
}

export async function getActiveProjects(): Promise<Project[]> {
  const all = await getProjects();
  return all.filter(p => p.status === 'aktif');
}

export async function addProject(
  data: Omit<Project, 'id' | 'status' | 'dibuatPada' | 'diupdatePada'>
): Promise<Project> {
  const newProject: Project = {
    ...data,
    id: generateId(),
    status: 'aktif',
    dibuatPada: now(),
    diupdatePada: now(),
  };

  const projects = getItem<Project[]>(KEYS.PROJECTS, []);
  projects.push(newProject);
  setItem(KEYS.PROJECTS, projects);

  if (isSupabaseConfigured && supabase) {
    try {
      await supabase.from('projects').insert(mapProjectToRow(newProject));
    } catch (err) {
      console.warn('Supabase add project error:', err);
    }
  }

  if (newProject.anggaran && newProject.anggaran > 0) {
    await syncProjectBudgetTransaction(newProject);
  }

  return newProject;
}

export async function updateProject(
  id: string,
  updates: Partial<Omit<Project, 'id' | 'dibuatPada'>>
): Promise<Project> {
  const projects = getItem<Project[]>(KEYS.PROJECTS, []);
  const idx = projects.findIndex(p => p.id === id);
  if (idx === -1) throw new Error(`Project ${id} not found`);

  const updated: Project = {
    ...projects[idx],
    ...updates,
    diupdatePada: now(),
  };

  projects[idx] = updated;
  setItem(KEYS.PROJECTS, projects);

  if (isSupabaseConfigured && supabase) {
    try {
      await supabase.from('projects').update(mapProjectToRow(updated)).eq('id', id);
    } catch (err) {
      console.warn('Supabase update project error:', err);
    }
  }

  if (updated.anggaran && updated.anggaran > 0) {
    await syncProjectBudgetTransaction(updated);
  }

  return updated;
}

export async function completeProject(id: string): Promise<Project> {
  return updateProject(id, {
    status: 'selesai',
    tanggalSelesai: new Date().toISOString().split('T')[0],
  });
}

export async function deleteProject(id: string): Promise<void> {
  const projects = getItem<Project[]>(KEYS.PROJECTS, []);
  const filtered = projects.filter(p => p.id !== id);
  setItem(KEYS.PROJECTS, filtered);

  if (isSupabaseConfigured && supabase) {
    try {
      await supabase.from('projects').delete().eq('id', id);
    } catch (err) {
      console.warn('Supabase delete project error:', err);
    }
  }
}
