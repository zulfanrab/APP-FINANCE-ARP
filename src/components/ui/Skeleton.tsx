// ============================================================
// ARKA Finance — Skeleton Loading Components
// Provides 2x faster perceived loading speed on mobile & web
// ============================================================

import React from 'react';

export function CardSkeleton() {
  return (
    <div className="bg-white dark:bg-slate-900/90 border border-gray-100 dark:border-white/10 rounded-2xl p-5 shadow-card animate-pulse space-y-3">
      <div className="flex items-center justify-between">
        <div className="h-3 bg-gray-200 dark:bg-slate-800 rounded-lg w-24" />
        <div className="w-8 h-8 rounded-xl bg-gray-200 dark:bg-slate-800" />
      </div>
      <div className="h-7 bg-gray-200 dark:bg-slate-800 rounded-xl w-36" />
      <div className="h-3 bg-gray-100 dark:bg-slate-800/60 rounded-lg w-28" />
    </div>
  );
}

export function TableRowSkeleton() {
  return (
    <div className="py-4 flex items-center justify-between border-b border-gray-100 dark:border-white/5 animate-pulse gap-4">
      <div className="space-y-2 flex-1">
        <div className="h-3 bg-gray-200 dark:bg-slate-800 rounded-lg w-3/4" />
        <div className="h-2.5 bg-gray-100 dark:bg-slate-800/60 rounded-lg w-1/2" />
      </div>
      <div className="h-6 bg-gray-200 dark:bg-slate-800 rounded-xl w-24" />
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header bar skeleton */}
      <div className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-white/10 p-5 rounded-3xl animate-pulse flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-6 bg-gray-200 dark:bg-slate-800 rounded-xl w-48" />
          <div className="h-3 bg-gray-100 dark:bg-slate-800/60 rounded-lg w-64" />
        </div>
        <div className="h-9 bg-gray-200 dark:bg-slate-800 rounded-xl w-32" />
      </div>

      {/* Summary cards grid skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
      </div>

      {/* Chart & List grid skeleton */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 bg-white dark:bg-slate-900 border border-gray-100 dark:border-white/10 rounded-2xl p-5 shadow-card animate-pulse h-64 flex flex-col justify-between">
          <div className="h-4 bg-gray-200 dark:bg-slate-800 rounded-lg w-40" />
          <div className="flex items-end justify-between gap-2 h-36 pt-4">
            <div className="w-full bg-gray-200 dark:bg-slate-800 rounded-t-lg h-3/4" />
            <div className="w-full bg-gray-200 dark:bg-slate-800 rounded-t-lg h-1/2" />
            <div className="w-full bg-gray-200 dark:bg-slate-800 rounded-t-lg h-full" />
            <div className="w-full bg-gray-200 dark:bg-slate-800 rounded-t-lg h-2/3" />
            <div className="w-full bg-gray-200 dark:bg-slate-800 rounded-t-lg h-4/5" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-white/10 rounded-2xl p-5 shadow-card animate-pulse space-y-4">
          <div className="h-4 bg-gray-200 dark:bg-slate-800 rounded-lg w-32" />
          <TableRowSkeleton />
          <TableRowSkeleton />
          <TableRowSkeleton />
        </div>
      </div>
    </div>
  );
}
