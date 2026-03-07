/**
 * Workflow hook for character sprite generation.
 * Thin wrapper around useGenericWorkflow with character-specific config.
 */

import { useGenericWorkflow, type WorkflowConfig } from './useGenericWorkflow';
import { CHARACTER_GRID, gridPresetToConfig } from '../lib/gridConfig';
import { buildGridFillPrompt } from '../lib/promptBuilder';

const characterConfig: WorkflowConfig = {
  spriteType: 'character',
  validationLabel: 'character',
  getContent: (state) => state.character,
  buildGridConfig: (state, gridLink) => {
    if (gridLink) return gridPresetToConfig(gridLink, 'character');
    return CHARACTER_GRID;
  },
  buildPrompt: (state, _gridConfig, gridLink) =>
    buildGridFillPrompt(
      state.character,
      gridLink?.genericGuidance,
      gridLink?.guidanceOverride,
      gridLink?.cellLabels,
    ),
  getReExtractGridConfig: (state) => {
    const agc = state.activeGridConfig;
    if (!agc || (agc.cols === 6 && agc.rows === 6)) return null;
    return { cols: agc.cols, rows: agc.rows, totalCells: agc.cols * agc.rows, cellLabels: agc.cellLabels };
  },
};

export function useGridWorkflow() {
  return useGenericWorkflow(characterConfig);
}
