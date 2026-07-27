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
]);

export const INTERNAL_TRANSFER_CATEGORIES_SET = new Set<string>([
  'Mutasi Internal / Transfer Kas',
  'Alokasi Modal Operasional Proyek',
  'Suntikan Modal Proyek',
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
 * Eliminates keyword conflicts and resolves missing project bindings automatically.
 */
export function classifyTransaction(t: Transaction, projects: Project[] = []): TransactionClassification {
  const approved = isApproved(t);
  const categoryNormalized = (t.kategori || '').trim();
  const descNormalized = (t.deskripsi || '').toLowerCase().trim();

  // Smart Routing: If proyekId is missing but description explicitly mentions a project name (e.g., 'modal angkur')
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

  // 1. External Capital Check (ALWAYS adds to total company liquidity)
  // NEVER blocked by hasProject!
  const isExternalCapital =
    EXTERNAL_CAPITAL_CATEGORIES_SET.has(categoryNormalized) ||
    descNormalized.startsWith('setoran modal') ||
    descNormalized.startsWith('drop dana') ||
    descNormalized.startsWith('saldo awal') ||
    descNormalized.startsWith('tambah modal');

  // 2. Internal Capital Transfer (Kas Utama -> Kas Proyek)
  // MUST NOT be external capital
  const isCapitalKeyword =
    categoryNormalized === 'Alokasi Modal Operasional Proyek' ||
    categoryNormalized === 'Suntikan Modal Proyek' ||
    categoryNormalized === 'Mutasi Internal / Transfer Kas' ||
    descNormalized.includes('modal angkur') ||
    descNormalized.includes('alokasi modal') ||
    descNormalized.includes('suntikan modal') ||
    descNormalized.includes('transfer modal');

  const isInternalTransfer =
    !isExternalCapital &&
    hasProject &&
    (isCapitalKeyword || (t.jenis === 'masuk' && INTERNAL_TRANSFER_CATEGORIES_SET.has(categoryNormalized))) &&
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

  // Initialize project pools
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
      // If external capital has targetProjId, it routes directly into Project Pool in Section B without hitting Kas Utama
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