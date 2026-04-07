/**
 * Kebab menu dropdown for sprite cells in review mode.
 * Replaces the three individual hover buttons (zoom, mirror, star)
 * with a single contextual menu adding sign-off and feedback actions.
 */

import React, { useState, useRef, useEffect } from 'react';

interface CellContextMenuProps {
  cellIndex: number;
  isMirrored: boolean;
  isThumbnail: boolean;
  isSignedOff: boolean;
  hasFeedback: boolean;
  onMirrorToggle: () => void;
  onThumbnailSet: () => void;
  onZoomClick: () => void;
  onSignOffToggle: () => void;
  onFeedbackClick: () => void;
}

export function CellContextMenu({
  cellIndex: _cellIndex,
  isMirrored,
  isThumbnail,
  isSignedOff,
  hasFeedback,
  onMirrorToggle,
  onThumbnailSet,
  onZoomClick,
  onSignOffToggle,
  onFeedbackClick,
}: CellContextMenuProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleAction = (action: () => void) => (e: React.MouseEvent) => {
    e.stopPropagation();
    action();
    setOpen(false);
  };

  return (
    <div className="cell-context-menu" ref={menuRef}>
      <button
        className={`cell-menu-btn ${open ? 'active' : ''}`}
        onClick={(e) => {
          e.stopPropagation();
          setOpen(!open);
        }}
        title="Cell actions"
      >
        &#x22EE;
      </button>

      {open && (
        <div className={`cell-menu-dropdown ${isMobile ? 'bottom-sheet' : ''}`}>
          <button className="cell-menu-item" onClick={handleAction(onZoomClick)}>
            <span className="cell-menu-icon">&#x1F50D;</span>
            Zoom / Inspect
          </button>
          <button className="cell-menu-item" onClick={handleAction(onMirrorToggle)}>
            <span className="cell-menu-icon">&#x21c4;</span>
            Mirror
            {isMirrored && <span className="cell-menu-check">&#x2713;</span>}
          </button>
          <button className="cell-menu-item" onClick={handleAction(onThumbnailSet)}>
            <span className="cell-menu-icon">{isThumbnail ? '\u2605' : '\u2606'}</span>
            Gallery Thumbnail
            {isThumbnail && <span className="cell-menu-check">&#x2713;</span>}
          </button>
          <div className="cell-menu-divider" />
          <button className="cell-menu-item" onClick={handleAction(onSignOffToggle)}>
            <span className="cell-menu-icon">&#x2705;</span>
            Sign Off
            {isSignedOff && <span className="cell-menu-check">&#x2713;</span>}
          </button>
          <button className="cell-menu-item" onClick={handleAction(onFeedbackClick)}>
            <span className="cell-menu-icon">&#x1F4AC;</span>
            Add Feedback
            {hasFeedback && <span className="cell-menu-badge">!</span>}
          </button>
        </div>
      )}
    </div>
  );
}
