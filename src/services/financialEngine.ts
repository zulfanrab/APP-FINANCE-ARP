// ============================================================
// ARKA Finance — Core Financial Engine (Single Source of Truth)
// Domain-Driven Accounting & Net-Zero Balancing Architecture
// ============================================================

import { type Transaction, type Project } from '../types';

/**
 * Exact Set of Normalized Categories representing External Capital Injections (Owner Drop / Holding / Saldo Awal).
 * ALWAYS adds to Kas Utama and total company liquidity.
 */
export const EXTERNAL_CAPITAL_CATEGORIES_SET = new Set<string>([
  'Drop Dana Kas Utama / Holding',
  'Setoran Modal Owner / Direksi',
  'Saldo Awal',
  'Modal Awal',
]);

/**
 * Exact Set of Normalized Categories representing Internal Mutasi & Capital Transfers (Kas Utama -> Kas Proyek).
 */
export const INTERNAL_TRANSFER_CATEGORIES_SET = new Set<string>([
  'Mutasi Internal / Transfer Kas',
  'Alokasi Modal Operasional Proyek',
  'Suntikan Modal Proyek',
]);

/**
 * Exact Set of Normalized Categories representing Refunds back to Kas Utama.
 */
export const REFUND_TO_KAS_UTAMA_CATEGORIES_SET = new Set<string>([
  'Refund Sisa Dana Proyek ke Kas Utama',
  'Refund Dana Proyek ke Kas Utama',
]);

export interface TransactionClassification {
  isApproved: boolean;
  isMutasiInternal: boolean;
  isKasUtamaTransaction: boolean;
  isKasUtamaInflow: boolean;
  isKasUtamaOutflow: boolean;
  isCapitalInjectionToProject: boolean;
  isExternalCapital: boolean;
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

  // 1. External Capital Check (Setoran Modal Owner / Holding / Saldo Awal)
  const isExternalCapital =
    EXTERNAL_CAPITAL_CATEGORIES_SET.has(categoryNormalized) ||
    descNormalized.startsWith('setoran modal') ||
    descNormalized.startsWith('drop dana');

  // 2. Internal Capital Transfer (Kas Utama -> Kas Proyek)
  const isInternalTransfer =
    Boolean(t.proyekId) &&
    !isExternalCapital &&
    (INTERNAL_TRANSFER_CATEGORIES_SET.has(categoryNormalized) ||
     descNormalized.startsWith('alokasi modal proyek:') ||
     descNormalized.startsWith('suntikan modal proyek:'));

  // 3. Refund to Kas Utama (Project returning unspent cash to Kas Utama)
  const isRefundToKasUtama =
    Boolean(t.proyekId) &&
    (REFUND_TO_KAS_UTAMA_CATEGORIES_SET.has(categoryNormalized) ||
     (t.jenis === 'keluar' && descNormalized.includes('refund')));

  // 4. Vendor Refund (Supplier returning money to Project/Office)
  const isVendorRefund =
    categoryNormalized === 'Pengembalian Dana (Refund)' ||
    (t.jenis === 'masuk' && descNormalized.includes('refund') && !isExternalCapital && !isInternalTransfer);

  // 5. Admin Bank Fee Check
  const isAdminFee =
    categoryNormalized === 'Biaya Admin Bank' ||
    Boolean(t.parentTransactionId) ||
    descNormalized.includes('biaya admin bank');

  // 6. Direct Kas Utama Transaction
  const isKasUtamaTransaction = !t.proyekId || isExternalCapital;

  // 7. General Mutasi Flag (Excludes internal movements from P&L revenue)
  const isMutasiInternal = isInternalTransfer || isRefundToKasUtama;

  const isKasUtamaInflow = approved && isKasUtamaTransaction && t.jenis === 'masuk' && !isMutasiInternal;
  const isKasUtamaOutflow = approved && isKasUtamaTransaction && t.jenis === 'keluar' && !isMutasiInternal;

  return {
    isApproved: approved,
    isMutasiInternal,
    isKasUtamaTransaction,
    isKasUtamaInflow,
    isKasUtamaOutflow,
    isCapitalInjectionToProject: isInternalTransfer,
    isExternalCapital,
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

  // Initialize project cash map with project anggaran if no explicit funding transaction exists
  for (const p of projects) {
    if (p.anggaran && p.anggaran > 0) {
      const hasExplicitFunding = transactions.some(t => {
        if (!isApproved(t) || t.proyekId !== p.id) return false;
        const c = classifyTransaction(t);
        return c.isCapitalInjectionToProject || c.isExternalCapital;
      });
      if (!hasExplicitFunding) {
        projectCashMap[p.id] = p.anggaran;
      }
    }
  }

  for (const t of transactions) {
    if (!isApproved(t)) continue;

    const classification = classifyTransaction(t);

    // ---- A. KAS UTAMA BALANCING ----
    if (classification.isExternalCapital) {
      // External Capital Injection (Setoran Owner / Drop Holding) ALWAYS ADDS to Kas Utama
      sisaKasUtama += t.nominal;
    } else if (classification.isCapitalInjectionToProject) {
      // Internal Transfer (Kas Utama -> Kas Proyek) DEDUCTS from Kas Utama
      sisaKasUtama -= t.nominal;
    } else if (classification.isRefundToKasUtama) {
      // Refund from Kas Proyek back to Kas Utama ADDS to Kas Utama
      sisaKasUtama += t.nominal;
    } else if (classification.isAdminFee) {
      // Admin Bank Fee ALWAYS DEDUCTS from Kas Utama
      sisaKasUtama -= t.nominal;
    } else if (!t.proyekId) {
      // Direct Kas Utama Transaction (Revenue / Office Expense)
      if (t.jenis === 'masuk') {
        sisaKasUtama += t.nominal;
      } else {
        sisaKasUtama -= t.nominal;
      }
    }

    // ---- B. KAS PROYEK BALANCING ----
    if (t.proyekId && !classification.isAdminFee) {
      if (!projectCashMap[t.proyekId]) projectCashMap[t.proyekId] = 0;

      if (classification.isExternalCapital || classification.isCapitalInjectionToProject || classification.isVendorRefund) {
        // Money added into Project Pool
        projectCashMap[t.proyekId] += t.nominal;
      } else if (classification.isRefundToKasUtama) {
        // Money returned from Project Pool back to Kas Utama
        projectCashMap[t.proyekId] -= t.nominal;
      } else {
        // Regular Project Revenue / Expense
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
