/**
 * Background configuration panel.
 * Collects background details via preset or manual entry, mode (parallax/scene),
 * grid size, layer/scene labels, and generates the background sprite grid.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useBackgroundWorkflow } from '../../hooks/useBackgroundWorkflow';
import { BackgroundPreset, SpriteType, GridLink } from '../../context/AppContext';
import { buildBackgroundPrompt } from '../../lib/backgroundPromptBuilder';
import { getBackgroundGridConfig } from '../../lib/gridConfig';

type BackgroundField = 'name' | 'description' | 'colorNotes' | 'styleNotes';

export function BackgroundConfigPanel() {
  const { state, dispatch, generate } = useBackgroundWorkflow();
  const { background, imageSize, backgroundPresets } = state;
  const [gridLinks, setGridLinks] = useState<GridLink[]>([]);
  const [selectedPresetId, setSelectedPresetId] = useState<string>('');

  // Fetch background presets on mount
  useEffect(() => {
    fetch('/api/presets?type=background')
      .then((res) => res.json())
      .then((data: BackgroundPreset[]) => {
        dispatch({ type: 'SET_BACKGROUND_PRESETS', presets: data });
      })
      .catch(() => {});
  }, [dispatch]);

  // Fetch grid links when preset changes
  useEffect(() => {
    if (!selectedPresetId) { setGridLinks([]); return; }
    fetch(`/api/presets/background/${selectedPresetId}/grid-links`)
      .then(res => res.json())
      .then(setGridLinks)
      .catch(() => setGridLinks([]));
  }, [selectedPresetId]);

  const updateBackground = useCallback(
    (field: BackgroundField, value: string) => {
      dispatch({
        type: 'SET_BACKGROUND',
        background: { ...background, [field]: value },
      });
    },
    [background, dispatch],
  );

  const handlePresetChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const presetId = e.target.value;
      setSelectedPresetId(presetId);
      if (presetId === '') {
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
            cellLabels: [],
          },
        });
        return;
      }
      const preset = backgroundPresets.find((p) => p.id === presetId);
      if (preset) {
        dispatch({ type: 'LOAD_BACKGROUND_PRESET', preset });
      }
    },
    [backgroundPresets, background.bgMode, background.gridSize, dispatch],
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

      {/* Linked Grid Presets */}
      {gridLinks.length > 0 && (
        <div className="config-field">
          <label>Linked Grids</label>
          <div className="config-grid-badges">
            {gridLinks.map(link => (
              <span key={link.id} className="config-grid-badge">
                {link.gridName} ({link.gridSize})
              </span>
            ))}
          </div>
          <span className="config-admin-link" onClick={() => dispatch({ type: 'SET_STEP', step: 'configure' })}>
            Edit in Admin
          </span>
        </div>
      )}

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
          onClick={() => generate(gridLinks[0])}
        >
          Generate Sprites{gridLinks.length > 0 ? ` (${gridLinks[0].gridSize})` : ''}
        </button>
      </div>
    </div>
  );
}
