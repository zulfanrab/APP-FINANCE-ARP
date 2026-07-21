// ============================================================
// ARKA Finance — AI Gemini Receipt Scanner Service (Strict 1.5 Flash)
// Uses Google Gemini 1.5 Flash Vision API exclusively
// ============================================================

import Tesseract from 'tesseract.js';

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

function extractNominalFromText(text: string): number {
  const clean = text.replace(/\r/g, '');
  const lines = clean.split('\n');

  let maxFound = 0;
  for (const line of lines) {
    const lower = line.toLowerCase();
    if (lower.includes('total') || lower.includes('bayar') || lower.includes('jumlah') || lower.includes('rp')) {
      const nums = line.match(/(?:rp\.?|total|bayar)?\s*([\d.,]{4,12})/gi);
      if (nums) {
        for (const rawNum of nums) {
          const digitsOnly = rawNum.replace(/\D/g, '');
          const val = parseInt(digitsOnly, 10);
          if (!isNaN(val) && val > 1000 && val < 500_000_000) {
            if (val > maxFound) maxFound = val;
          }
        }
      }
    }
  }

  if (maxFound > 0) return maxFound;

  const allNums = text.match(/[\d.,]{5,12}/g);
  if (allNums) {
    for (const rawNum of allNums) {
      const digitsOnly = rawNum.replace(/\D/g, '');
      const val = parseInt(digitsOnly, 10);
      if (!isNaN(val) && val >= 5000 && val <= 500_000_000) {
        if (val > maxFound) maxFound = val;
      }
    }
  }

  return maxFound;
}

export async function scanReceiptWithGemini(file: File): Promise<ReceiptScanResult> {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

  if (apiKey && apiKey.trim().length > 5) {
    try {
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
2. HANYA KELUARKAN JSON MURNI tanpa teks pembuka atau penutup.
`;

      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
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

      if (response.ok) {
        const resData = await response.json();
        const textResponse = resData.candidates?.[0]?.content?.parts?.[0]?.text || '';

        const cleanJsonStr = textResponse
          .replace(/```json/g, '')
          .replace(/```/g, '')
          .trim();

        const parsed = JSON.parse(cleanJsonStr);

        if (parsed && typeof parsed.nominal === 'number') {
          return {
            nominal: Number(parsed.nominal) || 0,
            deskripsi: parsed.deskripsi || `Pembelian ${file.name.replace(/\.[^/.]+$/, '')}`,
            toko: parsed.toko || '',
            tanggal: parsed.tanggal || '',
            kategori: parsed.kategori || 'Bahan & Material',
            rawText: textResponse,
          };
        }
      }
    } catch (err) {
      console.warn('Gemini 1.5 Flash Vision API call failed, fallback to local OCR:', err);
    }
  }

  // TIER 2: LOCAL OCR FALLBACK
  try {
    const ret = await Tesseract.recognize(file, 'ind+eng', {
      logger: () => {},
    });

    const rawText = ret.data.text || '';
    const nominal = extractNominalFromText(rawText);
    const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);
    const toko = lines.length > 0 ? lines[0].substring(0, 40) : 'Toko / Merchant';
    const cleanFileName = file.name.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9 ]/g, ' ');

    return {
      nominal: nominal > 0 ? nominal : 0,
      deskripsi: `Struk Nota: ${cleanFileName}`,
      toko,
      kategori: 'Bahan & Material',
      rawText,
    };
  } catch (err) {
    console.error('Local OCR Exception:', err);
    return {
      nominal: 0,
      deskripsi: `Struk Nota: ${file.name.replace(/\.[^/.]+$/, '')}`,
      kategori: 'Operasional Kantor',
    };
  }
}
