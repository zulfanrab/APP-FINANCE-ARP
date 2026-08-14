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

async function safeSupabaseInsert(table: string, payload: any) {
  if (!supabase) return { error: null };
  let retryRow = { ...payload };
  let { error } = await supabase.from(table).insert([retryRow]);
  
  while (error && (error.message?.includes('does not exist') || error.message?.includes('schema cache') || error.message?.includes('Could not find'))) {
    const match = error.message.match(/column "(.*?)"/) || error.message.match(/the '(.*?)' column/);
    if (match && match[1]) {
      const missingCol = match[1];
      console.warn(`Supabase missing "${missingCol}" column. Retrying insert without it...`);
      delete retryRow[missingCol];
      const retryRes = await supabase.from(table).insert([retryRow]);
      error = retryRes.error;
    } else {
      break;
    }
  }
  return { error };
}

async function safeSupabaseUpdate(table: string, payload: any, id: string) {
  if (!supabase) return { error: null };
  let retryRow = { ...payload };
  let { error } = await supabase.from(table).update(retryRow).eq('id', id);

  while (error && (error.message?.includes('does not exist') || error.message?.includes('schema cache') || error.message?.includes('Could not find'))) {
    const match = error.message.match(/column "(.*?)"/) || error.message.match(/the '(.*?)' column/);
    if (match && match[1]) {
      const missingCol = match[1];
      console.warn(`Supabase missing "${missingCol}" column. Retrying update without it...`);
      delete retryRow[missingCol];
      const retryRes = await supabase.from(table).update(retryRow).eq('id', id);
      error = retryRes.error;
    } else {
      break;
    }
  }
  return { error };
}

function mapRowToProject(row: any): Project {
  return {
    id: row.id,
    nama: row.nama,
    klien: row.klien,
    nomorSurat: row.nomor_surat ?? undefined,
    pemohonNama: row.pemohon_nama ?? undefined,
    pemohonJabatan: row.pemohon_jabatan ?? undefined,
    teknisiPic: row.teknisi_pic ?? undefined,
    tipe: row.tipe_proyek ?? 'proyek_klien',
    anggaran: row.anggaran ? Number(row.anggaran) : 0,
    tanggalMulai: row.tanggal_mulai,
    tanggalSelesai: row.tanggal_selesai ?? undefined,
    status: row.status,
    deskripsi: row.deskripsi ?? undefined,
    suratPengajuanPdf: row.surat_pengajuan_pdf ?? undefined,
    procurementItems: row.procurement_items ? (typeof row.procurement_items === 'string' ? JSON.parse(row.procurement_items) : row.procurement_items) : [],
    isDeleted: Boolean(row.is_deleted),
    deletedAt: row.deleted_at ?? undefined,
    dibuatPada: row.dibuat_pada,
    diupdatePada: row.diupdate_pada,
  };
}

function mapProjectToRow(p: Project): any {
  const row: any = {
    id: p.id,
    nama: p.nama,
    klien: p.klien,
    nomor_surat: p.nomorSurat ?? null,
    pemohon_nama: p.pemohonNama ?? null,
    pemohon_jabatan: p.pemohonJabatan ?? null,
    teknisi_pic: p.teknisiPic ?? null,
    anggaran: p.anggaran ?? 0,
    tanggal_mulai: p.tanggalMulai,
    tanggal_selesai: p.tanggalSelesai ?? null,
    status: p.status,
    deskripsi: p.deskripsi ?? null,
    surat_pengajuan_pdf: p.suratPengajuanPdf ?? null,
    procurement_items: p.procurementItems ? JSON.stringify(p.procurementItems) : null,
    is_deleted: p.isDeleted ?? false,
    deleted_at: p.deletedAt ?? null,
    dibuat_pada: p.dibuatPada,
    diupdate_pada: p.diupdatePada,
  };

  if (p.tipe) {
    row.tipe_proyek = p.tipe;
  }

  return row;
}

