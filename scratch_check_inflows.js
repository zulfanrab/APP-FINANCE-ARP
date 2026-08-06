import fs from 'fs';

const targetTxns = JSON.parse(fs.readFileSync('target_txns.json', 'utf-8'));

const inflowIds = [
    'txn_1784747094190_2vo8lav0z',
    'txn_1784861991429_pwrwr7skq',
    'txn_1784866413648_0xei9lj1m',
    'txn_1785037639678_lilh8tjbu',
    'txn_1785240459497_3r5emkmq3',
    'txn_1785238745854_jexft53il',
    'txn_1785330394452_awm8fw2yw',
    'txn_1785373331372_yl6d1yywq'
];

console.log("Inflow fields in DB:");
targetTxns.filter(t => inflowIds.includes(t.id)).forEach(t => {
    console.log(`- ID: ${t.id} | RekeningId: ${t.rekening_id} | RekeningTujuanId: ${t.rekening_tujuan_id} | Kategori: ${t.kategori} | Nominal: ${t.nominal} | Desc: ${t.deskripsi}`);
});
