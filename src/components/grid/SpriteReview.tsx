/**
 * Review step layout.
 * Left panel: 6x6 sprite grid.
 * Right sidebar: animation preview, export controls, re-extraction.
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useGridWorkflow } from '../../hooks/useGridWorkflow';
import { useBuildingWorkflow } from '../../hooks/useBuildingWorkflow';
import { useTerrainWorkflow } from '../../hooks/useTerrainWorkflow';
import { useBackgroundWorkflow } from '../../hooks/useBackgroundWorkflow';
import { useEditorSettings } from '../../hooks/useEditorSettings';
import { SpriteGrid } from './SpriteGrid';
import { SpriteZoomModal } from './SpriteZoomModal';
import { ANIMATIONS, DIR_WALK, DIR_IDLE, AnimationDef } from '../../lib/poses';
import type { CellGroup, GridLink } from '../../context/AppContext';
import { composeSpriteSheet, ExtractedSprite } from '../../lib/spriteExtractor';
import { applyChromaKey, defringeRecolor, strikeColors } from '../../lib/chromaKey';
import { posterize } from '../../lib/imagePreprocess';

type RGB = [number, number, number];

async function processSprite(
  sprite: ExtractedSprite,
  posterizeOutput: boolean,
  posterizeBits: number,
  chromaEnabled: boolean,
  chromaTolerance: number,
  struckColors: RGB[],
  erasedPixels?: Set<string>,
  edgeRecolorPasses = 0,
  recolorSensitivity = 50,
  defringeCore = 240,
): Promise<ExtractedSprite> {
  const hasErasure = erasedPixels && erasedPixels.size > 0;
  if (!posterizeOutput && !chromaEnabled && struckColors.length === 0 && !hasErasure && !edgeRecolorPasses) return sprite;

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

  let imageData = ctx.getImageData(0, 0, img.width, img.height);
  if (posterizeOutput) imageData = posterize(imageData, posterizeBits);
  if (chromaEnabled) imageData = applyChromaKey(imageData, chromaTolerance, defringeCore);
  if (edgeRecolorPasses > 0) imageData = defringeRecolor(imageData, 255, 0, 255, edgeRecolorPasses, recolorSensitivity);
  if (struckColors.length > 0) imageData = strikeColors(imageData, struckColors);
  if (hasErasure) {
    for (const key of erasedPixels) {
      const sep = key.indexOf(',');
      const x = parseInt(key.substring(0, sep), 10);
      const y = parseInt(key.substring(sep + 1), 10);
      if (x >= 0 && y >= 0 && x < img.width && y < img.height) {
        const i = (y * img.width + x) * 4;
        imageData.data[i + 3] = 0;
      }
    }
  }

  ctx.putImageData(imageData, 0, 0);
  const dataUrl = canvas.toDataURL('image/png');
  const base64 = dataUrl.split(',')[1];

  return { ...sprite, imageData: base64, mimeType: 'image/png' };
}

/** Detect distinct colors from sprites using 4-bit quantization. */
async function detectPalette(sprites: ExtractedSprite[], maxColors = 144): Promise<RGB[]> {
  const counts = new Map<number, { r: number; g: number; b: number; n: number }>();

  // Sample from up to 12 sprites for broader coverage
  for (const sprite of sprites.slice(0, 12)) {
    const img = new Image();
    await new Promise<void>((resolve) => {
      img.onload = () => resolve();
      img.src = `data:${sprite.mimeType};base64,${sprite.imageData}`;
    });

    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0);
    const data = ctx.getImageData(0, 0, img.width, img.height).data;

    // Sample every 2nd pixel for speed
    for (let i = 0; i < data.length; i += 8) {
      if (data[i + 3] === 0) continue;
      // 4-bit quantization: 16 values per channel = finer color separation
      const qr = data[i] >> 4;
      const qg = data[i + 1] >> 4;
      const qb = data[i + 2] >> 4;
      const key = (qr << 8) | (qg << 4) | qb;
      const entry = counts.get(key);
      if (entry) {
        entry.r += data[i];
        entry.g += data[i + 1];
        entry.b += data[i + 2];
        entry.n++;
      } else {
        counts.set(key, { r: data[i], g: data[i + 1], b: data[i + 2], n: 1 });
      }
    }
  }

  return Array.from(counts.values())
    .sort((a, b) => b.n - a.n)
    .slice(0, maxColors)
    .map((e) => [Math.round(e.r / e.n), Math.round(e.g / e.n), Math.round(e.b / e.n)]);
}