export async function syncProjectBudgetTransaction(project: Project): Promise<void> {
  if (!project.anggaran || project.anggaran <= 0) return;

  const newTx: Transaction = {
    id: `txn_modal_${project.id}`,
    tanggal: project.tanggalMulai || new Date().toISOString().split('T')[0],
    jenis: 'masuk',
    deskripsi: `Alokasi Modal Proyek: ${project.nama}`,
    nominal: project.anggaran,
    kategori: 'Alokasi Modal Operasional Proyek',
    tag: 'operasional',
    proyekId: project.id,
    lampiran: [],
    status: 'selesai',
    dibuatPada: now(),
    diupdatePada: now(),
  };

  const transactions = getItem<Transaction[]>(KEYS.TRANSACTIONS, []);
  const idx = transactions.findIndex(
    t => t.id === newTx.id ||
      (t.proyekId === project.id && (t.deskripsi.startsWith('Suntikan Modal Proyek:') || t.deskripsi.startsWith('Alokasi Modal Proyek:')))
  );

  if (idx !== -1) {
    transactions[idx] = {
      ...transactions[idx],
      jenis: 'masuk',
      kategori: 'Alokasi Modal Operasional Proyek',
      nominal: project.anggaran,
      deskripsi: `Alokasi Modal Proyek: ${project.nama}`,
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

function withTimeout<T>(promise: PromiseLike<T>, timeoutMs: number = 3000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Operation timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    Promise.resolve(promise)
      .then(res => {
        clearTimeout(timer);
        resolve(res);
      })
      .catch(err => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

export async function getProjects(includeDeleted: boolean = false): Promise<Project[]> {
  const localData = getItem<Project[]>(KEYS.PROJECTS, []);
  // Use longer timeout if local cache is empty (fresh PWA install / re-add to homescreen on mobile)
  const timeoutMs = localData.length === 0 ? 10000 : 4000;

  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await withTimeout(
        supabase
          .from('projects')
          .select('*')
          .order('dibuat_pada', { ascending: false }),
        timeoutMs
      );

      if (!error && data) {
        const localMap = new Map(localData.map(p => [p.id, p]));
        const remoteProjects = data.map(row => {
          const proj = mapRowToProject(row);
          const local = localMap.get(proj.id);
          if (local) {
            if (!proj.nomorSurat && local.nomorSurat) proj.nomorSurat = local.nomorSurat;
            if (!proj.pemohonNama && local.pemohonNama) proj.pemohonNama = local.pemohonNama;
            if (!proj.pemohonJabatan && local.pemohonJabatan) proj.pemohonJabatan = local.pemohonJabatan;
            if (!proj.teknisiPic && local.teknisiPic) proj.teknisiPic = local.teknisiPic;
            if ((!proj.procurementItems || proj.procurementItems.length === 0) && local.procurementItems && local.procurementItems.length > 0) {
              proj.procurementItems = local.procurementItems;
            }
            if (!proj.suratPengajuanPdf && local.suratPengajuanPdf) proj.suratPengajuanPdf = local.suratPengajuanPdf;
            if (local.isDeleted) proj.isDeleted = true;
          }
          return proj;
        });

        const remoteIds = new Set(remoteProjects.map(p => p.id));
        // Only keep local projects that were NOT deleted locally and not on remote
        const unsyncedLocal = localData.filter(p => !remoteIds.has(p.id) && !p.isDeleted);

        if (unsyncedLocal.length > 0) {
          console.info(`Found ${unsyncedLocal.length} unsynced local projects. Resyncing to Supabase...`);
          for (const p of unsyncedLocal) {
            safeSupabaseInsert('projects', mapProjectToRow(p)).catch(err => 
              console.warn(`Failed to resync project ${p.id}:`, err)
            );
          }
        }

        const merged = [...remoteProjects, ...unsyncedLocal].sort(
          (a, b) => new Date(b.dibuatPada).getTime() - new Date(a.dibuatPada).getTime()
        );

        setItem(KEYS.PROJECTS, merged);
        return includeDeleted ? merged : merged.filter(p => !p.isDeleted);
      }
    } catch (err) {
      console.warn('Supabase projects fetch error or timeout, falling back to local storage:', err);
    }
  }

  const sorted = [...localData].sort(
    (a, b) => new Date(b.dibuatPada).getTime() - new Date(a.dibuatPada).getTime()
  );
  return includeDeleted ? sorted : sorted.filter(p => !p.isDeleted);
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
      await safeSupabaseInsert('projects', mapProjectToRow(newProject));
    } catch (err) {
      console.warn('Supabase add project error:', err);
    }
  }

  // if (newProject.anggaran && newProject.anggaran > 0) {
  //   await syncProjectBudgetTransaction(newProject);
  // }

  return newProject;
}

export async function updateProject(
  id: string,
  updates: Partial<Omit<Project, 'id' | 'dibuatPada'>>
): Promise<Project> {
  let projects = getItem<Project[]>(KEYS.PROJECTS, []);
  let idx = projects.findIndex(p => p.id === id);

  // Fallback 1: If not found in LocalStorage, reload from getProjects()
  if (idx === -1) {
    projects = await getProjects();
    idx = projects.findIndex(p => p.id === id);
  }

  // Fallback 2: Direct query to Supabase by ID if still missing locally
  if (idx === -1 && isSupabaseConfigured && supabase) {
    try {
      const { data } = await supabase.from('projects').select('*').eq('id', id).single();
      if (data) {
        const fetched = mapRowToProject(data);
        projects.push(fetched);
        idx = projects.length - 1;
      }
    } catch (err) {
      console.warn('Supabase fallback query for project failed:', err);
    }
  }

  if (idx === -1) throw new Error(`Project ${id} tidak ditemukan`);

  const updated: Project = {
    ...projects[idx],
    ...updates,
    diupdatePada: now(),
  };

  projects[idx] = updated;
  setItem(KEYS.PROJECTS, projects);

  if (isSupabaseConfigured && supabase) {
    try {
      await safeSupabaseUpdate('projects', mapProjectToRow(updated), id);
    } catch (err) {
      console.warn('Supabase update project error:', err);
    }
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
  const timestamp = now();
  const updated = projects.map(p => {
    if (p.id === id) {
      return { ...p, isDeleted: true, deletedAt: timestamp, diupdatePada: timestamp };
    }
    return p;
  });
  setItem(KEYS.PROJECTS, updated);

  if (isSupabaseConfigured && supabase) {
    try {
      await safeSupabaseUpdate('projects', { is_deleted: true, deleted_at: timestamp }, id);
      await supabase.from('projects').delete().eq('id', id);
    } catch (err) {
      console.warn('Supabase delete project error:', err);
    }
  }
}
