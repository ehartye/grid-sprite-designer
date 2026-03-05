/**
 * Extract individual sprites from a filled grid image.
 *
 * Supports 6x6 character grids (default) and variable-size grids
 * (3x3 buildings, 2x3 terrain, etc.) via optional gridOverride config.
 *
 * Detection: Full-width/height divider scoring. Scans each pixel row
 * and column across the entire image, scoring the percentage of
 * achromatic-dark or achromatic-bright pixels. Consecutive high-scoring
 * rows/columns are identified as cut bands (headers, row dividers,
 * column dividers). The content rectangles between cuts are the sprites.
 *
 * Fallback: If cuts don't yield the expected grid dimensions, falls back
 * to symmetrical (evenly-spaced) division of the image.
 */

import { COLS, ROWS, TOTAL_CELLS, CELL_LABELS } from './poses';
import { posterize } from './imagePreprocess';

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

export interface GridOverride {
  cols: number;
  rows: number;
  totalCells: number;
  cellLabels: string[];
}

export interface ExtractionConfig {
  /** Extra inset (px) to clip anti-aliased border remnants */
  aaInset: number;
  /** Bits per channel for posterization during grid detection (1-8) */
  posterizeBits: number;
  /** Override grid dimensions for non-6x6 grids */
  gridOverride?: GridOverride;
}

const DEFAULT_EXTRACTION: ExtractionConfig = {
  aaInset: 3,
  posterizeBits: 4,
};

// ── Cut detection ────────────────────────────────────────────────────────────

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
 * Compute per-row "divider score" across full image width.
 *
 * For each row, counts pixels that are either:
 *   - achromatic dark: brightness < 25 AND saturation < 20
 *   - achromatic bright: brightness > 200 AND saturation < 30
 *
 * Header bars (dark bg + white text) and thin grid lines both score high.
 * Content rows (colored sprites, backgrounds) score low.
 *
 * Returns a Float64Array of scores in [0, 1] per row.
 */
function computeRowDividerScore(
  data: Uint8ClampedArray,
  width: number,
  height: number,
): Float64Array {
  const scores = new Float64Array(height);
  for (let y = 0; y < height; y++) {
    let dividerPixels = 0;
    let opaquePixels = 0;
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      if (data[i + 3] === 0) continue;
      opaquePixels++;
      const r = data[i], g = data[i + 1], b = data[i + 2];
      const brightness = 0.299 * r + 0.587 * g + 0.114 * b;
      const maxC = Math.max(r, g, b);
      const minC = Math.min(r, g, b);
      const saturation = maxC - minC;
      if (saturation < 20 && brightness < 25) dividerPixels++;      // achromatic dark
      else if (saturation < 30 && brightness > 200) dividerPixels++; // achromatic bright (text)
    }
    scores[y] = opaquePixels > 0 ? dividerPixels / opaquePixels : 0;
  }
  return scores;
}

/**
 * Compute per-column "divider score" across full image height.
 * Same metric as rows but scanned vertically.
 */
function computeColDividerScore(
  data: Uint8ClampedArray,
  width: number,
  height: number,
): Float64Array {
  const scores = new Float64Array(width);
  for (let x = 0; x < width; x++) {
    let dividerPixels = 0;
    let opaquePixels = 0;
    for (let y = 0; y < height; y++) {
      const i = (y * width + x) * 4;
      if (data[i + 3] === 0) continue;
      opaquePixels++;
      const r = data[i], g = data[i + 1], b = data[i + 2];
      const brightness = 0.299 * r + 0.587 * g + 0.114 * b;
      const maxC = Math.max(r, g, b);
      const minC = Math.min(r, g, b);
      const saturation = maxC - minC;
      if (saturation < 20 && brightness < 25) dividerPixels++;
      else if (saturation < 30 && brightness > 200) dividerPixels++;
    }
    scores[x] = opaquePixels > 0 ? dividerPixels / opaquePixels : 0;
  }
  return scores;
}

const DIVIDER_THRESHOLD = 0.80;
const MIN_CUT_RUN = 1;

/**
 * Find contiguous bands of rows/columns whose divider score exceeds the threshold.
 * Each band represents a full-width/height cut (header bar, row divider, or column divider).
 *
 * @param scores - Per-row or per-column divider scores from computeRow/ColDividerScore
 * @param threshold - Minimum score to qualify as a divider pixel row/column (default 0.80)
 * @param minRun - Minimum consecutive rows/columns to form a band (default 1)
 * @returns Array of {start, end} bands (inclusive indices)
 */
function findCutBands(
  scores: Float64Array,
  threshold: number = DIVIDER_THRESHOLD,
  minRun: number = MIN_CUT_RUN,
): Band[] {
  const bands: Band[] = [];
  let i = 0;
  while (i < scores.length) {
    if (scores[i] >= threshold) {
      const start = i;
      while (i < scores.length && scores[i] >= threshold) i++;
      if (i - start >= minRun) {
        bands.push({ start, end: i - 1 });
      }
    } else {
      i++;
    }
  }
  return bands;
}

