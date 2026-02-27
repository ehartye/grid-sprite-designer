/**
 * Root application component for the Grid Sprite Designer.
 * Renders the correct view based on the current workflow step.
 */

import React from 'react';
import { AppProvider, useAppContext } from './context/AppContext';
import { AppHeader } from './components/layout/AppHeader';
import { ConfigPanel } from './components/config/ConfigPanel';
import { SpriteReview } from './components/grid/SpriteReview';
import { GeneratingOverlay } from './components/shared/GeneratingOverlay';
import { StatusBanner } from './components/shared/StatusBanner';
import { AnimationPreview } from './components/preview/AnimationPreview';

function AppContent() {
  const { state } = useAppContext();

  return (
    <>
      <AppHeader />

      {state.step === 'configure' && <ConfigPanel />}
      {state.step === 'generating' && <GeneratingOverlay />}
      {state.step === 'review' && <SpriteReview />}
      {state.step === 'preview' && <AnimationPreview />}

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
