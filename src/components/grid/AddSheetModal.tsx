/**
 * Modal for generating a new sprite sheet linked to an existing generation.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useAppContext, SpriteType, GridLink } from '../../context/AppContext';
import { useAddSheet, AddSheetOptions } from '../../hooks/useAddSheet';
import { ExtractedSprite } from '../../lib/spriteExtractor';

interface Props {
  open: boolean;
  onClose: () => void;
  currentSprites: ExtractedSprite[];
}

export function AddSheetModal({ open, onClose, currentSprites }: Props) {
  const { state } = useAppContext();
  const { generate, cancel, generating } = useAddSheet();

  const [gridLinks, setGridLinks] = useState<GridLink[]>([]);
  const [selectedLinkIndex, setSelectedLinkIndex] = useState(0);
  const [imageSize, setImageSize] = useState<'2K' | '4K'>(
    (state.imageSize === '4K' ? '4K' : '2K'),
  );
  const [referenceMode, setReferenceMode] = useState<'full' | 'selected'>('full');
  const [selectedSpriteIndices, setSelectedSpriteIndices] = useState<Set<number>>(new Set());
  const [followUpGuidance, setFollowUpGuidance] = useState('');
  const [aspectRatio, setAspectRatio] = useState(state.aspectRatio || '1:1');
  const [loading, setLoading] = useState(false);

  const spriteType = state.spriteType as SpriteType;
  const contentPresetId = state.sourceContentPresetId;

  // Fetch linked grid presets
  useEffect(() => {
    if (!open || !contentPresetId) {
      setGridLinks([]);
      return;
    }

    setLoading(true);
    fetch(`/api/presets/${spriteType}/${contentPresetId}/grid-links`)
      .then(res => res.json())
      .then((links: GridLink[]) => {
        setGridLinks(links);
        // Default to matching current grid size
        const currentGridSize = state.activeGridConfig
          ? `${state.activeGridConfig.cols}x${state.activeGridConfig.rows}`
          : null;
        const matchIdx = links.findIndex(l => l.gridSize === currentGridSize);
        setSelectedLinkIndex(matchIdx >= 0 ? matchIdx : 0);
      })
      .catch(() => setGridLinks([]))
      .finally(() => setLoading(false));
  }, [open, contentPresetId, spriteType, state.activeGridConfig]);

  // Reset sprite selection when switching mode
  useEffect(() => {
    if (referenceMode === 'full') {
      setSelectedSpriteIndices(new Set());
    } else {
      // Select all by default
      setSelectedSpriteIndices(new Set(currentSprites.map((_, i) => i)));
    }
  }, [referenceMode, currentSprites]);

  const toggleSprite = useCallback((index: number) => {
    setSelectedSpriteIndices(prev => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }, []);

  const handleGenerate = useCallback(async () => {
    const gridLink = gridLinks[selectedLinkIndex];
    if (!gridLink && !state.activeGridConfig) return;

    // If no grid links available (legacy), build a synthetic grid link from current config
    const effectiveGridLink: GridLink = gridLink || {
      id: 0,
      gridPresetId: 0,
      gridName: 'Current Layout',
      gridSize: `${state.activeGridConfig!.cols}x${state.activeGridConfig!.rows}`,
      cols: state.activeGridConfig!.cols,
      rows: state.activeGridConfig!.rows,
      cellLabels: state.activeGridConfig!.cellLabels || [],
      cellGroups: state.activeGridConfig!.cellGroups || [],
      genericGuidance: '',
      guidanceOverride: '',
      sortOrder: 0,
      aspectRatio: state.activeGridConfig!.aspectRatio || '1:1',
      tileShape: 'square' as const,
    };

    const selectedSprites = referenceMode === 'selected'
      ? currentSprites.filter((_, i) => selectedSpriteIndices.has(i))
      : undefined;

    const opts: AddSheetOptions = {
      gridLink: effectiveGridLink,
      imageSize,
      referenceMode,
      selectedSprites,
      followUpGuidance: followUpGuidance.trim() || undefined,
      aspectRatioOverride: aspectRatio,
    };

    await generate(opts);
    onClose();
  }, [gridLinks, selectedLinkIndex, imageSize, referenceMode, selectedSpriteIndices, currentSprites, state.activeGridConfig, followUpGuidance, aspectRatio, generate, onClose]);

  const handleCancel = useCallback(() => {
    cancel();
    onClose();
  }, [cancel, onClose]);

  if (!open) return null;

  const hasGridLinks = gridLinks.length > 0;

  return (
    <div className="add-sheet-overlay" onClick={handleCancel}>
      <div className="add-sheet-modal" onClick={e => e.stopPropagation()}>
        <h3>Add Sprite Sheet</h3>

        {/* Grid Layout */}
        <div className="add-sheet-section">
          <label>Grid Layout</label>
          {loading && <p>Loading grid presets...</p>}
          {!loading && hasGridLinks && (
            <select
              className="select-input"
              value={selectedLinkIndex}
              onChange={e => setSelectedLinkIndex(Number(e.target.value))}
            >
              {gridLinks.map((link, i) => (
                <option key={link.id} value={i}>
                  {link.gridName} ({link.gridSize} · {link.cellLabels.length} cells)
                </option>
              ))}
            </select>
          )}
          {!loading && !hasGridLinks && (
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary, #aaa)' }}>
              Same layout as current sheet
              {!contentPresetId && ' (no linked presets for legacy entries)'}
            </p>
          )}
        </div>

        {/* Reference Type */}
        <div className="add-sheet-section">
          <label>Reference Image</label>
          <div className="add-sheet-ref-toggle">
            <button
              className={`btn btn-sm${referenceMode === 'full' ? ' btn-primary' : ''}`}
              onClick={() => setReferenceMode('full')}
            >
              Full Sheet
            </button>
            <button
              className={`btn btn-sm${referenceMode === 'selected' ? ' btn-primary' : ''}`}
              onClick={() => setReferenceMode('selected')}
            >
              Selected Sprites
            </button>
          </div>

          {referenceMode === 'selected' && (
            <div className="add-sheet-sprites">
              {currentSprites.map((sprite, i) => (
                <label
                  key={i}
                  className={`add-sheet-sprite-check${selectedSpriteIndices.has(i) ? ' selected' : ''}`}
                >
                  <input
                    type="checkbox"
                    checked={selectedSpriteIndices.has(i)}
                    onChange={() => toggleSprite(i)}
                  />
                  <img
                    src={`data:${sprite.mimeType};base64,${sprite.imageData}`}
                    alt={sprite.label}
                    title={sprite.label}
                  />
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Follow-up Guidance */}
        <div className="add-sheet-section">
          <label>Follow-up Guidance</label>
          <textarea
            className="add-sheet-guidance"
            rows={3}
            placeholder="e.g. animate the cape flowing, add fire effects, switch to a crouching pose..."
            value={followUpGuidance}
            onChange={e => setFollowUpGuidance(e.target.value)}
          />
        </div>

        {/* Aspect Ratio */}
        <div className="add-sheet-section">
          <label>Aspect Ratio</label>
          <div className="segmented-control">
            {['1:1', '3:2', '2:3', '16:9', '9:16'].map(ar => (
              <button
                key={ar}
                className={aspectRatio === ar ? 'active' : ''}
                onClick={() => setAspectRatio(ar)}
              >
                {ar}
              </button>
            ))}
          </div>
        </div>

        {/* Image Size */}
        <div className="add-sheet-section">
          <label>Image Size</label>
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

        {/* Actions */}
        <div className="add-sheet-actions">
          <button className="btn" onClick={handleCancel} disabled={generating}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            onClick={handleGenerate}
            disabled={generating || (referenceMode === 'selected' && selectedSpriteIndices.size === 0)}
          >
            {generating ? 'Generating...' : 'Generate'}
          </button>
        </div>
      </div>
    </div>
  );
}
