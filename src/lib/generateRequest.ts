/**
 * Shared GenerationRequest builder — single interface for constructing
 * PipelineParams across all generation flows.
 */

import type { GridLink, CellGroup, SpriteType } from '../context/AppContext';
import type { GridConfig } from './gridConfig';
import type { ContentPreset } from '../types/api';
import type { PipelineParams, HistoryExtras } from '../hooks/useGenericWorkflow';
import { buildPromptForType } from './promptForType';
import { gridPresetToConfig } from './gridConfig';

export interface GenerationRequestParams {
  spriteType: SpriteType;
  contentPreset: ContentPreset;
  gridLink: GridLink;
  gridConfig: GridConfig;
  prompt: string;
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
    historyExtras,
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
  historyExtras?: HistoryExtras;
  sourceContext?: { groupId: string | null; contentPresetId: string | null };
}): PipelineParams {
  const { spriteType, contentPreset, gridLink, model, imageSize, thinkingLevel, isSubsequentGrid, pixelizeSize, referenceImage, promptSuffix, historyExtras, sourceContext } = opts;

  const gridConfig = gridPresetToConfig(gridLink, spriteType);
  let prompt = buildPromptForType(spriteType, contentPreset, gridLink, gridConfig, isSubsequentGrid, pixelizeSize);
  if (promptSuffix?.trim()) {
    prompt += '\n\n' + promptSuffix.trim();
  }

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
