/**
 * Run Builder page for selective multi-grid generation.
 * Lets users pick a sprite type, content preset, check/reorder linked grids,
 * choose image size, and start a sequential generation run.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useAppContext, SpriteType, GridLink } from '../../context/AppContext';
import '../../styles/run-builder.css';

interface ContentPresetOption {
  id: string;
  name: string;
  genre: string;
}

export function RunBuilderPage() {
  const { state, dispatch } = useAppContext();

  const [spriteType, setSpriteType] = useState<SpriteType>(state.spriteType);
  const [presets, setPresets] = useState<ContentPresetOption[]>([]);
  const [selectedPresetId, setSelectedPresetId] = useState<string>('');
  const [gridLinks, setGridLinks] = useState<GridLink[]>([]);
  const [checkedIds, setCheckedIds] = useState<Set<number>>(new Set());
  const [imageSize, setImageSize] = useState<'2K' | '4K'>('2K');
  const [loading, setLoading] = useState(false);

  // Fetch content presets when sprite type changes
  useEffect(() => {
    setPresets([]);
    setSelectedPresetId('');
    setGridLinks([]);
    setCheckedIds(new Set());

    fetch(`/api/presets?type=${spriteType}`)
      .then((res) => res.json())
      .then((data: ContentPresetOption[]) => setPresets(data))
      .catch((err) => {
        console.error('Failed to load presets:', err);
        dispatch({ type: 'SET_STATUS', message: 'Failed to load presets', statusType: 'warning' });
      });
  }, [spriteType]);

  // Fetch grid links when a content preset is selected
  useEffect(() => {
    if (!selectedPresetId) {
      setGridLinks([]);
      setCheckedIds(new Set());
      return;
    }

    setLoading(true);
    fetch(`/api/presets/${spriteType}/${selectedPresetId}/grid-links`)
      .then((res) => res.json())
      .then((data: GridLink[]) => {
        setGridLinks(data);
        // Check all by default
        setCheckedIds(new Set(data.map((l) => l.id)));
      })
      .catch((err) => {
        console.error('Failed to load grid links:', err);
        setGridLinks([]);
        setCheckedIds(new Set());
        dispatch({ type: 'SET_STATUS', message: 'Failed to load grid links', statusType: 'warning' });
      })
      .finally(() => setLoading(false));
  }, [spriteType, selectedPresetId]);

  const toggleCheck = useCallback((id: number) => {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const moveLink = useCallback((index: number, direction: -1 | 1) => {
    setGridLinks((prev) => {
      const next = [...prev];
      const targetIndex = index + direction;
      if (targetIndex < 0 || targetIndex >= next.length) return prev;
      [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
      return next;
    });
  }, []);

  const handleStartRun = useCallback(() => {
    const selected = gridLinks.filter((l) => checkedIds.has(l.id));
    if (selected.length === 0 || !selectedPresetId) return;

    dispatch({
      type: 'START_RUN',
      payload: {
        contentPresetId: selectedPresetId,
        spriteType,
        gridLinks: selected,
        imageSize,
      },
    });
  }, [gridLinks, checkedIds, selectedPresetId, spriteType, imageSize, dispatch]);

  const handleBack = useCallback(() => {
    dispatch({ type: 'SET_STEP', step: 'configure' });
  }, [dispatch]);

  const checkedCount = gridLinks.filter((l) => checkedIds.has(l.id)).length;

  return (
    <div className="run-builder">
      <div className="run-builder-header">
        <button className="btn btn-sm" onClick={handleBack}>
          Back
        </button>
        <h2>Run Builder</h2>
      </div>

      {/* Sprite Type Selector */}
      <div className="run-section">
        <label className="run-label">Sprite Type</label>
        <div className="segmented-control">
          {(['character', 'building', 'terrain', 'background'] as SpriteType[]).map((t) => (
            <button
              key={t}
              className={spriteType === t ? 'active' : ''}
              onClick={() => setSpriteType(t)}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Content Preset Dropdown */}
      <div className="run-section">
        <label className="run-label">Content Preset</label>
        <select
          className="select-input"
          value={selectedPresetId}
          onChange={(e) => setSelectedPresetId(e.target.value)}
        >
          <option value="">-- Select a preset --</option>
          {presets.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}{p.genre ? ` (${p.genre})` : ''}
            </option>
          ))}
        </select>
      </div>

      {/* Grid Links Checklist */}
      {selectedPresetId && (
        <div className="run-section">
          <label className="run-label">
            Linked Grids
            {gridLinks.length > 0 && (
              <span className="run-label-count">
                {checkedCount} of {gridLinks.length} selected
              </span>
            )}
          </label>

          {loading && <p className="run-loading">Loading grid links...</p>}

          {!loading && gridLinks.length === 0 && (
            <p className="run-empty">No grid presets linked to this preset. Link grids in the Admin page.</p>
          )}

          {!loading && gridLinks.length > 0 && (
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
                      {link.gridSize} &middot; {link.cols}x{link.rows} &middot; {link.cellLabels.length} cells
                    </span>
                    {index === 0 && checkedIds.has(link.id) && (
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
          )}
        </div>
      )}

      {/* Image Size */}
      <div className="run-section">
        <label className="run-label">Image Size</label>
        <div className="segmented-control">
          <button
            className={imageSize === '2K' ? 'active' : ''}
            onClick={() => setImageSize('2K')}
          >
            2K
          </button>
          <button
            className={imageSize === '4K' ? 'active' : ''}
            onClick={() => setImageSize('4K')}
          >
            4K
          </button>
        </div>
      </div>

      {/* Start Run */}
      <div className="run-actions">
        <button
          className="btn btn-primary btn-lg"
          disabled={checkedCount === 0 || !selectedPresetId}
          onClick={handleStartRun}
        >
          Start Run ({checkedCount} grid{checkedCount !== 1 ? 's' : ''})
        </button>
      </div>
    </div>
  );
}
