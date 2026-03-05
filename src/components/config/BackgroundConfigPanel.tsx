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
import { GridLinkSelector } from '../shared/GridLinkSelector';
import '../../styles/run-builder.css';

type BackgroundField = 'name' | 'description' | 'colorNotes' | 'styleNotes';

export function BackgroundConfigPanel() {
  const { state, dispatch, generate } = useBackgroundWorkflow();
  const { background, imageSize, backgroundPresets } = state;
  const [selectedGridLinks, setSelectedGridLinks] = useState<GridLink[]>([]);
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

  const handleGridSelectionChange = useCallback((selected: GridLink[]) => {
    setSelectedGridLinks(selected);
    if (selected.length > 0) {
      dispatch({ type: 'SET_ASPECT_RATIO', payload: selected[0].aspectRatio || '1:1' });
    }
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

      {/* Grid Preset Selector */}
      <GridLinkSelector
        spriteType="background"
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
                  spriteType: 'background',
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
