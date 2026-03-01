/**
 * Character configuration panel.
 * Collects character details via preset or manual entry, image size,
 * and chroma tolerance before generating the 36-sprite grid.
 *
 * Model is hardcoded to nano-banana-pro-preview (no selector).
 */

import React, { useCallback, useEffect, useMemo } from 'react';
import { useGridWorkflow } from '../../hooks/useGridWorkflow';
import { CharacterPreset } from '../../context/AppContext';
import { buildGridFillPrompt } from '../../lib/promptBuilder';

// ── Character field union ────────────────────────────────────────────────────

type CharacterField = 'name' | 'description' | 'equipment' | 'colorNotes' | 'styleNotes' | 'rowGuidance';

// ── Component ────────────────────────────────────────────────────────────────

export function ConfigPanel() {
  const { state, dispatch, generate } = useGridWorkflow();
  const { character, imageSize, presets } = state;

  // Fetch presets on mount
  useEffect(() => {
    fetch('/api/presets')
      .then((res) => res.json())
      .then((data: CharacterPreset[]) => {
        dispatch({ type: 'SET_PRESETS', presets: data });
      })
      .catch(() => {
        // Presets are non-critical; silently ignore fetch errors
      });
  }, [dispatch]);

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
      if (presetId === '') {
        // "Custom Character" — clear fields
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

      {/* 7. Row Guidance */}
      <div className="config-field row-guidance">
        <label htmlFor="char-rows">Row Guidance</label>
        <textarea
          id="char-rows"
          rows={6}
          placeholder="Per-row pose descriptions (loaded from preset or enter custom)..."
          value={character.rowGuidance}
          onChange={(e) => updateCharacter('rowGuidance', e.target.value)}
        />
      </div>

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
          onClick={generate}
        >
          Generate All 36 Sprites
        </button>
      </div>
    </div>
  );
}
