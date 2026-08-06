import fs from 'fs';

const targetTxns = JSON.parse(fs.readFileSync('target_txns.json', 'utf-8'));

// Filter candidates: outgoing, and either explicitly kas_admin or fallback project expenses
// We exclude transactions that are verified to be on the statement:
// - txn_1785917459427_6xot817a2 (Traveloka 602.100)
// - txn_1785501116331_1kcaqbp8x (Hotel 900.000 / 899.000)
// - txn_1785915919363_zdfb4z42u (Reimbursement Kates 379.000)
// - txn_1785915919370_xx5uxjrrc (BI-FAST 2.500)
// - txn_1785917764959_2u4e3jdv3 (Konsumsi Angga 200.000)
// - txn_1785579076294_7wccrhgeq (AGB Galon 90.000)
// - txn_1785582926565_3ze8jau0j (Reimburse Ziar and Kates 4.282.981)

const verifiedIds = [
    'txn_1785917459427_6xot817a2',
    'txn_1785501116331_1kcaqbp8x',
    'txn_1785915919363_zdfb4z42u',
    'txn_1785915919370_xx5uxjrrc',
    'txn_1785917764959_2u4e3jdv3',
    'txn_1785579076294_7wccrhgeq',
    'txn_1785582926565_3ze8jau0j'
];

const candidates = targetTxns.filter(t => {
    if (t.jenis !== 'keluar') return false;
    if (verifiedIds.includes(t.id)) return false;
    const isExplicit = t.rekening_id === 'kas_admin';
    const isFallback = (t.rekening_id === '' || t.rekening_id === 'null' || !t.rekening_id) && 
                       (t.proyek_id && t.proyek_id !== 'null' && t.proyek_id !== '');
    return isExplicit || isFallback;
});

const target = 11518540 - 9450618; // 2067922

candidates.sort((a, b) => b.nominal - a.nominal);

let bestDiff = Infinity;
let bestCombo = [];

function search(index, currentSum, path) {
    const diff = Math.abs(currentSum - target);
    if (diff < bestDiff) {
        bestDiff = diff;
        bestCombo = path;
        if (diff === 0) return true;
    }
    
    if (currentSum >= target + bestDiff) return false;
    if (path.length >= 8) return false; // allow up to 8 items
    
    for (let i = index; i < candidates.length; i++) {
        const found = search(i + 1, currentSum + candidates[i].nominal, path.concat(candidates[i]));
        if (found) return true;
    }
    return false;
}

search(0, 0, []);

console.log("\n================ BEST COMBINATION (EXCLUDING VERIFIED) ================");
console.log(`Difference: ${bestDiff}`);
let total = 0;
bestCombo.forEach(t => {
    total += t.nominal;
    console.log(`- Date: ${t.tanggal} | ID: ${t.id} | Amt: ${t.nominal} | Desc: ${t.deskripsi}`);
});
console.log(`Total sum: ${total}`);
