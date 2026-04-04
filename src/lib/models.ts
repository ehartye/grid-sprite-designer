/**
 * Image-generation model registry.
 *
 * Pricing is per-image in USD, sourced from Google's published
 * Gemini API pricing as of Feb 2026. The 2.5 Flash Image model
 * is priced per output token (~1290 tok/image) and does not
 * scale with resolution the way the 3.x preview models do.
 */

export type ImageSize = '2K' | '4K';

export interface ImageModelInfo {
  id: string;
  label: string;
  tagline: string;
  /** Cost in USD per generated image, keyed by imageSize. */
  cost: Record<ImageSize, number>;
}

export const IMAGE_MODELS: ImageModelInfo[] = [
  {
    id: 'gemini-2.5-flash-image',
    label: 'Nano Banana',
    tagline: 'Fast & cheap',
    cost: { '2K': 0.039, '4K': 0.039 },
  },
  {
    id: 'gemini-3.1-flash-image-preview',
    label: 'Nano Banana 2',
    tagline: 'Balanced (Flash 3.1)',
    cost: { '2K': 0.101, '4K': 0.151 },
  },
  {
    id: 'gemini-3-pro-image-preview',
    label: 'Nano Banana Pro',
    tagline: 'Highest quality',
    cost: { '2K': 0.134, '4K': 0.24 },
  },
];

export function getModel(id: string): ImageModelInfo | undefined {
  return IMAGE_MODELS.find((m) => m.id === id);
}

export function formatCost(usd: number): string {
  return `$${usd.toFixed(3)}`;
}
