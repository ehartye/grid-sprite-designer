/**
 * Build the grid-fill prompt for Gemini — building/structure variant.
 * Combines template structure instructions with building-specific details.
 */

import type { GridConfig } from './gridConfig';

export interface BuildingConfig {
  name: string;
  description: string;
  details: string;
  colorNotes: string;
  styleNotes: string;
  cellGuidance: string;
}

/**
 * Build the full prompt that tells Gemini how to fill a building grid template.
 * Accepts optional grid-preset-sourced guidance for the layered guidance model.
 * Falls back to building.cellGuidance when grid preset params are not provided.
 */
export function buildBuildingPrompt(
  building: BuildingConfig,
  grid: GridConfig,
  gridGenericGuidance?: string,
  guidanceOverride?: string,
): string {
  const charBlock = [
    `Fill every pink cell area with an SNES-era 16-bit pixel-art sprite of a`,
    `${building.name.toUpperCase()} building/structure.`,
    ``,
    `Building appearance: ${building.description}`,
    building.details ? `Structural details: ${building.details}` : '',
    building.colorNotes ? `Color palette: ${building.colorNotes}` : '',
    building.styleNotes ? `Additional style notes: ${building.styleNotes}` : '',
    ``,
    `  \u2022 Style reference: Final Fantasy VI / Chrono Trigger overworld buildings and structures`,
    `  \u2022 Consistent proportions, perspective, and palette across ALL ${grid.totalCells} cells`,
    `  \u2022 Each cell shows the SAME building — variations come from the label (e.g. time of day, damage state, animation frame)`,
  ].filter(Boolean).join('\n');

  // Build cell-by-cell layout description from labels
  const cellDescriptions: string[] = [];
  for (let idx = 0; idx < grid.totalCells; idx++) {
    const row = Math.floor(idx / grid.cols);
    const col = idx % grid.cols;
    const label = idx < grid.cellLabels.length ? grid.cellLabels[idx] : `Cell ${row},${col}`;
    cellDescriptions.push(`  Header "${label}" (${row},${col}): Fill with the building sprite matching this label.`);
  }

  const cellLayout = cellDescriptions.join('\n');

  // Use grid preset guidance if provided, otherwise fall back to building.cellGuidance
  const genericText = gridGenericGuidance?.trim() || '';
  const overrideText = guidanceOverride?.trim() || building.cellGuidance.trim();
  const combinedGuidance = [genericText, overrideText].filter(Boolean).join('\n\n');
  const customGuidance = combinedGuidance
    ? `\nBUILDING-SPECIFIC CELL NOTES (use these to refine each cell):\n${combinedGuidance}\n`
    : '';

  return `\
You are filling in a sprite sheet template. The attached image is a ${grid.cols}\u00d7${grid.rows} grid
(${grid.totalCells} cells) on a bright magenta (#FF00FF) chroma-key background. Each cell has
a thin black header strip with white text labeling the variant. You MUST preserve
every header strip and its text exactly as-is \u2014 do not erase, move, or redraw
them.

${charBlock}

CHROMA BACKGROUND IS SACRED: The magenta #FF00FF background behind each sprite
MUST remain pure, unmodified magenta (#FF00FF) at all times. This is a chroma-key
background used for transparency — it is NOT part of the scene. Do NOT tint, shade,
darken, or blend the magenta background under any circumstances, even if the cell
depicts nighttime, darkness, fog, underwater, smoke, fire glow, or any other
environmental condition. Night scenes, dark moods, and atmospheric effects apply
ONLY to the building sprite itself — the background stays bright magenta.
Do NOT draw outside the cell boundaries or over the black grid lines.

CENTERING IS CRITICAL: Every sprite must be precisely centered both
horizontally and vertically within its cell's pink content area (below the
header strip). The building should be centered with equal pink space on all
sides. All variants of the same building should share the same scale and
baseline so they tile cleanly.

FULL VISIBILITY: The building's ENTIRE structure \u2014 roof to foundation \u2014 must
be fully visible within every cell. No part of the sprite (roof peak, chimney,
signs, flags, awnings) may be clipped or cut off by the cell boundary.
Scale the building small enough to fit comfortably with a margin of pink
background on all sides. Effects (smoke, glow, particles) must also stay
fully contained within the cell.

CONSISTENCY: The building must be recognizably the SAME structure across all
cells. Proportions, perspective angle, and architectural details should be
identical \u2014 only the aspects indicated by each cell's label should change
(e.g. lighting, damage level, animation frame).

CELL LAYOUT (${grid.cols}\u00d7${grid.rows} grid, 0-indexed):

${cellLayout}
${customGuidance}
Return the completed sprite sheet as a single image. Preserve ALL header text exactly.`;
}
