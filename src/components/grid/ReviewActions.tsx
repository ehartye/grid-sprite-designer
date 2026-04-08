import { SidebarGroup } from './SidebarGroup';

export interface ReviewActionsProps {
  versionInfo: { version: number; parentId: number | null; childIds: number[] } | null;
  onNavigateVersion: (targetId: number) => void;
  onExportSheet: () => void;
  onExportIndividual: () => void;
  onAddSheet: () => void;
  onFeedbackOpen: () => void;
  onBack: () => void;
}

export function ReviewActions({
  versionInfo,
  onNavigateVersion,
  onExportSheet,
  onExportIndividual,
  onAddSheet,
  onFeedbackOpen,
  onBack,
}: ReviewActionsProps) {
  return (
    <>
      {/* ── Version Bar ── */}
      {versionInfo && (versionInfo.parentId || versionInfo.childIds.length > 0 || versionInfo.version > 1) && (
        <div className="version-bar">
          <span className="version-label">v{versionInfo.version}</span>
          <div className="version-nav">
            {versionInfo.parentId && (
              <button
                className="version-nav-btn"
                onClick={() => onNavigateVersion(versionInfo.parentId!)}
                title="Load previous version"
              >
                &larr; prev
              </button>
            )}
            {versionInfo.childIds.map((childId) => (
              <button
                key={childId}
                className="version-nav-btn"
                onClick={() => onNavigateVersion(childId)}
                title="Load regenerated version"
              >
                next &rarr;
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Actions ── */}
      <SidebarGroup label="Actions" defaultOpen={true}>
        <div className="sidebar-section">
          <div className="export-bar">
            <button className="btn btn-primary w-full" onClick={onExportSheet}>
              Export Sprite Sheet
            </button>
            <button className="btn w-full" onClick={onExportIndividual}>
              Export Individual PNGs
            </button>
          </div>
        </div>

        <div className="sidebar-section">
          <div className="export-bar">
            <button className="btn w-full" onClick={onAddSheet}>
              Add Sheet
            </button>
            <button className="btn w-full" onClick={onFeedbackOpen}>
              Feedback &amp; Regenerate
            </button>
          </div>
        </div>

        <div className="sidebar-section">
          <button
            className="btn w-full"
            style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}
            onClick={onBack}
          >
            &larr; Back to Configure
          </button>
        </div>
      </SidebarGroup>
    </>
  );
}
