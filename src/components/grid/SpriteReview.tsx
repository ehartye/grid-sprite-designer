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

export function SpriteReview() {
  const { state, dispatch, reExtract, setStep } = useGridWorkflow();
  const { sprites } = state;

  const [selectedAnim, setSelectedAnim] = useState(0);
  const [frameIndex, setFrameIndex] = useState(0);
  const [speed, setSpeed] = useState(150);
  const [scale, setScale] = useState(2);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animTimerRef = useRef<number>(0);
  const lastKeyRef = useRef<string>('ArrowDown');

  const currentAnim = ANIMATIONS[selectedAnim];
  const currentFrames = currentAnim.frames;

  // Build sprite lookup
  const spriteMap = new Map<number, ExtractedSprite>();
  for (const s of sprites) {
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
    if (sprites.length === 0) return;
    try {
      const { base64 } = await composeSpriteSheet(sprites);
      const link = document.createElement('a');
      link.href = `data:image/png;base64,${base64}`;
      link.download = `${state.character.name || 'sprites'}-sheet.png`;
      link.click();
      dispatch({ type: 'SET_STATUS', message: 'Sprite sheet exported!', statusType: 'success' });
    } catch (err: any) {
      dispatch({ type: 'SET_STATUS', message: 'Export failed: ' + err.message, statusType: 'error' });
    }
  }, [sprites, state.character.name, dispatch]);

  // Export individual PNGs
  const handleExportIndividual = useCallback(() => {
    if (sprites.length === 0) return;
    for (const sprite of sprites) {
      const link = document.createElement('a');
      link.href = `data:${sprite.mimeType};base64,${sprite.imageData}`;
      const safeName = sprite.label.toLowerCase().replace(/\s+/g, '-');
      link.download = `${state.character.name || 'sprite'}-${safeName}.png`;
      link.click();
    }
    dispatch({ type: 'SET_STATUS', message: `Exported ${sprites.length} individual sprites!`, statusType: 'success' });
  }, [sprites, state.character.name, dispatch]);

  return (
    <div className="review-layout">
      {/* Left: Sprite Grid */}
      <div className="review-main">
        <SpriteGrid sprites={sprites} />
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

        {/* Re-extract */}
        <div className="sidebar-section">
          <button className="btn btn-sm w-full" onClick={reExtract}>
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
