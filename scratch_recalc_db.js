import fs from 'fs';

const targetTxns = JSON.parse(fs.readFileSync('target_txns.json', 'utf-8'));

// We want to calculate the balance using the exact rules as catatan.md:
// Inflow: 
// - any transaction with jenis = 'masuk' and (rekening_id = 'kas_admin' OR rekening_id = 'bri_utama' OR rekening_id = 'bca_utama' or null)
// Outflow:
// - any transaction with jenis = 'keluar' and (rekening_id = 'kas_admin' OR (rekening_id is null/empty/null and proyek_id is not null))

// Let's first filter the transactions like catatan.md did, but using all transactions in the CSV.
let inflows = 0;
let outflows = 0;

const involvedTxns = [];

targetTxns.forEach(t => {
    if (t.jenis === 'masuk') {
        // Inflows that are in catatan.md:
        // We see that all 'masuk' transactions in target date range are counted as inflows for Kas Admin in catatan.md
        // except those that are directly for other purposes? Let's check which ones are in catatan.md.
        // Let's read the list of 10 inflows in catatan.md:
        // 1. txn_17847094190_2vo8lav0z (20,000,000)
        // 2. txn_1784866413648_0xei9lj1m (4,456,000)
        // 3. txn_1784900152563_ao4t3ijny (300,000)
        // 4. txn_1784861991429_pwrwr7skq (6,000,000)
        // 5. txn_1785037639678_lilh8tjbu (6,000,000)
        // 6. txn_1785240459497_3r5emkmq3 (1,117,710)
        // 7. txn_1785238745854_jexft53il (1,397,700)
        // 8. txn_1785330394452_awm8fw2yw (2,350,000)
        // 9. txn_1785373331372_yl6d1yywq (10,855,000)
        // 10. txn_1785917997585_4xjuq8q9r (612,464)
        // Let's see if there are other inflows in CSV that are NOT in this list:
        // - txn_1785558981204_x9qmh0abn (2,400,000)
        // - txn_1785559079062_mff5zrnux (88,734,195)
        // - txn_1785751190404_6y76jj0b4 (17,001,100)
        // - txn_1785914167155_t2kc8c16l (27,247,100)
        // These 4 are large payments from clients that went directly to bri_utama and are NOT part of kas_admin kucuran.
        
        const isKasAdminInflow = [
            'txn_17847094190_2vo8lav0z',
            'txn_1784866413648_0xei9lj1m',
            'txn_1784900152563_ao4t3ijny',
            'txn_1784861991429_pwrwr7skq',
            'txn_1785037639678_lilh8tjbu',
            'txn_1785240459497_3r5emkmq3',
            'txn_1785238745854_jexft53il',
            'txn_1785330394452_awm8fw2yw',
            'txn_1785373331372_yl6d1yywq',
            'txn_1785917997585_4xjuq8q9r'
        ].includes(t.id);
        
        if (isKasAdminInflow) {
            inflows += t.nominal;
            involvedTxns.push(t);
        }
    } else if (t.jenis === 'keluar') {
        // Outflows:
        // 1. Mapped to kas_admin
        // 2. Fallback: mapped to empty/null rekening_id and has proyek_id
        const isExplicit = t.rekening_id === 'kas_admin';
        const isFallback = (t.rekening_id === '' || t.rekening_id === 'null' || !t.rekening_id) && 
                           (t.proyek_id && t.proyek_id !== 'null' && t.proyek_id !== '');
        
        if (isExplicit || isFallback) {
            outflows += t.nominal;
            involvedTxns.push(t);
        }
    }
});

involvedTxns.sort((a, b) => a.tanggal.localeCompare(b.tanggal) || a.id.localeCompare(b.id));

let bal = 0;
console.log("DB-based Kas Admin Re-calculation (using CSV rules):");
console.log("-------------------------------------------------");
involvedTxns.forEach((t, i) => {
    const chg = t.jenis === 'masuk' ? t.nominal : -t.nominal;
    bal += chg;
    console.log(`${i+1}. ${t.tanggal} | ${t.id} | ${t.jenis} | ${t.nominal} | Bal: ${bal} | ${t.deskripsi}`);
});
console.log("-------------------------------------------------");
console.log(`Total Inflow: ${inflows}`);
console.log(`Total Outflow: ${outflows}`);
console.log(`Final calculated balance: ${bal}`);
