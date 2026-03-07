/**
 * Hook for generating a new sprite sheet from an existing generation.
 * Handles reference image preparation, prompt building, generation, and history saving.
 */

import { useCallback, useRef, useState } from 'react';
import { useAppContext, SpriteType, GridLink } from '../context/AppContext';
import { generateTemplate } from '../lib/templateGenerator';
import { extractSprites, composeSpriteSheet, ExtractedSprite } from '../lib/spriteExtractor';
import { generateGrid } from '../api/geminiClient';
import { gridPresetToConfig } from '../lib/gridConfig';
import { fetchContentPreset, buildPromptForType } from '../lib/promptForType';

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

  const cancel = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    setGenerating(false);
  }, []);

  const generate = useCallback(async (opts: AddSheetOptions) => {
    const { gridLink, imageSize, referenceMode, selectedSprites, followUpGuidance, aspectRatioOverride } = opts;
    const spriteType = state.spriteType as SpriteType;
    const contentPresetId = state.sourceContentPresetId;
    const filledGridImage = state.filledGridImage;
    let groupId = state.sourceGroupId;
    const historyId = state.historyId;

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
        }
        dispatch({ type: 'SET_SOURCE_CONTEXT', groupId, contentPresetId });
      }

      // Build reference image
      let refBase64: string;
      if (referenceMode === 'selected' && selectedSprites && selectedSprites.length > 0) {
        const gridCols = state.activeGridConfig?.cols;
        const { base64 } = await composeSpriteSheet(selectedSprites, gridCols);
        refBase64 = base64;
      } else {
        refBase64 = filledGridImage;
      }

      // Fetch content preset for prompt building
      let contentPreset: any;
      if (contentPresetId) {
        contentPreset = await fetchContentPreset(spriteType, contentPresetId);
      } else {
        // Legacy entry — build a minimal preset from state
        const name =
          spriteType === 'building' ? state.building.name :
          spriteType === 'terrain' ? state.terrain.name :
          spriteType === 'background' ? state.background.name :
          state.character.name;
        const description =
          spriteType === 'building' ? state.building.description :
          spriteType === 'terrain' ? state.terrain.description :
          spriteType === 'background' ? state.background.description :
          state.character.description;
        contentPreset = { name, description };
      }

      if (abort.signal.aborted) return;

      // Build grid config and template
      const gridConfig = gridPresetToConfig(gridLink, spriteType);
      const templateParams = gridConfig.templates[imageSize];
      const aspectRatio = aspectRatioOverride || gridConfig.aspectRatio || '1:1';
      const template = generateTemplate(templateParams, gridConfig, aspectRatio);

      dispatch({
        type: 'GENERATE_START',
        templateImage: template.base64,
        gridConfig: {
          cols: gridConfig.cols,
          rows: gridConfig.rows,
          cellLabels: gridConfig.cellLabels,
          cellGroups: gridLink.cellGroups,
          aspectRatio: gridConfig.aspectRatio,
        },
      });

      // Build prompt (always as subsequent grid since we have a reference)
      let prompt = buildPromptForType(spriteType, contentPreset, gridLink, gridConfig, true);

      if (followUpGuidance?.trim()) {
        prompt += `\n\nADDITIONAL GUIDANCE:\n${followUpGuidance.trim()}`;
      }

      // Call Gemini
      const result = await generateGrid(
        state.model,
        prompt,
        { data: template.base64, mimeType: 'image/png' },
        imageSize,
        abort.signal,
        { data: refBase64, mimeType: 'image/png' },
        aspectRatio,
      );

      if (abort.signal.aborted) return;

      if (!result.image) {
        dispatch({ type: 'GENERATE_ERROR', error: 'Gemini returned no image. Try again.' });
        return;
      }

      dispatch({
        type: 'GENERATE_COMPLETE',
        filledGridImage: result.image.data,
        filledGridMimeType: result.image.mimeType,
        geminiText: result.text || '',
      });

      // Extract sprites
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

      // Save to history
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
            characterName: contentPreset.name,
            characterDescription: contentPreset.description,
            model: state.model,
            prompt,
            filledGridImage: result.image.data,
            spriteType,
            gridSize: `${gridConfig.cols}x${gridConfig.rows}`,
            aspectRatio,
            groupId,
            contentPresetId,
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
        console.error('Failed to save add-sheet generation to history:', e);
      }

      // Archive
      try {
        await fetch('/api/archive', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            characterName: contentPreset.name,
            filledGridImage: result.image.data,
            filledGridMimeType: result.image.mimeType,
            sprites: spritePayload,
          }),
          signal: abort.signal,
        });
      } catch (e: any) {
        if (e?.name === 'AbortError') return;
        console.error('Failed to archive add-sheet generation:', e);
      }

    } catch (err: any) {
      if (err?.name === 'AbortError') return;
      dispatch({ type: 'GENERATE_ERROR', error: err.message || 'Generation failed' });
    } finally {
      setGenerating(false);
      abortRef.current = null;
    }
  }, [state, dispatch]);

  return { generate, cancel, generating };
}
