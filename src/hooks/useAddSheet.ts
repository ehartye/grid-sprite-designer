/**
 * Hook for generating a new sprite sheet from an existing generation.
 * Handles reference image preparation, prompt building, then delegates
 * the generate → extract → save pipeline to runGeneratePipeline.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAppContext, SpriteType, GridLink } from '../context/AppContext';
import { composeSpriteSheet, ExtractedSprite } from '../lib/spriteExtractor';
import { fetchContentPreset } from '../lib/promptForType';
import { buildGenerationRequest } from '../lib/generateRequest';
import { runGeneratePipeline, WORKFLOW_CONFIGS } from './useGenericWorkflow';
import { debugLog } from '../lib/debugLog';
import type { ContentPreset } from '../types/api';

export interface AddSheetOptions {
  /** Grid link to use for the new sheet */
  gridLink: GridLink;
  /** Image generation size */
  imageSize: '2K' | '4K';
  /** 'full' uses the filled grid image; 'selected' composes from chosen sprites */
  referenceMode: 'full' | 'selected';
  /** Sprites to compose into reference (only used when referenceMode === 'selected') */
  selectedSprites?: ExtractedSprite[];
  /** Optional follow-up guidance appended to the prompt */
  followUpGuidance?: string;
  /** Optional pixelize target size for prompt guidance */
  pixelizeSize?: number;
}

export function useAddSheet() {
  const { state, dispatch } = useAppContext();
  const abortRef = useRef<AbortController | null>(null);
  const [generating, setGenerating] = useState(false);

  const stateRef = useRef(state);
  stateRef.current = state;

  const isGeneratingRef = useRef(false);

  useEffect(() => () => {
    // Don't abort if generation is still in progress — the pipeline outlives
    // the modal (which unmounts when GENERATE_START changes the step to 'generating').
    if (!isGeneratingRef.current) {
      abortRef.current?.abort();
    }
  }, []);

  const cancel = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    isGeneratingRef.current = false;
    setGenerating(false);
  }, []);

  const generate = useCallback(async (opts: AddSheetOptions) => {
    if (isGeneratingRef.current) return;
    isGeneratingRef.current = true;

    const { gridLink, imageSize, referenceMode, selectedSprites, followUpGuidance, pixelizeSize } = opts;
    const currentState = stateRef.current;
    const spriteType = currentState.spriteType as SpriteType;
    const contentPresetId = currentState.sourceContentPresetId;
    const filledGridImage = currentState.filledGridImage;
    let groupId = currentState.sourceGroupId;
    const historyId = currentState.historyId;

    if (!filledGridImage) {
      isGeneratingRef.current = false;
      throw new Error('No filled grid image available');
    }

    setGenerating(true);
    abortRef.current?.abort();
    const abort = new AbortController();
    abortRef.current = abort;

    try {
      // If no groupId exists (legacy entry), create one and backfill
      if (!groupId && historyId) {
        groupId = `addsheet-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const groupRes = await fetch(`/api/history/${historyId}/group`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ groupId }),
          signal: abort.signal,
        });
        if (!groupRes.ok) {
          console.error('Failed to backfill group_id on legacy entry');
          dispatch({ type: 'SET_STATUS', message: 'Failed to backfill group on legacy entry', statusType: 'warning' });
        }
        dispatch({ type: 'SET_SOURCE_CONTEXT', groupId, contentPresetId });
      }

      // Build reference image
      let refBase64: string;
      if (referenceMode === 'selected' && selectedSprites && selectedSprites.length > 0) {
        const gridCols = currentState.activeGridConfig?.cols;
        debugLog('[AddSheet] reference: selected', selectedSprites.length, 'sprites, cellIndices:', selectedSprites.map(s => s.cellIndex));
        const { canvas, base64 } = await composeSpriteSheet(selectedSprites, gridCols);
        debugLog('[AddSheet] composed reference:', canvas.width, 'x', canvas.height);
        refBase64 = base64;
      } else {
        debugLog('[AddSheet] reference: full filled grid image');
        refBase64 = filledGridImage;
      }

      // Fetch content preset for prompt building
      let contentPreset: ContentPreset;
      if (contentPresetId) {
        contentPreset = await fetchContentPreset(spriteType, contentPresetId);
      } else {
        // Legacy entry — build a minimal preset from state
        const { name, description } = WORKFLOW_CONFIGS[spriteType].getContent(currentState);
        contentPreset = { name, description };
      }

      if (abort.signal.aborted) return;

      debugLog('[AddSheet] contentPresetId:', contentPresetId);
      debugLog('[AddSheet] contentPreset:', contentPreset.name);
      debugLog('[AddSheet] gridLink:', gridLink.gridName, gridLink.gridSize, '| cellLabels[0..3]:', gridLink.cellLabels.slice(0, 4));
      debugLog('[AddSheet] gridGuidance.overall:', gridLink.gridGuidance?.overall ? gridLink.gridGuidance.overall.slice(0, 80) + '…' : '(empty)');

      const pipelineParams = buildGenerationRequest({
        spriteType,
        contentPreset,
        gridLink,
        model: currentState.model,
        imageSize,
        thinkingLevel: currentState.thinkingLevel,
        isSubsequentGrid: true,
        pixelizeSize,
        referenceImage: { data: refBase64, mimeType: 'image/png' },
        promptSuffix: followUpGuidance,
        historyExtras: { groupId, contentPresetId },
        sourceContext: { groupId: groupId ?? null, contentPresetId: contentPresetId ?? null },
      });

      await runGeneratePipeline(pipelineParams, dispatch, abort.signal);

    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return;
      const message = err instanceof Error ? err.message : 'Generation failed';
      dispatch({ type: 'GENERATE_ERROR', error: message });
    } finally {
      isGeneratingRef.current = false;
      setGenerating(false);
      abortRef.current = null;
    }
  }, [dispatch]);

  return { generate, cancel, generating };
}
