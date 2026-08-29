// ============================================================
// ARKA Finance — User Guide Modal (Buku Panduan Penggunaan)
// Concise, clear manual for Pimpinan & Admin
// Includes step-by-step PWA app installation for Samsung & iPhone
// ============================================================

import React, { useState } from 'react';
import { Modal } from './Modal';
import {
  Crown, Briefcase, CheckCircle2, ShieldCheck, Wallet, FileSpreadsheet,
  ScanLine, ArrowRight, Smartphone, Share, MoreVertical, PlusSquare, BookOpen
} from 'lucide-react';

interface UserGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function UserGuideModal({ isOpen, onClose }: UserGuideModalProps) {
  const [activeTab, setActiveTab] = useState<'owner' | 'admin' | 'staff' | 'konsep' | 'install'>('owner');

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="📖 Buku Panduan & Cara Install Aplikasi" size="xl">
      <div className="space-y-4">
        {/* Role Tab Switcher */}
        <div className="flex bg-gray-100 p-1.5 rounded-2xl gap-1 font-bold text-xs overflow-x-auto scrollbar-none">
          <button
            type="button"
            onClick={() => setActiveTab('owner')}
            className={`py-2 px-3 rounded-xl flex items-center justify-center gap-1.5 whitespace-nowrap transition-all ${
              activeTab === 'owner'
                ? 'bg-[#0F172A] text-emerald-400 shadow-md'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Crown size={15} /> 👑 Direksi
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('admin')}
            className={`py-2 px-3 rounded-xl flex items-center justify-center gap-1.5 whitespace-nowrap transition-all ${
              activeTab === 'admin'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Briefcase size={15} /> 💼 Head of Finance
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('staff')}
            className={`py-2 px-3 rounded-xl flex items-center justify-center gap-1.5 whitespace-nowrap transition-all ${
              activeTab === 'staff'
                ? 'bg-teal-700 text-white shadow-md'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <ShieldCheck size={15} /> 🤝 Asisten Keuangan
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('konsep')}
            className={`py-2 px-3 rounded-xl flex items-center justify-center gap-1.5 whitespace-nowrap transition-all ${
              activeTab === 'konsep'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <BookOpen size={15} /> 📘 Konsep
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('install')}
            className={`py-2 px-3 rounded-xl flex items-center justify-center gap-1.5 whitespace-nowrap transition-all ${
              activeTab === 'install'
                ? 'bg-purple-600 text-white shadow-md'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Smartphone size={15} /> 📲 Install HP
          </button>
        </div>

        {/* Tab Content */}
        <div className="max-h-[65vh] overflow-y-auto pr-1 space-y-4 text-gray-800 text-sm">
          {activeTab === 'owner' ? (
            /* OWNER GUIDE */
            <div className="space-y-4 animate-fade-in">
              <div className="p-3.5 bg-slate-900 text-white rounded-2xl space-y-1 shadow-md">
                <h3 className="font-bold text-emerald-400 text-sm flex items-center gap-2">
                  <ShieldCheck size={16} /> Tujuan Utama Pimpinan / Manajemen
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Memberikan kontrol penuh 100% atas arus kas PT Aksara Riksa Perdana secara real-time dari HP Anda tanpa kerumitan teknis.
                </p>
              </div>

              <div className="space-y-3">
                <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl space-y-1">
                  <h4 className="font-bold text-gray-900 text-xs flex items-center gap-2">
                    <CheckCircle2 size={14} className="text-emerald-600" /> 1. Persetujuan & Komentar Penolakan Transaksi
                  </h4>
                  <p className="text-xs text-gray-600">
                    Setiap transaksi dari Admin akan muncul di menu <strong>Menunggu Persetujuan</strong>. Anda dapat memeriksa foto struk dan menyetujui atau menolak. Jika ditolak, Anda bisa menyisipkan <strong>komentar alasan penolakan</strong> yang akan langsung terbaca oleh Admin.
                  </p>
                </div>

                <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl space-y-1">
                  <h4 className="font-bold text-gray-900 text-xs flex items-center gap-2">
                    <Wallet size={14} className="text-emerald-600" /> 2. Pencatatan Instan (Prive & Voice Input)
                  </h4>
                  <p className="text-xs text-gray-600">
                    Gunakan tombol <strong>"Input Transaksi / Prive"</strong> di atas dashboard. Anda dapat menggunakan <strong>Fitur Perekam Suara AI (Voice Input)</strong> dengan mengucapkan <i>"Tarik prive 5 juta"</i> atau <i>"Beli bensin 150 ribu"</i>, dan AI akan mengisikan nominalnya secara otomatis.
                  </p>
                </div>

                <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl space-y-1">
                  <h4 className="font-bold text-gray-900 text-xs flex items-center gap-2">
                    <ArrowRight size={14} className="text-emerald-600" /> 3. Pemantauan Proyek & Profit Bersih
                  </h4>
                  <p className="text-xs text-gray-600">
                    Di menu <strong>Proyek</strong>, Anda dapat melihat total modal yang dikucurkan, realisasi belanja di lapangan, dan sisa dana proyek secara akurat.
                  </p>
                </div>
              </div>
            </div>
          ) : activeTab === 'admin' ? (
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
                    Gunakan menu <strong>Input Transaksi</strong> untuk mencatat pengeluaran. Foto struk yang Anda lampirkan otomatis terunggah dan tersimpan rapi di Google Drive perusahaan saat disimpan.
                  </p>
                </div>

                <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl space-y-1">
                  <h4 className="font-bold text-gray-900 text-xs flex items-center gap-2">
                    <FileSpreadsheet size={14} className="text-emerald-600" /> 2. Fitur OCR Scan Struk &amp; Export Excel
                  </h4>
                  <p className="text-xs text-gray-600">
                    Gunakan tombol <strong>"Scan Struk (AI OCR)"</strong> untuk membaca total nominal fisik resi secara otomatis. Hasil rekap bulanan dapat diunduh dalam format Excel &amp; PDF di halaman Laporan/Proyek.
                  </p>
                </div>

                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl space-y-1">
                  <h4 className="font-bold text-emerald-950 text-xs flex items-center gap-2">
                    <CheckCircle2 size={14} className="text-emerald-600" /> 3. Modul Hutang &amp; Piutang (AP &amp; AR Hub)
                  </h4>
                  <p className="text-xs text-emerald-800">
                    Gunakan menu <strong>Hutang &amp; Piutang</strong> untuk mencatat tagihan invoice ke Klien yang belum lunas (AR) dan kewajiban tagihan ke vendor (AP). Anda dapat mencatat cicilan/pelunasan dan memilih opsi <strong>"Otomatis catat transaksi di Jurnal Kas"</strong> agar tidak perlu menginput ulang ke kas secara manual.
                  </p>
                </div>
              </div>
            </div>
          ) : activeTab === 'staff' ? (
            /* STAFF / ASISTEN GUIDE */
            <div className="space-y-4 animate-fade-in">
              <div className="p-3.5 bg-teal-900 text-white rounded-2xl space-y-1 shadow-md">
                <h3 className="font-bold text-teal-300 text-sm flex items-center gap-2">
                  <ShieldCheck size={16} /> Panduan Peran Asisten Keuangan (Staf Operasional)
                </h3>
                <p className="text-xs text-teal-100 leading-relaxed">
                  Asisten Keuangan bertugas membantu pencatatan operasional harian, mengelola struk belanja, surat pengajuan tim, dan monitoring hutang-piutang.
                </p>
              </div>

              <div className="space-y-3">
                <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl space-y-1">
                  <h4 className="font-bold text-gray-900 text-xs flex items-center gap-2">
                    <CheckCircle2 size={14} className="text-teal-600" /> 1. Input Belanja &amp; Upload Nota Fisik
                  </h4>
                  <p className="text-xs text-gray-600">
                    Catat pengeluaran harian, bensin, konsumsi, atau upah lewat menu <strong>Input Transaksi</strong>. Foto atau scan struk secara jelas agar langsung tersimpan di Google Drive arsip.
                  </p>
                </div>

                <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl space-y-1">
                  <h4 className="font-bold text-gray-900 text-xs flex items-center gap-2">
                    <CheckCircle2 size={14} className="text-teal-600" /> 2. Monitoring Hutang &amp; Piutang
                  </h4>
                  <p className="text-xs text-gray-600">
                    Bantu mencatat invoice tagihan ke klien serta tagihan dari vendor di menu <strong>Hutang &amp; Piutang</strong>.
                  </p>
                </div>

                <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl space-y-1">
                  <h4 className="font-bold text-gray-900 text-xs flex items-center gap-2">
                    <CheckCircle2 size={14} className="text-teal-600" /> 3. Batasan Akses Rekening Master
                  </h4>
                  <p className="text-xs text-gray-600">
                    Demi keamanan dan kerahasiaan kas besar perusahaan, saku rekening master (BCA/BRI) &amp; laporan laba-rugi pusat dikunci dan hanya dapat dikelola oleh Head of Finance dan Direktur Utama.
                  </p>
                </div>
              </div>
            </div>
          ) : activeTab === 'konsep' ? (
            /* KONSEP GUIDE */
            <div className="space-y-4 animate-fade-in text-xs leading-relaxed">
              <div className="p-3.5 bg-blue-900 text-white rounded-2xl space-y-1 shadow-md">
                <h3 className="font-bold text-blue-300 text-sm flex items-center gap-2">
                  <BookOpen size={16} /> Konsep Pencatatan Activity-Based Cash Ledger
                </h3>
                <p className="text-xs text-blue-100 leading-relaxed">
                  Aplikasi ini mengakomodasi alokasi dana secara presisi, membedakan mana yang merupakan "Beban Murni" dan mana yang sekadar "Pindah Dompet".
                </p>
              </div>

              <div className="space-y-3">
                {/* 1. Dompet */}
                <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl space-y-2">
                  <h4 className="font-bold text-gray-900 text-sm">1. Kas Utama vs Kas Proyek</h4>
                  <ul className="list-disc pl-4 space-y-1 text-gray-700">
                    <li><strong>Kas Utama:</strong> Transaksi tanpa alokasi (Proyek kosong). Contoh: Biaya operasional kantor, Gaji.</li>
                    <li><strong>Kas Proyek:</strong> Dompet cabang yang dialokasikan khusus untuk satu proyek.</li>
                    <li><strong>Total Kas Perusahaan</strong> = Sisa Kas Utama + Sisa Seluruh Kas Proyek. Uang yang dipindah ke proyek tidak dianggap hilang.</li>
                  </ul>
                </div>

                {/* 2. Pemasukan */}
                <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl space-y-2">
                  <h4 className="font-bold text-gray-900 text-sm">2. Pendapatan vs Mutasi Internal</h4>
                  <ul className="list-disc pl-4 space-y-1 text-gray-700">
                    <li><strong>Pendapatan Klien (Laba-Rugi):</strong> Uang hasil proyek (Termin/Pelunasan) yang menambah Laba perusahaan.</li>
                    <li><strong>Modal & Drop Dana:</strong> Setoran modal atau saldo awal yang menambah kas tapi BUKAN Laba.</li>
                    <li><strong>Mutasi Internal & Refund:</strong> Sekadar memindahkan dompet dari kiri ke kanan. Tidak mempengaruhi P&L.</li>
                  </ul>
                </div>

                {/* 3. Auto Split */}
                <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl space-y-2">
                  <h4 className="font-bold text-gray-900 text-sm">3. Biaya Admin Bank Auto-Split</h4>
                  <p className="text-gray-700">
                    Saat transfer menggunakan jalur berbayar (BI-FAST, RTGS), sistem otomatis membelah transaksi menjadi dua: Transaksi Utama dan Transaksi Biaya Admin. Transaksi anak ini akan otomatis dihapus jika transaksi induk dibatalkan, dan selalu mewarisi Proyek/Divisi yang sama.
                  </p>
                </div>
                
                {/* 4. Divisi */}
                <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl space-y-2">
                  <h4 className="font-bold text-gray-900 text-sm">4. Sub-Divisi Kantor</h4>
                  <p className="text-gray-700">
                    Tombol Divisi (Admin, IT, Ahli) HANYA muncul untuk transaksi di Kas Utama atau Proyek Operasional Kantor. Proyek lapangan akan menyembunyikan opsi ini agar pengeluaran dicatat secara <i>gelondongan</i> (langsung ke proyek).
                  </p>
                </div>

                {/* 5. Hutang & Piutang */}
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl space-y-2">
                  <h4 className="font-bold text-emerald-950 text-sm">5. Hub Hutang &amp; Piutang (AR &amp; AP)</h4>
                  <p className="text-emerald-900">
                    Mencatat tagihan berjalan di luar mutasi kas riil. Tagihan klien (Piutang) dan tagihan vendor (Hutang) dimonitor statusnya secara otomatis (Belum Bayar, Cicilan, Lunas, atau Jatuh Tempo). Saat cicilan dicatat, Anda dapat mengaktifkan fitur pencatatan otomatis ke Jurnal Kas.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            /* INSTALLATION GUIDE FOR SAMSUNG & IPHONE */
            <div className="space-y-4 animate-fade-in">
              <div className="p-3.5 bg-purple-900 text-white rounded-2xl space-y-1 shadow-md">
                <h3 className="font-bold text-purple-300 text-sm flex items-center gap-2">
                  <Smartphone size={16} /> Cara Mengubah Website Menjadi Aplikasi HP (PWA)
                </h3>
                <p className="text-xs text-purple-200 leading-relaxed">
                  Aplikasi ARKA Finance dapat dipasang langsung di Layar Utama HP tanpa perlu melalui Play Store atau App Store!
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Samsung / Android Guide */}
                <div className="p-4 bg-slate-900 text-white border border-slate-800 rounded-2xl space-y-3">
                  <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
                    <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-xs">
                      📱
                    </div>
                    <div>
                      <h4 className="font-bold text-xs text-emerald-400">HP Samsung / Android (Google Chrome)</h4>
                      <p className="text-[10px] text-slate-400">Langkah mudah pemasangan aplikasi</p>
                    </div>
                  </div>

                  <ol className="text-xs space-y-2 text-slate-300 list-decimal list-inside leading-relaxed font-medium">
                    <li>Buka situs web di browser <strong>Google Chrome</strong> di HP Samsung.</li>
                    <li>Ketuk ikon <strong>titik tiga (⋮)</strong> di pojok kanan atas layar.</li>
                    <li>Pilih menu <strong>"Tambahkan ke Layar Utama"</strong> atau <strong>"Install Aplikasi"</strong>.</li>
                    <li>Ketuk <strong>"Install" / "Tambahkan"</strong>.</li>
                    <li>Ikon aplikasi <strong>ARKA Finance</strong> akan otomatis muncul di menu utama HP Samsung seperti aplikasi resmi!</li>
                  </ol>
                </div>

                {/* iPhone / iOS Guide */}
                <div className="p-4 bg-slate-900 text-white border border-slate-800 rounded-2xl space-y-3">
                  <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
                    <div className="w-7 h-7 rounded-lg bg-purple-500/20 text-purple-400 flex items-center justify-center font-bold text-xs">
                      🍎
                    </div>
                    <div>
                      <h4 className="font-bold text-xs text-purple-300">HP iPhone (Safari Browser)</h4>
                      <p className="text-[10px] text-slate-400">Langkah mudah pemasangan aplikasi</p>
                    </div>
                  </div>

                  <ol className="text-xs space-y-2 text-slate-300 list-decimal list-inside leading-relaxed font-medium">
                    <li>Buka situs web di browser <strong>Safari</strong> di iPhone.</li>
                    <li>Ketuk tombol <strong>Bagikan / Share</strong> (ikon kotak dengan panah atas <Share size={12} className="inline text-purple-400" /> di bagian tengah bawah).</li>
                    <li>Gulir ke bawah dan pilih menu <strong>"Tambah ke Layar Utama" / "Add to Home Screen"</strong>.</li>
                    <li>Ketuk tombol <strong>"Tambah"</strong> di pojok kanan atas.</li>
                    <li>Aplikasi <strong>ARKA Finance</strong> akan langsung terpasang di Home Screen iPhone!</li>
                  </ol>
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
