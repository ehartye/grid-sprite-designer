/**
 * Building configuration panel.
 * Collects building details via preset or manual entry, grid size,
 * cell labels, and generates the building sprite grid.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useBuildingWorkflow } from '../../hooks/useBuildingWorkflow';
import { BuildingPreset, SpriteType, GridLink } from '../../context/AppContext';
import { buildBuildingPrompt } from '../../lib/buildingPromptBuilder';
import { getBuildingGridConfig } from '../../lib/gridConfig';
import { GridLinkSelector } from '../shared/GridLinkSelector';
import '../../styles/run-builder.css';

type BuildingField = 'name' | 'description' | 'details' | 'colorNotes' | 'styleNotes';

export function BuildingConfigPanel() {
  const { state, dispatch, generate } = useBuildingWorkflow();
  const { building, imageSize, buildingPresets } = state;
  const [selectedGridLinks, setSelectedGridLinks] = useState<GridLink[]>([]);
  const [selectedPresetId, setSelectedPresetId] = useState<string>('');

  // Fetch building presets on mount
  useEffect(() => {
    fetch('/api/presets?type=building')
      .then((res) => res.json())
      .then((data: BuildingPreset[]) => {
        dispatch({ type: 'SET_BUILDING_PRESETS', presets: data });
      })
      .catch(() => {});
  }, [dispatch]);

  const handleGridSelectionChange = useCallback((selected: GridLink[]) => {
    setSelectedGridLinks(selected);
  }, []);

  const updateBuilding = useCallback(
    (field: BuildingField, value: string) => {
      dispatch({
        type: 'SET_BUILDING',
        building: { ...building, [field]: value },
      });
    },
    [building, dispatch],
  );

  const handlePresetChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const presetId = e.target.value;
      setSelectedPresetId(presetId);
      if (presetId === '') {
        dispatch({
          type: 'SET_BUILDING',
          building: {
            name: '',
            description: '',
            details: '',
            colorNotes: '',
            styleNotes: '',
            cellGuidance: '',
            gridSize: building.gridSize,
            cellLabels: [],
          },
        });
        return;
      }
      const preset = buildingPresets.find((p) => p.id === presetId);
      if (preset) {
        dispatch({ type: 'LOAD_BUILDING_PRESET', preset });
      }
    },
    [buildingPresets, building.gridSize, dispatch],
  );

  const gridConfig = useMemo(
    () => getBuildingGridConfig(building.gridSize, building.cellLabels),
    [building.gridSize, building.cellLabels],
  );

  const canGenerate = building.name.trim().length > 0 && building.description.trim().length > 0;

  const promptPreview = useMemo(
    () => buildBuildingPrompt(building, gridConfig),
    [building, gridConfig],
  );

  const presetsByGenre = useMemo(
    () => buildingPresets.reduce<Record<string, BuildingPreset[]>>((acc, p) => {
      const genre = p.genre || 'Other';
      if (!acc[genre]) acc[genre] = [];
      acc[genre].push(p);
      return acc;
    }, {}),
    [buildingPresets],
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

      <h2>Building Setup</h2>

      {/* Preset Selector */}
      <div className="config-field preset-selector">
        <label htmlFor="building-preset-select">Preset</label>
        <select id="building-preset-select" onChange={handlePresetChange} defaultValue="">
          <option value="">Custom Building</option>
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

      {/* Building Name */}
      <div className="config-field">
        <label htmlFor="building-name">Building Name</label>
        <input
          id="building-name"
          type="text"
          placeholder="e.g. Medieval Inn"
          value={building.name}
          onChange={(e) => updateBuilding('name', e.target.value)}
        />
      </div>

      {/* Building Description */}
      <div className="config-field">
        <label htmlFor="building-desc">Building Description</label>
        <textarea
          id="building-desc"
          rows={4}
          placeholder="A cozy two-story medieval inn with a thatched roof and warm light spilling from windows..."
          value={building.description}
          onChange={(e) => updateBuilding('description', e.target.value)}
        />
      </div>

      {/* Structural Details */}
      <div className="config-field">
        <label htmlFor="building-details">Structural Details</label>
        <textarea
          id="building-details"
          rows={2}
          placeholder="stone foundation, timber-framed walls, iron hinges"
          value={building.details}
          onChange={(e) => updateBuilding('details', e.target.value)}
        />
      </div>

      {/* Color Notes */}
      <div className="config-field">
        <label htmlFor="building-colors">Color Notes</label>
        <textarea
          id="building-colors"
          rows={2}
          placeholder="warm browns and tans for wood, grey stone, golden window glow"
          value={building.colorNotes}
          onChange={(e) => updateBuilding('colorNotes', e.target.value)}
        />
      </div>

      {/* Style Notes */}
      <div className="config-field">
        <label htmlFor="building-style">Style Notes (optional)</label>
        <textarea
          id="building-style"
          rows={2}
          placeholder="atmospheric lighting, pixel-perfect details"
          value={building.styleNotes}
          onChange={(e) => updateBuilding('styleNotes', e.target.value)}
        />
      </div>

      {/* Grid Preset Selector */}
      <GridLinkSelector
        spriteType="building"
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
                  spriteType: 'building',
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
