/**
 * Fixed-position status notification banner.
 * Color-coded by status type, auto-fades after 5 seconds.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAppContext } from '../../context/AppContext';

export function StatusBanner() {
  const { state, dispatch } = useAppContext();
  const { status, statusType } = state;

  const [visible, setVisible] = useState(false);
  const [fading, setFading] = useState(false);
  const timerRef = useRef<number>(0);
  const fadeTimerRef = useRef<number>(0);
  const prevStatusRef = useRef('');

  useEffect(() => {
    // Only react to actual status changes
    if (status && status !== prevStatusRef.current) {
      setVisible(true);
      setFading(false);

      // Clear any existing timers
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
      }
      if (fadeTimerRef.current) {
        window.clearTimeout(fadeTimerRef.current);
      }

      // Auto-fade after 5 seconds
      timerRef.current = window.setTimeout(() => {
        setFading(true);
        // Remove from DOM after fade animation
        fadeTimerRef.current = window.setTimeout(() => {
          setVisible(false);
          setFading(false);
          dispatch({ type: 'CLEAR_STATUS' });
        }, 300);
      }, 5000);
    } else if (!status) {
      setVisible(false);
      setFading(false);
    }

    prevStatusRef.current = status;

    return () => {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
      }
      if (fadeTimerRef.current) {
        window.clearTimeout(fadeTimerRef.current);
      }
    };
  }, [status, dispatch]);

  const handleDismiss = useCallback(() => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
    }
    if (fadeTimerRef.current) {
      window.clearTimeout(fadeTimerRef.current);
    }
    setFading(true);
    fadeTimerRef.current = window.setTimeout(() => {
      setVisible(false);
      setFading(false);
      dispatch({ type: 'CLEAR_STATUS' });
    }, 300);
  }, [dispatch]);

  if (!visible || !status) return null;

  return (
    <div
      className={`status-banner status-${statusType} visible ${fading ? 'fading' : ''}`}
      onClick={handleDismiss}
      role="status"
      aria-live="polite"
    >
      {status}
    </div>
  );
}
