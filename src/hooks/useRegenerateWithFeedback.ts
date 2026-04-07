/**
 * Hook for regenerating the current sprite sheet with structured feedback.
 * Reuses the same grid layout, sends the original grid as reference image,
 * and injects feedback annotations into the prompt.
 */

import { useCallback, useRef, useState } from 'react';
import { useAppContext } from '../context/AppContext';
import type { GridLink } from '../context/AppContext';
import type { ContentPreset } from '../types/api';
import type { FeedbackState } from '../types/feedback';
import { runGeneratePipeline } from './useGenericWorkflow';
import { buildGenerationRequest } from '../lib/generateRequest';
import { fetchContentPreset } from '../lib/promptForType';

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

  const regenerate = useCallback(async (opts: RegenerateOptions) => {
    if (isGeneratingRef.current) return;
    isGeneratingRef.current = true;
    setGenerating(true);

    const abort = new AbortController();
    abortRef.current = abort;

    try {
      const { gridLink, imageSize, feedbackState } = opts;
      const currentState = state;
      const { spriteType, historyId, filledGridImage, sourceContentPresetId: contentPresetId, sourceGroupId: groupId } = currentState;

      if (!filledGridImage) {
        dispatch({ type: 'SET_STATUS', message: 'No grid image to use as reference', statusType: 'error' });
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

      // 2. Fetch content preset
      let contentPreset: ContentPreset;
      if (contentPresetId) {
        contentPreset = await fetchContentPreset(spriteType, contentPresetId);
      } else {
        // Fallback: build minimal preset from state
        const { WORKFLOW_CONFIGS } = await import('./useGenericWorkflow');
        const content = WORKFLOW_CONFIGS[spriteType].getContent(currentState);
        contentPreset = { name: content.name, description: content.description };
      }

      // 3. Determine generation version
      let parentVersion = 1;
      if (historyId) {
        try {
          const resp = await fetch(`/api/history/${historyId}`, { signal: abort.signal });
          if (resp.ok) {
            const data = await resp.json();
            parentVersion = data.generationVersion || 1;
          }
        } catch { /* ignore — default to 1 */ }
      }

      // 4. Build pipeline params with feedback
      const pipelineParams = buildGenerationRequest({
        spriteType,
        contentPreset,
        gridLink,
        model: currentState.model,
        imageSize,
        thinkingLevel: currentState.thinkingLevel,
        isSubsequentGrid: true, // always has reference image
        referenceImage: { data: filledGridImage, mimeType: currentState.filledGridMimeType || 'image/png' },
        feedbackState,
        historyExtras: {
          groupId: groupId ?? undefined,
          contentPresetId: contentPresetId ?? undefined,
          parentHistoryId: historyId,
          generationVersion: parentVersion + 1,
        },
        sourceContext: {
          groupId: groupId ?? null,
          contentPresetId: contentPresetId ?? null,
        },
      });

      // 5. Run pipeline
      await runGeneratePipeline(pipelineParams, dispatch, abort.signal);

    } finally {
      isGeneratingRef.current = false;
      setGenerating(false);
      abortRef.current = null;
    }
  }, [state, dispatch]);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    isGeneratingRef.current = false;
    setGenerating(false);
  }, []);

  return { regenerate, cancel, generating };
}
