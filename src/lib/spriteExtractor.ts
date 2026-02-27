/**
 * Extract individual sprites from a filled 6×6 grid image.
 *
 * Uses flood-fill background removal with color decontamination (defringe),
 * matching the pipeline from the Python test scripts:
 *   1. Flood-fill from corners/edges to detect background (any color)
 *   2. Interior void pass for enclosed background regions
 *   3. Color decontamination at sprite edges (soft alpha fringe)
 *   4. Border artifact cleanup
 *   5. Small island removal
 */

import { COLS, ROWS, TOTAL_CELLS, CELL_LABELS } from './poses';

// ── Types ────────────────────────────────────────────────────────────────────

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
  /** Header strip height in the original template */
  headerH: number;
  /** Grid line thickness in the original template */
  border: number;
  /** Original template cell height (used to scale headerH to actual image) */
  templateCellH: number;
  /** Flood-fill tolerance: max RGB distance to seed color to count as bg */
  floodTolerance: number;
  /** Interior void tolerance: tighter to avoid eating dark sprite areas */
  interiorTolerance: number;
  /** How many pixels from bg boundary to decontaminate */
  defringeWidth: number;
  /** Min connected-component area to keep (removes stray pixel noise) */
  minIsland: number;
  /** Border pixels to blank (kills grid-line / header bleed) */
  borderBlank: number;
}

