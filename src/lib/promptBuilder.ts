/**
 * Build the grid-fill prompt for Gemini.
 * Combines the template structure instructions with character-specific details.
 */

import { CLOSING_INSTRUCTION, REFERENCE_PREFIX, buildGuidanceBlock } from './promptBuilderBase';
import type { HierarchicalGuidance, CellGroup } from '../context/AppContext';

export interface CharacterConfig {
  name: string;
  description: string;
  equipment: string;
  colorNotes: string;
  styleNotes: string;
}

/**
 * Build the full prompt that tells Gemini how to fill a character grid template.
 */
export function buildGridFillPrompt(
  character: CharacterConfig,
  gridGuidance: HierarchicalGuidance,
  linkGuidance: HierarchicalGuidance,
  presetGuidance: HierarchicalGuidance,
  cellGroups: CellGroup[],
  cellLabels: string[],
  cols: number,
  rows: number,
): string {
  const totalCells = cols * rows;

  const charBlock = [
    `Fill every pink cell area with a pixel-art sprite of a`,
    `${character.name.toUpperCase()} character.`,
    ``,
    `Character appearance: ${character.description}`,
    character.equipment ? `Equipment: ${character.equipment}` : '',
    character.colorNotes ? `Color palette: ${character.colorNotes}` : '',
    character.styleNotes ? `Additional style notes: ${character.styleNotes}` : '',
  ].filter(Boolean).join('\n');

  const guidanceBlock = buildGuidanceBlock(gridGuidance, linkGuidance, presetGuidance, cellGroups, cellLabels, cols);

  return `\
You are filling in a sprite sheet template. The attached image is a ${cols}\u00d7${rows} grid (${totalCells} cells) on a bright magenta (#FF00FF) chroma-key background. Each cell has a thin black header strip with white text labeling the pose. You MUST preserve every header strip and its text exactly as-is — do not erase, move, or redraw them.

${charBlock}

Keep the magenta #FF00FF background behind each sprite for chroma keying.
Do NOT draw outside the cell boundaries or over the black grid lines.

CENTERING IS CRITICAL: Every sprite must be precisely centered both
horizontally and vertically within its cell's pink content area (below the
header strip). The character's feet should rest at a consistent baseline
roughly 80% down the cell, and the sprite should be horizontally centered
with equal pink space on the left and right. Standing poses should all share
the same vertical baseline so they tile cleanly. Even action poses (attack
swings, casting, damage recoil) must keep the character's center of mass
near the middle of the cell — do not let poses drift to the edges. KO/lying
poses should be centered horizontally even though they are low to the ground.

EQUIPMENT CONSISTENCY: Held items must stay in the same hand across all
poses — if the character wields a sword in their right hand, it remains in
the right hand in every cell (side-view poses naturally mirror this).
Back-worn items (capes, backpacks, slung shields, quivers, sheathed weapons)
must appear consistently on the character's back in every pose where the
back or side is visible. Do not omit, move, or swap equipment between cells.

FULL BODY VISIBILITY: The character's entire body must be visible within every
cell — nothing clipped or cut off. Scale the sprite to fit comfortably with a
margin of pink background on all sides. Effects (shadows, auras, VFX) must stay
fully within the cell and not bleed into adjacent cells.

MOVEMENT CONTINUITY: In animation sequences, body position must alternate
naturally between frames. If the character's right leg is forward in one frame,
the next stride forward uses the left leg. Arms and other limbs follow the same
principle — each frame progresses the motion cycle rather than repeating or
mirroring the same position.

Below is the exact layout. Each cell must match its header's pose exactly.

${guidanceBlock}

${CLOSING_INSTRUCTION}`;
}

/**
 * Build the prompt for subsequent grids in a multi-grid run.
 * Adds explicit IMAGE 1 (reference sheet) / IMAGE 2 (template) instructions.
 */
export function buildGridFillPromptWithReference(
  character: CharacterConfig,
  gridGuidance: HierarchicalGuidance,
  linkGuidance: HierarchicalGuidance,
  presetGuidance: HierarchicalGuidance,
  cellGroups: CellGroup[],
  cellLabels: string[],
  cols: number,
  rows: number,
): string {
  const base = buildGridFillPrompt(
    character, gridGuidance, linkGuidance, presetGuidance, cellGroups, cellLabels, cols, rows,
  ).replace(
    'You are filling in a sprite sheet template. The attached image is',
    'You are filling in a sprite sheet template. IMAGE 2 is',
  );
  return REFERENCE_PREFIX + base;
}
