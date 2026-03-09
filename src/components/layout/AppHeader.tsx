/**
 * Application header bar.
 * Shows title, tab navigation (Designer / Gallery),
 * test-connection button, and contextual actions.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { useAppState, useAppDispatch } from '../../context/AppContext';
import { testConnection } from '../../api/geminiClient';

export type AppTab = 'designer' | 'gallery' | 'admin';

interface AppHeaderProps {
  tab: AppTab;
  onTabChange: (tab: AppTab) => void;
}

export function AppHeader({ tab, onTabChange }: AppHeaderProps) {
  const state = useAppState();
  const dispatch = useAppDispatch();
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; error?: string } | null>(null);
  const clearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (clearTimer.current) clearTimeout(clearTimer.current);
    };
  }, []);

  const handleTestConnection = useCallback(async () => {
    setTesting(true);
    setTestResult(null);
    if (clearTimer.current) clearTimeout(clearTimer.current);
    try {
      const result = await testConnection(state.model);
      setTestResult(result);
      clearTimer.current = setTimeout(() => setTestResult(null), 4000);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setTestResult({ success: false, error: message });
      clearTimer.current = setTimeout(() => setTestResult(null), 4000);
    } finally {
      setTesting(false);
    }
  }, [state.model]);

  const showNewSprite = state.step === 'review' || state.step === 'preview' || tab === 'gallery';

  const handleNewSprite = useCallback(() => {
    if (state.step !== 'configure') {
      if (!window.confirm('Start a new sprite? Current work will be lost.')) return;
    }
    dispatch({ type: 'RESET' });
    onTabChange('designer');
  }, [dispatch, onTabChange, state.step]);

  return (
    <header className="app-header">
      <div className="header-branding">
        <h1 className="app-title">Grid Sprite Designer</h1>

        <nav className="header-tabs">
          <button
            className={`header-tab${tab === 'designer' ? ' active' : ''}`}
            onClick={() => onTabChange('designer')}
          >
            Designer
          </button>
          <button
            className={`header-tab${tab === 'gallery' ? ' active' : ''}`}
            onClick={() => onTabChange('gallery')}
          >
            Gallery
          </button>
          <button
            className={`header-tab${tab === 'admin' ? ' active' : ''}`}
            onClick={() => onTabChange('admin')}
          >
            Admin
          </button>
        </nav>
      </div>

      <div className="header-controls">
        {testResult && (
          <span
            style={{
              fontSize: '0.75rem',
              fontWeight: 600,
              color: testResult.success ? 'var(--success)' : 'var(--error)',
            }}
          >
            {testResult.success ? 'Connected' : testResult.error || 'Failed'}
          </span>
        )}

        <button
          className="btn btn-sm"
          onClick={handleTestConnection}
          disabled={testing}
        >
          {testing ? 'Testing...' : 'Test Connection'}
        </button>

        {showNewSprite && (
          <button className="btn btn-sm btn-danger" onClick={handleNewSprite}>
            New Sprite
          </button>
        )}
      </div>
    </header>
  );
}
