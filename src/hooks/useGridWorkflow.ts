/**
 * Main workflow hook for the grid sprite designer.
 * Orchestrates: generate template → call Gemini → extract sprites.
 */

import { useCallback } from 'react';
import { useAppContext } from '../context/AppContext';
import { generateTemplate, CONFIG_2K, CONFIG_4K } from '../lib/templateGenerator';
import { extractSprites } from '../lib/spriteExtractor';
import { buildGridFillPrompt } from '../lib/promptBuilder';
import { generateGrid } from '../api/geminiClient';

export function useGridWorkflow() {
  const { state, dispatch } = useAppContext();

  const generate = useCallback(async () => {
    if (!state.character.name.trim() || !state.character.description.trim()) {
      dispatch({ type: 'SET_STATUS', message: 'Please enter a character name and description.', statusType: 'warning' });
      return;
    }

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
      );

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

      // 4. Extract sprites from the filled grid
      const sprites = await extractSprites(
        result.image.data,
        result.image.mimeType,
        {
          headerH: templateConfig.headerH,
          border: templateConfig.border,
          chromaTolerance: state.chromaTolerance,
        },
      );

      dispatch({ type: 'EXTRACTION_COMPLETE', sprites });

      // 5. Save to history
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
        });
        const histData = await histResp.json();
        dispatch({ type: 'SET_HISTORY_ID', id: histData.id });

        // Save extracted sprites
        await fetch(`/api/history/${histData.id}/sprites`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sprites: sprites.map(s => ({
              cellIndex: s.cellIndex,
              poseId: s.label.toLowerCase().replace(/\s+/g, '-'),
              poseName: s.label,
              imageData: s.imageData,
              mimeType: s.mimeType,
            })),
          }),
        });
      } catch {
        // History save is non-critical
        console.warn('Failed to save to history');
      }

    } catch (err: any) {
      dispatch({ type: 'GENERATE_ERROR', error: err.message || 'Generation failed' });
    }
  }, [state.character, state.model, state.imageSize, state.chromaTolerance, dispatch]);

  const reExtract = useCallback(async () => {
    if (!state.filledGridImage) return;

    dispatch({ type: 'SET_STATUS', message: 'Re-extracting sprites...', statusType: 'info' });

    const templateConfig = state.imageSize === '4K' ? CONFIG_4K : CONFIG_2K;
    const sprites = await extractSprites(
      state.filledGridImage,
      state.filledGridMimeType,
      {
        headerH: templateConfig.headerH,
        border: templateConfig.border,
        chromaTolerance: state.chromaTolerance,
      },
    );

    dispatch({ type: 'EXTRACTION_COMPLETE', sprites });
  }, [state.filledGridImage, state.filledGridMimeType, state.imageSize, state.chromaTolerance, dispatch]);

  const reset = useCallback(() => {
    dispatch({ type: 'RESET' });
  }, [dispatch]);

  const setStep = useCallback((step: 'configure' | 'generating' | 'review' | 'preview') => {
    dispatch({ type: 'SET_STEP', step });
  }, [dispatch]);

  return { state, dispatch, generate, reExtract, reset, setStep };
}
