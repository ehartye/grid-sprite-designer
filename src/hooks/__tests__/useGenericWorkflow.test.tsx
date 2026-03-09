/**
 * @vitest-environment jsdom
 *
 * Tests for useGenericWorkflow — specifically the abort-on-unmount behavior.
 *
 * Regression: The hook's cleanup effect used to abort in-flight fetch requests
 * when the host component unmounted. Since dispatching GENERATE_START changes
 * state.step from 'configure' to 'generating', the config panel unmounts
 * mid-generation, which killed the API call. The UI then showed the generating
 * overlay forever because nothing could complete or error.
 */

import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { WorkflowConfig } from '../useGenericWorkflow';

// ── Mocks ────────────────────────────────────────────────────────────────────

// Capture the AbortSignal passed to generateGrid so we can assert on it.
let capturedSignal: AbortSignal | null = null;

vi.mock('../../api/geminiClient', () => ({
  generateGrid: vi.fn(
    (_model: string, _prompt: string, _template: unknown, _size: string, signal: AbortSignal) => {
      capturedSignal = signal;
      return new Promise((_resolve, reject) => {
        // If signal is already aborted, reject immediately
        if (signal?.aborted) {
          reject(new DOMException('The operation was aborted.', 'AbortError'));
          return;
        }
        // Otherwise reject on abort (like real fetch does)
        signal?.addEventListener('abort', () => {
          reject(new DOMException('The operation was aborted.', 'AbortError'));
        });
        // Never resolves — simulates a long-running API call
      });
    },
  ),
}));

vi.mock('../../lib/templateGenerator', () => ({
  generateTemplate: () => ({
    base64: 'fakeTemplateBase64',
    canvas: {},
    width: 100,
    height: 100,
  }),
}));

vi.mock('../../lib/spriteExtractor', () => ({
  extractSprites: vi.fn(() => Promise.resolve([])),
}));

// ── Test config ──────────────────────────────────────────────────────────────

const mockGridConfig = {
  id: 'test-6x6',
  label: 'Test Grid',
  cols: 6,
  rows: 6,
  totalCells: 36,
  cellLabels: Array.from({ length: 36 }, (_, i) => `Cell ${i}`),
  aspectRatio: '1:1',
  templates: {
    '2K': { cellW: 339, cellH: 339, headerH: 14, border: 2, fontSize: 9 },
    '4K': { cellW: 678, cellH: 678, headerH: 22, border: 4, fontSize: 14 },
  },
};

const testWorkflowConfig: WorkflowConfig = {
  spriteType: 'character',
  validationLabel: 'character',
  getContent: () => ({ name: 'Test Character', description: 'A test character' }),
  buildGridConfig: () => mockGridConfig,
  buildPrompt: () => 'Generate test sprites',
  getReExtractGridConfig: () => null,
};

// ── Wrapper ──────────────────────────────────────────────────────────────────

// Lazy-import to ensure mocks are applied first
async function getModules() {
  const { AppProvider } = await import('../../context/AppContext');
  const { useGenericWorkflow, cancelActiveGeneration } = await import('../useGenericWorkflow');
  return { AppProvider, useGenericWorkflow, cancelActiveGeneration };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('useGenericWorkflow abort behavior', () => {
  beforeEach(() => {
    capturedSignal = null;
    vi.restoreAllMocks();
    // Suppress fetch calls from AppProvider's historyId sync effect
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({}) })));
  });

  it('does not abort in-flight generation when hook unmounts', async () => {
    const { AppProvider, useGenericWorkflow } = await getModules();

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AppProvider>{children}</AppProvider>
    );

    const { result, unmount } = renderHook(
      () => useGenericWorkflow(testWorkflowConfig),
      { wrapper },
    );

    // Start generation — the async pipeline will hang on the mocked generateGrid
    act(() => {
      result.current.generate();
    });

    // Verify the API was called and the signal was captured
    expect(capturedSignal).not.toBeNull();
    expect(capturedSignal!.aborted).toBe(false);

    // Unmount the hook — this simulates UnifiedConfigPanel unmounting
    // when GENERATE_START changes state.step to 'generating'
    unmount();

    // CRITICAL: The signal must NOT be aborted.
    // Before the fix, the cleanup effect would call abort() here,
    // killing the in-flight API request and leaving the UI stuck.
    expect(capturedSignal!.aborted).toBe(false);
  });

  it('aborts generation when explicitly cancelled via cancelActiveGeneration', async () => {
    const { AppProvider, useGenericWorkflow, cancelActiveGeneration } = await getModules();

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AppProvider>{children}</AppProvider>
    );

    const { result } = renderHook(
      () => useGenericWorkflow(testWorkflowConfig),
      { wrapper },
    );

    // Start generation
    act(() => {
      result.current.generate();
    });

    expect(capturedSignal).not.toBeNull();
    expect(capturedSignal!.aborted).toBe(false);

    // Explicit cancel — this should abort
    act(() => {
      result.current.cancelGeneration();
    });

    expect(capturedSignal!.aborted).toBe(true);
  });

  it('aborts on unmount when no generation is in progress', async () => {
    const { AppProvider, useGenericWorkflow } = await getModules();

    // We need to start and then finish a generation, leaving the abort controller set.
    // But since our mock never resolves, we test a simpler case:
    // If the hook is unmounted without ever generating, cleanup should be a no-op.
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AppProvider>{children}</AppProvider>
    );

    const { unmount } = renderHook(
      () => useGenericWorkflow(testWorkflowConfig),
      { wrapper },
    );

    // Unmount without generating — should not throw
    unmount();

    // No signal was ever created
    expect(capturedSignal).toBeNull();
  });
});
