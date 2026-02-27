/**
 * Extract individual sprites from a filled 6×6 grid image.
 * Slices the grid into cells, crops out the header strip,
 * and applies chroma-key background removal.
 */

import { COLS, ROWS, TOTAL_CELLS, CELL_LABELS } from './poses';
import { applyChromaKey } from './chromaKey';

export interface ExtractedSprite {
  cellIndex: number;
  label: string;
  /** Base64 PNG with transparent background */
  imageData: string;
  mimeType: string;
  width: number;
  height: number;
}

export interface ExtractionConfig {
  /** Header strip height to crop off each cell */
  headerH: number;
  /** Grid line thickness */
  border: number;
  /** Chroma key tolerance (0 = no removal) */
  chromaTolerance: number;
}

const DEFAULT_EXTRACTION: ExtractionConfig = {
  headerH: 16,
  border: 1,
  chromaTolerance: 80,
};

/**
 * Load a base64 image into an HTMLImageElement.
 */
function loadImage(base64: string, mimeType: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load grid image'));
    img.src = `data:${mimeType};base64,${base64}`;
  });
}

/**
 * Extract all 36 sprites from a filled grid image.
 */
export async function extractSprites(
  gridBase64: string,
  gridMimeType: string,
  config: Partial<ExtractionConfig> = {},
): Promise<ExtractedSprite[]> {
  const cfg = { ...DEFAULT_EXTRACTION, ...config };
  const img = await loadImage(gridBase64, gridMimeType);

  // Calculate cell dimensions from the grid image
  const totalBorderW = (COLS + 1) * cfg.border;
  const totalBorderH = (ROWS + 1) * cfg.border;
  const cellW = Math.floor((img.width - totalBorderW) / COLS);
  const cellH = Math.floor((img.height - totalBorderH) / ROWS);
  const contentH = cellH - cfg.headerH;

  if (contentH <= 0 || cellW <= 0) {
    throw new Error(`Invalid grid dimensions: ${img.width}x${img.height}, computed cell ${cellW}x${cellH}`);
  }

  const sprites: ExtractedSprite[] = [];

  // Create a working canvas for slicing
  const workCanvas = document.createElement('canvas');
  workCanvas.width = cellW;
  workCanvas.height = contentH;
  const workCtx = workCanvas.getContext('2d')!;

  for (let idx = 0; idx < TOTAL_CELLS; idx++) {
    const col = idx % COLS;
    const row = Math.floor(idx / COLS);

    // Source position in grid (skip borders + headers)
    const sx = cfg.border + col * (cellW + cfg.border);
    const sy = cfg.border + row * (cellH + cfg.border) + cfg.headerH;

    // Draw cell content onto work canvas
    workCtx.clearRect(0, 0, cellW, contentH);
    workCtx.drawImage(img, sx, sy, cellW, contentH, 0, 0, cellW, contentH);

    // Apply chroma key
    let imageData = workCtx.getImageData(0, 0, cellW, contentH);
    if (cfg.chromaTolerance > 0) {
      imageData = applyChromaKey(imageData, cfg.chromaTolerance);
    }

    // Convert to PNG base64
    workCtx.putImageData(imageData, 0, 0);
    const dataUrl = workCanvas.toDataURL('image/png');
    const base64 = dataUrl.split(',')[1];

    sprites.push({
      cellIndex: idx,
      label: CELL_LABELS[idx],
      imageData: base64,
      mimeType: 'image/png',
      width: cellW,
      height: contentH,
    });
  }

  return sprites;
}

/**
 * Compose extracted sprites back into a clean sprite sheet (no grid lines, no headers).
 * Returns a canvas with all sprites arranged in a 6×6 grid.
 */
export function composeSpriteSheet(
  sprites: ExtractedSprite[],
): Promise<{ canvas: HTMLCanvasElement; base64: string }> {
  return new Promise(async (resolve, reject) => {
    if (sprites.length === 0) {
      reject(new Error('No sprites to compose'));
      return;
    }

    const { width: cellW, height: cellH } = sprites[0];
    const sheetW = COLS * cellW;
    const sheetH = ROWS * cellH;

    const canvas = document.createElement('canvas');
    canvas.width = sheetW;
    canvas.height = sheetH;
    const ctx = canvas.getContext('2d')!;

    // Transparent background
    ctx.clearRect(0, 0, sheetW, sheetH);

    for (const sprite of sprites) {
      const img = await loadImage(sprite.imageData, sprite.mimeType);
      const col = sprite.cellIndex % COLS;
      const row = Math.floor(sprite.cellIndex / COLS);
      ctx.drawImage(img, col * cellW, row * cellH);
    }

    const dataUrl = canvas.toDataURL('image/png');
    const base64 = dataUrl.split(',')[1];
    resolve({ canvas, base64 });
  });
}
