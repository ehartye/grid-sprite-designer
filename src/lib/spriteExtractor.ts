/**
 * Extract individual sprites from a filled 6×6 grid image.
 *
 * Uses edge-based grid detection to locate cell boundaries, then
 * chromatic header detection to skip label rows before cropping.
 */

import { COLS, ROWS, TOTAL_CELLS, CELL_LABELS } from './poses';

// ── Types ────────────────────────────────────────────────────────────────────

export interface ExtractedSprite {
  cellIndex: number;
  label: string;
  /** Base64 PNG */
  imageData: string;
  mimeType: string;
  width: number;
  height: number;
}

export interface ExtractionConfig {
  /** Header strip height in the original template */
  headerH: number;
  /** Grid line thickness in the original template */
  border: number;
  /** Original template cell width (used to scale grid to actual image) */
  templateCellW: number;
  /** Original template cell height (used to scale grid to actual image) */
  templateCellH: number;
  /** Extra inset (px) to clip anti-aliased border remnants */
  aaInset: number;
}

const DEFAULT_EXTRACTION: ExtractionConfig = {
  headerH: 14,
  border: 2,
  templateCellW: 339,
  templateCellH: 339,
  aaInset: 3,
};

// ── Grid line detection ─────────────────────────────────────────────────────

interface Band {
  start: number;
  end: number;
}

interface CellRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Compute per-row brightness variance (for horizontal grid line detection).
 * Grid line rows are uniform color → near-zero variance.
 * Header/content rows have varied pixels → high variance.
 */
function computeRowVariance(
  data: Uint8ClampedArray,
  width: number,
  height: number,
): Float64Array {
  const variance = new Float64Array(height);
  for (let y = 0; y < height; y++) {
    let sum = 0;
    let sumSq = 0;
    let count = 0;
    for (let x = 0; x < width; x += 2) {
      const i = (y * width + x) * 4;
      const b = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      sum += b;
      sumSq += b * b;
      count++;
    }
    const mean = sum / count;
    variance[y] = sumSq / count - mean * mean;
  }
  return variance;
}

/**
 * Compute per-column brightness variance (for vertical grid line detection).
 * Grid line columns are uniform color → near-zero variance.
 * Content columns have varied art → high variance.
 */
function computeColumnVariance(
  data: Uint8ClampedArray,
  width: number,
  height: number,
): Float64Array {
  const variance = new Float64Array(width);
  for (let x = 0; x < width; x++) {
    let sum = 0;
    let sumSq = 0;
    let count = 0;
    for (let y = 0; y < height; y += 2) {
      const i = (y * width + x) * 4;
      const b = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      sum += b;
      sumSq += b * b;
      count++;
    }
    const mean = sum / count;
    variance[x] = sumSq / count - mean * mean;
  }
  return variance;
}

/**
 * Find contiguous bands where variance is below threshold (grid lines).
 * Filters out bands wider than maxWidth to avoid picking up large uniform areas.
 */
function findLowBands(profile: Float64Array, threshold: number, maxWidth: number): Band[] {
  const bands: Band[] = [];
  let i = 0;
  while (i < profile.length) {
    if (profile[i] <= threshold) {
      const start = i;
      while (i < profile.length && profile[i] <= threshold) i++;
      if (i - start <= maxWidth) {
        bands.push({ start, end: i - 1 });
      }
    } else {
      i++;
    }
  }
  return bands;
}

/**
 * Convert detected grid line bands into 6 cell content spans.
 * Each cell spans from one grid line's far edge to the next grid line's near edge,
 * with `margin` pixels trimmed on each side to skip anti-aliased edges.
 */
