// ============================================================
// ARKA Finance — App Context (Transactions, Projects, Toast)
// ============================================================

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
} from 'react';
import { type ToastMessage, type Transaction, type Project } from '../types';
import { supabase, isSupabaseConfigured } from '../services/supabase';
import { getTransactions } from '../services/transactionService';
import { getProjects } from '../services/projectService';
import { getItem, KEYS } from '../services/storage';

interface AppContextType {
  toasts: ToastMessage[];
  addToast: (type: ToastMessage['type'], message: string) => void;
  removeToast: (id: string) => void;
  // Refresh trigger — components subscribe to this to know when to refetch
  refreshKey: number;
  triggerRefresh: () => void;
  // Global Cached State
  transactions: Transaction[];
  projects: Project[];
  loading: boolean;
  refreshData: () => Promise<void>;
  forceSyncCloud: () => Promise<void>;
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const refreshTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isFetchingRef = useRef<boolean>(false);

  const refreshData = useCallback(async () => {
    // 1. INSTANT 0ms CACHE HYDRATION (Only on initial cold start to prevent skeleton UI)
    if (loading) {
      const localTxs = getItem<Transaction[]>(KEYS.TRANSACTIONS, []);
      const localProjs = getItem<Project[]>(KEYS.PROJECTS, []);

      if (localTxs.length > 0 || localProjs.length > 0) {
        setTransactions(localTxs);
        setProjects(localProjs);
        setLoading(false); // Instantly unblocks screen in 0ms!
      }
    }

    // Prevent stacking/overlapping background network calls
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;

    // 2. BACKGROUND REMOTE SYNC WITH SUPABASE (LIGHTWEIGHT <120KB)
    try {
      const [txs, projs] = await Promise.all([getTransactions(), getProjects()]);
      setTransactions(prev => {
        if (prev.length !== txs.length) return txs;
        const prevJson = JSON.stringify(prev.map(t => [t.id, t.diupdatePada, t.status, t.nominal]));
        const nextJson = JSON.stringify(txs.map(t => [t.id, t.diupdatePada, t.status, t.nominal]));
        return prevJson === nextJson ? prev : txs;
      });
      setProjects(prev => {
        if (prev.length !== projs.length) return projs;
        const prevJson = JSON.stringify(prev.map(p => [p.id, p.diupdatePada, p.status, p.anggaran, p.nomorSurat]));
        const nextJson = JSON.stringify(projs.map(p => [p.id, p.diupdatePada, p.status, p.anggaran, p.nomorSurat]));
        return prevJson === nextJson ? prev : projs;
      });
    } catch (err) {
      console.warn('Background sync with Supabase notice:', err);
    } finally {
      isFetchingRef.current = false;
      setLoading(false);
    }
  }, [loading]);

  const addToast = useCallback((type: ToastMessage['type'], message: string) => {
    const id = `toast_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    setToasts(prev => [...prev, { id, type, message }]);
    // Auto-remove after 4 seconds
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  }, []);

  const forceSyncCloud = useCallback(async () => {
    if (!isSupabaseConfigured || !supabase) {
      addToast('error', '⚠️ Mode Lokal: Kunci Supabase (.env) belum terpasang di browser perangkat ini.');
      return;
    }
    try {
      addToast('info', '🔄 Menghubungkan & menyinkronkan data...');
      await refreshData();
      addToast('success', '✅ Sinkronisasi cloud berhasil!');
    } catch (err: any) {
      addToast('error', `❌ Gagal menarik data: ${err?.message || 'Koneksi terputus'}`);
    }
  }, [addToast, refreshData]);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  // Instant optimistic + debounced remote refresh trigger
  const triggerRefresh = useCallback(() => {
    // 1. INSTANT 0ms OPTIMISTIC UI HYDRATION: Update React state immediately from local storage
    const localTxs = getItem<Transaction[]>(KEYS.TRANSACTIONS, []);
    const localProjs = getItem<Project[]>(KEYS.PROJECTS, []);
    if (localTxs.length > 0) {
      setTransactions(prev => {
        if (prev.length !== localTxs.length) return localTxs;
        const prevJson = JSON.stringify(prev.map(t => [t.id, t.diupdatePada, t.status]));
        const nextJson = JSON.stringify(localTxs.map(t => [t.id, t.diupdatePada, t.status]));
        return prevJson === nextJson ? prev : localTxs;
      });
    }
    if (localProjs.length > 0) {
      setProjects(prev => {
        if (prev.length !== localProjs.length) return localProjs;
        const prevJson = JSON.stringify(prev.map(p => [p.id, p.diupdatePada, p.status, p.nomorSurat]));
        const nextJson = JSON.stringify(localProjs.map(p => [p.id, p.diupdatePada, p.status, p.nomorSurat]));
        return prevJson === nextJson ? prev : localProjs;
      });
    }
    setRefreshKey(k => k + 1);

    // 2. Schedule fast remote background sync
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
    }
    refreshTimerRef.current = setTimeout(() => {
      refreshData();
    }, 200);
  }, [refreshData]);

  // Initial load
  useEffect(() => {
    refreshData();
  }, [refreshData]);

  // 1. REALTIME CROSS-DEVICE SYNC (Postgres Changes + Instant Broadcast WebSockets)
  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return;

    const channel = supabase
      .channel('arka-cross-device-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'transactions' },
        (payload) => {
          console.info('⚡ Realtime Postgres event received for transactions:', payload.eventType);
          triggerRefresh();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'projects' },
        (payload) => {
          console.info('⚡ Realtime Postgres event received for projects:', payload.eventType);
          triggerRefresh();
        }
      )
      .on(
        'broadcast',
        { event: 'sync_event' },
        (payload) => {
          console.info('⚡ Realtime Broadcast sync event received:', payload);
          triggerRefresh();
        }
      )
      .subscribe();

    return () => {
      supabase?.removeChannel(channel);
    };
  }, [triggerRefresh]);

  // 2. AUTO-SYNC ON MOBILE APP RESUME / WINDOW FOCUS / BACK ONLINE (Debounced)
  useEffect(() => {
    let focusTimeout: NodeJS.Timeout | null = null;
    const handleResumeOrOnline = () => {
      if (focusTimeout) clearTimeout(focusTimeout);
      focusTimeout = setTimeout(() => {
        console.info('📱 App resumed or came online. Triggering background sync...');
        triggerRefresh();
      }, 500);
    };

    window.addEventListener('focus', handleResumeOrOnline);
    window.addEventListener('online', handleResumeOrOnline);
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        handleResumeOrOnline();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      if (focusTimeout) clearTimeout(focusTimeout);
      window.removeEventListener('focus', handleResumeOrOnline);
      window.removeEventListener('online', handleResumeOrOnline);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [triggerRefresh]);

  // 3. CONTINUOUS BACKGROUND HEARTBEAT POLLING (Relaxed 30s interval for stability)
  useEffect(() => {
    const pollInterval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        refreshData();
      }
    }, 30000);

    return () => clearInterval(pollInterval);
  }, [refreshData]);

  return (
    <AppContext.Provider
      value={{
        toasts,
        addToast,
        removeToast,
        refreshKey,
        triggerRefresh,
        transactions,
        projects,
        loading,
        refreshData,
        forceSyncCloud,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp(): AppContextType {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
