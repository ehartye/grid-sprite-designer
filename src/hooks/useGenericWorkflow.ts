/**
 * Generic workflow hook factory for the grid sprite designer.
 * Encapsulates the shared generate → extract → save → archive pipeline.
 * Each sprite type provides a small config object to customize behavior.
 */

import { useCallback, useEffect, useRef, useMemo, type Dispatch } from 'react';
import { useAppContext, type AppState, type GridLink, type SpriteType, type Action, type CellGroup } from '../context/AppContext';
import { generateTemplate } from '../lib/templateGenerator';
import { extractSprites } from '../lib/spriteExtractor';
import { generateGrid } from '../api/geminiClient';
import type { GridConfig } from '../lib/gridConfig';
import type { HistorySaveResponse } from '../types/api';

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
  imageSize: '2K' | '4K';
  aspectRatio: string;
  spriteType: SpriteType;
  contentName: string;
  contentDescription: string;
  cellGroups?: CellGroup[];
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
  dispatch: Dispatch<Action>,
  signal: AbortSignal,
) {
  const { gridConfig, prompt, model, imageSize, aspectRatio, spriteType, contentName, contentDescription, cellGroups, referenceImage, historyExtras, sourceContext } = params;

  // 1. Generate template grid
  const templateParams = gridConfig.templates[imageSize];
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

    const histData: HistorySaveResponse = await histResp.json();
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
  } catch (e: unknown) {
    if (e instanceof Error && e.name === 'AbortError') return null;
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
  } catch (e: unknown) {
    if (e instanceof Error && e.name === 'AbortError') return null;
    console.error('Failed to archive to disk:', e);
    dispatch({ type: 'SET_STATUS', message: 'Failed to archive to disk', statusType: 'warning' });
  }

  return result;
}

/**
 * Module-level AbortController for the active single-grid generation.
 * Shared across all useGenericWorkflow instances so that any instance
 * (including GeneratingOverlay's cancel) can abort the real in-flight request.
 */
let activeAbortController: AbortController | null = null;
let activeGenerating = false;

/**
 * Cancel the active single-grid generation (if any).
 * Safe to call from any component — operates on the shared module-level controller.
 */
export function cancelActiveGeneration(dispatch: Dispatch<Action>) {
  if (activeAbortController) {
    activeAbortController.abort();
    activeAbortController = null;
  }
  activeGenerating = false;
  dispatch({ type: 'RESET' });
}

export function useGenericWorkflow(config: WorkflowConfig) {
  const { state, dispatch } = useAppContext();

  const stateRef = useRef(state);
  stateRef.current = state;
  const configRef = useRef(config);
  configRef.current = config;

  useEffect(() => () => { activeAbortController?.abort(); }, []);

  const cancelGeneration = useCallback(() => {
    cancelActiveGeneration(dispatch);
  }, [dispatch]);

  const generate = useCallback(async (gridLink?: GridLink) => {
    const currentState = stateRef.current;
    const currentConfig = configRef.current;
    const content = currentConfig.getContent(currentState);
    if (!content.name.trim() || !content.description.trim()) {
      dispatch({ type: 'SET_STATUS', message: `Please enter a ${currentConfig.validationLabel} name and description.`, statusType: 'warning' });
      return;
    }

    if (activeGenerating) return;
    activeGenerating = true;

    activeAbortController?.abort();
    const abort = new AbortController();
    activeAbortController = abort;

    try {
      const gridConfig = currentConfig.buildGridConfig(currentState, gridLink);
      const aspectRatio = gridConfig.aspectRatio || currentState.aspectRatio;
      const prompt = currentConfig.buildPrompt(currentState, gridConfig, gridLink);

      await runGeneratePipeline({
        gridConfig,
        prompt,
        model: currentState.model,
        imageSize: currentState.imageSize,
        aspectRatio,
        spriteType: currentConfig.spriteType,
        contentName: content.name,
        contentDescription: content.description,
        cellGroups: gridLink?.cellGroups,
        historyExtras: { contentPresetId: currentState.activeContentPresetIds[currentConfig.spriteType] },
        sourceContext: { groupId: null, contentPresetId: currentState.activeContentPresetIds[currentConfig.spriteType] },
      }, dispatch, abort.signal);
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return;
      const message = err instanceof Error ? err.message : 'Generation failed';
      dispatch({ type: 'GENERATE_ERROR', error: message });
    } finally {
      activeGenerating = false;
      activeAbortController = null;
    }
  }, [dispatch]);

  const reExtract = useCallback(async (overrides?: {
    aaInset?: number;
    posterizeBits?: number;
  }) => {
    const currentState = stateRef.current;
    const currentConfig = configRef.current;
    if (!currentState.filledGridImage) return;

    dispatch({ type: 'SET_STATUS', message: 'Re-extracting sprites...', statusType: 'info' });

    try {
      const gridOverride = currentConfig.getReExtractGridConfig(currentState);

      const sprites = await extractSprites(
        currentState.filledGridImage,
        currentState.filledGridMimeType,
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
  }, [dispatch]);

  const reset = useCallback(() => {
    dispatch({ type: 'RESET' });
  }, [dispatch]);

  const setStep = useCallback((step: 'configure' | 'generating' | 'review' | 'preview') => {
    dispatch({ type: 'SET_STEP', step });
  }, [dispatch]);

  const validationMessage = useMemo(() => {
    const content = config.getContent(state);
    const missing: string[] = [];
    if (!content.name.trim()) missing.push('name');
    if (!content.description.trim()) missing.push('description');
    if (missing.length === 0) return null;
    return `Enter a ${config.validationLabel} ${missing.join(' and ')}`;
  }, [state, config]);

  return { state, dispatch, generate, reExtract, reset, cancelGeneration, setStep, validationMessage };
}

// ── WORKFLOW_CONFIGS map ──────────────────────────────────────────────────────

// Lazy-loaded to avoid circular imports; the individual config modules are
// lightweight (no hooks, only pure functions and constants).
import { characterConfig } from './useGridWorkflow';
import { buildingConfig } from './useBuildingWorkflow';
import { terrainConfig } from './useTerrainWorkflow';
import { backgroundConfig } from './useBackgroundWorkflow';

export const WORKFLOW_CONFIGS: Record<SpriteType, WorkflowConfig> = {
  character: characterConfig,
  building: buildingConfig,
  terrain: terrainConfig,
  background: backgroundConfig,
};
