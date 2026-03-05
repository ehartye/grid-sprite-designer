/**
 * Sprite grid display.
 * Shows extracted sprites on checkerboard transparency backgrounds
 * or empty cells with pose labels when no sprites are available.
 * Supports variable grid sizes (6x6 character default, 3x3/2x3/2x2 buildings).
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
  onZoomClick?: (cellIndex: number) => void;
  /** Override grid columns (default 6 for characters) */
  gridCols?: number;
  /** Override cell labels (default from poses.ts) */
  cellLabels?: string[];
  /** Grid aspect ratio (e.g. '4:3') — used as fallback when no sprites are available */
  aspectRatio?: string;
}

export function SpriteGrid({ sprites, onCellClick, selectedCell, mirroredCells, onMirrorToggle, thumbnailCell, onThumbnailSet, onZoomClick, gridCols, cellLabels, aspectRatio }: SpriteGridProps) {
  const cols = gridCols ?? 6;
  const labels = cellLabels ?? CELL_LABELS;

  // Build a lookup map from cellIndex to sprite
  const spriteMap = new Map<number, ExtractedSprite>();
  for (const sprite of sprites) {
    spriteMap.set(sprite.cellIndex, sprite);
  }

  // Derive cell aspect ratio from the first sprite's actual dimensions,
  // falling back to the grid aspect ratio for non-square grids
  const firstSprite = sprites[0];
  let cellAspect: string;
  if (firstSprite && firstSprite.height > 0) {
    cellAspect = `${firstSprite.width} / ${firstSprite.height}`;
  } else if (aspectRatio && aspectRatio !== '1:1' && gridCols) {
    // Calculate cell aspect from canvas aspect ratio and grid dimensions
    const [arW, arH] = aspectRatio.split(':').map(Number);
    if (arW && arH) {
      const rows = Math.ceil(labels.length / cols);
      const canvasAR = arW / arH;
      const cellAR = (canvasAR * rows) / cols;
      cellAspect = `${cellAR}`;
    } else {
      cellAspect = '1';
    }
  } else {
    cellAspect = '1';
  }

  const gridStyle: React.CSSProperties = {
    gridTemplateColumns: `repeat(${cols}, 1fr)`,
    '--cell-aspect': cellAspect,
  } as React.CSSProperties;

  return (
    <div
      className="sprite-grid"
      style={gridStyle}
    >
      {labels.map((label, idx) => {
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
                {onZoomClick && (
                  <button
                    className="cell-zoom-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      onZoomClick(idx);
                    }}
                    title="Zoom / inspect pixels"
                  >
                    &#x1F50D;
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
