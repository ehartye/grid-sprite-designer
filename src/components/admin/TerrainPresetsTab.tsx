/**
 * Terrain Presets admin tab.
 * CRUD for terrain presets with linked grid preset management.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { LinkedGridPresets } from './LinkedGridPresets';

interface TerrainPreset {
  id: number;
  name: string;
  genre: string;
  description: string;
  colorNotes: string;
  tileGuidance: string;
  gridSize: string;
  tileLabels: string[];
  gridLinkCount: number;
}

interface EditingPreset {
  id?: number;
  name: string;
  genre: string;
  description: string;
  colorNotes: string;
  tileGuidance: string;
  gridSize: string;
  tileLabels: string[];
}

function emptyPreset(): EditingPreset {
  return { name: '', genre: '', description: '', colorNotes: '', tileGuidance: '', gridSize: '4x4', tileLabels: [] };
}

export function TerrainPresetsTab() {
  const [presets, setPresets] = useState<TerrainPreset[]>([]);
  const [editing, setEditing] = useState<EditingPreset | null>(null);
  const [saving, setSaving] = useState(false);

  const fetchPresets = useCallback(async () => {
    const res = await fetch('/api/presets?type=terrain');
    if (res.ok) setPresets(await res.json());
  }, []);

  useEffect(() => { fetchPresets(); }, [fetchPresets]);

  const handleNew = () => setEditing(emptyPreset());

  const handleEdit = (p: TerrainPreset) => {
    setEditing({
      id: p.id,
      name: p.name,
      genre: p.genre,
      description: p.description,
      colorNotes: p.colorNotes,
      tileGuidance: p.tileGuidance,
      gridSize: p.gridSize,
      tileLabels: [...p.tileLabels],
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
        tileGuidance: editing.tileGuidance,
        gridSize: editing.gridSize,
        tileLabels: editing.tileLabels,
      };
      if (editing.id) {
        await fetch(`/api/presets/terrain/${editing.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      } else {
        const res = await fetch('/api/presets/terrain', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        setEditing({ ...editing, id: data.id });
      }
      await fetchPresets();
    } catch (err) {
      window.alert(`Failed to save preset: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this terrain preset?')) return;
    await fetch(`/api/presets/terrain/${id}`, { method: 'DELETE' });
    if (editing?.id === id) setEditing(null);
    await fetchPresets();
  };

  return (
    <div>
      <div className="admin-toolbar">
        <div />
        <button className="btn btn-sm" onClick={handleNew}>New Terrain Preset</button>
      </div>

      <div className="admin-split">
        <div className="admin-list">
          {presets.length === 0 && <div className="admin-empty">No terrain presets</div>}
          {presets.map(p => (
            <div
              key={p.id}
              className={`admin-list-item ${editing?.id === p.id ? 'active' : ''}`}
              onClick={() => handleEdit(p)}
            >
              <div className="admin-list-item-name">{p.name}</div>
              <div className="admin-list-item-meta">
                {p.genre || 'no genre'} | {p.gridLinkCount} grid{p.gridLinkCount !== 1 ? 's' : ''}
              </div>
            </div>
          ))}
        </div>

        {editing && (
          <div className="admin-form">
            <h3>{editing.id ? 'Edit Terrain Preset' : 'New Terrain Preset'}</h3>

            <label className="admin-label">
              Name
              <input className="admin-input" value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} />
            </label>

            <div className="admin-row">
              <label className="admin-label">
                Genre
                <input className="admin-input" value={editing.genre} onChange={e => setEditing({ ...editing, genre: e.target.value })} placeholder="e.g. RPG, Sci-Fi" />
              </label>
            </div>

            <label className="admin-label">
              Description
              <textarea className="admin-textarea" rows={3} value={editing.description} onChange={e => setEditing({ ...editing, description: e.target.value })} placeholder="Terrain description..." />
            </label>

            <label className="admin-label">
              Color Notes
              <textarea className="admin-textarea" rows={2} value={editing.colorNotes} onChange={e => setEditing({ ...editing, colorNotes: e.target.value })} placeholder="Color palette guidance..." />
            </label>

            <label className="admin-label">
              Tile Guidance
              <textarea className="admin-textarea" rows={4} value={editing.tileGuidance} onChange={e => setEditing({ ...editing, tileGuidance: e.target.value })} placeholder="Per-tile descriptions..." />
            </label>

            {editing.id && (
              <LinkedGridPresets
                spriteType="terrain"
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
