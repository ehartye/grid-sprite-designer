/**
 * Chroma-key (color removal) for sprite images.
 * Removes magenta/pink backgrounds using soft alpha blending.
 */

/**
 * Apply chroma-key removal to ImageData with soft alpha edges.
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

  const out = new ImageData(
    new Uint8ClampedArray(source.data),
    source.width,
    source.height,
  );
  const data = out.data;

  const coreThreshold = tolerance * 3;
  const SOFT_EDGE_WIDTH = 60;
  const outerThreshold = coreThreshold + SOFT_EDGE_WIDTH;

  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3];
    if (a === 0) continue;

    const dist =
      Math.abs(data[i] - keyR) +
      Math.abs(data[i + 1] - keyG) +
      Math.abs(data[i + 2] - keyB);

    if (dist < coreThreshold) {
      data[i + 3] = 0;
    } else if (dist < outerThreshold) {
      const t = (dist - coreThreshold) / SOFT_EDGE_WIDTH;
      data[i + 3] = Math.round(t * a);
    }
  }

  return out;
}
