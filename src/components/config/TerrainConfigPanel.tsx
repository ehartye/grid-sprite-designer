/**
 * Terrain configuration panel.
 * Collects terrain details via preset or manual entry, grid size,
 * tile labels, and generates the terrain sprite grid.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTerrainWorkflow } from '../../hooks/useTerrainWorkflow';
import { TerrainPreset, SpriteType, GridLink } from '../../context/AppContext';
import { buildTerrainPrompt } from '../../lib/terrainPromptBuilder';
import { getTerrainGridConfig } from '../../lib/gridConfig';
import { GridLinkSelector } from '../shared/GridLinkSelector';
import '../../styles/run-builder.css';

type TerrainField = 'name' | 'description' | 'colorNotes' | 'styleNotes';

export function TerrainConfigPanel() {
  const { state, dispatch, generate } = useTerrainWorkflow();
  const { terrain, imageSize, terrainPresets } = state;
  const [selectedGridLinks, setSelectedGridLinks] = useState<GridLink[]>([]);
  const [selectedPresetId, setSelectedPresetId] = useState<string>('');

  // Fetch terrain presets on mount
  useEffect(() => {
    fetch('/api/presets?type=terrain')
      .then((res) => res.json())
      .then((data: TerrainPreset[]) => {
        dispatch({ type: 'SET_TERRAIN_PRESETS', presets: data });
      })
      .catch((err) => {
        console.error('Failed to load terrain presets:', err);
        dispatch({ type: 'SET_STATUS', message: 'Failed to load terrain presets', statusType: 'warning' });
      });
  }, [dispatch]);

  const handleGridSelectionChange = useCallback((selected: GridLink[]) => {
    setSelectedGridLinks(selected);
    if (selected.length > 0) {
      dispatch({ type: 'SET_ASPECT_RATIO', payload: selected[0].aspectRatio || '1:1' });
    }
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

  const handlePresetChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const presetId = e.target.value;
      setSelectedPresetId(presetId);
      if (presetId === '') {
        dispatch({
          type: 'SET_TERRAIN',
          terrain: {
            name: '',
            description: '',
            colorNotes: '',
            styleNotes: '',
            tileGuidance: '',
            gridSize: terrain.gridSize,
            cellLabels: [],
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

      {/* Grid Preset Selector */}
      <GridLinkSelector
        spriteType="terrain"
        presetId={selectedPresetId}
        onSelectionChange={handleGridSelectionChange}
      />

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
          disabled={!canGenerate || selectedGridLinks.length === 0}
          onClick={() => {
            if (selectedGridLinks.length > 1) {
              dispatch({
                type: 'START_RUN',
                payload: {
                  contentPresetId: selectedPresetId,
                  spriteType: 'terrain',
                  gridLinks: selectedGridLinks,
                  imageSize: imageSize as '2K' | '4K',
                },
              });
            } else if (selectedGridLinks.length === 1) {
              generate(selectedGridLinks[0]);
            }
          }}
        >
          {selectedGridLinks.length > 1
            ? `Generate ${selectedGridLinks.length} Grids`
            : selectedGridLinks.length === 1
              ? `Generate Sprites (${selectedGridLinks[0].gridSize})`
              : 'Generate Sprites'}
        </button>
      </div>
    </div>
  );
}
