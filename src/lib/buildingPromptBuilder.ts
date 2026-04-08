/**
 * Build the grid-fill prompt for Gemini — building/structure variant.
 * Combines template structure instructions with building-specific details.
 */

import { buildGuidanceBlock } from './promptBuilderBase';
import type { HierarchicalGuidance, CellGroup } from '../context/AppContext';
import type { TypeBuilderResult, PromptPart } from '../types/prompt';

export interface BuildingConfig {
  name: string;
  description: string;
  details: string;
  colorNotes: string;
  styleNotes: string;
}

/**
 * Build building prompt parts for the structured assembler.
 * Returns subject + instructions as PromptPart arrays.
 * Role intro (grid intro), reference handling, and closing instruction are handled by the assembler.
 */
export function buildBuildingParts(
  building: BuildingConfig,
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
    `Fill every pink cell area with a pixel-art sprite of a`,
    `${building.name.toUpperCase()} building/structure.`,
    ``,
    `Building appearance: ${building.description}`,
    building.details ? `Structural details: ${building.details}` : '',
    building.colorNotes ? `Color palette: ${building.colorNotes}` : '',
    building.styleNotes ? `Additional style notes: ${building.styleNotes}` : '',
    ``,
    `  \u2022 Default style reference: Final Fantasy VI / Chrono Trigger overworld buildings and structures (SNES 16-bit)`,
    `  \u2022 Consistent proportions, perspective, and palette across ALL ${totalCells} cells`,
    `  \u2022 Each cell shows the SAME building \u2014 variations come from the label (e.g. time of day, damage state, animation frame)`,
  ].filter(Boolean).join('\n');

  const guidanceBlock = buildGuidanceBlock(gridGuidance, linkGuidance, presetGuidance, cellGroups, cellLabels, cols, cellAnnotations, groupAnnotations);

  const subject: PromptPart[] = [{ type: 'text', content: subjectText }];

  const rulesText = `CHROMA BACKGROUND IS SACRED: The magenta #FF00FF background behind each sprite
MUST remain pure, unmodified magenta (#FF00FF) at all times. This is a chroma-key
background used for transparency \u2014 it is NOT part of the scene. Do NOT tint, shade,
darken, or blend the magenta background under any circumstances, even if the cell
depicts nighttime, darkness, fog, underwater, smoke, fire glow, or any other
environmental condition. Night scenes, dark moods, and atmospheric effects apply
ONLY to the building sprite itself \u2014 the background stays bright magenta.
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
(e.g. lighting, damage level, animation frame).`;

  const instructions: PromptPart[] = [
    { type: 'text', content: rulesText },
    { type: 'text', content: `CELL LAYOUT (${cols}\u00d7${rows} grid, 0-indexed):\n\n${guidanceBlock}` },
  ];

  return { subject, instructions };
}
