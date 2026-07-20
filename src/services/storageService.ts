// ============================================================
// ARKA Finance — Storage Service (Pure Google Drive Integration)
// ============================================================

import { uploadToGoogleDrive } from './googleDriveService';
import { type Attachment } from '../types';

export interface UploadContext {
  tanggal: string; // ISO date YYYY-MM-DD
  proyekNama?: string;
  tag?: string;
}

/**
 * Generates structured folder path:
 * e.g., "2026/07-Juli/Proyek_A/1721500000_struk.pdf"
 */
export function buildFolderPath(fileName: string, context: UploadContext): string {
  const dateObj = new Date(context.tanggal || Date.now());
  const year = dateObj.getFullYear();
  const monthNum = String(dateObj.getMonth() + 1).padStart(2, '0');
  const monthNames = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];
  const monthName = monthNames[dateObj.getMonth()];
  const monthFolder = `${monthNum}-${monthName}`;

  const subFolder = context.proyekNama
    ? context.proyekNama.replace(/[^a-zA-Z0-9_-]/g, '_')
    : context.tag === 'pribadi' ? 'Pribadi_Owner' : 'Operasional';

  const cleanFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  const timeStamp = Date.now();

  return `${year}/${monthFolder}/${subFolder}/${timeStamp}_${cleanFileName}`;
}

/**
 * Uploads attachment file strictly to Google Drive.
 */
export async function uploadAttachmentFile(
  file: File,
  context: UploadContext
): Promise<Attachment> {
  return await uploadToGoogleDrive(file, context);
}
