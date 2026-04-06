import { useState, useEffect, useRef, useMemo, RefObject } from 'react';
import { ANIMATIONS, expandAnimations, findDirectionalAnim, AnimationDef } from '../lib/poses';
import type { CellGroup } from '../context/AppContext';
import type { ExtractedSprite } from '../lib/spriteExtractor';

interface UseAnimationLoopOptions {
  cellCount: number;
  hasAnimGroups: boolean;
  effectiveCellGroups: CellGroup[] | undefined;
  effectiveCellLabels?: string[];
  displaySprites: ExtractedSprite[];
  mirroredCells: Set<number>;
}

export interface AnimationLoopState {
  selectedAnim: number;
  setSelectedAnim: (v: number) => void;
  frameIndex: number;
  speed: number;
  setSpeed: (v: number) => void;
  scale: number;
  setScale: (v: number) => void;
  canvasRef: RefObject<HTMLCanvasElement>;
  animations: AnimationDef[];
  currentFrames: number[];
}

export function useAnimationLoop({
  cellCount,
  hasAnimGroups,
  effectiveCellGroups,
  effectiveCellLabels,
  displaySprites,
  mirroredCells,
}: UseAnimationLoopOptions): AnimationLoopState {
  const [selectedAnim, setSelectedAnim] = useState(0);
  const [frameIndex, setFrameIndex] = useState(0);
  const [speed, setSpeed] = useState(150);
  const [scale, setScale] = useState(2);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animTimerRef = useRef<number>(0);
  const lastKeyRef = useRef<string>('ArrowDown');

  const animations: AnimationDef[] = useMemo(
    () => {
      const expanded = expandAnimations(effectiveCellGroups, effectiveCellLabels);
      return expanded.length > 0 ? expanded : ANIMATIONS;
    },
    [effectiveCellGroups, effectiveCellLabels],
  );

  const allCellFrames = useMemo(
    () => Array.from({ length: cellCount }, (_, i) => i),
    [cellCount],
  );
  const currentAnim = !hasAnimGroups ? null : animations[selectedAnim];
  const currentFrames = !hasAnimGroups ? allCellFrames : currentAnim!.frames;

  // Build sprite lookup from display-ordered sprites
  const spriteMap = useMemo(() => {
    const map = new Map<number, ExtractedSprite>();
    for (const s of displaySprites) map.set(s.cellIndex, s);
    return map;
  }, [displaySprites]);

  // Animation loop
  useEffect(() => {
    if (currentFrames.length <= 1) {
      setFrameIndex(0);
      return;
    }

    const shouldLoop = !hasAnimGroups || currentAnim?.loop;
    const tick = () => {
      setFrameIndex((prev) => {
        const next = prev + 1;
        if (next >= currentFrames.length) {
          return shouldLoop ? 0 : currentFrames.length - 1;
        }
        return next;
      });
    };

    animTimerRef.current = window.setInterval(tick, speed);
    return () => window.clearInterval(animTimerRef.current);
  }, [currentFrames.length, currentAnim?.loop, speed, selectedAnim, hasAnimGroups]);

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

    let cancelled = false;
    const ctx = canvas.getContext('2d')!;
    const img = new Image();
    img.onload = () => {
      if (cancelled) return;

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

      const dx = Math.floor((canvas.width - w) / 2);
      const dy = Math.floor((canvas.height - h) / 2);

      if (mirroredCells.has(cellIdx)) {
        ctx.save();
        ctx.translate(dx + w, dy);
        ctx.scale(-1, 1);
        ctx.drawImage(img, 0, 0, w, h);
        ctx.restore();
      } else {
        ctx.drawImage(img, dx, dy, w, h);
      }
    };
    img.src = `data:${sprite.mimeType};base64,${sprite.imageData}`;

    return () => {
      cancelled = true;
      img.src = '';
    };
  }, [frameIndex, currentFrames, spriteMap, scale, mirroredCells]);

  // Arrow key navigation (when animation groups available)
  useEffect(() => {
    if (!hasAnimGroups) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const walkIdx = findDirectionalAnim(animations, e.key, 'walk');
      if (walkIdx !== -1) {
        e.preventDefault();
        setSelectedAnim(walkIdx);
        lastKeyRef.current = e.key;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key !== lastKeyRef.current) return;
      const idleIdx = findDirectionalAnim(animations, e.key, 'idle');
      if (idleIdx !== -1) setSelectedAnim(idleIdx);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [hasAnimGroups, animations]);

  return {
    selectedAnim, setSelectedAnim,
    frameIndex,
    speed, setSpeed,
    scale, setScale,
    canvasRef,
    animations,
    currentFrames,
  };
}