const DEFAULT_EXTRACTION: ExtractionConfig = {
  headerH: 14,
  border: 2,
  templateCellH: 339,
  floodTolerance: 45,
  interiorTolerance: 20,
  defringeWidth: 4,
  minIsland: 20,
  borderBlank: 6,
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

  // ── Step 1: Detect vertical lines (clean — no header confusion) ──
  const vLines: GridLine[] = [];
  for (const pos of expectedV) {
    const line = findGridLineInWindow(vProfile, pos, searchWindow, vThreshold);
    vLines.push(line || { center: pos, start: pos, end: pos });
  }

  // ── Step 2: Measure actual border width from vertical bands ──
  const interiorVBands = vLines.slice(1, -1);
  const avgBorderWidth = interiorVBands.length > 0
    ? Math.round(
        interiorVBands.reduce((s, l) => s + (l.end - l.start + 1), 0)
        / interiorVBands.length,
      )
    : templateBorder;
  const halfBorder = Math.ceil(avgBorderWidth / 2);

  // ── Step 3: Detect horizontal line CENTERS only ──
  // Band expansion would swallow header dark strips, so we only
  // use the center (darkest point) and apply the measured border offset.
  // Note: these centers may be imprecise due to header/border confusion in
  // the brightness profile. Per-cell chromatic detection (header + footer)
  // handles the actual content boundaries precisely.
  const hCenters: number[] = [];
  for (const pos of expectedH) {
    const line = findGridLineInWindow(hProfile, pos, searchWindow, hThreshold);
    hCenters.push(line ? line.center : pos);
  }

  // ── Step 4: Derive cell rectangles ──
  const cells: CellRect[] = [];
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      // Vertical: use band edges (reliable)
      const cellX = vLines[col].end + 1;
      const cellRight = vLines[col + 1].start - 1;

      // Horizontal: use center + halfBorder offset (avoids header confusion)
      const cellY = hCenters[row] + halfBorder + 1;
      const cellBottom = hCenters[row + 1] - halfBorder - 1;

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

// ── Flood-fill background detection ──────────────────────────────────────────

/**
 * Detect background by flood-filling from all four corners and edge midpoints.
 * Each seed region remembers its anchor color (median of a corner patch).
 * Pixels are compared against the anchor — not neighbors — to prevent
 * gradient-drift from leaking into the sprite.
 */
function floodFillBg(
  data: Uint8ClampedArray,
  w: number,
  h: number,
  tolerance: number,
  borderBlank: number,
): { bgMask: Uint8Array; bgColor: Float64Array } {
  const bgMask = new Uint8Array(w * h);
  const visited = new Uint8Array(w * h);
  const tolSq = tolerance * tolerance;

  // Inset past border artifacts (grid lines bleed dark pixels into corners)
  const ins = borderBlank + 2;
  const patchSize = 8;

  /** Compute median color of a rectangular patch */
  function patchMedian(
    px: number,
    py: number,
    pw: number,
    ph: number,
  ): [number, number, number] {
    const rs: number[] = [];
    const gs: number[] = [];
    const bs: number[] = [];
    const endY = Math.min(py + ph, h);
    const endX = Math.min(px + pw, w);
    for (let y = Math.max(py, 0); y < endY; y++) {
      for (let x = Math.max(px, 0); x < endX; x++) {
        const idx = (y * w + x) * 4;
        rs.push(data[idx]);
        gs.push(data[idx + 1]);
        bs.push(data[idx + 2]);
      }
    }
    if (rs.length === 0) return [data[0], data[1], data[2]];
    rs.sort((a, b) => a - b);
    gs.sort((a, b) => a - b);
    bs.sort((a, b) => a - b);
    const mid = Math.floor(rs.length / 2);
    return [rs[mid], gs[mid], bs[mid]];
  }

  // Seed points: 4 corners + 4 edge midpoints (y, x)
  const seeds: [number, number][] = [
    // Corners
    [ins, ins],
    [ins, w - 1 - ins],
    [h - 1 - ins, ins],
    [h - 1 - ins, w - 1 - ins],
    // Edge midpoints
    [ins, Math.floor(w / 2)],
    [h - 1 - ins, Math.floor(w / 2)],
    [Math.floor(h / 2), ins],
    [Math.floor(h / 2), w - 1 - ins],
  ];

  // Patch origins for anchor color computation (y, x)
  const patches: [number, number][] = [
    // Corners
    [ins, ins],
    [ins, w - ins - patchSize],
    [h - ins - patchSize, ins],
    [h - ins - patchSize, w - ins - patchSize],
    // Edge midpoints
    [ins, Math.floor(w / 2) - Math.floor(patchSize / 2)],
    [h - ins - patchSize, Math.floor(w / 2) - Math.floor(patchSize / 2)],
    [Math.floor(h / 2) - Math.floor(patchSize / 2), ins],
    [Math.floor(h / 2) - Math.floor(patchSize / 2), w - ins - patchSize],
  ];

  const anchors: [number, number, number][] = [];

  for (let i = 0; i < seeds.length; i++) {
    const [sy, sx] = seeds[i];
    const [py, px] = patches[i];

    if (sy < 0 || sy >= h || sx < 0 || sx >= w) continue;

    const anchor = patchMedian(px, py, patchSize, patchSize);
    const seedPos = sy * w + sx;
    if (visited[seedPos]) continue;

    // Verify seed pixel is close to patch median
    const si = seedPos * 4;
    const dr = data[si] - anchor[0];
    const dg = data[si + 1] - anchor[1];
    const db = data[si + 2] - anchor[2];
    if (dr * dr + dg * dg + db * db > tolSq) continue;

    anchors.push(anchor);

    // BFS flood fill from this seed
    const queue: number[] = [seedPos];
    let front = 0;
    visited[seedPos] = 1;
    bgMask[seedPos] = 1;

    while (front < queue.length) {
      const pos = queue[front++];
      const cy = (pos / w) | 0;
      const cx = pos % w;

      // 4-connected neighbors
      if (cy > 0 && !visited[pos - w]) {
        visited[pos - w] = 1;
        const ni = (pos - w) * 4;
        const d0 = data[ni] - anchor[0];
        const d1 = data[ni + 1] - anchor[1];
        const d2 = data[ni + 2] - anchor[2];
        if (d0 * d0 + d1 * d1 + d2 * d2 <= tolSq) {
          bgMask[pos - w] = 1;
          queue.push(pos - w);
        }
      }
      if (cy < h - 1 && !visited[pos + w]) {
        visited[pos + w] = 1;
        const ni = (pos + w) * 4;
        const d0 = data[ni] - anchor[0];
        const d1 = data[ni + 1] - anchor[1];
        const d2 = data[ni + 2] - anchor[2];
        if (d0 * d0 + d1 * d1 + d2 * d2 <= tolSq) {
          bgMask[pos + w] = 1;
          queue.push(pos + w);
        }
      }
      if (cx > 0 && !visited[pos - 1]) {
        visited[pos - 1] = 1;
        const ni = (pos - 1) * 4;
        const d0 = data[ni] - anchor[0];
        const d1 = data[ni + 1] - anchor[1];
        const d2 = data[ni + 2] - anchor[2];
        if (d0 * d0 + d1 * d1 + d2 * d2 <= tolSq) {
          bgMask[pos - 1] = 1;
          queue.push(pos - 1);
        }
      }
      if (cx < w - 1 && !visited[pos + 1]) {
        visited[pos + 1] = 1;
        const ni = (pos + 1) * 4;
        const d0 = data[ni] - anchor[0];
        const d1 = data[ni + 1] - anchor[1];
        const d2 = data[ni + 2] - anchor[2];
        if (d0 * d0 + d1 * d1 + d2 * d2 <= tolSq) {
          bgMask[pos + 1] = 1;
          queue.push(pos + 1);
        }
      }
    }
  }

  // Compute median bg color from the flood-filled region
  const bgColor = new Float64Array(3);
  const bgPixelsR: number[] = [];
  const bgPixelsG: number[] = [];
  const bgPixelsB: number[] = [];
  const sampleLimit = 10000;

  for (let i = 0; i < w * h && bgPixelsR.length < sampleLimit; i++) {
    if (bgMask[i]) {
      const idx = i * 4;
      bgPixelsR.push(data[idx]);
      bgPixelsG.push(data[idx + 1]);
      bgPixelsB.push(data[idx + 2]);
    }
  }

  if (bgPixelsR.length > 0) {
    bgPixelsR.sort((a, b) => a - b);
    bgPixelsG.sort((a, b) => a - b);
    bgPixelsB.sort((a, b) => a - b);
    const mid = Math.floor(bgPixelsR.length / 2);
    bgColor[0] = bgPixelsR[mid];
    bgColor[1] = bgPixelsG[mid];
    bgColor[2] = bgPixelsB[mid];
  } else if (anchors.length > 0) {
    bgColor[0] = anchors[0][0];
    bgColor[1] = anchors[0][1];
    bgColor[2] = anchors[0][2];
  } else {
    bgColor[0] = data[0];
    bgColor[1] = data[1];
    bgColor[2] = data[2];
  }

  return { bgMask, bgColor };
}

// ── BFS distance transform from background ───────────────────────────────────

/**
 * Multi-source BFS from all background pixels into foreground.
 * Returns distance (in pixel steps) from the nearest background pixel.
 * bg pixels → 0, sprite pixels → positive integer.
 */
function distanceFromBackground(
  spriteMask: Uint8Array,
  w: number,
  h: number,
): Float32Array {
  const dist = new Float32Array(w * h);
  dist.fill(-1);

  const queue: number[] = [];
  let front = 0;

  // Seed: all background pixels
  for (let i = 0; i < w * h; i++) {
    if (!spriteMask[i]) {
      dist[i] = 0;
      queue.push(i);
    }
  }

  while (front < queue.length) {
    const pos = queue[front++];
    const cy = (pos / w) | 0;
    const cx = pos % w;
    const nextDist = dist[pos] + 1;

    if (cy > 0 && dist[pos - w] < 0) {
      dist[pos - w] = nextDist;
      queue.push(pos - w);
    }
    if (cy < h - 1 && dist[pos + w] < 0) {
      dist[pos + w] = nextDist;
      queue.push(pos + w);
    }
    if (cx > 0 && dist[pos - 1] < 0) {
      dist[pos - 1] = nextDist;
      queue.push(pos - 1);
    }
    if (cx < w - 1 && dist[pos + 1] < 0) {
      dist[pos + 1] = nextDist;
      queue.push(pos + 1);
    }
  }

  // Unreached pixels → 0
  for (let i = 0; i < dist.length; i++) {
    if (dist[i] < 0) dist[i] = 0;
  }

  return dist;
}

// ── Connected component labeling + island removal ────────────────────────────

/**
 * Remove tiny opaque blobs (stray pixels / noise).
 * Mutates the RGBA data in place.
 */
function removeSmallIslands(
  data: Uint8ClampedArray,
  w: number,
  h: number,
  minArea: number,
): void {
  const labels = new Int32Array(w * h);
  let nextLabel = 1;

  for (let i = 0; i < w * h; i++) {
    if (data[i * 4 + 3] > 0 && labels[i] === 0) {
      const component: number[] = [i];
      const queue: number[] = [i];
      let front = 0;
      labels[i] = nextLabel;

      while (front < queue.length) {
        const pos = queue[front++];
        const cy = (pos / w) | 0;
        const cx = pos % w;

        const neighbors = [
          cy > 0 ? pos - w : -1,
          cy < h - 1 ? pos + w : -1,
          cx > 0 ? pos - 1 : -1,
          cx < w - 1 ? pos + 1 : -1,
        ];

        for (const npos of neighbors) {
          if (npos >= 0 && labels[npos] === 0 && data[npos * 4 + 3] > 0) {
            labels[npos] = nextLabel;
            queue.push(npos);
            component.push(npos);
          }
        }
      }

      if (component.length < minArea) {
        for (const pos of component) {
          data[pos * 4 + 3] = 0;
        }
      }

      nextLabel++;
    }
  }
}

// ── Full background removal pipeline for a single cell ───────────────────────

/**
 * Process a single cell through the full extraction pipeline:
 *   1. Flood-fill from corners/edges to find connected background
 *   2. Interior void pass to catch enclosed bg regions
 *   3. Hard-remove all background pixels
 *   4. Color decontamination (defringe) at sprite edges
 *   5. Border artifact cleanup
 *   6. Small island removal
 */
function processCell(
  imageData: ImageData,
  config: ExtractionConfig,
): ImageData {
  const { width: w, height: h } = imageData;
  const srcData = imageData.data;

  // 1. Flood-fill from corners/edges to detect background
  const { bgMask, bgColor } = floodFillBg(
    srcData, w, h, config.floodTolerance, config.borderBlank,
  );

  // 2. Interior void pass — catch bg-colored regions NOT connected to edges
  const interiorTolSq = config.interiorTolerance * config.interiorTolerance;
  const fullBg = new Uint8Array(bgMask);
  for (let i = 0; i < w * h; i++) {
    if (!fullBg[i]) {
      const idx = i * 4;
      const dr = srcData[idx] - bgColor[0];
      const dg = srcData[idx + 1] - bgColor[1];
      const db = srcData[idx + 2] - bgColor[2];
      if (dr * dr + dg * dg + db * db < interiorTolSq) {
        fullBg[i] = 1;
      }
    }
  }

  // 3. Create result with hard bg removal
  const result = new ImageData(new Uint8ClampedArray(srcData), w, h);
  const data = result.data;

  for (let i = 0; i < w * h; i++) {
    if (fullBg[i]) {
      const idx = i * 4;
      data[idx] = 0;
      data[idx + 1] = 0;
      data[idx + 2] = 0;
      data[idx + 3] = 0;
    }
  }

  // 4. Color decontamination (defringe)
  if (config.defringeWidth > 0) {
    const spriteMask = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) {
      spriteMask[i] = fullBg[i] ? 0 : 1;
    }

    const distFromBg = distanceFromBackground(spriteMask, w, h);

    for (let i = 0; i < w * h; i++) {
      const d = distFromBg[i];
      if (d > 0 && d <= config.defringeWidth) {
        const idx = i * 4;
        // Use original (pre-removal) pixel colors for decontamination
        const pr = srcData[idx];
        const pg = srcData[idx + 1];
        const pb = srcData[idx + 2];

        // Color distance from background
        const diffR = pr - bgColor[0];
        const diffG = pg - bgColor[1];
        const diffB = pb - bgColor[2];
        const pixBgDist = Math.sqrt(
          diffR * diffR + diffG * diffG + diffB * diffB,
        );

        const maxDist = config.floodTolerance * 2.0;

        // Alpha from color: how much sprite vs bg is in this pixel
        const alphaColor = Math.min(pixBgDist / maxDist, 1);
        // Alpha from spatial distance: closer to bg = more contaminated
        const alphaSpatial = Math.min(d / config.defringeWidth, 1);
        // Combined alpha: bias toward color-based (more accurate)
        const alpha = Math.max(
          0.05,
          Math.min(1, alphaColor * 0.7 + alphaSpatial * 0.3),
        );

        // Solve for decontaminated sprite color:
        //   pixel = alpha * sprite + (1-alpha) * bg
        //   sprite = (pixel - (1-alpha) * bg) / alpha
        const divAlpha = Math.max(alpha, 0.1);
        const sr = (pr - (1 - alpha) * bgColor[0]) / divAlpha;
        const sg = (pg - (1 - alpha) * bgColor[1]) / divAlpha;
        const sb = (pb - (1 - alpha) * bgColor[2]) / divAlpha;

        data[idx] = Math.round(Math.max(0, Math.min(255, sr)));
        data[idx + 1] = Math.round(Math.max(0, Math.min(255, sg)));
        data[idx + 2] = Math.round(Math.max(0, Math.min(255, sb)));
        data[idx + 3] = Math.round(alpha * 255);
      }
    }
  }

  // 5. Clean border artifacts — zero alpha on thin border
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (
        y < config.borderBlank ||
        y >= h - config.borderBlank ||
        x < config.borderBlank ||
        x >= w - config.borderBlank
      ) {
        data[(y * w + x) * 4 + 3] = 0;
      }
    }
  }

  // 6. Remove small islands
  removeSmallIslands(data, w, h, config.minIsland);

  return result;
}

// ── Public API ───────────────────────────────────────────────────────────────

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
          if (maxC > 30 && (maxC - minC) / maxC > 0.3) {
            chromaCount++;
          }
        }
      }

      if (totalSamples > 0 && chromaCount / totalSamples > 0.10) {
        // +1 to skip the anti-aliased transition row at the header/content boundary
        return Math.max(y + 1, 2);
      }
    }

    return 2;
  }

  const sprites: ExtractedSprite[] = [];

  for (let idx = 0; idx < TOTAL_CELLS; idx++) {
    const cell = cells[idx];

    // Dynamically detect header height for this cell
    const headerH = detectCellHeader(cell.x, cell.y, cell.w, cell.h);
    const contentH = cell.h - headerH;

    if (contentH <= 0) continue;

    // Working canvas for this cell's content (below header)
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

    // Run through the extraction pipeline (flood-fill bg removal, defringe, etc.)
    const rawImageData = workCtx.getImageData(0, 0, cell.w, contentH);
    const processed = processCell(rawImageData, cfg);

    // Convert to PNG base64
    workCtx.putImageData(processed, 0, 0);
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
