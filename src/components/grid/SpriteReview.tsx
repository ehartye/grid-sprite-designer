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
import { assemblePrompt, assembleEditPrompt, fetchContentPreset } from '../../lib/promptForType';
import { processSprite, detectPalette, detectChromaKeyColor } from '../../lib/spriteProcessor';
import type { ProcessSpriteOptions } from '../../lib/spriteProcessor';
import { AddSheetModal } from './AddSheetModal';
import { FeedbackPanel } from './FeedbackPanel';
import { PostProcessingSidebar } from './PostProcessingSidebar';
import { ReviewActions } from './ReviewActions';
import { SidebarGroup } from './SidebarGroup';
import { PromptDebugPanel } from './PromptDebugPanel';
import type { StructuredPrompt } from '../../types/prompt';
import type { FeedbackState } from '../../types/feedback';
import { createEmptyFeedback, hasFeedback } from '../../types/feedback';
import { useRegenerateWithFeedback } from '../../hooks/useRegenerateWithFeedback';
import { usePostProcessingState } from '../../hooks/usePostProcessingState';
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
  const { state: postState, dispatch: postDispatch } = usePostProcessingState();
  const [addSheetOpen, setAddSheetOpen] = useState(false);
  const struckKey = JSON.stringify(postState.struckColors);

  // Feedback state and regeneration hook
  const [feedbackState, setFeedbackState] = useState<FeedbackState>(createEmptyFeedback);
  const [feedbackPanelOpen, setFeedbackPanelOpen] = useState(false);
  const { regenerate, cancel: _cancelRegen, generating: regenerating } = useRegenerateWithFeedback();
  const [regenSettings, setRegenSettings] = useState({
    model: state.model,
    imageSize: state.imageSize as '2K' | '4K',
    thinkingLevel: state.thinkingLevel,
  });

  // Prompt debug panel state
  const [lastPrompt, setLastPrompt] = useState<StructuredPrompt | null>(null);
  const [promptDebugOpen, setPromptDebugOpen] = useState(false);

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
    if (!post.posterizeOutput && !chroma.chromaEnabled && postState.struckColors.length === 0 && selection.erasedPixels.size === 0 && !chroma.edgeRecolorPasses && !postState.pixelize.enabled && !postState.outline.enabled && !postState.alphaSnap.enabled) {
      setProcessedSprites(sprites);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
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
          pixelize: postState.pixelize,
          outline: postState.outline,
          alphaSnap: postState.alphaSnap,
          colorStrike: { colors: postState.struckColors, tolerance: postState.strikeTolerance },
          chromaKeyColor,
        };

        const result = await Promise.all(sprites.map((s) =>
          processSprite(s, { ...opts, erasedPixels: selection.erasedPixels.get(s.cellIndex) }),
        ));
        if (!cancelled) setProcessedSprites(result);
      } catch (err) {
        console.error('[ProcessEffect] Error in processing pipeline:', err);
      }
    })();

    return () => { cancelled = true; };
  }, [sprites, post.posterizeOutput, post.posterizeBits, chroma.chromaEnabled, chroma.chromaTolerance, struckKey, selection.erasedKey, chroma.edgeRecolorPasses, chroma.recolorSensitivity, chroma.defringeCore, postState.pixelize.enabled, postState.pixelize.size, postState.outline.enabled, postState.outline.outDepth, postState.outline.inDepth, postState.outline.color, postState.alphaSnap.enabled, postState.alphaSnap.threshold, postState.strikeTolerance]);

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
    // Immediately block the save effect so it can't write stale data from the
    // previous generation to this historyId.  setSettingsLoaded(false) is a
    // state update that won't take effect until the next render — but the save
    // effect runs in THIS render cycle, so the ref is the only synchronous gate.
    skipNextSaveRef.current = true;
    setSettingsLoaded(false);
    let cancelled = false;

    // Reset to defaults immediately
    selection.resetSelection();
    chroma.resetChromaKey();
    postDispatch({ type: 'RESET' });
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
        selection.restoreSelection({
          mirroredCells: settings.mirroredCells,
          cellOrder: settings.cellOrder,
          erasedPixels: settings.erasedPixels,
        });
        post.restorePosterize({
          posterizeBits: settings.posterizeBits,
          posterizeOutput: settings.posterizeOutput,
        });
        postDispatch({
          type: 'RESTORE',
          settings: {
            pixelizeEnabled: settings.pixelizeEnabled ?? false,
            pixelizeSize: settings.pixelizeSize ?? 32,
            outlineEnabled: settings.outlineEnabled ?? false,
            outlineOutDepth: settings.outlineOutDepth ?? 1,
            outlineInDepth: settings.outlineInDepth ?? 0,
            outlineColor: settings.outlineColor ?? [0, 0, 0],
            alphaSnapEnabled: settings.alphaSnapEnabled ?? false,
            alphaSnapThreshold: settings.alphaSnapThreshold ?? 128,
            strikeTolerance: settings.strikeTolerance ?? 10,
            struckColors: settings.struckColors,
            aaInset: settings.aaInset,
          },
        });
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
      struckColors: postState.struckColors,
      mirroredCells: Array.from(selection.mirroredCells),
      cellOrder: selection.displayOrder,
      aaInset: postState.aaInset,
      posterizeBits: post.posterizeBits,
      posterizeOutput: post.posterizeOutput,
      edgeRecolorPasses: chroma.edgeRecolorPasses,
      recolorSensitivity: chroma.recolorSensitivity,
      defringeCore: chroma.defringeCore,
      erasedPixels: serializedErased,
      pixelizeEnabled: postState.pixelize.enabled,
      pixelizeSize: postState.pixelize.size,
      outlineEnabled: postState.outline.enabled,
      outlineOutDepth: postState.outline.outDepth,
      outlineInDepth: postState.outline.inDepth,
      outlineColor: postState.outline.color,
      alphaSnapEnabled: postState.alphaSnap.enabled,
      alphaSnapThreshold: postState.alphaSnap.threshold,
      strikeTolerance: postState.strikeTolerance,
    });
  }, [settingsLoaded, chroma.chromaEnabled, chroma.chromaTolerance, struckKey, selection.mirroredCells, selection.displayOrder, post.posterizeBits, post.posterizeOutput, chroma.edgeRecolorPasses, chroma.recolorSensitivity, chroma.defringeCore, selection.erasedKey, postState.struckColors, postState.aaInset, postState.pixelize.enabled, postState.pixelize.size, postState.outline.enabled, postState.outline.outDepth, postState.outline.inDepth, postState.outline.color, postState.alphaSnap.enabled, postState.alphaSnap.threshold, postState.strikeTolerance, saveSettings]);

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
    postDispatch({ type: 'STRIKE_COLOR', color });
  }, [postDispatch]);

  const handleZoomUnstrikeColor = useCallback((color: RGB) => {
    postDispatch({ type: 'UNSTRIKE_COLOR', color });
  }, [postDispatch]);

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

  const handleViewPrompt = useCallback(async () => {
    if (!resolvedGridLink) return;
    try {
      const presetId = state.sourceContentPresetId;
      if (!presetId) {
        // Build edit prompt with current feedback if no preset
        const prompt = assembleEditPrompt({
          feedbackState,
          cellLabels: resolvedGridLink.cellLabels,
          cellGroups: resolvedGridLink.cellGroups || [],
          cols: resolvedGridLink.cols,
          sourceImage: { data: '', mimeType: 'image/png' },
        });
        setLastPrompt(prompt);
      } else {
        const preset = await fetchContentPreset(state.spriteType, presetId);
        const prompt = assemblePrompt({
          spriteType: state.spriteType,
          contentPreset: preset,
          gridLink: resolvedGridLink,
          isSubsequentGrid: false,
          feedbackState: hasFeedback(feedbackState) ? feedbackState : undefined,
        });
        setLastPrompt(prompt);
      }
      setPromptDebugOpen(true);
    } catch (err) {
      debugLog('[PromptDebug] Failed to build prompt:', err);
    }
  }, [resolvedGridLink, state.sourceContentPresetId, state.spriteType, feedbackState]);

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
          pixelizeEnabled={postState.pixelize.enabled}
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
        <ReviewActions
          versionInfo={versionInfo}
          onNavigateVersion={navigateToVersion}
          onExportSheet={handleExportSheet}
          onExportIndividual={handleExportIndividual}
          onAddSheet={() => setAddSheetOpen(true)}
          onFeedbackOpen={() => setFeedbackPanelOpen(true)}
          onBack={() => setStep('configure')}
        />

        <SidebarGroup label="Debug" defaultOpen={false}>
          <button className="btn btn-sm w-full" onClick={handleViewPrompt} disabled={!resolvedGridLink}>
            View Prompt
          </button>
        </SidebarGroup>

        {/* ── Post-Processing ── */}
        <PostProcessingSidebar
          postState={postState}
          postDispatch={postDispatch}
          chroma={chroma}
          posterize={post}
          palette={palette}
          reExtract={reExtract}
        />

        {/* ── Preview & Playback ── */}
        <SidebarGroup label="Preview & Playback" defaultOpen={false}>
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

        <AddSheetModal
          open={addSheetOpen}
          onClose={() => setAddSheetOpen(false)}
          currentSprites={displaySprites}
        />
      </aside>

      <PromptDebugPanel
        prompt={lastPrompt}
        open={promptDebugOpen}
        onClose={() => setPromptDebugOpen(false)}
      />

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

      {hasFeedback(feedbackState) && (
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
            struckColors={postState.struckColors}
            onStrikeColor={handleZoomStrikeColor}
            onUnstrikeColor={handleZoomUnstrikeColor}
            onErasePixel={selection.handleErasePixel}
            onClose={() => selection.setZoomSpriteIndex(null)}
            brushW={postState.eraserBrushW}
            brushH={postState.eraserBrushH}
            onBrushWChange={(w: number) => postDispatch({ type: 'SET_ERASER_BRUSH', w })}
            onBrushHChange={(h: number) => postDispatch({ type: 'SET_ERASER_BRUSH', h })}
            onUndoErase={selection.undoErase}
            canUndoErase={selection.canUndoErase}
          />
        );
      })()}
    </div>
  );
}
