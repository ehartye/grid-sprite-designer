/**
 * Chroma-key (color removal) for sprite images.
 * Two-pass approach:
 *  1. Conservative global pass removes clear background matches.
 *  2. Defringe pass aggressively softens pixels bordering transparency,
 *     cleaning up magenta fringe without punching holes in the sprite.
 */

/**
 * Auto-detect the dominant background color from a sprite's edge pixels.
 * Samples a border ring, buckets colors, and returns the most frequent.
 * Falls back to #FF00FF if no dominant color is found.
 */
export function detectKeyColor(
  source: ImageData,
  borderWidth = 3,
): [number, number, number] {
  const { width, height, data } = source;
  const BUCKET_SIZE = 16;
  const counts = new Map<string, { count: number; sumR: number; sumG: number; sumB: number }>();
  let totalEdgePixels = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      // Only sample border pixels
      if (x >= borderWidth && x < width - borderWidth &&
          y >= borderWidth && y < height - borderWidth) continue;

      const i = (y * width + x) * 4;
      if (data[i + 3] === 0) continue; // skip transparent

      const r = data[i], g = data[i + 1], b = data[i + 2];
      const br = Math.round(r / BUCKET_SIZE) * BUCKET_SIZE;
      const bg = Math.round(g / BUCKET_SIZE) * BUCKET_SIZE;
      const bb = Math.round(b / BUCKET_SIZE) * BUCKET_SIZE;
      const key = `${br},${bg},${bb}`;

      const entry = counts.get(key);
      if (entry) {
        entry.count++;
        entry.sumR += r;
        entry.sumG += g;
        entry.sumB += b;
      } else {
        counts.set(key, { count: 1, sumR: r, sumG: g, sumB: b });
      }
      totalEdgePixels++;
    }
  }

  if (totalEdgePixels === 0) return [255, 0, 255];

  // Find the most frequent bucket
  let best: { count: number; sumR: number; sumG: number; sumB: number } | null = null;
  for (const entry of counts.values()) {
    if (!best || entry.count > best.count) best = entry;
  }

  if (!best || best.count / totalEdgePixels < 0.2) return [255, 0, 255];

  // Return the average color within the winning bucket
  return [
    Math.round(best.sumR / best.count),
    Math.round(best.sumG / best.count),
    Math.round(best.sumB / best.count),
  ];
}

/**
 * Apply chroma-key removal to ImageData with defringe.
 * Default target: #FF00FF (magenta).
 */
export function applyChromaKey(
  source: ImageData,
  tolerance: number,
  defringeCoreOverride?: number,
  keyR = 255,
  keyG = 0,
  keyB = 255,
): ImageData {
  if (tolerance <= 0) return new ImageData(
    new Uint8ClampedArray(source.data),
    source.width,
    source.height,
  );

  const { width, height } = source;
  const out = new ImageData(
    new Uint8ClampedArray(source.data),
    width,
    height,
  );
  const data = out.data;

  const coreThreshold = tolerance * 3;
  // Width of the soft alpha ramp (in Manhattan-distance units) around the core
  // key color. Pixels within coreThreshold are fully transparent; those between
  // coreThreshold and coreThreshold+SOFT_EDGE_WIDTH get partial alpha.
  // 60 gives a smooth fade that avoids hard cutoffs on anti-aliased sprite edges.
  const SOFT_EDGE_WIDTH = 90;
  const outerThreshold = coreThreshold + SOFT_EDGE_WIDTH;

  function colorDist(i: number): number {
    return (
      Math.abs(data[i] - keyR) +
      Math.abs(data[i + 1] - keyG) +
      Math.abs(data[i + 2] - keyB)
    );
  }

  // ── Pass 1: Conservative global removal ──────────────────────────────────
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) continue;
    const dist = colorDist(i);
    if (dist < coreThreshold) {
      data[i + 3] = 0;
    } else if (dist < outerThreshold) {
      const t = (dist - coreThreshold) / SOFT_EDGE_WIDTH;
      data[i + 3] = Math.round(t * data[i + 3]);
    }
  }

  // ── Pass 2: Defringe ─────────────────────────────────────────────────────
  // Iteratively soften pixels that border transparent areas.
  // Uses a fixed core threshold (independent of the tolerance slider) so
  // defringe stays constant even at low chroma settings.
  const DEFRINGE_PASSES = 4;
  const defringeThreshold = 500;
  const defringeCoreThreshold = defringeCoreOverride ?? 240;

  for (let pass = 0; pass < DEFRINGE_PASSES; pass++) {
    // Snapshot current alpha so we check neighbors against the state
    // at the start of this pass, not mid-mutation.
    const alphaSnapshot = new Uint8Array(width * height);
    for (let pi = 0; pi < width * height; pi++) {
      alphaSnapshot[pi] = data[pi * 4 + 3];
    }

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const pi = y * width + x;
        const i = pi * 4;
        if (alphaSnapshot[pi] === 0) continue;

        // Check if any neighbor is transparent
        const hasTransparentNeighbor =
          (x > 0 && alphaSnapshot[pi - 1] === 0) ||
          (x < width - 1 && alphaSnapshot[pi + 1] === 0) ||
          (y > 0 && alphaSnapshot[pi - width] === 0) ||
          (y < height - 1 && alphaSnapshot[pi + width] === 0);

        if (!hasTransparentNeighbor) continue;

        const dist = colorDist(i);
        if (dist < defringeCoreThreshold) {
          data[i + 3] = 0;
        } else if (dist < defringeThreshold) {
          const t = (dist - defringeCoreThreshold) / (defringeThreshold - defringeCoreThreshold);
          data[i + 3] = Math.min(data[i + 3], Math.round(t * 255));
        }
      }
    }
  }

  return out;
}

