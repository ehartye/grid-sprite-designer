/**
 * 6x6 sprite grid display.
 * Shows extracted sprites on checkerboard transparency backgrounds
 * or empty cells with pose labels when no sprites are available.
 */

import React from 'react';
import { useAppContext } from '../../context/AppContext';
import { CELL_LABELS, COLS } from '../../lib/poses';
import { ExtractedSprite } from '../../lib/spriteExtractor';

interface SpriteGridProps {
  sprites: ExtractedSprite[];
  onCellClick?: (cellIndex: number) => void;
  selectedCell?: number | null;
}

export function SpriteGrid({ sprites, onCellClick, selectedCell }: SpriteGridProps) {
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

        return (
          <div
            key={idx}
            className={`sprite-cell ${sprite ? '' : 'empty'} ${isSelected ? 'selected' : ''}`}
            onClick={() => onCellClick?.(idx)}
            style={isSelected ? { borderColor: 'var(--accent)', boxShadow: '0 0 8px var(--accent-glow)' } : undefined}
            title={label}
          >
            {sprite ? (
              <img
                src={`data:${sprite.mimeType};base64,${sprite.imageData}`}
                alt={label}
                draggable={false}
              />
            ) : null}
            <span className="cell-label">{label}</span>
          </div>
        );
      })}
    </div>
  );
}
