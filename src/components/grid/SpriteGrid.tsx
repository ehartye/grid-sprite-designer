/**
 * 6x6 sprite grid display.
 * Shows extracted sprites on checkerboard transparency backgrounds
 * or empty cells with pose labels when no sprites are available.
 */

import React from 'react';
import { CELL_LABELS } from '../../lib/poses';
import { ExtractedSprite } from '../../lib/spriteExtractor';

interface SpriteGridProps {
  sprites: ExtractedSprite[];
  onCellClick?: (cellIndex: number) => void;
  selectedCell?: number | null;
  mirroredCells?: Set<number>;
  onMirrorToggle?: (cellIndex: number) => void;
  thumbnailCell?: number | null;
  onThumbnailSet?: (cellIndex: number) => void;
}

export function SpriteGrid({ sprites, onCellClick, selectedCell, mirroredCells, onMirrorToggle, thumbnailCell, onThumbnailSet }: SpriteGridProps) {
  // Build a lookup map from cellIndex to sprite
  const spriteMap = new Map<number, ExtractedSprite>();
  for (const sprite of sprites) {
    spriteMap.set(sprite.cellIndex, sprite);
  }

  return (
    <div className="sprite-grid">
      {CELL_LABELS.map((label, idx) => {
        const sprite = spriteMap.get(idx);
        const isSelected = selectedCell === idx;
        const isMirrored = mirroredCells?.has(idx) ?? false;

        return (
          <div
            key={idx}
            className={`sprite-cell ${sprite ? '' : 'empty'} ${isSelected ? 'selected' : ''}`}
            onClick={() => onCellClick?.(idx)}
            style={isSelected ? { borderColor: 'var(--accent)', boxShadow: '0 0 8px var(--accent-glow)' } : undefined}
            title={label}
          >
            {sprite ? (
              <>
                <img
                  src={`data:${sprite.mimeType};base64,${sprite.imageData}`}
                  alt={label}
                  draggable={false}
                  style={isMirrored ? { transform: 'scaleX(-1)' } : undefined}
                />
                {onMirrorToggle && (
                  <button
                    className={`cell-mirror-btn ${isMirrored ? 'active' : ''}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onMirrorToggle(idx);
                    }}
                    title={isMirrored ? 'Unmirror' : 'Mirror'}
                  >
                    &#x21c4;
                  </button>
                )}
                {onThumbnailSet && (
                  <button
                    className={`cell-thumb-btn ${thumbnailCell === idx ? 'active' : ''}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onThumbnailSet(idx);
                    }}
                    title={thumbnailCell === idx ? 'Gallery thumbnail' : 'Set as gallery thumbnail'}
                  >
                    {thumbnailCell === idx ? '\u2605' : '\u2606'}
                  </button>
                )}
              </>
            ) : null}
            <span className="cell-label">{label}</span>
          </div>
        );
      })}
    </div>
  );
}
