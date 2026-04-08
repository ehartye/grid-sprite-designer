/**
 * Generic workflow hook factory for the grid sprite designer.
 * Encapsulates the shared generate → extract → save → archive pipeline.
 * Each sprite type provides a small config object to customize behavior.
 */

import { useCallback, useEffect, useRef, useMemo, type Dispatch, type MutableRefObject } from 'react';
import { useAppContext, useAbortControllerRef, type AppState, type GridLink, type SpriteType, type Action, type CellGroup } from '../context/AppContext';
import { generateTemplate, generateBackgroundTemplate } from '../lib/templateGenerator';
import { computeSquareLayout } from '../lib/computeSquareLayout';
import { extractSprites } from '../lib/spriteExtractor';
import { generateGrid, generateFromStructuredPrompt } from '../api/geminiClient';
import { debugLog } from '../lib/debugLog';
import type { GridConfig } from '../lib/gridConfig';
import type { HistorySaveResponse, ContentPreset } from '../types/api';
import type { StructuredPrompt } from '../types/prompt';
import { EMPTY_GUIDANCE } from '../lib/promptBuilderBase';
import { buildGenerationRequest } from '../lib/generateRequest';

/** Extra fields merged into the /api/history POST body */
export interface HistoryExtras {
  groupId?: number | string | null;
  contentPresetId?: number | string | null;
  parentHistoryId?: number | null;
  generationVersion?: number;
  gridPresetName?: string | null;
}

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
  prompt: string | StructuredPrompt;
  model: string;
  thinkingLevel?: 'default' | 'minimal' | 'low' | 'medium' | 'high';
  imageSize: '2K' | '4K';
  spriteType: SpriteType;
  contentName: string;
  contentDescription: string;
  cellGroups?: CellGroup[];
  referenceImage?: { data: string; mimeType: string };
  /** Extra fields merged into the /api/history POST body */
  historyExtras?: HistoryExtras;
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
  const { gridConfig, prompt, model, thinkingLevel, imageSize, spriteType, contentName, contentDescription, cellGroups, referenceImage, historyExtras, sourceContext } = params;

  // 1. Generate template grid
  const isBackground = spriteType === 'background';
  let template: { canvas: HTMLCanvasElement; base64: string; width: number; height: number };
  let aspectRatio: string;

  if (isBackground && gridConfig.templates) {
    // Background: use legacy path with stored aspect ratio
    const templateParams = gridConfig.templates[imageSize];
    aspectRatio = gridConfig.aspectRatio || '1:1';
    template = generateBackgroundTemplate(templateParams, gridConfig, aspectRatio);
  } else {
    // All other types: compute square layout, derive aspect ratio
    const layout = computeSquareLayout(gridConfig.cols, gridConfig.rows, imageSize);
    aspectRatio = layout.aspectRatio;
    template = generateTemplate(layout, gridConfig);
  }
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
  let result;
  if (typeof prompt === 'string') {
    // Legacy string path — used by useGenericWorkflow.generate() until migrated
    debugLog('[Gemini Prompt]\n' + prompt);
    result = await generateGrid(
      model,
      prompt,
      { data: template.base64, mimeType: 'image/png' },
      imageSize,
      signal,
      referenceImage,
      aspectRatio,
      thinkingLevel,
    );
  } else {
    // Structured prompt path — inject template image at the canvas section
    const finalParts = [...prompt.parts];
    const canvasIdx = prompt.meta.sectionBreakdown.find(s => s.name === 'canvas')?.partIndex;
    if (canvasIdx !== undefined) {
      // Template image goes right after the canvas text part
      finalParts.splice(canvasIdx + 1, 0, { type: 'image', data: template.base64, mimeType: 'image/png', label: 'template' });
    } else {
      finalParts.push({ type: 'image', data: template.base64, mimeType: 'image/png', label: 'template' });
    }
    const finalPrompt = { ...prompt, parts: finalParts };
    debugLog('[Gemini Structured Prompt] parts:', finalPrompt.parts.length, 'sections:', finalPrompt.meta.sectionBreakdown.map(s => s.name));
    result = await generateFromStructuredPrompt(model, finalPrompt, imageSize, signal, aspectRatio, thinkingLevel);
  }

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
  let sprites: Awaited<ReturnType<typeof extractSprites>>;
  try {
    sprites = await extractSprites(
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
  } catch (extractionErr: unknown) {
    // Generation succeeded but extraction failed — transition to review
    // so the user can retry via the existing re-extract UI.
    const msg = extractionErr instanceof Error ? extractionErr.message : 'Unknown extraction error';
    console.error('Sprite extraction failed:', extractionErr);
    dispatch({ type: 'EXTRACTION_COMPLETE', sprites: [] });
    dispatch({ type: 'SET_STATUS', message: `Extraction failed: ${msg}. Use re-extract to retry.`, statusType: 'warning' });
    return result;
  }

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

  const promptForHistory = typeof prompt === 'string'
    ? prompt
    : prompt.parts.filter(p => p.type === 'text').map(p => (p as { type: 'text'; content: string }).content).join('\n\n');

  try {
    const histResp = await fetch('/api/history', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contentName,
        contentDescription,
        model,
        imageSize,
        thinkingLevel: thinkingLevel && thinkingLevel !== 'default' ? thinkingLevel : null,
        prompt: promptForHistory,
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

    const spriteRes = await fetch(`/api/history/${histId}/sprites`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sprites: spritePayload }),
      signal,
    });

    if (!spriteRes.ok) {
      console.error('Sprite save failed:', spriteRes.status, spriteRes.statusText);
      dispatch({ type: 'SET_STATUS', message: `Failed to save sprites (${spriteRes.status})`, statusType: 'warning' });
    }
  } catch (e: unknown) {
    if (e instanceof Error && e.name === 'AbortError') return null;
    console.error('Failed to save to history:', e);
    dispatch({ type: 'SET_STATUS', message: 'Failed to save to history', statusType: 'warning' });
  }

  try {
    const archiveRes = await fetch('/api/archive', {
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

    if (!archiveRes.ok) {
      console.error('Archive save failed:', archiveRes.status, archiveRes.statusText);
      dispatch({ type: 'SET_STATUS', message: `Failed to archive to disk (${archiveRes.status})`, statusType: 'warning' });
    }
  } catch (e: unknown) {
    if (e instanceof Error && e.name === 'AbortError') return null;
    console.error('Failed to archive to disk:', e);
    dispatch({ type: 'SET_STATUS', message: 'Failed to archive to disk', statusType: 'warning' });
  }

  return result;
}

/**
 * Cancel the active single-grid generation (if any).
 * Uses the shared abort controller ref from AppContext.
 */
export function cancelActiveGeneration(
  dispatch: Dispatch<Action>,
  abortRef: MutableRefObject<AbortController | null>,
) {
  if (abortRef.current) {
    abortRef.current.abort();
    abortRef.current = null;
  }
  dispatch({ type: 'RESET' });
}

export function useGenericWorkflow(config: WorkflowConfig) {
  const { state, dispatch } = useAppContext();
  const sharedAbortRef = useAbortControllerRef();

  const stateRef = useRef(state);
  stateRef.current = state;
  const configRef = useRef(config);
  configRef.current = config;

  const localAbortRef = useRef<AbortController | null>(null);
  const isGeneratingRef = useRef(false);

  // Cleanup: abort on unmount only if NOT actively generating.
  // When generating, the async pipeline still owns the controller and
  // cancelActiveGeneration() can cancel via the shared context ref.
  useEffect(() => () => {
    if (localAbortRef.current && !isGeneratingRef.current) {
      localAbortRef.current.abort();
      if (sharedAbortRef.current === localAbortRef.current) {
        sharedAbortRef.current = null;
      }
      localAbortRef.current = null;
    }
  }, [sharedAbortRef]);

  const cancelGeneration = useCallback(() => {
    cancelActiveGeneration(dispatch, sharedAbortRef);
    localAbortRef.current = null;
    isGeneratingRef.current = false;
  }, [dispatch, sharedAbortRef]);

  const generate = useCallback(async (gridLink?: GridLink, promptSuffix?: string) => {
    const currentState = stateRef.current;
    const currentConfig = configRef.current;
    const content = currentConfig.getContent(currentState);
    if (!content.name.trim() || !content.description.trim()) {
      dispatch({ type: 'SET_STATUS', message: `Please enter a ${currentConfig.validationLabel} name and description.`, statusType: 'warning' });
      return;
    }

    if (isGeneratingRef.current) return;
    isGeneratingRef.current = true;

    localAbortRef.current?.abort();
    const abort = new AbortController();
    localAbortRef.current = abort;
    sharedAbortRef.current = abort;

    try {
      const gridConfig = currentConfig.buildGridConfig(currentState, gridLink);

      // Build ContentPreset from state fields
      const stateFields = currentState[currentConfig.spriteType];
      const contentPreset: ContentPreset = {
        name: stateFields.name,
        description: stateFields.description,
        ...('equipment' in stateFields ? { equipment: stateFields.equipment } : {}),
        ...('details' in stateFields ? { details: stateFields.details } : {}),
        ...('bgMode' in stateFields ? { bgMode: (stateFields as { bgMode?: 'parallax' | 'scene' }).bgMode } : {}),
        colorNotes: 'colorNotes' in stateFields ? (stateFields as { colorNotes: string }).colorNotes : undefined,
        overallGuidance: 'overallGuidance' in stateFields ? (stateFields as { overallGuidance: string }).overallGuidance : undefined,
        groupGuidance: 'groupGuidance' in stateFields ? (stateFields as { groupGuidance: Record<string, string> }).groupGuidance : undefined,
        cellGuidance: 'cellGuidance' in stateFields ? (stateFields as { cellGuidance: Record<string, string> }).cellGuidance : undefined,
      };

      // Build a synthetic GridLink when none is provided
      const effectiveGridLink: GridLink = gridLink ?? {
        id: 0,
        gridPresetId: 0,
        gridGuidance: EMPTY_GUIDANCE,
        linkGuidance: EMPTY_GUIDANCE,
        sortOrder: 0,
        gridName: '',
        gridSize: `${gridConfig.cols}x${gridConfig.rows}`,
        cols: gridConfig.cols,
        rows: gridConfig.rows,
        cellLabels: gridConfig.cellLabels,
        cellGroups: [],
        aspectRatio: gridConfig.aspectRatio || '1:1',
        tileShape: 'square' as const,
      };

      const pipelineParams = buildGenerationRequest({
        spriteType: currentConfig.spriteType,
        contentPreset,
        gridLink: effectiveGridLink,
        model: currentState.model,
        imageSize: currentState.imageSize,
        thinkingLevel: currentState.thinkingLevel,
        isSubsequentGrid: false,
        promptSuffix,
        historyExtras: { contentPresetId: currentState.activeContentPresetIds[currentConfig.spriteType], gridPresetName: gridLink?.gridName || null },
        sourceContext: { groupId: null, contentPresetId: currentState.activeContentPresetIds[currentConfig.spriteType] },
      });

      await runGeneratePipeline(pipelineParams, dispatch, abort.signal);
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return;
      const message = err instanceof Error ? err.message : 'Generation failed';
      dispatch({ type: 'GENERATE_ERROR', error: message });
    } finally {
      isGeneratingRef.current = false;
      localAbortRef.current = null;
      if (sharedAbortRef.current === abort) {
        sharedAbortRef.current = null;
      }
    }
  }, [dispatch, sharedAbortRef]);

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
