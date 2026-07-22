// ============================================================
// ARKA Finance — Sidebar Navigation (Desktop)
// ============================================================

import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  ArrowLeftRight,
  PlusCircle,
  FolderKanban,
  BarChart3,
  LogOut,
  ChevronLeft,
  ChevronRight,
  BookOpen,
} from 'lucide-react';
import logo from '../../assets/logo.png';
import { useAuth } from '../../context/AuthContext';
import { UserGuideModal } from '../ui/UserGuideModal';
import { isSupabaseConfigured } from '../../services/supabase';

interface NavItem {
  to: string;
  icon: React.ReactNode;
  label: string;
  roles?: string[];
}

const navItems: NavItem[] = [
  { to: '/dashboard', icon: <LayoutDashboard size={20} />, label: 'Dashboard' },
  { to: '/transaksi', icon: <ArrowLeftRight size={20} />, label: 'Riwayat Transaksi' },
  {
    to: '/transaksi/baru',
    icon: <PlusCircle size={20} />,
    label: 'Input Transaksi',
    roles: ['admin'],
  },
  {
    to: '/proyek',
    icon: <FolderKanban size={20} />,
    label: 'Proyek',
  },
  { to: '/laporan', icon: <BarChart3 size={20} />, label: 'Laporan' },
];

export function Sidebar() {
  const { role, logout } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);

  const filtered = navItems.filter(
    item => !item.roles || item.roles.includes(role ?? '')
  );

  return (
    <aside
      className={`hidden md:flex h-screen sticky top-0 flex-col bg-[#0F172A] text-white transition-all duration-300
        ${collapsed ? 'w-16' : 'w-60'} flex-shrink-0 z-30 border-r border-white/10`}
    >
      {/* Brand Header */}
      <div className="p-4 border-b border-white/10 flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/10 border border-emerald-500/30 p-1 flex items-center justify-center flex-shrink-0 overflow-hidden shadow-inner">
          <img src={logo} alt="ARKA Logo" className="w-full h-full object-contain drop-shadow-sm" />
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <h1 className="font-extrabold text-base leading-tight tracking-tight text-white truncate">
              ARKA Finance
            </h1>
            <p className="text-[10px] text-emerald-400 font-semibold truncate">PT Aksara Riksa Perdana</p>
          </div>
        )}
      </div>

      {/* Role Badge */}
      <div className="p-3 border-b border-white/10">
        <div
          className={`flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs
            ${collapsed ? 'justify-center' : ''}`}
        >
          <span className="w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0 animate-pulse" />
          {!collapsed && (
            <span className="font-semibold text-emerald-300 capitalize truncate">
              {role === 'owner' ? '👑 Owner' : '💼 Admin Keuangan'}
            </span>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-2 space-y-1 overflow-y-auto scrollbar-thin">
        {filtered.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 ${
                isActive
                  ? 'bg-emerald-500/20 text-emerald-400 font-semibold border border-emerald-500/30 shadow-sm'
                  : 'text-white/60 hover:bg-white/10 hover:text-white'
              } ${collapsed ? 'justify-center' : ''}`
            }
            title={collapsed ? item.label : undefined}
          >
            {item.icon}
            {!collapsed && <span className="text-sm font-medium">{item.label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* Cloud Sync Status Indicator */}
      {!collapsed && (
        <div className="px-3 py-1.5 mx-3 mb-2 bg-white/5 rounded-xl border border-white/10 flex items-center gap-2 text-[11px]">
          <span className={`w-2 h-2 rounded-full ${isSupabaseConfigured ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
          <span className="text-white/80 font-medium">
            {isSupabaseConfigured ? 'Cloud Sync Active' : 'Mode Lokal'}
          </span>
        </div>
      )}

      {/* Bottom: guide + collapse toggle + logout */}
      <div className="px-2 py-3 border-t border-white/10 space-y-1">
        <button
          onClick={() => setGuideOpen(true)}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl
            text-emerald-300 hover:bg-white/10 transition-all duration-200
            ${collapsed ? 'justify-center' : ''}`}
          title="Buku Panduan Penggunaan"
        >
          <BookOpen size={20} />
          {!collapsed && <span className="text-sm font-medium">Buku Panduan</span>}
        </button>
        <button
          onClick={logout}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl
            text-white/60 hover:bg-red-500/20 hover:text-red-300 transition-all duration-200
            ${collapsed ? 'justify-center' : ''}`}
          title="Keluar"
        >
          <LogOut size={20} />
          {!collapsed && <span className="text-sm font-medium">Keluar</span>}
        </button>
        <button
          onClick={() => setCollapsed(c => !c)}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl
            text-white/40 hover:bg-white/10 hover:text-white transition-all duration-200
            ${collapsed ? 'justify-center' : 'justify-end'}`}
        >
          {collapsed ? <ChevronRight size={18} /> : <><span className="text-xs">Sembunyikan</span><ChevronLeft size={18} /></>}
        </button>
      </div>

      <UserGuideModal isOpen={guideOpen} onClose={() => setGuideOpen(false)} />
    </aside>
  );
}
