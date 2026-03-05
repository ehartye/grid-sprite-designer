/**
 * Grid layout configuration for different sprite sheet types.
 * Defines grid dimensions, cell sizes, and template parameters
 * for both character (6x6) and building (3x3, 2x3, 2x2) sprite sheets.
 */

import { COLS, ROWS, TOTAL_CELLS, CELL_LABELS } from './poses';
import type { GridPreset } from '../context/AppContext';

export interface TemplateParams {
  cellW: number;
  cellH: number;
  headerH: number;
  border: number;
  fontSize: number;
}

export interface GridConfig {
  id: string;
  label: string;
  cols: number;
  rows: number;
  totalCells: number;
  cellLabels: string[];
  aspectRatio?: string;
  tileShape?: 'square' | 'diamond';
  templates: {
    '2K': TemplateParams;
    '4K': TemplateParams;
  };
}

/** Character 6x6 grid — wraps existing constants from poses.ts */
export const CHARACTER_GRID: GridConfig = {
  id: 'character-6x6',
  label: 'Character 6\u00d76',
  cols: COLS,
  rows: ROWS,
  totalCells: TOTAL_CELLS,
  cellLabels: CELL_LABELS,
  templates: {
    '2K': { cellW: 339, cellH: 339, headerH: 14, border: 2, fontSize: 9 },
    '4K': { cellW: 678, cellH: 678, headerH: 22, border: 4, fontSize: 14 },
  },
};

/**
 * Building grid definitions.
 * Cell labels are empty by default — populated at runtime from user state.
 *
 * Cell size math (fills full 2048/4096 canvas):
 *   3x3: 680×680 (2K), 1360×1360 (4K) — square cells
 *   2x3: 1021×680 (2K), 2042×1360 (4K) — wide rectangular cells
 *   2x2: 1021×1021 (2K), 2042×2042 (4K) — square cells
 */
export const BUILDING_GRIDS: Record<string, GridConfig> = {
  '3x3': {
    id: 'building-3x3',
    label: 'Building 3\u00d73',
    cols: 3,
    rows: 3,
    totalCells: 9,
    cellLabels: [],
    templates: {
      '2K': { cellW: 680, cellH: 680, headerH: 22, border: 2, fontSize: 14 },
      '4K': { cellW: 1360, cellH: 1360, headerH: 36, border: 4, fontSize: 22 },
    },
  },
  '2x3': {
    id: 'building-2x3',
    label: 'Building 2\u00d73',
    cols: 2,
    rows: 3,
    totalCells: 6,
    cellLabels: [],
    templates: {
      '2K': { cellW: 1021, cellH: 680, headerH: 22, border: 2, fontSize: 14 },
      '4K': { cellW: 2042, cellH: 1360, headerH: 36, border: 4, fontSize: 22 },
    },
  },
  '2x2': {
    id: 'building-2x2',
    label: 'Building 2\u00d72',
    cols: 2,
    rows: 2,
    totalCells: 4,
    cellLabels: [],
    templates: {
      '2K': { cellW: 1021, cellH: 1021, headerH: 28, border: 2, fontSize: 18 },
      '4K': { cellW: 2042, cellH: 2042, headerH: 44, border: 4, fontSize: 28 },
    },
  },
};

export type BuildingGridSize = '3x3' | '2x3' | '2x2';

/**
 * Get a GridConfig with runtime cell labels applied.
 * For characters, returns CHARACTER_GRID (labels are static).
 * For buildings, clones the base config and applies the provided labels.
 */
export function getBuildingGridConfig(
  gridSize: BuildingGridSize,
  cellLabels: string[],
): GridConfig {
  const base = BUILDING_GRIDS[gridSize];
  return { ...base, cellLabels: cellLabels.slice(0, base.totalCells) };
}

// ── Terrain grids ──────────────────────────────────────────────────────────

/**
 * Terrain grid definitions — square cells for tileable ground tiles.
 * Cell labels populated at runtime from user state.
 *
 * Cell size math (fills full 2048/4096 canvas):
 *   3x3: 680×680 (2K), 1360×1360 (4K) — same as building 3x3
 *   4x4: 509×509 (2K), 1018×1018 (4K)
 *   5x5: 406×406 (2K), 812×812 (4K)
 */
