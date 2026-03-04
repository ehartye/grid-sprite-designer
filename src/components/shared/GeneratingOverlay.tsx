/**
 * Full-page generating overlay.
 * Shows a spinner, model name, and cancel button while Gemini
 * generates the sprite grid.
 */

import React from 'react';
import { useAppContext } from '../../context/AppContext';
import { useGridWorkflow } from '../../hooks/useGridWorkflow';
import { BUILDING_GRIDS, TERRAIN_GRIDS, BACKGROUND_GRIDS } from '../../lib/gridConfig';

export function GeneratingOverlay() {
  const { state } = useAppContext();
  const { cancelGeneration } = useGridWorkflow();

  let cellCount = 36;
  if (state.spriteType === 'building') {
    cellCount = BUILDING_GRIDS[state.building.gridSize]?.totalCells ?? 9;
  } else if (state.spriteType === 'terrain') {
    cellCount = TERRAIN_GRIDS[state.terrain.gridSize]?.totalCells ?? 16;
  } else if (state.spriteType === 'background') {
    cellCount = BACKGROUND_GRIDS[state.background.gridSize]?.totalCells ?? 4;
  }

  return (
    <div className="generating-overlay">
      <div className="generating-spinner" />

      <p className="gen-title">
        Generating {cellCount} sprites with {state.model}...
      </p>

      <p className="gen-subtitle">
        This may take up to 60 seconds
      </p>

      <button className="btn btn-danger" onClick={cancelGeneration}>
        Cancel
      </button>
    </div>
  );
}
