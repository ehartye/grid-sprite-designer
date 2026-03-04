/**
 * Root application component for the Grid Sprite Designer.
 * Renders the correct view based on the current workflow step
 * and the active tab (Designer / Gallery).
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { AppProvider, useAppContext } from './context/AppContext';
import { AppHeader, AppTab } from './components/layout/AppHeader';
import { ConfigPanel } from './components/config/ConfigPanel';
import { BuildingConfigPanel } from './components/config/BuildingConfigPanel';
import { TerrainConfigPanel } from './components/config/TerrainConfigPanel';
import { BackgroundConfigPanel } from './components/config/BackgroundConfigPanel';
import { SpriteReview } from './components/grid/SpriteReview';
import { GeneratingOverlay } from './components/shared/GeneratingOverlay';
import { StatusBanner } from './components/shared/StatusBanner';
import { AnimationPreview } from './components/preview/AnimationPreview';
import { GalleryPage } from './components/gallery/GalleryPage';
import { AdminPage } from './components/admin/AdminPage';
import { RunBuilderPage } from './components/run/RunBuilderPage';
import { extractSprites } from './lib/spriteExtractor';
import { CONFIG_2K } from './lib/templateGenerator';
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
              name: data.character?.name || '',
              description: data.character?.description || '',
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
              name: data.character?.name || '',
              description: data.character?.description || '',
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
              name: data.character?.name || '',
              description: data.character?.description || '',
              colorNotes: '',
              styleNotes: '',
              layerGuidance: '',
              bgMode: data.gridSize.startsWith('1x') ? 'parallax' : 'scene',
              gridSize: data.gridSize,
              cellLabels: spriteLabels,
            },
          });
        } else if (data.character) {
          dispatch({ type: 'SET_CHARACTER', character: data.character });
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
          let extractionConfig: Parameters<typeof extractSprites>[2] = {
            headerH: CONFIG_2K.headerH,
            border: CONFIG_2K.border,
            templateCellW: CONFIG_2K.cellW,
            templateCellH: CONFIG_2K.cellH,
          };

          if (spriteType === 'building' && data.gridSize) {
            const spriteLabels = data.sprites?.map((s: any) => s.label) || [];
            const gridConfig = getBuildingGridConfig(data.gridSize as BuildingGridSize, spriteLabels);
            const templateParams = gridConfig.templates['2K'];
            extractionConfig = {
              headerH: templateParams.headerH,
              border: templateParams.border,
              templateCellW: templateParams.cellW,
              templateCellH: templateParams.cellH,
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
            const templateParams = gridConfig.templates['2K'];
            extractionConfig = {
              headerH: templateParams.headerH,
              border: templateParams.border,
              templateCellW: templateParams.cellW,
              templateCellH: templateParams.cellH,
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
            const templateParams = gridConfig.templates['2K'];
            extractionConfig = {
              headerH: templateParams.headerH,
              border: templateParams.border,
              templateCellW: templateParams.cellW,
              templateCellH: templateParams.cellH,
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
      } catch {
        // Silently fail — user just sees configure screen
      }
    })();
  }, [dispatch]);

  // Auto-switch to designer tab when a run becomes active
  useEffect(() => {
    if (state.step === 'run-active' && tab !== 'designer') {
      setTab('designer');
    }
  }, [state.step, tab]);

  const switchToDesigner = useCallback(() => {
    setTab('designer');
  }, []);

  return (
    <>
      <AppHeader tab={tab} onTabChange={setTab} />

      <div className="app-layout">
        {tab === 'designer' && (
          <>
            {state.step === 'configure' && (() => {
              switch (state.spriteType) {
                case 'building': return <BuildingConfigPanel />;
                case 'terrain': return <TerrainConfigPanel />;
                case 'background': return <BackgroundConfigPanel />;
                default: return <ConfigPanel />;
              }
            })()}
            {state.step === 'generating' && <GeneratingOverlay />}
            {state.step === 'review' && <SpriteReview />}
            {state.step === 'preview' && <AnimationPreview />}
            {state.step === 'run-active' && state.run && (
              <div className="config-panel" style={{ textAlign: 'center' }}>
                <h2>Run in Progress</h2>
                <p style={{ color: 'var(--text-secondary)', marginBottom: 16 }}>
                  Grid {state.run.currentGridIndex + 1} of {state.run.selectedGridLinks.length}
                </p>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  Waiting for generation orchestration...
                </p>
                <button
                  className="btn btn-danger"
                  style={{ marginTop: 20 }}
                  onClick={() => dispatch({ type: 'END_RUN' })}
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

        {tab === 'run' && <RunBuilderPage />}

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
