// ============================================================
// ARKA Finance — Modal Component (Portal-based Fullscreen Backdrop)
// ============================================================

import React, { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showClose?: boolean;
}

const sizeMap = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-2xl',
};

export function Modal({
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
  showClose = true,
}: ModalProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 overflow-x-hidden overflow-y-auto">
      {/* Fullscreen Backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/75 backdrop-blur-md animate-fade-in"
        onClick={onClose}
      />
      {/* Modal Card */}
      <div
        className={`relative bg-white rounded-3xl border border-gray-100 shadow-2xl w-full ${sizeMap[size]} animate-scale-up overflow-hidden max-h-[90vh] flex flex-col z-10`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-gray-100 bg-gray-50/60 flex-shrink-0">
          <h3 className="text-base font-bold text-gray-900 tracking-tight">{title}</h3>
          {showClose && (
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-xl bg-gray-100 hover:bg-red-50 text-gray-400 hover:text-red-500 transition-all active:scale-95"
            >
              <X size={18} />
            </button>
          )}
        </div>
        {/* Content Body */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1">{children}</div>
      </div>
    </div>,
    document.body
  );
}
