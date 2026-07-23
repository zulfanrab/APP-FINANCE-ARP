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
 * Processes and compresses file (Image or PDF) into a clean Attachment object.
 * Images are scaled to max 1400px and compressed via Canvas to ~150-250KB JPEG base64.
 * PDFs are converted to base64 Data URLs.
 */
export async function compressFileToAttachment(file: File): Promise<Attachment> {
  const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
  const mimeType = isPdf
    ? 'application/pdf'
    : (file.type || (file.name.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg'));

  if (isPdf) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => {
        resolve({
          nama: file.name,
          tipe: 'application/pdf',
          dataUrl: reader.result as string,
        });
      };
      reader.onerror = () => {
        resolve({
          nama: file.name,
          tipe: 'application/pdf',
          dataUrl: '',
        });
      };
      reader.readAsDataURL(file);
    });
  }

  // Handle Images (compress via canvas)
  return new Promise((resolve) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const MAX_DIM = 1400;
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
        const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.80);
        resolve({
          nama: file.name,
          tipe: 'image/jpeg',
          dataUrl: compressedDataUrl,
        });
      } else {
        readAsDataUrlFallback(file, mimeType, resolve);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      readAsDataUrlFallback(file, mimeType, resolve);
    };
    img.src = objectUrl;
  });
}

function readAsDataUrlFallback(file: File, mimeType: string, resolve: (att: Attachment) => void) {
  const reader = new FileReader();
  reader.onload = () => {
    resolve({
      nama: file.name,
      tipe: mimeType,
      dataUrl: reader.result as string,
    });
  };
  reader.onerror = () => {
    resolve({
      nama: file.name,
      tipe: mimeType,
      dataUrl: '',
    });
  };
  reader.readAsDataURL(file);
}

/**
 * Uploads attachment file safely with multi-tiered fallback.
 * First tries Google Drive (if configured).
 * If Google Drive is unconfigured or fails (due to CORS/Network/Webhook error on mobile),
 * it seamlessly falls back to compressed local DataURL.
 */
export async function uploadAttachmentFile(
  file: File,
  context: UploadContext
): Promise<Attachment> {
  const localProcessed = await compressFileToAttachment(file);

  if (isGoogleDriveConfigured) {
    try {
      const drivePromise = uploadToGoogleDrive(file, context);
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Drive upload timeout')), 12000)
      );
      const driveResult = await Promise.race([drivePromise, timeoutPromise]);
      if (driveResult && driveResult.dataUrl) {
        return driveResult;
      }
    } catch (err) {
      console.warn('Google Drive upload warning (falling back to compressed DataURL):', err);
    }
  }

  return localProcessed;
}
