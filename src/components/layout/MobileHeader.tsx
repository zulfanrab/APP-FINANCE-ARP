// ============================================================
// ARKA Finance — Mobile App Header Bar (Native Look)
// ============================================================

import React from 'react';
import { LogOut } from 'lucide-react';
import logo from '../../assets/logo.png';
import { useAuth } from '../../context/AuthContext';

export function MobileHeader() {
  const { role, logout } = useAuth();

  return (
    <header className="md:hidden sticky top-0 z-40 bg-[#0F172A]/95 backdrop-blur-md text-white border-b border-white/10 px-4 py-3 flex items-center justify-between shadow-md">
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-xl bg-white p-0.5 flex items-center justify-center flex-shrink-0 shadow-sm">
          <img src={logo} alt="ARKA Logo" className="w-full h-full object-contain" />
        </div>
        <div>
          <h1 className="font-bold text-base leading-tight tracking-tight flex items-center gap-1.5">
            ARKA Finance
          </h1>
          <p className="text-[10px] text-emerald-400 font-medium leading-none">
            PT Aksara Riksa Perdana
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
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
      </div>
    </header>
  );
}
