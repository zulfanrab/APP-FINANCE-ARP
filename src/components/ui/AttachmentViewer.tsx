// ============================================================
// ARKA Finance — Luxury Attachment Viewer Component
// Ultra-sleek modal preview with zoom, rotate, and Google Drive links
// ============================================================

import React, { useState } from 'react';
import {
  Paperclip, ExternalLink, FileText, Image as ImageIcon, Eye, X,
  ZoomIn, ZoomOut, RotateCw, Maximize2, Download, CloudCheck
} from 'lucide-react';
import { type Attachment } from '../../types';

interface AttachmentViewerProps {
  attachments: Attachment[];
  compact?: boolean;
}

export function AttachmentViewer({ attachments }: AttachmentViewerProps) {
  const [activePreview, setActivePreview] = useState<Attachment | null>(null);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);

  if (!attachments || attachments.length === 0) return null;

  const handleOpenPreview = (att: Attachment) => {
    setActivePreview(att);
    setZoom(1);
    setRotation(0);
  };

  const handleZoomIn = () => setZoom(z => Math.min(z + 0.25, 3));
  const handleZoomOut = () => setZoom(z => Math.max(z - 0.25, 0.5));
  const handleRotate = () => setRotation(r => (r + 90) % 360);

  return (
    <div className="mt-2.5">
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
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-emerald-500/10 hover:from-emerald-500/20 hover:to-teal-500/20 border border-emerald-500/30 text-emerald-700 font-semibold text-xs transition-all duration-200 active:scale-95 shadow-sm group"
                title={`Buka ${att.nama} di Google Drive`}
              >
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <Paperclip size={13} className="text-emerald-600 group-hover:rotate-12 transition-transform" />
                <span className="truncate max-w-[150px]">{att.nama}</span>
                <ExternalLink size={12} className="text-emerald-600 opacity-60 group-hover:opacity-100" />
              </a>
            );
          }

          if (isImage) {
            return (
              <button
                key={idx}
                type="button"
                onClick={() => handleOpenPreview(att)}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-gradient-to-r from-blue-500/10 to-indigo-500/10 hover:from-blue-500/20 hover:to-indigo-500/20 border border-blue-500/30 text-blue-700 font-semibold text-xs transition-all duration-200 active:scale-95 shadow-sm group"
              >
                <ImageIcon size={13} className="text-blue-600 group-hover:scale-110 transition-transform" />
                <span className="truncate max-w-[150px]">{att.nama}</span>
                <Eye size={12} className="text-blue-600 opacity-60 group-hover:opacity-100" />
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
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 border border-gray-200 text-gray-800 font-medium text-xs transition-all duration-200 active:scale-95 shadow-sm"
            >
              <FileText size={13} className="text-gray-600" />
              <span className="truncate max-w-[150px]">{att.nama}</span>
              <ExternalLink size={12} className="text-gray-500" />
            </a>
          );
        })}
      </div>

      {/* Luxury Fullscreen Image Preview Modal */}
      {activePreview && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-2xl flex items-center justify-center p-3 sm:p-6 animate-fade-in"
          onClick={() => setActivePreview(null)}
        >
          <div
            className="relative max-w-4xl w-full bg-slate-900 border border-white/10 text-white rounded-3xl overflow-hidden shadow-2xl animate-scale-up flex flex-col max-h-[90vh]"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header Bar */}
            <div className="px-4 sm:px-6 py-3.5 bg-slate-900/90 border-b border-white/10 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center flex-shrink-0">
                  <ImageIcon size={18} />
                </div>
                <div className="min-w-0">
                  <h3 className="font-bold text-sm text-white truncate leading-tight">
                    {activePreview.nama}
                  </h3>
                  <p className="text-[11px] text-emerald-400/90 flex items-center gap-1 font-medium mt-0.5">
                    <CloudCheck size={12} /> Lampiran Transaksi Terverifikasi
                  </p>
                </div>
              </div>

              {/* Toolbar Actions */}
              <div className="flex items-center gap-1.5">
                <div className="hidden sm:flex items-center gap-1 bg-slate-800/80 p-1 rounded-xl border border-white/10 mr-2">
                  <button
                    onClick={handleZoomOut}
                    className="p-1.5 text-gray-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                    title="Zoom Out"
                  >
                    <ZoomOut size={16} />
                  </button>
                  <span className="text-xs font-mono text-gray-300 px-1">{Math.round(zoom * 100)}%</span>
                  <button
                    onClick={handleZoomIn}
                    className="p-1.5 text-gray-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                    title="Zoom In"
                  >
                    <ZoomIn size={16} />
                  </button>
                  <button
                    onClick={handleRotate}
                    className="p-1.5 text-gray-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors ml-1"
                    title="Putar Gambar"
                  >
                    <RotateCw size={16} />
                  </button>
                </div>

                {activePreview.dataUrl && activePreview.dataUrl.includes('drive.google.com') && (
                  <a
                    href={activePreview.dataUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-all shadow-md active:scale-95"
                  >
                    <ExternalLink size={14} />
                    <span className="hidden sm:inline">Buka Google Drive</span>
                  </a>
                )}

                <button
                  onClick={() => setActivePreview(null)}
                  className="w-8 h-8 rounded-xl bg-white/10 hover:bg-red-500/40 text-gray-300 hover:text-white flex items-center justify-center transition-all ml-1"
                  title="Tutup"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Image Preview Container */}
            <div className="flex-1 overflow-auto p-4 sm:p-8 flex items-center justify-center bg-slate-950 min-h-[300px]">
              <img
                src={activePreview.dataUrl}
                alt={activePreview.nama}
                style={{
                  transform: `scale(${zoom}) rotate(${rotation}deg)`,
                  transition: 'transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                }}
                className="max-w-full max-h-[65vh] object-contain rounded-2xl shadow-2xl border border-white/10"
              />
            </div>

            {/* Modal Footer */}
            <div className="px-4 py-3 bg-slate-900/90 border-t border-white/10 flex items-center justify-between text-xs text-gray-400">
              <span>Klik di luar modal atau tombol X untuk keluar</span>
              <a
                href={activePreview.dataUrl}
                target="_blank"
                download={activePreview.nama}
                className="text-emerald-400 hover:underline flex items-center gap-1 font-medium"
              >
                <Download size={13} /> Unduh Berkas
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
