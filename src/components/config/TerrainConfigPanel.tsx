/**
 * Terrain configuration panel.
 * Collects terrain details via preset or manual entry, grid size,
 * tile labels, and generates the terrain sprite grid.
 */

import React, { useCallback, useEffect, useMemo } from 'react';
import { useTerrainWorkflow } from '../../hooks/useTerrainWorkflow';
import { TerrainPreset, SpriteType } from '../../context/AppContext';
import type { TerrainGridSize } from '../../lib/gridConfig';
import { buildTerrainPrompt } from '../../lib/terrainPromptBuilder';
import { getTerrainGridConfig, TERRAIN_GRIDS } from '../../lib/gridConfig';

type TerrainField = 'name' | 'description' | 'colorNotes' | 'styleNotes' | 'tileGuidance';

const GRID_SIZE_OPTIONS: { value: TerrainGridSize; label: string; cells: number }[] = [
  { value: '3x3', label: '3\u00d73', cells: 9 },
  { value: '4x4', label: '4\u00d74', cells: 16 },
  { value: '5x5', label: '5\u00d75', cells: 25 },
];

export function TerrainConfigPanel() {
  const { state, dispatch, generate } = useTerrainWorkflow();
  const { terrain, imageSize, terrainPresets } = state;

  // Fetch terrain presets on mount
  useEffect(() => {
    fetch('/api/presets?type=terrain')
      .then((res) => res.json())
      .then((data: TerrainPreset[]) => {
        dispatch({ type: 'SET_TERRAIN_PRESETS', presets: data });
      })
      .catch(() => {});
  }, [dispatch]);

  const updateTerrain = useCallback(
    (field: TerrainField, value: string) => {
      dispatch({
        type: 'SET_TERRAIN',
        terrain: { ...terrain, [field]: value },
      });
    },
    [terrain, dispatch],
  );

  const updateCellLabel = useCallback(
    (idx: number, value: string) => {
      const labels = [...terrain.cellLabels];
      labels[idx] = value;
      dispatch({
        type: 'SET_TERRAIN',
        terrain: { ...terrain, cellLabels: labels },
      });
    },
    [terrain, dispatch],
  );

  const handleGridSizeChange = useCallback(
    (gridSize: TerrainGridSize) => {
      const cells = GRID_SIZE_OPTIONS.find(o => o.value === gridSize)!.cells;
      const labels = Array(cells).fill('');
      for (let i = 0; i < Math.min(terrain.cellLabels.length, cells); i++) {
        labels[i] = terrain.cellLabels[i];
      }
      dispatch({
        type: 'SET_TERRAIN',
        terrain: { ...terrain, gridSize, cellLabels: labels },
      });
    },
    [terrain, dispatch],
  );

  const handlePresetChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const presetId = e.target.value;
      if (presetId === '') {
        const cells = GRID_SIZE_OPTIONS.find(o => o.value === terrain.gridSize)!.cells;
        dispatch({
          type: 'SET_TERRAIN',
          terrain: {
            name: '',
            description: '',
            colorNotes: '',
            styleNotes: '',
            tileGuidance: '',
            gridSize: terrain.gridSize,
            cellLabels: Array(cells).fill(''),
          },
        });
        return;
      }
      const preset = terrainPresets.find((p) => p.id === presetId);
      if (preset) {
        dispatch({ type: 'LOAD_TERRAIN_PRESET', preset });
      }
    },
    [terrainPresets, terrain.gridSize, dispatch],
  );

  const gridConfig = useMemo(
    () => getTerrainGridConfig(terrain.gridSize, terrain.cellLabels),
    [terrain.gridSize, terrain.cellLabels],
  );

  const canGenerate = terrain.name.trim().length > 0 && terrain.description.trim().length > 0;

  const promptPreview = useMemo(
    () => buildTerrainPrompt(terrain, gridConfig),
    [terrain, gridConfig],
  );

  const presetsByGenre = useMemo(
    () => terrainPresets.reduce<Record<string, TerrainPreset[]>>((acc, p) => {
      const genre = p.genre || 'Other';
      if (!acc[genre]) acc[genre] = [];
      acc[genre].push(p);
      return acc;
    }, {}),
    [terrainPresets],
  );

  const gridSizeInfo = GRID_SIZE_OPTIONS.find(o => o.value === terrain.gridSize)!;

  return (
    <div className="config-panel">
      {/* Mode Toggle: Character / Building / Terrain / Background */}
      <div className="config-field">
        <div className="segmented-control">
          {(['character', 'building', 'terrain', 'background'] as SpriteType[]).map((t) => (
            <button
              key={t}
              type="button"
              className={state.spriteType === t ? 'active' : ''}
              onClick={() => dispatch({ type: 'SET_SPRITE_TYPE', spriteType: t })}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <h2>Terrain Setup</h2>

      {/* Preset Selector */}
      <div className="config-field preset-selector">
        <label htmlFor="terrain-preset-select">Preset</label>
        <select id="terrain-preset-select" onChange={handlePresetChange} defaultValue="">
          <option value="">Custom Terrain</option>
          {Object.entries(presetsByGenre).map(([genre, items]) => (
            <optgroup key={genre} label={genre}>
              {items.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.gridSize})
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      {/* Grid Size Selector */}
      <div className="config-field">
        <label>Grid Size</label>
        <div className="segmented-control">
          {GRID_SIZE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={terrain.gridSize === opt.value ? 'active' : ''}
              onClick={() => handleGridSizeChange(opt.value)}
            >
              {opt.label} ({opt.cells} cells)
            </button>
          ))}
        </div>
      </div>

      <div className="preset-divider" />

      {/* Terrain Name */}
      <div className="config-field">
        <label htmlFor="terrain-name">Terrain Name</label>
        <input
          id="terrain-name"
          type="text"
          placeholder="e.g. Grassland Plains"
          value={terrain.name}
          onChange={(e) => updateTerrain('name', e.target.value)}
        />
      </div>

      {/* Terrain Description */}
      <div className="config-field">
        <label htmlFor="terrain-desc">Terrain Description</label>
        <textarea
          id="terrain-desc"
          rows={4}
          placeholder="Lush green grassland with dirt paths, rocky outcrops, and wildflowers..."
          value={terrain.description}
          onChange={(e) => updateTerrain('description', e.target.value)}
        />
      </div>

      {/* Color Notes */}
      <div className="config-field">
        <label htmlFor="terrain-colors">Color Notes</label>
        <textarea
          id="terrain-colors"
          rows={2}
          placeholder="rich greens, earthy browns, subtle yellows for dry patches"
          value={terrain.colorNotes}
          onChange={(e) => updateTerrain('colorNotes', e.target.value)}
        />
      </div>

      {/* Style Notes */}
      <div className="config-field">
        <label htmlFor="terrain-style">Style Notes (optional)</label>
        <textarea
          id="terrain-style"
          rows={2}
          placeholder="top-down perspective, consistent shading direction"
          value={terrain.styleNotes}
          onChange={(e) => updateTerrain('styleNotes', e.target.value)}
        />
      </div>

      {/* Tile Labels */}
      <div className="config-field">
        <label>Tile Labels ({gridSizeInfo.cells} cells)</label>
        <div className="cell-labels-grid" style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${TERRAIN_GRIDS[terrain.gridSize].cols}, 1fr)`,
          gap: '6px',
        }}>
          {terrain.cellLabels.map((label, idx) => {
            const row = Math.floor(idx / TERRAIN_GRIDS[terrain.gridSize].cols);
            const col = idx % TERRAIN_GRIDS[terrain.gridSize].cols;
            return (
              <input
                key={idx}
                type="text"
                placeholder={`(${row},${col})`}
                value={label}
                onChange={(e) => updateCellLabel(idx, e.target.value)}
                className="cell-label-input"
              />
            );
          })}
        </div>
      </div>

      {/* Tile Guidance */}
      <div className="config-field row-guidance">
        <label htmlFor="terrain-guidance">Tile Guidance</label>
        <textarea
          id="terrain-guidance"
          rows={6}
          placeholder="Per-tile descriptions (loaded from preset or enter custom)..."
          value={terrain.tileGuidance}
          onChange={(e) => updateTerrain('tileGuidance', e.target.value)}
        />
      </div>

      {/* Image Size */}
      <div className="config-field">
        <label>Image Size</label>
        <div className="segmented-control">
          <button
            type="button"
            className={imageSize === '2K' ? 'active' : ''}
            onClick={() => dispatch({ type: 'SET_IMAGE_SIZE', imageSize: '2K' })}
          >
            2K (2048px)
          </button>
          <button
            type="button"
            className={imageSize === '4K' ? 'active' : ''}
            onClick={() => dispatch({ type: 'SET_IMAGE_SIZE', imageSize: '4K' })}
          >
            4K (4096px)
          </button>
        </div>
      </div>

      {/* Prompt Preview */}
      <details className="prompt-preview">
        <summary>View Full Prompt</summary>
        <pre className="prompt-preview-text">{promptPreview}</pre>
      </details>

      {/* Generate Button */}
      <div className="config-actions">
        <button
          type="button"
          className="btn btn-accent btn-lg w-full"
          disabled={!canGenerate}
          onClick={() => generate()}
        >
          Generate All {gridSizeInfo.cells} Sprites
        </button>
      </div>
    </div>
  );
}
