/**
 * Background configuration panel.
 * Collects background details via preset or manual entry, mode (parallax/scene),
 * grid size, layer/scene labels, and generates the background sprite grid.
 */

import React, { useCallback, useEffect, useMemo } from 'react';
import { useBackgroundWorkflow } from '../../hooks/useBackgroundWorkflow';
import { BackgroundPreset, SpriteType } from '../../context/AppContext';
import type { BackgroundGridSize, BackgroundMode } from '../../lib/gridConfig';
import { buildBackgroundPrompt } from '../../lib/backgroundPromptBuilder';
import { getBackgroundGridConfig, BACKGROUND_GRIDS } from '../../lib/gridConfig';

type BackgroundField = 'name' | 'description' | 'colorNotes' | 'styleNotes' | 'layerGuidance';

const PARALLAX_OPTIONS: { value: BackgroundGridSize; label: string; cells: number }[] = [
  { value: '1x3', label: '1\u00d73', cells: 3 },
  { value: '1x4', label: '1\u00d74', cells: 4 },
  { value: '1x5', label: '1\u00d75', cells: 5 },
];

const SCENE_OPTIONS: { value: BackgroundGridSize; label: string; cells: number }[] = [
  { value: '2x2', label: '2\u00d72', cells: 4 },
  { value: '3x2', label: '3\u00d72', cells: 6 },
  { value: '3x3-scene', label: '3\u00d73', cells: 9 },
];