export const TERRAIN_GRIDS: Record<string, GridConfig> = {
  '3x3': {
    id: 'terrain-3x3',
    label: 'Terrain 3\u00d73',
    cols: 3, rows: 3, totalCells: 9, cellLabels: [],
    templates: {
      '2K': { cellW: 680, cellH: 680, headerH: 22, border: 2, fontSize: 14 },
      '4K': { cellW: 1360, cellH: 1360, headerH: 36, border: 4, fontSize: 22 },
    },
  },
  '4x4': {
    id: 'terrain-4x4',
    label: 'Terrain 4\u00d74',
    cols: 4, rows: 4, totalCells: 16, cellLabels: [],
    templates: {
      '2K': { cellW: 509, cellH: 509, headerH: 18, border: 2, fontSize: 11 },
      '4K': { cellW: 1018, cellH: 1018, headerH: 30, border: 4, fontSize: 18 },
    },
  },
  '5x5': {
    id: 'terrain-5x5',
    label: 'Terrain 5\u00d75',
    cols: 5, rows: 5, totalCells: 25, cellLabels: [],
    templates: {
      '2K': { cellW: 406, cellH: 406, headerH: 16, border: 2, fontSize: 10 },
      '4K': { cellW: 812, cellH: 812, headerH: 26, border: 4, fontSize: 16 },
    },
  },
};

export type TerrainGridSize = '3x3' | '4x4' | '5x5';

// ── Background grids ───────────────────────────────────────────────────────

/**
 * Background grid definitions.
 *
 * Parallax mode: 1-column wide rectangular cells stacked vertically.
 *   1x3: 3 layers, 1x4: 4 layers, 1x5: 5 layers
 *   Cells are ~3:1 wide (full canvas width, height divided by rows).
 *
 * Scene mode: square/slightly-wide cells for full scene variants.
 *   2x2: 4 scenes, 3x2: 6 scenes, 3x3: 9 scenes
 */
export const BACKGROUND_GRIDS: Record<string, GridConfig> = {
  // Parallax layers — wide horizontal strips
  '1x3': {
    id: 'bg-parallax-1x3',
    label: 'Parallax 1\u00d73',
    cols: 1, rows: 3, totalCells: 3, cellLabels: [],
    templates: {
      '2K': { cellW: 2044, cellH: 680, headerH: 22, border: 2, fontSize: 14 },
      '4K': { cellW: 4088, cellH: 1360, headerH: 36, border: 4, fontSize: 22 },
    },
  },
  '1x4': {
    id: 'bg-parallax-1x4',
    label: 'Parallax 1\u00d74',
    cols: 1, rows: 4, totalCells: 4, cellLabels: [],
    templates: {
      '2K': { cellW: 2044, cellH: 509, headerH: 18, border: 2, fontSize: 11 },
      '4K': { cellW: 4088, cellH: 1018, headerH: 30, border: 4, fontSize: 18 },
    },
  },
  '1x5': {
    id: 'bg-parallax-1x5',
    label: 'Parallax 1\u00d75',
    cols: 1, rows: 5, totalCells: 5, cellLabels: [],
    templates: {
      '2K': { cellW: 2044, cellH: 406, headerH: 16, border: 2, fontSize: 10 },
      '4K': { cellW: 4088, cellH: 812, headerH: 26, border: 4, fontSize: 16 },
    },
  },
  // Scene variations — square cells
  '2x2': {
    id: 'bg-scene-2x2',
    label: 'Scene 2\u00d72',
    cols: 2, rows: 2, totalCells: 4, cellLabels: [],
    templates: {
      '2K': { cellW: 1021, cellH: 1021, headerH: 28, border: 2, fontSize: 18 },
      '4K': { cellW: 2042, cellH: 2042, headerH: 44, border: 4, fontSize: 28 },
    },
  },
  '3x2': {
    id: 'bg-scene-3x2',
    label: 'Scene 3\u00d72',
    cols: 3, rows: 2, totalCells: 6, cellLabels: [],
    templates: {
      '2K': { cellW: 680, cellH: 1021, headerH: 22, border: 2, fontSize: 14 },
      '4K': { cellW: 1360, cellH: 2042, headerH: 36, border: 4, fontSize: 22 },
    },
  },
  '3x3-scene': {
    id: 'bg-scene-3x3',
    label: 'Scene 3\u00d73',
    cols: 3, rows: 3, totalCells: 9, cellLabels: [],
    templates: {
      '2K': { cellW: 680, cellH: 680, headerH: 22, border: 2, fontSize: 14 },
      '4K': { cellW: 1360, cellH: 1360, headerH: 36, border: 4, fontSize: 22 },
    },
  },
};

