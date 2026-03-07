import { useState, useCallback } from 'react';

export interface ChromaKeySettings {
  chromaEnabled: boolean;
  chromaTolerance: number;
  edgeRecolorPasses: number;
  recolorSensitivity: number;
  defringeCore: number;
}

export interface ChromaKeyActions {
  setChromaEnabled: (v: boolean) => void;
  setChromaTolerance: (v: number) => void;
  setEdgeRecolorPasses: (v: number) => void;
  setRecolorSensitivity: (v: number) => void;
  setDefringeCore: (v: number) => void;
  resetChromaKey: () => void;
  restoreChromaKey: (settings: Partial<ChromaKeySettings>) => void;
}

const DEFAULTS: ChromaKeySettings = {
  chromaEnabled: false,
  chromaTolerance: 80,
  edgeRecolorPasses: 0,
  recolorSensitivity: 50,
  defringeCore: 240,
};

export function useChromaKeySettings(): ChromaKeySettings & ChromaKeyActions {
  const [chromaEnabled, setChromaEnabled] = useState(DEFAULTS.chromaEnabled);
  const [chromaTolerance, setChromaTolerance] = useState(DEFAULTS.chromaTolerance);
  const [edgeRecolorPasses, setEdgeRecolorPasses] = useState(DEFAULTS.edgeRecolorPasses);
  const [recolorSensitivity, setRecolorSensitivity] = useState(DEFAULTS.recolorSensitivity);
  const [defringeCore, setDefringeCore] = useState(DEFAULTS.defringeCore);

  const resetChromaKey = useCallback(() => {
    setChromaEnabled(DEFAULTS.chromaEnabled);
    setChromaTolerance(DEFAULTS.chromaTolerance);
    setEdgeRecolorPasses(DEFAULTS.edgeRecolorPasses);
    setRecolorSensitivity(DEFAULTS.recolorSensitivity);
    setDefringeCore(DEFAULTS.defringeCore);
  }, []);

  const restoreChromaKey = useCallback((settings: Partial<ChromaKeySettings>) => {
    if (settings.chromaEnabled !== undefined) setChromaEnabled(settings.chromaEnabled);
    if (settings.chromaTolerance !== undefined) setChromaTolerance(settings.chromaTolerance);
    if (settings.edgeRecolorPasses !== undefined) setEdgeRecolorPasses(settings.edgeRecolorPasses);
    if (settings.recolorSensitivity !== undefined) setRecolorSensitivity(settings.recolorSensitivity);
    if (settings.defringeCore !== undefined) setDefringeCore(settings.defringeCore);
  }, []);

  return {
    chromaEnabled, setChromaEnabled,
    chromaTolerance, setChromaTolerance,
    edgeRecolorPasses, setEdgeRecolorPasses,
    recolorSensitivity, setRecolorSensitivity,
    defringeCore, setDefringeCore,
    resetChromaKey,
    restoreChromaKey,
  };
}
