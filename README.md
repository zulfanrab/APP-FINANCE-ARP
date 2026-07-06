# ARKA Finance

**Sistem Manajemen Keuangan Internal PT Aksara Riksa Perdana**

Aplikasi web keuangan internal berbasis React + TypeScript + Tailwind CSS + Vite. Fully functional di sisi frontend menggunakan localStorage sebagai penyimpanan data, dengan arsitektur service layer yang siap diganti ke backend API asli tanpa menulis ulang komponen UI.

---

## ✨ Fitur Utama

- **Login PIN 6 digit** — ter-hash dengan Web Crypto API
- **Dual Role** — Owner (approve/tolak) & Admin Keuangan (input/kelola)
- **Dashboard Owner** — ringkasan real-time, approval transaksi, upload bukti transfer, chart 6 bulan
- **Dashboard Admin** — tabel transaksi lengkap dengan filter & sort, export Excel
- **Input Transaksi** — form lengkap + OCR scan struk (Tesseract.js) + upload lampiran multi-file
- **Manajemen Proyek** — CRUD proyek, kalkulasi profit otomatis per proyek
- **Laporan Keuangan** — pie chart, line chart cashflow, export Excel 3-sheet, **AI Summary via Gemini**
- **Tag Transaksi** — pisahkan pengeluaran Operasional vs Pribadi Owner (Prive)

---

## 🚀 Cara Install & Jalankan

### 1. Clone & Install Dependencies

```bash
git clone https://github.com/your-org/arka-finance.git
cd arka-finance
npm install
```

### 2. Setup Environment Variables

```bash
# Salin template environment variable
cp .env.example .env

# Edit file .env, isi dengan API key Gemini Anda
# Dapatkan API key di: https://aistudio.google.com/apikey
```

### 3. Jalankan Development Server

```bash
npm run dev
```

Buka browser di `http://localhost:5173`

### 4. Build Production

```bash
npm run build
```

---

## 📦 Deploy ke Vercel

1. Push ke GitHub
2. Import repository di [vercel.com](https://vercel.com)
3. Tambahkan environment variable `VITE_GEMINI_API_KEY` di Vercel dashboard
4. Deploy otomatis setiap push ke `main`

---

## 🔐 Environment Variables

| Variable | Deskripsi | Wajib |
|---|---|---|
| `VITE_GEMINI_API_KEY` | API key Google Gemini untuk fitur AI Summary di halaman Laporan | Opsional (fitur AI tidak aktif jika tidak diset) |

Lihat `.env.example` untuk detail cara mendapatkan API key.

---

## 🏗️ Arsitektur Kode

```
src/
├── types/          # TypeScript interfaces (Transaction, Project, dll)
├── services/       # Data layer (localStorage, siap diganti fetch() ke API)
│   ├── authService.ts
│   ├── transactionService.ts
│   ├── projectService.ts
│   ├── analyticsService.ts
│   └── storage.ts
├── context/        # React Context (Auth, App/Toast)
├── components/
│   ├── ui/         # Reusable UI primitives (Button, Card, Badge, Toast, Modal)
│   └── layout/     # Layout components (Sidebar, Layout)
└── pages/          # Route pages (Login, Dashboard, Form, Projects, Reports)
```

### Migrasi ke Backend API

Untuk mengganti localStorage ke backend API asli, cukup edit isi fungsi di `src/services/`:

```typescript
// Sebelum (localStorage):
export async function getTransactions(): Promise<Transaction[]> {
  return getItem<Transaction[]>(KEYS.TRANSACTIONS, []);
}

// Setelah (API):
export async function getTransactions(): Promise<Transaction[]> {
  const res = await fetch('/api/transactions', { headers: authHeaders() });
  return res.json();
}
```

Komponen React tidak perlu diubah sama sekali.

---

## 📋 Default Setup

Saat pertama kali dibuka, aplikasi akan meminta Anda membuat PIN 6 digit. PIN ini disimpan ter-hash di localStorage perangkat.

**Role yang tersedia:**
- **Owner** — Approve/tolak transaksi, tandai transfer selesai, lihat ringkasan
- **Admin Keuangan** — Input transaksi, kelola proyek, export laporan, akses penuh

---

## 🛠️ Tech Stack

- **Framework**: React 18 + TypeScript + Vite
- **Styling**: Tailwind CSS v4
- **Charts**: Recharts
- **Export Excel**: SheetJS (xlsx)
- **OCR**: Tesseract.js
- **AI**: Google Generative AI (Gemini 1.5 Flash)
- **Icons**: Lucide React
- **Routing**: React Router DOM v6

---

*© 2025 PT Aksara Riksa Perdana. Internal use only.*
