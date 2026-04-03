/**
 * Workflow hook for building sprite generation.
 * Thin wrapper around useGenericWorkflow with building-specific config.
 */

import { useGenericWorkflow, type WorkflowConfig } from './useGenericWorkflow';
import { getBuildingGridConfig, gridPresetToConfig } from '../lib/gridConfig';
import { buildBuildingPrompt } from '../lib/buildingPromptBuilder';
import { EMPTY_GUIDANCE } from '../lib/promptBuilderBase';

export const buildingConfig: WorkflowConfig = {
  spriteType: 'building',
  validationLabel: 'building',
  getContent: (state) => state.building,
  buildGridConfig: (state, gridLink) => {
    if (gridLink) return gridPresetToConfig(gridLink, 'building');
    return getBuildingGridConfig(state.building.gridSize, state.building.cellLabels);
  },
  buildPrompt: (state, gridConfig, gridLink) => {
    const cols = gridLink?.cols ?? gridConfig.cols;
    const rows = gridLink?.rows ?? gridConfig.rows;
    return buildBuildingPrompt(
      state.building,
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
    const gc = getBuildingGridConfig(state.building.gridSize, state.building.cellLabels);
    return { cols: gc.cols, rows: gc.rows, totalCells: gc.totalCells, cellLabels: gc.cellLabels };
  },
};

export function useBuildingWorkflow() {
  return useGenericWorkflow(buildingConfig);
}
