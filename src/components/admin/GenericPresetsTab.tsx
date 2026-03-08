/**
 * Generic content presets admin tab.
 * Config-driven CRUD for all sprite type presets (character, building, terrain, background).
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useAppDispatch } from '../../context/AppContext';
import { LinkedGridPresets } from './LinkedGridPresets';
import type { SpriteType } from '../../context/AppContext';

// ── Field schema ────────────────────────────────────────────────────────────

interface FieldSchema {
  key: string;
  label: string;
  type: 'input' | 'textarea' | 'select';
  placeholder?: string;
  rows?: number;
  options?: { value: string; label: string }[];
}

interface PresetTabConfig {
  spriteType: SpriteType;
  label: string;
  fields: FieldSchema[];
  emptyDefaults: Record<string, unknown>;
  /** Extra fields shown in the list item meta (beyond genre + gridLinkCount) */
  metaFields?: string[];
}

// ── Per-type configs ────────────────────────────────────────────────────────

const PRESET_TAB_CONFIGS: Record<SpriteType, PresetTabConfig> = {
  character: {
    spriteType: 'character',
    label: 'Character',
    emptyDefaults: { name: '', genre: '', description: '', equipment: '', colorNotes: '', rowGuidance: '' },
    fields: [
      { key: 'description', label: 'Description', type: 'textarea', rows: 3, placeholder: 'Character description...' },
      { key: 'equipment', label: 'Equipment', type: 'textarea', rows: 2, placeholder: 'Equipment and accessories...' },
      { key: 'colorNotes', label: 'Color Notes', type: 'textarea', rows: 2, placeholder: 'Color palette guidance...' },
      { key: 'rowGuidance', label: 'Row Guidance', type: 'textarea', rows: 4, placeholder: 'Per-row pose descriptions...' },
    ],
  },
  building: {
    spriteType: 'building',
    label: 'Building',
    emptyDefaults: { name: '', genre: '', description: '', details: '', colorNotes: '', cellGuidance: '', gridSize: '3x3', cellLabels: [] },
    fields: [
      { key: 'description', label: 'Description', type: 'textarea', rows: 3, placeholder: 'Building description...' },
      { key: 'details', label: 'Details', type: 'textarea', rows: 2, placeholder: 'Architectural details...' },
      { key: 'colorNotes', label: 'Color Notes', type: 'textarea', rows: 2, placeholder: 'Color palette guidance...' },
      { key: 'cellGuidance', label: 'Cell Guidance', type: 'textarea', rows: 4, placeholder: 'Per-cell descriptions...' },
    ],
  },
  terrain: {
    spriteType: 'terrain',
    label: 'Terrain',
    emptyDefaults: { name: '', genre: '', description: '', colorNotes: '', tileGuidance: '', gridSize: '4x4', tileLabels: [] },
    fields: [
      { key: 'description', label: 'Description', type: 'textarea', rows: 3, placeholder: 'Terrain description...' },
      { key: 'colorNotes', label: 'Color Notes', type: 'textarea', rows: 2, placeholder: 'Color palette guidance...' },
      { key: 'tileGuidance', label: 'Tile Guidance', type: 'textarea', rows: 4, placeholder: 'Per-tile descriptions...' },
    ],
  },
  background: {
    spriteType: 'background',
    label: 'Background',
    emptyDefaults: { name: '', genre: '', description: '', colorNotes: '', layerGuidance: '', gridSize: '1x4', bgMode: 'parallax', layerLabels: [] },
    metaFields: ['bgMode'],
    fields: [
      { key: 'bgMode', label: 'Background Mode', type: 'select', options: [
        { value: 'parallax', label: 'Parallax' },
        { value: 'scene', label: 'Scene' },
      ]},
      { key: 'description', label: 'Description', type: 'textarea', rows: 3, placeholder: 'Background description...' },
      { key: 'colorNotes', label: 'Color Notes', type: 'textarea', rows: 2, placeholder: 'Color palette guidance...' },
      { key: 'layerGuidance', label: 'Layer Guidance', type: 'textarea', rows: 4, placeholder: 'Per-layer descriptions...' },
    ],
  },
};

// ── Component ───────────────────────────────────────────────────────────────

interface GenericPresetsTabProps {
  spriteType: SpriteType;
}

