/**
 * Full-page generating overlay.
 * Shows a spinner, model name, and cancel button while Gemini
 * generates the sprite grid.
 */

import React from 'react';
import { useGridWorkflow } from '../../hooks/useGridWorkflow';

export function GeneratingOverlay() {
  const { state, reset } = useGridWorkflow();

  return (
    <div className="generating-overlay">
      <div className="generating-spinner" />

      <p className="gen-title">
        Generating 36 sprites with {state.model}...
      </p>

      <p className="gen-subtitle">
        This may take up to 60 seconds
      </p>

      <button className="btn btn-danger" onClick={reset}>
        Cancel
      </button>
    </div>
  );
}
