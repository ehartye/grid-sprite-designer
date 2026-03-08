/**
 * Shared logic for loading a saved generation into app state.
 * Used by both App.tsx (session restore) and GalleryPage.tsx (gallery load).
 *
 * Computes all derived state (config, grid dimensions, sprites) first,
 * then dispatches a single RESTORE_SESSION action for atomic state update.
 */

import type { Dispatch } from 'react';
import { extractSprites, type ExtractedSprite } from './spriteExtractor';
import {
  getBuildingGridConfig,
  getTerrainGridConfig,
  getBackgroundGridConfig,
  BUILDING_GRIDS,
  TERRAIN_GRIDS,
  BACKGROUND_GRIDS,
  type BuildingGridSize,
  type TerrainGridSize,
  type BackgroundGridSize,
} from './gridConfig';
import type { SpriteType, Action, AppState, RestoreSessionPayload } from '../context/AppContext';
import type { HistoryResponse } from '../types/api';

interface LoadOptions {
  /** History entry ID */
  historyId: number;
  /** Saved editor settings for extraction overrides */
  editorSettings?: { aaInset?: number; posterizeBits?: number } | null;
}

/**
 * Load a generation's data into app state via a single RESTORE_SESSION dispatch.
 * Handles sprite-type branching, grid config inference, extraction, and state restoration.
 */
export async function loadGenerationIntoState(
  data: HistoryResponse,
  dispatch: Dispatch<Action>,
  opts: LoadOptions,
): Promise<void> {
  const spriteType = (data.spriteType || 'character') as SpriteType;
  const spriteLabels = data.sprites?.map(s => s.label) || [];

  // 1. Build config state based on sprite type
  let character: AppState['character'] | undefined;
  let building: AppState['building'] | undefined;
  let terrain: AppState['terrain'] | undefined;
  let background: AppState['background'] | undefined;

  if (spriteType === 'building' && data.gridSize) {
    if (!(data.gridSize in BUILDING_GRIDS)) {
      console.warn(`Invalid building gridSize "${data.gridSize}", skipping grid override`);
    } else {
      building = {
        name: data.content?.name || '',
        description: data.content?.description || '',
        details: '',
        colorNotes: '',
        styleNotes: '',
        cellGuidance: '',
        gridSize: data.gridSize as BuildingGridSize,
        cellLabels: spriteLabels,
      };
    }
  } else if (spriteType === 'terrain' && data.gridSize) {
    if (!(data.gridSize in TERRAIN_GRIDS)) {
      console.warn(`Invalid terrain gridSize "${data.gridSize}", skipping grid override`);
    } else {
      terrain = {
        name: data.content?.name || '',
        description: data.content?.description || '',
        colorNotes: '',
        styleNotes: '',
        tileGuidance: '',
        gridSize: data.gridSize as TerrainGridSize,
        cellLabels: spriteLabels,
      };
    }
  } else if (spriteType === 'background' && data.gridSize) {
    if (!(data.gridSize in BACKGROUND_GRIDS)) {
      console.warn(`Invalid background gridSize "${data.gridSize}", skipping grid override`);
    } else {
      background = {
        name: data.content?.name || '',
        description: data.content?.description || '',
        colorNotes: '',
        styleNotes: '',
        layerGuidance: '',
        bgMode: data.gridSize.startsWith('1x') ? 'parallax' : 'scene',
        gridSize: data.gridSize as BackgroundGridSize,
        cellLabels: spriteLabels,
      };
    }
  } else if (data.content) {
    character = {
      name: data.content.name || '',
      description: data.content.description || '',
      equipment: data.content.equipment || '',
      colorNotes: data.content.colorNotes || '',
      styleNotes: data.content.styleNotes || '',
      rowGuidance: data.content.rowGuidance || '',
    };
  }

  // 2. Infer grid dimensions
  let gridCols: number;
  let gridRows: number;
  if (data.gridSize) {
    const [colStr, rowStr] = data.gridSize.split('x');
    gridCols = parseInt(colStr, 10) || 6;
    gridRows = parseInt(rowStr, 10) || 6;
  } else if (spriteLabels.length > 0 && spriteLabels.length !== 36) {
    const total = spriteLabels.length;
    gridCols = [8, 6, 5, 4, 3, 2, 1].find(c => total % c === 0 && total / c >= 1) || 6;
    gridRows = Math.ceil(total / gridCols);
  } else {
    gridCols = 6;
    gridRows = 6;
  }

  // 3. Extract sprites or restore from history
  const mimeType = data.filledGridMimeType || 'image/png';
  let sprites: ExtractedSprite[] = [];

  if (data.filledGridImage) {
    // Build extraction config
    let extractionConfig: Parameters<typeof extractSprites>[2] = {
      ...(opts.editorSettings?.aaInset != null ? { aaInset: opts.editorSettings.aaInset } : {}),
      ...(opts.editorSettings?.posterizeBits != null ? { posterizeBits: opts.editorSettings.posterizeBits } : {}),
    };

    if (spriteType === 'building' && data.gridSize && data.gridSize in BUILDING_GRIDS) {
      const gridConfig = getBuildingGridConfig(data.gridSize as BuildingGridSize, spriteLabels);
      extractionConfig.gridOverride = {
        cols: gridConfig.cols, rows: gridConfig.rows,
        totalCells: gridConfig.totalCells, cellLabels: gridConfig.cellLabels,
      };
    } else if (spriteType === 'terrain' && data.gridSize && data.gridSize in TERRAIN_GRIDS) {
      const gridConfig = getTerrainGridConfig(data.gridSize as TerrainGridSize, spriteLabels);
      extractionConfig.gridOverride = {
        cols: gridConfig.cols, rows: gridConfig.rows,
        totalCells: gridConfig.totalCells, cellLabels: gridConfig.cellLabels,
      };
    } else if (spriteType === 'background' && data.gridSize && data.gridSize in BACKGROUND_GRIDS) {
      const gridConfig = getBackgroundGridConfig(data.gridSize as BackgroundGridSize, spriteLabels);
      extractionConfig.gridOverride = {
        cols: gridConfig.cols, rows: gridConfig.rows,
        totalCells: gridConfig.totalCells, cellLabels: gridConfig.cellLabels,
      };
    } else if (gridCols !== 6 || gridRows !== 6) {
      extractionConfig.gridOverride = {
        cols: gridCols, rows: gridRows,
        totalCells: gridCols * gridRows, cellLabels: spriteLabels,
      };
    }

    sprites = await extractSprites(data.filledGridImage, mimeType, extractionConfig);
  } else if (data.sprites && data.sprites.length > 0) {
    // Sprites loaded from history may lack width/height; default to 0
    sprites = data.sprites.map(s => ({
      ...s,
      width: s.width ?? 0,
      height: s.height ?? 0,
    }));
  }

  // 4. Dispatch single atomic state update
  const payload: RestoreSessionPayload = {
    spriteType,
    ...(character ? { character } : {}),
    ...(building ? { building } : {}),
    ...(terrain ? { terrain } : {}),
    ...(background ? { background } : {}),
    activeGridConfig: { cols: gridCols, rows: gridRows, cellLabels: spriteLabels, aspectRatio: data.aspectRatio },
    filledGridImage: data.filledGridImage || null,
    filledGridMimeType: mimeType,
    geminiText: data.geminiText || '',
    sprites,
    historyId: opts.historyId,
    sourceGroupId: data.groupId || null,
    sourceContentPresetId: data.contentPresetId || null,
  };

  dispatch({ type: 'RESTORE_SESSION', payload });
}