function gridLinesToCellSpans(
  lines: Band[],
  totalSize: number,
  margin: number,
): Array<{ start: number; size: number }> {
  const sorted = [...lines].sort((a, b) => a.start - b.start);

  // If outer borders weren't detected, add virtual edges
  const expectedSpacing = totalSize / 6;
  if (sorted.length === 0 || sorted[0].start > expectedSpacing * 0.3) {
    sorted.unshift({ start: 0, end: 0 });
  }
  if (sorted.length === 0 || sorted[sorted.length - 1].end < totalSize - expectedSpacing * 0.3) {
    sorted.push({ start: totalSize - 1, end: totalSize - 1 });
  }

  const spans: Array<{ start: number; size: number }> = [];
  for (let i = 0; i < sorted.length - 1; i++) {
    const start = sorted[i].end + 2 + margin;
    const end = sorted[i + 1].start - 2 - margin;
    const size = end - start + 1;
    if (size > 0) {
      spans.push({ start, size: Math.max(size, 1) });
    }
  }
  return spans;
}

/**
 * Detect grid lines via per-row and per-column variance, then derive cell rects
 * from the spaces between lines.
 *
 * Grid lines are uniform color (low variance) regardless of whether they're
 * dark or colored. Content/headers have high variance. We find the lines,
 * strip them + aaInset margin, and the remaining regions are the cells.
 *
 * Falls back to template positions if detection doesn't yield 6×6 cells.
 */
function detectGridLines(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  templateBorder: number,
  templateCellW: number,
  templateCellH: number,
  aaInset: number,
): CellRect[] {
  const rowVar = computeRowVariance(data, width, height);
  const colVar = computeColumnVariance(data, width, height);

  // Threshold: grid lines have much lower variance than content/headers.
  // Use 10% of median — median is solidly in the content range since
  // content rows/cols make up 85%+ of the image.
  const rowSorted = Array.from(rowVar).sort((a, b) => a - b);
  const colSorted = Array.from(colVar).sort((a, b) => a - b);
  const rowMedian = rowSorted[Math.floor(rowSorted.length / 2)];
  const colMedian = colSorted[Math.floor(colSorted.length / 2)];

  const hLines = findLowBands(rowVar, rowMedian * 0.1, 20);
  const vLines = findLowBands(colVar, colMedian * 0.1, 20);

  // Convert grid lines → cell spans (content between lines + margin)
  const hSpans = gridLinesToCellSpans(hLines, height, aaInset);
  const vSpans = gridLinesToCellSpans(vLines, width, aaInset);

  if (hSpans.length !== 6 || vSpans.length !== 6) {
    return templateFallback(width, height, templateBorder, templateCellW, templateCellH, aaInset);
  }

  const cells: CellRect[] = [];
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      cells.push({
        x: vSpans[col].start,
        y: hSpans[row].start,
        w: vSpans[col].size,
        h: hSpans[row].size,
      });
    }
  }

  return cells;
}

/**
 * Template-based fallback when band detection fails.
 */
function templateFallback(
  width: number,
  height: number,
  templateBorder: number,
  templateCellW: number,
  templateCellH: number,
  aaInset: number,
): CellRect[] {
  const templateImgW = COLS * templateCellW + (COLS + 1) * templateBorder;
  const templateImgH = ROWS * templateCellH + (ROWS + 1) * templateBorder;
  const cells: CellRect[] = [];
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const tX = col * (templateCellW + templateBorder) + templateBorder;
      const tY = row * (templateCellH + templateBorder) + templateBorder;
      const x = Math.round(tX * width / templateImgW) + aaInset;
      const y = Math.round(tY * height / templateImgH) + aaInset;
      const w = Math.round(templateCellW * width / templateImgW) - 2 * aaInset;
      const h = Math.round(templateCellH * height / templateImgH) - 2 * aaInset;
      cells.push({ x, y, w: Math.max(w, 1), h: Math.max(h, 1) });
    }
  }
  return cells;
}

// ── Image loading ────────────────────────────────────────────────────────────

