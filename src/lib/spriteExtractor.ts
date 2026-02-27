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
  /** Original template cell height (used to scale headerH to actual image) */
  templateCellH: number;
  /** Extra inset (px) to clip anti-aliased border remnants */
  aaInset: number;
}

const DEFAULT_EXTRACTION: ExtractionConfig = {
  headerH: 14,
  border: 2,
  templateCellH: 339,
  aaInset: 3,
};

// ── Grid line detection ─────────────────────────────────────────────────────

interface GridLine {
  center: number;
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
 * Compute average brightness (luminance) for each row or column.
 * Sample every 2nd pixel in the cross-dimension for performance.
 */
function computeBrightnessProfile(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  axis: 'horizontal' | 'vertical',
): Float64Array {
  const len = axis === 'horizontal' ? height : width;
  const profile = new Float64Array(len);

  if (axis === 'horizontal') {
    for (let y = 0; y < height; y++) {
      let sum = 0;
      let count = 0;
      for (let x = 0; x < width; x += 2) {
        const i = (y * width + x) * 4;
        sum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        count++;
      }
      profile[y] = sum / count;
    }
  } else {
    for (let x = 0; x < width; x++) {
      let sum = 0;
      let count = 0;
      for (let y = 0; y < height; y += 2) {
        const i = (y * width + x) * 4;
        sum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        count++;
      }
      profile[x] = sum / count;
    }
  }

  return profile;
}

/**
 * Compute average saturation for each row or column.
 * Saturation = (max - min) / max for each pixel's RGB channels.
 * High-saturation columns/rows correspond to colored grid lines (pink, magenta).
 */
function computeSaturationProfile(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  axis: 'horizontal' | 'vertical',
): Float64Array {
  const len = axis === 'horizontal' ? height : width;
  const profile = new Float64Array(len);

  if (axis === 'horizontal') {
    for (let y = 0; y < height; y++) {
      let sum = 0;
      let count = 0;
      for (let x = 0; x < width; x += 2) {
        const i = (y * width + x) * 4;
        const maxC = Math.max(data[i], data[i + 1], data[i + 2]);
        if (maxC > 0) {
          const minC = Math.min(data[i], data[i + 1], data[i + 2]);
          sum += (maxC - minC) / maxC;
        }
        count++;
      }
      profile[y] = sum / count;
    }
  } else {
    for (let x = 0; x < width; x++) {
      let sum = 0;
      let count = 0;
      for (let y = 0; y < height; y += 2) {
        const i = (y * width + x) * 4;
        const maxC = Math.max(data[i], data[i + 1], data[i + 2]);
        if (maxC > 0) {
          const minC = Math.min(data[i], data[i + 1], data[i + 2]);
          sum += (maxC - minC) / maxC;
        }
        count++;
      }
      profile[x] = sum / count;
    }
  }

  return profile;
}

/**
 * Smooth a 1D profile with a 3-tap triangular kernel: [1, 2, 1] / 4.
 */
function smoothProfile(profile: Float64Array): Float64Array {
  const out = new Float64Array(profile.length);
  out[0] = profile[0];
  out[profile.length - 1] = profile[profile.length - 1];
  for (let i = 1; i < profile.length - 1; i++) {
    out[i] = (profile[i - 1] + 2 * profile[i] + profile[i + 1]) / 4;
  }
  return out;
}

/**
 * Find a grid line near an expected position by searching for the darkest
 * valley within a window, then expanding to the full dark band.
 */
function findGridLineInWindow(
  profile: Float64Array,
  expectedPos: number,
  windowRadius: number,
  threshold: number,
): GridLine | null {
  const start = Math.max(0, expectedPos - windowRadius);
  const end = Math.min(profile.length - 1, expectedPos + windowRadius);

  // Find the darkest row in the window
  let minVal = Infinity;
  let minIdx = expectedPos;
  for (let i = start; i <= end; i++) {
    if (profile[i] < minVal) {
      minVal = profile[i];
      minIdx = i;
    }
  }

  // Must be below threshold to count
  if (minVal > threshold) return null;

  // Expand the band: consecutive rows below threshold
  let bandStart = minIdx;
  let bandEnd = minIdx;
  while (bandStart > 0 && profile[bandStart - 1] < threshold) bandStart--;
  while (bandEnd < profile.length - 1 && profile[bandEnd + 1] < threshold) bandEnd++;

  return {
    center: minIdx,
    start: bandStart,
    end: bandEnd,
  };
}

/**
 * Find a grid line near an expected position by searching for the highest
 * saturation peak within a window, then expanding to the full saturated band.
 * This is the inverse of findGridLineInWindow — for colored (not dark) lines.
 */
function findGridLineBySaturationPeak(
  profile: Float64Array,
  expectedPos: number,
  windowRadius: number,
  threshold: number,
): GridLine | null {
  const start = Math.max(0, expectedPos - windowRadius);
  const end = Math.min(profile.length - 1, expectedPos + windowRadius);

  // Find the most saturated position in the window
  let maxVal = -Infinity;
  let maxIdx = expectedPos;
  for (let i = start; i <= end; i++) {
    if (profile[i] > maxVal) {
      maxVal = profile[i];
      maxIdx = i;
    }
  }

  // Must be above threshold to count
  if (maxVal < threshold) return null;

  // Expand the band using a LOCAL threshold (80% of peak value).
  // The external threshold is for peak detection; the local threshold
  // prevents JPEG anti-aliasing from inflating the band width.
  const bandThreshold = Math.max(threshold, maxVal * 0.8);
  let bandStart = maxIdx;
  let bandEnd = maxIdx;
  while (bandStart > 0 && profile[bandStart - 1] > bandThreshold) bandStart--;
  while (bandEnd < profile.length - 1 && profile[bandEnd + 1] > bandThreshold) bandEnd++;

  return {
    center: maxIdx,
    start: bandStart,
    end: bandEnd,
  };
}

/**
 * Score a set of detected grid lines by uniformity and quality.
 * Lower score = better detection. Considers:
 * - Cell spacing uniformity (coefficient of variation)
 * - Penalty for template-fallback lines (artificially perfect uniformity)
 * - Penalty for unreasonably wide borders (false-positive dark bands)
 */
function scoreGridLines(
  lines: GridLine[],
  expectedPositions: number[],
  templateBorder: number,
): number {
  const gaps: number[] = [];
  for (let i = 0; i < lines.length - 1; i++) {
    gaps.push(lines[i + 1].center - lines[i].center);
  }
  if (gaps.length === 0) return Infinity;
  const gapMean = gaps.reduce((s, g) => s + g, 0) / gaps.length;
  if (gapMean === 0) return Infinity;
  const gapVar = gaps.reduce((s, g) => s + (g - gapMean) ** 2, 0) / gaps.length;
  const gapCV = Math.sqrt(gapVar) / gapMean;

  // Penalize template fallbacks (undetected lines default to template positions)
  let fallbackCount = 0;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].center === expectedPositions[i] && lines[i].start === lines[i].end) {
      fallbackCount++;
    }
  }
  // Weight ×2: template defaults (no real detection) should strongly lose
  // to any actual detection, even with imperfect band widths
  const fallbackPenalty = (fallbackCount / lines.length) * 2;

  // Penalize unreasonably wide borders (> 5× template).
  // Relaxed from 3× to 5× because JPEG anti-aliasing around colored
  // grid lines can widen detected bands to ~6-8px from a 2px original.
  const interior = lines.slice(1, -1);
  const widths = interior.map(l => l.end - l.start + 1);
  const avgWidth = widths.length > 0
    ? widths.reduce((s, w) => s + w, 0) / widths.length
    : templateBorder;
  const borderPenalty = avgWidth > templateBorder * 5
    ? (avgWidth - templateBorder) / templateBorder
    : 0;

  return gapCV + fallbackPenalty + borderPenalty;
}

