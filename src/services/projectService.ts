// ============================================================
// ARKA Finance — Project Service
// Pola async/await: siap diganti fetch() ke backend API
// ============================================================

import { type Project } from '../types';
import { getItem, setItem, KEYS } from './storage';

function generateId(): string {
  return `prj_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function now(): string {
  return new Date().toISOString();
}

export async function getProjects(): Promise<Project[]> {
  const data = getItem<Project[]>(KEYS.PROJECTS, []);
  return [...data].sort(
    (a, b) => new Date(b.dibuatPada).getTime() - new Date(a.dibuatPada).getTime()
  );
}

export async function getProjectById(id: string): Promise<Project | null> {
  const data = getItem<Project[]>(KEYS.PROJECTS, []);
  return data.find(p => p.id === id) ?? null;
}

export async function getActiveProjects(): Promise<Project[]> {
  const data = getItem<Project[]>(KEYS.PROJECTS, []);
  return data.filter(p => p.status === 'aktif');
}

export async function addProject(
  data: Omit<Project, 'id' | 'status' | 'dibuatPada' | 'diupdatePada'>
): Promise<Project> {
  const projects = getItem<Project[]>(KEYS.PROJECTS, []);

  const newProject: Project = {
    ...data,
    id: generateId(),
    status: 'aktif',
    dibuatPada: now(),
    diupdatePada: now(),
  };

  projects.push(newProject);
  setItem(KEYS.PROJECTS, projects);
  return newProject;
}

export async function updateProject(
  id: string,
  updates: Partial<Omit<Project, 'id' | 'dibuatPada'>>
): Promise<Project> {
  const projects = getItem<Project[]>(KEYS.PROJECTS, []);
  const idx = projects.findIndex(p => p.id === id);
  if (idx === -1) throw new Error(`Project ${id} not found`);

  projects[idx] = {
    ...projects[idx],
    ...updates,
    diupdatePada: now(),
  };

  setItem(KEYS.PROJECTS, projects);
  return projects[idx];
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
}