function loadImage(base64: string, mimeType: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load grid image'));
    img.src = `data:${mimeType};base64,${base64}`;
  });
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Extract all 36 sprites from a filled grid image.
 *
 * Uses edge-based grid detection to find cell boundaries, then
 * chromatic header detection to skip label rows before cropping.
 */
export async function extractSprites(
  gridBase64: string,
  gridMimeType: string,
  config: Partial<ExtractionConfig> = {},
): Promise<ExtractedSprite[]> {
  const cfg = { ...DEFAULT_EXTRACTION, ...config };
  const img = await loadImage(gridBase64, gridMimeType);

  // Draw the full grid onto a canvas to read pixels
  const gridCanvas = document.createElement('canvas');
  gridCanvas.width = img.width;
  gridCanvas.height = img.height;
  const gridCtx = gridCanvas.getContext('2d')!;
  gridCtx.drawImage(img, 0, 0);

  // Read full grid pixel data for analysis
  const gridData = gridCtx.getImageData(0, 0, img.width, img.height);
  const gd = gridData.data;
  const gw = img.width;

  // Detect actual grid line positions via brightness profiling.
  // Gemini doesn't preserve template grid structure faithfully — borders shift,
  // headers vary in size — so we scan for the real grid lines in the output.
  const cells = detectGridLines(
    gd, img.width, img.height,
    cfg.border, cfg.templateCellW, cfg.templateCellH,
    cfg.aaInset,
  );

  if (cells.length !== TOTAL_CELLS) {
    throw new Error(
      `Grid detection found ${cells.length} cells, expected ${TOTAL_CELLS}`,
    );
  }

  /**
   * Detect header height within a cell by finding where chromatic content begins.
   *
   * Header rows are GRAYSCALE: black background + white text → R ≈ G ≈ B.
   * Content rows have MAGENTA background (#FF00FF) → high saturation.
   * Even JPEG-compressed, the magenta shows clear R≠G≠B separation.
   */
  function detectCellHeader(
    cellX: number, cellY: number,
    cw: number, ch: number,
  ): number {
    const maxScan = Math.ceil(ch * 0.25);
    for (let y = 0; y < maxScan; y++) {
      let chromaCount = 0;
      let totalSamples = 0;

      for (let x = 2; x < cw - 2; x += 2) {
        const px = cellX + x;
        const py = cellY + y;
        if (px < gw && py < img.height) {
          totalSamples++;
          const i = (py * gw + px) * 4;
          const r = gd[i], g = gd[i + 1], b = gd[i + 2];
          const maxC = Math.max(r, g, b);
          const minC = Math.min(r, g, b);
          if (maxC > 30 && (maxC - minC) / maxC > 0.2) {
            chromaCount++;
          }
        }
      }

      if (totalSamples > 0 && chromaCount / totalSamples > 0.50) {
        return y + 2;
      }
    }

    return 0;
  }

  const sprites: ExtractedSprite[] = [];

  for (let idx = 0; idx < TOTAL_CELLS; idx++) {
    const cell = cells[idx];

    // Dynamically detect header height for this cell
    const headerH = detectCellHeader(cell.x, cell.y, cell.w, cell.h);
    const contentH = cell.h - headerH;

    if (contentH <= 0) continue;

    // Crop the cell content area (below header)
    const workCanvas = document.createElement('canvas');
    workCanvas.width = cell.w;
    workCanvas.height = contentH;
    const workCtx = workCanvas.getContext('2d')!;

    workCtx.clearRect(0, 0, cell.w, contentH);
    workCtx.drawImage(
      img,
      cell.x, cell.y + headerH, cell.w, contentH,
      0, 0, cell.w, contentH,
    );

    // Convert to PNG base64
    const dataUrl = workCanvas.toDataURL('image/png');
    const base64 = dataUrl.split(',')[1];

    sprites.push({
      cellIndex: idx,
      label: CELL_LABELS[idx],
      imageData: base64,
      mimeType: 'image/png',
      width: cell.w,
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
