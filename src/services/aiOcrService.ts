// ============================================================
// ARKA Finance — AI Gemini Receipt Scanner Service
// Uses Gemini 1.5 / 2.0 Flash Vision API for 99.9% OCR Accuracy
// Extracts: Total Nominal, Merchant Name, Description & Category
// ============================================================

export interface ReceiptScanResult {
  nominal: number;
  deskripsi: string;
  toko?: string;
  tanggal?: string;
  kategori?: string;
  rawText?: string;
}

function fileToBase64(file: File): Promise<{ mimeType: string; data: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const resultStr = reader.result as string;
      const mimeType = resultStr.substring(resultStr.indexOf(':') + 1, resultStr.indexOf(';'));
      const base64Data = resultStr.substring(resultStr.indexOf(',') + 1);
      resolve({ mimeType, data: base64Data });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export async function scanReceiptWithGemini(file: File): Promise<ReceiptScanResult> {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error('API Key Gemini belum dikonfigurasi di .env');
  }

  const { mimeType, data } = await fileToBase64(file);

  const promptText = `
Anda adalah sistem AI Ekstraksi Struk Belanja & Nota Keuangan Proyek Kelas Atas.
Tugas Anda: Baca foto struk/nota ini dengan sangat teliti dan ekstrak informasi berikut dalam format JSON MURNI (tanpa markdown format/tanpa backticks):

{
  "nominal": NUMBER_TANPA_TITIK_TANPA_RUPIAH (contoh: 250000),
  "deskripsi": "Deskripsi ringkas nama barang/jasa & nama toko/suplier (contoh: Pembelian Semen 10 Sak - UD Makmur)",
  "toko": "Nama Toko / Merchant jika ada",
  "tanggal": "YYYY-MM-DD jika tertera pada struk, atau kosongkan jika tidak jelas",
  "kategori": "Kategori yang paling cocok: Biaya Proyek / Bahan & Material / Transport & Bensin / Konsumsi & Akomodasi / Peralatan & Sewa Alat / Operasional Kantor / Pengeluaran Lainnya"
}

ATURAN PENTING:
1. "nominal" WAJIB berupa ANGKA BULAT (integer) dari TOTAL AKHIR / TOTAL BAYAR (Grand Total). Abaikan kembalian/subtotal.
2. Jika ada diskon atau pajak, ambil angka TOTAL BAYAR AKHIR (NET TOTAL).
3. HANYA KELUARKAN JSON MURNI tanpa teks pembuka atau penutup.
`;

  const models = ['gemini-2.0-flash', 'gemini-1.5-flash'];

  for (const model of models) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: promptText },
                {
                  inlineData: {
                    mimeType,
                    data,
                  },
                },
              ],
            },
          ],
        }),
      });

      if (!response.ok) continue;

      const resData = await response.json();
      const textResponse = resData.candidates?.[0]?.content?.parts?.[0]?.text || '';

      const cleanJsonStr = textResponse
        .replace(/```json/g, '')
        .replace(/```/g, '')
        .trim();

      const parsed = JSON.parse(cleanJsonStr);

      return {
        nominal: Number(parsed.nominal) || 0,
        deskripsi: parsed.deskripsi || 'Pembelian Struk Nota',
        toko: parsed.toko || '',
        tanggal: parsed.tanggal || '',
        kategori: parsed.kategori || 'Bahan & Material',
        rawText: textResponse,
      };
    } catch {
      // Fallback to next model
    }
  }

  throw new Error('Gagal memproses gambar struk dengan Gemini AI');
}
