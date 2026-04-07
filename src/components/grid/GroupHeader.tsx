/**
 * Group header rendered above grouped cells in the review grid.
 * Shows group name and an expandable feedback text input.
 */

import { useState } from 'react';

interface GroupHeaderProps {
  groupName: string;
  feedback: string;
  onFeedbackChange: (value: string) => void;
}

export function GroupHeader({ groupName, feedback, onFeedbackChange }: GroupHeaderProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="group-header">
      <div className="group-header-row">
        <span className="group-header-name">{groupName}</span>
        <button
          className={`btn btn-xs ${feedback.trim() ? 'btn-accent' : ''}`}
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? 'Hide' : feedback.trim() ? 'Edit Feedback' : 'Add Feedback'}
        </button>
      </div>
      {expanded && (
        <textarea
          className="group-feedback-input"
          value={feedback}
          onChange={(e) => onFeedbackChange(e.target.value)}
          placeholder={`Feedback for ${groupName} group...`}
          rows={2}
        />
      )}
    </div>
  );
}
