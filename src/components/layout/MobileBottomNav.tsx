// ============================================================
// ARKA Finance — Mobile App Bottom Navigation Bar
// ============================================================

import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  PlusCircle,
  FolderKanban,
  BarChart3,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export function MobileBottomNav() {
  const { role } = useAuth();

  const navItems = [
    { to: '/dashboard', icon: <LayoutDashboard size={20} />, label: 'Dashboard' },
    ...(role === 'admin'
      ? [
          {
            to: '/transaksi/baru',
            icon: <PlusCircle size={22} />,
            label: 'Input',
            isPrimary: true,
          },
        ]
      : []),
    { to: '/proyek', icon: <FolderKanban size={20} />, label: 'Proyek' },
    { to: '/laporan', icon: <BarChart3 size={20} />, label: 'Laporan' },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#0F172A]/95 backdrop-blur-xl border-t border-white/10 px-3 py-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] shadow-2xl">
      <div className="flex items-center justify-around max-w-md mx-auto">
        {navItems.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center py-1 px-3 rounded-2xl transition-all duration-200 active:scale-95 ${
                item.isPrimary
                  ? 'text-white'
                  : isActive
                  ? 'text-emerald-400 font-semibold'
                  : 'text-gray-400 hover:text-gray-200'
              }`
            }
          >
            {({ isActive }) => (
              <>
                {item.isPrimary ? (
                  <div className="w-11 h-11 -mt-5 rounded-full bg-gradient-to-tr from-emerald-600 to-teal-400 text-white flex items-center justify-center shadow-lg shadow-emerald-500/30 border-2 border-[#0F172A]">
                    {item.icon}
                  </div>
                ) : (
                  <div className={`p-1 rounded-xl transition-all ${isActive ? 'bg-emerald-500/15 scale-110' : ''}`}>
                    {item.icon}
                  </div>
                )}
                <span className={`text-[10px] mt-0.5 tracking-tight ${isActive ? 'font-bold text-emerald-400' : 'font-medium'}`}>
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