interface SpriteReviewProps {
  cellGroups?: CellGroup[];
}

export function SpriteReview({ cellGroups }: SpriteReviewProps = {}) {
  const { state, dispatch, reExtract: charReExtract, setStep } = useGridWorkflow();
  const { reExtract: buildingReExtract } = useBuildingWorkflow();
  const { reExtract: terrainReExtract } = useTerrainWorkflow();
  const { reExtract: backgroundReExtract } = useBackgroundWorkflow();
  const { sprites } = state;
  const isCharacter = state.spriteType === 'character';

  // Derive current grid link from run state (if active)
  const currentGridLink: GridLink | null = state.run?.active
    ? state.run.selectedGridLinks[state.run.currentGridIndex] ?? null
    : null;

  // Dynamic grid dimensions: prefer activeGridConfig (set during generation), then run's grid link, then character 6x6
  const agc = state.activeGridConfig;
  const dynamicCols = agc?.cols ?? currentGridLink?.cols ?? (isCharacter ? 6 : undefined);
  const dynamicRows = agc?.rows ?? currentGridLink?.rows ?? (isCharacter ? 6 : undefined);
  const cellCount = (dynamicCols && dynamicRows) ? dynamicCols * dynamicRows : 36;
  const dynamicCellLabels = agc?.cellLabels ?? currentGridLink?.cellLabels;
  const dynamicAspectRatio = agc?.aspectRatio ?? currentGridLink?.aspectRatio;

  // Use cellGroups from props, or from activeGridConfig, or from current grid link, or fall back to default ANIMATIONS
  const effectiveCellGroups = cellGroups ?? agc?.cellGroups ?? currentGridLink?.cellGroups;
  const animations: AnimationDef[] = useMemo(
    () => effectiveCellGroups?.length
      ? effectiveCellGroups.map(g => ({ name: g.name, frames: g.cells, loop: true }))
      : ANIMATIONS,
    [effectiveCellGroups],
  );
  const hasAnimGroups = isCharacter || (effectiveCellGroups?.length ?? 0) > 0;
  const reExtract =
    state.spriteType === 'building' ? buildingReExtract :
    state.spriteType === 'terrain' ? terrainReExtract :
    state.spriteType === 'background' ? backgroundReExtract :
    charReExtract;

  const [selectedAnim, setSelectedAnim] = useState(0);
  const [frameIndex, setFrameIndex] = useState(0);
  const [speed, setSpeed] = useState(150);
  const [scale, setScale] = useState(2);
  const [chromaEnabled, setChromaEnabled] = useState(false);
  const [chromaTolerance, setChromaTolerance] = useState(80);
  const [processedSprites, setProcessedSprites] = useState<ExtractedSprite[]>(sprites);
  const [aaInset, setAaInset] = useState(3);
  const [posterizeBits, setPosterizeBits] = useState(4);
  const [posterizeOutput, setPosterizeOutput] = useState(false);
  const [palette, setPalette] = useState<RGB[]>([]);
  const [struckColors, setStruckColors] = useState<RGB[]>([]);
  const [showRareColors, setShowRareColors] = useState(false);
  const [swapSource, setSwapSource] = useState<number | null>(null);
  const [displayOrder, setDisplayOrder] = useState<number[]>(() => Array.from({ length: sprites.length || cellCount }, (_, i) => i));
  const [mirroredCells, setMirroredCells] = useState<Set<number>>(new Set());
  const [thumbnailCell, setThumbnailCell] = useState<number | null>(null);
  const [zoomSpriteIndex, setZoomSpriteIndex] = useState<number | null>(null);
  const [erasedPixels, setErasedPixels] = useState<Map<number, Set<string>>>(new Map());
  const [edgeRecolorPasses, setEdgeRecolorPasses] = useState(0);
  const [recolorSensitivity, setRecolorSensitivity] = useState(50);
  const [defringeCore, setDefringeCore] = useState(240);
  const struckKey = JSON.stringify(struckColors);
  const erasedKey = useMemo(() => {
    let total = 0;
    for (const s of erasedPixels.values()) total += s.size;
    return total;
  }, [erasedPixels]);

  const { save: saveSettings, load: loadSettings } = useEditorSettings(state.historyId);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animTimerRef = useRef<number>(0);
  const lastKeyRef = useRef<string>('ArrowDown');

  // Detect palette from sprites with posterization only (never chroma/strikes,
  // so striking a color doesn't reshuffle the palette).
  useEffect(() => {
    if (sprites.length === 0) return;
    let cancelled = false;

    const sourcePromise = posterizeOutput
      ? Promise.all(sprites.map(s => processSprite(s, true, posterizeBits, false, 0, [])))
      : Promise.resolve(sprites);

    sourcePromise.then(source => {
      if (cancelled) return;
      return detectPalette(source);
    }).then(p => {
      if (p && !cancelled) setPalette(p);
    });

    return () => { cancelled = true; };
  }, [sprites, posterizeOutput, posterizeBits]);

  // Process sprites through posterization + chroma key + color strikes + erasures
  useEffect(() => {
    if (!posterizeOutput && !chromaEnabled && struckColors.length === 0 && erasedPixels.size === 0 && !edgeRecolorPasses) {
      setProcessedSprites(sprites);
      return;
    }

    let cancelled = false;
    Promise.all(sprites.map((s) =>
      processSprite(s, posterizeOutput, posterizeBits, chromaEnabled, chromaTolerance, struckColors, erasedPixels.get(s.cellIndex), edgeRecolorPasses, recolorSensitivity, defringeCore),
    ))
      .then((result) => {
        if (!cancelled) setProcessedSprites(result);
      });

    return () => { cancelled = true; };
  }, [sprites, posterizeOutput, posterizeBits, chromaEnabled, chromaTolerance, struckKey, erasedKey, edgeRecolorPasses, recolorSensitivity, defringeCore]);

  const [settingsLoaded, setSettingsLoaded] = useState(!state.historyId);

  // Derive display-ordered sprites: remap cellIndex based on displayOrder
  const displaySprites = useMemo(() => {
    const byCell = new Map<number, ExtractedSprite>();
    for (const s of processedSprites) byCell.set(s.cellIndex, s);

    return displayOrder.map((srcIdx, displayIdx) => {
      const sprite = byCell.get(srcIdx);
      if (!sprite) return null;
      return { ...sprite, cellIndex: displayIdx };
    }).filter(Boolean) as ExtractedSprite[];
  }, [processedSprites, displayOrder]);

  // For non-character types, cycle through all cells; for characters, use animation definitions
  const allCellFrames = useMemo(
    () => Array.from({ length: cellCount }, (_, i) => i),
    [cellCount],
  );
  const currentAnim = !hasAnimGroups ? null : animations[selectedAnim];
  const currentFrames = !hasAnimGroups ? allCellFrames : currentAnim!.frames;

  // Build sprite lookup from display-ordered sprites
  const spriteMap = new Map<number, ExtractedSprite>();
  for (const s of displaySprites) {
    spriteMap.set(s.cellIndex, s);
  }

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

  // Swap click handler
  const handleCellClick = useCallback((cellIndex: number) => {
    if (swapSource === null) {
      setSwapSource(cellIndex);
    } else if (swapSource === cellIndex) {
      setSwapSource(null);
    } else {
      setDisplayOrder((prev) => {
        const next = [...prev];
        const temp = next[swapSource];
        next[swapSource] = next[cellIndex];
        next[cellIndex] = temp;
        return next;
      });
      setSwapSource(null);
    }
  }, [swapSource]);

  const isOrderModified = useMemo(
    () => displayOrder.some((v, i) => v !== i),
    [displayOrder],
  );

  // Arrow key navigation (when animation groups available)
  useEffect(() => {
    if (!hasAnimGroups) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (DIR_WALK[e.key]) {
        e.preventDefault();
        const walkName = DIR_WALK[e.key];
        const idx = animations.findIndex((a) => a.name === walkName);
        if (idx !== -1) {
          setSelectedAnim(idx);
          lastKeyRef.current = e.key;
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (DIR_IDLE[e.key] && e.key === lastKeyRef.current) {
        const idleName = DIR_IDLE[e.key];
        const idx = animations.findIndex((a) => a.name === idleName);
        if (idx !== -1) setSelectedAnim(idx);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [hasAnimGroups, animations]);

  // Apply mirror flip to a sprite's image data (returns new base64)
  const flipSpriteHorizontally = useCallback(async (sprite: ExtractedSprite): Promise<ExtractedSprite> => {
    const img = new Image();
    await new Promise<void>((resolve) => {
      img.onload = () => resolve();
      img.src = `data:${sprite.mimeType};base64,${sprite.imageData}`;
    });
    const c = document.createElement('canvas');
    c.width = img.width;
    c.height = img.height;
    const ctx = c.getContext('2d')!;
    ctx.translate(img.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(img, 0, 0);
    const base64 = c.toDataURL('image/png').split(',')[1];
    return { ...sprite, imageData: base64, mimeType: 'image/png' };
  }, []);

  // Prepare export sprites (apply mirrors)
  const getExportSprites = useCallback(async () => {
    const results: ExtractedSprite[] = [];
    for (const sprite of displaySprites) {
      if (mirroredCells.has(sprite.cellIndex)) {
        results.push(await flipSpriteHorizontally(sprite));
      } else {
        results.push(sprite);
      }
    }
    return results;
  }, [displaySprites, mirroredCells, flipSpriteHorizontally]);

  // Export sprite sheet
  const handleExportSheet = useCallback(async () => {
    if (displaySprites.length === 0) return;
    try {
      const exportSprites = await getExportSprites();
      const gridCols = dynamicCols;
      const { base64 } = await composeSpriteSheet(exportSprites, gridCols);
      const link = document.createElement('a');
      const exportName =
        state.spriteType === 'building' ? state.building.name :
        state.spriteType === 'terrain' ? state.terrain.name :
        state.spriteType === 'background' ? state.background.name :
        state.character.name;
      link.href = `data:image/png;base64,${base64}`;
      link.download = `${exportName || 'sprites'}-sheet.png`;
      link.click();
      dispatch({ type: 'SET_STATUS', message: 'Sprite sheet exported!', statusType: 'success' });
    } catch (err: any) {
      dispatch({ type: 'SET_STATUS', message: 'Export failed: ' + err.message, statusType: 'error' });
    }
  }, [displaySprites, getExportSprites, state.character.name, state.building.name, state.terrain.name, state.background.name, state.spriteType, dynamicCols, dispatch]);

  // Export individual PNGs
  const handleExportIndividual = useCallback(async () => {
    if (displaySprites.length === 0) return;
    const exportSprites = await getExportSprites();
    const baseName =
      state.spriteType === 'building' ? state.building.name :
      state.spriteType === 'terrain' ? state.terrain.name :
      state.spriteType === 'background' ? state.background.name :
      state.character.name;
    for (const sprite of exportSprites) {
      const link = document.createElement('a');
      link.href = `data:${sprite.mimeType};base64,${sprite.imageData}`;
      const safeName = sprite.label.toLowerCase().replace(/\s+/g, '-');
      link.download = `${baseName || 'sprite'}-${safeName}.png`;
      link.click();
    }
    dispatch({ type: 'SET_STATUS', message: `Exported ${exportSprites.length} individual sprites!`, statusType: 'success' });
  }, [displaySprites, getExportSprites, state.character.name, state.building.name, state.terrain.name, state.background.name, state.spriteType, dispatch]);

  // Load all persisted editor state when historyId changes.
  // Resets to defaults first, then overwrites from DB — merged into one effect
  // so the save effect can't clobber DB with reset values.
  useEffect(() => {
    if (!state.historyId) {
      setSettingsLoaded(true);
      return;
    }
    setSettingsLoaded(false);
    let cancelled = false;

    // Reset to defaults immediately
    setDisplayOrder(Array.from({ length: sprites.length || cellCount }, (_, i) => i));
    setSwapSource(null);
    setMirroredCells(new Set());
    setThumbnailCell(null);
    setChromaEnabled(false);
    setChromaTolerance(80);
    setStruckColors([]);
    setAaInset(3);
    setPosterizeBits(4);
    setPosterizeOutput(false);
    setEdgeRecolorPasses(0);
    setRecolorSensitivity(50);
    setDefringeCore(240);

    Promise.all([
      loadSettings(),
      fetch(`/api/history/${state.historyId}`).then((r) => r.json()).catch(() => null),
    ]).then(([settings, histData]) => {
      if (cancelled) return;
      if (settings) {
        setChromaEnabled(settings.chromaEnabled);
        setChromaTolerance(settings.chromaTolerance);
        setStruckColors(settings.struckColors);
        if (settings.mirroredCells.length > 0) setMirroredCells(new Set(settings.mirroredCells));
        if (settings.cellOrder.length > 0) setDisplayOrder(settings.cellOrder);
        setAaInset(settings.aaInset);
        setPosterizeBits(settings.posterizeBits);
        setPosterizeOutput(settings.posterizeOutput);
        if (settings.edgeRecolorPasses) setEdgeRecolorPasses(settings.edgeRecolorPasses);
        if (settings.recolorSensitivity != null) setRecolorSensitivity(settings.recolorSensitivity);
        if (settings.defringeCore != null) setDefringeCore(settings.defringeCore);
      }
      if (histData?.thumbnailCellIndex != null) {
        setThumbnailCell(histData.thumbnailCellIndex);
      }
      setSettingsLoaded(true);
    });

    return () => { cancelled = true; };
  }, [state.historyId, loadSettings]);

  // Save settings on change (debounced internally) — skip until initial load completes
  useEffect(() => {
    if (!settingsLoaded) return;
    saveSettings({
      chromaEnabled,
      chromaTolerance,
      struckColors,
      mirroredCells: Array.from(mirroredCells),
      cellOrder: displayOrder,
      aaInset,
      posterizeBits,
      posterizeOutput,
      edgeRecolorPasses,
      recolorSensitivity,
      defringeCore,
    });
  }, [settingsLoaded, chromaEnabled, chromaTolerance, struckKey, mirroredCells, displayOrder, aaInset, posterizeBits, posterizeOutput, edgeRecolorPasses, recolorSensitivity, defringeCore, saveSettings]);

  const handleMirrorToggle = useCallback((cellIndex: number) => {
    setMirroredCells((prev) => {
      const next = new Set(prev);
      if (next.has(cellIndex)) next.delete(cellIndex);
      else next.add(cellIndex);
      return next;
    });
  }, []);

  const handleThumbnailSet = useCallback(async (cellIndex: number) => {
    if (!state.historyId) return;
    setThumbnailCell(cellIndex);

    // Find the processed sprite (chroma + color strikes applied)
    const sprite = displaySprites.find((s) => s.cellIndex === cellIndex);
    let imageData = sprite?.imageData ?? null;
    let mimeType = sprite?.mimeType ?? null;

    // Apply mirror if active
    if (sprite && mirroredCells.has(cellIndex)) {
      const flipped = await flipSpriteHorizontally(sprite);
      imageData = flipped.imageData;
      mimeType = flipped.mimeType;
    }

    fetch(`/api/history/${state.historyId}/thumbnail`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cellIndex, imageData, mimeType }),
    }).catch(() => {});
  }, [state.historyId, displaySprites, mirroredCells, flipSpriteHorizontally]);

  const handleZoomClick = useCallback((cellIndex: number) => {
    setZoomSpriteIndex(cellIndex);
  }, []);

  const handleZoomStrikeColor = useCallback((color: RGB) => {
    setStruckColors((prev) => {
      if (prev.some((c) => c[0] === color[0] && c[1] === color[1] && c[2] === color[2])) return prev;
      return [...prev, color];
    });
  }, []);

  const handleZoomUnstrikeColor = useCallback((color: RGB) => {
    setStruckColors((prev) =>
      prev.filter((c) => c[0] !== color[0] || c[1] !== color[1] || c[2] !== color[2]),
    );
  }, []);

  const handleErasePixel = useCallback((x: number, y: number) => {
    if (zoomSpriteIndex === null) return;
    // Map display cellIndex back to source cellIndex
    const srcIdx = displayOrder[zoomSpriteIndex];
    setErasedPixels((prev) => {
      const next = new Map(prev);
      const existing = next.get(srcIdx);
      const copy = existing ? new Set(existing) : new Set<string>();
      copy.add(`${x},${y}`);
      next.set(srcIdx, copy);
      return next;
    });
  }, [zoomSpriteIndex, displayOrder]);

  return (
    <div className="review-layout">
      {/* Left: Sprite Grid */}
      <div className="review-main">
        {swapSource !== null && (
          <div style={{ textAlign: 'center', padding: '6px 0', fontSize: '0.75rem', color: 'var(--accent)' }}>
            Click another cell to swap, or click the same cell to cancel
          </div>
        )}
        <SpriteGrid
          sprites={displaySprites}
          onCellClick={handleCellClick}
          selectedCell={swapSource}
          mirroredCells={mirroredCells}
          onMirrorToggle={handleMirrorToggle}
          thumbnailCell={thumbnailCell}
          onThumbnailSet={state.historyId ? handleThumbnailSet : undefined}
          onZoomClick={handleZoomClick}
          gridCols={dynamicCols}
          cellLabels={dynamicCellLabels}
          aspectRatio={dynamicAspectRatio}
        />
        {isOrderModified && (
          <div style={{ textAlign: 'center', padding: '6px 0' }}>
            <button
              className="btn btn-sm"
              onClick={() => {
                setDisplayOrder(Array.from({ length: sprites.length || cellCount }, (_, i) => i));
                setSwapSource(null);
              }}
            >
              Reset Swaps
            </button>
          </div>
        )}
      </div>

      {/* Right: Sidebar */}
      <aside className="review-sidebar">
        {/* Animation Groups */}
        {hasAnimGroups && (
          <div className="sidebar-section">
            <h3>Animation</h3>
            <div className="anim-group-grid">
              {animations.map((anim, idx) => (
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
        )}

        {/* Cell Cycling Preview */}
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

        {/* Arrow Key Hint (character only) */}
        {isCharacter && (
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
        )}

        {/* Posterize */}
        <div className="sidebar-section">
          <h3>
            Posterize
            <span title="Reduce color depth for a retro pixel-art look. Lower bit values = fewer colors." style={{ cursor: 'help', marginLeft: 4, fontSize: '0.7rem', color: 'var(--text-muted)' }}>&#9432;</span>
          </h3>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                Bit Depth
                <span title="Bits per color channel. 8 = off (original colors). Lower = fewer colors." style={{ cursor: 'help', marginLeft: 4 }}>&#9432;</span>
              </label>
              <span className="slider-value">{posterizeBits === 8 ? 'off' : `${posterizeBits}-bit`}</span>
            </div>
            <input
              type="range"
              min={1}
              max={8}
              value={posterizeBits}
              onChange={(e) => {
                const bits = Number(e.target.value);
                setPosterizeBits(bits);
                if (bits === 8) setPosterizeOutput(false);
              }}
              style={{ width: '100%' }}
            />
          </div>
          {posterizeBits < 8 && (
            <div className="anim-group-grid" style={{ gridTemplateColumns: '1fr 1fr', marginTop: 4 }}>
              <button
                type="button"
                className={`anim-group-btn ${!posterizeOutput ? 'active' : ''}`}
                onClick={() => setPosterizeOutput(false)}
              >
                Original
              </button>
              <button
                type="button"
                className={`anim-group-btn ${posterizeOutput ? 'active' : ''}`}
                onClick={() => setPosterizeOutput(true)}
              >
                Posterized
              </button>
            </div>
          )}
        </div>

        {/* Chroma Key */}
        <div className="sidebar-section">
          <h3>
            Chroma Key
            <span title="Remove magenta background from sprites" style={{ cursor: 'help', marginLeft: 4, fontSize: '0.7rem', color: 'var(--text-muted)' }}>&#9432;</span>
          </h3>
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
            <>
              <div style={{ marginTop: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                    Tolerance
                    <span title="How aggressively the background is removed. Lower values preserve more sprite color but may leave background remnants." style={{ cursor: 'help', marginLeft: 4 }}>&#9432;</span>
                  </label>
                  <span className="slider-value">{chromaTolerance}</span>
                </div>
                <input
                  type="range"
                  min={10}
                  max={150}
                  value={chromaTolerance}
                  onChange={(e) => setChromaTolerance(Number(e.target.value))}
                  style={{ width: '100%' }}
                />
              </div>
              <div style={{ marginTop: 4 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                    Defringe
                    <span title="Fades the alpha of border pixels near the key color. Higher values remove more fringe. Independent of tolerance so edges stay clean even at low tolerance." style={{ cursor: 'help', marginLeft: 4 }}>&#9432;</span>
                  </label>
                  <span className="slider-value">{defringeCore}</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={1000}
                  value={defringeCore}
                  onChange={(e) => setDefringeCore(Number(e.target.value))}
                  style={{ width: '100%' }}
                />
              </div>
              <div style={{ marginTop: 4 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                    Edge Recolor
                    <span title="Replaces pink-tinted RGB on edge pixels with nearby sprite colors. Keeps alpha intact for smooth edges. Higher = more passes inward." style={{ cursor: 'help', marginLeft: 4 }}>&#9432;</span>
                  </label>
                  <span className="slider-value">{edgeRecolorPasses === 0 ? 'off' : edgeRecolorPasses}</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={15}
                  value={edgeRecolorPasses}
                  onChange={(e) => setEdgeRecolorPasses(Number(e.target.value))}
                  style={{ width: '100%' }}
                />
              </div>
              {edgeRecolorPasses > 0 && (
                <div style={{ marginTop: 4 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                      Recolor Sensitivity
                      <span title="How liberally pixels are classified as pink. Low = only obvious magenta. High = catches subtle pink tints." style={{ cursor: 'help', marginLeft: 4 }}>&#9432;</span>
                    </label>
                    <span className="slider-value">{recolorSensitivity}</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={recolorSensitivity}
                    onChange={(e) => setRecolorSensitivity(Number(e.target.value))}
                    style={{ width: '100%' }}
                  />
                </div>
              )}
            </>
          )}
        </div>

        {/* Color Striker */}
        {palette.length > 0 && (
          <div className="sidebar-section">
            <h3>Color Striker</h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {palette.slice(0, 72).map(([r, g, b], i) => {
                const isStruck = struckColors.some(
                  (c) => c[0] === r && c[1] === g && c[2] === b,
                );
                return (
                  <button
                    key={i}
                    onClick={() => {
                      setStruckColors((prev) =>
                        isStruck
                          ? prev.filter((c) => c[0] !== r || c[1] !== g || c[2] !== b)
                          : [...prev, [r, g, b]],
                      );
                    }}
                    title={`rgb(${r}, ${g}, ${b})`}
                    style={{
                      width: 24,
                      height: 24,
                      backgroundColor: `rgb(${r},${g},${b})`,
                      border: isStruck ? '2px solid var(--accent)' : '2px solid var(--border)',
                      borderRadius: 4,
                      cursor: 'pointer',
                      opacity: isStruck ? 0.4 : 1,
                      position: 'relative',
                    }}
                  />
                );
              })}
            </div>
            {palette.length > 72 && (
              <>
                <button
                  className="btn btn-sm w-full"
                  style={{ marginTop: 6 }}
                  onClick={() => setShowRareColors((v) => !v)}
                >
                  {showRareColors ? 'Hide' : 'More Colors'} ({palette.length - 72})
                </button>
                {showRareColors && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
                    {palette.slice(72).map(([r, g, b], i) => {
                      const isStruck = struckColors.some(
                        (c) => c[0] === r && c[1] === g && c[2] === b,
                      );
                      return (
                        <button
                          key={i + 72}
                          onClick={() => {
                            setStruckColors((prev) =>
                              isStruck
                                ? prev.filter((c) => c[0] !== r || c[1] !== g || c[2] !== b)
                                : [...prev, [r, g, b]],
                            );
                          }}
                          title={`rgb(${r}, ${g}, ${b})`}
                          style={{
                            width: 24,
                            height: 24,
                            backgroundColor: `rgb(${r},${g},${b})`,
                            border: isStruck ? '2px solid var(--accent)' : '2px solid var(--border)',
                            borderRadius: 4,
                            cursor: 'pointer',
                            opacity: isStruck ? 0.4 : 1,
                            position: 'relative',
                          }}
                        />
                      );
                    })}
                  </div>
                )}
              </>
            )}
            {struckColors.length > 0 && (
              <button
                className="btn btn-sm w-full"
                style={{ marginTop: 6 }}
                onClick={() => setStruckColors([])}
              >
                Clear All ({struckColors.length})
              </button>
            )}
          </div>
        )}

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
              {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((v) => (
                <option key={v} value={v}>{v}px</option>
              ))}
            </select>
          </div>
          <button
            type="button"
            className="btn btn-sm w-full"
            style={{ marginTop: 6 }}
            onClick={() => reExtract({ aaInset, posterizeBits })}
          >
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

      {zoomSpriteIndex !== null && (() => {
        const zoomSprite = displaySprites.find((s) => s.cellIndex === zoomSpriteIndex);
        if (!zoomSprite) return null;
        return (
          <SpriteZoomModal
            sprite={zoomSprite}
            struckColors={struckColors}
            onStrikeColor={handleZoomStrikeColor}
            onUnstrikeColor={handleZoomUnstrikeColor}
            onErasePixel={handleErasePixel}
            onClose={() => setZoomSpriteIndex(null)}
          />
        );
      })()}
    </div>
  );
}
