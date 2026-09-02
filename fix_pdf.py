import re

with open('old_PdfReportModal.tsx', 'r', encoding='utf-8') as f:
    old_content = f.read()
with open('src/components/ui/PdfReportModal.tsx', 'r', encoding='utf-8') as f:
    current_content = f.read()

old_handle_print_match = re.search(r'(  // Universal Hidden-Iframe Printing.*?^  \};)\n', old_content, re.DOTALL | re.MULTILINE)
if not old_handle_print_match:
    print("Could not find old handlePrint")
    exit(1)
old_handle_print = old_handle_print_match.group(1)

fix_code = '''        if (fieldExpenseItems.length > 0) {
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
        }'''
old_handle_print = re.sub(
    r'        if \(fieldExpenseItems\.length > 0\) \{.*?BAGIAN C.*?\}\s*if \(clientPaymentItems.*?LAMPIRAN BUKTI TRANSAKSI & STRUK.*?\}',
    fix_code,
    old_handle_print,
    flags=re.DOTALL
)

# Update iframe timeout in old_handle_print to 8000 (from 2500)
old_handle_print = re.sub(r'setTimeout\(\(\) => \{\n        if \(\!hasPrinted\)', r'setTimeout(() => {\\n        if (!hasPrinted)', old_handle_print)
old_handle_print = old_handle_print.replace(', 2500);', ', 8000);')

current_handle_print_match = re.search(r'(  // Universal Hidden-Iframe Printing.*?^  \};)\n', current_content, re.DOTALL | re.MULTILINE)
if not current_handle_print_match:
    print("Could not find current handlePrint")
    exit(1)
current_handle_print = current_handle_print_match.group(1)

new_content = current_content.replace(current_handle_print, old_handle_print)

# Add on-screen-gallery hide CSS to old_handle_print CSS
css_fix = '''            .accounting-page-container {
              page-break-inside: avoid !important;
              break-inside: avoid !important;
            }
            .on-screen-gallery { display: none !important; }'''
new_content = re.sub(
    r'            \.accounting-page-container \{\s*page-break-inside: avoid !important;\s*break-inside: avoid !important;\s*\}',
    css_fix,
    new_content,
    flags=re.DOTALL
)

with open('src/components/ui/PdfReportModal.tsx', 'w', encoding='utf-8') as f:
    f.write(new_content)

print("Done")
