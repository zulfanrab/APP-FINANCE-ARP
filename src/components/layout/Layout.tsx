// ============================================================
// ARKA Finance — Main Layout (Responsive Native App UI)
// ============================================================

import React, { type ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { MobileHeader } from './MobileHeader';
import { MobileBottomNav } from './MobileBottomNav';
import { ToastContainer } from '../ui/Toast';

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  return (
    <div className="flex flex-col md:flex-row min-h-screen md:h-screen md:overflow-hidden bg-gray-50 text-gray-900 font-sans">
      {/* Desktop Sidebar */}
      <Sidebar />

      {/* Mobile Top Header */}
      <MobileHeader />

      {/* Main Content Area */}
      <main className="flex-1 h-full overflow-y-auto min-w-0 scrollbar-thin">
        <div className="p-4 sm:p-6 pb-28 md:pb-8 max-w-7xl mx-auto">
          {children}
        </div>
      </main>

      {/* Mobile Bottom Navigation Bar */}
      <MobileBottomNav />

      {/* Toast Notifications */}
      <ToastContainer />
    </div>
  );
}
