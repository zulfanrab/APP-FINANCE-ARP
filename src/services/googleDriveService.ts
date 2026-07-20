// ============================================================
// ARKA Finance — Direct Google Drive Upload Service
// ============================================================

import { buildFolderPath, type UploadContext } from './storageService';
import { type Attachment } from '../types';

const driveWebhookUrl = import.meta.env.VITE_GOOGLE_DRIVE_WEBHOOK_URL as string | undefined;

export const isGoogleDriveConfigured = Boolean(driveWebhookUrl && driveWebhookUrl.startsWith('http'));

/**
 * Converts File to Base64 string (without Data URL prefix)
 */
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1]; // remove data:image/...;base64,
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Uploads a file directly into your Google Drive folder structure.
 */
export async function uploadToGoogleDrive(
  file: File,
  context: UploadContext
): Promise<Attachment | null> {
  if (!isGoogleDriveConfigured || !driveWebhookUrl) {
    return null;
  }

  try {
    const base64 = await fileToBase64(file);
    const relativePath = buildFolderPath(file.name, context);
    const folderPath = `ARKA Finance/${relativePath.substring(0, relativePath.lastIndexOf('/'))}`;

    const response = await fetch(driveWebhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8', // Google Apps Script requires text/plain or no CORS preflight block
      },
      body: JSON.stringify({
        name: file.name,
        type: file.type,
        base64: base64,
        folderPath: folderPath,
      }),
    });

    const resData = await response.json();

    if (resData && resData.success && resData.fileUrl) {
      return {
        nama: file.name,
        tipe: file.type,
        dataUrl: resData.fileUrl,
      };
    } else {
      console.warn('Google Drive Upload Error Response:', resData);
      return null;
    }
  } catch (err) {
    console.error('Google Drive Upload Exception:', err);
    return null;
  }
}
