// ============================================================
// ARKA Finance — Main Layout
// ============================================================

import React, { type ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { ToastContainer } from '../ui/Toast';

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  return (
    <div className="flex h-screen overflow-hidden bg-[#F9FAFB]">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="min-h-full p-6">
          {children}
        </div>
      </main>
      <ToastContainer />
    </div>
  );
}
