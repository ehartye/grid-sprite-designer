/**
 * Shared prompt building for any sprite type.
 * Extracted from useRunWorkflow to be reused by the add-sheet flow.
 */

import { SpriteType, GridLink, HierarchicalGuidance, CellGroup } from '../context/AppContext';
import { buildCharacterParts } from './promptBuilder';
import { buildBuildingParts } from './buildingPromptBuilder';
import { buildTerrainParts } from './terrainPromptBuilder';
import { buildBackgroundParts } from './backgroundPromptBuilder';
import { getPixelizeGuidance } from './promptBuilderBase';
import type { ContentPreset } from '../types/api';
import type { StructuredPrompt, PromptPart } from '../types/prompt';
import type { FeedbackState } from '../types/feedback';
import { buildRegenerationPreamble, buildCellFeedbackAnnotations, buildGroupFeedbackAnnotations, buildEditPrompt } from './feedbackPrompt';

/** Fetch a single content preset by type and id */
export async function fetchContentPreset(spriteType: SpriteType, presetId: string): Promise<ContentPreset> {
  const res = await fetch(`/api/presets/${spriteType}/${presetId}`);
  if (!res.ok) throw new Error(`Content preset "${presetId}" not found`);
  return res.json();
}

// ── Structured prompt assembler ──────────────────────────────────────

export interface AssemblePromptOptions {
  spriteType: SpriteType;
  contentPreset: ContentPreset;
  gridLink: GridLink;
  isSubsequentGrid: boolean;
  pixelizeSize?: number;
  referenceImage?: { data: string; mimeType: string };
  feedbackState?: FeedbackState;
  promptSuffix?: string;
}

/** Build the role intro text. Shared across all types, varies by grid dimensions. */
function buildRoleIntro(spriteType: SpriteType, cols: number, rows: number): string {
  if (spriteType === 'character') {
    return `Greetings, expert sprite designer! Your chroma-keyed, cell-labeled template will be provided. Your mission is to complete the template with the finely-crafted game sprites you've become famous for. Keep the magenta (#FF00FF) background intact behind each sprite — it is required for chroma keying.`;
  }
  const totalCells = cols * rows;
  return `You are filling in a sprite sheet template. The template is a ${cols}\u00d7${rows} grid (${totalCells} cells) on a bright magenta (#FF00FF) chroma-key background. Each cell has a thin black header strip with white text labeling the variant. You MUST preserve every header strip and its text exactly as-is \u2014 do not erase, move, or redraw them.`;
}

/**
 * Assemble a StructuredPrompt for generate mode.
 * Composes: feedback preamble → role intro → subject → reference image → instructions → canvas/template.
 */
