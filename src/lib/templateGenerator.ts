/**
 * Generate a 6×6 sprite grid template image on a canvas.
 * Each cell has a magenta (#FF00FF) chroma-key background,
 * a thin black header strip with the pose label in white text,
 * separated by thin black grid lines.
 *
 * Port of generate_sprite_grid.py to client-side canvas.
 */

import { COLS, ROWS, CELL_LABELS } from './poses';

export interface TemplateConfig {
  cellW: number;         // content width per cell (468 for 2K, 680 for 4K)
  cellH: number;         // total cell height including header
  headerH: number;       // header strip height
  border: number;        // grid line thickness
  fontSize: number;      // label font size
}

export const CONFIG_2K: TemplateConfig = {
  cellW: 468,
  cellH: 468,
  headerH: 18,
  border: 2,
  fontSize: 11,
};

export const CONFIG_4K: TemplateConfig = {
  cellW: 680,
  cellH: 680,
  headerH: 24,
  border: 3,
  fontSize: 15,
};

const CHROMA_PINK = '#FF00FF';
const BLACK = '#000000';
const WHITE = '#FFFFFF';

/**
 * Generate the template grid as a canvas and return it along with
 * a base64-encoded PNG for sending to the API.
 */
export function generateTemplate(
  config: TemplateConfig = CONFIG_2K,
): { canvas: HTMLCanvasElement; base64: string; width: number; height: number } {
  const { cellW, cellH, headerH, border, fontSize } = config;

  const imgW = COLS * cellW + (COLS + 1) * border;
  const imgH = ROWS * cellH + (ROWS + 1) * border;

  const canvas = document.createElement('canvas');
  canvas.width = imgW;
  canvas.height = imgH;
  const ctx = canvas.getContext('2d')!;

  // Fill entire canvas with black (grid lines)
  ctx.fillStyle = BLACK;
  ctx.fillRect(0, 0, imgW, imgH);

  // Font for headers
  ctx.font = `bold ${fontSize}px Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  for (let idx = 0; idx < CELL_LABELS.length; idx++) {
    const col = idx % COLS;
    const row = Math.floor(idx / COLS);
    const label = CELL_LABELS[idx];

    // Cell content area top-left
    const x0 = border + col * (cellW + border);
    const y0 = border + row * (cellH + border);

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

  return { canvas, base64, width: imgW, height: imgH };
}

/**
 * Get the pixel bounds of a specific cell's content area (below the header).
 */
export function getCellBounds(
  cellIndex: number,
  config: TemplateConfig = CONFIG_2K,
): { x: number; y: number; w: number; h: number } {
  const col = cellIndex % COLS;
  const row = Math.floor(cellIndex / COLS);
  const x = config.border + col * (config.cellW + config.border);
  const y = config.border + row * (config.cellH + config.border) + config.headerH;
  return { x, y, w: config.cellW, h: config.cellH - config.headerH };
}
