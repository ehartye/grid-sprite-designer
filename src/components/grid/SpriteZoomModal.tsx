/**
 * Zoom modal for pixel-level sprite inspection with eyedropper-to-strike
 * and eraser workflows. Renders a zoomable, pannable canvas.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ExtractedSprite } from '../../lib/spriteExtractor';
import { useModalFocus } from '../../hooks/useModalFocus';

type RGB = [number, number, number];

type Tool = 'eyedropper' | 'eraser';


interface SpriteZoomModalProps {
  sprite: ExtractedSprite;
  struckColors: RGB[];
  onStrikeColor: (color: RGB) => void;
  onUnstrikeColor: (color: RGB) => void;
  onErasePixel: (pixels: { x: number; y: number }[]) => void;
  onClose: () => void;
  brushW: number;
  brushH: number;
  onBrushWChange: (v: number) => void;
  onBrushHChange: (v: number) => void;
  onUndoErase: () => void;
  canUndoErase: boolean;
}

export const SpriteZoomModal = React.memo(function SpriteZoomModal({ sprite, struckColors, onStrikeColor, onUnstrikeColor, onErasePixel, onClose, brushW, brushH, onBrushWChange, onBrushHChange, onUndoErase, canUndoErase }: SpriteZoomModalProps) {
  const [zoom, setZoom] = useState(8);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const dragDistRef = useRef(0);
  const panStartRef = useRef({ x: 0, y: 0 });
  const [hoveredColor, setHoveredColor] = useState<RGB | null>(null);
  const [hoveredPixel, setHoveredPixel] = useState<{ x: number; y: number } | null>(null);
  const [pendingStrike, setPendingStrike] = useState<RGB | null>(null);
  const [tool, setTool] = useState<Tool>('eyedropper');
  const brushWRef = useRef(brushW);
  const brushHRef = useRef(brushH);
  brushWRef.current = brushW;
  brushHRef.current = brushH;
  const imageDataRef = useRef<ImageData | null>(null);
  const [imageVersion, setImageVersion] = useState(0);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const [canvasSize, setCanvasSize] = useState({ w: 0, h: 0 });
  const initialCenterDone = useRef(false);
  // Prevent backdrop close right after finishing a drag
  const justPannedRef = useRef(false);

  useModalFocus(modalRef, true, onClose);

  // Stable ref for panOffset/zoom so global listeners always have latest values
  const panOffsetRef = useRef(panOffset);
  panOffsetRef.current = panOffset;
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;
  const toolRef = useRef(tool);
  toolRef.current = tool;

  // Decode sprite image data (re-runs when sprite changes, e.g. after a strike)
  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = img.width;
      c.height = img.height;
      const ctx = c.getContext('2d')!;
      ctx.drawImage(img, 0, 0);
      imageDataRef.current = ctx.getImageData(0, 0, img.width, img.height);
      setImageVersion((v) => v + 1);
    };
    img.src = `data:${sprite.mimeType};base64,${sprite.imageData}`;
  }, [sprite.imageData, sprite.mimeType]);

  // Track container size with ResizeObserver
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;

    const obs = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setCanvasSize({ w: Math.floor(width), h: Math.floor(height) });
    });
    obs.observe(wrap);
    return () => obs.disconnect();
  }, []);

  // Center sprite when canvas size first becomes known or sprite changes
  useEffect(() => {
    if (canvasSize.w === 0 || canvasSize.h === 0 || !imageDataRef.current) return;
    if (initialCenterDone.current) return;
    initialCenterDone.current = true;

    const iw = imageDataRef.current.width;
    const ih = imageDataRef.current.height;
    setPanOffset({
      x: Math.floor((canvasSize.w - iw * zoom) / 2),
      y: Math.floor((canvasSize.h - ih * zoom) / 2),
    });
  }, [canvasSize, zoom, imageVersion]);

  // Canvas redraw — now depends on imageVersion to re-render after sprite updates
  useEffect(() => {
    const canvas = canvasRef.current;
    const imgData = imageDataRef.current;
    if (!canvas || !imgData || canvasSize.w === 0) return;

    canvas.width = canvasSize.w;
    canvas.height = canvasSize.h;

    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Checkerboard background (standard grey/white)
    const tileSize = Math.max(zoom, 4);
    for (let y = 0; y < canvas.height; y += tileSize) {
      for (let x = 0; x < canvas.width; x += tileSize) {
        const light = ((Math.floor(x / tileSize) + Math.floor(y / tileSize)) % 2) === 0;
        ctx.fillStyle = light ? '#ffffff' : '#cccccc';
        ctx.fillRect(x, y, tileSize, tileSize);
      }
    }

    const sw = imgData.width;
    const sh = imgData.height;
    const data = imgData.data;

    // Compute visible pixel range
    const startCol = Math.max(0, Math.floor(-panOffset.x / zoom));
    const endCol = Math.min(sw, Math.ceil((canvas.width - panOffset.x) / zoom));
    const startRow = Math.max(0, Math.floor(-panOffset.y / zoom));
    const endRow = Math.min(sh, Math.ceil((canvas.height - panOffset.y) / zoom));

    // Draw pixels
    for (let py = startRow; py < endRow; py++) {
      for (let px = startCol; px < endCol; px++) {
        const i = (py * sw + px) * 4;
        const a = data[i + 3];
        if (a === 0) continue;

        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        ctx.fillStyle = a < 255 ? `rgba(${r},${g},${b},${a / 255})` : `rgb(${r},${g},${b})`;
        ctx.fillRect(
          panOffset.x + px * zoom,
          panOffset.y + py * zoom,
          zoom,
          zoom,
        );
      }
    }

    // Grid lines at high zoom
    if (zoom >= 4) {
      ctx.strokeStyle = 'rgba(0,0,0,0.08)';
      ctx.lineWidth = 1;
      for (let px = startCol; px <= endCol; px++) {
        const x = panOffset.x + px * zoom;
        ctx.beginPath();
        ctx.moveTo(x, Math.max(0, panOffset.y + startRow * zoom));
        ctx.lineTo(x, Math.min(canvas.height, panOffset.y + endRow * zoom));
        ctx.stroke();
      }
      for (let py = startRow; py <= endRow; py++) {
        const y = panOffset.y + py * zoom;
        ctx.beginPath();
        ctx.moveTo(Math.max(0, panOffset.x + startCol * zoom), y);
        ctx.lineTo(Math.min(canvas.width, panOffset.x + endCol * zoom), y);
        ctx.stroke();
      }
    }

    // Hovered pixel highlight — shows brush footprint for eraser, single pixel for eyedropper
    if (hoveredPixel) {
      ctx.strokeStyle = '#c8ff00';
      ctx.lineWidth = 2;
      const halfW = tool === 'eraser' ? Math.floor(brushW / 2) : 0;
      const halfH = tool === 'eraser' ? Math.floor(brushH / 2) : 0;
      const bx = hoveredPixel.x - halfW;
      const by = hoveredPixel.y - halfH;
      const bw = halfW * 2 + 1;
      const bh = halfH * 2 + 1;
      ctx.strokeRect(
        panOffset.x + bx * zoom + 1,
        panOffset.y + by * zoom + 1,
        bw * zoom - 2,
        bh * zoom - 2,
      );
    }

    // Pending strike overlay
    if (pendingStrike) {
      const [pr, pg, pb] = pendingStrike;
      ctx.fillStyle = 'rgba(255, 71, 87, 0.35)';
      for (let py = startRow; py < endRow; py++) {
        for (let px = startCol; px < endCol; px++) {
          const i = (py * sw + px) * 4;
          if (data[i + 3] === 0) continue;
          if (data[i] === pr && data[i + 1] === pg && data[i + 2] === pb) {
            ctx.fillRect(
              panOffset.x + px * zoom,
              panOffset.y + py * zoom,
              zoom,
              zoom,
            );
          }
        }
      }
    }
  }, [canvasSize, zoom, panOffset, hoveredPixel, pendingStrike, imageVersion, tool, brushW, brushH]);

  // Image pixel coordinate from screen coordinates (no alpha check)
  const getImagePixel = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    const imgData = imageDataRef.current;
    if (!canvas || !imgData) return null;

    const rect = canvas.getBoundingClientRect();
    const mx = clientX - rect.left;
    const my = clientY - rect.top;

    const curPan = panOffsetRef.current;
    const curZoom = zoomRef.current;
    const px = Math.floor((mx - curPan.x) / curZoom);
    const py = Math.floor((my - curPan.y) / curZoom);

    if (px < 0 || py < 0 || px >= imgData.width || py >= imgData.height) return null;
    return { x: px, y: py };
  }, []);

  // Pixel from screen coordinates — returns color, skips transparent (for eyedropper)
  const getPixelAt = useCallback((clientX: number, clientY: number) => {
    const imgData = imageDataRef.current;
    if (!imgData) return null;
    const p = getImagePixel(clientX, clientY);
    if (!p) return null;

    const i = (p.y * imgData.width + p.x) * 4;
    const a = imgData.data[i + 3];
    if (a === 0) return null;

    return {
      x: p.x,
      y: p.y,
      color: [imgData.data[i], imgData.data[i + 1], imgData.data[i + 2]] as RGB,
    };
  }, [getImagePixel]);

  // All pixels within brush half-extents of (cx, cy), clamped to image bounds
  const getBrushPixels = useCallback((cx: number, cy: number, halfW: number, halfH: number) => {
    const imgData = imageDataRef.current;
    if (!imgData) return [];
    const pixels: { x: number; y: number }[] = [];
    for (let dy = -halfH; dy <= halfH; dy++) {
      for (let dx = -halfW; dx <= halfW; dx++) {
        const x = cx + dx;
        const y = cy + dy;
        if (x >= 0 && y >= 0 && x < imgData.width && y < imgData.height) {
          pixels.push({ x, y });
        }
      }
    }
    return pixels;
  }, []);

  // Mouse move on canvas — hover tracking only (panning handled by global listeners)
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isPanning) return;
    const p = getImagePixel(e.clientX, e.clientY);
    if (p) {
      const imgData = imageDataRef.current;
      const i = imgData ? (p.y * imgData.width + p.x) * 4 : -1;
      const a = imgData && i >= 0 ? imgData.data[i + 3] : 0;
      setHoveredColor(a > 0 && imgData ? [imgData.data[i], imgData.data[i + 1], imgData.data[i + 2]] : null);
      setHoveredPixel({ x: p.x, y: p.y });
    } else {
      setHoveredColor(null);
      setHoveredPixel(null);
    }
  }, [isPanning, getImagePixel]);

  // Mouse down on canvas — start pan tracking
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    setIsPanning(true);
    panStartRef.current = { x: e.clientX, y: e.clientY };
    dragDistRef.current = 0;
  }, []);

  // Global mousemove/mouseup during panning — survives cursor leaving canvas/window
  useEffect(() => {
    if (!isPanning) return;

    const handleGlobalMove = (e: MouseEvent) => {
      const dx = e.clientX - panStartRef.current.x;
      const dy = e.clientY - panStartRef.current.y;
      dragDistRef.current = Math.sqrt(dx * dx + dy * dy);
      setPanOffset((prev) => ({
        x: prev.x + e.movementX,
        y: prev.y + e.movementY,
      }));
    };

    const handleGlobalUp = (e: MouseEvent) => {
      setIsPanning(false);

      if (dragDistRef.current < 3) {
        // Click (not drag)
        if (toolRef.current === 'eraser') {
          const p = getImagePixel(e.clientX, e.clientY);
          if (p) {
            const hw = Math.floor(brushWRef.current / 2);
            const hh = Math.floor(brushHRef.current / 2);
            const pixels = getBrushPixels(p.x, p.y, hw, hh);
            if (pixels.length > 0) onErasePixel(pixels);
          }
        } else {
          const pixel = getPixelAt(e.clientX, e.clientY);
          if (pixel) setPendingStrike(pixel.color);
        }
      } else {
        // Was a real drag — block the next backdrop click from closing
        justPannedRef.current = true;
        requestAnimationFrame(() => {
          justPannedRef.current = false;
        });
      }
    };

    window.addEventListener('mousemove', handleGlobalMove);
    window.addEventListener('mouseup', handleGlobalUp);
    return () => {
      window.removeEventListener('mousemove', handleGlobalMove);
      window.removeEventListener('mouseup', handleGlobalUp);
    };
  }, [isPanning, getImagePixel, getPixelAt, getBrushPixels, onErasePixel]);

  // Scroll wheel zoom centered on cursor
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      setZoom((prevZoom) => {
        const newZoom = e.deltaY < 0
          ? Math.min(32, prevZoom * 1.25)
          : Math.max(1, prevZoom / 1.25);
        const rounded = Math.round(newZoom);
        const ratio = rounded / prevZoom;

        setPanOffset((prev) => ({
          x: mx - ratio * (mx - prev.x),
          y: my - ratio * (my - prev.y),
        }));

        return rounded;
      });
    };

    canvas.addEventListener('wheel', handleWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', handleWheel);
  }, []);

  // Keyboard: +/-, E for eraser toggle (Escape handled by useModalFocus)
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === '+' || e.key === '=') {
        setZoom((z) => Math.min(32, z + 1));
      } else if (e.key === '-') {
        setZoom((z) => Math.max(1, z - 1));
      } else if (e.key === 'e' || e.key === 'E') {
        setTool((t) => t === 'eraser' ? 'eyedropper' : 'eraser');
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        onUndoErase();
      }
    };

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onUndoErase]);

  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget && !justPannedRef.current) onClose();
  }, [onClose]);

  const handleStrike = useCallback(() => {
    if (pendingStrike) {
      onStrikeColor(pendingStrike);
      setPendingStrike(null);
    }
  }, [pendingStrike, onStrikeColor]);

  const cursorClass = tool === 'eraser' ? 'is-eraser' : '';

  return (
    <div className="zoom-modal-backdrop" onClick={handleBackdropClick}>
      <div className="zoom-modal" ref={modalRef} role="dialog" aria-modal="true" aria-label="Sprite zoom inspector">
        {/* Header */}
        <div className="zoom-modal-header">
          <span className="zoom-title">{sprite.label}</span>
          <div className="zoom-tool-toggle">
            <button
              className={tool === 'eyedropper' ? 'active' : ''}
              onClick={() => setTool('eyedropper')}
              title="Eyedropper — click to strike color"
            >
              &#x1F441;
            </button>
            <button
              className={tool === 'eraser' ? 'active' : ''}
              onClick={() => setTool('eraser')}
              title="Eraser — click to erase pixel (E)"
            >
              &#x232B;
            </button>
          </div>
          {tool === 'eraser' && (
            <div className="zoom-brush-size">
              <button
                className="zoom-undo-btn"
                onClick={onUndoErase}
                disabled={!canUndoErase}
                title="Undo erase (Ctrl+Z)"
              >
                &#x21B6;
              </button>
              <label>
                W <span className="zoom-brush-val">{brushW}</span>
                <input
                  type="range"
                  min={1}
                  max={200}
                  value={brushW}
                  onChange={(e) => onBrushWChange(Number(e.target.value))}
                />
              </label>
              <label>
                H <span className="zoom-brush-val">{brushH}</span>
                <input
                  type="range"
                  min={1}
                  max={200}
                  value={brushH}
                  onChange={(e) => onBrushHChange(Number(e.target.value))}
                />
              </label>
            </div>
          )}
          <div className="zoom-controls">
            <button onClick={() => setZoom((z) => Math.max(1, z - 1))} title="Zoom out (-)">-</button>
            <span className="zoom-level">{zoom}x</span>
            <button onClick={() => setZoom((z) => Math.min(32, z + 1))} title="Zoom in (+)">+</button>
          </div>
          <button className="zoom-close-btn" onClick={onClose} title="Close (Esc)">&times;</button>
        </div>

        {/* Canvas */}
        <div className={`zoom-modal-canvas-wrap${isPanning ? ' is-panning' : ''} ${cursorClass}`} ref={wrapRef}>
          <canvas
            ref={canvasRef}
            onMouseMove={handleMouseMove}
            onMouseDown={handleMouseDown}
            onMouseLeave={() => {
              setHoveredColor(null);
              setHoveredPixel(null);
            }}
          />
        </div>

        {/* Footer */}
        <div className="zoom-modal-footer">
          {hoveredColor ? (
            <>
              <div
                className="zoom-color-swatch"
                style={{ backgroundColor: `rgb(${hoveredColor[0]},${hoveredColor[1]},${hoveredColor[2]})` }}
              />
              <span>
                rgb({hoveredColor[0]}, {hoveredColor[1]}, {hoveredColor[2]})
                {hoveredPixel && ` \u2014 (${hoveredPixel.x}, ${hoveredPixel.y})`}
              </span>
            </>
          ) : (
            <span>
              {tool === 'eraser'
                ? 'Click a pixel to erase it'
                : 'Hover to inspect, click to strike a color'}
            </span>
          )}
          {struckColors.length > 0 && (
            <div className="zoom-struck-list">
              {struckColors.map(([r, g, b], i) => (
                <div
                  key={i}
                  className="zoom-struck-chip"
                  style={{ backgroundColor: `rgb(${r},${g},${b})` }}
                  title={`Unstrike rgb(${r},${g},${b})`}
                  onClick={() => onUnstrikeColor([r, g, b])}
                />
              ))}
            </div>
          )}
        </div>

        {/* Strike confirmation bar */}
        {pendingStrike && (
          <div className="zoom-strike-confirm">
            <div
              className="strike-swatch"
              style={{ backgroundColor: `rgb(${pendingStrike[0]},${pendingStrike[1]},${pendingStrike[2]})` }}
            />
            <span className="strike-label">
              rgb({pendingStrike[0]}, {pendingStrike[1]}, {pendingStrike[2]})
            </span>
            <div className="strike-actions">
              <button className="btn-strike-cancel" onClick={() => setPendingStrike(null)}>Cancel</button>
              <button className="btn-strike" onClick={handleStrike}>Strike</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
});
