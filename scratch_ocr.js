import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const Tesseract = require('tesseract.js');

const downloads = 'C:\\Users\\colorful\\Downloads';

async function ocrImage(filename) {
    const filePath = path.join(downloads, filename);
    console.log(`Processing OCR for ${filename}...`);
    try {
        const result = await Tesseract.recognize(filePath, 'ind+eng');
        const text = result.data.text;
        console.log(`OCR complete for ${filename}. Saving text...`);
        fs.writeFileSync(path.join(downloads, `${filename}.txt`), text);
    } catch (err) {
        console.error(`Error processing ${filename}:`, err);
    }
}

async function run() {
    const files = [
        'WhatsApp Image 2026-08-05 at 15.58.08.jpeg',
        'WhatsApp Image 2026-08-05 at 15.58.08 (1).jpeg',
        'WhatsApp Image 2026-08-05 at 15.58.08 (2).jpeg',
        'WhatsApp Image 2026-08-05 at 15.58.09.jpeg',
        'WhatsApp Image 2026-08-05 at 15.58.09 (1).jpeg',
        'WhatsApp Image 2026-08-05 at 15.58.09 (2).jpeg',
        'WhatsApp Image 2026-08-05 at 15.58.09 (3).jpeg'
    ];
    for (const f of files) {
        await ocrImage(f);
    }
    console.log("All OCR jobs done!");
}

run();
