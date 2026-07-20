// ============================================================
// ARKA Finance — User Guide Modal (Buku Panduan Penggunaan)
// Concise, clear manual for Pak Fatwa (Owner) & Admin
// ============================================================

import React, { useState } from 'react';
import { Modal } from './Modal';
import { Crown, Briefcase, CheckCircle2, ShieldCheck, Wallet, FileSpreadsheet, ScanLine, ArrowRight } from 'lucide-react';

interface UserGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function UserGuideModal({ isOpen, onClose }: UserGuideModalProps) {
  const [activeTab, setActiveTab] = useState<'owner' | 'admin'>('owner');

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="📖 Panduan Penggunaan ARKA Finance" size="xl">
      <div className="space-y-4">
        {/* Role Tab Switcher */}
        <div className="flex bg-gray-100 p-1.5 rounded-2xl gap-1 font-bold text-xs">
          <button
            type="button"
            onClick={() => setActiveTab('owner')}
            className={`flex-1 py-2.5 px-3 rounded-xl flex items-center justify-center gap-2 transition-all ${
              activeTab === 'owner'
                ? 'bg-[#0F172A] text-emerald-400 shadow-md'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Crown size={15} /> 👑 Panduan Owner (Pak Fatwa)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('admin')}
            className={`flex-1 py-2.5 px-3 rounded-xl flex items-center justify-center gap-2 transition-all ${
              activeTab === 'admin'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Briefcase size={15} /> 💼 Panduan Admin Keuangan
          </button>
        </div>

        {/* Tab Content */}
        <div className="max-h-[65vh] overflow-y-auto pr-1 space-y-4 text-gray-800 text-sm">
          {activeTab === 'owner' ? (
            /* OWNER GUIDE */
            <div className="space-y-4 animate-fade-in">
              <div className="p-3.5 bg-slate-900 text-white rounded-2xl space-y-1 shadow-md">
                <h3 className="font-bold text-emerald-400 text-sm flex items-center gap-2">
                  <ShieldCheck size={16} /> Tujuan Utama Untuk Pak Fatwa
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Memberikan kontrol penuh 100% atas arus kas PT Aksara Riksa Perdana secara real-time dari HP Anda tanpa kerumitan teknis.
                </p>
              </div>

              <div className="space-y-3">
                <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl space-y-1">
                  <h4 className="font-bold text-gray-900 text-xs flex items-center gap-2">
                    <CheckCircle2 size={14} className="text-emerald-600" /> 1. Persetujuan Transaksi (1-Click Approval)
                  </h4>
                  <p className="text-xs text-gray-600">
                    Setiap transaksi pengeluaran/pemasukan yang dicatat oleh Admin akan muncul di menu <strong>Menunggu Persetujuan</strong>. Anda dapat memeriksa foto struk dan menyetujui/menolak dalam 1 sentuhan.
                  </p>
                </div>

                <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl space-y-1">
                  <h4 className="font-bold text-gray-900 text-xs flex items-center gap-2">
                    <Wallet size={14} className="text-emerald-600" /> 2. Pencatatan Instan (Prive & Setoran Modal)
                  </h4>
                  <p className="text-xs text-gray-600">
                    Gunakan tombol <strong>"Input Transaksi / Prive"</strong> di atas dashboard untuk mencatat penarikan dana pribadi (Prive) atau suntikan modal tanpa memerlukan antrean approval Admin.
                  </p>
                </div>

                <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl space-y-1">
                  <h4 className="font-bold text-gray-900 text-xs flex items-center gap-2">
                    <ArrowRight size={14} className="text-emerald-600" /> 3. Pemantauan Proyek & Profit Bersih
                  </h4>
                  <p className="text-xs text-gray-600">
                    Di menu <strong>Proyek</strong>, Anda dapat melihat total modal yang dikucurkan, realisasi belanja di lapangan, dan estimasi Profit Bersih (Cuan Proyek) secara akurat.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            /* ADMIN GUIDE */
            <div className="space-y-4 animate-fade-in">
              <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-950 rounded-2xl space-y-1 shadow-sm">
                <h3 className="font-bold text-emerald-800 text-sm flex items-center gap-2">
                  <Briefcase size={16} /> Tugas Utama Admin Keuangan
                </h3>
                <p className="text-xs text-emerald-900 leading-relaxed">
                  Mencatat seluruh mutasi harian, mengunggah bukti struk nota ke Google Drive, dan mengelola pagu anggaran proyek.
                </p>
              </div>

              <div className="space-y-3">
                <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl space-y-1">
                  <h4 className="font-bold text-gray-900 text-xs flex items-center gap-2">
                    <ScanLine size={14} className="text-purple-600" /> 1. Input Transaksi & Auto Upload Google Drive
                  </h4>
                  <p className="text-xs text-gray-600">
                    Gunakan menu <strong>Input Transaksi</strong> untuk mencatat pengeluaran. Foto struk yang Anda lampirkan otomatis terunggah dan tersimpan rapi di Google Drive perusahaan.
                  </p>
                </div>

                <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl space-y-1">
                  <h4 className="font-bold text-gray-900 text-xs flex items-center gap-2">
                    <FileSpreadsheet size={14} className="text-emerald-600" /> 2. Fitur OCR Scan Struk & Export Excel
                  </h4>
                  <p className="text-xs text-gray-600">
                    Gunakan tombol <strong>"Scan Struk (AI OCR)"</strong> untuk membaca total nominal fisik resi secara otomatis. Hasil rekap bulanan dapat diunduh dalam format Excel di halaman Dashboard/Laporan.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end pt-3 border-t border-gray-100">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all active:scale-95 shadow-md"
          >
            Saya Mengerti
          </button>
        </div>
      </div>
    </Modal>
  );
}
