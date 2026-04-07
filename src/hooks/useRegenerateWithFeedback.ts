/**
 * Hook for regenerating the current sprite sheet with structured feedback.
 * Uses edit mode — sends only the source image (no template) with a
 * targeted feedback prompt. The model makes minimal changes to address
 * feedback while preserving approved cells.
 */

import { useCallback, useRef, useState } from 'react';
import { useAppContext } from '../context/AppContext';
import type { GridLink } from '../context/AppContext';
import type { ContentPreset } from '../types/api';
import type { FeedbackState } from '../types/feedback';
import { editGrid } from '../api/geminiClient';
import { extractSprites, type ExtractedSprite } from '../lib/spriteExtractor';
import { buildEditPrompt } from '../lib/feedbackPrompt';
import { fetchContentPreset } from '../lib/promptForType';
import { debugLog } from '../lib/debugLog';

export interface RegenerateOptions {
  gridLink: GridLink;
  imageSize: '2K' | '4K';
  feedbackState: FeedbackState;
}

export function useRegenerateWithFeedback() {
  const { state, dispatch } = useAppContext();
  const abortRef = useRef<AbortController | null>(null);
  const isGeneratingRef = useRef(false);
  const [generating, setGenerating] = useState(false);

  const stateRef = useRef(state);
  stateRef.current = state;

  const regenerate = useCallback(async (opts: RegenerateOptions) => {
    if (isGeneratingRef.current) return;
    isGeneratingRef.current = true;
    setGenerating(true);

    const abort = new AbortController();
    abortRef.current = abort;

    try {
      const { gridLink, imageSize, feedbackState } = opts;
      const currentState = stateRef.current;
      const { spriteType, historyId, filledGridImage, filledGridMimeType, sourceContentPresetId: contentPresetId, sourceGroupId: groupId } = currentState;

      if (!filledGridImage) {
        dispatch({ type: 'SET_STATUS', message: 'No grid image to use as source', statusType: 'error' });
        return;
      }

      // 1. Save feedback to current generation
      if (historyId) {
        await fetch(`/api/history/${historyId}/feedback`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ feedbackJson: JSON.stringify(feedbackState) }),
          signal: abort.signal,
        });
      }

      // 2. Determine next version number (handles branching)
      let nextVersion = 2;
      if (groupId) {
        try {
          const resp = await fetch(`/api/history/max-version?groupId=${encodeURIComponent(groupId)}&gridSize=${gridLink.cols}x${gridLink.rows}`, { signal: abort.signal });
          if (resp.ok) {
            const data = await resp.json();
            nextVersion = (data.maxVersion || 1) + 1;
          }
        } catch { /* default to 2 */ }
      } else if (historyId) {
        try {
          const resp = await fetch(`/api/history/${historyId}`, { signal: abort.signal });
          if (resp.ok) {
            const data = await resp.json();
            nextVersion = (data.generationVersion || 1) + 1;
          }
        } catch { /* default to 2 */ }
      }

      // 3. Build edit prompt (feedback only, no full subject/layout prompt)
      const cellLabels = gridLink.cellLabels;
      const cellGroups = gridLink.cellGroups || [];
      const cols = gridLink.cols;
      const prompt = buildEditPrompt(feedbackState, cellLabels, cellGroups, cols);

      debugLog('[Regen Edit Prompt]\n' + prompt);

      // 4. Dispatch generating state
      dispatch({
        type: 'GENERATE_START',
        templateImage: filledGridImage, // show source as "template" in UI
        gridConfig: {
          cols: gridLink.cols,
          rows: gridLink.rows,
          cellLabels: gridLink.cellLabels,
          cellGroups: gridLink.cellGroups,
          aspectRatio: gridLink.aspectRatio,
        },
      });

      // 5. Call edit API — source image only, no template
      const result = await editGrid(
        currentState.model,
        prompt,
        { data: filledGridImage, mimeType: filledGridMimeType || 'image/png' },
        imageSize,
        abort.signal,
        gridLink.aspectRatio || '1:1',
        currentState.thinkingLevel,
      );

      if (!result.image) {
        dispatch({ type: 'GENERATE_ERROR', error: 'No image returned from edit' });
        return;
      }

      // 6. Update state with result
      dispatch({
        type: 'GENERATE_COMPLETE',
        filledGridImage: result.image.data,
        filledGridMimeType: result.image.mimeType,
        geminiText: result.text,
      });

      // 7. Extract sprites
      let sprites: ExtractedSprite[];
      try {
        sprites = await extractSprites(result.image.data, result.image.mimeType, {
          gridOverride: {
            cols: gridLink.cols,
            rows: gridLink.rows,
            totalCells: gridLink.cols * gridLink.rows,
            cellLabels: gridLink.cellLabels,
          },
        });
        dispatch({ type: 'EXTRACTION_COMPLETE', sprites });
      } catch (err) {
        console.error('Sprite extraction failed:', err);
        dispatch({ type: 'SET_STATUS', message: 'Sprite extraction failed', statusType: 'warning' });
        sprites = [];
      }

      // 8. Fetch content preset name for history
      let contentName = currentState.character?.name || currentState.building?.name || '';
      let contentDescription = '';
      if (contentPresetId) {
        try {
          const preset: ContentPreset = await fetchContentPreset(spriteType, contentPresetId);
          contentName = preset.name;
          contentDescription = preset.description;
        } catch { /* use state fallback */ }
      }

      // 9. Save to history
      try {
        const histResp = await fetch('/api/history', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contentName,
            contentDescription,
            model: currentState.model,
            imageSize,
            thinkingLevel: currentState.thinkingLevel !== 'default' ? currentState.thinkingLevel : null,
            prompt,
            filledGridImage: result.image.data,
            spriteType,
            gridSize: `${gridLink.cols}x${gridLink.rows}`,
            aspectRatio: gridLink.aspectRatio || '1:1',
            groupId: groupId ?? null,
            contentPresetId: contentPresetId ?? null,
            parentHistoryId: historyId,
            generationVersion: nextVersion,
            gridPresetName: gridLink.gridName || null,
          }),
          signal: abort.signal,
        });

        if (histResp.ok) {
          const histData = await histResp.json();
          const histId = Number(histData.id);
          if (Number.isFinite(histId)) {
            dispatch({ type: 'SET_HISTORY_ID', id: histId });
            dispatch({ type: 'SET_SOURCE_CONTEXT', groupId: groupId ?? null, contentPresetId: contentPresetId ?? null });

            // Save sprites
            if (sprites.length > 0) {
              const spritePayload = sprites.map(s => ({
                cellIndex: s.cellIndex,
                poseId: s.label.toLowerCase().replace(/\s+/g, '-'),
                poseName: s.label,
                imageData: s.imageData,
                mimeType: s.mimeType,
              }));
              await fetch(`/api/history/${histId}/sprites`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sprites: spritePayload }),
                signal: abort.signal,
              });
            }

            // Archive
            await fetch('/api/archive', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contentName,
                filledGridImage: result.image.data,
                filledGridMimeType: result.image.mimeType,
                sprites: sprites.map(s => ({
                  cellIndex: s.cellIndex,
                  poseName: s.label,
                  imageData: s.imageData,
                  mimeType: s.mimeType,
                })),
              }),
              signal: abort.signal,
            }).catch(() => {});
          }
        }
      } catch (e: unknown) {
        if (e instanceof Error && e.name === 'AbortError') return;
        console.error('History save failed:', e);
      }

    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return;
      const message = err instanceof Error ? err.message : 'Regeneration failed';
      dispatch({ type: 'GENERATE_ERROR', error: message });
    } finally {
      isGeneratingRef.current = false;
      setGenerating(false);
      abortRef.current = null;
    }
  }, [dispatch]);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    isGeneratingRef.current = false;
    setGenerating(false);
  }, []);

  return { regenerate, cancel, generating };
}
