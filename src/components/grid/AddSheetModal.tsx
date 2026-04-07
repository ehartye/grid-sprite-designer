/**
 * Modal for generating a new sprite sheet linked to an existing generation.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAppContext, SpriteType, GridLink } from '../../context/AppContext';
import { useAddSheet, AddSheetOptions } from '../../hooks/useAddSheet';
import { ExtractedSprite } from '../../lib/spriteExtractor';
import { useModalFocus } from '../../hooks/useModalFocus';
import { IMAGE_MODELS, getModel, formatCost, type ImageSize } from '../../lib/models';

interface Props {
  open: boolean;
  onClose: () => void;
  currentSprites: ExtractedSprite[];
}

export function AddSheetModal({ open, onClose, currentSprites }: Props) {
  const { state, dispatch } = useAppContext();
  const { generate, cancel, generating } = useAddSheet();
  const modalRef = useRef<HTMLDivElement>(null);

  const [gridLinks, setGridLinks] = useState<GridLink[]>([]);
  const [selectedLinkIndex, setSelectedLinkIndex] = useState(0);
  const [imageSize, setImageSize] = useState<'2K' | '4K'>(
    (state.imageSize === '4K' ? '4K' : '2K'),
  );
  const [referenceMode, setReferenceMode] = useState<'full' | 'selected'>('full');
  const [selectedSpriteIndices, setSelectedSpriteIndices] = useState<Set<number>>(new Set());
  const [followUpGuidance, setFollowUpGuidance] = useState('');
  const [loading, setLoading] = useState(false);
  const [model, setModel] = useState(state.model);
  const [thinkingLevel, setThinkingLevel] = useState(state.thinkingLevel);
  const [pixelizeSize, setPixelizeSize] = useState<number | undefined>(undefined);

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
      .catch((err) => {
        console.error('Failed to load grid links:', err);
        setGridLinks([]);
      })
      .finally(() => setLoading(false));
  }, [open, contentPresetId, spriteType, state.activeGridConfig]);

  // Reset sprite selection when switching mode
  useEffect(() => {
    // Always start with nothing selected
    setSelectedSpriteIndices(new Set());
  }, [referenceMode]);

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
      gridGuidance: { overall: '', groups: {}, cells: {} },
      linkGuidance: { overall: '', groups: {}, cells: {} },
      sortOrder: 0,
      aspectRatio: state.activeGridConfig!.aspectRatio || '1:1',
      tileShape: 'square' as const,
    };

    const selectedSprites = referenceMode === 'selected'
      ? currentSprites.filter((_, i) => selectedSpriteIndices.has(i))
      : undefined;

    dispatch({ type: 'SET_MODEL', model });
    dispatch({ type: 'SET_THINKING_LEVEL', thinkingLevel });
    await new Promise(r => setTimeout(r, 0));

    const opts: AddSheetOptions = {
      gridLink: effectiveGridLink,
      imageSize,
      referenceMode,
      selectedSprites,
      followUpGuidance: followUpGuidance.trim() || undefined,
      pixelizeSize,
    };

    await generate(opts);
    onClose();
  }, [gridLinks, selectedLinkIndex, imageSize, referenceMode, selectedSpriteIndices, currentSprites, state.activeGridConfig, followUpGuidance, model, thinkingLevel, pixelizeSize, generate, onClose]);

  const handleCancel = useCallback(() => {
    cancel();
    onClose();
  }, [cancel, onClose]);

  useModalFocus(modalRef, open, handleCancel);

  if (!open) return null;

  const hasGridLinks = gridLinks.length > 0;

  return (
    <div className="add-sheet-overlay" onClick={handleCancel}>
      <div className="add-sheet-modal" ref={modalRef} role="dialog" aria-modal="true" aria-labelledby="add-sheet-title" onClick={e => e.stopPropagation()}>
        <h3 id="add-sheet-title">Add Sprite Sheet</h3>

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

        {/* Generation Settings */}
        <div className="add-sheet-section">
          <label>Model</label>
          <div className="config-field" style={{ marginBottom: 12 }}>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
            >
              {IMAGE_MODELS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label} — {m.tagline}
                </option>
              ))}
            </select>
          </div>

          {getModel(model)?.supportsThinking && (
            <div className="config-field" style={{ marginBottom: 12 }}>
              <label>Thinking Level</label>
              <select
                value={thinkingLevel}
                onChange={(e) => setThinkingLevel(e.target.value as typeof thinkingLevel)}
              >
                <option value="default">Default (model decides)</option>
                <option value="minimal">Minimal — fastest, no reasoning</option>
                <option value="low">Low — light reasoning</option>
                <option value="medium">Medium — balanced</option>
                <option value="high">High — deepest reasoning</option>
              </select>
            </div>
          )}

          <label>Image Size</label>
          <div className="segmented-control">
            <button
              type="button"
              className={imageSize === '2K' ? 'active' : ''}
              onClick={() => setImageSize('2K')}
            >
              2K (2048px)
            </button>
            <button
              type="button"
              className={imageSize === '4K' ? 'active' : ''}
              onClick={() => setImageSize('4K')}
            >
              4K (4096px)
            </button>
          </div>
          {(() => {
            const cost = getModel(model)?.cost[imageSize as ImageSize];
            if (cost === undefined) return null;
            return (
              <p style={{ margin: '6px 0 0', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                Estimated cost: ~{formatCost(cost)} per image
              </p>
            );
          })()}
        </div>

        {/* Pixelize Target */}
        <div className="add-sheet-section">
          <label>Pixelize Target</label>
          <div style={{ display: 'flex', gap: 4 }}>
            <button
              type="button"
              className={`pixel-size-btn ${pixelizeSize === undefined ? 'active' : ''}`}
              onClick={() => setPixelizeSize(undefined)}
            >
              Off
            </button>
            {([16, 32, 48, 64, 128] as const).map(size => (
              <button
                key={size}
                type="button"
                className={`pixel-size-btn ${pixelizeSize === size ? 'active' : ''}`}
                onClick={() => setPixelizeSize(size)}
              >
                {size}
              </button>
            ))}
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
            disabled={generating || loading || (referenceMode === 'selected' && selectedSpriteIndices.size === 0)}
          >
            {generating ? 'Generating...' : 'Generate'}
          </button>
        </div>
      </div>
    </div>
  );
}
