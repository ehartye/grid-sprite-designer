/**
 * Background Presets admin tab.
 * CRUD for background presets with linked grid preset management.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { LinkedGridPresets } from './LinkedGridPresets';

interface BackgroundPreset {
  id: number;
  name: string;
  genre: string;
  description: string;
  colorNotes: string;
  layerGuidance: string;
  gridSize: string;
  bgMode: string;
  layerLabels: string[];
  gridLinkCount: number;
}

interface EditingPreset {
  id?: number;
  name: string;
  genre: string;
  description: string;
  colorNotes: string;
  layerGuidance: string;
  gridSize: string;
  bgMode: string;
  layerLabels: string[];
}

function emptyPreset(): EditingPreset {
  return { name: '', genre: '', description: '', colorNotes: '', layerGuidance: '', gridSize: '1x4', bgMode: 'parallax', layerLabels: [] };
}

export function BackgroundPresetsTab() {
  const [presets, setPresets] = useState<BackgroundPreset[]>([]);
  const [editing, setEditing] = useState<EditingPreset | null>(null);
  const [saving, setSaving] = useState(false);

  const fetchPresets = useCallback(async () => {
    const res = await fetch('/api/presets?type=background');
    if (res.ok) setPresets(await res.json());
  }, []);

  useEffect(() => { fetchPresets(); }, [fetchPresets]);

  const handleNew = () => setEditing(emptyPreset());

  const handleEdit = (p: BackgroundPreset) => {
    setEditing({
      id: p.id,
      name: p.name,
      genre: p.genre,
      description: p.description,
      colorNotes: p.colorNotes,
      layerGuidance: p.layerGuidance,
      gridSize: p.gridSize,
      bgMode: p.bgMode,
      layerLabels: [...p.layerLabels],
    });
  };

  const handleSave = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      const body = {
        name: editing.name,
        genre: editing.genre,
        description: editing.description,
        colorNotes: editing.colorNotes,
        layerGuidance: editing.layerGuidance,
        gridSize: editing.gridSize,
        bgMode: editing.bgMode,
        layerLabels: editing.layerLabels,
      };
      if (editing.id) {
        await fetch(`/api/presets/background/${editing.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      } else {
        const res = await fetch('/api/presets/background', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        setEditing({ ...editing, id: data.id });
      }
      await fetchPresets();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this background preset?')) return;
    await fetch(`/api/presets/background/${id}`, { method: 'DELETE' });
    if (editing?.id === id) setEditing(null);
    await fetchPresets();
  };

  return (
    <div>
      <div className="admin-toolbar">
        <div />
        <button className="btn btn-sm" onClick={handleNew}>New Background Preset</button>
      </div>

      <div className="admin-split">
        <div className="admin-list">
          {presets.length === 0 && <div className="admin-empty">No background presets</div>}
          {presets.map(p => (
            <div
              key={p.id}
              className={`admin-list-item ${editing?.id === p.id ? 'active' : ''}`}
              onClick={() => handleEdit(p)}
            >
              <div className="admin-list-item-name">{p.name}</div>
              <div className="admin-list-item-meta">
                {p.genre || 'no genre'} | {p.bgMode} | {p.gridLinkCount} grid{p.gridLinkCount !== 1 ? 's' : ''}
              </div>
            </div>
          ))}
        </div>

        {editing && (
          <div className="admin-form">
            <h3>{editing.id ? 'Edit Background Preset' : 'New Background Preset'}</h3>

            <label className="admin-label">
              Name
              <input className="admin-input" value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} />
            </label>

            <div className="admin-row">
              <label className="admin-label">
                Genre
                <input className="admin-input" value={editing.genre} onChange={e => setEditing({ ...editing, genre: e.target.value })} placeholder="e.g. RPG, Sci-Fi" />
              </label>
              <label className="admin-label">
                Background Mode
                <select className="admin-select" value={editing.bgMode} onChange={e => setEditing({ ...editing, bgMode: e.target.value })}>
                  <option value="parallax">Parallax</option>
                  <option value="scene">Scene</option>
                </select>
              </label>
            </div>

            <label className="admin-label">
              Description
              <textarea className="admin-textarea" rows={3} value={editing.description} onChange={e => setEditing({ ...editing, description: e.target.value })} placeholder="Background description..." />
            </label>

            <label className="admin-label">
              Color Notes
              <textarea className="admin-textarea" rows={2} value={editing.colorNotes} onChange={e => setEditing({ ...editing, colorNotes: e.target.value })} placeholder="Color palette guidance..." />
            </label>

            <label className="admin-label">
              Layer Guidance
              <textarea className="admin-textarea" rows={4} value={editing.layerGuidance} onChange={e => setEditing({ ...editing, layerGuidance: e.target.value })} placeholder="Per-layer descriptions..." />
            </label>

            {editing.id && (
              <LinkedGridPresets
                spriteType="background"
                presetId={editing.id}
                onLinksChange={fetchPresets}
              />
            )}

            <div className="admin-form-actions">
              <button className="btn" onClick={handleSave} disabled={saving || !editing.name.trim()}>
                {saving ? 'Saving...' : editing.id ? 'Update' : 'Create'}
              </button>
              <button className="btn btn-sm" onClick={() => setEditing(null)}>Cancel</button>
              {editing.id && (
                <button className="btn btn-sm btn-danger" onClick={() => handleDelete(editing.id!)}>Delete</button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
