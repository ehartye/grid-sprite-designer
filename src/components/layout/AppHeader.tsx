/**
 * Application header bar.
 * Shows title, tab navigation (Designer / Gallery),
 * test-connection button, and contextual actions.
 */

import React, { useState, useCallback } from 'react';
import { useAppContext } from '../../context/AppContext';
import { useGridWorkflow } from '../../hooks/useGridWorkflow';
import { testConnection } from '../../api/geminiClient';

export type AppTab = 'designer' | 'gallery';

interface AppHeaderProps {
  tab: AppTab;
  onTabChange: (tab: AppTab) => void;
}

export function AppHeader({ tab, onTabChange }: AppHeaderProps) {
  const { state } = useAppContext();
  const { reset } = useGridWorkflow();
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; error?: string } | null>(null);

  const handleTestConnection = useCallback(async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await testConnection(state.model);
      setTestResult(result);
      setTimeout(() => setTestResult(null), 4000);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setTestResult({ success: false, error: message });
      setTimeout(() => setTestResult(null), 4000);
    } finally {
      setTesting(false);
    }
  }, [state.model]);

  const showNewCharacter = state.step === 'review' || state.step === 'preview';

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

        {showNewCharacter && (
          <button className="btn btn-sm btn-danger" onClick={reset}>
            New Character
          </button>
        )}
      </div>
    </header>
  );
}
