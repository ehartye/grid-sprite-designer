/**
 * Shared utilities for prompt builders.
 * Eliminates duplicated cell-description loops, guidance composition,
 * and closing instructions across building/terrain/background builders.
 */

import type { GridConfig } from './gridConfig';

/**
 * Build the per-cell layout description lines from grid config.
 * Used identically by building, terrain, and background prompt builders.
 * @param fallbackPrefix - prefix for unlabeled cells (e.g. "Cell", "Tile"); defaults to "Cell"
 */
export function buildCellDescriptions(
  grid: GridConfig,
  fillNoun: string,
  fallbackPrefix = 'Cell',
): string[] {
  const descriptions: string[] = [];
  for (let idx = 0; idx < grid.totalCells; idx++) {
    const row = Math.floor(idx / grid.cols);
    const col = idx % grid.cols;
    const label = idx < grid.cellLabels.length ? grid.cellLabels[idx] : `${fallbackPrefix} ${row},${col}`;
    descriptions.push(`  Header "${label}" (${row},${col}): Fill with the ${fillNoun} matching this label.`);
  }
  return descriptions;
}

/**
 * Compose the type-specific guidance section from generic + override text.
 * Used identically by building, terrain, and background prompt builders.
 */
export function composeGuidance(
  genericGuidance: string | undefined,
  overrideGuidance: string,
  sectionLabel: string,
): string {
  const genericText = genericGuidance?.trim() || '';
  const overrideText = overrideGuidance.trim();
  const combined = [genericText, overrideText].filter(Boolean).join('\n\n');
  if (!combined) return '';
  return `\n${sectionLabel}:\n${combined}\n`;
}

/** The closing instruction shared by all prompt builders. */
export const CLOSING_INSTRUCTION = 'Return the completed sprite sheet as a single image. Preserve ALL header text exactly.';

const PIXELIZE_GUIDANCE: Record<number, string> = {
  16:  'TARGET PIXEL SIZE: 16×16 — Design for extreme pixel art resolution. Use 2–4 flat colors, bold silhouettes, no gradients, no fine detail. Every pixel counts; prioritize readable shape over surface detail.',
  32:  'TARGET PIXEL SIZE: 32×32 — Design for classic pixel art (NES/early SNES era). Limited palette of 4–8 colors, clean shapes, minimal shading. Sprites should read clearly as strong silhouettes.',
  48:  'TARGET PIXEL SIZE: 48×48 — Design for mid-resolution pixel art. Palette of 8–16 colors, defined shading with dithering, readable detail on key features.',
  64:  'TARGET PIXEL SIZE: 64×64 — Design for mid-resolution pixel art. Palette of 8–16 colors, defined shading, fine readable detail on faces, equipment, and surfaces.',
  128: 'TARGET PIXEL SIZE: 128×128 — Design for high-resolution pixel art. Rich palette, detailed shading with smooth dithering, fine features and textures visible. SNES/GBA era fidelity.',
};

export function getPixelizeGuidance(targetSize: number | undefined): string {
  if (targetSize === undefined) return '';
  return PIXELIZE_GUIDANCE[targetSize] ?? '';
}

/** Prefix for multi-grid reference image prompts, shared by all sprite types. */
export const REFERENCE_PREFIX = `\
You are given two images.
IMAGE 1 is a previously completed sprite sheet — use it ONLY as a visual
reference to maintain consistent proportions, color palette, art style, and
character identity. Do NOT replicate IMAGE 1's layout or poses.
IMAGE 2 is the blank template grid you must fill in. Your output image must
complete IMAGE 2. All layout instructions below describe IMAGE 2.

`;
