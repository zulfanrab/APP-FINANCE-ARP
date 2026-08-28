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
    // 1. INSTANT 0ms CACHE HYDRATION (Prevents perpetual skeleton loading UI)
    const localTxs = getItem<Transaction[]>(KEYS.TRANSACTIONS, []);
    const localProjs = getItem<Project[]>(KEYS.PROJECTS, []);

    if (localTxs.length > 0 || localProjs.length > 0) {
      setTransactions(localTxs);
      setProjects(localProjs);
      setLoading(false); // Instantly unblocks screen in 0ms!
    }

    // Prevent stacking/overlapping background network calls
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;

    // 2. BACKGROUND REMOTE SYNC WITH SUPABASE (LIGHTWEIGHT <120KB)
    try {
      const [txs, projs] = await Promise.all([getTransactions(), getProjects()]);
      setTransactions(txs);
      setProjects(projs);
    } catch (err) {
      console.warn('Background sync with Supabase notice:', err);
    } finally {
      isFetchingRef.current = false;
      setLoading(false);
    }
  }, []);

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

    addToast('info', '🔄 Menghubungi Supabase Cloud...');
    try {
      const [txs, projs] = await Promise.all([getTransactions(), getProjects()]);
      setTransactions(txs);
      setProjects(projs);
      addToast('success', `✅ Sinkronisasi Berhasil! (${txs.length} transaksi & ${projs.length} proyek dimuat)`);
    } catch (err: any) {
      console.error('Manual force sync failed:', err);
      addToast('error', `❌ Gagal menarik data: ${err?.message || 'Koneksi terputus'}`);
    }
  }, [addToast]);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  // Instant optimistic + debounced remote refresh trigger
  const triggerRefresh = useCallback(() => {
    // 1. INSTANT 0ms OPTIMISTIC UI HYDRATION: Update React state immediately from local storage
    const localTxs = getItem<Transaction[]>(KEYS.TRANSACTIONS, []);
    const localProjs = getItem<Project[]>(KEYS.PROJECTS, []);
    if (localTxs.length > 0) setTransactions(localTxs);
    if (localProjs.length > 0) setProjects(localProjs);
    setRefreshKey(k => k + 1);

    // 2. Schedule fast remote background sync
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
    }
    refreshTimerRef.current = setTimeout(() => {
      refreshData();
    }, 100);
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

  // 2. AUTO-SYNC ON MOBILE APP RESUME / WINDOW FOCUS / BACK ONLINE
  useEffect(() => {
    const handleResumeOrOnline = () => {
      console.info('📱 App resumed or came online. Triggering background sync...');
      triggerRefresh();
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
      window.removeEventListener('focus', handleResumeOrOnline);
      window.removeEventListener('online', handleResumeOrOnline);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [triggerRefresh]);

  // 3. CONTINUOUS BACKGROUND HEARTBEAT POLLING FOR ROCK-SOLID MULTI-DEVICE SYNC
  useEffect(() => {
    const pollInterval = setInterval(() => {
      // Only poll when page is active/visible
      if (document.visibilityState === 'visible') {
        refreshData();
      }
    }, 4500);

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
