/**
 * Multi-grid generation orchestration hook.
 * Sequences through selected grid links in a run, generating each grid
 * with reference sheet continuity for consistent sprite visuals.
 */

import { useCallback, useRef } from 'react';
import { useAppContext } from '../context/AppContext';
import { generateTemplate } from '../lib/templateGenerator';
import { extractSprites } from '../lib/spriteExtractor';
import { generateGrid } from '../api/geminiClient';
import { gridPresetToConfig } from '../lib/gridConfig';
import { REFERENCE_PREFIX, fetchContentPreset, buildPromptForType } from '../lib/promptForType';

export function useRunWorkflow() {
  const { state, dispatch } = useAppContext();
  const abortRef = useRef<AbortController | null>(null);
  const isGeneratingRef = useRef(false);

  const cancelRun = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    isGeneratingRef.current = false;
    dispatch({ type: 'END_RUN' });
  }, [dispatch]);

  /**
   * Generate the current grid in the run sequence.
   * Called when entering 'run-active' step or after user proceeds from review.
   */
  const generateCurrentGrid = useCallback(async () => {
    const run = state.run;
    if (!run || !run.active) return;
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
      // Fetch content preset details
      const contentPreset = await fetchContentPreset(run.spriteType, run.contentPresetId!);
      if (abort.signal.aborted) return;

      // Build grid config from grid link
      const gridConfig = gridPresetToConfig(gridLink, run.spriteType);
      const templateParams = gridConfig.templates[run.imageSize];

      // Generate template
      const aspectRatio = gridConfig.aspectRatio || '1:1';
      const template = generateTemplate(templateParams, gridConfig, aspectRatio);
      dispatch({ type: 'GENERATE_START', templateImage: template.base64, gridConfig: { cols: gridConfig.cols, rows: gridConfig.rows, cellLabels: gridConfig.cellLabels, cellGroups: gridLink.cellGroups, aspectRatio: gridConfig.aspectRatio } });

      // Build prompt with layered guidance
      const isSubsequent = run.currentGridIndex > 0 && run.referenceSheet !== null;
      const prompt = buildPromptForType(run.spriteType, contentPreset, gridLink, gridConfig, isSubsequent);

      // Call Gemini API — include reference image for subsequent grids
      const refImage = isSubsequent && run.referenceSheet
        ? { data: run.referenceSheet, mimeType: 'image/png' }
        : undefined;

      const result = await generateGrid(
        state.model,
        prompt,
        { data: template.base64, mimeType: 'image/png' },
        run.imageSize,
        abort.signal,
        refImage,
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

      // Store as reference sheet (COMPLETE_GRID only stores the first one)
      dispatch({ type: 'COMPLETE_GRID', payload: { filledGridImage: result.image.data } });

      // Extract sprites
      const extractionConfig = {
        gridOverride: {
          cols: gridConfig.cols,
          rows: gridConfig.rows,
          totalCells: gridConfig.totalCells,
          cellLabels: gridConfig.cellLabels,
        },
      };

      const sprites = await extractSprites(
        result.image.data,
        result.image.mimeType,
        extractionConfig,
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
            spriteType: run.spriteType,
            gridSize: `${gridConfig.cols}x${gridConfig.rows}`,
            aspectRatio,
            contentPresetId: run.contentPresetId,
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
        console.warn('Failed to save run grid to history');
      }

      // Archive to output/
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
        console.warn('Failed to archive run grid to disk');
      }

    } catch (err: any) {
      if (err?.name === 'AbortError') return;
      dispatch({ type: 'GENERATE_ERROR', error: err.message || 'Generation failed' });
    } finally {
      isGeneratingRef.current = false;
      abortRef.current = null;
    }
  }, [state.run, state.model, dispatch]);

  /** Move to the next grid in the run (called from review screen) */
  const proceedToNextGrid = useCallback(() => {
    dispatch({ type: 'NEXT_GRID' });
  }, [dispatch]);

  /** Skip the current grid and move to the next */
  const skipCurrentGrid = useCallback(() => {
    dispatch({ type: 'NEXT_GRID' });
  }, [dispatch]);

  return {
    generateCurrentGrid,
    proceedToNextGrid,
    skipCurrentGrid,
    cancelRun,
    run: state.run,
    isRunActive: state.run?.active ?? false,
  };
}
