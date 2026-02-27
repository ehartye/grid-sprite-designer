/**
 * Root application component for the Grid Sprite Designer.
 * Renders the correct view based on the current workflow step
 * and the active tab (Designer / Gallery).
 */

import React, { useState, useCallback } from 'react';
import { AppProvider, useAppContext } from './context/AppContext';
import { AppHeader, AppTab } from './components/layout/AppHeader';
import { ConfigPanel } from './components/config/ConfigPanel';
import { SpriteReview } from './components/grid/SpriteReview';
import { GeneratingOverlay } from './components/shared/GeneratingOverlay';
import { StatusBanner } from './components/shared/StatusBanner';
import { AnimationPreview } from './components/preview/AnimationPreview';
import { GalleryPage } from './components/gallery/GalleryPage';

function AppContent() {
  const { state } = useAppContext();
  const [tab, setTab] = useState<AppTab>('designer');

  const switchToDesigner = useCallback(() => {
    setTab('designer');
  }, []);

  return (
    <>
      <AppHeader tab={tab} onTabChange={setTab} />

      {tab === 'designer' && (
        <>
          {state.step === 'configure' && <ConfigPanel />}
          {state.step === 'generating' && <GeneratingOverlay />}
          {state.step === 'review' && <SpriteReview />}
          {state.step === 'preview' && <AnimationPreview />}
        </>
      )}

      {tab === 'gallery' && (
        <GalleryPage onSwitchToDesigner={switchToDesigner} />
      )}

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
