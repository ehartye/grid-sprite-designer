/**
 * Character configuration panel.
 * Collects character details via preset or manual entry, image size,
 * and chroma tolerance before generating the 36-sprite grid.
 *
 * Model is hardcoded to nano-banana-pro-preview (no selector).
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useGridWorkflow } from '../../hooks/useGridWorkflow';
import { CharacterPreset, SpriteType, GridLink } from '../../context/AppContext';
import { buildGridFillPrompt } from '../../lib/promptBuilder';

// ── Character field union ────────────────────────────────────────────────────

type CharacterField = 'name' | 'description' | 'equipment' | 'colorNotes' | 'styleNotes';

// ── Component ────────────────────────────────────────────────────────────────

export function ConfigPanel() {
  const { state, dispatch, generate } = useGridWorkflow();
  const { character, imageSize, presets } = state;
  const [gridLinks, setGridLinks] = useState<GridLink[]>([]);
  const [selectedPresetId, setSelectedPresetId] = useState<string>('');

  // Fetch presets on mount
  useEffect(() => {
    fetch('/api/presets')
      .then((res) => res.json())
      .then((data: CharacterPreset[]) => {
        dispatch({ type: 'SET_PRESETS', presets: data });
      })
      .catch(() => {});
  }, [dispatch]);

  // Fetch grid links when preset changes
  useEffect(() => {
    if (!selectedPresetId) { setGridLinks([]); return; }
    fetch(`/api/presets/character/${selectedPresetId}/grid-links`)
      .then(res => res.json())
      .then(setGridLinks)
      .catch(() => setGridLinks([]));
  }, [selectedPresetId]);

  const updateCharacter = useCallback(
    (field: CharacterField, value: string) => {
      dispatch({
        type: 'SET_CHARACTER',
        character: { ...character, [field]: value },
      });
    },
    [character, dispatch],
  );

  const handlePresetChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const presetId = e.target.value;
      setSelectedPresetId(presetId);
      if (presetId === '') {
        dispatch({
          type: 'SET_CHARACTER',
          character: {
            name: '',
            description: '',
            equipment: '',
            colorNotes: '',
            styleNotes: '',
            rowGuidance: '',
          },
        });
        return;
      }
      const preset = presets.find((p) => p.id === presetId);
      if (preset) {
        dispatch({ type: 'LOAD_PRESET', preset });
      }
    },
    [presets, dispatch],
  );

  const canGenerate = character.name.trim().length > 0 && character.description.trim().length > 0;

  const promptPreview = useMemo(
    () => buildGridFillPrompt(character),
    [character],
  );

  // Group presets by genre for the optgroup display
  const presetsByGenre = useMemo(
    () => presets.reduce<Record<string, CharacterPreset[]>>((acc, p) => {
      const genre = p.genre || 'Other';
      if (!acc[genre]) acc[genre] = [];
      acc[genre].push(p);
      return acc;
    }, {}),
    [presets],
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

      <h2>Character Setup</h2>

      {/* 1. Preset Selector */}
      <div className="config-field preset-selector">
        <label htmlFor="preset-select">Preset</label>
        <select id="preset-select" onChange={handlePresetChange} defaultValue="">
          <option value="">Custom Character</option>
          {Object.entries(presetsByGenre).map(([genre, items]) => (
            <optgroup key={genre} label={genre}>
              {items.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      <div className="preset-divider" />

      {/* 2. Character Name */}
      <div className="config-field">
        <label htmlFor="char-name">Character Name</label>
        <input
          id="char-name"
          type="text"
          placeholder="e.g. Shadow Knight"
          value={character.name}
          onChange={(e) => updateCharacter('name', e.target.value)}
        />
      </div>

      {/* 3. Character Description */}
      <div className="config-field">
        <label htmlFor="char-desc">Character Description</label>
        <textarea
          id="char-desc"
          rows={4}
          placeholder="A dark armored warrior wielding a cursed blade. Purple cape, horned helmet, glowing red eyes..."
          value={character.description}
          onChange={(e) => updateCharacter('description', e.target.value)}
        />
      </div>

      {/* 4. Equipment */}
      <div className="config-field">
        <label htmlFor="char-equip">Equipment</label>
        <textarea
          id="char-equip"
          rows={2}
          placeholder="sword, shield, leather armor"
          value={character.equipment}
          onChange={(e) => updateCharacter('equipment', e.target.value)}
        />
      </div>

      {/* 5. Color Notes */}
      <div className="config-field">
        <label htmlFor="char-colors">Color Notes</label>
        <textarea
          id="char-colors"
          rows={2}
          placeholder="dark steel blue armor, crimson cape, gold trim"
          value={character.colorNotes}
          onChange={(e) => updateCharacter('colorNotes', e.target.value)}
        />
      </div>

      {/* 6. Style Notes */}
      <div className="config-field">
        <label htmlFor="char-style">Style Notes (optional)</label>
        <textarea
          id="char-style"
          rows={2}
          placeholder="dark armor, glowing eyes, trailing particles"
          value={character.styleNotes}
          onChange={(e) => updateCharacter('styleNotes', e.target.value)}
        />
      </div>

      {/* 7. Linked Grid Presets (read-only badges) */}
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

      {/* 8. Image Size (2K / 4K) */}
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

      {/* 9. Prompt Preview */}
      <details className="prompt-preview">
        <summary>View Full Prompt</summary>
        <pre className="prompt-preview-text">{promptPreview}</pre>
      </details>

      {/* 10. Generate Button */}
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
