// ============================================================
// ARKA Finance — Activity Log & Audit Trail Service
// Tracks user/staff inputs, updates, approvals & logins
// Dual-Layer Storage: LocalStorage + Graceful Supabase Sync
// ============================================================

import { type ActivityLog, type ActivityAction, type UserRole } from '../types';
import { getItem, setItem, KEYS } from './storage';
import { supabase, isSupabaseConfigured } from './supabase';
import { getSessionData } from './authService';

const MAX_LOGS_LOCAL = 500;

function generateId(): string {
  return `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
}

function getRoleLabel(role?: UserRole): string {
  if (role === 'owner') return '👑 Direksi / Pimpinan';
  if (role === 'admin') return '💼 Head of Finance';
  if (role === 'staff') return '🤝 Asisten Keuangan';
  return 'Sistem';
}

export async function addActivityLog(params: {
  aksi: ActivityAction;
  deskripsi: string;
  nominal?: number;
  targetId?: string;
  targetNama?: string;
  pelakuRole?: UserRole;
  pelakuLabel?: string;
}): Promise<ActivityLog> {
  const currentSession = getSessionData();
  const resolvedRole = params.pelakuRole || currentSession?.role || 'admin';
  const resolvedLabel = params.pelakuLabel || getRoleLabel(resolvedRole);

  const newLog: ActivityLog = {
    id: generateId(),
    waktu: new Date().toISOString(),
    pelakuRole: resolvedRole,
    pelakuLabel: resolvedLabel,
    aksi: params.aksi,
    deskripsi: params.deskripsi,
    nominal: params.nominal,
    targetId: params.targetId,
    targetNama: params.targetNama,
  };

  // 1. Save to Local Storage
  try {
    const existingLogs = getItem<ActivityLog[]>(KEYS.ACTIVITY_LOGS, []);
    const updatedLogs = [newLog, ...existingLogs].slice(0, MAX_LOGS_LOCAL);
    setItem(KEYS.ACTIVITY_LOGS, updatedLogs);
  } catch (err) {
    console.warn('Gagal menyimpan log aktivitas ke local storage:', err);
  }

  // 2. Sync to Supabase (if table exists)
  if (isSupabaseConfigured && supabase) {
    try {
      const row = {
        id: newLog.id,
        waktu: newLog.waktu,
        pelaku_role: newLog.pelakuRole,
        pelaku_label: newLog.pelakuLabel,
        aksi: newLog.aksi,
        deskripsi: newLog.deskripsi,
        nominal: newLog.nominal || null,
        target_id: newLog.targetId || null,
        target_nama: newLog.targetNama || null,
      };

      const { error } = await supabase.from('activity_logs').insert([row]);
      if (error && (error.message?.includes('does not exist') || error.code === '42P01')) {
        // Table doesn't exist yet in Supabase, fallback silently
      }
    } catch {
      // Ignore background log sync errors
    }
  }

  return newLog;
}

export async function getActivityLogs(): Promise<ActivityLog[]> {
  const localLogs = getItem<ActivityLog[]>(KEYS.ACTIVITY_LOGS, []);

  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('activity_logs')
        .select('*')
        .order('waktu', { ascending: false })
        .limit(200);

      if (!error && Array.isArray(data) && data.length > 0) {
        const remoteLogs: ActivityLog[] = data.map(row => ({
          id: row.id,
          waktu: row.waktu,
          pelakuRole: row.pelaku_role || 'admin',
          pelakuLabel: row.pelaku_label || getRoleLabel(row.pelaku_role),
          aksi: row.aksi,
          deskripsi: row.deskripsi,
          nominal: row.nominal ? Number(row.nominal) : undefined,
          targetId: row.target_id || undefined,
          targetNama: row.target_nama || undefined,
        }));

        // Merge without duplicates
        const logMap = new Map<string, ActivityLog>();
        remoteLogs.forEach(l => logMap.set(l.id, l));
        localLogs.forEach(l => logMap.set(l.id, l));

        const merged = Array.from(logMap.values())
          .sort((a, b) => new Date(b.waktu).getTime() - new Date(a.waktu).getTime())
          .slice(0, MAX_LOGS_LOCAL);

        setItem(KEYS.ACTIVITY_LOGS, merged);
        return merged;
      }
    } catch {
      // fallback to local
    }
  }

  return localLogs;
}

export async function clearActivityLogs(): Promise<void> {
  setItem(KEYS.ACTIVITY_LOGS, []);
  if (isSupabaseConfigured && supabase) {
    try {
      await supabase.from('activity_logs').delete().neq('id', '');
    } catch {
      // ignore
    }
  }
}
