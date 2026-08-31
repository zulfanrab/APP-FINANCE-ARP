// ============================================================
// ARKA Finance — Auto Update Banner Component
// Displays live Vercel auto-update toast & countdown
// ============================================================

import React, { useEffect, useState } from 'react';
import { Sparkles, RefreshCw, X, Zap } from 'lucide-react';
import {
  subscribeToAutoUpdate,
  triggerAppReload,
  type VersionInfo,
} from '../../services/autoUpdateService';

export function AutoUpdateBanner() {
  const [updateInfo, setUpdateInfo] = useState<VersionInfo | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const unsubscribe = subscribeToAutoUpdate((info) => {
      setUpdateInfo(info);
    });

    return () => unsubscribe();
  }, []);

  if (!updateInfo || dismissed) return null;

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] w-[92%] max-w-md animate-bounce-in">
      <div className="bg-gradient-to-r from-slate-950 via-emerald-950 to-slate-950 text-white p-4 rounded-3xl border-2 border-emerald-500/50 shadow-2xl backdrop-blur-xl relative overflow-hidden">
        {/* Animated Background Pulse */}
        <div className="absolute -top-12 -right-12 w-24 h-24 bg-emerald-500/20 rounded-full blur-xl animate-pulse" />

        <div className="flex items-start justify-between gap-3 relative z-10">
          <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center flex-shrink-0 animate-spin-slow mt-0.5">
            <RefreshCw size={20} className="animate-spin" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 font-bold text-xs text-emerald-300">
              <Sparkles size={14} className="text-emerald-400" />
              <span>Pembaruan Aplikasi Tersedia!</span>
            </div>
            <p className="text-xs text-slate-200 font-medium leading-tight mt-1">
              Versi terbaru telah siap. Muat ulang sekarang untuk menikmati fitur & perbaikan terbaru.
            </p>

            {/* Action Buttons */}
            <div className="flex items-center gap-2 mt-3">
              <button
                type="button"
                onClick={triggerAppReload}
                className="flex-1 py-2 px-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all active:scale-95 shadow-md"
              >
                <Zap size={14} className="fill-current" /> Muat Ulang Sekarang
              </button>
              <button
                type="button"
                onClick={() => setDismissed(true)}
                className="px-3 py-2 bg-slate-800/80 hover:bg-slate-800 text-slate-300 rounded-xl text-xs font-semibold transition-all active:scale-95"
              >
                Nanti
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors flex-shrink-0"
          >
            <X size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
