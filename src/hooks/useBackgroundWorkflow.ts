/**
 * Workflow hook for background sprite generation.
 * Thin wrapper around useGenericWorkflow with background-specific config.
 */

import { useGenericWorkflow, type WorkflowConfig } from './useGenericWorkflow';
import { getBackgroundGridConfig, gridPresetToConfig } from '../lib/gridConfig';
import { buildBackgroundPrompt } from '../lib/backgroundPromptBuilder';
import type { HierarchicalGuidance } from '../context/AppContext';

const EMPTY_GUIDANCE: HierarchicalGuidance = { overall: '', groups: {}, cells: {} };

export const backgroundConfig: WorkflowConfig = {
  spriteType: 'background',
  validationLabel: 'background',
  getContent: (state) => state.background,
  buildGridConfig: (state, gridLink) => {
    if (gridLink) return gridPresetToConfig(gridLink, 'background');
    return getBackgroundGridConfig(state.background.gridSize, state.background.cellLabels);
  },
  buildPrompt: (state, gridConfig, gridLink) => {
    const cols = gridLink?.cols ?? gridConfig.cols;
    const rows = gridLink?.rows ?? gridConfig.rows;
    return buildBackgroundPrompt(
      state.background,
      gridLink?.gridGuidance ?? EMPTY_GUIDANCE,
      gridLink?.linkGuidance ?? EMPTY_GUIDANCE,
      EMPTY_GUIDANCE,
      gridLink?.cellGroups ?? [],
      gridLink?.cellLabels ?? gridConfig.cellLabels,
      cols,
      rows,
    );
  },
  getReExtractGridConfig: (state) => {
    const gc = getBackgroundGridConfig(state.background.gridSize, state.background.cellLabels);
    return { cols: gc.cols, rows: gc.rows, totalCells: gc.totalCells, cellLabels: gc.cellLabels };
  },
};

export function useBackgroundWorkflow() {
  return useGenericWorkflow(backgroundConfig);
}
