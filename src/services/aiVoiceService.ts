// ============================================================
// ARKA Finance — AI Voice Transaction Parsing Service
// Converts spoken Indonesian voice into structured transaction JSON
// ============================================================

export interface ParsedVoiceTransaction {
  nominal: number;
  deskripsi: string;
  jenisQuick: 'prive' | 'operasional' | 'setoran';
  kategori: string;
}

// Convert spoken number text (e.g. "150 ribu", "5 juta", "20 juta") to number
export function parseSpokenRupiah(text: string): number {
  const lower = text.toLowerCase();

  // Match "X juta Y ribu" or "X juta" or "X ribu" or raw numbers
  const jutaMatch = lower.match(/(\d+(?:[.,]\d+)?)\s*juta/);
  const ribuMatch = lower.match(/(\d+(?:[.,]\d+)?)\s*ribu/);
  const rawMatch = lower.match(/(?:rp\.?|nominal|sebesar|rp)\s*([\d.,]+)/i) || lower.match(/(\d{4,9})/);

  let total = 0;
  if (jutaMatch) {
    const val = parseFloat(jutaMatch[1].replace(',', '.'));
    total += val * 1_000_000;
  }
  if (ribuMatch) {
    const val = parseFloat(ribuMatch[1].replace(',', '.'));
    total += val * 1_000;
  }

  if (total > 0) return total;

  if (rawMatch) {
    const num = parseInt(rawMatch[1].replace(/\D/g, ''), 10);
    if (!isNaN(num)) return num;
  }

  return 0;
}

export async function parseVoiceSentenceWithAI(transcript: string): Promise<ParsedVoiceTransaction> {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

  if (apiKey) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
      const promptText = `
Anda adalah AI Pengolah Suara Transaksi Keuangan Perusahaan PT Aksara Riksa Perdana.
User (Owner Pak Fatwa) mengucapkan kalimat perintah suara berikut:
"${transcript}"

Ekstrak informasi berikut dalam format JSON MURNI (tanpa markdown/tanpa backticks):
{
  "nominal": ANGKA_BULAT (contoh: 150000 untuk 150 ribu, 5000000 untuk 5 juta),
  "deskripsi": "Deskripsi singkat yang rapi & profesional untuk transaksi ini",
  "jenisQuick": "prive" (jika tentang penarikan pribadi/prive), "operasional" (jika pengeluaran operasional/bensin/makan/proyek), atau "setoran" (jika setoran/suntikan modal),
  "kategori": "Kategori paling cocok: Prive Owner / Transport & Bensin / Konsumsi & Akomodasi / Operasional Kantor / Biaya Proyek / Setoran Modal / Lain-lain"
}
`;

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: promptText }] }],
        }),
      });

      if (response.ok) {
        const resData = await response.json();
        const textResp = resData.candidates?.[0]?.content?.parts?.[0]?.text || '';
        const cleanJson = textResp.replace(/```json/g, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(cleanJson);

        return {
          nominal: Number(parsed.nominal) || parseSpokenRupiah(transcript),
          deskripsi: parsed.deskripsi || transcript,
          jenisQuick: parsed.jenisQuick || (transcript.toLowerCase().includes('prive') ? 'prive' : 'operasional'),
          kategori: parsed.kategori || 'Operasional Kantor',
        };
      }
    } catch {
      // Fallback
    }
  }

  // Fallback Rule Parser
  const nominal = parseSpokenRupiah(transcript);
  const lower = transcript.toLowerCase();
  let jenisQuick: 'prive' | 'operasional' | 'setoran' = 'operasional';
  let kategori = 'Operasional Kantor';

  if (lower.includes('prive') || lower.includes('pribadi') || lower.includes('tarik')) {
    jenisQuick = 'prive';
    kategori = 'Prive Owner';
  } else if (lower.includes('suntik') || lower.includes('modal') || lower.includes('setor')) {
    jenisQuick = 'setoran';
    kategori = 'Setoran Modal';
  } else if (lower.includes('bensin') || lower.includes('tol') || lower.includes('parkir')) {
    kategori = 'Transport & Bensin';
  } else if (lower.includes('makan') || lower.includes('kopi') || lower.includes('supper')) {
    kategori = 'Konsumsi & Akomodasi';
  }

  return {
    nominal,
    deskripsi: transcript,
    jenisQuick,
    kategori,
  };
}
