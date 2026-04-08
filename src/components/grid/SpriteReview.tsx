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
import { composeSpriteSheet, ExtractedSprite } from '../../lib/spriteExtractor';
import { debugLog } from '../../lib/debugLog';
import { processSprite, detectPalette, detectChromaKeyColor } from '../../lib/spriteProcessor';
import type { ProcessSpriteOptions } from '../../lib/spriteProcessor';
import { AddSheetModal } from './AddSheetModal';
import { FeedbackPanel } from './FeedbackPanel';
import { PostProcessingSidebar } from './PostProcessingSidebar';
import { SidebarGroup } from './SidebarGroup';
import type { FeedbackState } from '../../types/feedback';
import { createEmptyFeedback, hasFeedback } from '../../types/feedback';
import { useRegenerateWithFeedback } from '../../hooks/useRegenerateWithFeedback';
import { loadGenerationIntoState } from '../../lib/loadGeneration';
import type { RGB } from '../../types/color';

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

  // Use cellGroups from props, or from activeGridConfig, or from current grid link
  const [fetchedGridLink, setFetchedGridLink] = useState<GridLink | null>(null);
  const localCellGroups = cellGroups ?? agc?.cellGroups ?? currentGridLink?.cellGroups;

  // Fetch grid link if not available locally (e.g. session restore)
  useEffect(() => {
    if (currentGridLink) {
      setFetchedGridLink(null);
      return;
    }
    const presetId = state.sourceContentPresetId;
    const spriteType = state.spriteType;
    const gridSize = agc ? `${agc.cols}x${agc.rows}` : null;
    if (!presetId || !gridSize) return;

    let cancelled = false;
    fetch(`/api/presets/${spriteType}/${presetId}/grid-links`)
      .then(r => r.ok ? r.json() : [])
      .then((links: GridLink[]) => {
        if (cancelled) return;
        const match = links.find(l => `${l.cols}x${l.rows}` === gridSize);
        if (match) setFetchedGridLink(match);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [currentGridLink, state.sourceContentPresetId, state.spriteType, agc]);

  const resolvedGridLink = currentGridLink ?? fetchedGridLink;
  const effectiveCellGroups = localCellGroups ?? resolvedGridLink?.cellGroups ?? undefined;
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
  const [regenSettings, setRegenSettings] = useState({
    model: state.model,
    imageSize: state.imageSize as '2K' | '4K',
    thinkingLevel: state.thinkingLevel,
  });

  // Version chain state
  const [versionInfo, setVersionInfo] = useState<{ version: number; parentId: number | null; childIds: number[] } | null>(null);

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
      ? Promise.all(sprites.map(s => processSprite(s, {
          posterize: { enabled: true, bits: post.posterizeBits },
          chroma: { enabled: false, tolerance: 0, defringeCore: 0, edgeRecolorPasses: 0, recolorSensitivity: 0 },
          pixelize: { enabled: false, size: 32 },
          outline: { enabled: false, outDepth: 0, inDepth: 0, color: [0, 0, 0] },
          alphaSnap: { enabled: false, threshold: 128 },
          colorStrike: { colors: [], tolerance: 0 },
        })))
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
      let chromaKeyColor: RGB | undefined;
      if (chroma.chromaEnabled && sprites.length > 0) {
        chromaKeyColor = await detectChromaKeyColor(sprites);
        debugLog(`[ChromaKey] Auto-detected key color: rgb(${chromaKeyColor.join(', ')})`);
      }

      const opts: ProcessSpriteOptions = {
        posterize: { enabled: post.posterizeOutput, bits: post.posterizeBits },
        chroma: {
          enabled: chroma.chromaEnabled,
          tolerance: chroma.chromaTolerance,
          defringeCore: chroma.defringeCore,
          edgeRecolorPasses: chroma.edgeRecolorPasses,
          recolorSensitivity: chroma.recolorSensitivity,
        },
        pixelize: { enabled: pixelizeEnabled, size: pixelizeSize },
        outline: { enabled: outlineEnabled, outDepth: outlineOutDepth, inDepth: outlineInDepth, color: outlineColor },
        alphaSnap: { enabled: alphaSnapEnabled, threshold: alphaSnapThreshold },
        colorStrike: { colors: struckColors, tolerance: strikeTolerance },
        chromaKeyColor,
      };

      const result = await Promise.all(sprites.map((s) =>
        processSprite(s, { ...opts, erasedPixels: selection.erasedPixels.get(s.cellIndex) }),
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
    setRegenSettings({ model: state.model, imageSize: state.imageSize as '2K' | '4K', thinkingLevel: state.thinkingLevel });

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
      // Restore saved feedback if present
      if (histData?.feedbackJson) {
        try {
          const saved = JSON.parse(histData.feedbackJson);
          if (saved && typeof saved === 'object') {
            setFeedbackState({
              global: saved.global || '',
              groups: saved.groups || {},
              cells: saved.cells || {},
            });
          }
        } catch { /* ignore malformed JSON */ }
      }
      // Load version chain info
      const ver = histData?.generationVersion || 1;
      const parentId = histData?.parentHistoryId || null;
      // Fetch child generations (versions derived from this one)
      fetch(`/api/history/${state.historyId}/children`)
        .then(r => r.ok ? r.json() : [])
        .then((children: Array<{ id: number }>) => {
          if (!cancelled) {
            setVersionInfo({ version: ver, parentId, childIds: children.map(c => c.id) });
          }
        })
        .catch(() => {
          if (!cancelled) setVersionInfo({ version: ver, parentId, childIds: [] });
        });
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

  const [focusCellIndex, setFocusCellIndex] = useState<number | null>(null);

  const handleCellFeedbackClick = useCallback((cellIndex: number) => {
    setFocusCellIndex(cellIndex);
    setFeedbackPanelOpen(true);
  }, []);

  const navigateToVersion = useCallback(async (targetId: number) => {
    try {
      const res = await fetch(`/api/history/${targetId}`);
      if (!res.ok) throw new Error('Not found');
      const data = await res.json();
      await loadGenerationIntoState(data, dispatch, { historyId: targetId });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load version';
      dispatch({ type: 'SET_STATUS', message, statusType: 'error' });
    }
  }, [dispatch]);

  const handleRegenerate = useCallback(async () => {
    if (!resolvedGridLink) {
      dispatch({ type: 'SET_STATUS', message: 'No grid configuration available for regeneration. Try reloading.', statusType: 'error' });
      return;
    }
    // Apply settings overrides before regenerating
    dispatch({ type: 'SET_MODEL', model: regenSettings.model });
    dispatch({ type: 'SET_IMAGE_SIZE', imageSize: regenSettings.imageSize });
    dispatch({ type: 'SET_THINKING_LEVEL', thinkingLevel: regenSettings.thinkingLevel });
    // Allow dispatches to propagate to stateRef in the hook
    await new Promise(r => setTimeout(r, 0));
    await regenerate({
      gridLink: resolvedGridLink,
      imageSize: regenSettings.imageSize,
      feedbackState,
    });
    setFeedbackState(createEmptyFeedback());
    setFeedbackPanelOpen(false);
  }, [regenerate, feedbackState, regenSettings, resolvedGridLink, dispatch]);

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
        {/* ── Version Bar ── */}
        {versionInfo && (versionInfo.parentId || versionInfo.childIds.length > 0 || versionInfo.version > 1) && (
          <div className="version-bar">
            <span className="version-label">v{versionInfo.version}</span>
            <div className="version-nav">
              {versionInfo.parentId && (
                <button
                  className="version-nav-btn"
                  onClick={() => navigateToVersion(versionInfo.parentId!)}
                  title="Load previous version"
                >
                  &larr; prev
                </button>
              )}
              {versionInfo.childIds.map((childId) => (
                <button
                  key={childId}
                  className="version-nav-btn"
                  onClick={() => navigateToVersion(childId)}
                  title="Load regenerated version"
                >
                  next &rarr;
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Preview & Playback ── */}
        <SidebarGroup label="Preview & Playback" defaultOpen={true}>
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

          <div className="sidebar-section">
            <canvas ref={anim.canvasRef} className="anim-preview-canvas" />
          </div>

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
        </SidebarGroup>

        {/* ── Post-Processing ── */}
        <PostProcessingSidebar
          chroma={chroma}
          posterize={post}
          palette={palette}
          reExtract={reExtract}
          pixelizeEnabled={pixelizeEnabled}
          setPixelizeEnabled={setPixelizeEnabled}
          pixelizeSize={pixelizeSize}
          setPixelizeSize={setPixelizeSize}
          outlineEnabled={outlineEnabled}
          setOutlineEnabled={setOutlineEnabled}
          outlineOutDepth={outlineOutDepth}
          setOutlineOutDepth={setOutlineOutDepth}
          outlineInDepth={outlineInDepth}
          setOutlineInDepth={setOutlineInDepth}
          outlineColor={outlineColor}
          setOutlineColor={setOutlineColor}
          alphaSnapEnabled={alphaSnapEnabled}
          setAlphaSnapEnabled={setAlphaSnapEnabled}
          alphaSnapThreshold={alphaSnapThreshold}
          setAlphaSnapThreshold={setAlphaSnapThreshold}
          struckColors={struckColors}
          setStruckColors={setStruckColors}
          showRareColors={showRareColors}
          setShowRareColors={setShowRareColors}
          strikeTolerance={strikeTolerance}
          setStrikeTolerance={setStrikeTolerance}
          aaInset={aaInset}
          setAaInset={setAaInset}
        />

        {/* ── Actions ── */}
        <SidebarGroup label="Actions" defaultOpen={true}>
        <div className="sidebar-section">
          <div className="export-bar">
            <button className="btn btn-primary w-full" onClick={handleExportSheet}>
              Export Sprite Sheet
            </button>
            <button className="btn w-full" onClick={handleExportIndividual}>
              Export Individual PNGs
            </button>
          </div>
        </div>

        <div className="sidebar-section">
          <div className="export-bar">
            <button className="btn w-full" onClick={() => setAddSheetOpen(true)}>
              Add Sheet
            </button>
            <button className="btn w-full" onClick={() => setFeedbackPanelOpen(true)}>
              Feedback &amp; Regenerate
            </button>
          </div>
        </div>

        <div className="sidebar-section">
          <button
            className="btn w-full"
            style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}
            onClick={() => setStep('configure')}
          >
            &larr; Back to Configure
          </button>
        </div>
        </SidebarGroup>

        <AddSheetModal
          open={addSheetOpen}
          onClose={() => setAddSheetOpen(false)}
          currentSprites={displaySprites}
        />
      </aside>

      <FeedbackPanel
        open={feedbackPanelOpen}
        onClose={() => { setFeedbackPanelOpen(false); setFocusCellIndex(null); }}
        feedbackState={feedbackState}
        onFeedbackChange={setFeedbackState}
        cellLabels={dynamicCellLabels ?? []}
        cellGroups={effectiveCellGroups ?? []}
        onRegenerate={handleRegenerate}
        regenerating={regenerating}
        focusCellIndex={focusCellIndex}
        regenSettings={regenSettings}
        onRegenSettingsChange={setRegenSettings}
      />

      {hasFeedback(feedbackState) && typeof window !== 'undefined' && window.innerWidth < 768 && (
        <div className="regen-sticky-bar">
          <button className="btn btn-primary w-full" onClick={handleRegenerate} disabled={regenerating}>
            {regenerating ? 'Regenerating...' : 'Regenerate with Feedback'}
          </button>
        </div>
      )}

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
