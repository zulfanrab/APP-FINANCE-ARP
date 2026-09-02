const fs = require('fs');
let old_content = fs.readFileSync('old_PdfReportModal.tsx', 'utf8');
let current_content = fs.readFileSync('src/components/ui/PdfReportModal.tsx', 'utf8');

let old_match = old_content.match(/(  \/\/ Universal Hidden-Iframe Printing[\s\S]*?^  \};\r?\n)/m);
if (!old_match) { console.log('old not found'); process.exit(1); }
let old_handle = old_match[1];

let fix_code = \        if (fieldExpenseItems.length > 0) {
          attachmentsHtml += renderItemGrid(
            fieldExpenseItems,
            '?? BAGIAN C: STRUK, NOTA & BUKTI FISIK BELANJA LAPANGAN (Teknisi / Pelaksana / Operasional)'
          );
        }

        const uncategorizedItems = itemsToPrint.filter(i => !i.isClientPayment && !i.isDropDana && !i.isFieldExpense);
        if (uncategorizedItems.length > 0) {
          attachmentsHtml += renderItemGrid(
            uncategorizedItems,
            '?? BAGIAN D: DOKUMENTASI TAMBAHAN & LAINNYA'
          );
        }\;

old_handle = old_handle.replace(
    /        if \(fieldExpenseItems\.length > 0\) \{[\s\S]*?BAGIAN C[\s\S]*?\}\s*if \(clientPaymentItems.*?LAMPIRAN BUKTI TRANSAKSI & STRUK.*?\}/,
    fix_code
);

// update timeout
old_handle = old_handle.replace(/, 2500\);/g, ', 8000);');

let current_match = current_content.match(/(  \/\/ Universal Hidden-Iframe Printing[\s\S]*?^  \};\r?\n)/m);
if (!current_match) { console.log('current not found'); process.exit(1); }
let current_handle = current_match[1];

let new_content = current_content.replace(current_handle, old_handle);

let css_fix = \            .accounting-page-container {
              page-break-inside: avoid !important;
              break-inside: avoid !important;
            }
            .on-screen-gallery { display: none !important; }\;

new_content = new_content.replace(
    /            \.accounting-page-container \{\s*page-break-inside: avoid !important;\s*break-inside: avoid !important;\s*\}/,
    css_fix
);

fs.writeFileSync('src/components/ui/PdfReportModal.tsx', new_content, 'utf8');
console.log('Done');
