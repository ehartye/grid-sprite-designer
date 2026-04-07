/**
 * Kebab menu dropdown for sprite cells in review mode.
 * Replaces the three individual hover buttons (zoom, mirror, star)
 * with a single contextual menu adding sign-off and feedback actions.
 */

import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

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
  cellIndex,
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
  const btnRef = useRef<HTMLButtonElement>(null);
  const [dropdownPos, setDropdownPos] = useState<{ top: number; right: number } | null>(null);
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close on outside click or Escape key
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        menuRef.current && !menuRef.current.contains(target) &&
        dropdownRef.current && !dropdownRef.current.contains(target)
      ) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', handler);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const handleAction = (action: () => void) => (e: React.MouseEvent) => {
    e.stopPropagation();
    action();
    setOpen(false);
  };

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setDropdownPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
    }
    setOpen(!open);
  };

  return (
    <div className="cell-context-menu" ref={menuRef} data-cell={cellIndex}>
      <button
        ref={btnRef}
        className={`cell-menu-btn ${open ? 'active' : ''}`}
        onClick={handleToggle}
        title="Cell actions"
      >
        &#x22EE;
      </button>

      {open && createPortal(
        <div
          ref={dropdownRef}
          className={`cell-menu-dropdown ${isMobile ? 'bottom-sheet' : ''}`}
          style={!isMobile && dropdownPos ? { top: dropdownPos.top, right: dropdownPos.right } : undefined}
        >
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
        </div>,
        document.body,
      )}
    </div>
  );
}
