/**
 * Shared logic for loading a saved generation into app state.
 * Used by both App.tsx (session restore) and GalleryPage.tsx (gallery load).
 *
 * Grid layout comes from the stored grid_snapshot (snapshotted at generation time).
 * Sprites come from the DB sprites table. No re-extraction, no fallback logic.
 */

import type { Dispatch } from 'react';
import type { ExtractedSprite } from './spriteExtractor';
import type { SpriteType, Action, AppState, RestoreSessionPayload } from '../context/AppContext';
import type { HistoryResponse } from '../types/api';

interface LoadOptions {
  /** History entry ID */
  historyId: number;
}

/**
 * Load a generation's data into app state via a single RESTORE_SESSION dispatch.
 */
export async function loadGenerationIntoState(
  data: HistoryResponse,
  dispatch: Dispatch<Action>,
  opts: LoadOptions,
): Promise<void> {
  const spriteType = (data.spriteType || 'character') as SpriteType;

  // 1. Grid layout from snapshot (the authoritative source)
  const snapshot = data.gridSnapshot;
  const gridCols = snapshot?.cols ?? (data.gridSize ? parseInt(data.gridSize.split('x')[0], 10) || 6 : 6);
  const gridRows = snapshot?.rows ?? (data.gridSize ? parseInt(data.gridSize.split('x')[1], 10) || 6 : 6);
  const cellLabels = snapshot?.cellLabels ?? [];
  const cellGroups = snapshot?.cellGroups ?? [];
  const aspectRatio = snapshot?.aspectRatio ?? data.aspectRatio ?? '1:1';

  // 2. Build config state based on sprite type
  let character: AppState['character'] | undefined;
  let building: AppState['building'] | undefined;
  let terrain: AppState['terrain'] | undefined;
  let background: AppState['background'] | undefined;

  if (spriteType === 'building') {
    building = {
      name: data.content?.name || '',
      description: data.content?.description || '',
      details: '',
      colorNotes: '',
      styleNotes: '',
      overallGuidance: '',
      groupGuidance: {},
      cellGuidance: {},
      gridSize: data.gridSize as AppState['building']['gridSize'],
      cellLabels,
    };
  } else if (spriteType === 'terrain') {
    terrain = {
      name: data.content?.name || '',
      description: data.content?.description || '',
      colorNotes: '',
      styleNotes: '',
      overallGuidance: '',
      groupGuidance: {},
      cellGuidance: {},
      gridSize: data.gridSize as AppState['terrain']['gridSize'],
      cellLabels,
    };
  } else if (spriteType === 'background') {
    background = {
      name: data.content?.name || '',
      description: data.content?.description || '',
      colorNotes: '',
      styleNotes: '',
      overallGuidance: '',
      groupGuidance: {},
      cellGuidance: {},
      bgMode: data.gridSize?.startsWith('1x') ? 'parallax' : 'scene',
      gridSize: data.gridSize as AppState['background']['gridSize'],
      cellLabels,
    };
  } else {
    character = {
      name: data.content?.name || '',
      description: data.content?.description || '',
      equipment: data.content?.equipment || '',
      colorNotes: data.content?.colorNotes || '',
      styleNotes: data.content?.styleNotes || '',
      overallGuidance: '',
      groupGuidance: {},
      cellGuidance: {},
    };
  }

  // 3. Sprites from DB — no re-extraction
  const sprites: ExtractedSprite[] = (data.sprites || []).map(s => ({
    ...s,
    width: s.width ?? 0,
    height: s.height ?? 0,
  }));

  // 4. Dispatch single atomic state update
  const payload: RestoreSessionPayload = {
    spriteType,
    ...(character ? { character } : {}),
    ...(building ? { building } : {}),
    ...(terrain ? { terrain } : {}),
    ...(background ? { background } : {}),
    activeGridConfig: { cols: gridCols, rows: gridRows, cellLabels, cellGroups, aspectRatio },
    filledGridImage: data.filledGridImage || null,
    filledGridMimeType: data.filledGridMimeType || 'image/png',
    geminiText: data.geminiText || '',
    sprites,
    historyId: opts.historyId,
    sourceGroupId: data.groupId || null,
    sourceContentPresetId: data.contentPresetId || null,
    model: data.model || undefined,
    imageSize: data.imageSize || undefined,
    thinkingLevel: data.thinkingLevel || undefined,
    feedbackJson: data.feedbackJson || null,
    parentHistoryId: data.parentHistoryId || null,
    generationVersion: data.generationVersion || 1,
  };

  dispatch({ type: 'RESTORE_SESSION', payload });
}
