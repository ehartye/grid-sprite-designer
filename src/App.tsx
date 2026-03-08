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

import { useRunWorkflow } from './hooks/useRunWorkflow';
import { extractSprites } from './lib/spriteExtractor';
import { getBuildingGridConfig, getTerrainGridConfig, getBackgroundGridConfig, type BuildingGridSize, type TerrainGridSize, type BackgroundGridSize } from './lib/gridConfig';

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
        if (!res.ok) return;
        const data = await res.json();

        // Restore sprite type if saved
        const spriteType = data.spriteType || 'character';
        if (spriteType !== 'character') {
          dispatch({ type: 'SET_SPRITE_TYPE', spriteType });
        }

        if (spriteType === 'building' && data.gridSize) {
          // Restore building config state
          const spriteLabels = data.sprites?.map((s: any) => s.label) || [];
          dispatch({
            type: 'SET_BUILDING',
            building: {
              name: data.content?.name || '',
              description: data.content?.description || '',
              details: '',
              colorNotes: '',
              styleNotes: '',
              cellGuidance: '',
              gridSize: data.gridSize,
              cellLabels: spriteLabels,
            },
          });
        } else if (spriteType === 'terrain' && data.gridSize) {
          const spriteLabels = data.sprites?.map((s: any) => s.label) || [];
          dispatch({
            type: 'SET_TERRAIN',
            terrain: {
              name: data.content?.name || '',
              description: data.content?.description || '',
              colorNotes: '',
              styleNotes: '',
              tileGuidance: '',
              gridSize: data.gridSize,
              cellLabels: spriteLabels,
            },
          });
        } else if (spriteType === 'background' && data.gridSize) {
          const spriteLabels = data.sprites?.map((s: any) => s.label) || [];
          dispatch({
            type: 'SET_BACKGROUND',
            background: {
              name: data.content?.name || '',
              description: data.content?.description || '',
              colorNotes: '',
              styleNotes: '',
              layerGuidance: '',
              bgMode: data.gridSize.startsWith('1x') ? 'parallax' : 'scene',
              gridSize: data.gridSize,
              cellLabels: spriteLabels,
            },
          });
        } else if (data.content) {
          dispatch({ type: 'SET_CHARACTER', character: data.content });
        }
        const mimeType = data.filledGridMimeType || 'image/png';
        if (data.filledGridImage) {
          dispatch({
            type: 'GENERATE_COMPLETE',
            filledGridImage: data.filledGridImage,
            filledGridMimeType: mimeType,
            geminiText: data.geminiText || '',
          });

          // Use the correct extraction config based on sprite type
          let extractionConfig: Parameters<typeof extractSprites>[2] = {};

          if (spriteType === 'building' && data.gridSize) {
            const spriteLabels = data.sprites?.map((s: any) => s.label) || [];
            const gridConfig = getBuildingGridConfig(data.gridSize as BuildingGridSize, spriteLabels);
            extractionConfig = {
              gridOverride: {
                cols: gridConfig.cols,
                rows: gridConfig.rows,
                totalCells: gridConfig.totalCells,
                cellLabels: gridConfig.cellLabels,
              },
            };
          } else if (spriteType === 'terrain' && data.gridSize) {
            const spriteLabels = data.sprites?.map((s: any) => s.label) || [];
            const gridConfig = getTerrainGridConfig(data.gridSize as TerrainGridSize, spriteLabels);
            extractionConfig = {
              gridOverride: {
                cols: gridConfig.cols,
                rows: gridConfig.rows,
                totalCells: gridConfig.totalCells,
                cellLabels: gridConfig.cellLabels,
              },
            };
          } else if (spriteType === 'background' && data.gridSize) {
            const spriteLabels = data.sprites?.map((s: any) => s.label) || [];
            const gridConfig = getBackgroundGridConfig(data.gridSize as BackgroundGridSize, spriteLabels);
            extractionConfig = {
              gridOverride: {
                cols: gridConfig.cols,
                rows: gridConfig.rows,
                totalCells: gridConfig.totalCells,
                cellLabels: gridConfig.cellLabels,
              },
            };
          }

          const sprites = await extractSprites(data.filledGridImage, mimeType, extractionConfig);
          dispatch({ type: 'EXTRACTION_COMPLETE', sprites });
        } else if (data.sprites && data.sprites.length > 0) {
          dispatch({ type: 'EXTRACTION_COMPLETE', sprites: data.sprites });
        }
        dispatch({ type: 'SET_HISTORY_ID', id: id! });
      } catch (err) {
        console.warn('Failed to restore last session:', err);
      }
    })();
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
    if (state.step === 'run-active' && run?.active) {
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
                {run?.active && (
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
                {run?.active && (
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
            {state.step === 'run-active' && run?.active && (
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
      <AppContent />
    </AppProvider>
  );
}
