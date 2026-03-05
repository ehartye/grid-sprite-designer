/**
 * Build the grid-fill prompt for Gemini — terrain tile variant.
 * Combines template structure instructions with terrain-specific guidance
 * for tileable ground tiles and transition pieces.
 */

import type { GridConfig } from './gridConfig';

export interface TerrainConfig {
  name: string;
  description: string;
  colorNotes: string;
  styleNotes: string;
  tileGuidance: string;
}

/**
 * Accepts optional grid-preset-sourced guidance for the layered guidance model.
 * Falls back to terrain.tileGuidance when grid preset params are not provided.
 */
export function buildTerrainPrompt(
  terrain: TerrainConfig,
  grid: GridConfig,
  gridGenericGuidance?: string,
  guidanceOverride?: string,
): string {
  const descBlock = [
    `Fill every pink cell area with an SNES-era 16-bit pixel-art terrain tile for a`,
    `${terrain.name.toUpperCase()} tileset.`,
    ``,
    `Terrain description: ${terrain.description}`,
    terrain.colorNotes ? `Color palette: ${terrain.colorNotes}` : '',
    terrain.styleNotes ? `Additional style notes: ${terrain.styleNotes}` : '',
    ``,
    `  \u2022 Style reference: Final Fantasy VI / Chrono Trigger overworld tilesets`,
    `  \u2022 Consistent palette, texture density, and perspective across ALL ${grid.totalCells} tiles`,
    `  \u2022 Each cell is one distinct tile variant — base tiles, edges, corners, or transitions as labeled`,
  ].filter(Boolean).join('\n');

  const cellDescriptions: string[] = [];
  for (let idx = 0; idx < grid.totalCells; idx++) {
    const row = Math.floor(idx / grid.cols);
    const col = idx % grid.cols;
    const label = idx < grid.cellLabels.length ? grid.cellLabels[idx] : `Tile ${row},${col}`;
    cellDescriptions.push(`  Header "${label}" (${row},${col}): Fill with the terrain tile matching this label.`);
  }

  // Use grid preset guidance if provided, otherwise fall back to terrain.tileGuidance
  const genericText = gridGenericGuidance?.trim() || '';
  const overrideText = guidanceOverride?.trim() || terrain.tileGuidance.trim();
  const combinedGuidance = [genericText, overrideText].filter(Boolean).join('\n\n');
  const customGuidance = combinedGuidance
    ? `\nTERRAIN-SPECIFIC TILE NOTES (use these to refine each tile):\n${combinedGuidance}\n`
    : '';

  return `\
You are filling in a sprite sheet template. The attached image is a ${grid.cols}\u00d7${grid.rows} grid
(${grid.totalCells} cells) on a bright magenta (#FF00FF) chroma-key background. Each cell has
a thin black header strip with white text labeling the tile variant. You MUST preserve
every header strip and its text exactly as-is \u2014 do not erase, move, or redraw them.

${descBlock}

CHROMA BACKGROUND IS SACRED: The magenta #FF00FF background behind each tile
MUST remain pure, unmodified magenta (#FF00FF) at all times. This is a chroma-key
background used for transparency \u2014 it is NOT part of the terrain. Do NOT tint, shade,
darken, or blend the magenta background under any circumstances.
Do NOT draw outside the cell boundaries or over the black grid lines.

TILEABILITY IS CRITICAL: Each terrain tile must be designed so that its edges
align seamlessly with adjacent tiles of the same type. Colors, textures, and
patterns at the edges should blend naturally when tiles are placed next to each
other in a tilemap. Base tiles should tile seamlessly with themselves.
Edge and corner tiles should transition cleanly between the two terrain types
indicated by their label.

FILL THE CELL: Unlike character or building sprites that float on the chroma
background, terrain tiles should FILL the entire cell content area edge-to-edge
(below the header strip). There should be NO magenta background visible in
terrain tile cells \u2014 the tile IS the ground.

CONSISTENCY: All tiles must share the same art style, color palette, texture
density, and viewing perspective. They are parts of one unified tileset.

CELL LAYOUT (${grid.cols}\u00d7${grid.rows} grid, 0-indexed):

${cellDescriptions.join('\n')}
${customGuidance}
Return the completed sprite sheet as a single image. Preserve ALL header text exactly.`;
}
