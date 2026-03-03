/**
 * Grid layout configuration for different sprite sheet types.
 * Defines grid dimensions, cell sizes, and template parameters
 * for both character (6x6) and building (3x3, 2x3, 2x2) sprite sheets.
 */

import { COLS, ROWS, TOTAL_CELLS, CELL_LABELS } from './poses';

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