export function assemblePrompt(opts: AssemblePromptOptions): StructuredPrompt {
  const { spriteType, contentPreset, gridLink, isSubsequentGrid, pixelizeSize, referenceImage, feedbackState, promptSuffix } = opts;
  const { gridGuidance, linkGuidance, cellGroups, cellLabels, cols, rows } = gridLink;

  const presetGuidance: HierarchicalGuidance = {
    overall: contentPreset.overallGuidance || '',
    groups: contentPreset.groupGuidance || {},
    cells: contentPreset.cellGuidance || {},
  };

  // Build feedback annotations if present
  let cellAnnotations: Record<string, string> | undefined;
  let groupAnnotations: Record<string, string> | undefined;
  if (feedbackState) {
    cellAnnotations = buildCellFeedbackAnnotations(feedbackState, cellLabels);
    groupAnnotations = buildGroupFeedbackAnnotations(feedbackState);
  }

  // Get type-specific parts
  let builderResult;
  switch (spriteType) {
    case 'character':
      builderResult = buildCharacterParts(
        { name: contentPreset.name, description: contentPreset.description, equipment: contentPreset.equipment || '', colorNotes: contentPreset.colorNotes || '', styleNotes: '' },
        gridGuidance, linkGuidance, presetGuidance, cellGroups, cellLabels, cols, rows, cellAnnotations, groupAnnotations,
      );
      break;
    case 'building':
      builderResult = buildBuildingParts(
        { name: contentPreset.name, description: contentPreset.description, details: contentPreset.details || '', colorNotes: contentPreset.colorNotes || '', styleNotes: '' },
        gridGuidance, linkGuidance, presetGuidance, cellGroups, cellLabels, cols, rows, cellAnnotations, groupAnnotations,
      );
      break;
    case 'terrain':
      builderResult = buildTerrainParts(
        { name: contentPreset.name, description: contentPreset.description, colorNotes: contentPreset.colorNotes || '', styleNotes: '' },
        gridGuidance, linkGuidance, presetGuidance, cellGroups, cellLabels, cols, rows, cellAnnotations, groupAnnotations,
      );
      break;
    case 'background':
      builderResult = buildBackgroundParts(
        { name: contentPreset.name, description: contentPreset.description, colorNotes: contentPreset.colorNotes || '', styleNotes: '', bgMode: contentPreset.bgMode || (gridLink.bgMode as 'parallax' | 'scene') || 'parallax' },
        gridGuidance, linkGuidance, presetGuidance, cellGroups, cellLabels, cols, rows, cellAnnotations, groupAnnotations,
      );
      break;
    default:
      throw new Error(`Unknown sprite type: ${spriteType}`);
  }

  // Compose the full part sequence
  const parts: PromptPart[] = [];
  const sections: { name: string; partIndex: number }[] = [];

  // 1. Feedback preamble (if regenerating)
  if (feedbackState) {
    sections.push({ name: 'feedback-preamble', partIndex: parts.length });
    parts.push({ type: 'text', content: buildRegenerationPreamble(feedbackState).trim() });
  }

  // 2. Role intro
  sections.push({ name: 'role', partIndex: parts.length });
  parts.push({ type: 'text', content: buildRoleIntro(spriteType, cols, rows) });

  // 3. Subject
  sections.push({ name: 'subject', partIndex: parts.length });
  parts.push(...builderResult.subject);

  // 4. Reference image (if subsequent grid)
  if (isSubsequentGrid && referenceImage) {
    sections.push({ name: 'reference', partIndex: parts.length });
    parts.push({ type: 'text', content: 'Use this previously completed sprite sheet ONLY as a visual reference to maintain consistent proportions, color palette, art style, and character identity. Do NOT replicate its layout or poses.' });
    parts.push({ type: 'image', data: referenceImage.data, mimeType: referenceImage.mimeType, label: 'reference' });
  }

  // 5. Instructions (type-specific rules + guidance block)
  sections.push({ name: 'instructions', partIndex: parts.length });
  parts.push(...builderResult.instructions);

  // Pixelize guidance
  const pixelGuide = getPixelizeGuidance(pixelizeSize);
  if (pixelGuide) parts.push({ type: 'text', content: pixelGuide });

  // Prompt suffix (follow-up guidance from add-sheet)
  if (promptSuffix?.trim()) parts.push({ type: 'text', content: promptSuffix.trim() });

  // 6. Canvas (template adherence — template image is injected at runtime by runGeneratePipeline)
  sections.push({ name: 'canvas', partIndex: parts.length });
  parts.push({ type: 'text', content: 'Return the completed sprite sheet as a single image. Preserve ALL header text exactly.' });

  return {
    parts,
    meta: {
      spriteType,
      hasReference: isSubsequentGrid && !!referenceImage,
      hasFeedback: !!feedbackState,
      sectionBreakdown: sections,
    },
  };
}

/**
 * Assemble a StructuredPrompt for edit mode (regeneration with feedback).
 * Different structure: no template image, source image instead, targeted feedback only.
 */
export function assembleEditPrompt(opts: {
  feedbackState: FeedbackState;
  cellLabels: string[];
  cellGroups: CellGroup[];
  cols: number;
  sourceImage: { data: string; mimeType: string };
}): StructuredPrompt {
  const { feedbackState, cellLabels, cellGroups, cols, sourceImage } = opts;

  const editText = buildEditPrompt(feedbackState, cellLabels, cellGroups, cols);

  const parts: PromptPart[] = [
    { type: 'text', content: 'You are editing an existing sprite sheet image. The source image is provided below. Make ONLY the targeted changes described in the instructions.' },
    { type: 'image', data: sourceImage.data, mimeType: sourceImage.mimeType, label: 'source' },
    { type: 'text', content: editText },
  ];

  return {
    parts,
    meta: {
      spriteType: 'edit',
      hasReference: false,
      hasFeedback: true,
      sectionBreakdown: [
        { name: 'role', partIndex: 0 },
        { name: 'source-image', partIndex: 1 },
        { name: 'edit-instructions', partIndex: 2 },
      ],
    },
  };
}
