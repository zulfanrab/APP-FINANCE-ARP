import fs from 'fs';

// Let's load the transactions and projects from CSV files
const targetTxns = JSON.parse(fs.readFileSync('target_txns.json', 'utf-8'));

// Classification helpers based on financialEngine.ts / classifyTransaction:
// Let's write a simplified mock of classifyTransaction based on what we saw in catatan.md and the code.
// In catatan.md, the 'masuk' transactions that are considered "Mutasi Internal / Transfer Kas" are:
// - txn_1784747094190_2vo8lav0z
// - txn_1784866413648_0xei9lj1m
// - txn_1784861991429_pwrwr7skq
// - txn_1785037639678_lilh8tjbu
// - txn_1785240459497_3r5emkmq3
// - txn_1785238745854_jexft53il
// - txn_1785330394452_awm8fw2yw
// - txn_1785373331372_yl6d1yywq
// These have kategori = 'Mutasi Internal / Transfer Kas' or similar in DB.
// Let's verify what their kategori is.

function runEngine(modifiedTxnIds = []) {
    const accountBalances = {
        bca_utama: 0,
        bri_utama: 0,
        kas_admin: 0
    };
    
    // Sort transactions chronologically
    const sorted = [...targetTxns].sort((a, b) => a.tanggal.localeCompare(b.tanggal) || a.id.localeCompare(b.id));
    
    for (const t of sorted) {
        if (t.status !== 'selesai' && t.status !== 'disetujui' && t.status !== '') {
            // Note: in our filtered CSV, all have status 'selesai' or empty.
        }
        
        let rekeningId = t.rekening_id;
        if (modifiedTxnIds.includes(t.id)) {
            rekeningId = 'bca_utama';
        }
        
        const isMutasiInternal = t.kategori === 'Mutasi Internal / Transfer Kas';
        
        if (isMutasiInternal) {
            const sourceAcc = rekeningId || 'bca_utama';
            const destAcc = t.rekening_tujuan_id || 'kas_admin';
            
            accountBalances[sourceAcc] -= t.nominal;
            accountBalances[destAcc] += t.nominal;
        } else {
            if (t.jenis === 'masuk') {
                const accId = rekeningId || 'bca_utama';
                accountBalances[accId] += t.nominal;
            } else {
                const accId = rekeningId || (t.proyek_id && t.proyek_id !== 'null' && t.proyek_id !== '' ? 'kas_admin' : 'bca_utama');
                accountBalances[accId] -= t.nominal;
            }
        }
    }
    
    return accountBalances;
}

// Let's see the initial balance:
console.log("Initial balances:", runEngine([]));

// We want to find which outgoing transactions with empty rekening_id and set proyek_id (which default to kas_admin)
// should be changed to bca_utama so that accountBalances.kas_admin is exactly 9450618.
// Let's filter candidate outgoing transactions:
const candidates = targetTxns.filter(t => {
    if (t.jenis !== 'keluar') return false;
    const isExplicit = t.rekening_id === 'kas_admin';
    const isFallback = (t.rekening_id === '' || t.rekening_id === 'null' || !t.rekening_id) && 
                       (t.proyek_id && t.proyek_id !== 'null' && t.proyek_id !== '');
    return isExplicit || isFallback;
});

console.log(`Searching for combinations among ${candidates.length} candidates...`);

// The current kas_admin balance is 11518540 (if we calculate like catatan.md did? Wait, let's look at initial balance).
const initialBalances = runEngine([]);
const currentBalance = initialBalances.kas_admin;
const target = 9450618;
const targetDiff = currentBalance - target; // In our case, we need to increase/decrease the balance.
// Wait! If we change an outflow of nominal X from kas_admin to bca_utama,
// the outflow is no longer subtracted from kas_admin.
// So the kas_admin balance will INCREASE by X.
// Therefore, the sum of nominals of the changed transactions must be exactly: target - currentBalance.
const requiredSum = target - currentBalance;
console.log(`Current DB kas_admin balance: ${currentBalance}`);
console.log(`Target kas_admin balance: ${target}`);
console.log(`Required sum of nominals to change to bca_utama: ${requiredSum}`);

// Let's find combinations of candidates that sum up to exactly requiredSum
const results = [];
function findCombo(arr, targetSum, partial = [], start = 0) {
    const sum = partial.reduce((s, item) => s + item.nominal, 0);
    if (sum === targetSum) {
        results.push(partial);
        return;
    }
    if (sum > targetSum) return;
    
    for (let i = start; i < arr.length; i++) {
        findCombo(arr, targetSum, partial.concat(arr[i]), i + 1);
    }
}

findCombo(candidates, requiredSum);

console.log(`Found ${results.length} matching combinations:`);
results.forEach((res, index) => {
    console.log(`\nCombination ${index+1}:`);
    res.forEach(t => {
        console.log(`  - ${t.tanggal} | ${t.id} | ${t.nominal} | ${t.deskripsi}`);
    });
    const testBal = runEngine(res.map(x => x.id));
    console.log(`  Verification Kas Admin Balance: ${testBal.kas_admin}`);
});
