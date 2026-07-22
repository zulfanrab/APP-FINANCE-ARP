// ============================================================
// ARKA Finance — Mobile App Header Bar (Native Look with Safe Area)
// ============================================================

import React, { useState } from 'react';
import { LogOut, BookOpen } from 'lucide-react';
import logo from '../../assets/logo.png';
import { useAuth } from '../../context/AuthContext';
import { UserGuideModal } from '../ui/UserGuideModal';
import { isSupabaseConfigured } from '../../services/supabase';

export function MobileHeader() {
  const { role, logout } = useAuth();
  const [guideOpen, setGuideOpen] = useState(false);

  return (
    <header className="md:hidden sticky top-0 z-40 bg-[#0F172A]/98 backdrop-blur-xl text-white border-b border-white/10 px-4 pt-[calc(0.75rem+env(safe-area-inset-top))] pb-3 flex items-center justify-between shadow-lg">
      <div className="flex items-center gap-3">
        {/* Seamless Rounded Logo Container */}
        <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/10 border border-emerald-500/30 p-1 flex items-center justify-center flex-shrink-0 shadow-inner overflow-hidden">
          <img src={logo} alt="ARKA Logo" className="w-full h-full object-contain drop-shadow-sm" />
        </div>
        <div>
          <h1 className="font-bold text-base leading-tight tracking-tight flex items-center gap-1.5">
            ARKA Finance
          </h1>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className={`w-1.5 h-1.5 rounded-full ${isSupabaseConfigured ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
            <span className="text-[10px] text-emerald-400 font-medium leading-none">
              {isSupabaseConfigured ? 'Cloud Sync Active' : 'Mode Lokal'}
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => setGuideOpen(true)}
          className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center text-emerald-300 hover:text-emerald-200 transition-all active:scale-95"
          title="Buku Panduan Penggunaan"
        >
          <BookOpen size={16} />
        </button>

        <span className="px-2.5 py-1 rounded-full bg-white/10 text-[11px] font-semibold text-emerald-300 border border-emerald-500/20 capitalize">
          {role === 'owner' ? '👑 Owner' : '💼 Admin'}
        </span>

        <button
          onClick={logout}
          className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center text-white/70 hover:text-white hover:bg-red-500/30 transition-all active:scale-95"
          title="Keluar"
        >
          <LogOut size={16} />
        </button>

        <UserGuideModal isOpen={guideOpen} onClose={() => setGuideOpen(false)} />
      </div>
    </header>
  );
}
