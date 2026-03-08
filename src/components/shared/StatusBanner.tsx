/**
 * Fixed-position status notification banner.
 * Color-coded by status type. Error banners persist for 30 seconds;
 * all other types auto-fade after 5 seconds.
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

      // Error banners persist longer (30s); others fade after 5s
      const timeout = statusType === 'error' ? 30000 : 5000;
      timerRef.current = window.setTimeout(() => {
        setFading(true);
        // Remove from DOM after fade animation
        fadeTimerRef.current = window.setTimeout(() => {
          setVisible(false);
          setFading(false);
          dispatch({ type: 'CLEAR_STATUS' });
        }, 300);
      }, timeout);
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
  }, [status, statusType, dispatch]);

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
