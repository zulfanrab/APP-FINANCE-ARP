// ============================================================
// ARKA Finance — Core TypeScript Types
// ============================================================

export type TransactionType = 'masuk' | 'keluar';
export type TransactionTag = 'operasional' | 'pribadi';
export type JalurTransfer = 'sesama_bca' | 'ewallet' | 'bi_fast' | 'online_rtgs' | 'custom';
export type TransactionStatus =
  | 'menunggu_approval'
  | 'disetujui'
  | 'ditolak'
  | 'selesai';

export interface Attachment {
  nama: string;
  tipe: string;
  dataUrl: string;
}

export interface Transaction {
  id: string;
  tanggal: string; // ISO date string
  jenis: TransactionType;
  deskripsi: string;
  nominal: number;
  kategori: string;
  tag?: TransactionTag; // hanya untuk jenis 'keluar'
  proyekId?: string;
  lampiran: Attachment[];
  status: TransactionStatus;
  buktiTransfer?: string; // base64 image
  catatanPenolakan?: string;
  penerimaDetail?: string; // "[Nama Penerima] - [Nama Bank] [Nomor Rekening]"
  jalurTransfer?: JalurTransfer; // 'sesama_bca' | 'ewallet' | 'bi_fast' | 'online_rtgs' | 'custom'
  adminNominalCustom?: number; // Nominal admin custom untuk pilihan 'custom'
  parentTransactionId?: string; // FK ke transaksi utama (untuk entri biaya admin bank)
  dibuatPada: string; // ISO datetime
  diupdatePada: string; // ISO datetime
}

export interface Project {
  id: string;
  nama: string;
  klien: string;
  anggaran?: number; // Modal/Anggaran dari Owner (Pak Fatwa)
  tanggalMulai: string;
  tanggalSelesai?: string;
  status: 'aktif' | 'selesai';
  deskripsi?: string;
  dibuatPada: string;
  diupdatePada: string;
}

export type UserRole = 'owner' | 'admin';

export interface Session {
  role: UserRole;
  loginAt: string;
}

export interface DashboardSummary {
  sisaKas: number;
  totalPemasukanBulanIni: number;
  totalPengeluaranOperasionalBulanIni: number;
  totalPribadiOwnerBulanIni: number;
  proyekAktif: number;
}

export interface MonthlyChartData {
  bulan: string;
  pemasukan: number;
  pengeluaran: number;
}

export interface CategoryBreakdown {
  kategori: string;
  nominal: number;
  percentage: number;
}

export interface CashflowTrend {
  tanggal: string;
  kasKumulatif: number;
  pemasukan: number;
  pengeluaran: number;
}

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  message: string;
}

export interface FilterOptions {
  tag?: TransactionTag | 'semua';
  status?: TransactionStatus | 'semua';
  tanggalDari?: string;
  tanggalSampai?: string;
  proyekId?: string;
  jenis?: TransactionType | 'semua';
}
