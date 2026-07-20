// ============================================================
// ARKA Finance — Storage Service (Google Drive & Cloud Upload)
// ============================================================

import { supabase, isSupabaseConfigured } from './supabase';
import { uploadToGoogleDrive, isGoogleDriveConfigured } from './googleDriveService';
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
 * Priority 1: Google Drive (if configured)
 * Priority 2: Supabase Storage (if configured)
 * Priority 3: Base64 DataUrl
 */
export async function uploadAttachmentFile(
  file: File,
  context: UploadContext
): Promise<Attachment> {
  // 1. Try Google Drive Direct Upload
  if (isGoogleDriveConfigured) {
    const gdriveResult = await uploadToGoogleDrive(file, context);
    if (gdriveResult) {
      return gdriveResult;
    }
  }

  // 2. Try Supabase Storage Upload
  const filePath = buildFolderPath(file.name, context);
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase.storage
        .from('attachments')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true,
        });

      if (!error && data) {
        const { data: publicUrlData } = supabase.storage
          .from('attachments')
          .getPublicUrl(data.path);

        return {
          nama: file.name,
          tipe: file.type,
          dataUrl: publicUrlData.publicUrl,
        };
      }
    } catch (err) {
      console.warn('Supabase storage upload failed:', err);
    }
  }

  // 3. Fallback: Base64 DataUrl
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = ev => resolve(ev.target?.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  return {
    nama: file.name,
    tipe: file.type,
    dataUrl,
  };
}