/**
 * Detect the actual grid line positions in a filled grid image by
 * scanning brightness profiles and using template positions as priors.
 *
 * Strategy:
 *  1. Detect VERTICAL lines first — these are clean (no header confusion).
 *  2. Measure the actual border width from vertical line bands.
 *  3. Detect HORIZONTAL line CENTERS only (the darkest point near each
 *     expected position). We avoid expanding bands because the dark header
 *     strips get swallowed, producing non-uniform cell heights.
 *  4. Use the measured border width to compute cell boundaries from centers.
 *
 * Returns 36 cell rectangles derived from detected grid lines.
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
  const templateImgW = COLS * templateCellW + (COLS + 1) * templateBorder;
  const templateImgH = ROWS * templateCellH + (ROWS + 1) * templateBorder;

  // Compute expected grid line positions scaled to actual image size
  const expectedH: number[] = [];
  const expectedV: number[] = [];
  for (let i = 0; i <= COLS; i++) {
    const templatePos = i * (templateCellW + templateBorder);
    expectedV.push(Math.round(templatePos * width / templateImgW));
  }
  for (let i = 0; i <= ROWS; i++) {
    const templatePos = i * (templateCellH + templateBorder);
    expectedH.push(Math.round(templatePos * height / templateImgH));
  }

  // Compute brightness profiles
  const hProfile = smoothProfile(computeBrightnessProfile(data, width, height, 'horizontal'));
  const vProfile = smoothProfile(computeBrightnessProfile(data, width, height, 'vertical'));

  function computeThreshold(profile: Float64Array): number {
    const sorted = Array.from(profile).sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    return median * 0.5;
  }

  const vThreshold = computeThreshold(vProfile);
  const hThreshold = computeThreshold(hProfile);
  const searchWindow = Math.max(25, Math.ceil(height * 0.05));

  // ── Step 1: Detect vertical lines — try both brightness and saturation, pick best ──
  const vLinesBright: GridLine[] = [];
  for (const pos of expectedV) {
    const line = findGridLineInWindow(vProfile, pos, searchWindow, vThreshold);
    vLinesBright.push(line || { center: pos, start: pos, end: pos });
  }

  const vSatProfile = smoothProfile(
    computeSaturationProfile(data, width, height, 'vertical'),
  );
  const sortedVSat = Array.from(vSatProfile).sort((a, b) => a - b);
  const vSatThreshold = sortedVSat[Math.floor(sortedVSat.length * 0.85)];

  const vLinesSat: GridLine[] = [];
  for (const pos of expectedV) {
    const line = findGridLineBySaturationPeak(vSatProfile, pos, searchWindow, vSatThreshold);
    vLinesSat.push(line || { center: pos, start: pos, end: pos });
  }

  const vLines = scoreGridLines(vLinesBright, expectedV, templateBorder)
    <= scoreGridLines(vLinesSat, expectedV, templateBorder)
    ? vLinesBright : vLinesSat;

  // ── Step 2: Measure actual border width from vertical bands ──
  const interiorVBands = vLines.slice(1, -1);
  const avgBorderWidth = interiorVBands.length > 0
    ? Math.round(
        interiorVBands.reduce((s, l) => s + (l.end - l.start + 1), 0)
        / interiorVBands.length,
      )
    : templateBorder;
  const halfBorder = Math.ceil(avgBorderWidth / 2);

  // ── Step 3: Detect horizontal lines — try both brightness and saturation, pick best ──
  const hLinesBright: GridLine[] = [];
  for (const pos of expectedH) {
    const line = findGridLineInWindow(hProfile, pos, searchWindow, hThreshold);
    hLinesBright.push(line || { center: pos, start: pos, end: pos });
  }

  const hSatProfile = smoothProfile(
    computeSaturationProfile(data, width, height, 'horizontal'),
  );
  const sortedHSat = Array.from(hSatProfile).sort((a, b) => a - b);
  const hSatThreshold = sortedHSat[Math.floor(sortedHSat.length * 0.85)];

  const hLinesSat: GridLine[] = [];
  for (const pos of expectedH) {
    const line = findGridLineBySaturationPeak(hSatProfile, pos, searchWindow, hSatThreshold);
    hLinesSat.push(line || { center: pos, start: pos, end: pos });
  }

  const hBestLines = scoreGridLines(hLinesBright, expectedH, templateBorder)
    <= scoreGridLines(hLinesSat, expectedH, templateBorder)
    ? hLinesBright : hLinesSat;
  const hCenters = hBestLines.map(l => l.center);

  // ── Step 4: Derive cell rectangles ──
  // Extra inset to clip anti-aliased border remnants (the gradient
  // transition zone around grid lines that falls below the detection
  // threshold but is still faintly visible).
  const AA_INSET = aaInset;

  const cells: CellRect[] = [];
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      // Vertical: use band edges (reliable)
      const cellX = vLines[col].end + 1 + AA_INSET;
      const cellRight = vLines[col + 1].start - 1 - AA_INSET;

      // Horizontal: use center + halfBorder offset (avoids header confusion)
      const cellY = hCenters[row] + halfBorder + 1 + AA_INSET;
      const cellBottom = hCenters[row + 1] - halfBorder - 1 - AA_INSET;

      const w = cellRight - cellX + 1;
      const h = cellBottom - cellY + 1;

      cells.push({ x: cellX, y: cellY, w: Math.max(w, 1), h: Math.max(h, 1) });
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
    cfg.border, cfg.templateCellH, cfg.templateCellH, // square cells
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

      if (totalSamples > 0 && chromaCount / totalSamples > 0.10) {
        return y;
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
