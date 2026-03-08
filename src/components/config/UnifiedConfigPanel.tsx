/**
 * Unified configuration panel for all sprite types.
 * Replaces the 4 separate ConfigPanel/BuildingConfigPanel/TerrainConfigPanel/BackgroundConfigPanel
 * components with a single implementation that adapts based on the active spriteType.
 *
 * Fixes: Aspect Ratio selector was previously missing from building/terrain/background panels.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useGenericWorkflow, WORKFLOW_CONFIGS } from '../../hooks/useGenericWorkflow';
import {
  useAppState,
  type SpriteType,
  type GridLink,
  type Action,
  type CharacterPreset,
  type BuildingPreset,
  type TerrainPreset,
  type BackgroundPreset,
} from '../../context/AppContext';
import { buildGridFillPrompt } from '../../lib/promptBuilder';
import { buildBuildingPrompt } from '../../lib/buildingPromptBuilder';
import { buildTerrainPrompt } from '../../lib/terrainPromptBuilder';
import { buildBackgroundPrompt } from '../../lib/backgroundPromptBuilder';
import { getBuildingGridConfig, getTerrainGridConfig, getBackgroundGridConfig } from '../../lib/gridConfig';
import { GridLinkSelector } from '../shared/GridLinkSelector';
import '../../styles/run-builder.css';

// ── Per-type configuration ──────────────────────────────────────────────────

type AnyPreset = CharacterPreset | BuildingPreset | TerrainPreset | BackgroundPreset;

type SetPresetsAction = 'SET_CHARACTER_PRESETS' | 'SET_BUILDING_PRESETS' | 'SET_TERRAIN_PRESETS' | 'SET_BACKGROUND_PRESETS';
type LoadPresetAction = 'LOAD_CHARACTER_PRESET' | 'LOAD_BUILDING_PRESET' | 'LOAD_TERRAIN_PRESET' | 'LOAD_BACKGROUND_PRESET';
type SetContentAction = 'SET_CHARACTER' | 'SET_BUILDING' | 'SET_TERRAIN' | 'SET_BACKGROUND';

interface SpriteTypeConfig {
  label: string;
  presetFetchUrl: string;
  setPresetsAction: SetPresetsAction;
  loadPresetAction: LoadPresetAction;
  contentStateKey: 'character' | 'building' | 'terrain' | 'background';
  presetsStateKey: 'characterPresets' | 'buildingPresets' | 'terrainPresets' | 'backgroundPresets';
  setContentAction: SetContentAction;
  defaultContent: Record<string, unknown>;
  /** Extra content fields beyond name/description/colorNotes/styleNotes */
  extraFields: Array<{
    key: string;
    label: string;
    placeholder: string;
    rows: number;
    isInput?: boolean;
  }>;
  /** Format preset option label */
  formatPresetOption: (preset: AnyPreset) => string;
  /** Custom label for the "Custom X" default option */
  customOptionLabel: string;
  /** Field labels/placeholders that differ per type */
  nameLabel: string;
  namePlaceholder: string;
  descLabel: string;
  descPlaceholder: string;
  colorPlaceholder: string;
  stylePlaceholder: string;
}

