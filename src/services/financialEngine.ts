// ============================================================
// ARKA Finance — Core Financial Engine (Single Source of Truth)
// Domain-Driven Accounting & Net-Zero Balancing Architecture
// ============================================================

import { type Transaction, type Project } from '../types';

/**
 * Grup 1: Modal Eksternal Murni (Menambah Kas Utama / Likuiditas Total)
 * DILARANG KERAS memasukkan Alokasi / Mutasi Internal ke sini!
 */
export const EXTERNAL_CAPITAL_CATEGORIES_SET = new Set<string>([
  'Drop Dana Kas Utama / Holding',
  'Setoran Modal Owner / Direksi',
  'Saldo Awal',
  'Modal Awal',
]);

/**
 * Grup 2: Transfer Internal / Alokasi (Mengurangi Kas Utama -> Menambah Kas Proyek)
 * Termasuk Alokasi Modal Kantor yang WAJIB memotong Kas Utama!
 */
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
 * Memisahkan suntikan eksternal (Modal Angkur 20M) dengan transfer internal (Alokasi Kantor 4,45M).
 */
export function classifyTransaction(t: Transaction, projects: Project[] = []): TransactionClassification {
  const approved = isApproved(t);
  const categoryNormalized = (t.kategori || '').trim();
  const descNormalized = (t.deskripsi || '').toLowerCase().trim();

  // Smart Routing: Mencegah error jika proyek_id di database kosong tapi nama proyek ada di deskripsi
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

  // 1. External Capital Check (Menambah likuiditas perusahaan)
  // Khusus 'modal angkur' (20M) dikunci eksternal agar tidak memotong Kas Utama.
  // PENTING: Jangan masukkan kata 'alokasi' ke sini agar Baris 19 tidak salah kamar!
  const isExternalCapital =
    EXTERNAL_CAPITAL_CATEGORIES_SET.has(categoryNormalized) ||
    descNormalized.includes('modal angkur') ||
    descNormalized.includes('setoran modal') ||
    descNormalized.includes('drop dana') ||
    descNormalized.includes('saldo awal') ||
    descNormalized.includes('tambah modal') ||
    descNormalized.includes('mutasi kas masuk') ||
    descNormalized.includes('pengajuan budget');

  // 2. Internal Transfer (Kas Utama -> Kas Proyek)
  // Termasuk Baris 19 ('Alokasi Modal Proyek: Kebutuhan Kantor') yang WAJIB memotong Kas Utama!
  const isInternalTransfer =
    !isExternalCapital &&
    hasProject &&
    (INTERNAL_TRANSFER_CATEGORIES_SET.has(categoryNormalized) ||
      descNormalized.includes('alokasi') ||
      descNormalized.includes('transfer modal') ||
      descNormalized.includes('untuk bayar kates'));

  // 3. Refund to Kas Utama (Proyek mengembalikan sisa dana ke Kas Utama)
  const isRefundToKasUtama =
    hasProject &&
    (REFUND_TO_KAS_UTAMA_CATEGORIES_SET.has(categoryNormalized) ||
      (t.jenis === 'keluar' && descNormalized.includes('refund')));

  // 4. Vendor Refund (Supplier mengembalikan uang belanja ke proyek)
  const isVendorRefund =
    categoryNormalized === 'Pengembalian Dana (Refund)' ||
    (t.jenis === 'masuk' && descNormalized.includes('refund') && !isInternalTransfer && !isRefundToKasUtama);

  // 5. Admin Bank Fee Check (Selalu memotong Kas Utama)
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
        // Modal eksternal masuk murni ke Kas Utama (Baris 20 & Drop Dana 6M)
        sisaKasUtama += t.nominal;
      }
      // Jika modal eksternal punya target Proyek (Modal Angkur 20M), langsung ke Seksi B tanpa memotong Kas Utama!
    } else if (classification.isCapitalInjectionToProject) {
      // Transfer Internal (Baris 19 Alokasi Kantor 4.456.000) -> WAJIB MEMOTONG Kas Utama!
      sisaKasUtama -= t.nominal;
    } else if (classification.isRefundToKasUtama) {
      sisaKasUtama += t.nominal;
    } else if (classification.isAdminFee) {
      sisaKasUtama -= t.nominal;
    } else if (!targetProjId) {
      if (t.jenis === 'masuk') {
        sisaKasUtama += t.nominal;
      } else {
        sisaKasUtama -= t.nominal;
      }
    }

    // ---- B. KAS PROYEK BALANCING ----
    if (targetProjId && !classification.isAdminFee) {
      if (projectCashMap[targetProjId] === undefined) projectCashMap[targetProjId] = 0;

      if (classification.isExternalCapital || classification.isCapitalInjectionToProject || classification.isVendorRefund) {
        // Uang masuk ke proyek (baik dari eksternal Angkur 20M maupun transfer internal Kantor 4,45M)
        projectCashMap[targetProjId] += t.nominal;
      } else if (classification.isRefundToKasUtama) {
        projectCashMap[targetProjId] -= t.nominal;
      } else {
        // Belanja operasional proyek riil
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