/**
 * Image pre-processing operations for the sprite extraction pipeline.
 *
 * All functions follow the chromaKey.ts convention:
 *   - Accept an ImageData as input (never mutated)
 *   - Return a new ImageData with the transformation applied
 *   - Alpha channel is preserved unless explicitly documented otherwise
 */

/**
 * Posterize pixel data by snapping each R/G/B channel to `2^bits` discrete
 * levels. Alpha is untouched.
 *
 * Reduces JPEG compression artifacts by absorbing noisy intermediate values
 * into their nearest quantization bucket. Grid lines and uniform backgrounds
 * become perfectly uniform, sharpening the darkness and variance signals
 * used by computeRowDarkness() and computeColumnVariance().
 *
 * Algorithm:
 *   levels   = 2^bits
 *   step     = 256 / levels
 *   halfStep = step / 2           (center of each bucket)
 *   out[c]   = floor(in[c] / step) * step + halfStep
 *
 * @param source - Source ImageData; not mutated.
 * @param bits   - Bits per channel in range [1, 8].
 *                 1 = 2 levels (near-binary); 8 = 256 levels (identity).
 */
export function posterize(source: ImageData, bits: number): ImageData {
  const clamped = Math.max(1, Math.min(8, Math.round(bits)));

  if (clamped === 8) {
    return new ImageData(
      new Uint8ClampedArray(source.data),
      source.width,
      source.height,
    );
  }

  const out = new ImageData(
    new Uint8ClampedArray(source.data),
    source.width,
    source.height,
  );
  const data = out.data;
  const levels = 1 << clamped;
  const step = 256 / levels;
  const halfStep = step / 2;

  for (let i = 0; i < data.length; i += 4) {
    data[i]     = Math.min(255, Math.floor(data[i]     / step) * step + halfStep);
    data[i + 1] = Math.min(255, Math.floor(data[i + 1] / step) * step + halfStep);
    data[i + 2] = Math.min(255, Math.floor(data[i + 2] / step) * step + halfStep);
  }
  return out;
}
