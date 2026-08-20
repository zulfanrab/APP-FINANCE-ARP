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
 * Images are scaled to max 900px and compressed via Canvas to ~100-200KB JPEG base64.
 * PDFs are converted to base64 Data URLs with strict timeout safeguards.
 */
export async function compressFileToAttachment(file: File): Promise<Attachment> {
  const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
  const mimeType = isPdf
    ? 'application/pdf'
    : (file.type || (file.name.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg'));

  const processingPromise = new Promise<Attachment>((resolve) => {
    if (isPdf) {
      const reader = new FileReader();
      reader.onload = () => {
        resolve({
          nama: file.name,
          tipe: 'application/pdf',
          dataUrl: (reader.result as string) || '',
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
      return;
    }

    // Handle Images (compress via canvas)
    setTimeout(() => {
      let objectUrl = '';
      try {
        objectUrl = URL.createObjectURL(file);
      } catch {
        readAsDataUrlFallback(file, mimeType, resolve);
        return;
      }

      const img = new Image();
      img.onload = () => {
        try {
          URL.revokeObjectURL(objectUrl);
        } catch { /* ignore */ }

        const MAX_DIM = 900;
        let w = img.width || 800;
        let h = img.height || 600;
        if (w > MAX_DIM || h > MAX_DIM) {
          if (w > h) {
            h = Math.round((h * MAX_DIM) / w);
            w = MAX_DIM;
          } else {
            w = Math.round((w * MAX_DIM) / h);
            h = MAX_DIM;
          }
        }
        try {
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, w, h);
            ctx.drawImage(img, 0, 0, w, h);
            const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.60);
            resolve({
              nama: file.name,
              tipe: 'image/jpeg',
              dataUrl: compressedDataUrl,
            });
            return;
          }
        } catch {
          // Canvas failure fallback
        }
        readAsDataUrlFallback(file, mimeType, resolve);
      };
      img.onerror = () => {
        try {
          URL.revokeObjectURL(objectUrl);
        } catch { /* ignore */ }
        readAsDataUrlFallback(file, mimeType, resolve);
      };
      img.src = objectUrl;
    }, 5);
  });

  // Safety Timeout: Never let compression freeze or hang the UI (max 4.5s)
  const timeoutFallback = new Promise<Attachment>((resolve) => {
    setTimeout(() => {
      resolve({
        nama: file.name,
        tipe: mimeType,
        dataUrl: '',
      });
    }, 4500);
  });

  return Promise.race([processingPromise, timeoutFallback]);
}

function readAsDataUrlFallback(file: File, mimeType: string, resolve: (att: Attachment) => void) {
  try {
    const reader = new FileReader();
    reader.onload = () => {
      resolve({
        nama: file.name,
        tipe: mimeType,
        dataUrl: (reader.result as string) || '',
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
  } catch {
    resolve({
      nama: file.name,
      tipe: mimeType,
      dataUrl: '',
    });
  }
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
        setTimeout(() => reject(new Error('Drive upload timeout')), 3500)
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
