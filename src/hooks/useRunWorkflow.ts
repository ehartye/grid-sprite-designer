/**
 * Multi-grid generation orchestration hook.
 * Sequences through selected grid links in a run, generating each grid
 * with reference sheet continuity for consistent sprite visuals.
 *
 * Delegates the per-grid generate → extract → save pipeline to
 * runGeneratePipeline from useGenericWorkflow.
 */

import { useCallback, useEffect, useRef } from 'react';
import { useAppContext } from '../context/AppContext';
import { gridPresetToConfig } from '../lib/gridConfig';
import { fetchContentPreset, buildPromptForType } from '../lib/promptForType';
import { runGeneratePipeline } from './useGenericWorkflow';

export function useRunWorkflow() {
  const { state, dispatch } = useAppContext();
  const abortRef = useRef<AbortController | null>(null);
  const isGeneratingRef = useRef(false);

  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => () => { abortRef.current?.abort(); }, []);

  const cancelRun = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    isGeneratingRef.current = false;
    dispatch({ type: 'END_RUN' });
  }, [dispatch]);

  const generateCurrentGrid = useCallback(async () => {
    const currentState = stateRef.current;
    const run = currentState.run;
    if (!run) return;
    if (isGeneratingRef.current) return;

    const gridLink = run.selectedGridLinks[run.currentGridIndex];
    if (!gridLink) {
      dispatch({ type: 'END_RUN' });
      return;
    }

    isGeneratingRef.current = true;
    const abort = new AbortController();
    abortRef.current = abort;

    try {
      const contentPreset = await fetchContentPreset(run.spriteType, run.contentPresetId!);
      if (abort.signal.aborted) return;

      const gridConfig = gridPresetToConfig(gridLink, run.spriteType);
      const aspectRatio = gridConfig.aspectRatio || '1:1';
      const isSubsequent = run.currentGridIndex > 0 && run.referenceSheet !== null;
      const prompt = buildPromptForType(run.spriteType, contentPreset, gridLink, gridConfig, isSubsequent);

      const refImage = isSubsequent && run.referenceSheet
        ? { data: run.referenceSheet, mimeType: 'image/png' }
        : undefined;

      const result = await runGeneratePipeline({
        gridConfig,
        prompt,
        model: currentState.model,
        imageSize: run.imageSize,
        aspectRatio,
        spriteType: run.spriteType,
        contentName: contentPreset.name,
        contentDescription: contentPreset.description,
        cellGroups: gridLink.cellGroups,
        referenceImage: refImage,
        historyExtras: {
          groupId: run.groupId,
          contentPresetId: run.contentPresetId,
        },
        sourceContext: {
          groupId: run.groupId,
          contentPresetId: run.contentPresetId,
        },
      }, dispatch, abort.signal);

      // Store as reference sheet for subsequent grids in the run
      if (result?.image) {
        dispatch({ type: 'COMPLETE_GRID', payload: { filledGridImage: result.image.data } });
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return;
      const message = err instanceof Error ? err.message : 'Generation failed';
      dispatch({ type: 'GENERATE_ERROR', error: message });
    } finally {
      isGeneratingRef.current = false;
      abortRef.current = null;
    }
  }, [dispatch]);

  const proceedToNextGrid = useCallback(() => {
    if (isGeneratingRef.current) {
      dispatch({ type: 'SET_STATUS', message: 'Cannot proceed while generation is in progress', statusType: 'warning' });
      return;
    }
    dispatch({ type: 'NEXT_GRID' });
  }, [dispatch]);

  const skipCurrentGrid = useCallback(() => {
    if (isGeneratingRef.current) {
      dispatch({ type: 'SET_STATUS', message: 'Cannot skip while generation is in progress — cancel first', statusType: 'warning' });
      return;
    }
    dispatch({ type: 'NEXT_GRID' });
  }, [dispatch]);

  return {
    generateCurrentGrid,
    proceedToNextGrid,
    skipCurrentGrid,
    cancelRun,
    run: state.run,
    isRunActive: state.run !== null,
  };
}
