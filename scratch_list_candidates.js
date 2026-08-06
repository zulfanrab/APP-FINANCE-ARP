import fs from 'fs';

const targetTxns = JSON.parse(fs.readFileSync('target_txns.json', 'utf-8'));

// Filter outgoing transactions that are mapped to kas_admin or default (rekening_id is null/empty and proyek_id not null)
const candidateTxns = targetTxns.filter(t => {
    if (t.jenis !== 'keluar') return false;
    const isExplicit = t.rekening_id === 'kas_admin';
    const isFallback = (t.rekening_id === '' || t.rekening_id === 'null' || !t.rekening_id) && 
                       (t.proyek_id && t.proyek_id !== 'null' && t.proyek_id !== '');
    return isExplicit || isFallback;
});

console.log("ALL KAS ADMIN OUTGOING CANDIDATES:");
candidateTxns.forEach(t => {
    console.log(`- Date: ${t.tanggal} | ID: ${t.id} | Amt: ${t.nominal} | Rek: ${t.rekening_id || 'NULL'} | Project: ${t.proyek_id} | Desc: ${t.deskripsi}`);
});
