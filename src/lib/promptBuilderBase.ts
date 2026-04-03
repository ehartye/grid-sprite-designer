/**
 * Shared utilities for prompt builders.
 * Eliminates duplicated cell-description loops, guidance composition,
 * and closing instructions across building/terrain/background builders.
 */

import type { CellGroup, HierarchicalGuidance } from '../context/AppContext';

/** Empty hierarchical guidance — no content at any level. */
export const EMPTY_GUIDANCE: HierarchicalGuidance = { overall: '', groups: {}, cells: {} };

/**
 * Compose the full guidance block for a prompt, iterating groups then cells.
 * Merges grid defaults, link-level additions, and preset-level additions at each level.
 * Empty sources are silently omitted.
 */
export function buildGuidanceBlock(
  gridGuidance: HierarchicalGuidance,
  linkGuidance: HierarchicalGuidance,
  presetGuidance: HierarchicalGuidance,
  cellGroups: CellGroup[],
  cellLabels: string[],
  cols: number,
): string {
  const parts: string[] = [];

  // Overall section
  const overallParts = [gridGuidance.overall, linkGuidance.overall, presetGuidance.overall]
    .map(s => s?.trim()).filter(Boolean);
  if (overallParts.length) {
    parts.push(`OVERALL GUIDANCE:\n${overallParts.join('\n')}`);
  }

  // Determine which cell indices belong to groups
  const groupedIndices = new Set(cellGroups.flatMap(g => g.cells));

  // Group-by-group, cell-by-cell
  for (const group of cellGroups) {
    const groupLines: string[] = [];

    // Group-level guidance
    const groupGuidanceParts = [
      gridGuidance.groups[group.name],
      linkGuidance.groups[group.name],
      presetGuidance.groups[group.name],
    ].map(s => s?.trim()).filter(Boolean);
    if (groupGuidanceParts.length) {
      groupLines.push(groupGuidanceParts.join('\n'));
    }

    // Cells in this group
    for (const cellIdx of group.cells) {
      const label = cellLabels[cellIdx];
      if (!label) continue;
      const row = Math.floor(cellIdx / cols);
      const col = cellIdx % cols;

      const cellGuidanceParts = [
        gridGuidance.cells[label],
        linkGuidance.cells[label],
        presetGuidance.cells[label],
      ].map(s => s?.trim()).filter(Boolean);

      const header = `  Cell "${label}" (${row},${col})`;
      if (cellGuidanceParts.length) {
        groupLines.push(`${header}:\n    ${cellGuidanceParts.join('\n    ')}`);
      } else {
        groupLines.push(header);
      }
    }

    parts.push(`GROUP: ${group.name}\n${groupLines.join('\n\n')}`);
  }

  // Ungrouped cells
  const ungroupedCells = cellLabels
    .map((label, idx) => ({ label, idx }))
    .filter(({ idx }) => !groupedIndices.has(idx) && cellLabels[idx]);

  if (ungroupedCells.length) {
    const ungroupedLines = ungroupedCells.map(({ label, idx }) => {
      const row = Math.floor(idx / cols);
      const col = idx % cols;
      const cellGuidanceParts = [
        gridGuidance.cells[label],
        linkGuidance.cells[label],
        presetGuidance.cells[label],
      ].map(s => s?.trim()).filter(Boolean);
      const header = `  Cell "${label}" (${row},${col})`;
      return cellGuidanceParts.length
        ? `${header}:\n    ${cellGuidanceParts.join('\n    ')}`
        : header;
    });
    parts.push(`UNGROUPED CELLS\n${ungroupedLines.join('\n\n')}`);
  }

  return parts.join('\n\n---\n\n');
}

/** The closing instruction shared by all prompt builders. */
export const CLOSING_INSTRUCTION = 'Return the completed sprite sheet as a single image. Preserve ALL header text exactly.';

const PIXELIZE_GUIDANCE: Record<number, string> = {
  16:  'TARGET PIXEL SIZE: 16×16 — Design for extreme pixel art resolution. Use 2–4 flat colors, bold silhouettes, no gradients, no fine detail. Every pixel counts; prioritize readable shape over surface detail.',
  32:  'TARGET PIXEL SIZE: 32×32 — Design for classic pixel art (NES/early SNES era). Limited palette of 4–8 colors, clean shapes, minimal shading. Sprites should read clearly as strong silhouettes.',
  48:  'TARGET PIXEL SIZE: 48×48 — Design for mid-resolution pixel art. Palette of 8–16 colors, defined shading with dithering, readable detail on key features.',
  64:  'TARGET PIXEL SIZE: 64×64 — Design for mid-resolution pixel art. Palette of 8–16 colors, defined shading, fine readable detail on faces, equipment, and surfaces.',
  128: 'TARGET PIXEL SIZE: 128×128 — Design for high-resolution pixel art. Rich palette, detailed shading with smooth dithering, fine features and textures visible. SNES/GBA era fidelity.',
};

export function getPixelizeGuidance(targetSize: number | undefined): string {
  if (targetSize === undefined) return '';
  return PIXELIZE_GUIDANCE[targetSize] ?? '';
}

/** Prefix for multi-grid reference image prompts, shared by all sprite types. */
export const REFERENCE_PREFIX = `\
You are given two images.
IMAGE 1 is a previously completed sprite sheet — use it ONLY as a visual
reference to maintain consistent proportions, color palette, art style, and
character identity. Do NOT replicate IMAGE 1's layout or poses.
IMAGE 2 is the blank template grid you must fill in. Your output image must
complete IMAGE 2. All layout instructions below describe IMAGE 2.

`;
