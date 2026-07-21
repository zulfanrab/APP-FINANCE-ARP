// ============================================================
// ARKA Finance — Luxury Mobile App Bottom Navigation Bar
// Symmetrical 5-Column Grid Layout with Prominent QRIS-style FAB
// ============================================================

import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  ArrowLeftRight,
  Plus,
  FolderKanban,
  BarChart3,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export function MobileBottomNav() {
  const { role } = useAuth();

  const navItems = [
    { to: '/dashboard', icon: <LayoutDashboard size={20} />, label: 'Dashboard' },
    { to: '/transaksi', icon: <ArrowLeftRight size={20} />, label: 'Transaksi' },
    ...(role === 'admin'
      ? [
          {
            to: '/transaksi/baru',
            icon: <Plus size={26} strokeWidth={2.5} />,
            label: 'Input',
            isPrimary: true,
          },
        ]
      : []),
    { to: '/proyek', icon: <FolderKanban size={20} />, label: 'Proyek' },
    { to: '/laporan', icon: <BarChart3 size={20} />, label: 'Laporan' },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#0F172A]/95 backdrop-blur-xl border-t border-white/10 px-2 py-1.5 pb-[calc(0.4rem+env(safe-area-inset-bottom))] shadow-2xl">
      <div className={`grid ${navItems.length === 5 ? 'grid-cols-5' : 'grid-cols-4'} items-center justify-items-center max-w-md mx-auto w-full`}>
        {navItems.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center w-full py-1 rounded-2xl transition-all duration-200 active:scale-95 ${
                item.isPrimary
                  ? 'text-white'
                  : isActive
                  ? 'text-emerald-400 font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`
            }
          >
            {({ isActive }) => (
              <>
                {item.isPrimary ? (
                  <div className="w-13 h-13 -mt-6 rounded-full bg-gradient-to-tr from-emerald-600 via-emerald-500 to-teal-400 text-white flex items-center justify-center shadow-lg shadow-emerald-500/40 border-[3.5px] border-[#0F172A] transition-transform active:scale-90">
                    {item.icon}
                  </div>
                ) : (
                  <div className={`p-1.5 rounded-xl transition-all ${isActive ? 'bg-emerald-500/15 text-emerald-400 scale-110' : ''}`}>
                    {item.icon}
                  </div>
                )}
                <span className={`text-[10px] mt-0.5 tracking-tight ${isActive ? 'font-bold text-emerald-400' : 'font-medium text-slate-400'}`}>
                  {item.label}
                </span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
