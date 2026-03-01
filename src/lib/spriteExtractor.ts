/**
 * Extract individual sprites from a filled 6×6 grid image.
 *
 * Row detection: darkness-based — header rows (black bg + white text) and grid
 * lines are mostly dark pixels. We find contiguous dark bands (dividers) and
 * use the gaps between them as the 6 content row regions.
 *
 * Column detection: variance-based (content rows only) — grid line columns have
 * near-zero variance. We compute column variance using only content row pixels
 * (excluding headers) and find grid lines, then use gaps as content columns.
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
  /** Bits per channel for posterization during grid detection (1-8) */
  posterizeBits: number;
}

const DEFAULT_EXTRACTION: ExtractionConfig = {
  headerH: 14,
  border: 2,
  templateCellW: 339,
  templateCellH: 339,
  aaInset: 3,
  posterizeBits: 4,
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
 * Compute per-row darkness score (fraction of very dark pixels).
 *
 * Header rows (black bg + white text) → mostly dark → high darkness score.
 * Grid lines (dark/black) → mostly dark → high darkness score.
 * Content rows (magenta bg + sprite art) → low darkness score.
 *
 * This identifies divider bands (headers + grid lines) in one pass.
 */
function computeRowDarkness(
  data: Uint8ClampedArray,
  width: number,
  height: number,
): Float64Array {
  const scores = new Float64Array(height);
  for (let y = 0; y < height; y++) {
    let dark = 0;
    let total = 0;
    for (let x = 0; x < width; x += 2) {
      total++;
      const i = (y * width + x) * 4;
      const brightness = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      if (brightness < 30) dark++;
    }
    scores[y] = total > 0 ? dark / total : 0;
  }
  return scores;
}

/**
 * Find contiguous bands where the score exceeds the threshold.
 */
function findHighBands(
  profile: Float64Array,
  threshold: number,
): Band[] {
  const bands: Band[] = [];
  let i = 0;
  while (i < profile.length) {
    if (profile[i] >= threshold) {
      const start = i;
      while (i < profile.length && profile[i] >= threshold) i++;
      bands.push({ start, end: i - 1 });
    } else {
      i++;
    }
  }
  return bands;
}

/**
 * Merge bands separated by gaps smaller than maxGap pixels.
 * Handles JPEG artifacts and anti-aliased edges that create tiny
 * non-chromatic breaks within content regions.
 */
function mergeNearbyBands(bands: Band[], maxGap: number): Band[] {
  if (bands.length === 0) return bands;
  const merged: Band[] = [{ ...bands[0] }];
  for (let i = 1; i < bands.length; i++) {
    const last = merged[merged.length - 1];
    if (bands[i].start - last.end <= maxGap) {
      last.end = bands[i].end;
    } else {
      merged.push({ ...bands[i] });
    }
  }
  return merged;
}

/**
 * Compute per-column brightness variance (for vertical grid line detection).
 * Grid line columns are uniform color → near-zero variance.
 * Content columns have varied art → high variance.
 *
 * When contentBands is provided, only samples rows within those bands,
 * excluding header rows whose uniform darkness would dilute the signal.
 */
function computeColumnVariance(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  contentBands?: Band[],
): Float64Array {
  const variance = new Float64Array(width);
  for (let x = 0; x < width; x++) {
    let sum = 0;
    let sumSq = 0;
    let count = 0;
    if (contentBands && contentBands.length > 0) {
      for (const band of contentBands) {
        for (let y = band.start; y <= band.end; y += 2) {
          const i = (y * width + x) * 4;
          const b = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
          sum += b;
          sumSq += b * b;
          count++;
        }
      }
    } else {
      for (let y = 0; y < height; y += 2) {
        const i = (y * width + x) * 4;
        const b = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        sum += b;
        sumSq += b * b;
        count++;
      }
    }
    if (count > 0) {
      const mean = sum / count;
      variance[x] = sumSq / count - mean * mean;
    }
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

  // Skip past the grid line pixel bleed beyond the detected band edge
  const GRID_LINE_SKIP = 2;

  const spans: Array<{ start: number; size: number }> = [];
  for (let i = 0; i < sorted.length - 1; i++) {
    const start = sorted[i].end + GRID_LINE_SKIP + margin;
    const end = sorted[i + 1].start - GRID_LINE_SKIP - margin;
    const size = end - start + 1;
    if (size > 0) {
      spans.push({ start, size: Math.max(size, 1) });
    }
  }
  return spans;
}

/**
 * From a set of candidate grid line bands, select the subset that produces
 * 6 roughly evenly-spaced cells. Tries the full set first, then prunes
 * outliers that break the expected ~totalSize/6 spacing.
 */
function selectGridLines(
  candidates: Band[],
  totalSize: number,
  margin: number,
): Band[] | null {
  // Try candidates as-is
  const spans = gridLinesToCellSpans(candidates, totalSize, margin);
  if (spans.length === 6 && spansAreEven(spans, totalSize)) return candidates;

  // If too many candidates, try pruning. Real grid lines are evenly spaced.
  if (candidates.length > 7) {
    const expectedSpacing = totalSize / 6;
    const sorted = [...candidates].sort((a, b) => a.start - b.start);

    const scored = sorted.map((band) => {
      const center = (band.start + band.end) / 2;
      const nearestMultiple = Math.round(center / expectedSpacing) * expectedSpacing;
      const error = Math.abs(center - nearestMultiple);
      return { band, error };
    });

    scored.sort((a, b) => a.error - b.error);
    for (let take = Math.min(scored.length, 10); take >= 7; take--) {
      const subset = scored.slice(0, take).map((s) => s.band);
      const subSpans = gridLinesToCellSpans(subset, totalSize, margin);
      if (subSpans.length === 6 && spansAreEven(subSpans, totalSize)) return subset;
    }
  }

  return null;
}

function spansAreEven(
  spans: Array<{ start: number; size: number }>,
  totalSize: number,
): boolean {
  const expected = totalSize / 6;
  const tolerance = expected * 0.3;
  return spans.every((s) => Math.abs(s.size - expected) < tolerance);
}

/**
 * Detect cell rects using two complementary strategies:
 *
 * **Rows (horizontal)**: Darkness-based divider detection.
 *   Header rows (black bg + white text) and grid lines are mostly dark pixels.
 *   We find dark bands (dividers) and use the gaps between them as content rows.
 *   This is robust regardless of cell background color.
 *
 * **Columns (vertical)**: Variance-based grid line detection.
 *   Grid line columns have near-zero variance (uniform color).
 *   Content columns have high variance. Variance is computed only within
 *   detected content rows to exclude headers that dilute the signal.
 *
 * Falls back to template positions per-axis: if rows succeed but columns
 * fail, uses detected rows with template-based columns (hybrid mode).
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
  // ── Horizontal: find content rows via darkness-based divider detection ──
  // Headers (black bg + white text) and grid lines are mostly dark pixels.
  // We find dark bands (dividers) and use the gaps between them as content rows.
  // This is more robust than chromaticity-based detection because header/grid-line
  // darkness is consistent regardless of sprite art content.
  const rowDark = computeRowDarkness(data, width, height);
  const darkBands = findHighBands(rowDark, 0.3);
  console.log(`[GridDetect] Dark divider bands: ${darkBands.length}`, darkBands.map(b => `${b.start}-${b.end} (${b.end-b.start+1}px)`));
  // Merge nearby dark bands (header + adjacent grid line = one divider)
  const mergedDark = mergeNearbyBands(darkBands, 3);
  console.log(`[GridDetect] Merged dividers: ${mergedDark.length}`, mergedDark.map(b => `${b.start}-${b.end} (${b.end-b.start+1}px)`));
  // Content rows are the gaps between dividers — use gridLinesToCellSpans
  const hSpans = gridLinesToCellSpans(mergedDark, height, aaInset);
  console.log(`[GridDetect] Content row spans: ${hSpans.length}`, hSpans.map(s => `${s.start} (${s.size}px)`));

  // ── Vertical: find grid lines via column variance ──────────────────────
  // Compute variance only within detected content rows to exclude uniform
  // header areas that dilute the grid line signal.
  const contentBands: Band[] = hSpans.map(s => ({ start: s.start, end: s.start + s.size - 1 }));
  const colVar = computeColumnVariance(data, width, height, contentBands.length === 6 ? contentBands : undefined);
  const colSorted = Array.from(colVar).sort((a, b) => a - b);
  const colMedian = colSorted[Math.floor(colSorted.length / 2)];

  // Try progressively higher thresholds — JPEG artifacts can give grid lines
  // non-trivial variance, so 2% of median may be too strict.
  let vLines: Band[] | null = null;
  for (const pct of [0.02, 0.05, 0.10]) {
    const threshold = colMedian * pct;
    const vCandidates = findLowBands(colVar, threshold, 20);
    console.log(`[GridDetect] Column: median=${colMedian.toFixed(1)}, threshold=${threshold.toFixed(1)} (${pct*100}%), candidates=${vCandidates.length}`, vCandidates.map(b => `${b.start}-${b.end}`));
    vLines = selectGridLines(vCandidates, width, aaInset);
    if (vLines) {
      console.log(`[GridDetect] Column selectGridLines result: ${vLines.length} lines (at ${pct*100}%)`);
      break;
    }
  }
  if (!vLines) console.log(`[GridDetect] Column selectGridLines: no valid grid found at any threshold`);

  if (hSpans.length !== 6 && !vLines) {
    console.log(`[GridDetect] FULL FALLBACK: hSpans=${hSpans.length}, vLines=${!!vLines}`);
    return templateFallback(width, height, templateBorder, templateCellW, templateCellH, aaInset);
  }

  // Derive final row/column spans, using template as fallback for whichever axis failed
  const finalRows = hSpans.length === 6 ? hSpans : templateColSpans(height, templateCellH, templateBorder, aaInset);
  let finalCols: Array<{ start: number; size: number }>;
  if (vLines) {
    const vSpans = gridLinesToCellSpans(vLines, width, aaInset);
    finalCols = vSpans.length === 6 ? vSpans : templateColSpans(width, templateCellW, templateBorder, aaInset);
  } else {
    finalCols = templateColSpans(width, templateCellW, templateBorder, aaInset);
  }

  if (hSpans.length === 6 && !vLines) {
    console.log(`[GridDetect] HYBRID: detected rows + template columns`);
  }

  const cells: CellRect[] = [];
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      cells.push({
        x: finalCols[col].start,
        y: finalRows[row].start,
        w: finalCols[col].size,
        h: finalRows[row].size,
      });
    }
  }

  return cells;
}

/**
 * Derive 6 evenly-spaced cell spans for one axis using template proportions.
 * Used when detection succeeds on one axis but fails on the other.
 */
function templateColSpans(
  totalSize: number,
  templateCellSize: number,
  templateBorder: number,
  aaInset: number,
): Array<{ start: number; size: number }> {
  const templateTotal = COLS * templateCellSize + (COLS + 1) * templateBorder;
  const spans: Array<{ start: number; size: number }> = [];
  for (let i = 0; i < COLS; i++) {
    const tPos = i * (templateCellSize + templateBorder) + templateBorder;
    const start = Math.round(tPos * totalSize / templateTotal) + aaInset;
    const size = Math.round(templateCellSize * totalSize / templateTotal) - 2 * aaInset;
    spans.push({ start, size: Math.max(size, 1) });
  }
  return spans;
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
    img.onerror = () => reject(new Error(`Failed to load image (${mimeType})`));
    img.src = `data:${mimeType};base64,${base64}`;
  });
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Extract all 36 sprites from a filled grid image.
 *
 * Uses darkness-based row detection and variance-based column detection
 * to locate cell boundaries, then crops each cell directly.
 *
 * The original image data from Gemini is never modified. Posterization
 * is applied to an in-memory copy for grid detection only — sprite
 * crops always come from the unmodified original. Posterized output
 * is handled client-side in the processSprite pipeline.
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

  const originalData = gridCtx.getImageData(0, 0, img.width, img.height);

  // Posterize a copy for grid detection — absorbs JPEG artifacts and makes
  // grid lines / backgrounds perfectly uniform without touching the original.
  const detectionData = posterize(originalData, cfg.posterizeBits);

  const cells = detectGridLines(
    detectionData.data, img.width, img.height,
    cfg.border, cfg.templateCellW, cfg.templateCellH,
    cfg.aaInset,
  );

  if (cells.length !== TOTAL_CELLS) {
    throw new Error(
      `Grid detection found ${cells.length} cells, expected ${TOTAL_CELLS}`,
    );
  }

  // Always crop from the original image — posterization for output is handled
  // client-side in the processSprite pipeline for instant toggling.
  const sprites: ExtractedSprite[] = [];

  for (let idx = 0; idx < TOTAL_CELLS; idx++) {
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
      label: CELL_LABELS[idx],
      imageData: base64,
      mimeType: 'image/png',
      width: cell.w,
      height: cell.h,
    });
  }

  return sprites;
}

/**
 * Compose extracted sprites back into a clean sprite sheet (no grid lines, no headers).
 * Returns a canvas with all sprites arranged in a 6×6 grid.
 */
export async function composeSpriteSheet(
  sprites: ExtractedSprite[],
): Promise<{ canvas: HTMLCanvasElement; base64: string }> {
  if (sprites.length === 0) {
    throw new Error('No sprites to compose');
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
  return { canvas, base64 };
}
