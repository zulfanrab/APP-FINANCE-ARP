// ============================================================
// ARKA Finance — Direct Google Drive Upload Service (Robust)
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

  const payload = JSON.stringify({
    name: file.name,
    type: file.type,
    base64: base64,
    folderPath: folderPath,
  });

  try {
    const response = await fetch(driveWebhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: payload,
    });

    const responseText = await response.text();

    let resData: any;
    try {
      resData = JSON.parse(responseText);
    } catch {
      // If responseText contains a Drive file URL directly
      const driveMatch = responseText.match(/https:\/\/drive\.google\.com\/file\/d\/[a-zA-Z0-9_-]+/);
      if (driveMatch) {
        return {
          nama: file.name,
          tipe: file.type,
          dataUrl: driveMatch[0] + '/view?usp=sharing',
        };
      }
      throw new Error(`Google Drive Response Error: ${responseText.substring(0, 150)}`);
    }

    if (resData && resData.success && resData.fileUrl) {
      return {
        nama: file.name,
        tipe: file.type,
        dataUrl: resData.fileUrl,
      };
    } else if (resData && resData.fileUrl) {
      return {
        nama: file.name,
        tipe: file.type,
        dataUrl: resData.fileUrl,
      };
    } else {
      throw new Error(resData?.error || 'Gagal menyimpan file ke Google Drive');
    }
  } catch (err: any) {
    console.error('Google Drive Upload Exception:', err);
    throw new Error(err.message || 'Terjadi kesalahan saat mengunggah ke Google Drive');
  }
}
