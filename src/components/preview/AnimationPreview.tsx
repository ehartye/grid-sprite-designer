/**
 * Full-screen animation preview.
 * Shows the selected animation at large scale with arrow key controls.
 * Accessible from the review step.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useGridWorkflow } from '../../hooks/useGridWorkflow';
import { ANIMATIONS, DIR_WALK, DIR_IDLE } from '../../lib/poses';
import { ExtractedSprite } from '../../lib/spriteExtractor';

export function AnimationPreview() {
  const { state, setStep } = useGridWorkflow();
  const { sprites } = state;

  const [selectedAnim, setSelectedAnim] = useState(0);
  const [frameIndex, setFrameIndex] = useState(0);
  const [speed, setSpeed] = useState(150);
  const scale = 4;

  const canvasRef = useRef<HTMLCanvasElement>(null);
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

    const timer = window.setInterval(() => {
      setFrameIndex((prev) => {
        const next = prev + 1;
        if (next >= currentFrames.length) {
          return currentAnim.loop ? 0 : currentFrames.length - 1;
        }
        return next;
      });
    }, speed);

    return () => window.clearInterval(timer);
  }, [currentFrames.length, currentAnim.loop, speed, selectedAnim]);

  // Reset frame on anim change
  useEffect(() => {
    setFrameIndex(0);
  }, [selectedAnim]);

  // Draw current frame
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const cellIdx = currentFrames[frameIndex] ?? currentFrames[0];
    const sprite = spriteMap.get(cellIdx);
    if (!sprite) return;

    let cancelled = false;
    const ctx = canvas.getContext('2d')!;
    const img = new Image();
    img.onload = () => {
      if (cancelled) return;

      const w = img.width * scale;
      const h = img.height * scale;
      canvas.width = Math.max(w, 256);
      canvas.height = Math.max(h, 256);

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Checkerboard
      const tileSize = 16;
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

    return () => {
      cancelled = true;
      img.src = '';
    };
  }, [frameIndex, currentFrames, spriteMap, scale]);

  // Arrow key controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setStep('review');
        return;
      }
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
  }, [setStep]);

  return (
    <div className="preview-panel">
      <h2
        style={{
          fontFamily: 'var(--font-pixel)',
          fontSize: '0.65rem',
          color: 'var(--accent-hover)',
          textShadow: '0 0 8px var(--accent-glow)',
        }}
      >
        {currentAnim.name}
      </h2>

      <canvas ref={canvasRef} />

      <div className="anim-group-grid" style={{ justifyContent: 'center' }}>
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

      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
          Speed:
        </label>
        <div className="slider-row" style={{ width: 200 }}>
          <input
            type="range"
            min={50}
            max={500}
            value={speed}
            onChange={(e) => setSpeed(Number(e.target.value))}
          />
          <span className="slider-value">{speed}ms</span>
        </div>
      </div>

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
          Arrow keys to walk / Esc to return
        </span>
      </div>

      <button className="btn" onClick={() => setStep('review')}>
        Back to Review
      </button>
    </div>
  );
}
