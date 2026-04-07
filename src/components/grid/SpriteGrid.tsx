/**
 * Sprite grid display.
 * Shows extracted sprites on checkerboard transparency backgrounds
 * or empty cells with pose labels when no sprites are available.
 * Supports variable grid sizes (6x6 character default, 3x3/2x3/2x2 buildings).
 */

import React, { useMemo } from 'react';
import { CELL_LABELS } from '../../lib/poses';
import { ExtractedSprite } from '../../lib/spriteExtractor';
import { CellContextMenu } from './CellContextMenu';
import type { FeedbackState } from '../../types/feedback';

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
  /** When true, renders sprites with CSS image-rendering: pixelated for crisp upscaling */
  pixelizeEnabled?: boolean;
  /** Feedback state for sign-off and per-cell feedback indicators */
  feedbackState?: FeedbackState;
  /** Callback when a cell's sign-off is toggled */
  onSignOffToggle?: (cellIndex: number) => void;
  /** Callback when feedback is requested for a cell */
  onFeedbackClick?: (cellIndex: number) => void;
}

export const SpriteGrid = React.memo(function SpriteGrid({ sprites, onCellClick, selectedCell, mirroredCells, onMirrorToggle, thumbnailCell, onThumbnailSet, onZoomClick, gridCols, cellLabels, pixelizeEnabled, feedbackState, onSignOffToggle, onFeedbackClick }: SpriteGridProps) {
  const cols = gridCols ?? 6;
  const labels = cellLabels ?? CELL_LABELS;

  // Build a lookup map from cellIndex to sprite
  const spriteMap = useMemo(() => {
    const map = new Map<number, ExtractedSprite>();
    for (const sprite of sprites) {
      map.set(sprite.cellIndex, sprite);
    }
    return map;
  }, [sprites]);

  // For non-background types, cells are always 1:1.
  // For backgrounds, derive from sprite dimensions or fallback to square.
  const firstSprite = sprites[0];
  let cellAspect: string;
  if (firstSprite && firstSprite.height > 0) {
    cellAspect = `${firstSprite.width} / ${firstSprite.height}`;
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
        const cellFeedback = feedbackState?.cells[idx];
        const cellClasses = ['sprite-cell'];
        if (!sprite) cellClasses.push('empty');
        if (isSelected) cellClasses.push('selected');
        if (cellFeedback?.signedOff) cellClasses.push('signed-off');
        if (cellFeedback?.feedback?.trim()) cellClasses.push('has-feedback');

        return (
          <div
            key={idx}
            className={cellClasses.join(' ')}
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
                  style={{
                    ...(isMirrored ? { transform: 'scaleX(-1)' } : {}),
                    ...(pixelizeEnabled ? { imageRendering: 'pixelated' as const } : {}),
                  }}
                />
                <CellContextMenu
                  cellIndex={idx}
                  isMirrored={isMirrored}
                  isThumbnail={thumbnailCell === idx}
                  isSignedOff={cellFeedback?.signedOff ?? false}
                  hasFeedback={!!cellFeedback?.feedback?.trim()}
                  onMirrorToggle={() => onMirrorToggle?.(idx)}
                  onThumbnailSet={() => onThumbnailSet?.(idx)}
                  onZoomClick={() => onZoomClick?.(idx)}
                  onSignOffToggle={() => onSignOffToggle?.(idx)}
                  onFeedbackClick={() => onFeedbackClick?.(idx)}
                />
              </>
            ) : null}
            <span className="cell-label">{label}</span>
          </div>
        );
      })}
    </div>
  );
});
