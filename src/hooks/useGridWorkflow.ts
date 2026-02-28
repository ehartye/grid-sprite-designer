/**
 * Main workflow hook for the grid sprite designer.
 * Orchestrates: generate template → call Gemini → extract sprites.
 */

import { useCallback, useRef } from 'react';
import { useAppContext } from '../context/AppContext';
import { generateTemplate, CONFIG_2K, CONFIG_4K } from '../lib/templateGenerator';
import { extractSprites } from '../lib/spriteExtractor';
import { buildGridFillPrompt } from '../lib/promptBuilder';
import { generateGrid } from '../api/geminiClient';

export function useGridWorkflow() {
  const { state, dispatch } = useAppContext();
  const abortRef = useRef<AbortController | null>(null);
  const isGeneratingRef = useRef(false);

  const cancelGeneration = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    isGeneratingRef.current = false;
    dispatch({ type: 'RESET' });
  }, [dispatch]);

  const generate = useCallback(async () => {
    if (!state.character.name.trim() || !state.character.description.trim()) {
      dispatch({ type: 'SET_STATUS', message: 'Please enter a character name and description.', statusType: 'warning' });
      return;
    }

    if (isGeneratingRef.current) return;
    isGeneratingRef.current = true;

    const abort = new AbortController();
    abortRef.current = abort;

    try {
      // 1. Generate template grid
      const templateConfig = state.imageSize === '4K' ? CONFIG_4K : CONFIG_2K;
      const template = generateTemplate(templateConfig);

      dispatch({ type: 'GENERATE_START', templateImage: template.base64 });

      // 2. Build prompt
      const prompt = buildGridFillPrompt(state.character);

      // 3. Call Gemini API
      const result = await generateGrid(
        state.model,
        prompt,
        { data: template.base64, mimeType: 'image/png' },
        state.imageSize,
        abort.signal,
      );

      if (abort.signal.aborted) return;

      if (!result.image) {
        dispatch({ type: 'GENERATE_ERROR', error: 'Gemini returned no image. Try again.' });
        return;
      }

      if (abort.signal.aborted) return;

      dispatch({
        type: 'GENERATE_COMPLETE',
        filledGridImage: result.image.data,
        filledGridMimeType: result.image.mimeType,
        geminiText: result.text || '',
      });

      // 4. Extract sprites from the filled grid
      const sprites = await extractSprites(
        result.image.data,
        result.image.mimeType,
        {
          headerH: templateConfig.headerH,
          border: templateConfig.border,
          templateCellW: templateConfig.cellW,
          templateCellH: templateConfig.cellH,
        },
      );

      if (abort.signal.aborted) return;

      dispatch({ type: 'EXTRACTION_COMPLETE', sprites });

      // 5. Save to history + archive to disk
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
            characterName: state.character.name,
            characterDescription: state.character.description,
            model: state.model,
            prompt,
            filledGridImage: result.image.data,
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
        console.warn('Failed to save to history');
      }

      // Archive to output/ folder
      try {
        await fetch('/api/archive', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            characterName: state.character.name,
            filledGridImage: result.image.data,
            filledGridMimeType: result.image.mimeType,
            sprites: spritePayload,
          }),
          signal: abort.signal,
        });
      } catch (e: any) {
        if (e?.name === 'AbortError') return;
        console.warn('Failed to archive to disk');
      }

    } catch (err: any) {
      if (err?.name === 'AbortError') return;
      dispatch({ type: 'GENERATE_ERROR', error: err.message || 'Generation failed' });
    } finally {
      isGeneratingRef.current = false;
      abortRef.current = null;
    }
  }, [state.character, state.model, state.imageSize, dispatch]);

  const reExtract = useCallback(async (overrides?: { aaInset?: number }) => {
    if (!state.filledGridImage) return;

    dispatch({ type: 'SET_STATUS', message: 'Re-extracting sprites...', statusType: 'info' });

    const templateConfig = state.imageSize === '4K' ? CONFIG_4K : CONFIG_2K;
    const sprites = await extractSprites(
      state.filledGridImage,
      state.filledGridMimeType,
      {
        headerH: templateConfig.headerH,
        border: templateConfig.border,
        templateCellW: templateConfig.cellW,
        templateCellH: templateConfig.cellH,
        ...overrides,
      },
    );

    dispatch({ type: 'EXTRACTION_COMPLETE', sprites });
  }, [state.filledGridImage, state.filledGridMimeType, state.imageSize, dispatch]);

  const reset = useCallback(() => {
    dispatch({ type: 'RESET' });
  }, [dispatch]);

  const setStep = useCallback((step: 'configure' | 'generating' | 'review' | 'preview') => {
    dispatch({ type: 'SET_STEP', step });
  }, [dispatch]);

  return { state, dispatch, generate, reExtract, reset, cancelGeneration, setStep };
}
