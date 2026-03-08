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

/** Parameters for the shared generate pipeline */
export interface PipelineParams {
  gridConfig: GridConfig;
  prompt: string;
  model: string;
  imageSize: string;
  aspectRatio: string;
  spriteType: SpriteType;
  contentName: string;
  contentDescription: string;
  cellGroups?: any[];
  referenceImage?: { data: string; mimeType: string };
  /** Extra fields merged into the /api/history POST body */
  historyExtras?: Record<string, any>;
  /** Source context for SET_SOURCE_CONTEXT dispatch */
  sourceContext?: { groupId: string | null; contentPresetId: string | null };
}

/**
 * Shared generate → extract → save → archive pipeline.
 * Used by both useGenericWorkflow and useRunWorkflow.
 */
export async function runGeneratePipeline(
  params: PipelineParams,
  dispatch: (action: any) => void,
  signal: AbortSignal,
) {
  const { gridConfig, prompt, model, imageSize, aspectRatio, spriteType, contentName, contentDescription, cellGroups, referenceImage, historyExtras, sourceContext } = params;

  // 1. Generate template grid
  const templateParams = gridConfig.templates[imageSize as '2K' | '4K'];
  const template = generateTemplate(templateParams, gridConfig, aspectRatio);
  dispatch({
    type: 'GENERATE_START',
    templateImage: template.base64,
    gridConfig: {
      cols: gridConfig.cols,
      rows: gridConfig.rows,
      cellLabels: gridConfig.cellLabels,
      cellGroups,
      aspectRatio: gridConfig.aspectRatio,
    },
  });

  // 2. Call Gemini API
  const result = await generateGrid(
    model,
    prompt,
    { data: template.base64, mimeType: 'image/png' },
    imageSize,
    signal,
    referenceImage,
    aspectRatio,
  );

  if (signal.aborted) return null;

  if (!result.image) {
    dispatch({ type: 'GENERATE_ERROR', error: 'Gemini returned no image. Try again.' });
    return null;
  }

  dispatch({
    type: 'GENERATE_COMPLETE',
    filledGridImage: result.image.data,
    filledGridMimeType: result.image.mimeType,
    geminiText: result.text || '',
  });

  // 3. Extract sprites
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

  if (signal.aborted) return null;

  dispatch({ type: 'EXTRACTION_COMPLETE', sprites });

  // 4. Save to history + archive to disk
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
        contentName,
        contentDescription,
        model,
        prompt,
        filledGridImage: result.image.data,
        spriteType,
        gridSize: `${gridConfig.cols}x${gridConfig.rows}`,
        aspectRatio,
        ...historyExtras,
      }),
      signal,
    });

    if (!histResp.ok) {
      console.error('History save failed:', histResp.status, histResp.statusText);
      dispatch({ type: 'SET_STATUS', message: `Failed to save to history (${histResp.status})`, statusType: 'warning' });
      return result;
    }

    const histData = await histResp.json();
    const histId = Number(histData.id);

    if (!Number.isFinite(histId)) {
      console.error('History save returned invalid id:', histData.id);
      dispatch({ type: 'SET_STATUS', message: 'Failed to save to history: invalid ID returned', statusType: 'warning' });
      return result;
    }

    if (signal.aborted) return null;
    dispatch({ type: 'SET_HISTORY_ID', id: histId });
    if (sourceContext) {
      dispatch({ type: 'SET_SOURCE_CONTEXT', ...sourceContext });
    }

    await fetch(`/api/history/${histId}/sprites`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sprites: spritePayload }),
      signal,
    });
  } catch (e: any) {
    if (e?.name === 'AbortError') return null;
    console.error('Failed to save to history:', e);
    dispatch({ type: 'SET_STATUS', message: 'Failed to save to history', statusType: 'warning' });
  }

  try {
    await fetch('/api/archive', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contentName,
        filledGridImage: result.image.data,
        filledGridMimeType: result.image.mimeType,
        sprites: spritePayload,
      }),
      signal,
    });
  } catch (e: any) {
    if (e?.name === 'AbortError') return null;
    console.error('Failed to archive to disk:', e);
    dispatch({ type: 'SET_STATUS', message: 'Failed to archive to disk', statusType: 'warning' });
  }

  return result;
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
      const gridConfig = config.buildGridConfig(state, gridLink);
      const aspectRatio = gridConfig.aspectRatio || state.aspectRatio;
      const prompt = config.buildPrompt(state, gridConfig, gridLink);

      await runGeneratePipeline({
        gridConfig,
        prompt,
        model: state.model,
        imageSize: state.imageSize,
        aspectRatio,
        spriteType: config.spriteType,
        contentName: content.name,
        contentDescription: content.description,
        cellGroups: gridLink?.cellGroups,
        historyExtras: { contentPresetId: state.activeContentPresetId },
        sourceContext: { groupId: null, contentPresetId: state.activeContentPresetId },
      }, dispatch, abort.signal);
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

    try {
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
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error('Re-extraction failed:', err);
      dispatch({ type: 'SET_STATUS', message: `Re-extraction failed: ${message}`, statusType: 'error' });
    }
  }, [state.filledGridImage, state.filledGridMimeType, state, config, dispatch]);

  const reset = useCallback(() => {
    dispatch({ type: 'RESET' });
  }, [dispatch]);

  const setStep = useCallback((step: 'configure' | 'generating' | 'review' | 'preview') => {
    dispatch({ type: 'SET_STEP', step });
  }, [dispatch]);

  return { state, dispatch, generate, reExtract, reset, cancelGeneration, setStep };
}
