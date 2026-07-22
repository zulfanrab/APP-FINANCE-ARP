// ============================================================
// ARKA Finance — Bank Detection & Recipient Autocomplete Helper
// Pure logic regex/digit pattern detection & recipient formatting
// ============================================================

export interface BankDetectionResult {
  bankName: string;
  accountNumber: string;
  recipientName: string;
  isBca: boolean;
  suggestedJalur: 'sesama_bca' | 'bi_fast';
  formattedDetail: string;
}

const BANK_RULES = [
  { name: 'BCA', regex: /\b(bca|bank\s*bca|central\s*asia)\b/i, isBca: true },
  { name: 'Mandiri', regex: /\b(mandiri|bank\s*mandiri)\b/i, isBca: false },
  { name: 'BNI', regex: /\b(bni|bank\s*bni|negara\s*indonesia)\b/i, isBca: false },
  { name: 'BRI', regex: /\b(bri|bank\s*bri|rakyat\s*indonesia)\b/i, isBca: false },
  { name: 'CIMB Niaga', regex: /\b(cimb|niaga)\b/i, isBca: false },
  { name: 'BSI', regex: /\b(bsi|syariah\s*indonesia)\b/i, isBca: false },
  { name: 'Danamon', regex: /\b(danamon)\b/i, isBca: false },
  { name: 'Permata', regex: /\b(permata)\b/i, isBca: false },
  { name: 'SeaBank', regex: /\b(seabank|sea\s*bank)\b/i, isBca: false },
  { name: 'Bank Jago', regex: /\b(jago|bank\s*jago)\b/i, isBca: false },
  { name: 'Blu', regex: /\b(blu|bca\s*digital)\b/i, isBca: false },
  { name: 'Jenius', regex: /\b(jenius|btpn)\b/i, isBca: false },
  { name: 'BTN', regex: /\b(btn|tabungan\s*negara)\b/i, isBca: false },
];

/**
 * Pure logic bank detector by account number digit length & patterns
 */
export function detectBankFromAccountNumber(accNum: string, contextText: string = ''): { bankName: string; isBca: boolean } {
  const digits = accNum.replace(/\D/g, '');
  const lower = contextText.toLowerCase();

  // Check explicit bank keywords first
  for (const rule of BANK_RULES) {
    if (rule.regex.test(lower)) {
      return { bankName: rule.name, isBca: rule.isBca };
    }
  }

  // Pure Digit Length & Pattern Heuristics
  if (digits.length === 13 && digits.startsWith('1')) {
    return { bankName: 'Mandiri', isBca: false };
  }
  if (digits.length === 15) {
    return { bankName: 'BRI', isBca: false };
  }
  if (digits.length === 14) {
    return { bankName: 'CIMB Niaga', isBca: false };
  }
  if (digits.length === 12) {
    return { bankName: 'SeaBank / Digital Bank', isBca: false };
  }
  if (digits.length === 16) {
    return { bankName: 'Permata / BTN', isBca: false };
  }
  if (digits.length === 10) {
    if (digits.startsWith('7')) {
      return { bankName: 'BSI', isBca: false };
    }
    // Default 10 digits perorangan is BCA
    return { bankName: 'BCA', isBca: true };
  }

  // Fallback default
  return { bankName: 'BCA', isBca: true };
}

/**
 * Formats recipient input into standard: "[Nama] - [Bank] [Nomor Rekening]"
 */
export function formatRecipientDetail(
  recipientName: string,
  bankName: string,
  accountNumber: string
): string {
  const cleanName = recipientName.trim();
  const cleanBank = bankName.trim() || 'BCA';
  const cleanAcc = accountNumber.trim().replace(/\D/g, '');

  if (!cleanName && !cleanAcc) return '';
  if (!cleanName) return `${cleanBank} ${cleanAcc}`.trim();
  if (!cleanAcc) return cleanName;

  return `${cleanName} - ${cleanBank} ${cleanAcc}`;
}

/**
 * Parses a raw recipient string like "PT Santika - BCA 0123456789" or "PT Santika 0123456789"
 */
export function parseRecipientString(rawInput: string): BankDetectionResult {
  const input = rawInput.trim();
  if (!input) {
    return {
      bankName: 'BCA',
      accountNumber: '',
      recipientName: '',
      isBca: true,
      suggestedJalur: 'sesama_bca',
      formattedDetail: '',
    };
  }

  // Check if input is formatted as "[Name] - [Bank] [Acc]"
  const dashParts = input.split(' - ');
  if (dashParts.length >= 2) {
    const namePart = dashParts[0].trim();
    const restPart = dashParts.slice(1).join(' - ').trim();

    const numMatch = restPart.match(/([\d\s]{8,20})/);
    const accountNumber = numMatch ? numMatch[1].replace(/\s/g, '') : '';
    const bankText = numMatch ? restPart.replace(numMatch[1], '').trim() : restPart;

    const detected = detectBankFromAccountNumber(accountNumber, bankText || input);
    const bankName = bankText || detected.bankName;
    const isBca = detected.isBca || bankName.toUpperCase().includes('BCA');

    return {
      bankName,
      accountNumber,
      recipientName: namePart,
      isBca,
      suggestedJalur: isBca ? 'sesama_bca' : 'bi_fast',
      formattedDetail: formatRecipientDetail(namePart, bankName, accountNumber),
    };
  }

  // Loose format: Extract numbers
  const accMatch = input.match(/(\d{8,18})/);
  const accountNumber = accMatch ? accMatch[1] : '';
  const recipientName = accMatch ? input.replace(accMatch[1], '').replace(/[-–]/g, '').trim() : input;

  const detected = detectBankFromAccountNumber(accountNumber, input);

  return {
    bankName: detected.bankName,
    accountNumber,
    recipientName,
    isBca: detected.isBca,
    suggestedJalur: detected.isBca ? 'sesama_bca' : 'bi_fast',
    formattedDetail: formatRecipientDetail(recipientName, detected.bankName, accountNumber),
  };
}

/**
 * Extracts unique historical recipient strings from transactions list
 */
export function extractHistoricalRecipients(transactions: any[]): string[] {
  const set = new Set<string>();

  for (const t of transactions) {
    if (t.penerimaDetail && typeof t.penerimaDetail === 'string' && t.penerimaDetail.trim()) {
      set.add(t.penerimaDetail.trim());
    }
  }

  return Array.from(set);
}
