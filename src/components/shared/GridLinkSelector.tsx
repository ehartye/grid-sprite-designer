/**
 * Shared grid link selector with checkboxes and reorder.
 * Embeds into config panels — replaces the old read-only badges
 * and the separate Run Builder page.
 */

import React, { useState, useCallback, useEffect } from 'react';
import { GridLink } from '../../context/AppContext';

interface GridLinkSelectorProps {
  spriteType: string;
  presetId: string;
  onSelectionChange: (selected: GridLink[]) => void;
}

export function GridLinkSelector({ spriteType, presetId, onSelectionChange }: GridLinkSelectorProps) {
  const [gridLinks, setGridLinks] = useState<GridLink[]>([]);
  const [checkedIds, setCheckedIds] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!presetId) {
      setGridLinks([]);
      setCheckedIds(new Set());
      onSelectionChange([]);
      return;
    }

    setLoading(true);
    fetch(`/api/presets/${spriteType}/${presetId}/grid-links`)
      .then((res) => res.json())
      .then((data: GridLink[]) => {
        setGridLinks(data);
        // Check first by default
        const firstId = data.length > 0 ? new Set([data[0].id]) : new Set<number>();
        setCheckedIds(firstId);
        onSelectionChange(data.filter((l) => firstId.has(l.id)));
      })
      .catch(() => {
        setGridLinks([]);
        setCheckedIds(new Set());
        onSelectionChange([]);
      })
      .finally(() => setLoading(false));
  }, [spriteType, presetId]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleCheck = useCallback((id: number) => {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      const selected = gridLinks.filter((l) => next.has(l.id));
      onSelectionChange(selected);
      return next;
    });
  }, [gridLinks, onSelectionChange]);

  const moveLink = useCallback((index: number, direction: -1 | 1) => {
    setGridLinks((prev) => {
      const next = [...prev];
      const targetIndex = index + direction;
      if (targetIndex < 0 || targetIndex >= next.length) return prev;
      [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
      const selected = next.filter((l) => checkedIds.has(l.id));
      onSelectionChange(selected);
      return next;
    });
  }, [checkedIds, onSelectionChange]);

  if (!presetId) return null;
  if (loading) return <p className="run-loading">Loading grid links...</p>;
  if (gridLinks.length === 0) return (
    <p className="run-empty">No grid presets linked. Add grids in Admin.</p>
  );

  const checkedCount = gridLinks.filter((l) => checkedIds.has(l.id)).length;

  return (
    <div className="config-field">
      <label className="run-label">
        Grids to Generate
        <span className="run-label-count">
          {checkedCount} of {gridLinks.length} selected
        </span>
      </label>
      <div className="run-grid-list">
        {gridLinks.map((link, index) => (
          <div
            key={link.id}
            className={`run-grid-item${checkedIds.has(link.id) ? ' checked' : ''}`}
          >
            <div className="run-grid-item-reorder">
              <button
                className="run-reorder-btn"
                disabled={index === 0}
                onClick={() => moveLink(index, -1)}
                title="Move up"
              >
                ^
              </button>
              <button
                className="run-reorder-btn"
                disabled={index === gridLinks.length - 1}
                onClick={() => moveLink(index, 1)}
                title="Move down"
              >
                v
              </button>
            </div>

            <label className="run-grid-item-check">
              <input
                type="checkbox"
                checked={checkedIds.has(link.id)}
                onChange={() => toggleCheck(link.id)}
              />
            </label>

            <div className="run-grid-item-info">
              <span className="run-grid-item-name">{link.gridName}</span>
              <span className="run-grid-item-meta">
                {link.gridSize} &middot; {link.cellLabels.length} cells
              </span>
              {index === 0 && checkedIds.has(link.id) && checkedCount > 1 && (
                <span className="run-grid-item-ref">Reference Sheet</span>
              )}
            </div>

            {link.guidanceOverride && (
              <span className="run-grid-item-override" title={link.guidanceOverride}>
                Has override
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
