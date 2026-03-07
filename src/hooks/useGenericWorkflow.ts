/**
 * Generic workflow hook factory for the grid sprite designer.
 * Encapsulates the shared generate → extract → save → archive pipeline.
 * Each sprite type provides a small config object to customize behavior.
 */

import { useCallback, useRef } from 'react';
import { useAppContext, type AppState, type GridLink, type SpriteType } from '../context/AppContext';
import { generateTemplate } from '../lib/templateGenerator';
import { extractSprites } from '../lib/spriteExtractor';
import { generateGrid } from '../api/geminiClient';
import type { GridConfig } from '../lib/gridConfig';

export interface WorkflowConfig {
  spriteType: SpriteType;
  /** Human-readable label for validation messages (e.g. "character", "building") */
  validationLabel: string;
  /** Get the content state (name, description, etc.) for this sprite type */
  getContent: (state: AppState) => { name: string; description: string };
  /** Build the grid config from state and optional grid link */
  buildGridConfig: (state: AppState, gridLink?: GridLink) => GridConfig;
  /** Build the prompt from content state, grid config, and optional grid link */
  buildPrompt: (state: AppState, gridConfig: GridConfig, gridLink?: GridLink) => string;
  /** Build grid config for re-extraction from current state */
  getReExtractGridConfig: (state: AppState) => {
    cols: number;
    rows: number;
    totalCells: number;
    cellLabels: string[];
  } | null;
}

export function useGenericWorkflow(config: WorkflowConfig) {
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
    const content = config.getContent(state);
    if (!content.name.trim() || !content.description.trim()) {
      dispatch({ type: 'SET_STATUS', message: `Please enter a ${config.validationLabel} name and description.`, statusType: 'warning' });
      return;
    }

    if (isGeneratingRef.current) return;
    isGeneratingRef.current = true;

    const abort = new AbortController();
    abortRef.current = abort;

    try {
      // 1. Build grid config
      const gridConfig = config.buildGridConfig(state, gridLink);
      const templateParams = gridConfig.templates[state.imageSize as '2K' | '4K'];

      // 2. Generate template grid
      const aspectRatio = gridConfig.aspectRatio || state.aspectRatio;
      const template = generateTemplate(templateParams, gridConfig, aspectRatio);
      dispatch({
        type: 'GENERATE_START',
        templateImage: template.base64,
        gridConfig: {
          cols: gridConfig.cols,
          rows: gridConfig.rows,
          cellLabels: gridConfig.cellLabels,
          cellGroups: gridLink?.cellGroups,
          aspectRatio: gridConfig.aspectRatio,
        },
      });

      // 3. Build prompt
      const prompt = config.buildPrompt(state, gridConfig, gridLink);

      // 4. Call Gemini API
      const result = await generateGrid(
        state.model,
        prompt,
        { data: template.base64, mimeType: 'image/png' },
        state.imageSize,
        abort.signal,
        undefined,
        aspectRatio,
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
            contentName: content.name,
            contentDescription: content.description,
            model: state.model,
            prompt,
            filledGridImage: result.image.data,
            spriteType: config.spriteType,
            gridSize: `${gridConfig.cols}x${gridConfig.rows}`,
            aspectRatio,
            contentPresetId: state.activeContentPresetId,
          }),
          signal: abort.signal,
        });
        const histData = await histResp.json();

        if (abort.signal.aborted) return;
        dispatch({ type: 'SET_HISTORY_ID', id: histData.id });
        dispatch({
          type: 'SET_SOURCE_CONTEXT',
          groupId: null,
          contentPresetId: state.activeContentPresetId,
        });

        await fetch(`/api/history/${histData.id}/sprites`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sprites: spritePayload }),
          signal: abort.signal,
        });
      } catch (e: any) {
        if (e?.name === 'AbortError') return;
        console.error('Failed to save to history:', e);
        dispatch({ type: 'SET_STATUS', message: 'Failed to save to history', statusType: 'warning' });
      }

      // Archive to output/ folder
      try {
        await fetch('/api/archive', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contentName: content.name,
            filledGridImage: result.image.data,
            filledGridMimeType: result.image.mimeType,
            sprites: spritePayload,
          }),
          signal: abort.signal,
        });
      } catch (e: any) {
        if (e?.name === 'AbortError') return;
        console.error('Failed to archive to disk:', e);
        dispatch({ type: 'SET_STATUS', message: 'Failed to archive to disk', statusType: 'warning' });
      }

    } catch (err: any) {
      if (err?.name === 'AbortError') return;
      dispatch({ type: 'GENERATE_ERROR', error: err.message || 'Generation failed' });
    } finally {
      isGeneratingRef.current = false;
      abortRef.current = null;
    }
  }, [state, config, dispatch]);

  const reExtract = useCallback(async (overrides?: {
    aaInset?: number;
    posterizeBits?: number;
  }) => {
    if (!state.filledGridImage) return;

    dispatch({ type: 'SET_STATUS', message: 'Re-extracting sprites...', statusType: 'info' });

    const gridOverride = config.getReExtractGridConfig(state);

    const sprites = await extractSprites(
      state.filledGridImage,
      state.filledGridMimeType,
      {
        ...(gridOverride ? { gridOverride } : {}),
        ...overrides,
      },
    );

    dispatch({ type: 'EXTRACTION_COMPLETE', sprites });
  }, [state.filledGridImage, state.filledGridMimeType, state, config, dispatch]);

  const reset = useCallback(() => {
    dispatch({ type: 'RESET' });
  }, [dispatch]);

  const setStep = useCallback((step: 'configure' | 'generating' | 'review' | 'preview') => {
    dispatch({ type: 'SET_STEP', step });
  }, [dispatch]);

  return { state, dispatch, generate, reExtract, reset, cancelGeneration, setStep };
}
