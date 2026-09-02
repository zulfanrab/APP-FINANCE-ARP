const fs = require('fs');
let old_content = fs.readFileSync('old_PdfReportModal.tsx', 'utf8');
let current_content = fs.readFileSync('src/components/ui/PdfReportModal.tsx', 'utf8');

// Match handlePrint exactly
let start_idx = old_content.indexOf('  const handlePrint = async');
let end_idx = old_content.indexOf('  };', start_idx) + 4;
let old_handle = old_content.slice(start_idx, end_idx);

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

// We must also merge the image preloader improvements from current_handle_print into old_handle!
// Actually, it's easier to just take the current file and insert the itemsToPrint logic.