export type BackgroundGridSize = '1x3' | '1x4' | '1x5' | '2x2' | '3x2' | '3x3-scene';
export type BackgroundMode = 'parallax' | 'scene';

export function getTerrainGridConfig(
  gridSize: TerrainGridSize,
  cellLabels: string[],
): GridConfig {
  const base = TERRAIN_GRIDS[gridSize];
  return { ...base, cellLabels: cellLabels.slice(0, base.totalCells) };
}

export function getBackgroundGridConfig(
  gridSize: BackgroundGridSize,
  cellLabels: string[],
): GridConfig {
  const base = BACKGROUND_GRIDS[gridSize];
  return { ...base, cellLabels: cellLabels.slice(0, base.totalCells) };
}

// ── Grid preset conversion ─────────────────────────────────────────────────

function getTemplateParams(gridSize: string, spriteType: string, aspectRatio: string = '1:1'): GridConfig['templates'] {
  if (spriteType === 'character' && gridSize === '6x6') return CHARACTER_GRID.templates;
  if (spriteType === 'building' && BUILDING_GRIDS[gridSize]) return BUILDING_GRIDS[gridSize].templates;
  if (spriteType === 'terrain' && TERRAIN_GRIDS[gridSize]) return TERRAIN_GRIDS[gridSize].templates;
  if (spriteType === 'background' && BACKGROUND_GRIDS[gridSize]) return BACKGROUND_GRIDS[gridSize].templates;

  // Fallback: calculate proportional cell sizes for unknown grid sizes
  const [colStr, rowStr] = gridSize.split('x');
  const cols = parseInt(colStr, 10) || 3;
  const rows = parseInt(rowStr, 10) || 3;

  // Parse aspect ratio for canvas size calculation
  const [arW, arH] = aspectRatio.split(':').map(Number);
  const arFactor = (arW && arH) ? arW / arH : 1;

  // Base sizes: 2048 for 2K, 4096 for 4K
  const base2K = 2048;
  const base4K = 4096;

  const canvasW2K = arFactor >= 1 ? base2K : Math.round(base2K * arFactor);
  const canvasH2K = arFactor >= 1 ? Math.round(base2K / arFactor) : base2K;
  const canvasW4K = arFactor >= 1 ? base4K : Math.round(base4K * arFactor);
  const canvasH4K = arFactor >= 1 ? Math.round(base4K / arFactor) : base4K;

  // Subtract border space: (cols+1)*2 for 2K, (cols+1)*4 for 4K
  const cellW2K = Math.floor((canvasW2K - (cols + 1) * 2) / cols);
  const cellH2K = Math.floor((canvasH2K - (rows + 1) * 2) / rows);
  const cellW4K = Math.floor((canvasW4K - (cols + 1) * 4) / cols);
  const cellH4K = Math.floor((canvasH4K - (rows + 1) * 4) / rows);

  return {
    '2K': { cellW: cellW2K, cellH: cellH2K, headerH: 22, border: 2, fontSize: 14 },
    '4K': { cellW: cellW4K, cellH: cellH4K, headerH: 36, border: 4, fontSize: 22 },
  };
}

export function gridPresetToConfig(preset: GridPreset): GridConfig;
export function gridPresetToConfig(preset: {
  id?: number;
  gridPresetId?: number;
  gridName?: string;
  name?: string;
  cols: number;
  rows: number;
  gridSize: string;
  cellLabels: string[];
  spriteType?: string;
}, spriteType?: string): GridConfig;
export function gridPresetToConfig(preset: any, spriteType?: string): GridConfig {
  const resolvedSpriteType = spriteType || preset.spriteType || 'character';
  const label = preset.name || preset.gridName || `Grid ${preset.gridSize}`;
  const id = preset.gridPresetId || preset.id;
  const aspectRatio = preset.aspectRatio || '1:1';
  const tileShape = preset.tileShape || 'square';
  return {
    id: `preset-${id}`,
    label,
    cols: preset.cols,
    rows: preset.rows,
    totalCells: preset.cols * preset.rows,
    cellLabels: preset.cellLabels,
    aspectRatio,
    tileShape,
    templates: getTemplateParams(preset.gridSize, resolvedSpriteType, aspectRatio),
  };
}