/**
 * Replace pink-tinted edge pixels with their nearest non-pink neighbor color.
 * Runs after chroma key to clean up fringe without altering alpha.
 * Pixels bordering transparency that have a magenta tint get their RGB
 * replaced by the average of nearby opaque, non-pink neighbors.
 */
export function defringeRecolor(
  source: ImageData,
  keyR = 255,
  keyG = 0,
  keyB = 255,
  passes = 3,
  sensitivity = 50,
): ImageData {
  const { width, height } = source;
  const out = new ImageData(
    new Uint8ClampedArray(source.data),
    width,
    height,
  );
  const data = out.data;

  // Sensitivity controls how liberally we classify pixels as "pink".
  // sensitivity 0 → ratio 0.70 (very strict, only obvious magenta)
  // sensitivity 50 → ratio 0.85 (default)
  // sensitivity 100 → ratio 1.00 (anything where green < avg of red+blue)
  const pinkRatio = 0.70 + (sensitivity / 100) * 0.30;
  const minSat = Math.max(2, 15 - Math.round(sensitivity / 10));

  function isPink(i: number): boolean {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const maxC = Math.max(r, g, b);
    const minC = Math.min(r, g, b);
    const sat = maxC - minC;
    if (sat < minSat) return false;
    if (g >= r || g >= b) return false;
    const rbAvg = (r + b) / 2;
    return g < rbAvg * pinkRatio;
  }

  // Build offset list for radius-3 neighborhood
  const RADIUS = 3;
  const offsets: [number, number][] = [];
  for (let dy = -RADIUS; dy <= RADIUS; dy++) {
    for (let dx = -RADIUS; dx <= RADIUS; dx++) {
      if (dx === 0 && dy === 0) continue;
      offsets.push([dx, dy]);
    }
  }
  // Immediate neighbors for transparency border check
  const dirs: [number, number][] = [[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[1,-1],[-1,1],[1,1]];

  let totalRecolored = 0;

  for (let pass = 0; pass < passes; pass++) {
    const rgbSnap = new Uint8ClampedArray(data);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        if (data[i + 3] === 0) continue;
        if (!isPink(i)) continue;

        // Must be within RADIUS pixels of transparency
        let nearTransparent = false;
        for (const [dx, dy] of dirs) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
          if (data[(ny * width + nx) * 4 + 3] === 0) {
            nearTransparent = true;
            break;
          }
        }
        // If not immediately adjacent, check wider radius
        if (!nearTransparent) {
          for (const [dx, dy] of offsets) {
            const nx = x + dx, ny = y + dy;
            if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
            if (data[(ny * width + nx) * 4 + 3] === 0) {
              nearTransparent = true;
              break;
            }
          }
        }
        if (!nearTransparent) continue;

        // Sample non-transparent, non-pink neighbors within radius,
        // weighted by inverse distance for smoother blending
        let sumR = 0, sumG = 0, sumB = 0, totalWeight = 0;
        for (const [dx, dy] of offsets) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
          const nIdx = (ny * width + nx) * 4;
          if (rgbSnap[nIdx + 3] === 0) continue;
          const nr = rgbSnap[nIdx], ng = rgbSnap[nIdx + 1], nb = rgbSnap[nIdx + 2];
          const nSat = Math.max(nr, ng, nb) - Math.min(nr, ng, nb);
          if (nSat >= minSat && ng < nr && ng < nb && ng < (nr + nb) / 2 * pinkRatio) continue;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const w = 1 / dist;
          sumR += nr * w;
          sumG += ng * w;
          sumB += nb * w;
          totalWeight += w;
        }

        if (totalWeight > 0) {
          data[i] = Math.round(sumR / totalWeight);
          data[i + 1] = Math.round(sumG / totalWeight);
          data[i + 2] = Math.round(sumB / totalWeight);
          totalRecolored++;
        }
      }
    }
  }

  if (import.meta.env.DEV) {
    console.log(`[DefringeRecolor] Recolored ${totalRecolored} pixels across ${passes} passes (${width}x${height})`);
  }
  return out;
}

/**
 * Remove specific colors from ImageData.
 * Uses Euclidean distance in RGB space for tight, perceptually-accurate
 * color matching.  The tolerance is the max Euclidean distance (default 38
 * ≈ ~22 per-channel average).  This is much tighter than the old Manhattan
 * metric and avoids cross-hue bleed (e.g. blue striking green).
 */
export function strikeColors(
  source: ImageData,
  colors: [number, number, number][],
  tolerance = 38,
): ImageData {
  if (colors.length === 0) return new ImageData(
    new Uint8ClampedArray(source.data),
    source.width,
    source.height,
  );

  const out = new ImageData(
    new Uint8ClampedArray(source.data),
    source.width,
    source.height,
  );
  const data = out.data;
  const thresholdSq = tolerance * tolerance;

  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) continue;

    for (const [kr, kg, kb] of colors) {
      const dr = data[i] - kr;
      const dg = data[i + 1] - kg;
      const db = data[i + 2] - kb;
      const distSq = dr * dr + dg * dg + db * db;

      if (distSq < thresholdSq) {
        data[i + 3] = 0;
        break;
      }
    }
  }

  return out;
}
