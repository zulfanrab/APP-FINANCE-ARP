// ============================================================
// ARKA Finance — Toast Component
// ============================================================

import React, { useEffect, useState } from 'react';
import { CheckCircle, XCircle, Info, AlertTriangle, X } from 'lucide-react';
import { type ToastMessage } from '../../types';
import { useApp } from '../../context/AppContext';

interface ToastItemProps {
  toast: ToastMessage;
  onRemove: (id: string) => void;
}

const icons = {
  success: <CheckCircle size={18} className="text-green-500 flex-shrink-0" />,
  error: <XCircle size={18} className="text-red-500 flex-shrink-0" />,
  info: <Info size={18} className="text-blue-500 flex-shrink-0" />,
  warning: <AlertTriangle size={18} className="text-amber-500 flex-shrink-0" />,
};

const bgMap = {
  success: 'bg-green-50 border-green-200',
  error: 'bg-red-50 border-red-200',
  info: 'bg-blue-50 border-blue-200',
  warning: 'bg-amber-50 border-amber-200',
};

function ToastItem({ toast, onRemove }: ToastItemProps) {
  const [visible, setVisible] = useState(true);

  const handleRemove = () => {
    setVisible(false);
    setTimeout(() => onRemove(toast.id), 300);
  };

  return (
    <div
      className={`pointer-events-auto flex items-start gap-3 p-4 rounded-xl border shadow-xl max-w-sm w-full
        ${bgMap[toast.type]} ${visible ? 'toast-enter' : 'toast-exit'}`}
    >
      {icons[toast.type]}
      <p className="text-sm text-gray-800 flex-1 leading-snug">{toast.message}</p>
      <button
        onClick={handleRemove}
        className="text-gray-400 hover:text-gray-600 flex-shrink-0 transition-colors"
      >
        <X size={14} />
      </button>
    </div>
  );
}

export function ToastContainer() {
  const { toasts, removeToast } = useApp();

  return (
    <div className="fixed top-[calc(4.5rem+env(safe-area-inset-top))] right-4 left-4 sm:left-auto sm:right-4 z-[10000] flex flex-col items-end gap-2 pointer-events-none">
      {toasts.map(toast => (
        <ToastItem key={toast.id} toast={toast} onRemove={removeToast} />
      ))}
    </div>
  );
}
