/**
 * Workflow hook for background sprite generation.
 * Thin wrapper around useGenericWorkflow with background-specific config.
 */

import { useGenericWorkflow, type WorkflowConfig } from './useGenericWorkflow';
import { getBackgroundGridConfig, gridPresetToConfig } from '../lib/gridConfig';
import { buildBackgroundPrompt } from '../lib/backgroundPromptBuilder';

export const backgroundConfig: WorkflowConfig = {
  spriteType: 'background',
  validationLabel: 'background',
  getContent: (state) => state.background,
  buildGridConfig: (state, gridLink) => {
    if (gridLink) return gridPresetToConfig(gridLink, 'background');
    return getBackgroundGridConfig(state.background.gridSize, state.background.cellLabels);
  },
  buildPrompt: (state, gridConfig, gridLink) =>
    buildBackgroundPrompt(
      state.background,
      gridConfig,
      // TODO Task 5-7: replace with gridLink?.gridGuidance / linkGuidance
      gridLink?.gridGuidance?.overall,
      gridLink?.linkGuidance?.overall,
    ),
  getReExtractGridConfig: (state) => {
    const gc = getBackgroundGridConfig(state.background.gridSize, state.background.cellLabels);
    return { cols: gc.cols, rows: gc.rows, totalCells: gc.totalCells, cellLabels: gc.cellLabels };
  },
};

export function useBackgroundWorkflow() {
  return useGenericWorkflow(backgroundConfig);
}
