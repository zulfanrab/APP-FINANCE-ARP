import fs from 'fs';
import path from 'path';

const downloads = 'C:\\Users\\colorful\\Downloads';
const files = [
    'WhatsApp Image 2026-08-05 at 15.58.08.jpeg.txt',
    'WhatsApp Image 2026-08-05 at 15.58.08 (1).jpeg.txt',
    'WhatsApp Image 2026-08-05 at 15.58.08 (2).jpeg.txt',
    'WhatsApp Image 2026-08-05 at 15.58.09.jpeg.txt',
    'WhatsApp Image 2026-08-05 at 15.58.09 (1).jpeg.txt',
    'WhatsApp Image 2026-08-05 at 15.58.09 (2).jpeg.txt',
    'WhatsApp Image 2026-08-05 at 15.58.09 (3).jpeg.txt'
];

files.forEach(f => {
    const filePath = path.join(downloads, f);
    if (fs.existsSync(filePath)) {
        console.log(`\n=================== FILE: ${f} ===================`);
        console.log(fs.readFileSync(filePath, 'utf-8'));
    }
});
