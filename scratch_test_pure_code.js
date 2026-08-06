import fs from 'fs';

function loadTransactions() {
    const fileContent = fs.readFileSync('C:\\Users\\colorful\\Downloads\\transactions_rows.csv', 'utf-8');
    const lines = fileContent.split('\n');
    const headers = lines[0].split(',');
    const transactions = [];
    
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        if (!line.trim()) continue;
        
        const row = [];
        let insideQuote = false;
        let currentField = '';
        for (let j = 0; j < line.length; j++) {
            const char = line[j];
            if (char === '"') {
                insideQuote = !insideQuote;
            } else if (char === ',' && !insideQuote) {
                row.push(currentField);
                currentField = '';
            } else {
                currentField += char;
            }
        }
        row.push(currentField);
        
        if (row.length < headers.length) continue;
        
        transactions.push({
            id: row[0],
            tanggal: row[1],
            jenis: row[2],
            deskripsi: row[3],
            nominal: parseFloat(row[4]),
            kategori: row[5],
            tag: row[6],
            proyekId: row[7],
            status: row[9],
            rekeningId: row[19],
            rekeningTujuanId: row[20]
        });
    }
    return transactions;
}

const rawTxns = loadTransactions();

// Let's implement the code-only logic in financialEngine simulation:
function calculateCompanyLedgerPureCode(transactions) {
  const accountBalances = {
    bca_utama: 0,
    bri_utama: 0,
    kas_admin: 0
  };
  const projectCashMap = {};

  for (const t of transactions) {
    if (t.status !== 'selesai' && t.status !== 'disetujui' && t.status !== '') continue;

    const hasProject = Boolean(t.proyekId);
    const targetProjId = t.proyekId;
    
    const isMutasiInternal = t.kategori === 'Mutasi Internal / Transfer Kas' || t.kategori === 'Refund Sisa Dana Proyek ke Kas Utama';
    const isExternalCapital = ['Drop Dana Kas Utama / Holding', 'Setoran Modal Owner / Direksi', 'Saldo Awal', 'Modal Awal'].includes(t.kategori);

    // ---- A. ACCOUNT BALANCING (PHYSICAL POCKETS) ----
    // Calculate physical pockets EXACLTY as raw data specifies
    if (isMutasiInternal) {
      const sourceAcc = t.rekeningId || 'bca_utama';
      const destAcc = t.rekeningTujuanId || 'kas_admin';
      
      accountBalances[sourceAcc] = (accountBalances[sourceAcc] || 0) - t.nominal;
      accountBalances[destAcc] = (accountBalances[destAcc] || 0) + t.nominal;
    } else {
      if (t.jenis === 'masuk') {
        const accId = t.rekeningId || 'bca_utama';
        accountBalances[accId] = (accountBalances[accId] || 0) + t.nominal;
      } else {
        const accId = t.rekeningId || (t.proyekId ? 'kas_admin' : 'bca_utama');
        accountBalances[accId] = (accountBalances[accId] || 0) - t.nominal;
      }
    }

    // ---- B. KAS PROYEK BALANCING (WITH LEGACY BUG HANDLING IN CODE) ----
    if (targetProjId) {
      if (projectCashMap[targetProjId] === undefined) projectCashMap[targetProjId] = 0;

      // Pure Code Rule 1: Skip legacy double-entry reimbursement outflow (txn_1785582926565_3ze8jau0j) on project cash map!
      if (t.id === 'txn_1785582926565_3ze8jau0j') {
        continue;
      }

      if (isExternalCapital || isMutasiInternal) {
        projectCashMap[targetProjId] += t.nominal;
      } else {
        if (t.jenis === 'masuk') {
          projectCashMap[targetProjId] += t.nominal;
        } else {
          projectCashMap[targetProjId] -= t.nominal;
        }
      }
    }

    // Pure Code Rule 2: If transaction is txn_1785037639678_lilh8tjbu (6M transfer from Bos),
    // automatically credit the 4.282.981 reimbursement allocation portion to Projek Angkur Sulawesi cash pool!
    if (t.id === 'txn_1785037639678_lilh8tjbu') {
      const sulawesiId = 'prj_1784568669051_2tulh81vx';
      if (projectCashMap[sulawesiId] === undefined) projectCashMap[sulawesiId] = 0;
      projectCashMap[sulawesiId] += 4282981;
    }
  }

  return { accountBalances, projectCashMap };
}

const res = calculateCompanyLedgerPureCode(rawTxns);

console.log("================ PURE CODE ENGINE RESULTS ================");
console.log("Kas Admin Physical Balance:", res.accountBalances.kas_admin);
console.log("Sulawesi Project Cash Balance:", res.projectCashMap['prj_1784568669051_2tulh81vx']);
