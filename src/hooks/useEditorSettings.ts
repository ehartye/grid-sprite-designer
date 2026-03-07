/**
 * Persist and restore editor settings (chroma, color strikes, mirror, swap order)
 * per generation via the /api/history/:id/settings endpoints.
 */

import { useCallback, useEffect, useRef } from 'react';

type RGB = [number, number, number];

export interface EditorSettings {
  chromaEnabled: boolean;
  chromaTolerance: number;
  struckColors: RGB[];
  mirroredCells: number[];
  cellOrder: number[];
  aaInset: number;
  posterizeBits: number;
  posterizeOutput: boolean;
  edgeRecolorPasses: number;
  recolorSensitivity: number;
  defringeCore: number;
}

const DEFAULTS: EditorSettings = {
  chromaEnabled: false,
  chromaTolerance: 80,
  struckColors: [],
  mirroredCells: [],
  cellOrder: [],
  aaInset: 3,
  posterizeBits: 4,
  posterizeOutput: false,
  edgeRecolorPasses: 0,
  recolorSensitivity: 50,
  defringeCore: 240,
};

export function useEditorSettings(historyId: number | null) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastJsonRef = useRef<string>('');

  const save = useCallback(
    (settings: EditorSettings) => {
      if (!historyId) return;
      const json = JSON.stringify(settings);
      if (json === lastJsonRef.current) return;
      lastJsonRef.current = json;

      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        fetch(`/api/history/${historyId}/settings`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: json,
        }).catch((err) => console.error('Failed to save editor settings:', err));
      }, 500);
    },
    [historyId],
  );

  const load = useCallback(async (): Promise<EditorSettings | null> => {
    if (!historyId) return null;
    try {
      const resp = await fetch(`/api/history/${historyId}/settings`);
      const data = await resp.json();
      if (!data) return null;
      const merged = { ...DEFAULTS, ...data };
      lastJsonRef.current = JSON.stringify(merged);
      return merged;
    } catch {
      return null;
    }
  }, [historyId]);

  // Flush any pending debounced save on page unload
  useEffect(() => {
    const flush = () => {
      if (timerRef.current && historyId && lastJsonRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
        fetch(`/api/history/${historyId}/settings`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: lastJsonRef.current,
          keepalive: true,
        }).catch((err) => console.error('Failed to flush editor settings on unload:', err));
      }
    };
    window.addEventListener('beforeunload', flush);
    return () => window.removeEventListener('beforeunload', flush);
  }, [historyId]);

  return { save, load };
}
