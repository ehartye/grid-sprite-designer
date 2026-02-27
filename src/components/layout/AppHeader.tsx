/**
 * Application header bar.
 * Shows title, test-connection button, and contextual actions.
 */

import React, { useState, useCallback } from 'react';
import { useAppContext } from '../../context/AppContext';
import { useGridWorkflow } from '../../hooks/useGridWorkflow';
import { testConnection } from '../../api/geminiClient';

export function AppHeader() {
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
    } catch (err: any) {
      setTestResult({ success: false, error: err.message });
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
