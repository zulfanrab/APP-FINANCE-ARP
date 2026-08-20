// ============================================================
// ARKA Finance — Professional Attachment & Receipt Preview Component
// Hardware-Accelerated 60FPS Zoom/Pan Lightbox Engine
// Universal PDF & Image Viewer Engine (Cross-Browser & Mobile Safe)
// ============================================================

import React, { useState, useRef } from 'react';
import {
  FileText, Image as ImageIcon, ExternalLink, X,
  ZoomIn, ZoomOut, RotateCw, RefreshCw, Download, AlertCircle, Eye, Maximize2
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

/**
 * Converts Base64 Data URIs to Blob Object URLs
 * Prevents mobile Chrome/Safari "Blocked top-level navigation to data URI" error!
 */
function convertBase64ToBlobUrl(dataUrl: string): string {
  if (!dataUrl || !dataUrl.startsWith('data:')) return dataUrl;
  try {
    const parts = dataUrl.split(',');
    const mimeMatch = parts[0].match(/:(.*?);/);
    const mime = mimeMatch ? mimeMatch[1] : 'application/pdf';
    const bstr = atob(parts[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    const blob = new Blob([u8arr], { type: mime });
    return URL.createObjectURL(blob);
  } catch (e) {
    console.error('Failed to convert base64 to Blob URL:', e);
    return dataUrl;
  }
}

export function AttachmentViewer({ attachments }: AttachmentViewerProps) {
  const safeAttachments: Attachment[] = Array.isArray(attachments)
    ? attachments
    : (typeof attachments === 'string' && (attachments as string).trim().startsWith('[')
        ? (() => { try { const p = JSON.parse(attachments); return Array.isArray(p) ? p : []; } catch { return []; } })()
        : []);

  // Image Lightbox Modal state
  const [activeImagePreview, setActiveImagePreview] = useState<{ att: Attachment; imgUrl: string } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [pan, setPan] = useState({ x: 0, y: 0 });

  // PDF In-App Fullscreen Viewer Modal state
  const [activePdfModal, setActivePdfModal] = useState<{
    att: Attachment;
    blobUrl?: string;
    driveId?: string | null;
    isGoogleDrive: boolean;
    isEmptyData: boolean;
  } | null>(null);

  // Touch gesture & animation frame references for smooth 60FPS performance
  const [isDragging, setIsDragging] = useState(false);
  const [touchStartDist, setTouchStartDist] = useState<number | null>(null);
  const [startZoom, setStartZoom] = useState(1);
  const lastPosRef = useRef<{ x: number; y: number } | null>(null);
  const [lastTapTime, setLastTapTime] = useState<number>(0);
  const animFrameRef = useRef<number | null>(null);

  if (!safeAttachments || safeAttachments.length === 0) return null;

  const resetTransform = () => {
    setZoom(1);
    setRotation(0);
    setPan({ x: 0, y: 0 });
  };

  const handleOpenImagePreview = (att: Attachment, imgUrl: string) => {
    setActiveImagePreview({ att, imgUrl });
    resetTransform();
  };

  const handleOpenPdf = (att: Attachment) => {
    const rawData = att.dataUrl || '';
    const isGoogleDrive = Boolean(rawData && rawData.includes('drive.google.com'));
    const driveId = isGoogleDrive ? getDriveFileId(rawData) : null;
    const isBase64 = rawData.startsWith('data:');
    const isEmptyData = !rawData || rawData.trim() === '';

    let blobUrl = '';
    if (isBase64) {
      blobUrl = convertBase64ToBlobUrl(rawData);
    } else if (rawData && !isGoogleDrive) {
      blobUrl = rawData;
    }

    setActivePdfModal({
      att,
      blobUrl,
      driveId,
      isGoogleDrive,
      isEmptyData,
    });
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

  // Touch Events with RAF smoothness for Image Lightbox
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
        {safeAttachments.map((att, idx) => {
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
                  {isPdf ? (
                    <button
                      type="button"
                      onClick={() => handleOpenPdf(att)}
                      className="px-2.5 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-[11px] font-bold flex items-center gap-1 shadow-sm transition-all active:scale-95"
                    >
                      <Eye size={12} /> Buka PDF
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleOpenImagePreview(att, imgUrl)}
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
                      title="Buka Langsung di Google Drive"
                    >
                      <ExternalLink size={13} />
                    </a>
                  )}
                </div>
              </div>

              {/* Body: EMBEDDED VISUAL PREVIEW DISPLAY */}
              <div className="relative bg-slate-950 flex items-center justify-center min-h-[160px] max-h-[260px] overflow-hidden p-2">
                {isPdf ? (
                  <div
                    onClick={() => handleOpenPdf(att)}
                    className="w-full p-4 bg-slate-900 border border-slate-800 hover:border-amber-500/50 rounded-xl text-center space-y-2 cursor-pointer transition-all active:scale-[0.98] group/pdf"
                  >
                    <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center mx-auto group-hover/pdf:scale-110 transition-transform">
                      <FileText size={24} />
                    </div>
                    <div>
                      <p className="text-xs font-extrabold text-slate-100 truncate px-2">{att.nama}</p>
                      <p className="text-[10px] text-amber-400 font-semibold mt-0.5">Dokumen Berkas PDF Resmi</p>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenPdf(att);
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/20 text-amber-300 rounded-xl text-xs font-bold hover:bg-amber-500/30 transition-colors"
                    >
                      <Eye size={13} /> Tampilkan Dokumen PDF
                    </button>
                  </div>
                ) : (
                  <img
                    src={imgUrl}
                    alt={att.nama}
                    className="max-h-[240px] w-full object-contain rounded-xl cursor-pointer hover:opacity-90 transition-opacity"
                    onClick={() => handleOpenImagePreview(att, imgUrl)}
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

      {/* IN-APP FULLSCREEN PDF VIEWER MODAL */}
      {activePdfModal && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-2xl flex items-center justify-center p-2 sm:p-6 animate-fade-in"
          onClick={() => {
            if (activePdfModal.blobUrl) URL.revokeObjectURL(activePdfModal.blobUrl);
            setActivePdfModal(null);
          }}
        >
          <div
            className="relative max-w-5xl w-full bg-slate-900 border border-white/10 text-white rounded-3xl overflow-hidden shadow-2xl animate-scale-up flex flex-col h-[90vh]"
            onClick={e => e.stopPropagation()}
          >
            {/* PDF Header */}
            <div className="px-4 sm:px-6 py-3 bg-slate-900 border-b border-white/10 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center flex-shrink-0">
                  <FileText size={18} />
                </div>
                <div className="min-w-0">
                  <h3 className="font-bold text-sm text-white truncate leading-tight">
                    {activePdfModal.att.nama || 'Dokumen PDF'}
                  </h3>
                  <p className="text-[10.5px] text-slate-400 font-medium mt-0.5">
                    Pratinjau Dokumen Berkas PDF Resmi
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 flex-wrap">
                {activePdfModal.isGoogleDrive && activePdfModal.driveId && (
                  <a
                    href={`https://drive.google.com/file/d/${activePdfModal.driveId}/view?usp=sharing`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all active:scale-95"
                  >
                    <ExternalLink size={13} /> Buka di Drive
                  </a>
                )}
                {(activePdfModal.blobUrl || activePdfModal.att.dataUrl) && !activePdfModal.isEmptyData && (
                  <>
                    <a
                      href={activePdfModal.blobUrl || activePdfModal.att.dataUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all active:scale-95"
                    >
                      <ExternalLink size={13} /> Tab Baru
                    </a>
                    <a
                      href={activePdfModal.blobUrl || activePdfModal.att.dataUrl}
                      download={activePdfModal.att.nama || 'dokumen.pdf'}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all active:scale-95"
                    >
                      <Download size={13} /> Unduh
                    </a>
                  </>
                )}
                <button
                  onClick={() => {
                    if (activePdfModal.blobUrl && activePdfModal.blobUrl.startsWith('blob:')) {
                      try { URL.revokeObjectURL(activePdfModal.blobUrl); } catch { /* ignore */ }
                    }
                    setActivePdfModal(null);
                  }}
                  className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-colors ml-1"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* PDF Viewport */}
            <div className="relative flex-1 bg-slate-950 p-2 overflow-hidden flex flex-col">
              {activePdfModal.isEmptyData ? (
                <div className="flex flex-col items-center justify-center h-full p-6 text-center text-slate-300">
                  <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-3">
                    <AlertCircle size={32} />
                  </div>
                  <h4 className="text-base font-bold text-white mb-1">
                    {activePdfModal.att.nama || 'File PDF'}
                  </h4>
                  <p className="text-xs text-slate-400 max-w-md mb-4 leading-relaxed">
                    Data berkas PDF ini kosong atau belum tersimpan secara penuh di server / penyimpanan lokal. Silakan buka menu <strong>Edit Transaksi</strong> untuk mengunggah ulang file PDF Anda.
                  </p>
                  <button
                    onClick={() => setActivePdfModal(null)}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold"
                  >
                    Tutup Pratinjau
                  </button>
                </div>
              ) : activePdfModal.isGoogleDrive && activePdfModal.driveId ? (
                <iframe
                  src={`https://drive.google.com/file/d/${activePdfModal.driveId}/preview`}
                  title={activePdfModal.att.nama}
                  className="w-full h-full rounded-2xl border-0 bg-white"
                />
              ) : (
                <object
                  data={activePdfModal.blobUrl || activePdfModal.att.dataUrl}
                  type="application/pdf"
                  className="w-full h-full rounded-2xl border-0 bg-white"
                >
                  <iframe
                    src={activePdfModal.blobUrl || activePdfModal.att.dataUrl}
                    title={activePdfModal.att.nama}
                    className="w-full h-full rounded-2xl border-0 bg-white"
                  >
                    <div className="flex flex-col items-center justify-center h-full p-6 text-center text-slate-300 bg-slate-900 rounded-2xl">
                      <FileText size={44} className="text-emerald-400 mb-2" />
                      <h4 className="text-sm font-bold text-white mb-1">
                        Pratinjau PDF: {activePdfModal.att.nama}
                      </h4>
                      <p className="text-xs text-slate-400 mb-4 max-w-sm">
                        Browser Anda tidak mendukung render PDF di dalam aplikasi. Silakan buka dokumen di tab baru atau unduh langsung.
                      </p>
                      <div className="flex gap-2">
                        <a
                          href={activePdfModal.blobUrl || activePdfModal.att.dataUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5"
                        >
                          <ExternalLink size={14} /> Buka di Tab Baru
                        </a>
                        <a
                          href={activePdfModal.blobUrl || activePdfModal.att.dataUrl}
                          download={activePdfModal.att.nama || 'dokumen.pdf'}
                          className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-xl text-xs font-bold flex items-center gap-1.5"
                        >
                          <Download size={14} /> Unduh PDF
                        </a>
                      </div>
                    </div>
                  </iframe>
                </object>
              )}
            </div>
          </div>
        </div>
      )}

      {/* LUXURY FULLSCREEN LIGHTBOX MODAL FOR IMAGES */}
      {activeImagePreview && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-2xl flex items-center justify-center p-2 sm:p-6 animate-fade-in"
          onClick={() => setActiveImagePreview(null)}
        >
          <div
            className="relative max-w-5xl w-full bg-slate-900 border border-white/10 text-white rounded-3xl overflow-hidden shadow-2xl animate-scale-up flex flex-col max-h-[95vh] h-[88vh]"
            onClick={e => e.stopPropagation()}
          >
            {/* HEADER */}
            <div className="px-4 sm:px-6 py-3 bg-slate-900/95 border-b border-white/10 flex items-center justify-between gap-2 z-20">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center flex-shrink-0">
                  <ImageIcon size={18} />
                </div>
                <div className="min-w-0">
                  <h3 className="font-bold text-sm text-white truncate leading-tight">
                    {activeImagePreview.att.nama}
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

                {activeImagePreview.att.dataUrl.includes('drive.google.com') && (
                  <a
                    href={activeImagePreview.att.dataUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-1 shadow-md"
                    title="Buka di Google Drive"
                  >
                    <ExternalLink size={14} /> Drive
                  </a>
                )}

                <button
                  onClick={() => setActiveImagePreview(null)}
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
                src={activeImagePreview.imgUrl}
                alt={activeImagePreview.att.nama}
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
