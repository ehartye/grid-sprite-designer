/**
 * Review step layout.
 * Left panel: 6x6 sprite grid.
 * Right sidebar: animation preview, export controls, re-extraction.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useGridWorkflow } from '../../hooks/useGridWorkflow';
import { SpriteGrid } from './SpriteGrid';
import { ANIMATIONS, DIR_WALK, DIR_IDLE } from '../../lib/poses';
import { composeSpriteSheet, ExtractedSprite } from '../../lib/spriteExtractor';
import { applyChromaKey } from '../../lib/chromaKey';

async function applyChromaToSprite(
  sprite: ExtractedSprite,
  tolerance: number,
): Promise<ExtractedSprite> {
  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error('Failed to load sprite'));
    img.src = `data:${sprite.mimeType};base64,${sprite.imageData}`;
  });

  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0);

  const srcData = ctx.getImageData(0, 0, img.width, img.height);
  const result = applyChromaKey(srcData, tolerance);
  ctx.putImageData(result, 0, 0);

  const dataUrl = canvas.toDataURL('image/png');
  const base64 = dataUrl.split(',')[1];

  return { ...sprite, imageData: base64, mimeType: 'image/png' };
}

export function SpriteReview() {
  const { state, dispatch, reExtract, setStep } = useGridWorkflow();
  const { sprites } = state;

  const [selectedAnim, setSelectedAnim] = useState(0);
  const [frameIndex, setFrameIndex] = useState(0);
  const [speed, setSpeed] = useState(150);
  const [scale, setScale] = useState(2);
  const [chromaEnabled, setChromaEnabled] = useState(false);
  const [chromaTolerance, setChromaTolerance] = useState(80);
  const [processedSprites, setProcessedSprites] = useState<ExtractedSprite[]>(sprites);
  const [aaInset, setAaInset] = useState(3);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animTimerRef = useRef<number>(0);
  const lastKeyRef = useRef<string>('ArrowDown');

  // Process sprites through chroma key when enabled
  useEffect(() => {
    if (!chromaEnabled) {
      setProcessedSprites(sprites);
      return;
    }

    let cancelled = false;
    Promise.all(sprites.map((s) => applyChromaToSprite(s, chromaTolerance)))
      .then((result) => {
        if (!cancelled) setProcessedSprites(result);
      });

    return () => { cancelled = true; };
  }, [sprites, chromaEnabled, chromaTolerance]);

  const currentAnim = ANIMATIONS[selectedAnim];
  const currentFrames = currentAnim.frames;

  // Build sprite lookup from processed sprites
  const spriteMap = new Map<number, ExtractedSprite>();
  for (const s of processedSprites) {
    spriteMap.set(s.cellIndex, s);
  }

  // Animation loop
  useEffect(() => {
    if (currentFrames.length <= 1) {
      setFrameIndex(0);
      return;
    }

    const tick = () => {
      setFrameIndex((prev) => {
        const next = prev + 1;
        if (next >= currentFrames.length) {
          return currentAnim.loop ? 0 : currentFrames.length - 1;
        }
        return next;
      });
    };

    animTimerRef.current = window.setInterval(tick, speed);
    return () => window.clearInterval(animTimerRef.current);
  }, [currentFrames.length, currentAnim.loop, speed, selectedAnim]);

  // Reset frame on anim change
  useEffect(() => {
    setFrameIndex(0);
  }, [selectedAnim]);

  // Draw current frame to canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const cellIdx = currentFrames[frameIndex] ?? currentFrames[0];
    const sprite = spriteMap.get(cellIdx);
    if (!sprite) return;

    const ctx = canvas.getContext('2d')!;
    const img = new Image();
    img.onload = () => {
      const w = img.width * scale;
      const h = img.height * scale;
      canvas.width = Math.max(w, 128);
      canvas.height = Math.max(h, 128);

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw checkerboard
      const tileSize = 8;
      for (let y = 0; y < canvas.height; y += tileSize) {
        for (let x = 0; x < canvas.width; x += tileSize) {
          const light = ((x / tileSize + y / tileSize) % 2) === 0;
          ctx.fillStyle = light ? '#1a1a3a' : '#12122a';
          ctx.fillRect(x, y, tileSize, tileSize);
        }
      }

      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(
        img,
        Math.floor((canvas.width - w) / 2),
        Math.floor((canvas.height - h) / 2),
        w,
        h,
      );
    };
    img.src = `data:${sprite.mimeType};base64,${sprite.imageData}`;
  }, [frameIndex, currentFrames, spriteMap, scale]);

  // Arrow key navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (DIR_WALK[e.key]) {
        e.preventDefault();
        const walkName = DIR_WALK[e.key];
        const idx = ANIMATIONS.findIndex((a) => a.name === walkName);
        if (idx !== -1) {
          setSelectedAnim(idx);
          lastKeyRef.current = e.key;
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (DIR_IDLE[e.key] && e.key === lastKeyRef.current) {
        const idleName = DIR_IDLE[e.key];
        const idx = ANIMATIONS.findIndex((a) => a.name === idleName);
        if (idx !== -1) setSelectedAnim(idx);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Export sprite sheet
  const handleExportSheet = useCallback(async () => {
    if (processedSprites.length === 0) return;
    try {
      const { base64 } = await composeSpriteSheet(processedSprites);
      const link = document.createElement('a');
      link.href = `data:image/png;base64,${base64}`;
      link.download = `${state.character.name || 'sprites'}-sheet.png`;
      link.click();
      dispatch({ type: 'SET_STATUS', message: 'Sprite sheet exported!', statusType: 'success' });
    } catch (err: any) {
      dispatch({ type: 'SET_STATUS', message: 'Export failed: ' + err.message, statusType: 'error' });
    }
  }, [processedSprites, state.character.name, dispatch]);

  // Export individual PNGs
  const handleExportIndividual = useCallback(() => {
    if (processedSprites.length === 0) return;
    for (const sprite of processedSprites) {
      const link = document.createElement('a');
      link.href = `data:${sprite.mimeType};base64,${sprite.imageData}`;
      const safeName = sprite.label.toLowerCase().replace(/\s+/g, '-');
      link.download = `${state.character.name || 'sprite'}-${safeName}.png`;
      link.click();
    }
    dispatch({ type: 'SET_STATUS', message: `Exported ${processedSprites.length} individual sprites!`, statusType: 'success' });
  }, [processedSprites, state.character.name, dispatch]);

  return (
    <div className="review-layout">
      {/* Left: Sprite Grid */}
      <div className="review-main">
        <SpriteGrid sprites={processedSprites} />
      </div>

      {/* Right: Sidebar */}
      <aside className="review-sidebar">
        {/* Animation Groups */}
        <div className="sidebar-section">
          <h3>Animation</h3>
          <div className="anim-group-grid">
            {ANIMATIONS.map((anim, idx) => (
              <button
                key={anim.name}
                className={`anim-group-btn ${idx === selectedAnim ? 'active' : ''}`}
                onClick={() => setSelectedAnim(idx)}
              >
                {anim.name}
              </button>
            ))}
          </div>
        </div>

        {/* Animation Preview */}
        <div className="sidebar-section">
          <h3>Preview</h3>
          <canvas ref={canvasRef} className="anim-preview-canvas" />
        </div>

        {/* Speed Slider */}
        <div className="sidebar-section">
          <h3>Speed (ms/frame)</h3>
          <div className="slider-row">
            <input
              type="range"
              min={50}
              max={500}
              value={speed}
              onChange={(e) => setSpeed(Number(e.target.value))}
            />
            <span className="slider-value">{speed}</span>
          </div>
        </div>

        {/* Scale Slider */}
        <div className="sidebar-section">
          <h3>Scale</h3>
          <div className="slider-row">
            <input
              type="range"
              min={1}
              max={4}
              value={scale}
              onChange={(e) => setScale(Number(e.target.value))}
            />
            <span className="slider-value">{scale}x</span>
          </div>
        </div>

        {/* Arrow Key Hint */}
        <div className="sidebar-section">
          <h3>Movement</h3>
          <div className="arrow-hint">
            <div className="arrow-hint-row">
              <div className="arrow-key">^</div>
            </div>
            <div className="arrow-hint-row">
              <div className="arrow-key">&lt;</div>
              <div className="arrow-key">v</div>
              <div className="arrow-key">&gt;</div>
            </div>
            <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)', marginTop: 4 }}>
              Arrow keys to walk/idle
            </span>
          </div>
        </div>

        {/* Chroma Key */}
        <div className="sidebar-section">
          <h3>Chroma Key</h3>
          <div className="anim-group-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <button
              className={`anim-group-btn ${!chromaEnabled ? 'active' : ''}`}
              onClick={() => setChromaEnabled(false)}
            >
              Off
            </button>
            <button
              className={`anim-group-btn ${chromaEnabled ? 'active' : ''}`}
              onClick={() => setChromaEnabled(true)}
            >
              On
            </button>
          </div>
          {chromaEnabled && (
            <div className="slider-row" style={{ marginTop: 8 }}>
              <input
                type="range"
                min={10}
                max={150}
                value={chromaTolerance}
                onChange={(e) => setChromaTolerance(Number(e.target.value))}
              />
              <span className="slider-value">{chromaTolerance}</span>
            </div>
          )}
        </div>

        {/* Re-extract */}
        <div className="sidebar-section">
          <div className="slider-row">
            <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Edge inset</label>
            <select
              value={aaInset}
              onChange={(e) => setAaInset(Number(e.target.value))}
              className="btn btn-sm"
              style={{ width: 'auto', padding: '2px 6px' }}
            >
              {[0, 1, 2, 3, 4, 5, 6].map((v) => (
                <option key={v} value={v}>{v}px</option>
              ))}
            </select>
          </div>
          <button className="btn btn-sm w-full" onClick={() => reExtract({ aaInset })}>
            Re-extract Sprites
          </button>
        </div>

        {/* Export */}
        <div className="sidebar-section">
          <h3>Export</h3>
          <div className="export-bar">
            <button className="btn btn-success w-full" onClick={handleExportSheet}>
              Export Sprite Sheet
            </button>
            <button className="btn w-full" onClick={handleExportIndividual}>
              Export Individual PNGs
            </button>
          </div>
        </div>

        {/* Navigation */}
        <div className="sidebar-section">
          <div className="export-bar">
            <button
              className="btn w-full"
              onClick={() => setStep('configure')}
            >
              Back to Configure
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
}
