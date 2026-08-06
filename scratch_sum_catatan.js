import fs from 'fs';

function parseCatatan() {
    const content = fs.readFileSync('catatan.md', 'utf-8');
    const lines = content.split('\n');
    const transactions = [];
    
    lines.forEach(line => {
        if (line.includes('txn_')) {
            const parts = line.split('|');
            if (parts.length >= 9) {
                const no = parts[1].trim();
                const tanggal = parts[2].trim();
                const id = parts[3].trim().replace(/`/g, '');
                const deskripsi = parts[4].trim();
                const jenis_kategori = parts[5].trim();
                const nominalStr = parts[6].trim()
                    .replace('Rp', '')
                    .replace(/\./g, '')
                    .replace(/\s/g, '')
                    .replace('-', '')
                    .trim();
                const nominal = parseFloat(nominalStr);
                const saku = parts[7].trim().replace(/`/g, '');
                transactions.push({ no, tanggal, id, deskripsi, jenis_kategori, nominal, saku });
            }
        }
    });
    return transactions;
}

const catatanTxns = parseCatatan();
let totalMasuk = 0;
let totalKeluar = 0;
catatanTxns.forEach(t => {
    if (t.jenis_kategori.includes('MASUK') || t.jenis_kategori.includes('PEMASUKAN')) {
        totalMasuk += t.nominal;
    } else {
        totalKeluar += t.nominal;
    }
});

console.log(`Catatan.md Totals:`);
console.log(`Total Masuk: ${totalMasuk}`);
console.log(`Total Keluar: ${totalKeluar}`);
console.log(`Net Balance: ${totalMasuk - totalKeluar}`);