/**
 * Convert cut bands into content spans (the gaps between cuts).
 * Content spans start after a cut's end and extend to the next cut's start,
 * with aaInset trimmed from each edge.
 */
function cutBandsToContentSpans(
  cuts: Band[],
  totalSize: number,
  aaInset: number,
): Array<{ start: number; size: number }> {
  const sorted = [...cuts].sort((a, b) => a.start - b.start);
  const spans: Array<{ start: number; size: number }> = [];

  // Content before the first cut (if the first cut doesn't start at 0)
  let prevEnd = -1;
  for (const cut of sorted) {
    const start = prevEnd + 1 + aaInset;
    const end = cut.start - aaInset;
    const size = end - start;
    if (size > 0) {
      spans.push({ start, size });
    }
    prevEnd = cut.end;
  }

  // Content after the last cut
  const lastStart = prevEnd + 1 + aaInset;
  const lastSize = totalSize - lastStart - aaInset;
  if (lastSize > 0) {
    spans.push({ start: lastStart, size: lastSize });
  }

  return spans;
}

/**
 * Detect full-width horizontal and vertical cuts, then compute cell rects
 * from the content regions between cuts.
 *
 * Fallback: if detected cuts don't yield the expected grid dimensions,
 * falls back to symmetrical (evenly-spaced) cuts. Still strips any
 * detected header band from the top row if one was found.
 */
function detectCuts(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  aaInset: number,
  gridCols: number,
  gridRows: number,
): CellRect[] {
  // ── Horizontal cuts ──
  const rowScores = computeRowDividerScore(data, width, height);
  const hCuts = findCutBands(rowScores);
  console.log(`[CutDetect] Horizontal cuts: ${hCuts.length}`, hCuts.map(b => `${b.start}-${b.end} (${b.end - b.start + 1}px)`));

  // ── Vertical cuts ──
  const colScores = computeColDividerScore(data, width, height);
  const vCuts = findCutBands(colScores);
  console.log(`[CutDetect] Vertical cuts: ${vCuts.length}`, vCuts.map(b => `${b.start}-${b.end} (${b.end - b.start + 1}px)`));

  // ── Compute content spans between cuts ──
  const hSpans = cutBandsToContentSpans(hCuts, height, aaInset);
  const vSpans = cutBandsToContentSpans(vCuts, width, aaInset);
  console.log(`[CutDetect] Content regions: ${hSpans.length} rows x ${vSpans.length} cols`);

  let finalRows: Array<{ start: number; size: number }>;
  let finalCols: Array<{ start: number; size: number }>;

  if (hSpans.length === gridRows && vSpans.length === gridCols) {
    // Full detection succeeded
    finalRows = hSpans;
    finalCols = vSpans;
  } else {
    // Fallback to symmetrical cuts
    console.warn(
      `[CutDetect] FALLBACK: detected ${hSpans.length} rows (expected ${gridRows}), ` +
      `${vSpans.length} cols (expected ${gridCols}). Using symmetrical cuts.`
    );

    // Check if we at least found a header band at the top
    let headerEnd = 0;
    if (hCuts.length > 0 && hCuts[0].start < height * 0.1) {
      headerEnd = hCuts[0].end + 1;
      console.log(`[CutDetect] Stripping detected header: rows 0-${hCuts[0].end} (${headerEnd}px)`);
    }

    const contentHeight = height - headerEnd;
    const contentWidth = width;
    const rowSize = Math.floor(contentHeight / gridRows);
    const colSize = Math.floor(contentWidth / gridCols);

    finalRows = [];
    for (let r = 0; r < gridRows; r++) {
      const start = headerEnd + r * rowSize + aaInset;
      const size = rowSize - 2 * aaInset;
      finalRows.push({ start, size: Math.max(size, 1) });
    }

    finalCols = [];
    for (let c = 0; c < gridCols; c++) {
      const start = c * colSize + aaInset;
      const size = colSize - 2 * aaInset;
      finalCols.push({ start, size: Math.max(size, 1) });
    }
  }

  // ── Build cell rects ──
  const cells: CellRect[] = [];
  for (let row = 0; row < gridRows; row++) {
    for (let col = 0; col < gridCols; col++) {
      if (row < finalRows.length && col < finalCols.length) {
        cells.push({
          x: finalCols[col].start,
          y: finalRows[row].start,
          w: finalCols[col].size,
          h: finalRows[row].size,
        });
      }
    }
  }

  return cells;
}

// ── Image loading ────────────────────────────────────────────────────────────

