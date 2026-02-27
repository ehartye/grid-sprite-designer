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

  // Calculate cell dimensions from the returned image
  // Note: Gemini may return a different resolution than the template we sent.
  // We compute cell dimensions from the actual image, then scale the header
  // height proportionally to avoid slicing header text into the sprite.
  const totalBorderW = (COLS + 1) * cfg.border;
  const totalBorderH = (ROWS + 1) * cfg.border;
  const cellW = Math.floor((img.width - totalBorderW) / COLS);
  const cellH = Math.floor((img.height - totalBorderH) / ROWS);

  // Scale headerH: template had headerH/templateCellH ratio, apply to actual cellH
  const headerRatio = cfg.headerH / cfg.templateCellH;
  // Add 4px safety margin (scaled) to clear any anti-aliased header text
  const actualHeaderH = Math.ceil(headerRatio * cellH) + 4;
  const contentH = cellH - actualHeaderH;

  if (contentH <= 0 || cellW <= 0) {
    throw new Error(
      `Invalid grid dimensions: ${img.width}x${img.height}, computed cell ${cellW}x${cellH}`,
    );
  }

  const sprites: ExtractedSprite[] = [];

  // Working canvas for slicing cells from the grid
  const workCanvas = document.createElement('canvas');
  workCanvas.width = cellW;
  workCanvas.height = contentH;
  const workCtx = workCanvas.getContext('2d')!;

  for (let idx = 0; idx < TOTAL_CELLS; idx++) {
    const col = idx % COLS;
    const row = Math.floor(idx / COLS);

    // Source position in grid (skip borders + scaled headers)
    const sx = cfg.border + col * (cellW + cfg.border);
    const sy = cfg.border + row * (cellH + cfg.border) + actualHeaderH;

    // Draw cell content onto work canvas
    workCtx.clearRect(0, 0, cellW, contentH);
    workCtx.drawImage(img, sx, sy, cellW, contentH, 0, 0, cellW, contentH);

    // Get raw pixel data and run through the extraction pipeline
    const rawImageData = workCtx.getImageData(0, 0, cellW, contentH);
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
