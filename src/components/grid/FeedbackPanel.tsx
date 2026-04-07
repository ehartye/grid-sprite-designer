/**
 * Feedback summary side panel.
 * Desktop: collapsible panel on the right.
 * Mobile: full-screen bottom sheet.
 * Shows global feedback, group feedback, per-cell status, and regenerate button.
 */

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
}: FeedbackPanelProps) {
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

  return (
    <div className={`feedback-panel ${isMobile ? 'bottom-sheet' : 'side-panel'}`}>
      <div className="feedback-panel-header">
        <h3>Feedback</h3>
        <button className="btn btn-xs" onClick={onClose}>Close</button>
      </div>

      <div className="feedback-panel-body">
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

        {/* Groups */}
        {cellGroups.length > 0 && (
          <div className="feedback-section">
            <h4>Groups</h4>
            {cellGroups.map((group) => (
              <div key={group.name} className="feedback-group-entry">
                <label>{group.name}</label>
                <textarea
                  value={feedbackState.groups[group.name]?.feedback || ''}
                  onChange={(e) => updateGroup(group.name, e.target.value)}
                  placeholder={`Feedback for ${group.name}...`}
                  rows={2}
                />
              </div>
            ))}
          </div>
        )}

        {/* Cells */}
        <div className="feedback-section">
          <h4>Cells</h4>
          <div className="feedback-cell-list">
            {cellLabels.map((label, idx) => {
              const cell = feedbackState.cells[idx];
              const status = cell?.signedOff ? 'approved' : cell?.feedback?.trim() ? 'feedback' : 'none';
              return (
                <div key={idx} className={`feedback-cell-entry status-${status}`}>
                  <span className="feedback-cell-status">
                    {status === 'approved' ? '\u2705' : status === 'feedback' ? '\uD83D\uDCAC' : '\u25CB'}
                  </span>
                  <span className="feedback-cell-label">{label}</span>
                  {status === 'approved' && <span className="feedback-cell-tag">Signed Off</span>}
                  {status === 'feedback' && (
                    <span className="feedback-cell-preview" title={cell?.feedback}>
                      {cell?.feedback?.slice(0, 40)}...
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="feedback-panel-footer">
        <button
          className="btn btn-primary w-full"
          onClick={onRegenerate}
          disabled={regenerating || !hasFeedback(feedbackState)}
        >
          {regenerating ? 'Regenerating...' : 'Regenerate with Feedback'}
        </button>
      </div>
    </div>
  );
}
