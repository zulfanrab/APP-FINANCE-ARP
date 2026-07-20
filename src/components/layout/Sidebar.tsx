// ============================================================
// ARKA Finance — Sidebar Navigation (Desktop)
// ============================================================

import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  ArrowLeftRight,
  FolderKanban,
  BarChart3,
  LogOut,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import logo from '../../assets/logo.png';
import { useAuth } from '../../context/AuthContext';

interface NavItem {
  to: string;
  icon: React.ReactNode;
  label: string;
  roles?: string[];
}

const navItems: NavItem[] = [
  { to: '/dashboard', icon: <LayoutDashboard size={20} />, label: 'Dashboard' },
  {
    to: '/transaksi/baru',
    icon: <ArrowLeftRight size={20} />,
    label: 'Input Transaksi',
    roles: ['admin'],
  },
  {
    to: '/proyek',
    icon: <FolderKanban size={20} />,
    label: 'Proyek',
    roles: ['admin'],
  },
  { to: '/laporan', icon: <BarChart3 size={20} />, label: 'Laporan' },
];

export function Sidebar() {
  const { role, logout } = useAuth();
  const [collapsed, setCollapsed] = useState(false);

  const filtered = navItems.filter(
    item => !item.roles || item.roles.includes(role ?? '')
  );

  return (
    <aside
      className={`hidden md:flex h-screen sticky top-0 flex-col bg-[#0F172A] text-white transition-all duration-300
        ${collapsed ? 'w-16' : 'w-60'} flex-shrink-0 z-30 border-r border-white/10`}
    >
      {/* Logo */}
      <div className={`flex items-center gap-3 px-4 py-5 border-b border-white/10 ${collapsed ? 'justify-center' : ''}`}>
        <div className="w-9 h-9 rounded-xl bg-white flex items-center justify-center flex-shrink-0 overflow-hidden p-0.5 shadow-sm">
          <img src={logo} alt="ARKA Logo" className="w-full h-full object-contain" />
        </div>
        {!collapsed && (
          <div>
            <p className="font-bold text-lg leading-none tracking-tight">ARKA</p>
            <p className="text-xs text-emerald-400 font-medium leading-none mt-0.5">Finance</p>
          </div>
        )}
      </div>

      {/* Role Badge */}
      {!collapsed && (
        <div className="px-4 py-3">
          <div className="bg-white/5 border border-white/10 rounded-xl px-3 py-2">
            <p className="text-[10px] text-white/50 uppercase tracking-wider font-medium">Masuk sebagai</p>
            <p className="text-sm font-semibold capitalize text-emerald-300">
              {role === 'owner' ? '👑 Owner' : '💼 Admin Keuangan'}
            </p>
          </div>
        </div>
      )}

      {/* Nav Items */}
      <nav className="flex-1 px-2 py-3 space-y-1 overflow-y-auto">
        {filtered.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200
              ${isActive
                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30'
                : 'text-white/60 hover:bg-white/10 hover:text-white'
              }
              ${collapsed ? 'justify-center' : ''}`
            }
            title={collapsed ? item.label : undefined}
          >
            {item.icon}
            {!collapsed && <span className="text-sm font-medium">{item.label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* Bottom: collapse toggle + logout */}
      <div className="px-2 py-3 border-t border-white/10 space-y-1">
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
    </aside>
  );
}
