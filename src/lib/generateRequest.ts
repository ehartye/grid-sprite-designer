/**
 * Shared GenerationRequest builder — single interface for constructing
 * PipelineParams across all generation flows.
 */

import type { GridLink, SpriteType } from '../context/AppContext';
import type { GridConfig } from './gridConfig';
import type { ContentPreset } from '../types/api';
import type { PipelineParams, HistoryExtras } from '../hooks/useGenericWorkflow';
import type { FeedbackState } from '../types/feedback';
import type { StructuredPrompt } from '../types/prompt';
import { assemblePrompt } from './promptForType';
import { gridPresetToConfig } from './gridConfig';

/** Build a grid snapshot from a GridLink for history persistence. */
export function buildGridSnapshot(gridLink: GridLink): Record<string, unknown> {
  return {
    cols: gridLink.cols,
    rows: gridLink.rows,
    cellLabels: gridLink.cellLabels,
    cellGroups: gridLink.cellGroups || [],
    aspectRatio: gridLink.aspectRatio || '1:1',
  };
}

export interface GenerationRequestParams {
  spriteType: SpriteType;
  contentPreset: ContentPreset;
  gridLink: GridLink;
  gridConfig: GridConfig;
  prompt: StructuredPrompt;
  model: string;
  imageSize: '2K' | '4K';
  thinkingLevel?: 'default' | 'minimal' | 'low' | 'medium' | 'high';
  referenceImage?: { data: string; mimeType: string };
  historyExtras?: HistoryExtras;
  sourceContext?: { groupId: string | null; contentPresetId: string | null };
}

/**
 * Build PipelineParams from a GridLink and ContentPreset.
 * All generation flows converge here.
 */
export function buildPipelineParams(params: GenerationRequestParams): PipelineParams {
  const { spriteType, contentPreset, gridLink, gridConfig, prompt, model, imageSize, thinkingLevel, referenceImage, historyExtras, sourceContext } = params;
  return {
    gridConfig,
    prompt,
    model,
    thinkingLevel,
    imageSize,
    spriteType,
    contentName: contentPreset.name,
    contentDescription: contentPreset.description,
    cellGroups: gridLink.cellGroups,
    referenceImage,
    historyExtras: {
      ...historyExtras,
      gridPresetName: gridLink.gridName || null,
    },
    sourceContext,
  };
}

/**
 * Convenience: build gridConfig + prompt + PipelineParams in one call.
 * Covers the common case for addSheet, runWorkflow, and regenerateWithFeedback.
 */
export function buildGenerationRequest(opts: {
  spriteType: SpriteType;
  contentPreset: ContentPreset;
  gridLink: GridLink;
  model: string;
  imageSize: '2K' | '4K';
  thinkingLevel?: 'default' | 'minimal' | 'low' | 'medium' | 'high';
  isSubsequentGrid: boolean;
  pixelizeSize?: number;
  referenceImage?: { data: string; mimeType: string };
  promptSuffix?: string;
  feedbackState?: FeedbackState;
  historyExtras?: HistoryExtras;
  sourceContext?: { groupId: string | null; contentPresetId: string | null };
}): PipelineParams {
  const { spriteType, contentPreset, gridLink, model, imageSize, thinkingLevel, isSubsequentGrid, pixelizeSize, referenceImage, promptSuffix, historyExtras, sourceContext } = opts;

  const gridConfig = gridPresetToConfig(gridLink, spriteType);

  const prompt = assemblePrompt({
    spriteType,
    contentPreset,
    gridLink,
    isSubsequentGrid,
    pixelizeSize,
    referenceImage,
    feedbackState: opts.feedbackState,
    promptSuffix,
  });

  return buildPipelineParams({
    spriteType,
    contentPreset,
    gridLink,
    gridConfig,
    prompt,
    model,
    imageSize,
    thinkingLevel,
    referenceImage,
    historyExtras,
    sourceContext,
  });
}
