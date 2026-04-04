/**
 * Image-generation model registry.
 *
 * Pricing is per-image in USD, sourced from Google's published
 * Gemini API pricing as of Feb 2026. The 2.5 Flash Image model
 * is priced per output token (~1290 tok/image) and does not
 * scale with resolution the way the 3.x preview models do.
 */

export type ImageSize = '2K' | '4K';

/**
 * Thinking-level options accepted by Gemini 3 image models via
 * `generationConfig.thinkingConfig.thinkingLevel`. `'default'` is an
 * app-side sentinel meaning "omit the field and let the model decide".
 */
export type ThinkingLevel = 'default' | 'minimal' | 'low' | 'medium' | 'high';

export const THINKING_LEVELS: ThinkingLevel[] = ['default', 'minimal', 'low', 'medium', 'high'];

export interface ImageModelInfo {
  id: string;
  label: string;
  tagline: string;
  /** Cost in USD per generated image, keyed by imageSize. */
  cost: Record<ImageSize, number>;
  /**
   * Whether the user can configure thinkingLevel for this model.
   * Pro model uses always-on thinking (not user-tunable in this app).
   * 2.5 Flash Image has no reasoning pass at all.
   */
  supportsThinking: boolean;
}

export const IMAGE_MODELS: ImageModelInfo[] = [
  {
    id: 'gemini-2.5-flash-image',
    label: 'Nano Banana',
    tagline: 'Fast & cheap',
    cost: { '2K': 0.039, '4K': 0.039 },
    supportsThinking: false,
  },
  {
    id: 'gemini-3.1-flash-image-preview',
    label: 'Nano Banana 2',
    tagline: 'Balanced (Flash 3.1)',
    cost: { '2K': 0.101, '4K': 0.151 },
    supportsThinking: true,
  },
  {
    id: 'gemini-3-pro-image-preview',
    label: 'Nano Banana Pro',
    tagline: 'Highest quality',
    cost: { '2K': 0.134, '4K': 0.24 },
    supportsThinking: false,
  },
];

export function getModel(id: string): ImageModelInfo | undefined {
  return IMAGE_MODELS.find((m) => m.id === id);
}

export function formatCost(usd: number): string {
  return `$${usd.toFixed(3)}`;
}
