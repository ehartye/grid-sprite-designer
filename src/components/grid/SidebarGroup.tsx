/**
 * Collapsible sidebar section group.
 * Groups related controls under a single header with expand/collapse toggle.
 */

import React, { useState } from 'react';

interface SidebarGroupProps {
  label: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

export function SidebarGroup({ label, defaultOpen = true, children }: SidebarGroupProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className={`sidebar-group ${open ? 'open' : 'collapsed'}`}>
      <button
        className="sidebar-group-header"
        onClick={() => setOpen(!open)}
        type="button"
      >
        <span className="sidebar-group-label">{label}</span>
        <span className={`sidebar-group-chevron ${open ? 'open' : ''}`}>&#x25B8;</span>
      </button>
      {open && (
        <div className="sidebar-group-body">
          {children}
        </div>
      )}
    </div>
  );
}
