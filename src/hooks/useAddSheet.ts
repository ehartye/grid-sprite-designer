/**
 * Hook for generating a new sprite sheet from an existing generation.
 * Handles reference image preparation, prompt building, then delegates
 * the generate → extract → save pipeline to runGeneratePipeline.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAppContext, SpriteType, GridLink } from '../context/AppContext';
import { composeSpriteSheet, ExtractedSprite } from '../lib/spriteExtractor';
import { gridPresetToConfig } from '../lib/gridConfig';
import { fetchContentPreset, buildPromptForType } from '../lib/promptForType';
import { runGeneratePipeline } from './useGenericWorkflow';
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
  /** Override the grid preset's aspect ratio */
  aspectRatioOverride?: string;
}

export function useAddSheet() {
  const { state, dispatch } = useAppContext();
  const abortRef = useRef<AbortController | null>(null);
  const [generating, setGenerating] = useState(false);

  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => () => { abortRef.current?.abort(); }, []);

  const cancel = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    setGenerating(false);
  }, []);

  const generate = useCallback(async (opts: AddSheetOptions) => {
    const { gridLink, imageSize, referenceMode, selectedSprites, followUpGuidance, aspectRatioOverride } = opts;
    const currentState = stateRef.current;
    const spriteType = currentState.spriteType as SpriteType;
    const contentPresetId = currentState.sourceContentPresetId;
    const filledGridImage = currentState.filledGridImage;
    let groupId = currentState.sourceGroupId;
    const historyId = currentState.historyId;

    if (!filledGridImage) throw new Error('No filled grid image available');

    setGenerating(true);
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
        const { base64 } = await composeSpriteSheet(selectedSprites, gridCols);
        refBase64 = base64;
      } else {
        refBase64 = filledGridImage;
      }

      // Fetch content preset for prompt building
      let contentPreset: ContentPreset;
      if (contentPresetId) {
        contentPreset = await fetchContentPreset(spriteType, contentPresetId);
      } else {
        // Legacy entry — build a minimal preset from state
        const name =
          spriteType === 'building' ? currentState.building.name :
          spriteType === 'terrain' ? currentState.terrain.name :
          spriteType === 'background' ? currentState.background.name :
          currentState.character.name;
        const description =
          spriteType === 'building' ? currentState.building.description :
          spriteType === 'terrain' ? currentState.terrain.description :
          spriteType === 'background' ? currentState.background.description :
          currentState.character.description;
        contentPreset = { name, description };
      }

      if (abort.signal.aborted) return;

      // Build grid config and prompt
      const gridConfig = gridPresetToConfig(gridLink, spriteType);
      const aspectRatio = aspectRatioOverride || gridConfig.aspectRatio || '1:1';

      // Build prompt (always as subsequent grid since we have a reference)
      let prompt = buildPromptForType(spriteType, contentPreset, gridLink, gridConfig, true);

      if (followUpGuidance?.trim()) {
        prompt += `\n\nADDITIONAL GUIDANCE:\n${followUpGuidance.trim()}`;
      }

      // Delegate to shared pipeline
      await runGeneratePipeline({
        gridConfig,
        prompt,
        model: currentState.model,
        imageSize,
        aspectRatio,
        spriteType,
        contentName: contentPreset.name,
        contentDescription: contentPreset.description,
        cellGroups: gridLink.cellGroups,
        referenceImage: { data: refBase64, mimeType: 'image/png' },
        historyExtras: { groupId, contentPresetId },
        sourceContext: { groupId: groupId ?? null, contentPresetId: contentPresetId ?? null },
      }, dispatch, abort.signal);

    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return;
      const message = err instanceof Error ? err.message : 'Generation failed';
      dispatch({ type: 'GENERATE_ERROR', error: message });
    } finally {
      setGenerating(false);
      abortRef.current = null;
    }
  }, [dispatch]);

  return { generate, cancel, generating };
}
