import { describe, it, expect } from 'vitest';
import { computeSquareLayout, GEMINI_ASPECT_RATIOS } from '../computeSquareLayout';

describe('computeSquareLayout', () => {
  it('returns square cells for a 6x6 grid at 2K', () => {
    const layout = computeSquareLayout(6, 6, '2K');
    expect(layout.cellSize).toBeGreaterThan(0);
    expect(layout.canvasW).toBeLessThanOrEqual(2048);
    expect(layout.canvasH).toBeLessThanOrEqual(2048);
    expect(layout.headerH).toBe(24);
    expect(layout.fontSize).toBe(18);
  });

  it('returns square cells for a 6x6 grid at 4K', () => {
    const layout = computeSquareLayout(6, 6, '4K');
    expect(layout.cellSize).toBeGreaterThan(0);
    expect(layout.canvasW).toBeLessThanOrEqual(4096);
    expect(layout.canvasH).toBeLessThanOrEqual(4096);
    expect(layout.headerH).toBe(40);
    expect(layout.fontSize).toBe(30);
  });

  it('picks 1:1 aspect ratio for square grids', () => {
    const layout = computeSquareLayout(6, 6, '2K');
    expect(layout.aspectRatio).toBe('1:1');
  });

  it('picks a wider aspect ratio for 8x4 grid', () => {
    const layout = computeSquareLayout(8, 4, '2K');
    expect(layout.aspectRatio).not.toBe('1:1');
    expect(layout.aspectRatio).not.toBe('2:3');
    expect(layout.aspectRatio).not.toBe('9:16');
  });

  it('picks a wider aspect ratio for 8x6 grid', () => {
    const layout = computeSquareLayout(8, 6, '2K');
    expect(layout.cellSize).toBeGreaterThan(0);
    expect(layout.canvasW).toBeGreaterThanOrEqual(layout.canvasH);
  });

  it('grid fits within canvas bounds', () => {
    for (const [cols, rows] of [[6,6],[8,4],[8,6],[3,3],[4,4],[5,5],[2,2],[2,3],[4,2]]) {
      for (const res of ['2K', '4K'] as const) {
        const layout = computeSquareLayout(cols, rows, res);
        const gridW = cols * layout.cellSize + (cols + 1) * layout.hGap;
        const gridH = rows * (layout.cellSize + layout.headerH) + (rows + 1) * layout.vGap;
        expect(gridW).toBeLessThanOrEqual(layout.canvasW);
        expect(gridH).toBeLessThanOrEqual(layout.canvasH);
      }
    }
  });

  it('gaps are evenly distributed (no large side padding)', () => {
    const layout = computeSquareLayout(6, 6, '2K');
    const gridW = 6 * layout.cellSize + 7 * layout.hGap;
    const gridH = 6 * (layout.cellSize + layout.headerH) + 7 * layout.vGap;
    // Remainder after even distribution should be tiny (< one gap width)
    expect(layout.canvasW - gridW).toBeLessThan(layout.hGap);
    expect(layout.canvasH - gridH).toBeLessThan(layout.vGap);
  });

  it('maximizes cell size across all grid configs', () => {
    const layout = computeSquareLayout(3, 3, '2K');
    const base = 2048;
    const maxFromW = Math.floor((base - 4 * 2) / 3);
    const maxFromH = Math.floor((base - 4 * 2) / 3) - 24;
    expect(layout.cellSize).toBe(Math.min(maxFromW, maxFromH));
  });

  it('derived aspect ratio is always a Gemini-supported ratio', () => {
    const ratios = GEMINI_ASPECT_RATIOS.map(([w, h]) => `${w}:${h}`);
    for (const [cols, rows] of [[6,6],[8,4],[8,6],[3,3],[4,4],[5,5],[2,2],[2,3],[4,2],[1,3]]) {
      const layout = computeSquareLayout(cols, rows, '2K');
      expect(ratios).toContain(layout.aspectRatio);
    }
  });

  it('prefers tighter fit when cell sizes tie', () => {
    const layout = computeSquareLayout(6, 6, '2K');
    expect(layout.aspectRatio).toBe('1:1');
  });

  it('4K cell size is roughly 2x the 2K cell size', () => {
    const layout2K = computeSquareLayout(6, 6, '2K');
    const layout4K = computeSquareLayout(6, 6, '4K');
    const ratio = layout4K.cellSize / layout2K.cellSize;
    expect(ratio).toBeGreaterThan(1.8);
    expect(ratio).toBeLessThan(2.2);
  });
});
