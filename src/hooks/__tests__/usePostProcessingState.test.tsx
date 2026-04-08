/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePostProcessingState } from '../usePostProcessingState';

describe('usePostProcessingState', () => {
  it('returns default state', () => {
    const { result } = renderHook(() => usePostProcessingState());
    expect(result.current.state.pixelize.enabled).toBe(false);
    expect(result.current.state.pixelize.size).toBe(32);
    expect(result.current.state.outline.enabled).toBe(false);
    expect(result.current.state.struckColors).toEqual([]);
    expect(result.current.state.strikeTolerance).toBe(10);
    expect(result.current.state.showRareColors).toBe(false);
    expect(result.current.state.aaInset).toBe(3);
    expect(result.current.state.eraserBrushW).toBe(1);
    expect(result.current.state.eraserBrushH).toBe(1);
    expect(result.current.state.alphaSnap.enabled).toBe(false);
    expect(result.current.state.alphaSnap.threshold).toBe(128);
  });

  it('can update pixelize settings', () => {
    const { result } = renderHook(() => usePostProcessingState());
    act(() => result.current.dispatch({ type: 'SET_PIXELIZE', enabled: true, size: 64 }));
    expect(result.current.state.pixelize.enabled).toBe(true);
    expect(result.current.state.pixelize.size).toBe(64);
  });

  it('can update pixelize size independently', () => {
    const { result } = renderHook(() => usePostProcessingState());
    act(() => result.current.dispatch({ type: 'SET_PIXELIZE_SIZE', size: 48 }));
    expect(result.current.state.pixelize.size).toBe(48);
    expect(result.current.state.pixelize.enabled).toBe(false);
  });

  it('can toggle outline', () => {
    const { result } = renderHook(() => usePostProcessingState());
    act(() => result.current.dispatch({ type: 'SET_OUTLINE', enabled: true }));
    expect(result.current.state.outline.enabled).toBe(true);
    expect(result.current.state.outline.outDepth).toBe(1);
    expect(result.current.state.outline.inDepth).toBe(0);
    expect(result.current.state.outline.color).toEqual([0, 0, 0]);
  });

  it('can update outline depth', () => {
    const { result } = renderHook(() => usePostProcessingState());
    act(() => result.current.dispatch({ type: 'SET_OUTLINE_DEPTH', outDepth: 3, inDepth: 2 }));
    expect(result.current.state.outline.outDepth).toBe(3);
    expect(result.current.state.outline.inDepth).toBe(2);
  });

  it('can update outline color', () => {
    const { result } = renderHook(() => usePostProcessingState());
    act(() => result.current.dispatch({ type: 'SET_OUTLINE_COLOR', color: [128, 64, 32] }));
    expect(result.current.state.outline.color).toEqual([128, 64, 32]);
  });

  it('can toggle alpha snap', () => {
    const { result } = renderHook(() => usePostProcessingState());
    act(() => result.current.dispatch({ type: 'SET_ALPHA_SNAP', enabled: true, threshold: 200 }));
    expect(result.current.state.alphaSnap.enabled).toBe(true);
    expect(result.current.state.alphaSnap.threshold).toBe(200);
  });

  it('can update alpha snap threshold independently', () => {
    const { result } = renderHook(() => usePostProcessingState());
    act(() => result.current.dispatch({ type: 'SET_ALPHA_SNAP_THRESHOLD', threshold: 64 }));
    expect(result.current.state.alphaSnap.threshold).toBe(64);
  });

  it('can add and clear struck colors', () => {
    const { result } = renderHook(() => usePostProcessingState());
    act(() => result.current.dispatch({ type: 'STRIKE_COLOR', color: [255, 0, 0] }));
    expect(result.current.state.struckColors).toEqual([[255, 0, 0]]);
    act(() => result.current.dispatch({ type: 'CLEAR_STRUCK_COLORS' }));
    expect(result.current.state.struckColors).toEqual([]);
  });

  it('does not add duplicate struck colors', () => {
    const { result } = renderHook(() => usePostProcessingState());
    act(() => result.current.dispatch({ type: 'STRIKE_COLOR', color: [255, 0, 0] }));
    act(() => result.current.dispatch({ type: 'STRIKE_COLOR', color: [255, 0, 0] }));
    expect(result.current.state.struckColors).toEqual([[255, 0, 0]]);
  });

  it('can unstrike a specific color', () => {
    const { result } = renderHook(() => usePostProcessingState());
    act(() => result.current.dispatch({ type: 'STRIKE_COLOR', color: [255, 0, 0] }));
    act(() => result.current.dispatch({ type: 'STRIKE_COLOR', color: [0, 255, 0] }));
    act(() => result.current.dispatch({ type: 'UNSTRIKE_COLOR', color: [255, 0, 0] }));
    expect(result.current.state.struckColors).toEqual([[0, 255, 0]]);
  });

  it('can update strike tolerance', () => {
    const { result } = renderHook(() => usePostProcessingState());
    act(() => result.current.dispatch({ type: 'SET_STRIKE_TOLERANCE', tolerance: 25 }));
    expect(result.current.state.strikeTolerance).toBe(25);
  });

  it('can toggle show rare colors', () => {
    const { result } = renderHook(() => usePostProcessingState());
    act(() => result.current.dispatch({ type: 'SET_SHOW_RARE_COLORS', show: true }));
    expect(result.current.state.showRareColors).toBe(true);
  });

  it('can update aaInset', () => {
    const { result } = renderHook(() => usePostProcessingState());
    act(() => result.current.dispatch({ type: 'SET_AA_INSET', inset: 5 }));
    expect(result.current.state.aaInset).toBe(5);
  });

  it('can update eraser brush size', () => {
    const { result } = renderHook(() => usePostProcessingState());
    act(() => result.current.dispatch({ type: 'SET_ERASER_BRUSH', w: 3, h: 4 }));
    expect(result.current.state.eraserBrushW).toBe(3);
    expect(result.current.state.eraserBrushH).toBe(4);
  });

  it('can partially update eraser brush size', () => {
    const { result } = renderHook(() => usePostProcessingState());
    act(() => result.current.dispatch({ type: 'SET_ERASER_BRUSH', w: 5 }));
    expect(result.current.state.eraserBrushW).toBe(5);
    expect(result.current.state.eraserBrushH).toBe(1);
  });

  it('can restore from editor settings', () => {
    const { result } = renderHook(() => usePostProcessingState());
    act(() => result.current.dispatch({
      type: 'RESTORE',
      settings: {
        pixelizeEnabled: true,
        pixelizeSize: 48,
        outlineEnabled: true,
        outlineOutDepth: 2,
        outlineInDepth: 1,
        outlineColor: [255, 255, 255],
        alphaSnapEnabled: false,
        alphaSnapThreshold: 128,
        strikeTolerance: 20,
        struckColors: [[0, 128, 0]],
      },
    }));
    expect(result.current.state.pixelize).toEqual({ enabled: true, size: 48 });
    expect(result.current.state.outline.outDepth).toBe(2);
    expect(result.current.state.outline.color).toEqual([255, 255, 255]);
    expect(result.current.state.struckColors).toEqual([[0, 128, 0]]);
    expect(result.current.state.strikeTolerance).toBe(20);
  });

  it('can restore partial settings without overwriting unspecified fields', () => {
    const { result } = renderHook(() => usePostProcessingState());
    act(() => result.current.dispatch({ type: 'SET_PIXELIZE', enabled: true, size: 64 }));
    act(() => result.current.dispatch({
      type: 'RESTORE',
      settings: { outlineEnabled: true },
    }));
    expect(result.current.state.pixelize).toEqual({ enabled: true, size: 64 });
    expect(result.current.state.outline.enabled).toBe(true);
  });

  it('can reset to initial state', () => {
    const { result } = renderHook(() => usePostProcessingState());
    act(() => result.current.dispatch({ type: 'SET_PIXELIZE', enabled: true, size: 64 }));
    act(() => result.current.dispatch({ type: 'STRIKE_COLOR', color: [255, 0, 0] }));
    act(() => result.current.dispatch({ type: 'RESET' }));
    expect(result.current.state.pixelize.enabled).toBe(false);
    expect(result.current.state.pixelize.size).toBe(32);
    expect(result.current.state.struckColors).toEqual([]);
  });
});