export function GenericPresetsTab({ spriteType }: GenericPresetsTabProps) {
  const config = PRESET_TAB_CONFIGS[spriteType];
  const dispatch = useAppDispatch();

  const [presets, setPresets] = useState<Record<string, unknown>[]>([]);
  const [editing, setEditing] = useState<Record<string, unknown> | null>(null);
  const [saving, setSaving] = useState(false);

  const fetchPresets = useCallback(async () => {
    const res = await fetch(`/api/presets?type=${spriteType}`);
    if (res.ok) setPresets(await res.json());
  }, [spriteType]);

  useEffect(() => { fetchPresets(); }, [fetchPresets]);

  // Reset editing state when sprite type changes
  useEffect(() => { setEditing(null); }, [spriteType]);

  const handleNew = () => setEditing({ ...config.emptyDefaults });

  const handleEdit = (p: Record<string, unknown>) => {
    const copy: Record<string, unknown> = {};
    for (const key of Object.keys(config.emptyDefaults)) {
      const val = p[key];
      copy[key] = Array.isArray(val) ? [...val] : val;
    }
    copy.id = p.id;
    setEditing(copy);
  };

  const handleSave = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      const body: Record<string, unknown> = {};
      for (const key of Object.keys(config.emptyDefaults)) {
        body[key] = editing[key];
      }
      if (editing.id) {
        await fetch(`/api/presets/${spriteType}/${editing.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      } else {
        const res = await fetch(`/api/presets/${spriteType}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        setEditing({ ...editing, id: data.id });
      }
      await fetchPresets();
    } catch (err) {
      dispatch({
        type: 'SET_STATUS',
        message: `Failed to save ${config.label.toLowerCase()} preset: ${err instanceof Error ? err.message : String(err)}`,
        statusType: 'error',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm(`Delete this ${config.label.toLowerCase()} preset?`)) return;
    try {
      await fetch(`/api/presets/${spriteType}/${id}`, { method: 'DELETE' });
      if (editing?.id === id) setEditing(null);
      await fetchPresets();
    } catch (err) {
      dispatch({
        type: 'SET_STATUS',
        message: `Failed to delete ${config.label.toLowerCase()} preset: ${err instanceof Error ? err.message : String(err)}`,
        statusType: 'error',
      });
    }
  };

  const updateField = (key: string, value: unknown) => {
    if (!editing) return;
    setEditing({ ...editing, [key]: value });
  };

  // Build meta text for list items
  const metaText = (p: Record<string, unknown>) => {
    const parts: string[] = [
      (p.genre as string) || 'no genre',
    ];
    if (config.metaFields) {
      for (const f of config.metaFields) {
        if (p[f]) parts.push(String(p[f]));
      }
    }
    const count = (p.gridLinkCount as number) ?? 0;
    parts.push(`${count} grid${count !== 1 ? 's' : ''}`);
    return parts.join(' | ');
  };

  return (
    <div>
      <div className="admin-toolbar">
        <div />
        <button className="btn btn-sm" onClick={handleNew}>New {config.label} Preset</button>
      </div>

      <div className="admin-split">
        <div className="admin-list">
          {presets.length === 0 && <div className="admin-empty">No {config.label.toLowerCase()} presets</div>}
          {presets.map(p => (
            <div
              key={p.id as number}
              className={`admin-list-item ${editing?.id === p.id ? 'active' : ''}`}
              onClick={() => handleEdit(p)}
            >
              <div className="admin-list-item-name">{p.name as string}</div>
              <div className="admin-list-item-meta">{metaText(p)}</div>
            </div>
          ))}
        </div>

        {editing && (
          <div className="admin-form">
            <h3>{editing.id ? `Edit ${config.label} Preset` : `New ${config.label} Preset`}</h3>

            <label className="admin-label">
              Name
              <input className="admin-input" value={(editing.name as string) || ''} onChange={e => updateField('name', e.target.value)} />
            </label>

            <div className="admin-row">
              <label className="admin-label">
                Genre
                <input className="admin-input" value={(editing.genre as string) || ''} onChange={e => updateField('genre', e.target.value)} placeholder="e.g. RPG, Sci-Fi" />
              </label>
              {/* Render select fields inline with genre */}
              {config.fields.filter(f => f.type === 'select').map(field => (
                <label key={field.key} className="admin-label">
                  {field.label}
                  <select className="admin-select" value={(editing[field.key] as string) || ''} onChange={e => updateField(field.key, e.target.value)}>
                    {field.options!.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </label>
              ))}
            </div>

            {config.fields.filter(f => f.type !== 'select').map(field => (
              <label key={field.key} className="admin-label">
                {field.label}
                {field.type === 'input' ? (
                  <input
                    className="admin-input"
                    value={(editing[field.key] as string) || ''}
                    onChange={e => updateField(field.key, e.target.value)}
                    placeholder={field.placeholder}
                  />
                ) : (
                  <textarea
                    className="admin-textarea"
                    rows={field.rows ?? 3}
                    value={(editing[field.key] as string) || ''}
                    onChange={e => updateField(field.key, e.target.value)}
                    placeholder={field.placeholder}
                  />
                )}
              </label>
            ))}

            {editing.id != null && (
              <LinkedGridPresets
                spriteType={spriteType}
                presetId={editing.id as number}
                onLinksChange={fetchPresets}
              />
            )}

            <div className="admin-form-actions">
              <button className="btn" onClick={handleSave} disabled={saving || !((editing.name as string) || '').trim()}>
                {saving ? 'Saving...' : editing.id ? 'Update' : 'Create'}
              </button>
              <button className="btn btn-sm" onClick={() => setEditing(null)}>Cancel</button>
              {editing.id != null && (
                <button className="btn btn-sm btn-danger" onClick={() => handleDelete(editing.id as number)}>Delete</button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
