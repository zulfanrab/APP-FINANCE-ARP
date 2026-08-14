// ============================================================
// ARKA Finance — Core TypeScript Types
// ============================================================

export type TransactionType = 'masuk' | 'keluar';
export type TransactionTag = 'operasional' | 'pribadi';
export type JalurTransfer = 'sesama_bca' | 'ewallet' | 'bi_fast' | 'online_rtgs' | 'custom';
export type AccountId = 'bca_utama' | 'bri_utama' | 'kas_admin';
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
  suratPengajuanId?: string; // Tautan opsional ke ID transaksi Drop Dana / Surat Pengajuan tertentu
  lampiran: Attachment[];
  status: TransactionStatus;
  buktiTransfer?: string; // base64 image
  catatanPenolakan?: string;
  penerimaDetail?: string; // "[Nama Penerima] - [Nama Bank] [Nomor Rekening]"
  jalurTransfer?: JalurTransfer; // 'sesama_bca' | 'ewallet' | 'bi_fast' | 'online_rtgs' | 'custom'
  adminNominalCustom?: number; // Nominal admin custom untuk pilihan 'custom'
  rekeningId?: AccountId; // Saku asal / saku utama yang terpengaruh
  rekeningTujuanId?: AccountId; // Saku tujuan khusus transaksi mutasi internal
  parentTransactionId?: string; // FK ke transaksi utama (untuk entri biaya admin bank)
  divisi?: 'admin' | 'ahli' | 'it' | 'umum'; // Sub-Divisi pengaju (Divisi Admin, Divisi Ahli, Divisi IT, Umum)
  urutan?: number; // Custom drag-and-drop order index
  isDeleted?: boolean; // Soft delete flag
  deletedAt?: string; // ISO datetime when deleted
  dibuatPada: string; // ISO datetime
  diupdatePada: string; // ISO datetime
}

export interface ProcurementItem {
  id: string;
  nama: string;
  kuantitas: number;
  satuan?: string; // Unit like pcs, sak, roll, m2, unit, etc.
  hargaRencana?: number; // Total harga rencana untuk kuantitas ini
  hargaAktual?: number;  // Total harga aktual pembelian
  kategori?: string;     // Operational Cost, Utilities, Overhead Cost, Biaya Lain-Lain
  isPurchased: boolean;
  isCancelled?: boolean; // Item dibatalkan / tidak jadi beli
  suratPengajuanId?: string; // Tautan ke ID transaksi Drop Dana / Surat Pengajuan tertentu
}

export interface Project {
  id: string;
  nama: string;
  klien: string; // Klien Utama / Instansi Tujuan (cth: "DJKA Area Bogor dan Sukabumi")
  nomorSurat?: string; // Nomor Surat Pengajuan (cth: "050/ARP/VII/OP/2026")
  pemohonNama?: string; // Pemohon / Leader Teknik (cth: "Rama Regawa Sri Anggayana")
  pemohonJabatan?: string; // Jabatan Pemohon (cth: "Leader Teknik")
  teknisiPic?: string; // PIC Lapangan / Teknisi (cth: "Fauzan")
  tipe?: 'proyek_klien' | 'operasional_kantor'; // 'proyek_klien' (default) vs 'operasional_kantor'
  anggaran?: number; // Modal/Anggaran Operasional (Legacy/Depreceated)
  suratPengajuanPdf?: string; // URL to the uploaded PDF
  procurementItems?: ProcurementItem[]; // Checklist pengadaan
  tanggalMulai: string;
  tanggalSelesai?: string;
  status: 'aktif' | 'selesai';
  deskripsi?: string;
  isDeleted?: boolean; // Soft delete flag to prevent zombie projects
  deletedAt?: string; // ISO datetime when deleted
  dibuatPada: string;
  diupdatePada: string;
}

export type UserRole = 'owner' | 'admin';

export interface Session {
  role: UserRole;
  loginAt: string;
}

export interface DashboardSummary {
  sisaKasTotal: number; // Total Kas Perusahaan (Kas Utama + Kas Proyek)
  sisaKasUtama: number; // Kas Utama Perusahaan
  totalKasProyek: number; // Total Kas di Seluruh Proyek
  sisaKas?: number; // Legacy compatibility
  totalPemasukanBulanIni: number; // Total Pemasukan bulan ini (Omzet + Drop Dana)
  totalOmzetBulanIni: number; // Total Omzet Klien murni
  totalDropDanaBulanIni: number; // Total Drop Dana / Modal Injection
  totalPengeluaranOperasionalBulanIni: number; // Beban Operasional Riil
  totalPribadiOwnerBulanIni: number; // Prive Owner
  labaBersihBulanIni: number; // Formula: totalOmzetBulanIni - totalPengeluaranOperasionalBulanIni
  proyekAktif: number;
  accountBalances: Record<AccountId, number>; // Saldo riil per Saku/Rekening
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