export function BackgroundConfigPanel() {
  const { state, dispatch, generate } = useBackgroundWorkflow();
  const { background, imageSize, backgroundPresets } = state;

  const gridSizeOptions = background.bgMode === 'parallax' ? PARALLAX_OPTIONS : SCENE_OPTIONS;

  // Fetch background presets on mount
  useEffect(() => {
    fetch('/api/presets?type=background')
      .then((res) => res.json())
      .then((data: BackgroundPreset[]) => {
        dispatch({ type: 'SET_BACKGROUND_PRESETS', presets: data });
      })
      .catch(() => {});
  }, [dispatch]);

  const updateBackground = useCallback(
    (field: BackgroundField, value: string) => {
      dispatch({
        type: 'SET_BACKGROUND',
        background: { ...background, [field]: value },
      });
    },
    [background, dispatch],
  );

  const updateCellLabel = useCallback(
    (idx: number, value: string) => {
      const labels = [...background.cellLabels];
      labels[idx] = value;
      dispatch({
        type: 'SET_BACKGROUND',
        background: { ...background, cellLabels: labels },
      });
    },
    [background, dispatch],
  );

  const handleModeChange = useCallback(
    (bgMode: BackgroundMode) => {
      const options = bgMode === 'parallax' ? PARALLAX_OPTIONS : SCENE_OPTIONS;
      const gridSize = options[0].value;
      const cells = options[0].cells;
      dispatch({
        type: 'SET_BACKGROUND',
        background: { ...background, bgMode, gridSize, cellLabels: Array(cells).fill('') },
      });
    },
    [background, dispatch],
  );

  const handleGridSizeChange = useCallback(
    (gridSize: BackgroundGridSize) => {
      const cells = gridSizeOptions.find(o => o.value === gridSize)!.cells;
      const labels = Array(cells).fill('');
      for (let i = 0; i < Math.min(background.cellLabels.length, cells); i++) {
        labels[i] = background.cellLabels[i];
      }
      dispatch({
        type: 'SET_BACKGROUND',
        background: { ...background, gridSize, cellLabels: labels },
      });
    },
    [background, gridSizeOptions, dispatch],
  );

  const handlePresetChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const presetId = e.target.value;
      if (presetId === '') {
        const cells = gridSizeOptions.find(o => o.value === background.gridSize)!.cells;
        dispatch({
          type: 'SET_BACKGROUND',
          background: {
            name: '',
            description: '',
            colorNotes: '',
            styleNotes: '',
            layerGuidance: '',
            bgMode: background.bgMode,
            gridSize: background.gridSize,
            cellLabels: Array(cells).fill(''),
          },
        });
        return;
      }
      const preset = backgroundPresets.find((p) => p.id === presetId);
      if (preset) {
        dispatch({ type: 'LOAD_BACKGROUND_PRESET', preset });
      }
    },
    [backgroundPresets, background.bgMode, background.gridSize, gridSizeOptions, dispatch],
  );

  const gridConfig = useMemo(
    () => getBackgroundGridConfig(background.gridSize, background.cellLabels),
    [background.gridSize, background.cellLabels],
  );

  const canGenerate = background.name.trim().length > 0 && background.description.trim().length > 0;

  const promptPreview = useMemo(
    () => buildBackgroundPrompt(background, gridConfig),
    [background, gridConfig],
  );

  const presetsByGenre = useMemo(
    () => backgroundPresets.reduce<Record<string, BackgroundPreset[]>>((acc, p) => {
      const genre = p.genre || 'Other';
      if (!acc[genre]) acc[genre] = [];
      acc[genre].push(p);
      return acc;
    }, {}),
    [backgroundPresets],
  );

  const gridSizeInfo = gridSizeOptions.find(o => o.value === background.gridSize)!;
  const labelNoun = background.bgMode === 'parallax' ? 'Layer' : 'Scene';

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

      <h2>Background Setup</h2>

      {/* Preset Selector */}
      <div className="config-field preset-selector">
        <label htmlFor="background-preset-select">Preset</label>
        <select id="background-preset-select" onChange={handlePresetChange} defaultValue="">
          <option value="">Custom Background</option>
          {Object.entries(presetsByGenre).map(([genre, items]) => (
            <optgroup key={genre} label={genre}>
              {items.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.bgMode} {p.gridSize})
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      {/* Background Mode Selector */}
      <div className="config-field">
        <label>Background Mode</label>
        <div className="segmented-control">
          <button
            type="button"
            className={background.bgMode === 'parallax' ? 'active' : ''}
            onClick={() => handleModeChange('parallax')}
          >
            Parallax Layers
          </button>
          <button
            type="button"
            className={background.bgMode === 'scene' ? 'active' : ''}
            onClick={() => handleModeChange('scene')}
          >
            Scene Variations
          </button>
        </div>
      </div>

      {/* Grid Size Selector */}
      <div className="config-field">
        <label>Grid Size</label>
        <div className="segmented-control">
          {gridSizeOptions.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={background.gridSize === opt.value ? 'active' : ''}
              onClick={() => handleGridSizeChange(opt.value)}
            >
              {opt.label} ({opt.cells} cells)
            </button>
          ))}
        </div>
      </div>

      <div className="preset-divider" />

      {/* Background Name */}
      <div className="config-field">
        <label htmlFor="background-name">Background Name</label>
        <input
          id="background-name"
          type="text"
          placeholder="e.g. Enchanted Forest"
          value={background.name}
          onChange={(e) => updateBackground('name', e.target.value)}
        />
      </div>

      {/* Background Description */}
      <div className="config-field">
        <label htmlFor="background-desc">Background Description</label>
        <textarea
          id="background-desc"
          rows={4}
          placeholder="A mystical forest with towering ancient trees, magical glowing particles, and dappled sunlight..."
          value={background.description}
          onChange={(e) => updateBackground('description', e.target.value)}
        />
      </div>

      {/* Color Notes */}
      <div className="config-field">
        <label htmlFor="background-colors">Color Notes</label>
        <textarea
          id="background-colors"
          rows={2}
          placeholder="deep greens, ethereal blues, warm golden highlights"
          value={background.colorNotes}
          onChange={(e) => updateBackground('colorNotes', e.target.value)}
        />
      </div>

      {/* Style Notes */}
      <div className="config-field">
        <label htmlFor="background-style">Style Notes (optional)</label>
        <textarea
          id="background-style"
          rows={2}
          placeholder="atmospheric depth, layered parallax effect"
          value={background.styleNotes}
          onChange={(e) => updateBackground('styleNotes', e.target.value)}
        />
      </div>

      {/* Layer/Scene Labels */}
      <div className="config-field">
        <label>{labelNoun} Labels ({gridSizeInfo.cells} cells)</label>
        <div className="cell-labels-grid" style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${BACKGROUND_GRIDS[background.gridSize].cols}, 1fr)`,
          gap: '6px',
        }}>
          {background.cellLabels.map((label, idx) => {
            const row = Math.floor(idx / BACKGROUND_GRIDS[background.gridSize].cols);
            const col = idx % BACKGROUND_GRIDS[background.gridSize].cols;
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

      {/* Layer/Scene Guidance */}
      <div className="config-field row-guidance">
        <label htmlFor="background-guidance">{labelNoun} Guidance</label>
        <textarea
          id="background-guidance"
          rows={6}
          placeholder={`Per-${labelNoun.toLowerCase()} descriptions (loaded from preset or enter custom)...`}
          value={background.layerGuidance}
          onChange={(e) => updateBackground('layerGuidance', e.target.value)}
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
