// ============================================================
// ARKA Finance — Core Financial Engine (Single Source of Truth)
// Domain-Driven Accounting & Net-Zero Balancing Architecture
// ============================================================

import { type Transaction, type Project } from '../types';

export const EXTERNAL_CAPITAL_CATEGORIES_SET = new Set<string>([
  'Drop Dana Kas Utama / Holding',
  'Setoran Modal Owner / Direksi',
  'Saldo Awal',
  'Modal Awal',
  'Alokasi Modal Operasional Proyek',
  'Suntikan Modal Proyek',
]);

export const INTERNAL_TRANSFER_CATEGORIES_SET = new Set<string>([
  'Mutasi Internal / Transfer Kas',
]);

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
  resolvedProjectId?: string;
}

export interface UnifiedCompanyLedger {
  sisaKasUtama: number;      // Saldo Murni Kas Utama (Rekening Pusat)
  totalKasProyek: number;    // Total Saldo Kas di Seluruh Pool Proyek
  sisaKasTotal: number;      // Likuiditas Konsolidasi (Net-Zero Balanced)
  projectCashMap: Record<string, number>; // Saldo Kas per Proyek
}

export function isApproved(t: Transaction): boolean {
  return t.status === 'disetujui' || t.status === 'selesai';
}

/**
 * Single Source of Truth for Transaction Classification.
 * Guarantees External Capital Injections (like modal angkur 20M) never deduct from Kas Utama!
 */
export function classifyTransaction(t: Transaction, projects: Project[] = []): TransactionClassification {
  const approved = isApproved(t);
  const categoryNormalized = (t.kategori || '').trim();
  const descNormalized = (t.deskripsi || '').toLowerCase().trim();

  // Smart Routing: Resolve missing project binding from explicit names in description
  let resolvedProjectId = t.proyekId;
  if (!resolvedProjectId && projects.length > 0) {
    for (const p of projects) {
      const projName = p.nama.toLowerCase().trim();
      if (projName && (descNormalized.includes(projName) || (projName.includes('angkur') && descNormalized.includes('angkur')))) {
        resolvedProjectId = p.id;
        break;
      }
    }
  }

  const hasProject = Boolean(resolvedProjectId);

  // 1. External Capital Check (ALWAYS adds to total liquidity, NEVER subtracts from Kas Utama!)
  // Any keyword representing capital injection from owner/holding is locked as external capital.
  const isExternalCapital =
    EXTERNAL_CAPITAL_CATEGORIES_SET.has(categoryNormalized) ||
    descNormalized.includes('modal') ||
    descNormalized.includes('drop') ||
    descNormalized.includes('setoran') ||
    descNormalized.includes('saldo awal') ||
    descNormalized.includes('suntikan') ||
    descNormalized.includes('alokasi') ||
    descNormalized.includes('tambah');

  // 2. Internal Transfer (Kas Utama -> Kas Proyek)
  // MUST NOT be external capital! Only true internal movements between existing pools.
  const isInternalTransfer =
    !isExternalCapital &&
    hasProject &&
    (t.jenis === 'masuk' && INTERNAL_TRANSFER_CATEGORIES_SET.has(categoryNormalized)) &&
    categoryNormalized !== 'Pengembalian Dana (Refund)' &&
    !descNormalized.includes('refund');

  // 3. Refund to Kas Utama (Project returning unspent cash to Kas Utama)
  const isRefundToKasUtama =
    hasProject &&
    (REFUND_TO_KAS_UTAMA_CATEGORIES_SET.has(categoryNormalized) ||
      (t.jenis === 'keluar' && descNormalized.includes('refund')));

  // 4. Vendor Refund (Supplier returning overpaid money)
  const isVendorRefund =
    categoryNormalized === 'Pengembalian Dana (Refund)' ||
    (t.jenis === 'masuk' && descNormalized.includes('refund') && !isInternalTransfer && !isRefundToKasUtama);

  // 5. Admin Bank Fee Check
  const isAdminFee =
    categoryNormalized === 'Biaya Admin Bank' ||
    Boolean(t.parentTransactionId) ||
    descNormalized.includes('biaya admin bank');

  // 6. Direct Kas Utama Transaction
  const isKasUtamaTransaction = !hasProject || isExternalCapital || isRefundToKasUtama || isAdminFee;
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
    resolvedProjectId,
  };
}

/**
 * Core Financial Engine: Calculates Consolidated Company Ledger with Clean Double-Entry Routing.
 */
export function calculateCompanyLedger(
  transactions: Transaction[],
  projects: Project[] = []
): UnifiedCompanyLedger {
  let sisaKasUtama = 0;
  const projectCashMap: Record<string, number> = {};

  for (const p of projects) {
    projectCashMap[p.id] = 0;
  }

  for (const t of transactions) {
    if (!isApproved(t)) continue;

    const classification = classifyTransaction(t, projects);
    const targetProjId = classification.resolvedProjectId;

    // ---- A. KAS UTAMA BALANCING ----
    if (classification.isExternalCapital) {
      if (!targetProjId) {
        // External Capital dropped directly into Kas Utama standby
        sisaKasUtama += t.nominal;
      }
      // If external capital has targetProjId, it routes directly into Project Pool in Section B without deducting Kas Utama!
    } else if (classification.isCapitalInjectionToProject) {
      // Internal Transfer (Kas Utama -> Kas Proyek) -> DEDUCTS from Kas Utama
      sisaKasUtama -= t.nominal;
    } else if (classification.isRefundToKasUtama) {
      // Refund from Project back to Kas Utama -> ADDS to Kas Utama
      sisaKasUtama += t.nominal;
    } else if (classification.isAdminFee) {
      // Admin Bank Fee -> ALWAYS DEDUCTS from Kas Utama
      sisaKasUtama -= t.nominal;
    } else if (!targetProjId) {
      // Regular Kas Utama Revenue / Expense
      if (t.jenis === 'masuk') {
        sisaKasUtama += t.nominal;
      } else {
        sisaKasUtama -= t.nominal;
      }
    }

    // ---- B. KAS PROYEK BALANCING ----
    if (targetProjId && !classification.isAdminFee) {
      if (projectCashMap[targetProjId] === undefined) projectCashMap[targetProjId] = 0;

      if (classification.isExternalCapital) {
        // External Capital dropped directly for Project -> ADDS to Kas Proyek
        projectCashMap[targetProjId] += t.nominal;
      } else if (classification.isCapitalInjectionToProject || classification.isVendorRefund) {
        // Internal Transfer / Refund into Project Pool -> ADDS to Kas Proyek
        projectCashMap[targetProjId] += t.nominal;
      } else if (classification.isRefundToKasUtama) {
        // Money returned from Project back to Kas Utama -> DEDUCTS from Kas Proyek
        projectCashMap[targetProjId] -= t.nominal;
      } else {
        // Regular Project Revenue / Expense
        if (t.jenis === 'masuk') {
          projectCashMap[targetProjId] += t.nominal;
        } else {
          projectCashMap[targetProjId] -= t.nominal;
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