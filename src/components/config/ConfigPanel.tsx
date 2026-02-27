/**
 * Character configuration panel.
 * Collects character details, model, image size, and chroma tolerance
 * before generating the 36-sprite grid.
 */

import React, { useCallback } from 'react';
import { useGridWorkflow } from '../../hooks/useGridWorkflow';

const MODEL_OPTIONS = [
  { value: 'gemini-2.5-flash-image', label: 'Gemini 2.5 Flash Image' },
  { value: 'gemini-2.5-flash-preview-05-20', label: 'Gemini 2.5 Flash Preview' },
];

export function ConfigPanel() {
  const { state, dispatch, generate } = useGridWorkflow();
  const { character, model, imageSize, chromaTolerance } = state;

  const updateCharacter = useCallback(
    (field: 'name' | 'description' | 'styleNotes', value: string) => {
      dispatch({
        type: 'SET_CHARACTER',
        character: { ...character, [field]: value },
      });
    },
    [character, dispatch],
  );

  const canGenerate = character.name.trim().length > 0 && character.description.trim().length > 0;

  return (
    <div className="config-panel">
      <h2>Character Setup</h2>

      {/* Character Name */}
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

      {/* Character Description */}
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

      {/* Style Notes */}
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

      {/* Model Selector */}
      <div className="config-field">
        <label htmlFor="model-select">AI Model</label>
        <select
          id="model-select"
          value={model}
          onChange={(e) => dispatch({ type: 'SET_MODEL', model: e.target.value })}
        >
          {MODEL_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Image Size */}
      <div className="config-field">
        <label>Image Size</label>
        <div className="segmented-control">
          <button
            className={imageSize === '1K' ? 'active' : ''}
            onClick={() => dispatch({ type: 'SET_IMAGE_SIZE', imageSize: '1K' })}
          >
            1K (1015px)
          </button>
          <button
            className={imageSize === '2K' ? 'active' : ''}
            onClick={() => dispatch({ type: 'SET_IMAGE_SIZE', imageSize: '2K' })}
          >
            2K (2814px)
          </button>
        </div>
      </div>

      {/* Chroma Tolerance */}
      <div className="config-field">
        <label>Chroma Tolerance</label>
        <div className="slider-row">
          <input
            type="range"
            min={0}
            max={150}
            value={chromaTolerance}
            onChange={(e) =>
              dispatch({ type: 'SET_CHROMA_TOLERANCE', tolerance: Number(e.target.value) })
            }
          />
          <span className="slider-value">{chromaTolerance}</span>
        </div>
      </div>

      {/* Generate Button */}
      <div className="config-actions">
        <button
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
