/**
 * Generate sprite grid template images on a canvas.
 * Each cell has a magenta (#FF00FF) chroma-key background,
 * a thin black header strip with the pose label in white text,
 * separated by thin black grid lines.
 *
 * Supports both 6x6 character grids (default) and variable-size
 * building grids (3x3, 2x3, 2x2) via optional GridConfig parameter.
 */

import { COLS, ROWS, CELL_LABELS } from './poses';
import type { GridConfig } from './gridConfig';

export interface TemplateConfig {
  cellW: number;         // content width per cell
  cellH: number;         // total cell height including header
  headerH: number;       // header strip height
  border: number;        // grid line thickness
  fontSize: number;      // label font size
}

export const CONFIG_2K: TemplateConfig = {
  cellW: 339,
  cellH: 339,
  headerH: 14,
  border: 2,
  fontSize: 9,
};

export const CONFIG_4K: TemplateConfig = {
  cellW: 678,
  cellH: 678,
  headerH: 22,
  border: 4,
  fontSize: 14,
};

const CHROMA_PINK = '#FF00FF';
const BLACK = '#000000';
const WHITE = '#FFFFFF';

/**
 * Generate the template grid as a canvas and return it along with
 * a base64-encoded PNG for sending to the API.
 *
 * When gridConfig is provided, uses its cols/rows/cellLabels instead
 * of the hardcoded 6x6 character constants. For non-square grids
 * (e.g. 2x3), the grid is centered on a square canvas.
 */
export function generateTemplate(
  config: TemplateConfig = CONFIG_2K,
  gridConfig?: GridConfig,
): { canvas: HTMLCanvasElement; base64: string; width: number; height: number } {
  const { cellW, cellH, headerH, border, fontSize } = config;

  const cols = gridConfig?.cols ?? COLS;
  const rows = gridConfig?.rows ?? ROWS;
  const cellLabels = gridConfig?.cellLabels ?? CELL_LABELS;

  const gridW = cols * cellW + (cols + 1) * border;
  const gridH = rows * cellH + (rows + 1) * border;

  // Canvas is always square (max of grid dimensions) to stay within 1:1 format
  const canvasSize = Math.max(gridW, gridH);

  const canvas = document.createElement('canvas');
  canvas.width = canvasSize;
  canvas.height = canvasSize;
  const ctx = canvas.getContext('2d')!;

  // Fill entire canvas with black
  ctx.fillStyle = BLACK;
  ctx.fillRect(0, 0, canvasSize, canvasSize);

  // Offset to center the grid on the canvas
  const offsetX = Math.floor((canvasSize - gridW) / 2);
  const offsetY = Math.floor((canvasSize - gridH) / 2);

  // Font for headers
  ctx.font = `bold ${fontSize}px Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const totalCells = cols * rows;
  for (let idx = 0; idx < totalCells; idx++) {
    const col = idx % cols;
    const row = Math.floor(idx / cols);
    const label = idx < cellLabels.length ? cellLabels[idx] : `Cell ${row},${col}`;

    // Cell content area top-left (with offset for centering)
    const x0 = offsetX + border + col * (cellW + border);
    const y0 = offsetY + border + row * (cellH + border);

    // Header strip (black bg, white text)
    ctx.fillStyle = BLACK;
    ctx.fillRect(x0, y0, cellW, headerH);
    ctx.fillStyle = WHITE;
    ctx.fillText(label, x0 + cellW / 2, y0 + headerH / 2);

    // Content area (chroma pink)
    ctx.fillStyle = CHROMA_PINK;
    ctx.fillRect(x0, y0 + headerH, cellW, cellH - headerH);
  }

  // Convert to base64 PNG
  const dataUrl = canvas.toDataURL('image/png');
  const base64 = dataUrl.split(',')[1];

  return { canvas, base64, width: canvasSize, height: canvasSize };
}

/**
 * Get the pixel bounds of a specific cell's content area (below the header).
 */
export function getCellBounds(
  cellIndex: number,
  config: TemplateConfig = CONFIG_2K,
  gridConfig?: GridConfig,
): { x: number; y: number; w: number; h: number } {
  const cols = gridConfig?.cols ?? COLS;
  const rows = gridConfig?.rows ?? ROWS;

  const gridW = cols * config.cellW + (cols + 1) * config.border;
  const gridH = rows * config.cellH + (rows + 1) * config.border;
  const canvasSize = Math.max(gridW, gridH);
  const offsetX = Math.floor((canvasSize - gridW) / 2);
  const offsetY = Math.floor((canvasSize - gridH) / 2);

  const col = cellIndex % cols;
  const row = Math.floor(cellIndex / cols);
  const x = offsetX + config.border + col * (config.cellW + config.border);
  const y = offsetY + config.border + row * (config.cellH + config.border) + config.headerH;
  return { x, y, w: config.cellW, h: config.cellH - config.headerH };
}
