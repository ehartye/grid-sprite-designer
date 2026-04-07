/**
 * Injects feedback annotations into a prompt for regeneration.
 * - Prepends a regeneration preamble with global feedback
 * - Augments the REFERENCE_PREFIX for regeneration context
 * - Returns a prompt suffix with per-cell and per-group feedback
 *   to be appended after buildGuidanceBlock output
 */

import type { FeedbackState } from '../types/feedback';
import type { CellGroup } from '../context/AppContext';

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
