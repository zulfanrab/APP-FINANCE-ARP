// ============================================================
// ARKA Finance — Reusable UI Primitives
// Button, Card, Badge, StatusBadge, LoadingSpinner, EmptyState
// ============================================================

import React, { type ReactNode, type ButtonHTMLAttributes } from 'react';
import { type TransactionStatus } from '../../types';
import { Loader2 } from 'lucide-react';

// ---- Button ----
interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline' | 'accent';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: ReactNode;
  children?: ReactNode;
}

const variantStyles: Record<string, string> = {
  primary: 'bg-primary text-white hover:bg-primary-dark shadow-sm',
  secondary: 'bg-gray-100 text-gray-700 hover:bg-gray-200',
  danger: 'bg-red-500 text-white hover:bg-red-600 shadow-sm',
  ghost: 'text-gray-600 hover:bg-gray-100',
  outline: 'border border-primary text-primary hover:bg-primary-light',
  accent: 'bg-accent text-white hover:bg-accent-dark shadow-sm',
};

const sizeStyles: Record<string, string> = {
  sm: 'px-3 py-1.5 text-xs gap-1.5',
  md: 'px-4 py-2 text-sm gap-2',
  lg: 'px-6 py-3 text-base gap-2',
};

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  children,
  className = '',
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center font-medium rounded-xl
        transition-all duration-200 cursor-pointer select-none
        disabled:opacity-50 disabled:cursor-not-allowed
        ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <Loader2 size={size === 'sm' ? 14 : 16} className="animate-spin" /> : icon}
      {children}
    </button>
  );
}

// ---- Card ----
interface CardProps {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  hover?: boolean;
}

export function Card({ children, className = '', onClick, hover }: CardProps) {
  return (
    <div
      className={`bg-white rounded-2xl shadow-card p-6
        ${hover ? 'hover:shadow-card-hover transition-shadow cursor-pointer' : ''}
        ${className}`}
      onClick={onClick}
    >
      {children}
    </div>
  );
}

// ---- Badge ----
interface BadgeProps {
  children: ReactNode;
  variant?: 'gray' | 'green' | 'blue' | 'amber' | 'red' | 'emerald';
}

const badgeStyles: Record<string, string> = {
  gray: 'bg-gray-100 text-gray-600',
  green: 'bg-green-100 text-green-700',
  blue: 'bg-blue-100 text-blue-700',
  amber: 'bg-amber-100 text-amber-700',
  red: 'bg-red-100 text-red-700',
  emerald: 'bg-emerald-100 text-emerald-700',
};

export function Badge({ children, variant = 'gray' }: BadgeProps) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${badgeStyles[variant]}`}>
      {children}
    </span>
  );
}

// ---- Status Badge ----
const statusConfig: Record<TransactionStatus, { label: string; style: string }> = {
  menunggu_approval: { label: 'Menunggu Approval', style: 'bg-amber-100 text-amber-700' },
  disetujui: { label: 'Disetujui', style: 'bg-blue-100 text-blue-700' },
  ditolak: { label: 'Ditolak', style: 'bg-red-100 text-red-700' },
  selesai: { label: 'Selesai', style: 'bg-emerald-100 text-emerald-700' },
};

export function StatusBadge({ status }: { status: TransactionStatus }) {
  const { label, style } = statusConfig[status];
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${style}`}>
      {label}
    </span>
  );
}

// ---- LoadingSpinner ----
export function LoadingSpinner({ size = 24 }: { size?: number }) {
  return (
    <div className="flex items-center justify-center p-8">
      <Loader2 size={size} className="animate-spin text-primary" />
    </div>
  );
}

// ---- EmptyState ----
export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center text-gray-400 mb-4">
        {icon}
      </div>
      <h3 className="text-base font-semibold text-gray-700 mb-1">{title}</h3>
      {description && <p className="text-sm text-gray-400 max-w-xs">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

// ---- Currency Formatter ----
export function formatRupiah(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export { AttachmentViewer } from './AttachmentViewer';
export { Skeleton, DashboardSkeleton, TransactionListSkeleton } from './Skeleton';