const SPRITE_TYPE_CONFIGS: Record<SpriteType, SpriteTypeConfig> = {
  character: {
    label: 'Character',
    presetFetchUrl: '/api/presets?type=character',
    setPresetsAction: 'SET_CHARACTER_PRESETS',
    loadPresetAction: 'LOAD_CHARACTER_PRESET',
    contentStateKey: 'character',
    presetsStateKey: 'characterPresets',
    setContentAction: 'SET_CHARACTER',
    defaultContent: {
      name: '', description: '', equipment: '', colorNotes: '', styleNotes: '', rowGuidance: '',
    },
    extraFields: [
      { key: 'equipment', label: 'Equipment', placeholder: 'sword, shield, leather armor', rows: 2 },
    ],
    formatPresetOption: (p) => p.name,
    customOptionLabel: 'Custom Character',
    nameLabel: 'Character Name',
    namePlaceholder: 'e.g. Shadow Knight',
    descLabel: 'Character Description',
    descPlaceholder: 'A dark armored warrior wielding a cursed blade. Purple cape, horned helmet, glowing red eyes...',
    colorPlaceholder: 'dark steel blue armor, crimson cape, gold trim',
    stylePlaceholder: 'dark armor, glowing eyes, trailing particles',
  },
  building: {
    label: 'Building',
    presetFetchUrl: '/api/presets?type=building',
    setPresetsAction: 'SET_BUILDING_PRESETS',
    loadPresetAction: 'LOAD_BUILDING_PRESET',
    contentStateKey: 'building',
    presetsStateKey: 'buildingPresets',
    setContentAction: 'SET_BUILDING',
    defaultContent: {
      name: '', description: '', details: '', colorNotes: '', styleNotes: '', cellGuidance: '',
    },
    extraFields: [
      { key: 'details', label: 'Structural Details', placeholder: 'stone foundation, timber-framed walls, iron hinges', rows: 2 },
    ],
    formatPresetOption: (p) => `${p.name} (${(p as BuildingPreset).gridSize})`,
    customOptionLabel: 'Custom Building',
    nameLabel: 'Building Name',
    namePlaceholder: 'e.g. Medieval Inn',
    descLabel: 'Building Description',
    descPlaceholder: 'A cozy two-story medieval inn with a thatched roof and warm light spilling from windows...',
    colorPlaceholder: 'warm browns and tans for wood, grey stone, golden window glow',
    stylePlaceholder: 'atmospheric lighting, pixel-perfect details',
  },
  terrain: {
    label: 'Terrain',
    presetFetchUrl: '/api/presets?type=terrain',
    setPresetsAction: 'SET_TERRAIN_PRESETS',
    loadPresetAction: 'LOAD_TERRAIN_PRESET',
    contentStateKey: 'terrain',
    presetsStateKey: 'terrainPresets',
    setContentAction: 'SET_TERRAIN',
    defaultContent: {
      name: '', description: '', colorNotes: '', styleNotes: '', tileGuidance: '',
    },
    extraFields: [],
    formatPresetOption: (p) => `${p.name} (${(p as TerrainPreset).gridSize})`,
    customOptionLabel: 'Custom Terrain',
    nameLabel: 'Terrain Name',
    namePlaceholder: 'e.g. Grassland Plains',
    descLabel: 'Terrain Description',
    descPlaceholder: 'Lush green grassland with dirt paths, rocky outcrops, and wildflowers...',
    colorPlaceholder: 'rich greens, earthy browns, subtle yellows for dry patches',
    stylePlaceholder: 'top-down perspective, consistent shading direction',
  },
  background: {
    label: 'Background',
    presetFetchUrl: '/api/presets?type=background',
    setPresetsAction: 'SET_BACKGROUND_PRESETS',
    loadPresetAction: 'LOAD_BACKGROUND_PRESET',
    contentStateKey: 'background',
    presetsStateKey: 'backgroundPresets',
    setContentAction: 'SET_BACKGROUND',
    defaultContent: {
      name: '', description: '', colorNotes: '', styleNotes: '', layerGuidance: '',
    },
    extraFields: [],
    formatPresetOption: (p) => {
      const bp = p as BackgroundPreset;
      return `${bp.name} (${bp.bgMode} ${bp.gridSize})`;
    },
    customOptionLabel: 'Custom Background',
    nameLabel: 'Background Name',
    namePlaceholder: 'e.g. Enchanted Forest',
    descLabel: 'Background Description',
    descPlaceholder: 'A mystical forest with towering ancient trees, magical glowing particles, and dappled sunlight...',
    colorPlaceholder: 'deep greens, ethereal blues, warm golden highlights',
    stylePlaceholder: 'atmospheric depth, layered parallax effect',
  },
};

// ── Component ───────────────────────────────────────────────────────────────

