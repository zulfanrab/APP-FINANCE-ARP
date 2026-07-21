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

function compressImageIfNeeded(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    return fileToBase64(file);
  }
  return new Promise(resolve => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const MAX_DIM = 1600;
      let w = img.width;
      let h = img.height;
      if (w > MAX_DIM || h > MAX_DIM) {
        if (w > h) {
          h = Math.round((h * MAX_DIM) / w);
          w = MAX_DIM;
        } else {
          w = Math.round((w * MAX_DIM) / h);
          h = MAX_DIM;
        }
      }
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.82);
        resolve(compressedDataUrl.split(',')[1]);
      } else {
        fileToBase64(file).then(resolve);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      fileToBase64(file).then(resolve);
    };
    img.src = objectUrl;
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

  const base64 = await compressImageIfNeeded(file);
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
