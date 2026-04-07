/**
 * Review step layout.
 * Left panel: 6x6 sprite grid.
 * Right sidebar: animation preview, export controls, re-extraction.
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useGenericWorkflow, WORKFLOW_CONFIGS } from '../../hooks/useGenericWorkflow';
import { useAppState, type CellGroup, type GridLink } from '../../context/AppContext';
import { useEditorSettings } from '../../hooks/useEditorSettings';
import { useChromaKeySettings } from '../../hooks/useChromaKeySettings';
import { usePosterizeSettings } from '../../hooks/usePosterizeSettings';
import { useAnimationLoop } from '../../hooks/useAnimationLoop';
import { useSpriteSelection } from '../../hooks/useSpriteSelection';
import { SpriteGrid } from './SpriteGrid';
import { SpriteZoomModal } from './SpriteZoomModal';
import { composeSpriteSheet, ExtractedSprite, pixelizeSprite } from '../../lib/spriteExtractor';
import { debugLog } from '../../lib/debugLog';
import { applyChromaKey, defringeRecolor, snapAlpha, outlineSprite, strikeColors, detectKeyColor } from '../../lib/chromaKey';
import { posterize } from '../../lib/imagePreprocess';
import { AddSheetModal } from './AddSheetModal';
import { FeedbackPanel } from './FeedbackPanel';
import type { FeedbackState } from '../../types/feedback';
import { createEmptyFeedback, hasFeedback } from '../../types/feedback';
import { useRegenerateWithFeedback } from '../../hooks/useRegenerateWithFeedback';

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
  keyR = 255,
  keyG = 0,
  keyB = 255,
  pixelizeEnabled = false,
  pixelizeSize = 32,
  outlineEnabled = false,
  outlineOutDepth = 1,
  outlineInDepth = 0,
  outlineColor: RGB = [0, 0, 0],
  alphaSnapEnabled = false,
  alphaSnapThreshold = 128,
  strikeTolerance = 10,
): Promise<ExtractedSprite> {
  const hasErasure = erasedPixels && erasedPixels.size > 0;
  if (!posterizeOutput && !chromaEnabled && struckColors.length === 0 && !hasErasure && !edgeRecolorPasses && !pixelizeEnabled && !outlineEnabled && !alphaSnapEnabled) return sprite;

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
  if (chromaEnabled) imageData = applyChromaKey(imageData, chromaTolerance, defringeCore, keyR, keyG, keyB);
  if (edgeRecolorPasses > 0) imageData = defringeRecolor(imageData, keyR, keyG, keyB, edgeRecolorPasses, recolorSensitivity);
  if (alphaSnapEnabled) imageData = snapAlpha(imageData, alphaSnapThreshold);
  if (struckColors.length > 0) imageData = strikeColors(imageData, struckColors, strikeTolerance);

  ctx.putImageData(imageData, 0, 0);

  // Pixelize pass — runs before erasure and outline so all operate at final resolution
  let workingSprite: ExtractedSprite;
  if (pixelizeEnabled) {
    const dataUrl = canvas.toDataURL('image/png');
    const intermediate: ExtractedSprite = { ...sprite, imageData: dataUrl.split(',')[1], mimeType: 'image/png' };
    workingSprite = await pixelizeSprite(intermediate, pixelizeSize);
  } else {
    const dataUrl = canvas.toDataURL('image/png');
    workingSprite = { ...sprite, imageData: dataUrl.split(',')[1], mimeType: 'image/png' };
  }

  // Erasure pass — after pixelization so coordinates match the zoom view
  if (hasErasure) {
    const imgE = new Image();
    await new Promise<void>((resolve, reject) => {
      imgE.onload = () => resolve();
      imgE.onerror = () => reject(new Error('Failed to load sprite for erasure'));
      imgE.src = `data:${workingSprite.mimeType};base64,${workingSprite.imageData}`;
    });
    const cE = document.createElement('canvas');
    cE.width = imgE.width;
    cE.height = imgE.height;
    const ctxE = cE.getContext('2d')!;
    ctxE.drawImage(imgE, 0, 0);
    const idE = ctxE.getImageData(0, 0, imgE.width, imgE.height);
    // Erase coordinates were captured in the original sprite's pixel space.
    // Scale them to the current canvas dimensions (which may be smaller after pixelization).
    const scaleX = imgE.width / sprite.width;
    const scaleY = imgE.height / sprite.height;
    for (const key of erasedPixels!) {
      const sep = key.indexOf(',');
      const ex = parseInt(key.substring(0, sep), 10);
      const ey = parseInt(key.substring(sep + 1), 10);
      const sx = Math.round(ex * scaleX);
      const sy = Math.round(ey * scaleY);
      if (sx >= 0 && sy >= 0 && sx < imgE.width && sy < imgE.height) {
        idE.data[(sy * imgE.width + sx) * 4 + 3] = 0;
      }
    }
    ctxE.putImageData(idE, 0, 0);
    workingSprite = { ...workingSprite, imageData: cE.toDataURL('image/png').split(',')[1], mimeType: 'image/png' };
  }

  // Outline pass — runs last, on pixelized dimensions when pixelize is enabled
  if (outlineEnabled) {
    const img2 = new Image();
    await new Promise<void>((resolve, reject) => {
      img2.onload = () => resolve();
      img2.onerror = () => reject(new Error('Failed to load sprite for outline'));
      img2.src = `data:${workingSprite.mimeType};base64,${workingSprite.imageData}`;
    });
    const c2 = document.createElement('canvas');
    c2.width = img2.width;
    c2.height = img2.height;
    const ctx2 = c2.getContext('2d')!;
    ctx2.drawImage(img2, 0, 0);
    let id2 = ctx2.getImageData(0, 0, img2.width, img2.height);
    id2 = outlineSprite(id2, outlineOutDepth, outlineInDepth, outlineColor[0], outlineColor[1], outlineColor[2]);
    ctx2.putImageData(id2, 0, 0);
    return { ...workingSprite, imageData: c2.toDataURL('image/png').split(',')[1], mimeType: 'image/png' };
  }

  return workingSprite;
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
  const { spriteType: currentSpriteType } = useAppState();
  const { state, dispatch, reExtract, setStep } = useGenericWorkflow(WORKFLOW_CONFIGS[currentSpriteType]);
  const { sprites } = state;
  const isCharacter = state.spriteType === 'character';

  // Derive current grid link from run state (if active)
  const currentGridLink: GridLink | null = state.run
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
  const hasAnimGroups = isCharacter || (effectiveCellGroups?.length ?? 0) > 0;


  // Custom hooks
  const chroma = useChromaKeySettings();
  const post = usePosterizeSettings();
  const selection = useSpriteSelection({ spriteCount: sprites.length, cellCount });

  const [processedSprites, setProcessedSprites] = useState<ExtractedSprite[]>(sprites);
  const [palette, setPalette] = useState<RGB[]>([]);
  const [struckColors, setStruckColors] = useState<RGB[]>([]);
  const [showRareColors, setShowRareColors] = useState(false);
  const [aaInset, setAaInset] = useState(3);
  const [addSheetOpen, setAddSheetOpen] = useState(false);
  const [pixelizeEnabled, setPixelizeEnabled] = useState(false);
  const [pixelizeSize, setPixelizeSize] = useState(32);
  const [outlineEnabled, setOutlineEnabled] = useState(false);
  const [outlineOutDepth, setOutlineOutDepth] = useState(1);
  const [outlineInDepth, setOutlineInDepth] = useState(0);
  const [outlineColor, setOutlineColor] = useState<RGB>([0, 0, 0]);
  const [alphaSnapEnabled, setAlphaSnapEnabled] = useState(false);
  const [alphaSnapThreshold, setAlphaSnapThreshold] = useState(128);
  const [eraserBrushW, setEraserBrushW] = useState(1);
  const [eraserBrushH, setEraserBrushH] = useState(1);
  const [strikeTolerance, setStrikeTolerance] = useState(10);
  const struckKey = JSON.stringify(struckColors);

  // Feedback state and regeneration hook
  const [feedbackState, setFeedbackState] = useState<FeedbackState>(createEmptyFeedback);
  const [feedbackPanelOpen, setFeedbackPanelOpen] = useState(false);
  const { regenerate, cancel: _cancelRegen, generating: regenerating } = useRegenerateWithFeedback();

  const { save: saveSettings, load: loadSettings } = useEditorSettings(state.historyId);

  const displaySprites = useMemo(
    () => selection.getDisplaySprites(processedSprites),
    [selection.getDisplaySprites, processedSprites],
  );

  const anim = useAnimationLoop({
    cellCount,
    hasAnimGroups,
    effectiveCellGroups,
    effectiveCellLabels: dynamicCellLabels,
    displaySprites,
    mirroredCells: selection.mirroredCells,
  });

  // Detect palette from sprites with posterization only (never chroma/strikes,
  // so striking a color doesn't reshuffle the palette).
  useEffect(() => {
    if (sprites.length === 0) return;
    let cancelled = false;

    const sourcePromise = post.posterizeOutput
      ? Promise.all(sprites.map(s => processSprite(s, true, post.posterizeBits, false, 0, [])))
      : Promise.resolve(sprites);

    sourcePromise.then(source => {
      if (cancelled) return;
      return detectPalette(source);
    }).then(p => {
      if (p && !cancelled) setPalette(p);
    });

    return () => { cancelled = true; };
  }, [sprites, post.posterizeOutput, post.posterizeBits]);

  // Process sprites through posterization + chroma key + color strikes + erasures + pixelize
  useEffect(() => {
    if (!post.posterizeOutput && !chroma.chromaEnabled && struckColors.length === 0 && selection.erasedPixels.size === 0 && !chroma.edgeRecolorPasses && !pixelizeEnabled && !outlineEnabled && !alphaSnapEnabled) {
      setProcessedSprites(sprites);
      return;
    }

    let cancelled = false;

    (async () => {
      // Auto-detect key color from the first sprite when chroma is enabled
      let keyR = 255, keyG = 0, keyB = 255;
      if (chroma.chromaEnabled && sprites.length > 0) {
        const first = sprites[0];
        const img = new Image();
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () => reject(new Error('Failed to load sprite for key detection'));
          img.src = `data:${first.mimeType};base64,${first.imageData}`;
        });
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, img.width, img.height);
        [keyR, keyG, keyB] = detectKeyColor(imageData);
        debugLog(`[ChromaKey] Auto-detected key color: rgb(${keyR}, ${keyG}, ${keyB})`);
      }

      const result = await Promise.all(sprites.map((s) =>
        processSprite(s, post.posterizeOutput, post.posterizeBits, chroma.chromaEnabled, chroma.chromaTolerance, struckColors, selection.erasedPixels.get(s.cellIndex), chroma.edgeRecolorPasses, chroma.recolorSensitivity, chroma.defringeCore, keyR, keyG, keyB, pixelizeEnabled, pixelizeSize, outlineEnabled, outlineOutDepth, outlineInDepth, outlineColor, alphaSnapEnabled, alphaSnapThreshold, strikeTolerance),
      ));
      if (!cancelled) setProcessedSprites(result);
    })();

    return () => { cancelled = true; };
  }, [sprites, post.posterizeOutput, post.posterizeBits, chroma.chromaEnabled, chroma.chromaTolerance, struckKey, selection.erasedKey, chroma.edgeRecolorPasses, chroma.recolorSensitivity, chroma.defringeCore, pixelizeEnabled, pixelizeSize, outlineEnabled, outlineOutDepth, outlineInDepth, outlineColor, alphaSnapEnabled, alphaSnapThreshold, strikeTolerance]);

  const [settingsLoaded, setSettingsLoaded] = useState(!state.historyId);
  // Guard: skip the first save effect after load completes to prevent
  // overwriting DB with default/stale values in the same render cycle.
  const skipNextSaveRef = useRef(false);

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
    selection.resetSelection();
    chroma.resetChromaKey();
    setStruckColors([]);
    setAaInset(3);
    post.resetPosterize();
    setFeedbackState(createEmptyFeedback());
    setFeedbackPanelOpen(false);

    Promise.all([
      loadSettings(),
      fetch(`/api/history/${state.historyId}`).then((r) => r.json()).catch((err) => { console.error('Failed to load history data:', err); return null; }),
    ]).then(([settings, histData]) => {
      if (cancelled) return;
      if (settings) {
        chroma.restoreChromaKey({
          chromaEnabled: settings.chromaEnabled,
          chromaTolerance: settings.chromaTolerance,
          edgeRecolorPasses: settings.edgeRecolorPasses || 0,
          recolorSensitivity: settings.recolorSensitivity ?? 50,
          defringeCore: settings.defringeCore ?? 240,
        });
        setStruckColors(settings.struckColors);
        selection.restoreSelection({
          mirroredCells: settings.mirroredCells,
          cellOrder: settings.cellOrder,
          erasedPixels: settings.erasedPixels,
        });
        setAaInset(settings.aaInset);
        post.restorePosterize({
          posterizeBits: settings.posterizeBits,
          posterizeOutput: settings.posterizeOutput,
        });
        setPixelizeEnabled(settings.pixelizeEnabled ?? false);
        setPixelizeSize(settings.pixelizeSize ?? 32);
        setOutlineEnabled(settings.outlineEnabled ?? false);
        setOutlineOutDepth(settings.outlineOutDepth ?? 1);
        setOutlineInDepth(settings.outlineInDepth ?? 0);
        setOutlineColor(settings.outlineColor ?? [0, 0, 0]);
        setAlphaSnapEnabled(settings.alphaSnapEnabled ?? false);
        setAlphaSnapThreshold(settings.alphaSnapThreshold ?? 128);
        setStrikeTolerance(settings.strikeTolerance ?? 10);
      }
      if (histData?.thumbnailCellIndex != null) {
        selection.setThumbnailCell(histData.thumbnailCellIndex);
      }
      // Skip the next save cycle so restored values don't trigger a write-back
      skipNextSaveRef.current = true;
      setSettingsLoaded(true);
    });

    return () => { cancelled = true; };
  }, [state.historyId, loadSettings]);

  // Save settings on change (debounced internally) — skip until initial load completes
  useEffect(() => {
    if (!settingsLoaded) return;
    // After load completes, the first save-effect invocation is the
    // restored values echoing back — skip it to avoid a pointless write.
    if (skipNextSaveRef.current) {
      skipNextSaveRef.current = false;
      return;
    }
    const serializedErased: Record<string, string[]> = {};
    for (const [idx, coords] of selection.erasedPixels) {
      if (coords.size > 0) serializedErased[String(idx)] = Array.from(coords);
    }
    saveSettings({
      chromaEnabled: chroma.chromaEnabled,
      chromaTolerance: chroma.chromaTolerance,
      struckColors,
      mirroredCells: Array.from(selection.mirroredCells),
      cellOrder: selection.displayOrder,
      aaInset,
      posterizeBits: post.posterizeBits,
      posterizeOutput: post.posterizeOutput,
      edgeRecolorPasses: chroma.edgeRecolorPasses,
      recolorSensitivity: chroma.recolorSensitivity,
      defringeCore: chroma.defringeCore,
      erasedPixels: serializedErased,
      pixelizeEnabled,
      pixelizeSize,
      outlineEnabled,
      outlineOutDepth,
      outlineInDepth,
      outlineColor,
      alphaSnapEnabled,
      alphaSnapThreshold,
      strikeTolerance,
    });
  }, [settingsLoaded, chroma.chromaEnabled, chroma.chromaTolerance, struckKey, selection.mirroredCells, selection.displayOrder, aaInset, post.posterizeBits, post.posterizeOutput, chroma.edgeRecolorPasses, chroma.recolorSensitivity, chroma.defringeCore, selection.erasedKey, pixelizeEnabled, pixelizeSize, outlineEnabled, outlineOutDepth, outlineInDepth, outlineColor, alphaSnapEnabled, alphaSnapThreshold, strikeTolerance, saveSettings]);

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
      if (selection.mirroredCells.has(sprite.cellIndex)) {
        results.push(await flipSpriteHorizontally(sprite));
      } else {
        results.push(sprite);
      }
    }
    return results;
  }, [displaySprites, selection.mirroredCells, flipSpriteHorizontally]);

  // Export sprite sheet
  const handleExportSheet = useCallback(async () => {
    if (displaySprites.length === 0) return;
    try {
      const exportSprites = await getExportSprites();
      const gridCols = dynamicCols;
      const { base64 } = await composeSpriteSheet(exportSprites, gridCols);
      const link = document.createElement('a');
      const exportName = WORKFLOW_CONFIGS[state.spriteType].getContent(state).name;
      link.href = `data:image/png;base64,${base64}`;
      link.download = `${exportName || 'sprites'}-sheet.png`;
      link.click();
      dispatch({ type: 'SET_STATUS', message: 'Sprite sheet exported!', statusType: 'success' });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      dispatch({ type: 'SET_STATUS', message: 'Export failed: ' + message, statusType: 'error' });
    }
  }, [displaySprites, getExportSprites, state, dynamicCols, dispatch]);

  // Export individual PNGs
  const handleExportIndividual = useCallback(async () => {
    if (displaySprites.length === 0) return;
    try {
      const exportSprites = await getExportSprites();
      const baseName = WORKFLOW_CONFIGS[state.spriteType].getContent(state).name;
      for (const sprite of exportSprites) {
        const link = document.createElement('a');
        link.href = `data:${sprite.mimeType};base64,${sprite.imageData}`;
        const safeName = sprite.label.toLowerCase().replace(/\s+/g, '-');
        link.download = `${baseName || 'sprite'}-${safeName}.png`;
        link.click();
      }
      dispatch({ type: 'SET_STATUS', message: `Exported ${exportSprites.length} individual sprites!`, statusType: 'success' });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      dispatch({ type: 'SET_STATUS', message: 'Export failed: ' + message, statusType: 'error' });
    }
  }, [displaySprites, getExportSprites, state, dispatch]);

  const handleThumbnailSet = useCallback(async (cellIndex: number) => {
    if (!state.historyId) return;
    selection.setThumbnailCell(cellIndex);

    // Find the processed sprite (chroma + color strikes applied)
    const sprite = displaySprites.find((s) => s.cellIndex === cellIndex);
    let imageData = sprite?.imageData ?? null;
    let mimeType = sprite?.mimeType ?? null;

    // Apply mirror if active
    if (sprite && selection.mirroredCells.has(cellIndex)) {
      const flipped = await flipSpriteHorizontally(sprite);
      imageData = flipped.imageData;
      mimeType = flipped.mimeType;
    }

    fetch(`/api/history/${state.historyId}/thumbnail`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cellIndex, imageData, mimeType }),
    }).catch((err) => {
      console.error('Failed to update thumbnail:', err);
      dispatch({ type: 'SET_STATUS', message: 'Failed to update thumbnail', statusType: 'warning' });
    });
  }, [state.historyId, displaySprites, selection.mirroredCells, flipSpriteHorizontally, selection.setThumbnailCell, dispatch]);

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

  // Feedback handlers
  const handleSignOffToggle = useCallback((cellIndex: number) => {
    setFeedbackState(prev => {
      const existing = prev.cells[cellIndex] || { signedOff: false, feedback: '' };
      return {
        ...prev,
        cells: { ...prev.cells, [cellIndex]: { ...existing, signedOff: !existing.signedOff } },
      };
    });
  }, []);

  const handleCellFeedbackClick = useCallback((_cellIndex: number) => {
    setFeedbackPanelOpen(true);
  }, []);

  const handleRegenerate = useCallback(async () => {
    const gridLink = currentGridLink ?? state.activeGridConfig;
    if (!gridLink) {
      dispatch({ type: 'SET_STATUS', message: 'No grid configuration available for regeneration', statusType: 'error' });
      return;
    }
    await regenerate({
      gridLink: gridLink as GridLink,
      imageSize: (state.imageSize as '2K' | '4K') || '2K',
      feedbackState,
    });
    setFeedbackState(createEmptyFeedback());
    setFeedbackPanelOpen(false);
  }, [regenerate, feedbackState, state, currentGridLink, dispatch]);

  return (
    <div className="review-layout">
      {/* Left: Sprite Grid */}
      <div className="review-main">
        {selection.swapSource !== null && (
          <div style={{ textAlign: 'center', padding: '6px 0', fontSize: '0.75rem', color: 'var(--accent)' }}>
            Click another cell to swap, or click the same cell to cancel
          </div>
        )}
        <SpriteGrid
          sprites={displaySprites}
          onCellClick={selection.handleCellClick}
          selectedCell={selection.swapSource}
          mirroredCells={selection.mirroredCells}
          onMirrorToggle={selection.handleMirrorToggle}
          thumbnailCell={selection.thumbnailCell}
          onThumbnailSet={state.historyId ? handleThumbnailSet : undefined}
          onZoomClick={selection.handleZoomClick}
          gridCols={dynamicCols}
          cellLabels={dynamicCellLabels}
          aspectRatio={dynamicAspectRatio}
          pixelizeEnabled={pixelizeEnabled}
          feedbackState={feedbackState}
          onSignOffToggle={handleSignOffToggle}
          onFeedbackClick={handleCellFeedbackClick}
        />
        {selection.isOrderModified && (
          <div style={{ textAlign: 'center', padding: '6px 0' }}>
            <button
              className="btn btn-sm"
              onClick={() => {
                selection.setDisplayOrder(Array.from({ length: sprites.length || cellCount }, (_, i) => i));
                selection.setSwapSource(null);
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
              {anim.animations.map((animDef, idx) => (
                <button
                  key={animDef.name}
                  className={`anim-group-btn ${idx === anim.selectedAnim ? 'active' : ''}`}
                  onClick={() => anim.setSelectedAnim(idx)}
                >
                  {animDef.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Cell Cycling Preview */}
        <div className="sidebar-section">
          <h3>Preview</h3>
          <canvas ref={anim.canvasRef} className="anim-preview-canvas" />
        </div>

        {/* Speed Slider */}
        <div className="sidebar-section">
          <h3>Speed (ms/frame)</h3>
          <div className="slider-row">
            <input
              type="range"
              min={50}
              max={500}
              value={anim.speed}
              onChange={(e) => anim.setSpeed(Number(e.target.value))}
            />
            <span className="slider-value">{anim.speed}</span>
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
              value={anim.scale}
              onChange={(e) => anim.setScale(Number(e.target.value))}
            />
            <span className="slider-value">{anim.scale}x</span>
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
              <span className="slider-value">{post.posterizeBits === 8 ? 'off' : `${post.posterizeBits}-bit`}</span>
            </div>
            <input
              type="range"
              min={1}
              max={8}
              value={post.posterizeBits}
              onChange={(e) => {
                const bits = Number(e.target.value);
                post.setPosterizeBits(bits);
                if (bits === 8) post.setPosterizeOutput(false);
              }}
              style={{ width: '100%' }}
            />
          </div>
          {post.posterizeBits < 8 && (
            <div className="anim-group-grid" style={{ gridTemplateColumns: '1fr 1fr', marginTop: 4 }}>
              <button
                type="button"
                className={`anim-group-btn ${!post.posterizeOutput ? 'active' : ''}`}
                onClick={() => post.setPosterizeOutput(false)}
              >
                Original
              </button>
              <button
                type="button"
                className={`anim-group-btn ${post.posterizeOutput ? 'active' : ''}`}
                onClick={() => post.setPosterizeOutput(true)}
              >
                Posterized
              </button>
            </div>
          )}
        </div>

        {/* Pixelize */}
        <div className="sidebar-section">
          <h3>
            Pixelize
            <span title="Downscale sprites to a retro pixel art resolution using nearest-neighbor interpolation." style={{ cursor: 'help', marginLeft: 4, fontSize: '0.7rem', color: 'var(--text-muted)' }}>&#9432;</span>
          </h3>
          <div className="anim-group-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <button
              className={`anim-group-btn ${!pixelizeEnabled ? 'active' : ''}`}
              onClick={() => setPixelizeEnabled(false)}
            >
              Off
            </button>
            <button
              className={`anim-group-btn ${pixelizeEnabled ? 'active' : ''}`}
              onClick={() => setPixelizeEnabled(true)}
            >
              On
            </button>
          </div>
          {pixelizeEnabled && (
            <div className="pixelize-size-row" style={{ display: 'flex', gap: 4, marginTop: 6 }}>
              {([16, 32, 48, 64, 128] as const).map(size => (
                <button
                  key={size}
                  className={`pixel-size-btn ${pixelizeSize === size ? 'active' : ''}`}
                  onClick={() => setPixelizeSize(size)}
                >
                  {size}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Outline */}
        <div className="sidebar-section">
          <h3>
            Outline
            <span title="Paint a pixel outline around sprites. Outward adds pixels into the transparent area; Inward recolors the outermost opaque ring." style={{ cursor: 'help', marginLeft: 4, fontSize: '0.7rem', color: 'var(--text-muted)' }}>&#9432;</span>
          </h3>
          <div className="anim-group-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <button className={`anim-group-btn ${!outlineEnabled ? 'active' : ''}`} onClick={() => setOutlineEnabled(false)}>Off</button>
            <button className={`anim-group-btn ${outlineEnabled ? 'active' : ''}`} onClick={() => setOutlineEnabled(true)}>On</button>
          </div>
          {outlineEnabled && (
            <>
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Out</label>
                    <span className="slider-value">{outlineOutDepth}</span>
                  </div>
                  <input type="range" min={0} max={8} value={outlineOutDepth} onChange={(e) => setOutlineOutDepth(Number(e.target.value))} style={{ width: '100%' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>In</label>
                    <span className="slider-value">{outlineInDepth}</span>
                  </div>
                  <input type="range" min={0} max={8} value={outlineInDepth} onChange={(e) => setOutlineInDepth(Number(e.target.value))} style={{ width: '100%' }} />
                </div>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8 }}>
                {([[0,0,0],[255,255,255]] as RGB[]).map(([cr, cg, cb], idx) => {
                  const isSelected = outlineColor[0] === cr && outlineColor[1] === cg && outlineColor[2] === cb;
                  return (
                    <button key={idx} onClick={() => setOutlineColor([cr, cg, cb])}
                      title={idx === 0 ? 'Black' : 'White'}
                      style={{ width: 24, height: 24, backgroundColor: `rgb(${cr},${cg},${cb})`, border: isSelected ? '2px solid var(--accent)' : '2px solid var(--border)', borderRadius: 4, cursor: 'pointer' }}
                    />
                  );
                })}
                {palette.slice(0, 10).map(([cr, cg, cb], i) => {
                  const isSelected = outlineColor[0] === cr && outlineColor[1] === cg && outlineColor[2] === cb;
                  return (
                    <button key={i + 2} onClick={() => setOutlineColor([cr, cg, cb])}
                      title={`rgb(${cr}, ${cg}, ${cb})`}
                      style={{ width: 24, height: 24, backgroundColor: `rgb(${cr},${cg},${cb})`, border: isSelected ? '2px solid var(--accent)' : '2px solid var(--border)', borderRadius: 4, cursor: 'pointer' }}
                    />
                  );
                })}
              </div>
            </>
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
              className={`anim-group-btn ${!chroma.chromaEnabled ? 'active' : ''}`}
              onClick={() => chroma.setChromaEnabled(false)}
            >
              Off
            </button>
            <button
              className={`anim-group-btn ${chroma.chromaEnabled ? 'active' : ''}`}
              onClick={() => chroma.setChromaEnabled(true)}
            >
              On
            </button>
          </div>
          {chroma.chromaEnabled && (
            <>
              <div style={{ marginTop: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                    Tolerance
                    <span title="How aggressively the background is removed. Lower values preserve more sprite color but may leave background remnants." style={{ cursor: 'help', marginLeft: 4 }}>&#9432;</span>
                  </label>
                  <span className="slider-value">{chroma.chromaTolerance}</span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={150}
                  value={chroma.chromaTolerance}
                  onChange={(e) => chroma.setChromaTolerance(Number(e.target.value))}
                  style={{ width: '100%' }}
                />
              </div>
              <div style={{ marginTop: 4 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                    Defringe
                    <span title="Fades the alpha of border pixels near the key color. Higher values remove more fringe. Independent of tolerance so edges stay clean even at low tolerance." style={{ cursor: 'help', marginLeft: 4 }}>&#9432;</span>
                  </label>
                  <span className="slider-value">{chroma.defringeCore}</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={1000}
                  value={chroma.defringeCore}
                  onChange={(e) => chroma.setDefringeCore(Number(e.target.value))}
                  style={{ width: '100%' }}
                />
              </div>
              <div style={{ marginTop: 4 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                    Edge Recolor
                    <span title="Replaces pink-tinted RGB on edge pixels with nearby sprite colors. Keeps alpha intact for smooth edges. Higher = more passes inward." style={{ cursor: 'help', marginLeft: 4 }}>&#9432;</span>
                  </label>
                  <span className="slider-value">{chroma.edgeRecolorPasses === 0 ? 'off' : chroma.edgeRecolorPasses}</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={15}
                  value={chroma.edgeRecolorPasses}
                  onChange={(e) => chroma.setEdgeRecolorPasses(Number(e.target.value))}
                  style={{ width: '100%' }}
                />
              </div>
              {chroma.edgeRecolorPasses > 0 && (
                <div style={{ marginTop: 4 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                      Recolor Sensitivity
                      <span title="How liberally pixels are classified as pink. Low = only obvious magenta. High = catches subtle pink tints." style={{ cursor: 'help', marginLeft: 4 }}>&#9432;</span>
                    </label>
                    <span className="slider-value">{chroma.recolorSensitivity}</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={chroma.recolorSensitivity}
                    onChange={(e) => chroma.setRecolorSensitivity(Number(e.target.value))}
                    style={{ width: '100%' }}
                  />
                </div>
              )}
              <div style={{ marginTop: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                    Hard Edges
                    <span title="Snap partial-alpha fringe pixels to fully opaque or fully transparent. Eliminates semi-transparent edge artifacts from chroma key. Threshold controls the cutoff: pixels above become opaque, below become transparent." style={{ cursor: 'help', marginLeft: 4 }}>&#9432;</span>
                  </label>
                  <span className="slider-value">{alphaSnapEnabled ? alphaSnapThreshold : 'off'}</span>
                </div>
                <div className="anim-group-grid" style={{ gridTemplateColumns: '1fr 1fr', marginBottom: alphaSnapEnabled ? 4 : 0 }}>
                  <button
                    className={`anim-group-btn ${!alphaSnapEnabled ? 'active' : ''}`}
                    onClick={() => setAlphaSnapEnabled(false)}
                  >
                    Off
                  </button>
                  <button
                    className={`anim-group-btn ${alphaSnapEnabled ? 'active' : ''}`}
                    onClick={() => setAlphaSnapEnabled(true)}
                  >
                    On
                  </button>
                </div>
                {alphaSnapEnabled && (
                  <input
                    type="range"
                    min={1}
                    max={254}
                    value={alphaSnapThreshold}
                    onChange={(e) => setAlphaSnapThreshold(Number(e.target.value))}
                    style={{ width: '100%' }}
                  />
                )}
              </div>
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
            <div style={{ marginTop: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Tolerance</label>
                <span className="slider-value">{strikeTolerance}</span>
              </div>
              <input
                type="range"
                min={0}
                max={50}
                value={strikeTolerance}
                onChange={(e) => setStrikeTolerance(Number(e.target.value))}
                style={{ width: '100%' }}
              />
            </div>
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
            onClick={() => reExtract({ aaInset, posterizeBits: post.posterizeBits })}
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
            <button className="btn btn-primary w-full" onClick={() => setAddSheetOpen(true)}>
              Add Sheet
            </button>
            <button className="btn btn-primary w-full" onClick={() => setFeedbackPanelOpen(true)}>
              Feedback &amp; Regenerate
            </button>
            {hasFeedback(feedbackState) && (
              <button className="btn btn-accent w-full" onClick={handleRegenerate} disabled={regenerating}>
                {regenerating ? 'Regenerating...' : 'Regenerate with Feedback'}
              </button>
            )}
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
        <AddSheetModal
          open={addSheetOpen}
          onClose={() => setAddSheetOpen(false)}
          currentSprites={displaySprites}
        />
      </aside>

      <FeedbackPanel
        open={feedbackPanelOpen}
        onClose={() => setFeedbackPanelOpen(false)}
        feedbackState={feedbackState}
        onFeedbackChange={setFeedbackState}
        cellLabels={dynamicCellLabels ?? []}
        cellGroups={effectiveCellGroups ?? []}
        onRegenerate={handleRegenerate}
        regenerating={regenerating}
      />

      {selection.zoomSpriteIndex !== null && (() => {
        const zoomSprite = displaySprites.find((s) => s.cellIndex === selection.zoomSpriteIndex);
        if (!zoomSprite) return null;
        return (
          <SpriteZoomModal
            sprite={zoomSprite}
            struckColors={struckColors}
            onStrikeColor={handleZoomStrikeColor}
            onUnstrikeColor={handleZoomUnstrikeColor}
            onErasePixel={selection.handleErasePixel}
            onClose={() => selection.setZoomSpriteIndex(null)}
            brushW={eraserBrushW}
            brushH={eraserBrushH}
            onBrushWChange={setEraserBrushW}
            onBrushHChange={setEraserBrushH}
            onUndoErase={selection.undoErase}
            canUndoErase={selection.canUndoErase}
          />
        );
      })()}
    </div>
  );
}
