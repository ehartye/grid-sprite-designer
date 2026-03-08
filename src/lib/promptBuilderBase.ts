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
