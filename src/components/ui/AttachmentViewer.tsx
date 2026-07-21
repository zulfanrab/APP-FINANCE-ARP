// ============================================================
// ARKA Finance — Professional Attachment & Receipt Preview Component
// Hardware-Accelerated 60FPS Zoom/Pan Lightbox Engine
// Clean Corporate Layout (No Childish Tutorial Overlay Text)
// ============================================================

import React, { useState, useRef, useCallback } from 'react';
import {
  Paperclip, ExternalLink, FileText, Image as ImageIcon, Eye, X,
  ZoomIn, ZoomOut, RotateCw, CloudCheck, Maximize2, RefreshCw
} from 'lucide-react';
import { type Attachment } from '../../types';

interface AttachmentViewerProps {
  attachments: Attachment[];
}

/**
 * Extracts Google Drive File ID from shared links
 */
function getDriveFileId(url: string): string | null {
  if (!url) return null;
  const match = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) || url.match(/id=([a-zA-Z0-9_-]+)/);
  return match ? match[1] : null;
}

export function AttachmentViewer({ attachments }: AttachmentViewerProps) {
  const [activePreview, setActivePreview] = useState<{ att: Attachment; imgUrl: string } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [pan, setPan] = useState({ x: 0, y: 0 });

  // Touch gesture & animation frame references for smooth 60FPS performance
  const [isDragging, setIsDragging] = useState(false);
  const [touchStartDist, setTouchStartDist] = useState<number | null>(null);
  const [startZoom, setStartZoom] = useState(1);
  const lastPosRef = useRef<{ x: number; y: number } | null>(null);
  const [lastTapTime, setLastTapTime] = useState<number>(0);
  const animFrameRef = useRef<number | null>(null);

  if (!attachments || attachments.length === 0) return null;

  const resetTransform = () => {
    setZoom(1);
    setRotation(0);
    setPan({ x: 0, y: 0 });
  };

  const handleOpenPreview = (att: Attachment, imgUrl: string) => {
    setActivePreview({ att, imgUrl });
    resetTransform();
  };

  const handleZoomIn = () => setZoom(z => Math.min(z + 0.35, 4));
  const handleZoomOut = () => setZoom(z => Math.max(z - 0.35, 0.75));
  const handleRotate = () => setRotation(r => (r + 90) % 360);

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

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.25 : -0.25;
    setZoom(z => Math.max(0.75, Math.min(z + delta, 4)));
  };

  // Touch Events with RAF smoothness
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
      lastPosRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
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
    } else if (e.touches.length === 1 && isDragging && lastPosRef.current && zoom > 1) {
      const deltaX = e.touches[0].clientX - lastPosRef.current.x;
      const deltaY = e.touches[0].clientY - lastPosRef.current.y;
      lastPosRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };

      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = requestAnimationFrame(() => {
        setPan(prev => ({ x: prev.x + deltaX, y: prev.y + deltaY }));
      });
    }
  };

  const handleTouchEnd = () => {
    setTouchStartDist(null);
    setIsDragging(false);
    lastPosRef.current = null;
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoom > 1) {
      setIsDragging(true);
      lastPosRef.current = { x: e.clientX, y: e.clientY };
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging && lastPosRef.current && zoom > 1) {
      const deltaX = e.clientX - lastPosRef.current.x;
      const deltaY = e.clientY - lastPosRef.current.y;
      lastPosRef.current = { x: e.clientX, y: e.clientY };

      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = requestAnimationFrame(() => {
        setPan(prev => ({ x: prev.x + deltaX, y: prev.y + deltaY }));
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    lastPosRef.current = null;
  };

  return (
    <div className="mt-3 space-y-4">
      {/* GRID EMBEDDED PREVIEW CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {attachments.map((att, idx) => {
          const isGoogleDrive = att.dataUrl && att.dataUrl.includes('drive.google.com');
          const driveId = isGoogleDrive ? getDriveFileId(att.dataUrl) : null;

          let imgUrl = att.dataUrl;
          if (isGoogleDrive && driveId) {
            imgUrl = `https://lh3.googleusercontent.com/d/${driveId}`;
          }

          const isPdf = att.tipe?.includes('pdf') || att.nama?.toLowerCase().endsWith('.pdf');

          return (
            <div
              key={idx}
              className="group border border-gray-200 rounded-2xl overflow-hidden bg-slate-900 text-white shadow-sm hover:shadow-md transition-all flex flex-col"
            >
              {/* Header Bar */}
              <div className="p-2.5 bg-slate-900 border-b border-slate-800 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  {isPdf ? (
                    <FileText size={15} className="text-amber-400 flex-shrink-0" />
                  ) : (
                    <ImageIcon size={15} className="text-emerald-400 flex-shrink-0" />
                  )}
                  <span className="text-xs font-bold text-slate-100 truncate" title={att.nama}>
                    {att.nama}
                  </span>
                </div>

                <div className="flex items-center gap-1 flex-shrink-0">
                  {!isPdf && (
                    <button
                      type="button"
                      onClick={() => handleOpenPreview(att, imgUrl)}
                      className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[11px] font-bold flex items-center gap-1 shadow-sm transition-all active:scale-95"
                    >
                      <Maximize2 size={11} /> Perbesar
                    </button>
                  )}
                  {isGoogleDrive && (
                    <a
                      href={att.dataUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1 bg-slate-800 hover:bg-slate-700 text-emerald-400 rounded-lg text-xs transition-colors"
                      title="Buka di Google Drive"
                    >
                      <ExternalLink size={13} />
                    </a>
                  )}
                </div>
              </div>

              {/* Body: EMBEDDED VISUAL PREVIEW DISPLAY */}
              <div className="relative bg-slate-950 flex items-center justify-center min-h-[160px] max-h-[260px] overflow-hidden p-2">
                {isPdf ? (
                  isGoogleDrive && driveId ? (
                    <iframe
                      src={`https://drive.google.com/file/d/${driveId}/preview`}
                      title={att.nama}
                      className="w-full h-48 rounded-xl border border-slate-800"
                    />
                  ) : (
                    <div className="text-center p-6 space-y-2">
                      <FileText size={40} className="text-amber-400 mx-auto" />
                      <p className="text-xs font-bold text-slate-200">{att.nama}</p>
                      <a
                        href={att.dataUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/20 text-amber-300 rounded-xl text-xs font-semibold hover:bg-amber-500/30"
                      >
                        <ExternalLink size={12} /> Buka Berkas PDF
                      </a>
                    </div>
                  )
                ) : (
                  <img
                    src={imgUrl}
                    alt={att.nama}
                    className="max-h-[240px] w-full object-contain rounded-xl cursor-pointer hover:opacity-90 transition-opacity"
                    onClick={() => handleOpenPreview(att, imgUrl)}
                    onError={(e) => {
                      const target = e.currentTarget;
                      if (isGoogleDrive && driveId && !target.dataset.fallback) {
                        target.dataset.fallback = 'true';
                        target.src = `https://drive.google.com/thumbnail?id=${driveId}&sz=w800`;
                      }
                    }}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* LUXURY FULLSCREEN LIGHTBOX MODAL (SMOOTH 60FPS HARDWARE ACCELERATED) */}
      {activePreview && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-2xl flex items-center justify-center p-2 sm:p-6 animate-fade-in"
          onClick={() => setActivePreview(null)}
        >
          <div
            className="relative max-w-5xl w-full bg-slate-900 border border-white/10 text-white rounded-3xl overflow-hidden shadow-2xl animate-scale-up flex flex-col max-h-[95vh] h-[88vh]"
            onClick={e => e.stopPropagation()}
          >
            {/* CLEAN CORPORATE MODAL HEADER (NO CHILDISH TUTORIAL OVERLAY) */}
            <div className="px-4 sm:px-6 py-3 bg-slate-900/95 border-b border-white/10 flex items-center justify-between gap-2 z-20">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center flex-shrink-0">
                  <ImageIcon size={18} />
                </div>
                <div className="min-w-0">
                  <h3 className="font-bold text-sm text-white truncate leading-tight">
                    {activePreview.att.nama}
                  </h3>
                  <p className="text-[10.5px] text-slate-400 font-medium mt-0.5">
                    Bukti Resi &amp; Lampiran Transaksi Resmi
                  </p>
                </div>
              </div>

              {/* Controls */}
              <div className="flex items-center gap-1.5">
                <div className="flex items-center gap-1 bg-slate-800/90 p-1 rounded-xl border border-white/10">
                  <button
                    onClick={handleZoomOut}
                    className="p-1.5 text-gray-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                    title="Zoom Out"
                  >
                    <ZoomOut size={16} />
                  </button>
                  <span className="text-xs font-mono font-bold px-1.5 text-emerald-400 min-w-[40px] text-center">
                    {Math.round(zoom * 100)}%
                  </span>
                  <button
                    onClick={handleZoomIn}
                    className="p-1.5 text-gray-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                    title="Zoom In"
                  >
                    <ZoomIn size={16} />
                  </button>
                  <button
                    onClick={handleRotate}
                    className="p-1.5 text-gray-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                    title="Putar Foto"
                  >
                    <RotateCw size={16} />
                  </button>
                  <button
                    onClick={resetTransform}
                    className="p-1.5 text-gray-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                    title="Reset Posisi & Zoom"
                  >
                    <RefreshCw size={14} />
                  </button>
                </div>

                {activePreview.att.dataUrl.includes('drive.google.com') && (
                  <a
                    href={activePreview.att.dataUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-1 shadow-md"
                    title="Buka di Google Drive"
                  >
                    <ExternalLink size={14} /> Drive
                  </a>
                )}

                <button
                  onClick={() => setActivePreview(null)}
                  className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-colors"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Hardware-Accelerated 60FPS Image Viewport */}
            <div
              className="relative flex-1 bg-slate-950 overflow-hidden flex items-center justify-center cursor-grab active:cursor-grabbing select-none"
              onWheel={handleWheel}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            >
              <img
                src={activePreview.imgUrl}
                alt={activePreview.att.nama}
                style={{
                  transform: `translate3d(${pan.x}px, ${pan.y}px, 0px) scale(${zoom}) rotate(${rotation}deg)`,
                  willChange: 'transform',
                  transition: isDragging ? 'none' : 'transform 0.15s cubic-bezier(0.2, 0.8, 0.2, 1)',
                }}
                className="max-w-full max-h-full object-contain pointer-events-none select-none"
                draggable={false}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
