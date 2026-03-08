/**
 * Shared logic for loading a saved generation into app state.
 * Used by both App.tsx (session restore) and GalleryPage.tsx (gallery load).
 */

import type { Dispatch } from 'react';
import { extractSprites } from './spriteExtractor';
import {
  getBuildingGridConfig,
  getTerrainGridConfig,
  getBackgroundGridConfig,
  type BuildingGridSize,
  type TerrainGridSize,
  type BackgroundGridSize,
} from './gridConfig';
import type { SpriteType, Action } from '../context/AppContext';
import type { HistoryResponse } from '../types/api';

interface LoadOptions {
  /** History entry ID */
  historyId: number;
  /** Saved editor settings for extraction overrides */
  editorSettings?: { aaInset?: number; posterizeBits?: number } | null;
}

/**
 * Load a generation's data into app state via dispatch calls.
 * Handles sprite-type branching, grid config inference, extraction, and state restoration.
 */
export async function loadGenerationIntoState(
  data: HistoryResponse,
  dispatch: Dispatch<Action>,
  opts: LoadOptions,
): Promise<void> {
  const spriteType = (data.spriteType || 'character') as SpriteType;
  const spriteLabels = data.sprites?.map(s => s.label) || [];

  // 1. Set sprite type
  if (spriteType !== 'character') {
    dispatch({ type: 'SET_SPRITE_TYPE', spriteType });
  }

  // 2. Populate config state based on sprite type
  if (spriteType === 'building' && data.gridSize) {
    dispatch({
      type: 'SET_BUILDING',
      building: {
        name: data.content?.name || '',
        description: data.content?.description || '',
        details: '',
        colorNotes: '',
        styleNotes: '',
        cellGuidance: '',
        gridSize: data.gridSize as BuildingGridSize,
        cellLabels: spriteLabels,
      },
    });
  } else if (spriteType === 'terrain' && data.gridSize) {
    dispatch({
      type: 'SET_TERRAIN',
      terrain: {
        name: data.content?.name || '',
        description: data.content?.description || '',
        colorNotes: '',
        styleNotes: '',
        tileGuidance: '',
        gridSize: data.gridSize as TerrainGridSize,
        cellLabels: spriteLabels,
      },
    });
  } else if (spriteType === 'background' && data.gridSize) {
    dispatch({
      type: 'SET_BACKGROUND',
      background: {
        name: data.content?.name || '',
        description: data.content?.description || '',
        colorNotes: '',
        styleNotes: '',
        layerGuidance: '',
        bgMode: data.gridSize.startsWith('1x') ? 'parallax' : 'scene',
        gridSize: data.gridSize as BackgroundGridSize,
        cellLabels: spriteLabels,
      },
    });
  } else if (data.content) {
    dispatch({
      type: 'SET_CHARACTER',
      character: {
        name: data.content.name || '',
        description: data.content.description || '',
        equipment: data.content.equipment || '',
        colorNotes: data.content.colorNotes || '',
        styleNotes: data.content.styleNotes || '',
        rowGuidance: data.content.rowGuidance || '',
      },
    });
  }

  // 3. Infer grid dimensions
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

  // 4. Set active grid config
  dispatch({
    type: 'SET_ACTIVE_GRID_CONFIG',
    gridConfig: { cols: gridCols, rows: gridRows, cellLabels: spriteLabels, aspectRatio: data.aspectRatio },
  });

  // 5. Load filled grid and extract sprites
  const mimeType = data.filledGridMimeType || 'image/png';
  if (data.filledGridImage) {
    dispatch({
      type: 'GENERATE_COMPLETE',
      filledGridImage: data.filledGridImage,
      filledGridMimeType: mimeType,
      geminiText: data.geminiText || '',
    });

    // Build extraction config
    let extractionConfig: Parameters<typeof extractSprites>[2] = {
      ...(opts.editorSettings?.aaInset != null ? { aaInset: opts.editorSettings.aaInset } : {}),
      ...(opts.editorSettings?.posterizeBits != null ? { posterizeBits: opts.editorSettings.posterizeBits } : {}),
    };

    if (spriteType === 'building' && data.gridSize) {
      const gridConfig = getBuildingGridConfig(data.gridSize as BuildingGridSize, spriteLabels);
      extractionConfig.gridOverride = {
        cols: gridConfig.cols, rows: gridConfig.rows,
        totalCells: gridConfig.totalCells, cellLabels: gridConfig.cellLabels,
      };
    } else if (spriteType === 'terrain' && data.gridSize) {
      const gridConfig = getTerrainGridConfig(data.gridSize as TerrainGridSize, spriteLabels);
      extractionConfig.gridOverride = {
        cols: gridConfig.cols, rows: gridConfig.rows,
        totalCells: gridConfig.totalCells, cellLabels: gridConfig.cellLabels,
      };
    } else if (spriteType === 'background' && data.gridSize) {
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

    const sprites = await extractSprites(data.filledGridImage, mimeType, extractionConfig);
    dispatch({ type: 'EXTRACTION_COMPLETE', sprites });
  } else if (data.sprites && data.sprites.length > 0) {
    // Sprites loaded from history may lack width/height; default to 0
    const restored = data.sprites.map(s => ({
      ...s,
      width: s.width ?? 0,
      height: s.height ?? 0,
    }));
    dispatch({ type: 'EXTRACTION_COMPLETE', sprites: restored });
  }

  // 6. Set history and source context
  dispatch({ type: 'SET_HISTORY_ID', id: opts.historyId });
  dispatch({
    type: 'SET_SOURCE_CONTEXT',
    groupId: data.groupId || null,
    contentPresetId: data.contentPresetId || null,
  });
}
