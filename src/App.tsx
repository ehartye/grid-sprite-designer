/**
 * Root application component for the Grid Sprite Designer.
 * Renders the correct view based on the current workflow step
 * and the active tab (Designer / Gallery).
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { AppProvider, useAppContext } from './context/AppContext';
import { AppHeader, AppTab } from './components/layout/AppHeader';
import { UnifiedConfigPanel } from './components/config/UnifiedConfigPanel';
import { SpriteReview } from './components/grid/SpriteReview';
import { GeneratingOverlay } from './components/shared/GeneratingOverlay';
import { StatusBanner } from './components/shared/StatusBanner';
import { AnimationPreview } from './components/preview/AnimationPreview';
import { GalleryPage } from './components/gallery/GalleryPage';
import { AdminPage } from './components/admin/AdminPage';

import { ErrorBoundary } from './components/shared/ErrorBoundary';
import { useRunWorkflow } from './hooks/useRunWorkflow';
import { loadGenerationIntoState } from './lib/loadGeneration';

function AppContent() {
  const { state, dispatch } = useAppContext();
  const [tab, setTab] = useState<AppTab>('designer');
  const restoredRef = useRef(false);

  // Restore last session from DB on mount
  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;

    (async () => {
      try {
        const stateRes = await fetch('/api/state/lastHistoryId');
        const { value } = await stateRes.json();
        const id = value ? Number(value) : null;
        if (!id || isNaN(id)) return;

        const res = await fetch(`/api/history/${id}`);
        if (!res.ok) {
          // History entry no longer exists — clear the stale reference
          fetch('/api/state/lastHistoryId', { method: 'DELETE' }).catch(() => {});
          return;
        }
        const data = await res.json();

        await loadGenerationIntoState(data, dispatch, { historyId: id });
      } catch (err) {
        dispatch({ type: 'SET_STATUS', message: 'Failed to restore last session', statusType: 'warning' });
      }
    })();
  }, [dispatch]);

  // Global unhandled promise rejection handler
  useEffect(() => {
    const handler = (event: PromiseRejectionEvent) => {
      const message = event.reason instanceof Error ? event.reason.message : String(event.reason);
      console.error('[Unhandled Rejection]', event.reason);
      dispatch({ type: 'SET_STATUS', message: `Unhandled error: ${message}`, statusType: 'error' });
    };
    window.addEventListener('unhandledrejection', handler);
    return () => window.removeEventListener('unhandledrejection', handler);
  }, [dispatch]);

  const { generateCurrentGrid, proceedToNextGrid, skipCurrentGrid, cancelRun, run } = useRunWorkflow();

  // Auto-switch to designer tab when a run becomes active
  useEffect(() => {
    if (state.step === 'run-active' && tab !== 'designer') {
      setTab('designer');
    }
  }, [state.step, tab]);

  // Auto-trigger generation when entering run-active step
  const runTriggerRef = useRef<string | null>(null);
  useEffect(() => {
    if (state.step === 'run-active' && run) {
      const key = `${run.currentGridIndex}`;
      if (runTriggerRef.current !== key) {
        runTriggerRef.current = key;
        generateCurrentGrid();
      }
    } else {
      runTriggerRef.current = null;
    }
  }, [state.step, run, generateCurrentGrid]);

  const switchToDesigner = useCallback(() => {
    setTab('designer');
  }, []);

  return (
    <>
      <AppHeader tab={tab} onTabChange={setTab} />

      <div className="app-layout">
        {tab === 'designer' && (
          <>
            {state.step === 'configure' && <UnifiedConfigPanel />}
            {state.step === 'generating' && (
              <>
                <GeneratingOverlay />
                {run && (
                  <div style={{ textAlign: 'center', marginTop: 8 }}>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                      Run: Grid {(run.currentGridIndex ?? 0) + 1} of {run.selectedGridLinks.length}
                      {' '}&mdash; {run.selectedGridLinks[run.currentGridIndex]?.gridName}
                    </p>
                    <button className="btn btn-sm btn-danger" style={{ marginTop: 8 }} onClick={cancelRun}>
                      Cancel Run
                    </button>
                  </div>
                )}
              </>
            )}
            {state.step === 'review' && (
              <>
                <SpriteReview />
                {run && (
                  <div className="run-review-bar">
                    <span className="run-review-progress">
                      Grid {(run.currentGridIndex ?? 0) + 1} of {run.selectedGridLinks.length}
                      {' '}&mdash; {run.selectedGridLinks[run.currentGridIndex]?.gridName}
                    </span>
                    <div className="run-review-actions">
                      <button className="btn btn-sm" onClick={skipCurrentGrid}>
                        Skip
                      </button>
                      {run.currentGridIndex < run.selectedGridLinks.length - 1 ? (
                        <button className="btn btn-sm btn-primary" onClick={proceedToNextGrid}>
                          Next Grid
                        </button>
                      ) : (
                        <button className="btn btn-sm btn-primary" onClick={proceedToNextGrid}>
                          Finish Run
                        </button>
                      )}
                      <button className="btn btn-sm btn-danger" onClick={cancelRun}>
                        Cancel Run
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
            {state.step === 'preview' && <AnimationPreview />}
            {state.step === 'run-active' && run && (
              <div className="config-panel" style={{ textAlign: 'center' }}>
                <h2>Preparing Grid</h2>
                <p style={{ color: 'var(--text-secondary)', marginBottom: 16 }}>
                  Grid {(run.currentGridIndex ?? 0) + 1} of {run.selectedGridLinks.length}
                  {' '}&mdash; {run.selectedGridLinks[run.currentGridIndex]?.gridName}
                </p>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  Starting generation...
                </p>
                <button
                  className="btn btn-danger"
                  style={{ marginTop: 20 }}
                  onClick={cancelRun}
                >
                  Cancel Run
                </button>
              </div>
            )}
          </>
        )}

        {tab === 'gallery' && (
          <GalleryPage onSwitchToDesigner={switchToDesigner} />
        )}

        {tab === 'admin' && <AdminPage />}
      </div>

      <StatusBanner />
    </>
  );
}

export default function App() {
  return (
    <AppProvider>
      <ErrorBoundary>
        <AppContent />
      </ErrorBoundary>
    </AppProvider>
  );
}