export function UnifiedConfigPanel() {
  const { spriteType: currentSpriteType } = useAppState();
  const { state, dispatch, generate, validationMessage } = useGenericWorkflow(WORKFLOW_CONFIGS[currentSpriteType]);
  const spriteType = state.spriteType;
  const { imageSize } = state;

  const config = SPRITE_TYPE_CONFIGS[spriteType];
  const content = state[config.contentStateKey] as Record<string, unknown>;
  const presetList = state[config.presetsStateKey] as AnyPreset[];

  const [selectedGridLinks, setSelectedGridLinks] = useState<GridLink[]>([]);
  const [selectedPresetId, setSelectedPresetId] = useState<string>('');

  // Reset local state when sprite type changes
  useEffect(() => {
    setSelectedGridLinks([]);
    setSelectedPresetId('');
  }, [spriteType]);

  // Fetch presets on mount and when sprite type changes, skip if already cached
  useEffect(() => {
    if (presetList.length > 0) return;
    fetch(config.presetFetchUrl)
      .then((res) => res.json())
      .then((data: AnyPreset[]) => {
        dispatch({ type: config.setPresetsAction, presets: data } as Action);
      })
      .catch((err: unknown) => {
        console.error(`Failed to load ${config.label.toLowerCase()} presets:`, err);
        dispatch({
          type: 'SET_STATUS',
          message: `Failed to load ${config.label.toLowerCase()} presets`,
          statusType: 'warning',
        });
      });
  }, [dispatch, config.presetFetchUrl, config.setPresetsAction, config.label, presetList.length]);

  const handleGridSelectionChange = useCallback((selected: GridLink[]) => {
    setSelectedGridLinks(selected);
    if (selected.length > 0) {
      dispatch({ type: 'SET_ASPECT_RATIO', payload: selected[0].aspectRatio || '1:1' });
    }
  }, [dispatch]);

  const updateField = useCallback(
    (field: string, value: string) => {
      dispatch({
        type: config.setContentAction,
        [config.contentStateKey]: { ...content, [field]: value },
      } as Action);
    },
    [content, dispatch, config.setContentAction, config.contentStateKey],
  );

  const handlePresetChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const presetId = e.target.value;
      setSelectedPresetId(presetId);
      if (presetId === '') {
        // Reset to defaults, preserving grid-related fields for non-character types
        const resetContent = { ...config.defaultContent };
        if (spriteType === 'building') {
          (resetContent as any).gridSize = (content as any).gridSize;
          (resetContent as any).cellLabels = [];
        } else if (spriteType === 'terrain') {
          (resetContent as any).gridSize = (content as any).gridSize;
          (resetContent as any).cellLabels = [];
        } else if (spriteType === 'background') {
          (resetContent as any).bgMode = (content as any).bgMode;
          (resetContent as any).gridSize = (content as any).gridSize;
          (resetContent as any).cellLabels = [];
        }
        dispatch({
          type: config.setContentAction,
          [config.contentStateKey]: resetContent,
        } as Action);
        return;
      }
      const preset = presetList.find((p) => p.id === presetId);
      if (preset) {
        dispatch({ type: config.loadPresetAction, preset } as Action);
      }
    },
    [presetList, dispatch, config, content, spriteType],
  );

  const canGenerate =
    (content.name as string).trim().length > 0 &&
    (content.description as string).trim().length > 0;

  const promptPreview = useMemo(() => {
    switch (spriteType) {
      case 'building': {
        const gc = getBuildingGridConfig(
          (content as any).gridSize,
          (content as any).cellLabels,
        );
        return buildBuildingPrompt(state.building, gc);
      }
      case 'terrain': {
        const gc = getTerrainGridConfig(
          (content as any).gridSize,
          (content as any).cellLabels,
        );
        return buildTerrainPrompt(state.terrain, gc);
      }
      case 'background': {
        const gc = getBackgroundGridConfig(
          (content as any).gridSize,
          (content as any).cellLabels,
        );
        return buildBackgroundPrompt(state.background, gc);
      }
      default:
        return buildGridFillPrompt(state.character);
    }
  }, [spriteType, content, state.character, state.building, state.terrain, state.background]);

  // Group presets by genre
  const presetsByGenre = useMemo(
    () => presetList.reduce<Record<string, AnyPreset[]>>((acc, p) => {
      const genre = p.genre || 'Other';
      if (!acc[genre]) acc[genre] = [];
      acc[genre].push(p);
      return acc;
    }, {}),
    [presetList],
  );

  const idPrefix = spriteType === 'character' ? 'char' : spriteType;

  return (
    <div className="config-panel">
      {/* Mode Toggle */}
      <div className="config-field">
        <div className="segmented-control">
          {(['character', 'building', 'terrain', 'background'] as SpriteType[]).map((t) => (
            <button
              key={t}
              type="button"
              className={spriteType === t ? 'active' : ''}
              onClick={() => dispatch({ type: 'SET_SPRITE_TYPE', spriteType: t })}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <h2>{config.label} Setup</h2>

      {/* Preset Selector */}
      <div className="config-field preset-selector">
        <label htmlFor={`${idPrefix}-preset-select`}>Preset</label>
        <select id={`${idPrefix}-preset-select`} onChange={handlePresetChange} value={selectedPresetId}>
          <option value="">{config.customOptionLabel}</option>
          {Object.entries(presetsByGenre).map(([genre, items]) => (
            <optgroup key={genre} label={genre}>
              {items.map((p) => (
                <option key={p.id} value={p.id}>
                  {config.formatPresetOption(p)}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      <div className="preset-divider" />

      {/* Name */}
      <div className="config-field">
        <label htmlFor={`${idPrefix}-name`}>{config.nameLabel}</label>
        <input
          id={`${idPrefix}-name`}
          type="text"
          placeholder={config.namePlaceholder}
          value={content.name as string}
          onChange={(e) => updateField('name', e.target.value)}
        />
      </div>

      {/* Description */}
      <div className="config-field">
        <label htmlFor={`${idPrefix}-desc`}>{config.descLabel}</label>
        <textarea
          id={`${idPrefix}-desc`}
          rows={4}
          placeholder={config.descPlaceholder}
          value={content.description as string}
          onChange={(e) => updateField('description', e.target.value)}
        />
      </div>

      {/* Type-specific extra fields (equipment for character, details for building) */}
      {config.extraFields.map((field) => (
        <div key={field.key} className="config-field">
          <label htmlFor={`${idPrefix}-${field.key}`}>{field.label}</label>
          {field.isInput ? (
            <input
              id={`${idPrefix}-${field.key}`}
              type="text"
              placeholder={field.placeholder}
              value={(content[field.key] as string) || ''}
              onChange={(e) => updateField(field.key, e.target.value)}
            />
          ) : (
            <textarea
              id={`${idPrefix}-${field.key}`}
              rows={field.rows}
              placeholder={field.placeholder}
              value={(content[field.key] as string) || ''}
              onChange={(e) => updateField(field.key, e.target.value)}
            />
          )}
        </div>
      ))}

      {/* Color Notes */}
      <div className="config-field">
        <label htmlFor={`${idPrefix}-colors`}>Color Notes</label>
        <textarea
          id={`${idPrefix}-colors`}
          rows={2}
          placeholder={config.colorPlaceholder}
          value={content.colorNotes as string}
          onChange={(e) => updateField('colorNotes', e.target.value)}
        />
      </div>

      {/* Style Notes */}
      <div className="config-field">
        <label htmlFor={`${idPrefix}-style`}>Style Notes (optional)</label>
        <textarea
          id={`${idPrefix}-style`}
          rows={2}
          placeholder={config.stylePlaceholder}
          value={content.styleNotes as string}
          onChange={(e) => updateField('styleNotes', e.target.value)}
        />
      </div>

      {/* Grid Preset Selector */}
      <GridLinkSelector
        spriteType={spriteType}
        presetId={selectedPresetId}
        onSelectionChange={handleGridSelectionChange}
      />

      {/* Image Size (2K / 4K) */}
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

      {/* Aspect Ratio — now available for ALL sprite types */}
      <div className="config-field">
        <label>Aspect Ratio</label>
        <select
          className="admin-select"
          value={state.aspectRatio}
          onChange={e => dispatch({ type: 'SET_ASPECT_RATIO', payload: e.target.value })}
        >
          {['1:1','2:3','3:2','3:4','4:3','4:5','5:4','9:16','16:9','21:9'].map(r =>
            <option key={r} value={r}>{r}</option>
          )}
        </select>
      </div>

      {/* Prompt Preview */}
      <details className="prompt-preview">
        <summary>View Full Prompt</summary>
        <pre className="prompt-preview-text">{promptPreview}</pre>
      </details>

      {/* Generate Button */}
      <div className="config-actions">
        {(!canGenerate || selectedGridLinks.length === 0) && (
          <p className="validation-hint">
            {validationMessage ?? (selectedGridLinks.length === 0 ? 'Select a grid preset above' : null)}
          </p>
        )}
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
                  spriteType,
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
