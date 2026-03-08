/**
 * Building Presets admin tab.
 * CRUD for building presets with linked grid preset management.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { LinkedGridPresets } from './LinkedGridPresets';

interface BuildingPreset {
  id: number;
  name: string;
  genre: string;
  description: string;
  details: string;
  colorNotes: string;
  cellGuidance: string;
  gridSize: string;
  cellLabels: string[];
  gridLinkCount: number;
}

interface EditingPreset {
  id?: number;
  name: string;
  genre: string;
  description: string;
  details: string;
  colorNotes: string;
  cellGuidance: string;
  gridSize: string;
  cellLabels: string[];
}

function emptyPreset(): EditingPreset {
  return { name: '', genre: '', description: '', details: '', colorNotes: '', cellGuidance: '', gridSize: '3x3', cellLabels: [] };
}

export function BuildingPresetsTab() {
  const [presets, setPresets] = useState<BuildingPreset[]>([]);
  const [editing, setEditing] = useState<EditingPreset | null>(null);
  const [saving, setSaving] = useState(false);

  const fetchPresets = useCallback(async () => {
    const res = await fetch('/api/presets?type=building');
    if (res.ok) setPresets(await res.json());
  }, []);

  useEffect(() => { fetchPresets(); }, [fetchPresets]);

  const handleNew = () => setEditing(emptyPreset());

  const handleEdit = (p: BuildingPreset) => {
    setEditing({
      id: p.id,
      name: p.name,
      genre: p.genre,
      description: p.description,
      details: p.details,
      colorNotes: p.colorNotes,
      cellGuidance: p.cellGuidance,
      gridSize: p.gridSize,
      cellLabels: [...p.cellLabels],
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
        details: editing.details,
        colorNotes: editing.colorNotes,
        cellGuidance: editing.cellGuidance,
        gridSize: editing.gridSize,
        cellLabels: editing.cellLabels,
      };
      if (editing.id) {
        await fetch(`/api/presets/building/${editing.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      } else {
        const res = await fetch('/api/presets/building', {
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
    if (!confirm('Delete this building preset?')) return;
    await fetch(`/api/presets/building/${id}`, { method: 'DELETE' });
    if (editing?.id === id) setEditing(null);
    await fetchPresets();
  };

  return (
    <div>
      <div className="admin-toolbar">
        <div />
        <button className="btn btn-sm" onClick={handleNew}>New Building Preset</button>
      </div>

      <div className="admin-split">
        <div className="admin-list">
          {presets.length === 0 && <div className="admin-empty">No building presets</div>}
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
            <h3>{editing.id ? 'Edit Building Preset' : 'New Building Preset'}</h3>

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
              <textarea className="admin-textarea" rows={3} value={editing.description} onChange={e => setEditing({ ...editing, description: e.target.value })} placeholder="Building description..." />
            </label>

            <label className="admin-label">
              Details
              <textarea className="admin-textarea" rows={2} value={editing.details} onChange={e => setEditing({ ...editing, details: e.target.value })} placeholder="Architectural details..." />
            </label>

            <label className="admin-label">
              Color Notes
              <textarea className="admin-textarea" rows={2} value={editing.colorNotes} onChange={e => setEditing({ ...editing, colorNotes: e.target.value })} placeholder="Color palette guidance..." />
            </label>

            <label className="admin-label">
              Cell Guidance
              <textarea className="admin-textarea" rows={4} value={editing.cellGuidance} onChange={e => setEditing({ ...editing, cellGuidance: e.target.value })} placeholder="Per-cell descriptions..." />
            </label>

            {editing.id && (
              <LinkedGridPresets
                spriteType="building"
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
