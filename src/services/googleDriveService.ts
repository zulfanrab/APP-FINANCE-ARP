// ============================================================
// ARKA Finance — Direct Google Drive Upload Service (Pure Drive)
// ============================================================

import { buildFolderPath, type UploadContext } from './storageService';
import { type Attachment } from '../types';

const driveWebhookUrl = import.meta.env.VITE_GOOGLE_DRIVE_WEBHOOK_URL as string | undefined;

export const isGoogleDriveConfigured = Boolean(driveWebhookUrl && driveWebhookUrl.startsWith('http'));

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Uploads a file directly into Google Drive.
 * Throws informative errors if permission or configuration issues occur.
 */
export async function uploadToGoogleDrive(
  file: File,
  context: UploadContext
): Promise<Attachment> {
  if (!driveWebhookUrl) {
    throw new Error('Variabel VITE_GOOGLE_DRIVE_WEBHOOK_URL belum dikonfigurasi di Vercel');
  }

  const base64 = await fileToBase64(file);
  const relativePath = buildFolderPath(file.name, context);
  const folderPath = `ARKA Finance/${relativePath.substring(0, relativePath.lastIndexOf('/'))}`;

  const response = await fetch(driveWebhookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain;charset=utf-8',
    },
    body: JSON.stringify({
      name: file.name,
      type: file.type,
      base64: base64,
      folderPath: folderPath,
    }),
  });

  if (response.status === 403) {
    throw new Error(
      'Google Drive 403 Forbidden: Di Google Apps Script, ganti "Who has access" (Siapa yang memiliki akses) menjadi "Anyone" (Siapa saja).'
    );
  }

  if (!response.ok) {
    throw new Error(`Google Drive HTTP Error: ${response.status} ${response.statusText}`);
  }

  let resData: any;
  try {
    resData = await response.json();
  } catch {
    throw new Error('Respons dari Google Drive Script bukan format JSON valid');
  }

  if (resData && resData.success && resData.fileUrl) {
    return {
      nama: file.name,
      tipe: file.type,
      dataUrl: resData.fileUrl,
    };
  } else {
    throw new Error(resData?.error || 'Gagal mengunggah file ke Google Drive');
  }
}