function loadImage(base64: string, mimeType: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image (${mimeType})`));
    img.src = `data:${mimeType};base64,${base64}`;
  });
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Extract sprites from a filled grid image.
 *
 * Uses full-width/height divider scoring to detect cut bands (headers,
 * row dividers, column dividers), then crops content rectangles between cuts.
 *
 * When gridOverride is provided, uses those dimensions instead of the
 * default 6x6 character constants from poses.ts.
 */
export async function extractSprites(
  gridBase64: string,
  gridMimeType: string,
  config: Partial<ExtractionConfig> = {},
): Promise<ExtractedSprite[]> {
  const cfg = { ...DEFAULT_EXTRACTION, ...config };
  const gridCols = cfg.gridOverride?.cols ?? COLS;
  const gridRows = cfg.gridOverride?.rows ?? ROWS;
  const totalCells = cfg.gridOverride?.totalCells ?? TOTAL_CELLS;
  const cellLabels = cfg.gridOverride?.cellLabels ?? CELL_LABELS;

  const img = await loadImage(gridBase64, gridMimeType);

  // Draw the full grid onto a canvas to read pixels
  const gridCanvas = document.createElement('canvas');
  gridCanvas.width = img.width;
  gridCanvas.height = img.height;
  const gridCtx = gridCanvas.getContext('2d')!;
  gridCtx.drawImage(img, 0, 0);

  const originalData = gridCtx.getImageData(0, 0, img.width, img.height);

  // Posterize a copy for cut detection — absorbs JPEG artifacts and makes
  // grid lines / backgrounds perfectly uniform without touching the original.
  const detectionData = posterize(originalData, cfg.posterizeBits);

  const cells = detectCuts(
    detectionData.data, img.width, img.height,
    cfg.aaInset,
    gridCols, gridRows,
  );

  if (cells.length !== totalCells) {
    throw new Error(
      `Cut detection found ${cells.length} cells, expected ${totalCells}`,
    );
  }

  // Crop from the original image — posterization for output is handled
  // client-side in the processSprite pipeline for instant toggling.
  const sprites: ExtractedSprite[] = [];

  for (let idx = 0; idx < totalCells; idx++) {
    const cell = cells[idx];

    const workCanvas = document.createElement('canvas');
    workCanvas.width = cell.w;
    workCanvas.height = cell.h;
    const workCtx = workCanvas.getContext('2d')!;

    workCtx.clearRect(0, 0, cell.w, cell.h);
    workCtx.drawImage(
      img,
      cell.x, cell.y, cell.w, cell.h,
      0, 0, cell.w, cell.h,
    );

    const dataUrl = workCanvas.toDataURL('image/png');
    const base64 = dataUrl.split(',')[1];

    sprites.push({
      cellIndex: idx,
      label: idx < cellLabels.length ? cellLabels[idx] : `Cell ${idx}`,
      imageData: base64,
      mimeType: 'image/png',
      width: cell.w,
      height: cell.h,
    });
  }

  return normalizeSprites(sprites);
}

/**
 * Normalize all sprites to uniform dimensions (max width × max height),
 * bottom-aligned and horizontally centered with transparent padding.
 */
async function normalizeSprites(sprites: ExtractedSprite[]): Promise<ExtractedSprite[]> {
  const widths = sprites.map(s => s.width);
  const heights = sprites.map(s => s.height);
  const maxW = Math.max(...widths);
  const maxH = Math.max(...heights);
  const minW = Math.min(...widths);
  const minH = Math.min(...heights);

  // Already uniform — skip work
  if (minW === maxW && minH === maxH) return sprites;

  console.log(
    `[Normalize] Resized sprites to ${maxW}×${maxH} (was ${minW}-${maxW} × ${minH}-${maxH})`,
  );

  return Promise.all(sprites.map(async sprite => {
    if (sprite.width === maxW && sprite.height === maxH) return sprite;

    const img = await loadImage(sprite.imageData, sprite.mimeType);

    const canvas = document.createElement('canvas');
    canvas.width = maxW;
    canvas.height = maxH;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, maxW, maxH);

    // Draw bottom-aligned, horizontally centered
    const x = Math.floor((maxW - sprite.width) / 2);
    const y = maxH - sprite.height;
    ctx.drawImage(img, x, y);

    const dataUrl = canvas.toDataURL('image/png');
    return {
      ...sprite,
      imageData: dataUrl.split(',')[1],
      width: maxW,
      height: maxH,
    };
  }));
}

/**
 * Compose extracted sprites back into a clean sprite sheet (no grid lines, no headers).
 * Returns a canvas with all sprites arranged in a grid.
 * When gridCols is provided, uses that for layout; defaults to 6 (character grid).
 */
export async function composeSpriteSheet(
  sprites: ExtractedSprite[],
  gridCols?: number,
): Promise<{ canvas: HTMLCanvasElement; base64: string }> {
  if (sprites.length === 0) {
    throw new Error('No sprites to compose');
  }

  const cols = gridCols ?? COLS;
  const rows = Math.ceil(sprites.length / cols);

  const { width: cellW, height: cellH } = sprites[0];
  const sheetW = cols * cellW;
  const sheetH = rows * cellH;

  const canvas = document.createElement('canvas');
  canvas.width = sheetW;
  canvas.height = sheetH;
  const ctx = canvas.getContext('2d')!;

  // Transparent background
  ctx.clearRect(0, 0, sheetW, sheetH);

  for (const sprite of sprites) {
    const img = await loadImage(sprite.imageData, sprite.mimeType);
    const col = sprite.cellIndex % cols;
    const row = Math.floor(sprite.cellIndex / cols);
    ctx.drawImage(img, col * cellW, row * cellH);
  }

  const dataUrl = canvas.toDataURL('image/png');
  const base64 = dataUrl.split(',')[1];
  return { canvas, base64 };
}
