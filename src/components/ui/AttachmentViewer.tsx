// ============================================================
// ARKA Finance — Attachment Viewer Component
// Renders Google Drive links and file previews seamlessly
// ============================================================

import React, { useState } from 'react';
import { Paperclip, ExternalLink, FileText, Image as ImageIcon, Eye, X } from 'lucide-react';
import { type Attachment } from '../../types';

interface AttachmentViewerProps {
  attachments: Attachment[];
  compact?: boolean;
}

export function AttachmentViewer({ attachments, compact = false }: AttachmentViewerProps) {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  if (!attachments || attachments.length === 0) return null;

  return (
    <div className="mt-2">
      <div className="flex flex-wrap items-center gap-2">
        {attachments.map((att, idx) => {
          const isGoogleDrive = att.dataUrl && att.dataUrl.includes('drive.google.com');
          const isImage = att.tipe?.startsWith('image') || (att.dataUrl && att.dataUrl.startsWith('data:image'));

          if (isGoogleDrive) {
            return (
              <a
                key={idx}
                href={att.dataUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 text-xs font-semibold transition-all active:scale-95 shadow-sm"
                title={`Buka ${att.nama} di Google Drive`}
              >
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <Paperclip size={13} className="text-emerald-600" />
                <span className="truncate max-w-[140px]">{att.nama}</span>
                <ExternalLink size={12} className="text-emerald-600 opacity-75" />
              </a>
            );
          }

          if (isImage) {
            return (
              <button
                key={idx}
                type="button"
                onClick={() => setSelectedImage(att.dataUrl)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-800 text-xs font-semibold transition-all active:scale-95 shadow-sm"
              >
                <ImageIcon size={13} className="text-blue-600" />
                <span className="truncate max-w-[140px]">{att.nama}</span>
                <Eye size={12} className="text-blue-600 opacity-75" />
              </button>
            );
          }

          return (
            <a
              key={idx}
              href={att.dataUrl}
              target="_blank"
              rel="noopener noreferrer"
              download={att.nama}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 border border-gray-200 text-gray-800 text-xs font-medium transition-all active:scale-95"
            >
              <FileText size={13} className="text-gray-600" />
              <span className="truncate max-w-[140px]">{att.nama}</span>
              <ExternalLink size={12} className="text-gray-500" />
            </a>
          );
        })}
      </div>

      {/* Image Modal Popup */}
      {selectedImage && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setSelectedImage(null)}
        >
          <div className="relative max-w-3xl w-full bg-white rounded-2xl overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="p-3 bg-gray-900 text-white flex items-center justify-between">
              <span className="text-xs font-medium flex items-center gap-2">
                <ImageIcon size={14} /> Preview Lampiran Gambar
              </span>
              <button onClick={() => setSelectedImage(null)} className="p-1 text-white/70 hover:text-white">
                <X size={18} />
              </button>
            </div>
            <div className="p-4 max-h-[80vh] overflow-auto flex items-center justify-center bg-gray-100">
              <img src={selectedImage} alt="Preview Lampiran" className="max-w-full max-h-[70vh] object-contain rounded-lg shadow-md" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
