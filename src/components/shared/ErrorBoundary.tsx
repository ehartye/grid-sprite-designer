/**
 * Error boundary that catches render-time exceptions
 * and displays a recovery UI instead of a white screen.
 *
 * Supports resetKeys: when any key changes, the error state auto-clears.
 * Supports onReset: called when the user clicks "Try Again".
 */

import React, { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  /** When any value in this array changes, the error state auto-clears. */
  resetKeys?: unknown[];
  /** Called when the user clicks "Try Again". Use to dispatch state resets. */
  onReset?: () => void;
  /** Fallback label for the section name in the error message. */
  sectionLabel?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };
  private prevResetKeys: unknown[] | undefined;

  constructor(props: Props) {
    super(props);
    this.prevResetKeys = props.resetKeys;
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary] Uncaught render error:', error, info.componentStack);
  }

  componentDidUpdate(prevProps: Props) {
    if (this.state.hasError && this.props.resetKeys) {
      const changed = !prevProps.resetKeys ||
        this.props.resetKeys.length !== prevProps.resetKeys.length ||
        this.props.resetKeys.some((key, i) => key !== prevProps.resetKeys![i]);
      if (changed) {
        this.setState({ hasError: false, error: null });
      }
    }
  }

  private handleReset = () => {
    this.props.onReset?.();
    this.setState({ hasError: false, error: null });
  };

  private handleReload = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const label = this.props.sectionLabel ?? 'this section';

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
          An unexpected error occurred while rendering {label}.
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
