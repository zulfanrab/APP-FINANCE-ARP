// ============================================================
// ARKA Finance — AI Voice Transaction Parsing Service (Strict 1.5 Flash)
// Uses Google Gemini 1.5 Flash API exclusively
// ============================================================

export interface ParsedVoiceTransaction {
  nominal: number;
  deskripsi: string;
  jenisQuick: 'prive' | 'operasional' | 'setoran';
  kategori: string;
}

export function parseSpokenRupiah(text: string): number {
  const lower = text.toLowerCase();

  const wordNumMap: Record<string, number> = {
    satu: 1, dua: 2, tiga: 3, empat: 4, lima: 5,
    enam: 6, tujuh: 7, delapan: 8, sembilan: 9, sepuluh: 10,
    sebelas: 11, seratus: 100, seribu: 1000, sejuta: 1000000,
  };

  const jutaMatch = lower.match(/(\d+(?:[.,]\d+)?)\s*juta/);
  const ribuMatch = lower.match(/(\d+(?:[.,]\d+)?)\s*ribu/);
  const rawMatch = lower.match(/(?:rp\.?|nominal|sebesar|rp)?\s*([\d.,]+)/i) || lower.match(/(\d{4,9})/);

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

  if (lower.includes('juta')) {
    const parts = lower.split('juta');
    const millionPart = parts[0].trim();
    const thousandPart = parts[1] ? parts[1].trim() : '';

    let mVal = wordNumMap[millionPart] || parseFloat(millionPart.replace(/\D/g, '')) || 1;
    let tVal = 0;
    if (thousandPart.includes('ribu')) {
      const tStr = thousandPart.split('ribu')[0].trim();
      tVal = wordNumMap[tStr] || parseFloat(tStr.replace(/\D/g, '')) || 0;
    }
    return Math.round(mVal * 1_000_000 + tVal * 1_000);
  }

  if (lower.includes('ribu')) {
    const rPart = lower.split('ribu')[0].trim();
    const rVal = wordNumMap[rPart] || parseFloat(rPart.replace(/\D/g, '')) || 0;
    if (rVal > 0) return Math.round(rVal * 1_000);
  }

  if (rawMatch) {
    const num = parseInt(rawMatch[1].replace(/\D/g, ''), 10);
    if (!isNaN(num) && num > 100) return num;
  }

  return 0;
}

export async function parseVoiceSentenceWithAI(transcript: string): Promise<ParsedVoiceTransaction> {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

  if (apiKey && apiKey.trim().length > 5) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
      const promptText = `
Anda adalah AI Pengolah Suara Transaksi Keuangan Perusahaan PT Aksara Riksa Perdana.
Pimpinan/Direksi mengucapkan kalimat perintah suara berikut:
"${transcript}"

Ekstrak informasi berikut dalam format JSON MURNI (tanpa markdown/tanpa backticks):
{
  "nominal": ANGKA_BULAT (contoh: 150000 untuk 150 ribu, 5000000 untuk 5 juta, 20000000 untuk 20 juta),
  "deskripsi": "Deskripsi singkat yang rapi & profesional untuk transaksi ini",
  "jenisQuick": "prive" (jika tentang penarikan pribadi/prive), "operasional" (jika pengeluaran operasional/bensin/makan/proyek), atau "setoran" (jika setoran/alokasi modal),
  "kategori": "Kategori paling cocok: Penarikan Prive / Transport & Bensin / Konsumsi & Akomodasi / Operasional Kantor / Biaya Proyek / Setoran Modal / Lain-lain"
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

        if (parsed) {
          return {
            nominal: Number(parsed.nominal) || parseSpokenRupiah(transcript),
            deskripsi: parsed.deskripsi || transcript,
            jenisQuick: parsed.jenisQuick || (transcript.toLowerCase().includes('prive') ? 'prive' : 'operasional'),
            kategori: parsed.kategori || 'Operasional Kantor',
          };
        }
      }
    } catch (err) {
      console.warn('Gemini 1.5 Flash Voice API call failed, fallback to local parser:', err);
    }
  }

  // TIER 2: SMART LOCAL PARSER FALLBACK
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
  } else if (lower.includes('bensin') || lower.includes('tol') || lower.includes('parkir') || lower.includes('bbm')) {
    jenisQuick = 'operasional';
    kategori = 'Transport & Bensin';
  } else if (lower.includes('makan') || lower.includes('kopi') || lower.includes('restoran')) {
    jenisQuick = 'operasional';
    kategori = 'Konsumsi & Akomodasi';
  }

  let deskripsi = transcript;
  if (lower.includes('prive')) {
    deskripsi = `Penarikan Prive Owner (${formatRupiahSimple(nominal)})`;
  } else if (lower.includes('bensin')) {
    deskripsi = `Pengeluaran Bensin & Transport`;
  }

  return {
    nominal,
    deskripsi,
    jenisQuick,
    kategori,
  };
}

function formatRupiahSimple(val: number): string {
  if (!val) return 'Rp 0';
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(val);
}
