// ============================================================
// ARKA Finance — Core Financial Engine (Single Source of Truth)
// Domain-Driven Accounting & Net-Zero Balancing Architecture
// ============================================================

import { type Transaction, type Project } from '../types';

/**
 * Exact Set of Normalized Categories representing Internal Mutasi & Capital Transfers.
 * Fully eliminates fragile fuzzy string matching (.includes('mutasi')).
 */
export const MUTASI_INTERNAL_CATEGORIES_SET = new Set<string>([
  'Mutasi Internal / Transfer Kas',
  'Alokasi Modal Operasional Proyek',
  'Suntikan Modal Proyek',
  'Drop Dana Kas Utama / Holding',
  'Refund Sisa Dana Proyek ke Kas Utama',
  'Setoran Modal Owner / Direksi',
  'Saldo Awal',
]);

export interface TransactionClassification {
  isApproved: boolean;
  isMutasiInternal: boolean;
  isKasUtamaTransaction: boolean;
  isKasUtamaInflow: boolean;
  isKasUtamaOutflow: boolean;
  isCapitalInjectionToProject: boolean;
  isRefundToKasUtama: boolean;
  isVendorRefund: boolean;
  isAdminFee: boolean;
}

export interface UnifiedCompanyLedger {
  sisaKasUtama: number;      // Saldo Murni Kas Utama (Rekening Pusat)
  totalKasProyek: number;    // Total Saldo Kas di Seluruh Pool Proyek
  sisaKasTotal: number;      // Likuiditas Konsolidasi (Net-Zero Balanced)
  projectCashMap: Record<string, number>; // Saldo Kas per Proyek
}

/** Check if a transaction status is approved/completed */
export function isApproved(t: Transaction): boolean {
  return t.status === 'disetujui' || t.status === 'selesai';
}

/**
 * Single Source of Truth for Transaction Classification.
 * Combines Exact Category Registry with Structural Property Matching.
 */
export function classifyTransaction(t: Transaction): TransactionClassification {
  const approved = isApproved(t);
  const categoryNormalized = (t.kategori || '').trim();
  const descNormalized = (t.deskripsi || '').toLowerCase().trim();

  // 1. Mutasi Internal Category Check
  const isMutasiCategory =
    MUTASI_INTERNAL_CATEGORIES_SET.has(categoryNormalized) ||
    descNormalized.startsWith('alokasi modal proyek:') ||
    descNormalized.startsWith('suntikan modal proyek:');

  // 2. Refund to Kas Utama (Project returning unspent cash to Main Company Cash)
  const isRefundToKasUtama =
    categoryNormalized === 'Refund Sisa Dana Proyek ke Kas Utama' ||
    categoryNormalized === 'Refund Dana Proyek ke Kas Utama' ||
    (t.jenis === 'keluar' && isMutasiCategory && descNormalized.includes('refund'));

  // 3. Vendor Refund (Supplier returning overpaid cash to Project/Office)
  const isVendorRefund =
    categoryNormalized === 'Pengembalian Dana (Refund)' ||
    (t.jenis === 'masuk' && descNormalized.includes('refund') && !isMutasiCategory);

  // 4. Capital Injection into Project
  const isCapitalInjectionToProject =
    Boolean(t.proyekId) &&
    (t.jenis === 'masuk' || descNormalized.startsWith('alokasi modal proyek:') || descNormalized.startsWith('suntikan modal proyek:')) &&
    (isMutasiCategory || categoryNormalized === 'Alokasi Modal Operasional Proyek');

  // 5. Kas Utama Direct Transaction (No Project Bound)
  const isKasUtamaTransaction = !t.proyekId;

  // 6. Admin Bank Fee Check
  const isAdminFee =
    categoryNormalized === 'Biaya Admin Bank' ||
    Boolean(t.parentTransactionId) ||
    descNormalized.includes('biaya admin bank');

  // 7. General Mutasi Flag
  const isMutasiInternal = isMutasiCategory || isCapitalInjectionToProject || isRefundToKasUtama;

  const isKasUtamaInflow = approved && isKasUtamaTransaction && t.jenis === 'masuk' && !isMutasiInternal;
  const isKasUtamaOutflow = approved && isKasUtamaTransaction && t.jenis === 'keluar' && !isMutasiInternal;

  return {
    isApproved: approved,
    isMutasiInternal,
    isKasUtamaTransaction,
    isKasUtamaInflow,
    isKasUtamaOutflow,
    isCapitalInjectionToProject,
    isRefundToKasUtama,
    isVendorRefund,
    isAdminFee,
  };
}

/**
 * Core Financial Engine: Calculates Consolidated Company Ledger with Net-Zero Balancing.
 * Guarantees zero double-counting across Kas Utama and Kas Proyek.
 */
export function calculateCompanyLedger(
  transactions: Transaction[],
  projects: Project[] = []
): UnifiedCompanyLedger {
  let sisaKasUtama = 0;
  const projectCashMap: Record<string, number> = {};

  // Initialize project cash map with project anggaran if no explicit capital injection transaction exists
  for (const p of projects) {
    if (p.anggaran && p.anggaran > 0) {
      const hasExplicit = transactions.some(
        t => isApproved(t) && t.proyekId === p.id && classifyTransaction(t).isCapitalInjectionToProject
      );
      if (!hasExplicit) {
        projectCashMap[p.id] = p.anggaran;
      }
    }
  }

  for (const t of transactions) {
    if (!isApproved(t)) continue;

    const classification = classifyTransaction(t);

    // ---- A. KAS UTAMA BALANCING ----
    if (!t.proyekId || classification.isAdminFee) {
      // Direct Main Cash Transaction OR Bank Admin Fee (Always deducted purely from Kas Utama)
      if (t.jenis === 'masuk' && !classification.isAdminFee) {
        sisaKasUtama += t.nominal;
      } else {
        sisaKasUtama -= t.nominal;
      }
    } else {
      // Project-Bound Transaction affecting Kas Utama
      if (classification.isCapitalInjectionToProject) {
        // Outflow from Kas Utama to Kas Proyek
        sisaKasUtama -= t.nominal;
      } else if (classification.isRefundToKasUtama) {
        // Inflow back from Kas Proyek to Kas Utama
        sisaKasUtama += t.nominal;
      }
    }

    // ---- B. KAS PROYEK BALANCING ----
    if (t.proyekId && !classification.isAdminFee) {
      if (!projectCashMap[t.proyekId]) projectCashMap[t.proyekId] = 0;

      if (classification.isCapitalInjectionToProject || classification.isVendorRefund) {
        // Cash added into Project Pool
        projectCashMap[t.proyekId] += t.nominal;
      } else if (classification.isRefundToKasUtama) {
        // Cash returned from Project Pool to Kas Utama
        projectCashMap[t.proyekId] -= t.nominal;
      } else {
        // Regular Project Expense / Revenue
        if (t.jenis === 'masuk') {
          projectCashMap[t.proyekId] += t.nominal;
        } else {
          projectCashMap[t.proyekId] -= t.nominal;
        }
      }
    }
  }

  let totalKasProyek = 0;
  for (const cash of Object.values(projectCashMap)) {
    totalKasProyek += cash;
  }

  const sisaKasTotal = sisaKasUtama + totalKasProyek;

  return {
    sisaKasUtama,
    totalKasProyek,
    sisaKasTotal,
    projectCashMap,
  };
}
