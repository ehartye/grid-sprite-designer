/**
 * Chroma-key (color removal) for sprite images.
 * Two-pass approach:
 *  1. Conservative global pass removes clear background matches.
 *  2. Defringe pass aggressively softens pixels bordering transparency,
 *     cleaning up magenta fringe without punching holes in the sprite.
 */

/**
 * Apply chroma-key removal to ImageData with defringe.
 * Default target: #FF00FF (magenta).
 */
export function applyChromaKey(
  source: ImageData,
  tolerance: number,
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
  const SOFT_EDGE_WIDTH = 60;
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
  // Uses a wider threshold than pass 1 so it catches the blended fringe
  // pixels that are part-magenta, part-sprite-color.
  const DEFRINGE_PASSES = 4;
  const defringeThreshold = 500;

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
        if (dist < coreThreshold) {
          data[i + 3] = 0;
        } else if (dist < defringeThreshold) {
          const t = (dist - coreThreshold) / (defringeThreshold - coreThreshold);
          data[i + 3] = Math.min(data[i + 3], Math.round(t * 255));
        }
      }
    }
  }

  return out;
}

/**
 * Remove specific colors from ImageData.
 * Each struck color is removed with a fixed tolerance + soft edge.
 */
export function strikeColors(
  source: ImageData,
  colors: [number, number, number][],
  tolerance = 30,
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
  const threshold = tolerance * 3;

  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) continue;

    for (const [kr, kg, kb] of colors) {
      const dist =
        Math.abs(data[i] - kr) +
        Math.abs(data[i + 1] - kg) +
        Math.abs(data[i + 2] - kb);

      if (dist < threshold) {
        data[i + 3] = 0;
        break;
      }
    }
  }

  return out;
}
