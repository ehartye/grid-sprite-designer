/**
 * Feedback summary side panel.
 * Desktop: collapsible panel on the right.
 * Mobile: full-screen bottom sheet.
 * Shows global feedback, group feedback, per-cell feedback inputs, and regenerate button.
 */

import { useState, useEffect, useRef } from 'react';
import type { FeedbackState } from '../../types/feedback';
import { hasFeedback } from '../../types/feedback';
import type { CellGroup } from '../../context/AppContext';

interface FeedbackPanelProps {
  open: boolean;
  onClose: () => void;
  feedbackState: FeedbackState;
  onFeedbackChange: (state: FeedbackState) => void;
  cellLabels: string[];
  cellGroups: CellGroup[];
  onRegenerate: () => void;
  regenerating: boolean;
  /** When set, auto-expand and scroll to this cell's feedback input */
  focusCellIndex?: number | null;
}

export function FeedbackPanel({
  open,
  onClose,
  feedbackState,
  onFeedbackChange,
  cellLabels,
  cellGroups,
  onRegenerate,
  regenerating,
  focusCellIndex,
}: FeedbackPanelProps) {
  const [expandedCell, setExpandedCell] = useState<number | null>(null);
  const cellRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const bodyRef = useRef<HTMLDivElement>(null);

  // When focusCellIndex changes and panel is open, expand and scroll to that cell
  useEffect(() => {
    if (!open || focusCellIndex == null) return;
    setExpandedCell(focusCellIndex);
    // Scroll after render
    requestAnimationFrame(() => {
      const el = cellRefs.current.get(focusCellIndex);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }, [open, focusCellIndex]);

  if (!open) return null;

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  const updateGlobal = (value: string) => {
    onFeedbackChange({ ...feedbackState, global: value });
  };

  const updateGroup = (groupName: string, value: string) => {
    onFeedbackChange({
      ...feedbackState,
      groups: { ...feedbackState.groups, [groupName]: { feedback: value } },
    });
  };

  const updateCellFeedback = (idx: number, value: string) => {
    const existing = feedbackState.cells[idx] || { signedOff: false, feedback: '' };
    onFeedbackChange({
      ...feedbackState,
      cells: { ...feedbackState.cells, [idx]: { ...existing, feedback: value } },
    });
  };

  const toggleCellSignOff = (idx: number) => {
    const existing = feedbackState.cells[idx] || { signedOff: false, feedback: '' };
    onFeedbackChange({
      ...feedbackState,
      cells: { ...feedbackState.cells, [idx]: { ...existing, signedOff: !existing.signedOff } },
    });
  };

  // Group cells by their group, track ungrouped
  const groupedIndices = new Set(cellGroups.flatMap(g => g.cells));

  return (
    <div className={`feedback-panel ${isMobile ? 'bottom-sheet' : 'side-panel'}`}>
      {isMobile && <div className="bottom-sheet-handle" />}
      <div className="feedback-panel-header">
        <h3>Feedback</h3>
        <button className="btn btn-xs" onClick={onClose}>Close</button>
      </div>

      <div className="feedback-panel-body" ref={bodyRef}>
        {/* Global */}
        <div className="feedback-section">
          <h4>Global Feedback</h4>
          <textarea
            value={feedbackState.global}
            onChange={(e) => updateGlobal(e.target.value)}
            placeholder="Overall feedback for the entire sheet..."
            rows={3}
          />
        </div>

        {/* Groups + their cells */}
        {cellGroups.map((group) => (
          <div key={group.name} className="feedback-section">
            <h4>{group.name}</h4>
            <textarea
              className="feedback-group-textarea"
              value={feedbackState.groups[group.name]?.feedback || ''}
              onChange={(e) => updateGroup(group.name, e.target.value)}
              placeholder={`Group-level feedback for ${group.name}...`}
              rows={2}
            />
            <div className="feedback-cell-list">
              {group.cells.map((cellIdx) => {
                const label = cellLabels[cellIdx];
                if (!label) return null;
                return renderCell(cellIdx, label);
              })}
            </div>
          </div>
        ))}

        {/* Ungrouped cells */}
        {(() => {
          const ungrouped = cellLabels
            .map((label, idx) => ({ label, idx }))
            .filter(({ idx }) => !groupedIndices.has(idx) && cellLabels[idx]);
          if (ungrouped.length === 0) return null;
          return (
            <div className="feedback-section">
              {cellGroups.length > 0 && <h4>Other Cells</h4>}
              {cellGroups.length === 0 && <h4>Cells</h4>}
              <div className="feedback-cell-list">
                {ungrouped.map(({ label, idx }) => renderCell(idx, label))}
              </div>
            </div>
          );
        })()}

        {/* Regenerate — flows after content, sticks to bottom when scrollable */}
        <div className="feedback-panel-action">
          <button
            className="btn btn-primary w-full"
            onClick={onRegenerate}
            disabled={regenerating || !hasFeedback(feedbackState)}
          >
            {regenerating ? 'Regenerating...' : 'Regenerate with Feedback'}
          </button>
        </div>
      </div>
    </div>
  );

  function renderCell(idx: number, label: string) {
    const cell = feedbackState.cells[idx];
    const isSignedOff = cell?.signedOff ?? false;
    const cellFeedback = cell?.feedback ?? '';
    const isExpanded = expandedCell === idx;
    const status = isSignedOff ? 'approved' : cellFeedback.trim() ? 'feedback' : 'none';

    return (
      <div
        key={idx}
        ref={(el) => { if (el) cellRefs.current.set(idx, el); }}
        className={`feedback-cell-entry status-${status}`}
      >
        <div
          className="feedback-cell-row"
          onClick={() => setExpandedCell(isExpanded ? null : idx)}
        >
          <span className="feedback-cell-status">
            {status === 'approved' ? '\u2705' : status === 'feedback' ? '\uD83D\uDCAC' : '\u25CB'}
          </span>
          <span className="feedback-cell-label">{label}</span>
          {isSignedOff && <span className="feedback-cell-tag">Signed Off</span>}
          {!isExpanded && cellFeedback.trim() && (
            <span className="feedback-cell-preview" title={cellFeedback}>
              {cellFeedback.length > 30 ? cellFeedback.slice(0, 30) + '...' : cellFeedback}
            </span>
          )}
          <span className={`feedback-cell-chevron ${isExpanded ? 'open' : ''}`}>&#x25B8;</span>
        </div>
        {isExpanded && (
          <div className="feedback-cell-expanded">
            <textarea
              value={cellFeedback}
              onChange={(e) => updateCellFeedback(idx, e.target.value)}
              placeholder={`Feedback for "${label}"...`}
              rows={2}
              autoFocus
            />
            <button
              className={`btn btn-xs ${isSignedOff ? 'btn-success' : ''}`}
              onClick={(e) => { e.stopPropagation(); toggleCellSignOff(idx); }}
              style={{ alignSelf: 'flex-start', marginTop: 4 }}
            >
              {isSignedOff ? '\u2705 Signed Off' : 'Sign Off'}
            </button>
          </div>
        )}
      </div>
    );
  }
}
