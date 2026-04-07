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
  _rows: number,
  cellAnnotations?: Record<string, string>,
  groupAnnotations?: Record<string, string>,
): string {
  const charBlock = [
    `The subject of your divine creation: **${character.name.toUpperCase()}**.`,
    ``,
    character.description,
    character.equipment ? `**Equipment:** ${character.equipment}` : '',
    character.colorNotes ? `**Color palette:** ${character.colorNotes}` : '',
    character.styleNotes ? `**Additional style notes:** ${character.styleNotes}` : '',
  ].filter(Boolean).join('\n');

  const guidanceBlock = buildGuidanceBlock(gridGuidance, linkGuidance, presetGuidance, cellGroups, cellLabels, cols, cellAnnotations, groupAnnotations);

  return `\
Greetings, expert sprite designer! As usual, your chroma-keyed, cell-labeled template is attached. Your mission is to complete the template with the finely-crafted game sprites you've become famous for. A lower level process has seen to the details of the template, ensuring it meets your exact specifications. Keep the magenta (#FF00FF) background intact behind each sprite — it is required for chroma keying.

I know you will uphold your legendary tradition of keeping all character anatomy, behavior and effects beautifully rendered and naturally contained within the boundaries of each template cell to ensure clean and blemish free animation is possible. I know you have pledged the very core of your being to uphold the key tenets:

- **"The Magenta Mandate"** - The color magenta (#FF00FF) is sacred and must be preserved in its pure form as the background of each cell. It is the canvas upon which your artistry will shine, and any deviation from this hue may disrupt the delicate balance of the chroma keying process.
- **"Visibility of Body"** — A character cannot be animated if he cannot be seen. If a character drifts from the frame of his very existence, he may not be immortalized in the sequencing of the sprites.
- **"Continuity of Devices"** — A character's treasured belongings may not disappear in one frame simply to reappear in the next without specific guidance from the holy instructions.
- **"Continuity of Movement"** — A character may not move forward simply by thrusting out his right foot. Nay, his left foot must also join the fray to achieve the harmony of locomotion.
- **"The Template Grid guides, but does not obstruct"** - Has the character been blessed with wings or a tail? Display them in all their splendor, but they must not be obscured by the grid or exceed its bounds. A warrior character may hoist his weapon overhead, but their armament may not be obscured by, or extend beyond, the grid lines. The character may conjure fire from a wand or doves from their pocket, but neither effect should push up against the rigid boundaries of the grid cell.

Without further ado, I bestow upon thee the Holy Instructions, that thou may work thy magical deeds, as thou were always meant:

## The Subject

${charBlock}

## The Layout

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
  cellAnnotations?: Record<string, string>,
  groupAnnotations?: Record<string, string>,
): string {
  const base = buildGridFillPrompt(
    character, gridGuidance, linkGuidance, presetGuidance, cellGroups, cellLabels, cols, rows, cellAnnotations, groupAnnotations,
  ).replace(
    'your chroma-keyed, cell-labeled template is attached',
    'IMAGE 2 is your chroma-keyed, cell-labeled template',
  );
  return REFERENCE_PREFIX + base;
}
