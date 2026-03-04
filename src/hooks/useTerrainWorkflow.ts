/**
 * Workflow hook for terrain sprite generation.
 * Mirrors useBuildingWorkflow but parameterized for terrain tile grids.
 */

import { useCallback, useRef } from 'react';
import { useAppContext, type GridLink } from '../context/AppContext';
import { generateTemplate } from '../lib/templateGenerator';
import { extractSprites } from '../lib/spriteExtractor';
import { buildTerrainPrompt } from '../lib/terrainPromptBuilder';
import { generateGrid } from '../api/geminiClient';
import { getTerrainGridConfig, gridPresetToConfig } from '../lib/gridConfig';

export function useTerrainWorkflow() {
  const { state, dispatch } = useAppContext();
  const abortRef = useRef<AbortController | null>(null);
  const isGeneratingRef = useRef(false);

  const cancelGeneration = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    isGeneratingRef.current = false;
    dispatch({ type: 'RESET' });
  }, [dispatch]);

  const generate = useCallback(async (gridLink?: GridLink) => {
    if (!state.terrain.name.trim() || !state.terrain.description.trim()) {
      dispatch({ type: 'SET_STATUS', message: 'Please enter a terrain name and description.', statusType: 'warning' });
      return;
    }

    if (isGeneratingRef.current) return;
    isGeneratingRef.current = true;

    const abort = new AbortController();
    abortRef.current = abort;

    try {
      // 1. Build grid config — use dynamic grid preset when gridLink is provided
      const gridConfig = gridLink
        ? gridPresetToConfig(gridLink, 'terrain')
        : getTerrainGridConfig(state.terrain.gridSize, state.terrain.cellLabels);
      const templateParams = gridConfig.templates[state.imageSize as '2K' | '4K'];

      // 2. Generate template grid
      const template = generateTemplate(templateParams, gridConfig);
      dispatch({ type: 'GENERATE_START', templateImage: template.base64 });

      // 3. Build prompt with layered guidance
      const prompt = buildTerrainPrompt(
        state.terrain,
        gridConfig,
        gridLink?.genericGuidance,
        gridLink?.guidanceOverride,
      );

      // 4. Call Gemini API
      const result = await generateGrid(
        state.model,
        prompt,
        { data: template.base64, mimeType: 'image/png' },
        state.imageSize,
        abort.signal,
      );

      if (abort.signal.aborted) return;

      if (!result.image) {
        dispatch({ type: 'GENERATE_ERROR', error: 'Gemini returned no image. Try again.' });
        return;
      }

      if (abort.signal.aborted) return;

      dispatch({
        type: 'GENERATE_COMPLETE',
        filledGridImage: result.image.data,
        filledGridMimeType: result.image.mimeType,
        geminiText: result.text || '',
      });

      // 5. Extract sprites from the filled grid
      const sprites = await extractSprites(
        result.image.data,
        result.image.mimeType,
        {
          headerH: templateParams.headerH,
          border: templateParams.border,
          templateCellW: templateParams.cellW,
          templateCellH: templateParams.cellH,
          gridOverride: {
            cols: gridConfig.cols,
            rows: gridConfig.rows,
            totalCells: gridConfig.totalCells,
            cellLabels: gridConfig.cellLabels,
          },
        },
      );

      if (abort.signal.aborted) return;

      dispatch({ type: 'EXTRACTION_COMPLETE', sprites });

      // 6. Save to history + archive to disk
      const spritePayload = sprites.map(s => ({
        cellIndex: s.cellIndex,
        poseId: s.label.toLowerCase().replace(/\s+/g, '-'),
        poseName: s.label,
        imageData: s.imageData,
        mimeType: s.mimeType,
      }));

      try {
        const histResp = await fetch('/api/history', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            characterName: state.terrain.name,
            characterDescription: state.terrain.description,
            model: state.model,
            prompt,
            filledGridImage: result.image.data,
            spriteType: 'terrain',
            gridSize: state.terrain.gridSize,
          }),
          signal: abort.signal,
        });
        const histData = await histResp.json();

        if (abort.signal.aborted) return;
        dispatch({ type: 'SET_HISTORY_ID', id: histData.id });

        await fetch(`/api/history/${histData.id}/sprites`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sprites: spritePayload }),
          signal: abort.signal,
        });
      } catch (e: any) {
        if (e?.name === 'AbortError') return;
        console.warn('Failed to save to history');
      }

      // Archive to output/ folder
      try {
        await fetch('/api/archive', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            characterName: state.terrain.name,
            filledGridImage: result.image.data,
            filledGridMimeType: result.image.mimeType,
            sprites: spritePayload,
          }),
          signal: abort.signal,
        });
      } catch (e: any) {
        if (e?.name === 'AbortError') return;
        console.warn('Failed to archive to disk');
      }

    } catch (err: any) {
      if (err?.name === 'AbortError') return;
      dispatch({ type: 'GENERATE_ERROR', error: err.message || 'Generation failed' });
    } finally {
      isGeneratingRef.current = false;
      abortRef.current = null;
    }
  }, [state.terrain, state.model, state.imageSize, dispatch]);

  const reExtract = useCallback(async (overrides?: {
    aaInset?: number;
    posterizeBits?: number;
  }) => {
    if (!state.filledGridImage) return;

    dispatch({ type: 'SET_STATUS', message: 'Re-extracting sprites...', statusType: 'info' });

    const gridConfig = getTerrainGridConfig(state.terrain.gridSize, state.terrain.cellLabels);
    const templateParams = gridConfig.templates[state.imageSize as '2K' | '4K'];

    const sprites = await extractSprites(
      state.filledGridImage,
      state.filledGridMimeType,
      {
        headerH: templateParams.headerH,
        border: templateParams.border,
        templateCellW: templateParams.cellW,
        templateCellH: templateParams.cellH,
        gridOverride: {
          cols: gridConfig.cols,
          rows: gridConfig.rows,
          totalCells: gridConfig.totalCells,
          cellLabels: gridConfig.cellLabels,
        },
        ...overrides,
      },
    );

    dispatch({ type: 'EXTRACTION_COMPLETE', sprites });
  }, [state.filledGridImage, state.filledGridMimeType, state.imageSize, state.terrain, dispatch]);

  const reset = useCallback(() => {
    dispatch({ type: 'RESET' });
  }, [dispatch]);

  const setStep = useCallback((step: 'configure' | 'generating' | 'review' | 'preview') => {
    dispatch({ type: 'SET_STEP', step });
  }, [dispatch]);

  return { state, dispatch, generate, reExtract, reset, cancelGeneration, setStep };
}
