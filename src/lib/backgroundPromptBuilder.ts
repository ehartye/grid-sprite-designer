/**
 * Build the grid-fill prompt for Gemini — background variant.
 * Supports two modes: parallax layers (wide horizontal strips)
 * and scene variations (full scenes with lighting/weather changes).
 */

import type { GridConfig, BackgroundMode } from './gridConfig';
import { buildCellDescriptions, composeGuidance, CLOSING_INSTRUCTION } from './promptBuilderBase';

export interface BackgroundConfig {
  name: string;
  description: string;
  colorNotes: string;
  styleNotes: string;
  layerGuidance: string;
  bgMode: BackgroundMode;
}

/**
 * Accepts optional grid-preset-sourced guidance for the layered guidance model.
 * Falls back to bg.layerGuidance when grid preset params are not provided.
 */
export function buildBackgroundPrompt(
  bg: BackgroundConfig,
  grid: GridConfig,
  gridGenericGuidance?: string,
  guidanceOverride?: string,
): string {
  const descBlock = [
    `Fill every pink cell area with an SNES-era 16-bit pixel-art background`,
    bg.bgMode === 'parallax'
      ? `layer for a ${bg.name.toUpperCase()} parallax scrolling background.`
      : `scene variant of ${bg.name.toUpperCase()}.`,
    ``,
    `Background description: ${bg.description}`,
    bg.colorNotes ? `Color palette: ${bg.colorNotes}` : '',
    bg.styleNotes ? `Additional style notes: ${bg.styleNotes}` : '',
    ``,
    `  \u2022 Style reference: Final Fantasy VI / Chrono Trigger background art`,
    `  \u2022 Consistent palette and art style across ALL ${grid.totalCells} cells`,
  ].filter(Boolean).join('\n');

  const modeLabel = bg.bgMode === 'parallax' ? 'layer' : 'scene';
  const cellDescriptions = buildCellDescriptions(grid, `background ${modeLabel}`);

  // Use grid preset guidance if provided, otherwise fall back to bg.layerGuidance
  const customGuidance = composeGuidance(
    gridGenericGuidance,
    guidanceOverride?.trim() || bg.layerGuidance.trim(),
    `BACKGROUND-SPECIFIC NOTES (use these to refine each ${modeLabel})`,
  );

  const modeGuidance = bg.bgMode === 'parallax'
    ? `PARALLAX LAYER DESIGN: Each cell is one horizontal layer of a parallax
scrolling background. Layers are ordered top-to-bottom from farthest (sky)
to nearest (ground). Design rules:
  \u2022 Each layer must tile HORIZONTALLY \u2014 the left and right edges should connect seamlessly
  \u2022 Far layers (sky, distant features): simpler detail, lighter/hazier colors, atmospheric perspective
  \u2022 Near layers (foreground, ground): more detail, stronger colors, larger elements
  \u2022 Each layer should have transparent areas (magenta background) where layers below show through
  \u2022 The topmost layer (sky) should fill the entire cell with no magenta visible
  \u2022 Lower layers should have magenta at the top where the sky shows through

FILL HORIZONTALLY: Each layer should span the full width of the cell.
The layer content fills from the bottom up, with magenta background above
where the sky or farther layers would show through.`
    : `SCENE VARIATION DESIGN: Each cell is a complete standalone background scene.
All scenes depict the SAME location \u2014 only the conditions change (time of day,
weather, season, mood). Design rules:
  \u2022 Same composition, layout, and structural elements across all scenes
  \u2022 Horizon line, major landmarks, and proportions must be identical
  \u2022 Only lighting, color temperature, weather effects, and atmospheric conditions change
  \u2022 Each scene should fill the ENTIRE cell \u2014 no magenta background should be visible
  \u2022 Maintain consistent art style and level of detail across all variants

FILL THE CELL: Scene backgrounds should fill the entire cell content area
edge-to-edge (below the header strip). There should be NO magenta background
visible \u2014 the scene IS the background.`;

  return `\
You are filling in a sprite sheet template. The attached image is a ${grid.cols}\u00d7${grid.rows} grid
(${grid.totalCells} cells) on a bright magenta (#FF00FF) chroma-key background. Each cell has
a thin black header strip with white text labeling the ${bg.bgMode === 'parallax' ? 'layer' : 'scene'}. You MUST preserve
every header strip and its text exactly as-is \u2014 do not erase, move, or redraw them.

${descBlock}

CHROMA BACKGROUND IS SACRED: The magenta #FF00FF background areas
MUST remain pure, unmodified magenta (#FF00FF). This is a chroma-key
background used for transparency \u2014 it is NOT part of the scene. Do NOT tint, shade,
darken, or blend the magenta background under any circumstances, even if the cell
depicts nighttime, darkness, fog, or other atmospheric conditions.
Do NOT draw outside the cell boundaries or over the black grid lines.

${modeGuidance}

CONSISTENCY: All ${bg.bgMode === 'parallax' ? 'layers' : 'scenes'} must share the same art style and color palette.
They are parts of one unified background ${bg.bgMode === 'parallax' ? 'system' : 'set'}.

CELL LAYOUT (${grid.cols}\u00d7${grid.rows} grid, 0-indexed):

${cellDescriptions.join('\n')}
${customGuidance}
${CLOSING_INSTRUCTION}`;
}
