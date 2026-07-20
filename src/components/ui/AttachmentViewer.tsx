// ============================================================
// ARKA Finance — Luxury Attachment Viewer Component
// Features: Touch Pinch-to-Zoom, Smooth Pan, Double-Tap, Mouse Wheel & Drive Links
// ============================================================

import React, { useState, useRef } from 'react';
import {
  Paperclip, ExternalLink, FileText, Image as ImageIcon, Eye, X,
  ZoomIn, ZoomOut, RotateCw, Download, CloudCheck, RefreshCw, Hand
} from 'lucide-react';
import { type Attachment } from '../../types';

interface AttachmentViewerProps {
  attachments: Attachment[];
}

export function AttachmentViewer({ attachments }: AttachmentViewerProps) {
  const [activePreview, setActivePreview] = useState<Attachment | null>(null);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [pan, setPan] = useState({ x: 0, y: 0 });

  // Touch gesture states
  const [isDragging, setIsDragging] = useState(false);
  const [touchStartDist, setTouchStartDist] = useState<number | null>(null);
  const [startZoom, setStartZoom] = useState(1);
  const [lastPos, setLastPos] = useState<{ x: number; y: number } | null>(null);
  const [lastTapTime, setLastTapTime] = useState<number>(0);

  if (!attachments || attachments.length === 0) return null;

  const resetTransform = () => {
    setZoom(1);
    setRotation(0);
    setPan({ x: 0, y: 0 });
  };

  const handleOpenPreview = (att: Attachment) => {
    setActivePreview(att);
    resetTransform();
  };

  const handleZoomIn = () => setZoom(z => Math.min(z + 0.35, 4));
  const handleZoomOut = () => setZoom(z => Math.max(z - 0.35, 0.75));
  const handleRotate = () => setRotation(r => (r + 90) % 360);

  // Double tap to toggle zoom 1x <-> 2.5x
  const handleDoubleTap = () => {
    const now = Date.now();
    if (now - lastTapTime < 300) {
      if (zoom > 1.2) {
        resetTransform();
      } else {
        setZoom(2.5);
      }
    }
    setLastTapTime(now);
  };

  // Mouse wheel zoom
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.2 : -0.2;
    setZoom(z => Math.max(0.75, Math.min(z + delta, 4)));
  };

  // Touch Events (Pinch & Pan)
  const handleTouchStart = (e: React.TouchEvent) => {
    handleDoubleTap();
    if (e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      setTouchStartDist(dist);
      setStartZoom(zoom);
    } else if (e.touches.length === 1) {
      setIsDragging(true);
      setLastPos({ x: e.touches[0].clientX, y: e.touches[0].clientY });
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && touchStartDist !== null) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const scale = (dist / touchStartDist) * startZoom;
      setZoom(Math.max(0.75, Math.min(scale, 4)));
    } else if (e.touches.length === 1 && isDragging && lastPos && zoom > 1) {
      const deltaX = e.touches[0].clientX - lastPos.x;
      const deltaY = e.touches[0].clientY - lastPos.y;
      setPan(prev => ({ x: prev.x + deltaX, y: prev.y + deltaY }));
      setLastPos({ x: e.touches[0].clientX, y: e.touches[0].clientY });
    }
  };

  const handleTouchEnd = () => {
    setTouchStartDist(null);
    setIsDragging(false);
    setLastPos(null);
  };

  // Mouse Drag Events
  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoom > 1) {
      setIsDragging(true);
      setLastPos({ x: e.clientX, y: e.clientY });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging && lastPos && zoom > 1) {
      const deltaX = e.clientX - lastPos.x;
      const deltaY = e.clientY - lastPos.y;
      setPan(prev => ({ x: prev.x + deltaX, y: prev.y + deltaY }));
      setLastPos({ x: e.clientX, y: e.clientY });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setLastPos(null);
  };

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

      {/* Luxury Pinch-to-Zoom Fullscreen Image Preview Modal */}
      {activePreview && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-2xl flex items-center justify-center p-2 sm:p-6 animate-fade-in"
          onClick={() => setActivePreview(null)}
        >
          <div
            className="relative max-w-4xl w-full bg-slate-900 border border-white/10 text-white rounded-3xl overflow-hidden shadow-2xl animate-scale-up flex flex-col max-h-[95vh] h-[85vh]"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header Bar */}
            <div className="px-4 sm:px-6 py-3 bg-slate-900/95 border-b border-white/10 flex items-center justify-between gap-2 z-20">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center flex-shrink-0">
                  <ImageIcon size={18} />
                </div>
                <div className="min-w-0">
                  <h3 className="font-bold text-sm text-white truncate leading-tight">
                    {activePreview.nama}
                  </h3>
                  <p className="text-[10px] text-emerald-400 flex items-center gap-1 font-medium mt-0.5">
                    <CloudCheck size={12} /> Pinch dengan jari untuk zoom & geser
                  </p>
                </div>
              </div>

              {/* Toolbar Actions */}
              <div className="flex items-center gap-1.5">
                <div className="flex items-center gap-1 bg-slate-800/90 p-1 rounded-xl border border-white/10">
                  <button
                    onClick={handleZoomOut}
                    className="p-1.5 text-gray-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors active:scale-95"
                    title="Zoom Out"
                  >
                    <ZoomOut size={16} />
                  </button>
                  <span className="text-xs font-mono text-emerald-300 px-1 font-bold">{Math.round(zoom * 100)}%</span>
                  <button
                    onClick={handleZoomIn}
                    className="p-1.5 text-gray-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors active:scale-95"
                    title="Zoom In"
                  >
                    <ZoomIn size={16} />
                  </button>
                  <button
                    onClick={handleRotate}
                    className="p-1.5 text-gray-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors active:scale-95"
                    title="Putar Gambar"
                  >
                    <RotateCw size={16} />
                  </button>
                  <button
                    onClick={resetTransform}
                    className="p-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                    title="Reset Posisi & Zoom"
                  >
                    <RefreshCw size={14} />
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
                    <span className="hidden sm:inline">Drive</span>
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

            {/* Interactive Image Container with Touch Pinch & Drag */}
            <div
              onWheel={handleWheel}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              className={`flex-1 overflow-hidden relative p-4 flex items-center justify-center bg-slate-950 select-none touch-none ${
                zoom > 1 ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'
              }`}
            >
              <img
                src={activePreview.dataUrl}
                alt={activePreview.nama}
                style={{
                  transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom}) rotate(${rotation}deg)`,
                  transition: isDragging || touchStartDist !== null ? 'none' : 'transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                  transformOrigin: 'center center',
                }}
                className="max-w-full max-h-[70vh] object-contain rounded-xl shadow-2xl border border-white/10 pointer-events-none"
              />

              {/* Touch gesture guidance banner */}
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-slate-900/80 backdrop-blur-md border border-white/10 rounded-full px-3 py-1 text-[11px] text-gray-300 flex items-center gap-1.5 shadow-lg pointer-events-none">
                <Hand size={12} className="text-emerald-400" />
                <span>Pinch 2 jari untuk zoom · Geser untuk geser gambar · Ketuk 2x untuk toggle</span>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-4 py-2.5 bg-slate-900/95 border-t border-white/10 flex items-center justify-between text-xs text-gray-400 z-20">
              <button onClick={resetTransform} className="text-gray-400 hover:text-white flex items-center gap-1 font-medium">
                <RefreshCw size={12} /> Reset Zoom ({Math.round(zoom * 100)}%)
              </button>
              <a
                href={activePreview.dataUrl}
                target="_blank"
                download={activePreview.nama}
                className="text-emerald-400 hover:underline font-semibold"
              >
                Unduh Berkas
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
