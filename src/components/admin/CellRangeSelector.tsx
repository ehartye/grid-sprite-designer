/**
 * Cell Range Selector — visual mini-grid with click-to-set-range interaction.
 * Click a cell to set range start, click another to set end.
 * Contiguous cells between start and end are highlighted.
 * Like picking travel dates on a calendar.
 */

import React, { useState, useCallback, useMemo } from 'react';

interface CellRangeSelectorProps {
  cols: number;
  rows: number;
  cellLabels: string[];
  /** Currently assigned cell indices for this group */
  selectedCells: number[];
  /** All cell assignments across ALL groups, keyed by group index */
  allGroupCells: { groupIdx: number; cells: number[]; color: string }[];
  /** This group's index (to exclude from "taken" display) */
  currentGroupIdx: number;
  onChange: (cells: number[]) => void;
}

export function CellRangeSelector({
  cols,
  rows,
  cellLabels,
  selectedCells,
  allGroupCells,
  currentGroupIdx,
  onChange,
}: CellRangeSelectorProps) {
  const totalCells = cols * rows;

  // Selection state: null = idle, number = picking end
  const [rangeStart, setRangeStart] = useState<number | null>(null);
  const [hoverCell, setHoverCell] = useState<number | null>(null);

  // Derive current range start/end from selectedCells
  const currentRange = useMemo(() => {
    if (selectedCells.length === 0) return null;
    const sorted = [...selectedCells].sort((a, b) => a - b);
    return { start: sorted[0], end: sorted[sorted.length - 1] };
  }, [selectedCells]);

  // Build a map of which cells are taken by OTHER groups
  const takenByOther = useMemo(() => {
    const map = new Map<number, { groupIdx: number; color: string }>();
    for (const g of allGroupCells) {
      if (g.groupIdx === currentGroupIdx) continue;
      for (const c of g.cells) {
        map.set(c, { groupIdx: g.groupIdx, color: g.color });
      }
    }
    return map;
  }, [allGroupCells, currentGroupIdx]);

  // Preview range while hovering during selection
  const previewRange = useMemo(() => {
    if (rangeStart === null || hoverCell === null) return new Set<number>();
    const lo = Math.min(rangeStart, hoverCell);
    const hi = Math.max(rangeStart, hoverCell);
    const set = new Set<number>();
    for (let i = lo; i <= hi; i++) set.add(i);
    return set;
  }, [rangeStart, hoverCell]);

  const selectedSet = useMemo(() => new Set(selectedCells), [selectedCells]);

  const handleCellClick = useCallback((idx: number) => {
    if (rangeStart === null) {
      // First click — start the range
      setRangeStart(idx);
    } else {
      // Second click — complete the range
      const lo = Math.min(rangeStart, idx);
      const hi = Math.max(rangeStart, idx);
      const cells: number[] = [];
      for (let i = lo; i <= hi; i++) cells.push(i);
      onChange(cells);
      setRangeStart(null);
      setHoverCell(null);
    }
  }, [rangeStart, onChange]);

  const handleClear = useCallback(() => {
    onChange([]);
    setRangeStart(null);
    setHoverCell(null);
  }, [onChange]);

  const handleCancel = useCallback(() => {
    setRangeStart(null);
    setHoverCell(null);
  }, []);

  const isSelecting = rangeStart !== null;

  return (
    <div className="cell-range-selector">
      {/* Status bar */}
      <div className="cell-range-status">
        {isSelecting ? (
          <>
            <span className="cell-range-hint cell-range-hint--active">
              <span className="cell-range-pulse" />
              Click end cell
            </span>
            <button
              className="cell-range-action"
              onClick={handleCancel}
              type="button"
            >
              Cancel
            </button>
          </>
        ) : currentRange ? (
          <>
            <span className="cell-range-badges">
              <span className="cell-range-badge cell-range-badge--start">
                {cellLabels[currentRange.start] || `#${currentRange.start}`}
              </span>
              <span className="cell-range-arrow">&rarr;</span>
              <span className="cell-range-badge cell-range-badge--end">
                {cellLabels[currentRange.end] || `#${currentRange.end}`}
              </span>
              <span className="cell-range-count">
                {selectedCells.length} cell{selectedCells.length !== 1 ? 's' : ''}
              </span>
            </span>
            <button
              className="cell-range-action"
              onClick={handleClear}
              type="button"
            >
              Clear
            </button>
          </>
        ) : (
          <span className="cell-range-hint">
            Click a cell to start
          </span>
        )}
      </div>

      {/* Mini grid */}
      <div
        className={`cell-range-grid ${isSelecting ? 'selecting' : ''}`}
        style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
        onMouseLeave={() => { if (isSelecting) setHoverCell(null); }}
      >
        {Array.from({ length: totalCells }, (_, idx) => {
          const isSelected = selectedSet.has(idx);
          const isPreview = previewRange.has(idx);
          const isStart = rangeStart === idx;
          const takenInfo = takenByOther.get(idx);
          const isTaken = !!takenInfo;

          const isRangeStart = currentRange?.start === idx;
          const isRangeEnd = currentRange?.end === idx;

          let cellClass = 'cell-range-cell';
          if (isStart) cellClass += ' start-anchor';
          if (isSelected && !isSelecting) cellClass += ' selected';
          if (isPreview && isSelecting) cellClass += ' preview';
          if (isTaken) cellClass += ' taken';
          if (isRangeStart && !isSelecting) cellClass += ' range-start';
          if (isRangeEnd && !isSelecting) cellClass += ' range-end';

          const label = cellLabels[idx] || `${idx}`;
          // Truncate long labels
          const displayLabel = label.length > 8 ? label.slice(0, 7) + '\u2026' : label;

          return (
            <button
              key={idx}
              type="button"
              className={cellClass}
              title={`${label} (Cell ${idx})`}
              style={
                isTaken && !isSelected
                  ? { '--taken-color': takenInfo.color } as React.CSSProperties
                  : undefined
              }
              onClick={() => handleCellClick(idx)}
              onMouseEnter={() => { if (isSelecting) setHoverCell(idx); }}
            >
              <span className="cell-range-cell-label">{displayLabel}</span>
              {(isRangeStart || isRangeEnd) && !isSelecting && (
                <span className="cell-range-cell-endpoint">
                  {isRangeStart ? '\u25C0' : '\u25B6'}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
