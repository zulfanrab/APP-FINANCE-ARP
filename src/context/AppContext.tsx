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
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const refreshTimerRef = useRef<NodeJS.Timeout | null>(null);

  const refreshData = useCallback(async () => {
    try {
      const [txs, projs] = await Promise.all([getTransactions(), getProjects()]);
      setTransactions(txs);
      setProjects(projs);
    } catch (err) {
      console.error('Failed to load global data:', err);
    } finally {
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

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  // Debounced refresh trigger — prevents rapid stacking re-renders on mobile
  const triggerRefresh = useCallback(() => {
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
    }
    refreshTimerRef.current = setTimeout(() => {
      setRefreshKey(k => k + 1);
      refreshData();
    }, 250);
  }, [refreshData]);

  // Initial load
  useEffect(() => {
    refreshData();
  }, [refreshData]);

  // 1. REALTIME CROSS-DEVICE SYNC WITH SUPABASE REALTIME CHANNEL
  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return;

    const channel = supabase
      .channel('arka-cross-device-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'transactions' },
        (payload) => {
          console.info('⚡ Realtime Supabase event received for transactions:', payload.eventType);
          triggerRefresh();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'projects' },
        (payload) => {
          console.info('⚡ Realtime Supabase event received for projects:', payload.eventType);
          triggerRefresh();
        }
      )
      .subscribe();

    return () => {
      supabase?.removeChannel(channel);
    };
  }, [triggerRefresh]);



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
