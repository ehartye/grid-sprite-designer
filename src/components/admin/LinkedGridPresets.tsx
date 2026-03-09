/**
 * Reusable component for managing grid preset links within a content preset.
 * Shows linked grids with guidance override textareas, add/remove/reorder controls.
 */

import { useState, useEffect, useCallback } from 'react';
import type { GridLink, GridPreset, SpriteType } from '../../context/AppContext';

interface LinkedGridPresetsProps {
  spriteType: SpriteType;
  presetId: number | string;
  onLinksChange?: () => void;
}

export function LinkedGridPresets({ spriteType, presetId, onLinksChange }: LinkedGridPresetsProps) {
  const [links, setLinks] = useState<GridLink[]>([]);
  const [availableGrids, setAvailableGrids] = useState<GridPreset[]>([]);
  const [addingGridId, setAddingGridId] = useState<number | ''>('');
  const [saving, setSaving] = useState(false);

  const fetchLinks = useCallback(async () => {
    const res = await fetch(`/api/presets/${spriteType}/${presetId}/grid-links`);
    if (res.ok) setLinks(await res.json());
  }, [spriteType, presetId]);

  const fetchAvailableGrids = useCallback(async () => {
    const res = await fetch(`/api/grid-presets?sprite_type=${spriteType}`);
    if (res.ok) setAvailableGrids(await res.json());
  }, [spriteType]);

  useEffect(() => {
    fetchLinks();
    fetchAvailableGrids();
  }, [fetchLinks, fetchAvailableGrids]);

  const addLink = async () => {
    if (!addingGridId) return;
    setSaving(true);
    try {
      const sortOrder = links.length;
      await fetch(`/api/presets/${spriteType}/${presetId}/grid-links`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gridPresetId: addingGridId, sortOrder }),
      });
      setAddingGridId('');
      await fetchLinks();
      onLinksChange?.();
    } finally {
      setSaving(false);
    }
  };

  const removeLink = async (linkId: number) => {
    if (!confirm('Remove this grid link?')) return;
    await fetch(`/api/grid-links/${spriteType}/${linkId}`, { method: 'DELETE' });
    await fetchLinks();
    onLinksChange?.();
  };

  const updateGuidance = async (linkId: number, guidanceOverride: string, sortOrder: number) => {
    await fetch(`/api/grid-links/${spriteType}/${linkId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ guidanceOverride, sortOrder }),
    });
  };

  const moveLink = async (idx: number, direction: -1 | 1) => {
    const targetIdx = idx + direction;
    if (targetIdx < 0 || targetIdx >= links.length) return;
    const updated = [...links];
    [updated[idx], updated[targetIdx]] = [updated[targetIdx], updated[idx]];
    setLinks(updated);
    // Update sort orders for both swapped items
    await Promise.all([
      updateGuidance(updated[idx].id, updated[idx].guidanceOverride, idx),
      updateGuidance(updated[targetIdx].id, updated[targetIdx].guidanceOverride, targetIdx),
    ]);
  };

  // Filter out grids that are already linked
  const linkedGridIds = new Set(links.map(l => l.gridPresetId));
  const unlinkedGrids = availableGrids.filter(g => !linkedGridIds.has(g.id));

  return (
    <div className="admin-section">
      <div className="admin-section-header">
        <h4>Linked Grid Presets ({links.length})</h4>
      </div>

      {links.length === 0 && (
        <div className="admin-empty" style={{ padding: '0.75rem' }}>No linked grids</div>
      )}

      {links.map((link, idx) => (
        <div key={link.id} className="admin-grid-link">
          <div className="admin-grid-link-header">
            <div className="admin-grid-link-info">
              <span className="admin-grid-link-name">{link.gridName}</span>
              <span className="admin-grid-link-meta">{link.gridSize} | {link.cellLabels.length} cells</span>
            </div>
            <div className="admin-grid-link-actions">
              <button
                className="btn btn-sm"
                onClick={() => moveLink(idx, -1)}
                disabled={idx === 0}
                title="Move up"
              >
                ^
              </button>
              <button
                className="btn btn-sm"
                onClick={() => moveLink(idx, 1)}
                disabled={idx === links.length - 1}
                title="Move down"
              >
                v
              </button>
              <button
                className="btn btn-sm btn-danger"
                onClick={() => removeLink(link.id)}
              >
                Remove
              </button>
            </div>
          </div>
          <label className="admin-label" style={{ marginBottom: '0.25rem' }}>
            Guidance Override
            <textarea
              className="admin-textarea"
              rows={3}
              value={link.guidanceOverride}
              onChange={e => {
                const updated = links.map(l =>
                  l.id === link.id ? { ...l, guidanceOverride: e.target.value } : l
                );
                setLinks(updated);
              }}
              onBlur={() => updateGuidance(link.id, link.guidanceOverride, link.sortOrder)}
              placeholder="Per-link guidance that overrides or supplements generic guidance..."
            />
          </label>
        </div>
      ))}

      {unlinkedGrids.length > 0 && (
        <div className="admin-grid-link-add">
          <select
            className="admin-select"
            value={addingGridId}
            onChange={e => setAddingGridId(e.target.value ? Number(e.target.value) : '')}
          >
            <option value="">Select grid preset...</option>
            {unlinkedGrids.map(g => (
              <option key={g.id} value={g.id}>{g.name} ({g.gridSize})</option>
            ))}
          </select>
          <button
            className="btn btn-sm"
            onClick={addLink}
            disabled={!addingGridId || saving}
          >
            Add Link
          </button>
        </div>
      )}
    </div>
  );
}
