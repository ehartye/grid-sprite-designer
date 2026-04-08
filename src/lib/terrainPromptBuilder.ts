/**
 * Build the grid-fill prompt for Gemini — terrain tile variant.
 * Combines template structure instructions with terrain-specific guidance
 * for tileable ground tiles and transition pieces.
 */

import { buildGuidanceBlock, CLOSING_INSTRUCTION } from './promptBuilderBase';
import type { HierarchicalGuidance, CellGroup } from '../context/AppContext';
import type { TypeBuilderResult, PromptPart } from '../types/prompt';

export interface TerrainConfig {
  name: string;
  description: string;
  colorNotes: string;
  styleNotes: string;
}

/**
 * Build the full prompt that tells Gemini how to fill a terrain grid template.
 */
export function buildTerrainPrompt(
  terrain: TerrainConfig,
  gridGuidance: HierarchicalGuidance,
  linkGuidance: HierarchicalGuidance,
  presetGuidance: HierarchicalGuidance,
  cellGroups: CellGroup[],
  cellLabels: string[],
  cols: number,
  rows: number,
  cellAnnotations?: Record<string, string>,
  groupAnnotations?: Record<string, string>,
): string {
  const totalCells = cols * rows;

  const descBlock = [
    `Fill every pink cell area with a pixel-art terrain tile for a`,
    `${terrain.name.toUpperCase()} tileset.`,
    ``,
    `Terrain description: ${terrain.description}`,
    terrain.colorNotes ? `Color palette: ${terrain.colorNotes}` : '',
    terrain.styleNotes ? `Additional style notes: ${terrain.styleNotes}` : '',
    ``,
    `  \u2022 Default style reference: Final Fantasy VI / Chrono Trigger overworld tilesets (SNES 16-bit)`,
    `  \u2022 Consistent palette, texture density, and perspective across ALL ${totalCells} tiles`,
    `  \u2022 Each cell is one distinct tile variant — base tiles, edges, corners, or transitions as labeled`,
  ].filter(Boolean).join('\n');

  const guidanceBlock = buildGuidanceBlock(gridGuidance, linkGuidance, presetGuidance, cellGroups, cellLabels, cols, cellAnnotations, groupAnnotations);

  return `\
You are filling in a sprite sheet template. The attached image is a ${cols}\u00d7${rows} grid
(${totalCells} cells) on a bright magenta (#FF00FF) chroma-key background. Each cell has
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

CELL LAYOUT (${cols}\u00d7${rows} grid, 0-indexed):

${guidanceBlock}
${CLOSING_INSTRUCTION}`;
}

/**
 * Build terrain prompt parts for the structured assembler.
 * Returns subject + instructions as PromptPart arrays.
 * Role intro (grid intro), reference handling, and closing instruction are handled by the assembler.
 */
export function buildTerrainParts(
  terrain: TerrainConfig,
  gridGuidance: HierarchicalGuidance,
  linkGuidance: HierarchicalGuidance,
  presetGuidance: HierarchicalGuidance,
  cellGroups: CellGroup[],
  cellLabels: string[],
  cols: number,
  rows: number,
  cellAnnotations?: Record<string, string>,
  groupAnnotations?: Record<string, string>,
): TypeBuilderResult {
  const totalCells = cols * rows;

  const subjectText = [
    `Fill every pink cell area with a pixel-art terrain tile for a`,
    `${terrain.name.toUpperCase()} tileset.`,
    ``,
    `Terrain description: ${terrain.description}`,
    terrain.colorNotes ? `Color palette: ${terrain.colorNotes}` : '',
    terrain.styleNotes ? `Additional style notes: ${terrain.styleNotes}` : '',
    ``,
    `  \u2022 Default style reference: Final Fantasy VI / Chrono Trigger overworld tilesets (SNES 16-bit)`,
    `  \u2022 Consistent palette, texture density, and perspective across ALL ${totalCells} tiles`,
    `  \u2022 Each cell is one distinct tile variant \u2014 base tiles, edges, corners, or transitions as labeled`,
  ].filter(Boolean).join('\n');

  const guidanceBlock = buildGuidanceBlock(gridGuidance, linkGuidance, presetGuidance, cellGroups, cellLabels, cols, cellAnnotations, groupAnnotations);

  const subject: PromptPart[] = [{ type: 'text', content: subjectText }];

  const rulesText = `CHROMA BACKGROUND IS SACRED: The magenta #FF00FF background behind each tile
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
density, and viewing perspective. They are parts of one unified tileset.`;

  const instructions: PromptPart[] = [
    { type: 'text', content: rulesText },
    { type: 'text', content: `CELL LAYOUT (${cols}\u00d7${rows} grid, 0-indexed):\n\n${guidanceBlock}` },
  ];

  return { subject, instructions };
}
