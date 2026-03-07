/**
 * Workflow hook for building sprite generation.
 * Thin wrapper around useGenericWorkflow with building-specific config.
 */

import { useGenericWorkflow, type WorkflowConfig } from './useGenericWorkflow';
import { getBuildingGridConfig, gridPresetToConfig } from '../lib/gridConfig';
import { buildBuildingPrompt } from '../lib/buildingPromptBuilder';

const buildingConfig: WorkflowConfig = {
  spriteType: 'building',
  validationLabel: 'building',
  getContent: (state) => state.building,
  buildGridConfig: (state, gridLink) => {
    if (gridLink) return gridPresetToConfig(gridLink, 'building');
    return getBuildingGridConfig(state.building.gridSize, state.building.cellLabels);
  },
  buildPrompt: (state, gridConfig, gridLink) =>
    buildBuildingPrompt(
      state.building,
      gridConfig,
      gridLink?.genericGuidance,
      gridLink?.guidanceOverride,
    ),
  getReExtractGridConfig: (state) => {
    const gc = getBuildingGridConfig(state.building.gridSize, state.building.cellLabels);
    return { cols: gc.cols, rows: gc.rows, totalCells: gc.totalCells, cellLabels: gc.cellLabels };
  },
};

export function useBuildingWorkflow() {
  return useGenericWorkflow(buildingConfig);
}
