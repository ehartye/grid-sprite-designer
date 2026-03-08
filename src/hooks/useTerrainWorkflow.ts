/**
 * Workflow hook for terrain sprite generation.
 * Thin wrapper around useGenericWorkflow with terrain-specific config.
 */

import { useGenericWorkflow, type WorkflowConfig } from './useGenericWorkflow';
import { getTerrainGridConfig, gridPresetToConfig } from '../lib/gridConfig';
import { buildTerrainPrompt } from '../lib/terrainPromptBuilder';

export const terrainConfig: WorkflowConfig = {
  spriteType: 'terrain',
  validationLabel: 'terrain',
  getContent: (state) => state.terrain,
  buildGridConfig: (state, gridLink) => {
    if (gridLink) return gridPresetToConfig(gridLink, 'terrain');
    return getTerrainGridConfig(state.terrain.gridSize, state.terrain.cellLabels);
  },
  buildPrompt: (state, gridConfig, gridLink) =>
    buildTerrainPrompt(
      state.terrain,
      gridConfig,
      gridLink?.genericGuidance,
      gridLink?.guidanceOverride,
    ),
  getReExtractGridConfig: (state) => {
    const gc = getTerrainGridConfig(state.terrain.gridSize, state.terrain.cellLabels);
    return { cols: gc.cols, rows: gc.rows, totalCells: gc.totalCells, cellLabels: gc.cellLabels };
  },
};

export function useTerrainWorkflow() {
  return useGenericWorkflow(terrainConfig);
}
