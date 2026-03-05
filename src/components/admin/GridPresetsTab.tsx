/**
 * Grid Presets admin tab.
 * CRUD for grid presets with sprite type sub-filter,
 * cell labels editor, cell groups editor, and generic guidance textarea.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import type { GridPreset, CellGroup, SpriteType } from '../../context/AppContext';
import { CellRangeSelector } from './CellRangeSelector';

const SPRITE_TYPES: SpriteType[] = ['character', 'building', 'terrain', 'background'];

interface EditingPreset {
  id?: number;
  name: string;
  spriteType: SpriteType;
  genre: string;
  gridSize: string;
  cols: number;
  rows: number;
  cellLabels: string[];
  cellGroups: CellGroup[];
  genericGuidance: string;
  bgMode: 'parallax' | 'scene' | null;
  aspectRatio: string;
  tileShape: 'square' | 'diamond';
}

function emptyPreset(): EditingPreset {
  return {
    name: '',
    spriteType: 'character',
    genre: '',
    gridSize: '6x6',
    cols: 6,
    rows: 6,
    cellLabels: Array(36).fill(''),
    cellGroups: [],
    genericGuidance: '',
    bgMode: null,
    aspectRatio: '1:1',
    tileShape: 'square',
  };
}

export function GridPresetsTab() {
  const [presets, setPresets] = useState<GridPreset[]>([]);
  const [filterType, setFilterType] = useState<SpriteType | 'all'>('all');
  const [editing, setEditing] = useState<EditingPreset | null>(null);
  const [saving, setSaving] = useState(false);

  const fetchPresets = useCallback(async () => {
    const url = filterType === 'all'
      ? '/api/grid-presets'
      : `/api/grid-presets?sprite_type=${filterType}`;
    const res = await fetch(url);
    if (res.ok) setPresets(await res.json());
  }, [filterType]);

  useEffect(() => { fetchPresets(); }, [fetchPresets]);

  const handleNew = () => setEditing(emptyPreset());

  const handleEdit = (preset: GridPreset) => {
    setEditing({
      id: preset.id,
      name: preset.name,
      spriteType: preset.spriteType,
      genre: preset.genre,
      gridSize: preset.gridSize,
      cols: preset.cols,
      rows: preset.rows,
      cellLabels: [...preset.cellLabels],
      cellGroups: preset.cellGroups.map(g => ({ ...g, cells: [...g.cells] })),
      genericGuidance: preset.genericGuidance,
      bgMode: preset.bgMode ?? null,
      aspectRatio: preset.aspectRatio || '1:1',
      tileShape: preset.tileShape || 'square',
    });
  };

  const handleSave = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      const body = {
        name: editing.name,
        spriteType: editing.spriteType,
        genre: editing.genre,
        gridSize: editing.gridSize,
        cols: editing.cols,
        rows: editing.rows,
        cellLabels: editing.cellLabels.slice(0, editing.cols * editing.rows),
        cellGroups: editing.cellGroups,
        genericGuidance: editing.genericGuidance,
        bgMode: editing.bgMode,
        aspectRatio: editing.aspectRatio,
        tileShape: editing.tileShape,
      };

      if (editing.id) {
        await fetch(`/api/grid-presets/${editing.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      } else {
        await fetch('/api/grid-presets', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      }
      setEditing(null);
      await fetchPresets();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this grid preset?')) return;
    await fetch(`/api/grid-presets/${id}`, { method: 'DELETE' });
    if (editing?.id === id) setEditing(null);
    await fetchPresets();
  };

  const updateGridSize = (cols: number, rows: number) => {
    if (!editing) return;
    const total = cols * rows;
    const labels = [...editing.cellLabels];
    while (labels.length < total) labels.push('');
    setEditing({
      ...editing,
      cols,
      rows,
      gridSize: `${cols}x${rows}`,
      cellLabels: labels.slice(0, total),
    });
  };

  const updateCellLabel = (idx: number, value: string) => {
    if (!editing) return;
    const labels = [...editing.cellLabels];
    labels[idx] = value;
    setEditing({ ...editing, cellLabels: labels });
  };

  const addCellGroup = () => {
    if (!editing) return;
    setEditing({
      ...editing,
      cellGroups: [...editing.cellGroups, { name: '', cells: [] }],
    });
  };

  const updateCellGroup = (idx: number, group: CellGroup) => {
    if (!editing) return;
    const groups = [...editing.cellGroups];
    groups[idx] = group;
    setEditing({ ...editing, cellGroups: groups });
  };

  const removeCellGroup = (idx: number) => {
    if (!editing) return;
    const groups = editing.cellGroups.filter((_, i) => i !== idx);
    setEditing({ ...editing, cellGroups: groups });
  };

  const setCellGroupCells = useCallback((groupIdx: number, cells: number[]) => {
    if (!editing) return;
    const group = { ...editing.cellGroups[groupIdx], cells };
    updateCellGroup(groupIdx, group);
  }, [editing, updateCellGroup]);

  const filtered = filterType === 'all'
    ? presets
    : presets.filter(p => p.spriteType === filterType);

  return (
    <div className="grid-presets-tab">
      {/* Sub-filter + New button */}
      <div className="admin-toolbar">
        <div className="admin-filter-group">
          <button
            className={`admin-filter-btn ${filterType === 'all' ? 'active' : ''}`}
            onClick={() => setFilterType('all')}
          >
            All
          </button>
          {SPRITE_TYPES.map(t => (
            <button
              key={t}
              className={`admin-filter-btn ${filterType === t ? 'active' : ''}`}
              onClick={() => setFilterType(t)}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
        <button className="btn btn-sm" onClick={handleNew}>New Grid Preset</button>
      </div>

      <div className="admin-split">
        {/* List */}
        <div className="admin-list">
          {filtered.length === 0 && (
            <div className="admin-empty">No grid presets found</div>
          )}
          {filtered.map(p => (
            <div
              key={p.id}
              className={`admin-list-item ${editing?.id === p.id ? 'active' : ''}`}
              onClick={() => handleEdit(p)}
            >
              <div className="admin-list-item-name">{p.name}</div>
              <div className="admin-list-item-meta">
                {p.spriteType} | {p.gridSize} | {p.cellLabels.length} cells
              </div>
            </div>
          ))}
        </div>

        {/* Edit form */}
        {editing && (
          <div className="admin-form">
            <h3>{editing.id ? 'Edit Grid Preset' : 'New Grid Preset'}</h3>

            <label className="admin-label">
              Name
              <input
                className="admin-input"
                value={editing.name}
                onChange={e => setEditing({ ...editing, name: e.target.value })}
              />
            </label>

            <div className="admin-row">
              <label className="admin-label">
                Sprite Type
                <select
                  className="admin-select"
                  value={editing.spriteType}
                  onChange={e => setEditing({ ...editing, spriteType: e.target.value as SpriteType })}
                >
                  {SPRITE_TYPES.map(t => (
                    <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                  ))}
                </select>
              </label>
              <label className="admin-label">
                Genre
                <input
                  className="admin-input"
                  value={editing.genre}
                  onChange={e => setEditing({ ...editing, genre: e.target.value })}
                  placeholder="e.g. RPG, Sci-Fi"
                />
              </label>
            </div>

            <div className="admin-row">
              <label className="admin-label">
                Columns
                <input
                  className="admin-input"
                  type="number"
                  min={1}
                  max={10}
                  value={editing.cols}
                  onChange={e => updateGridSize(Number(e.target.value), editing.rows)}
                />
              </label>
              <label className="admin-label">
                Rows
                <input
                  className="admin-input"
                  type="number"
                  min={1}
                  max={10}
                  value={editing.rows}
                  onChange={e => updateGridSize(editing.cols, Number(e.target.value))}
                />
              </label>
              <label className="admin-label">
                Grid Size
                <input className="admin-input" value={editing.gridSize} disabled />
              </label>
            </div>

            {editing.spriteType === 'background' && (
              <label className="admin-label">
                Background Mode
                <select
                  className="admin-select"
                  value={editing.bgMode || ''}
                  onChange={e => setEditing({ ...editing, bgMode: (e.target.value || null) as 'parallax' | 'scene' | null })}
                >
                  <option value="">None</option>
                  <option value="parallax">Parallax</option>
                  <option value="scene">Scene</option>
                </select>
              </label>
            )}

            <div className="admin-row">
              <label className="admin-label">
                Aspect Ratio
                <select
                  className="admin-select"
                  value={editing.aspectRatio}
                  onChange={e => setEditing({ ...editing, aspectRatio: e.target.value })}
                >
                  {['1:1','2:3','3:2','3:4','4:3','4:5','5:4','9:16','16:9','21:9'].map(r =>
                    <option key={r} value={r}>{r}</option>
                  )}
                </select>
              </label>
              <label className="admin-label">
                Tile Shape
                <select
                  className="admin-select"
                  value={editing.tileShape}
                  onChange={e => setEditing({ ...editing, tileShape: e.target.value as 'square' | 'diamond' })}
                >
                  <option value="square">Square</option>
                  <option value="diamond">Diamond (Isometric)</option>
                </select>
              </label>
            </div>

            {/* Cell Labels */}
            <div className="admin-section">
              <h4>Cell Labels ({editing.cols * editing.rows})</h4>
              <div className="admin-cell-labels-grid" style={{ gridTemplateColumns: `repeat(${editing.cols}, 1fr)` }}>
                {editing.cellLabels.slice(0, editing.cols * editing.rows).map((label, idx) => (
                  <input
                    key={idx}
                    className="admin-cell-label-input"
                    value={label}
                    onChange={e => updateCellLabel(idx, e.target.value)}
                    placeholder={`Cell ${idx}`}
                    title={`Cell ${idx} (${Math.floor(idx / editing.cols)},${idx % editing.cols})`}
                  />
                ))}
              </div>
            </div>

            {/* Cell Groups */}
            <div className="admin-section">
              <div className="admin-section-header">
                <h4>Cell Groups ({editing.cellGroups.length})</h4>
                <button className="btn btn-sm" onClick={addCellGroup}>Add Group</button>
              </div>
              {editing.cellGroups.map((group, gIdx) => {
                const GROUP_COLORS = [
                  'var(--accent)', 'var(--info)', '#ff6b9d', 'var(--warning)',
                  '#a78bfa', '#67e8f9', '#fbbf24', '#34d399',
                ];
                const allGroupCells = editing.cellGroups.map((g, i) => ({
                  groupIdx: i,
                  cells: g.cells,
                  color: GROUP_COLORS[i % GROUP_COLORS.length],
                }));
                return (
                  <div key={gIdx} className="admin-cell-group">
                    <div className="admin-cell-group-header">
                      <input
                        className="admin-input"
                        value={group.name}
                        onChange={e => updateCellGroup(gIdx, { ...group, name: e.target.value })}
                        placeholder="Group name (e.g. Walk Left)"
                      />
                      <button
                        className="btn btn-sm btn-danger"
                        onClick={() => removeCellGroup(gIdx)}
                      >
                        Remove
                      </button>
                    </div>
                    <CellRangeSelector
                      cols={editing.cols}
                      rows={editing.rows}
                      cellLabels={editing.cellLabels.slice(0, editing.cols * editing.rows)}
                      selectedCells={group.cells}
                      allGroupCells={allGroupCells}
                      currentGroupIdx={gIdx}
                      onChange={(cells) => setCellGroupCells(gIdx, cells)}
                    />
                  </div>
                );
              })}
            </div>

            {/* Generic Guidance */}
            <label className="admin-label">
              Generic Guidance
              <textarea
                className="admin-textarea"
                rows={8}
                value={editing.genericGuidance}
                onChange={e => setEditing({ ...editing, genericGuidance: e.target.value })}
                placeholder="Pose/cell descriptions shared across all content presets using this grid..."
              />
            </label>

            {/* Actions */}
            <div className="admin-form-actions">
              <button className="btn" onClick={handleSave} disabled={saving || !editing.name.trim()}>
                {saving ? 'Saving...' : editing.id ? 'Update' : 'Create'}
              </button>
              <button className="btn btn-sm" onClick={() => setEditing(null)}>Cancel</button>
              {editing.id && (
                <button
                  className="btn btn-sm btn-danger"
                  onClick={() => handleDelete(editing.id!)}
                >
                  Delete
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
