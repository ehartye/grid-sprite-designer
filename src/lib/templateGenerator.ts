/**
 * Generate sprite grid template images on a canvas.
 * Each cell has a magenta (#FF00FF) chroma-key background,
 * a thin black header strip with the pose label in white text,
 * separated by thin black grid lines.
 *
 * For non-background grids, uses SquareLayout (1:1 cells).
 * For background grids, uses legacy cellW/cellH from GridConfig.templates.
 */

import type { GridConfig } from './gridConfig';
import type { SquareLayout } from './computeSquareLayout';

const CHROMA_PINK = '#FF00FF';
const BLACK = '#000000';
const WHITE = '#FFFFFF';

/**
 * Generate the template grid as a canvas using SquareLayout (1:1 cells).
 * Used for all non-background sprite types.
 */
export function generateTemplate(
  layout: SquareLayout,
  gridConfig: GridConfig,
): { canvas: HTMLCanvasElement; base64: string; width: number; height: number } {
  const { cellSize, headerH, border, fontSize, canvasW, canvasH } = layout;

  const cols = gridConfig.cols;
  const rows = gridConfig.rows;
  const cellLabels = gridConfig.cellLabels;

  const cellW = cellSize;
  const cellH = cellSize + headerH; // total cell height including header

  const gridW = cols * cellW + (cols + 1) * border;
  const gridH = rows * cellH + (rows + 1) * border;

  const canvas = document.createElement('canvas');
  canvas.width = canvasW;
  canvas.height = canvasH;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = BLACK;
  ctx.fillRect(0, 0, canvasW, canvasH);

  const offsetX = Math.floor((canvasW - gridW) / 2);
  const offsetY = Math.floor((canvasH - gridH) / 2);

  ctx.font = `bold ${fontSize}px Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const totalCells = cols * rows;
  for (let idx = 0; idx < totalCells; idx++) {
    const col = idx % cols;
    const row = Math.floor(idx / cols);
    const label = idx < cellLabels.length ? cellLabels[idx] : `Cell ${row},${col}`;

    const x0 = offsetX + border + col * (cellW + border);
    const y0 = offsetY + border + row * (cellH + border);

    // Header strip
    ctx.fillStyle = BLACK;
    ctx.fillRect(x0, y0, cellW, headerH);
    ctx.fillStyle = WHITE;
    ctx.fillText(label, x0 + cellW / 2, y0 + headerH / 2);

    // Content area (1:1 square)
    ctx.fillStyle = CHROMA_PINK;
    ctx.fillRect(x0, y0 + headerH, cellW, cellSize);
  }

  const dataUrl = canvas.toDataURL('image/png');
  const base64 = dataUrl.split(',')[1];

  return { canvas, base64, width: canvasW, height: canvasH };
}

/**
 * Legacy template generator for background grids (exempt from 1:1).
 * Uses non-square cellW/cellH from BACKGROUND_GRIDS templates.
 */
export function generateBackgroundTemplate(
  config: { cellW: number; cellH: number; headerH: number; border: number; fontSize: number },
  gridConfig: GridConfig,
  aspectRatio: string = '1:1',
): { canvas: HTMLCanvasElement; base64: string; width: number; height: number } {
  const { cellW, cellH, headerH, border, fontSize } = config;
  const cols = gridConfig.cols;
  const rows = gridConfig.rows;
  const cellLabels = gridConfig.cellLabels;

  const gridW = cols * cellW + (cols + 1) * border;
  const gridH = rows * cellH + (rows + 1) * border;

  const [arW, arH] = aspectRatio.split(':').map(Number);
  const arFactor = (arW && arH) ? arW / arH : 1;

  let canvasW: number;
  let canvasH: number;
  if (arFactor >= 1) {
    canvasW = Math.max(gridW, Math.ceil(gridH * arFactor));
    canvasH = Math.max(gridH, Math.ceil(gridW / arFactor));
  } else {
    canvasW = Math.max(gridW, Math.ceil(gridH * arFactor));
    canvasH = Math.max(gridH, Math.ceil(gridW / arFactor));
  }

  const canvas = document.createElement('canvas');
  canvas.width = canvasW;
  canvas.height = canvasH;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = BLACK;
  ctx.fillRect(0, 0, canvasW, canvasH);

  const offsetX = Math.floor((canvasW - gridW) / 2);
  const offsetY = Math.floor((canvasH - gridH) / 2);

  ctx.font = `bold ${fontSize}px Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const totalCells = cols * rows;
  for (let idx = 0; idx < totalCells; idx++) {
    const col = idx % cols;
    const row = Math.floor(idx / cols);
    const label = idx < cellLabels.length ? cellLabels[idx] : `Cell ${row},${col}`;

    const x0 = offsetX + border + col * (cellW + border);
    const y0 = offsetY + border + row * (cellH + border);

    ctx.fillStyle = BLACK;
    ctx.fillRect(x0, y0, cellW, headerH);
    ctx.fillStyle = WHITE;
    ctx.fillText(label, x0 + cellW / 2, y0 + headerH / 2);

    ctx.fillStyle = CHROMA_PINK;
    ctx.fillRect(x0, y0 + headerH, cellW, cellH - headerH);
  }

  const dataUrl = canvas.toDataURL('image/png');
  const base64 = dataUrl.split(',')[1];

  return { canvas, base64, width: canvasW, height: canvasH };
}

/**
 * Get the pixel bounds of a specific cell's content area (below the header).
 */
export function getCellBounds(
  cellIndex: number,
  layout: SquareLayout,
  gridConfig: GridConfig,
): { x: number; y: number; w: number; h: number } {
  const { cellSize, headerH, border, canvasW, canvasH } = layout;
  const cols = gridConfig.cols;
  const rows = gridConfig.rows;
  const cellH = cellSize + headerH;

  const gridW = cols * cellSize + (cols + 1) * border;
  const gridH = rows * cellH + (rows + 1) * border;

  const offsetX = Math.floor((canvasW - gridW) / 2);
  const offsetY = Math.floor((canvasH - gridH) / 2);

  const col = cellIndex % cols;
  const row = Math.floor(cellIndex / cols);
  const x = offsetX + border + col * (cellSize + border);
  const y = offsetY + border + row * (cellH + border) + headerH;
  return { x, y, w: cellSize, h: cellSize };
}
