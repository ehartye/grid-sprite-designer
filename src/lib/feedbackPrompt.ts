/**
 * Injects feedback annotations into a prompt for regeneration.
 * - Prepends a regeneration preamble with global feedback
 * - Augments the REFERENCE_PREFIX for regeneration context
 * - Returns a prompt suffix with per-cell and per-group feedback
 *   to be appended after buildGuidanceBlock output
 */

import type { FeedbackState } from '../types/feedback';
import type { CellGroup } from '../context/AppContext';

/**
 * Build the complete edit-mode prompt for regeneration.
 * Targeted feedback only — no subject description, no layout guidance.
 * Just operational context + structured feedback.
 */
export function buildEditPrompt(
  feedback: FeedbackState,
  cellLabels: string[],
  cellGroups: CellGroup[],
  cols: number,
): string {
  const lines: string[] = [
    'You are editing an existing sprite sheet image. Make ONLY the targeted changes described below.',
    'Do NOT regenerate the entire image. Preserve all cells that are not mentioned in the feedback.',
    'Approved cells must remain exactly as they are — do not alter them in any way.',
    'For cells with feedback, make the minimum changes needed to address the feedback while',
    'maintaining consistency with the rest of the sheet (art style, proportions, palette).',
    '',
  ];

  // Global feedback
  if (feedback.global.trim()) {
    lines.push('GLOBAL FEEDBACK (applies to entire sheet):');
    lines.push(feedback.global.trim());
    lines.push('');
  }

  // Group-level feedback
  const groupedIndices = new Set(cellGroups.flatMap(g => g.cells));
  for (const group of cellGroups) {
    const groupFb = feedback.groups[group.name]?.feedback?.trim();
    const cellLines: string[] = [];

    for (const cellIdx of group.cells) {
      const label = cellLabels[cellIdx];
      if (!label) continue;
      const row = Math.floor(cellIdx / cols);
      const col = cellIdx % cols;
      const cell = feedback.cells[cellIdx];
      const header = `  (${row},${col}) "${label}"`;

      if (cell?.signedOff) {
        cellLines.push(`${header}: APPROVED — do not change`);
      } else if (cell?.feedback?.trim()) {
        cellLines.push(`${header}: CHANGE — ${cell.feedback.trim()}`);
      }
    }

    if (groupFb || cellLines.length > 0) {
      lines.push(`GROUP: ${group.name}`);
      if (groupFb) lines.push(`  Group feedback: ${groupFb}`);
      lines.push(...cellLines);
      lines.push('');
    }
  }

  // Ungrouped cells
  const ungroupedLines: string[] = [];
  for (let idx = 0; idx < cellLabels.length; idx++) {
    if (groupedIndices.has(idx)) continue;
    const label = cellLabels[idx];
    if (!label) continue;
    const row = Math.floor(idx / cols);
    const col = idx % cols;
    const cell = feedback.cells[idx];
    const header = `(${row},${col}) "${label}"`;

    if (cell?.signedOff) {
      ungroupedLines.push(`${header}: APPROVED — do not change`);
    } else if (cell?.feedback?.trim()) {
      ungroupedLines.push(`${header}: CHANGE — ${cell.feedback.trim()}`);
    }
  }

  if (ungroupedLines.length > 0) {
    lines.push('CELLS:');
    lines.push(...ungroupedLines);
    lines.push('');
  }

  lines.push('Return the complete edited sprite sheet as a single image. Preserve all header text exactly.');

  return lines.join('\n');
}

/** Preamble prepended before the reference prefix for regeneration */
export function buildRegenerationPreamble(feedback: FeedbackState): string {
  const lines = [
    'REGENERATION CONTEXT:',
    'You are regenerating a previously completed sprite sheet based on user feedback.',
    'IMAGE 1 is the previous attempt — use it as reference for approved cells and',
    'to understand what needs to change for cells with feedback.',
  ];
  if (feedback.global.trim()) {
    lines.push('');
    lines.push('GLOBAL FEEDBACK:');
    lines.push(feedback.global.trim());
  }
  return lines.join('\n') + '\n\n';
}

/**
 * Build per-cell feedback annotations to inject into the guidance block.
 * Returns a Record<string, string> keyed by cell label, where each value
 * is the feedback annotation line to append to that cell's guidance.
 */
export function buildCellFeedbackAnnotations(
  feedback: FeedbackState,
  cellLabels: string[],
): Record<string, string> {
  const annotations: Record<string, string> = {};

  for (let idx = 0; idx < cellLabels.length; idx++) {
    const cell = feedback.cells[idx];
    if (!cell) continue;

    const label = cellLabels[idx];
    if (!label) continue;

    if (cell.signedOff) {
      annotations[label] = 'APPROVED — This cell meets requirements. Preserve this appearance.';
    } else if (cell.feedback.trim()) {
      annotations[label] = `FEEDBACK: ${cell.feedback.trim()}`;
    }
  }

  return annotations;
}

/**
 * Build per-group feedback annotations.
 * Returns a Record<string, string> keyed by group name.
 */
export function buildGroupFeedbackAnnotations(
  feedback: FeedbackState,
): Record<string, string> {
  const annotations: Record<string, string> = {};

  for (const [groupName, groupFb] of Object.entries(feedback.groups)) {
    if (groupFb.feedback.trim()) {
      annotations[groupName] = `GROUP FEEDBACK: ${groupFb.feedback.trim()}`;
    }
  }

  return annotations;
}
