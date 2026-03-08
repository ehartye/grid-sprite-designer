/**
 * Top-level error boundary that catches render-time exceptions
 * and displays a recovery UI instead of a white screen.
 */

import React, { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary] Uncaught render error:', error, info.componentStack);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  private handleReload = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '60vh',
          padding: '2rem',
          textAlign: 'center',
          color: 'var(--text)',
          fontFamily: 'var(--font-ui)',
        }}
      >
        <h1
          style={{
            fontSize: '1.5rem',
            fontFamily: 'var(--font-display)',
            color: 'var(--danger)',
            marginBottom: '0.75rem',
          }}
        >
          Something went wrong
        </h1>

        <p
          style={{
            color: 'var(--text-secondary)',
            maxWidth: '480px',
            lineHeight: 1.5,
            marginBottom: '1.5rem',
          }}
        >
          An unexpected error occurred while rendering the application.
        </p>

        {this.state.error && (
          <pre
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              padding: '1rem',
              maxWidth: '600px',
              width: '100%',
              overflow: 'auto',
              fontSize: '0.8rem',
              color: 'var(--text-muted)',
              marginBottom: '1.5rem',
              textAlign: 'left',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            {this.state.error.message}
          </pre>
        )}

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button className="btn" onClick={this.handleReset}>
            Try Again
          </button>
          <button className="btn btn-primary" onClick={this.handleReload}>
            Reload
          </button>
        </div>
      </div>
    );
  }
}
