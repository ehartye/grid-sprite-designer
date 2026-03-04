/**
 * Character Presets admin tab.
 * CRUD for character presets with linked grid preset management.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { LinkedGridPresets } from './LinkedGridPresets';

interface CharacterPreset {
  id: number;
  name: string;
  genre: string;
  description: string;
  equipment: string;
  colorNotes: string;
  rowGuidance: string;
  gridLinkCount: number;
}

interface EditingPreset {
  id?: number;
  name: string;
  genre: string;
  description: string;
  equipment: string;
  colorNotes: string;
  rowGuidance: string;
}

function emptyPreset(): EditingPreset {
  return { name: '', genre: '', description: '', equipment: '', colorNotes: '', rowGuidance: '' };
}

export function CharacterPresetsTab() {
  const [presets, setPresets] = useState<CharacterPreset[]>([]);
  const [editing, setEditing] = useState<EditingPreset | null>(null);
  const [saving, setSaving] = useState(false);

  const fetchPresets = useCallback(async () => {
    const res = await fetch('/api/presets?type=character');
    if (res.ok) setPresets(await res.json());
  }, []);

  useEffect(() => { fetchPresets(); }, [fetchPresets]);

  const handleNew = () => setEditing(emptyPreset());

  const handleEdit = (p: CharacterPreset) => {
    setEditing({
      id: p.id,
      name: p.name,
      genre: p.genre,
      description: p.description,
      equipment: p.equipment,
      colorNotes: p.colorNotes,
      rowGuidance: p.rowGuidance,
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
        equipment: editing.equipment,
        colorNotes: editing.colorNotes,
        rowGuidance: editing.rowGuidance,
      };
      if (editing.id) {
        await fetch(`/api/presets/character/${editing.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      } else {
        const res = await fetch('/api/presets/character', {
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
    if (!confirm('Delete this character preset?')) return;
    await fetch(`/api/presets/character/${id}`, { method: 'DELETE' });
    if (editing?.id === id) setEditing(null);
    await fetchPresets();
  };

  return (
    <div>
      <div className="admin-toolbar">
        <div />
        <button className="btn btn-sm" onClick={handleNew}>New Character Preset</button>
      </div>

      <div className="admin-split">
        <div className="admin-list">
          {presets.length === 0 && <div className="admin-empty">No character presets</div>}
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
            <h3>{editing.id ? 'Edit Character Preset' : 'New Character Preset'}</h3>

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
              <textarea className="admin-textarea" rows={3} value={editing.description} onChange={e => setEditing({ ...editing, description: e.target.value })} placeholder="Character description..." />
            </label>

            <label className="admin-label">
              Equipment
              <textarea className="admin-textarea" rows={2} value={editing.equipment} onChange={e => setEditing({ ...editing, equipment: e.target.value })} placeholder="Equipment and accessories..." />
            </label>

            <label className="admin-label">
              Color Notes
              <textarea className="admin-textarea" rows={2} value={editing.colorNotes} onChange={e => setEditing({ ...editing, colorNotes: e.target.value })} placeholder="Color palette guidance..." />
            </label>

            <label className="admin-label">
              Row Guidance
              <textarea className="admin-textarea" rows={4} value={editing.rowGuidance} onChange={e => setEditing({ ...editing, rowGuidance: e.target.value })} placeholder="Per-row pose descriptions..." />
            </label>

            {editing.id && (
              <LinkedGridPresets
                spriteType="character"
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
