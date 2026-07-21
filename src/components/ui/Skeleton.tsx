// ============================================================
// ARKA Finance — Premium Smooth Skeleton Loaders
// Ultra-smooth shimmer wave effect (No harsh blinking/flickering)
// ============================================================

import React from 'react';

interface SkeletonProps {
  className?: string;
  width?: string;
  height?: string;
  circle?: boolean;
}

export function Skeleton({ className = '', width, height, circle = false }: SkeletonProps) {
  return (
    <div
      className={`skeleton-shimmer ${circle ? 'rounded-full' : 'rounded-2xl'} ${className}`}
      style={{
        width: width ?? undefined,
        height: height ?? undefined,
      }}
    />
  );
}

// Layout Skeleton for Dashboards (Admin & Owner)
export function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top Banner / Card Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="p-5 bg-white border border-gray-100 rounded-3xl space-y-3 shadow-card">
            <div className="flex items-center justify-between">
              <Skeleton className="w-24 h-4 rounded-lg" />
              <Skeleton circle className="w-10 h-10" />
            </div>
            <Skeleton className="w-36 h-8 rounded-xl" />
            <Skeleton className="w-20 h-3 rounded-md" />
          </div>
        ))}
      </div>

      {/* Main Content Card + Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 p-6 bg-white border border-gray-100 rounded-3xl space-y-4 shadow-card">
          <div className="flex items-center justify-between">
            <Skeleton className="w-40 h-6 rounded-xl" />
            <Skeleton className="w-28 h-8 rounded-xl" />
          </div>
          <Skeleton className="w-full h-64 rounded-2xl" />
        </div>

        <div className="p-6 bg-white border border-gray-100 rounded-3xl space-y-4 shadow-card">
          <Skeleton className="w-32 h-6 rounded-xl" />
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Skeleton circle className="w-9 h-9" />
                  <div className="space-y-1.5">
                    <Skeleton className="w-24 h-3.5 rounded-md" />
                    <Skeleton className="w-16 h-2.5 rounded-sm" />
                  </div>
                </div>
                <Skeleton className="w-16 h-4 rounded-md" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// Layout Skeleton for Transaction List Pages
export function TransactionListSkeleton() {
  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between p-4 bg-white border border-gray-100 rounded-3xl shadow-card">
        <Skeleton className="w-48 h-8 rounded-2xl" />
        <Skeleton className="w-32 h-9 rounded-2xl" />
      </div>
      <div className="p-5 bg-white border border-gray-100 rounded-3xl space-y-4 shadow-card">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-center justify-between p-3.5 bg-slate-50/60 rounded-2xl">
            <div className="flex items-center gap-3 min-w-0">
              <Skeleton circle className="w-10 h-10 flex-shrink-0" />
              <div className="space-y-2">
                <Skeleton className="w-48 h-4 rounded-md" />
                <Skeleton className="w-28 h-3 rounded-sm" />
              </div>
            </div>
            <Skeleton className="w-24 h-6 rounded-xl" />
          </div>
        ))}
      </div>
    </div>
  );
}

// Layout Skeleton for Projects Page & Project Detail Page
export function ProjectsSkeleton() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between p-5 bg-white border border-gray-100 rounded-3xl shadow-card">
        <div className="space-y-2">
          <Skeleton className="w-44 h-7 rounded-xl" />
          <Skeleton className="w-64 h-3 rounded-md" />
        </div>
        <Skeleton className="w-36 h-9 rounded-2xl" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-5">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="p-5 bg-white border border-gray-100 rounded-3xl space-y-4 shadow-card">
            <div className="flex items-center justify-between">
              <Skeleton className="w-40 h-5 rounded-lg" />
              <Skeleton className="w-16 h-5 rounded-full" />
            </div>
            <Skeleton className="w-28 h-3.5 rounded-md" />
            <div className="space-y-2 pt-2">
              <div className="flex justify-between">
                <Skeleton className="w-20 h-3 rounded-sm" />
                <Skeleton className="w-24 h-4 rounded-md" />
              </div>
              <Skeleton className="w-full h-3 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Layout Skeleton for Reports Page
export function ReportsSkeleton() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between p-5 bg-white border border-gray-100 rounded-3xl shadow-card">
        <div className="space-y-2">
          <Skeleton className="w-48 h-7 rounded-xl" />
          <Skeleton className="w-64 h-3 rounded-md" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="w-28 h-9 rounded-2xl" />
          <Skeleton className="w-32 h-9 rounded-2xl" />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="p-5 bg-white border border-gray-100 rounded-3xl space-y-3 shadow-card">
            <Skeleton className="w-28 h-3.5 rounded-md" />
            <Skeleton className="w-36 h-7 rounded-xl" />
            <Skeleton className="w-24 h-3 rounded-sm" />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="p-6 bg-white border border-gray-100 rounded-3xl space-y-4 shadow-card">
          <Skeleton className="w-44 h-6 rounded-xl" />
          <Skeleton className="w-full h-64 rounded-2xl" />
        </div>
        <div className="p-6 bg-white border border-gray-100 rounded-3xl space-y-4 shadow-card">
          <Skeleton className="w-44 h-6 rounded-xl" />
          <Skeleton className="w-full h-64 rounded-2xl" />
        </div>
      </div>
    </div>
  );
}
