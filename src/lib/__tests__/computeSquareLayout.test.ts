import { describe, it, expect } from 'vitest';
import { computeSquareLayout, GEMINI_ASPECT_RATIOS } from '../computeSquareLayout';

describe('computeSquareLayout', () => {
  it('returns square cells for a 6x6 grid at 2K', () => {
    const layout = computeSquareLayout(6, 6, '2K');
    expect(layout.cellSize).toBeGreaterThan(0);
    expect(layout.canvasW).toBeLessThanOrEqual(2048);
    expect(layout.canvasH).toBeLessThanOrEqual(2048);
    expect(layout.headerH).toBe(14);
    expect(layout.border).toBe(2);
  });

  it('returns square cells for a 6x6 grid at 4K', () => {
    const layout = computeSquareLayout(6, 6, '4K');
    expect(layout.cellSize).toBeGreaterThan(0);
    expect(layout.canvasW).toBeLessThanOrEqual(4096);
    expect(layout.canvasH).toBeLessThanOrEqual(4096);
    expect(layout.headerH).toBe(22);
    expect(layout.border).toBe(4);
  });

  it('picks 1:1 aspect ratio for square grids', () => {
    const layout = computeSquareLayout(6, 6, '2K');
    expect(layout.aspectRatio).toBe('1:1');
  });

  it('picks a wider aspect ratio for 8x4 grid', () => {
    const layout = computeSquareLayout(8, 4, '2K');
    // 8 cols, 4 rows = wider than tall, should not be 1:1
    expect(layout.aspectRatio).not.toBe('1:1');
    expect(layout.aspectRatio).not.toBe('2:3');
    expect(layout.aspectRatio).not.toBe('9:16');
  });

  it('picks a wider aspect ratio for 8x6 grid', () => {
    const layout = computeSquareLayout(8, 6, '2K');
    expect(layout.cellSize).toBeGreaterThan(0);
    // Should be landscape-ish
    expect(layout.canvasW).toBeGreaterThanOrEqual(layout.canvasH);
  });

  it('grid fits within canvas bounds', () => {
    for (const [cols, rows] of [[6,6],[8,4],[8,6],[3,3],[4,4],[5,5],[2,2],[2,3],[4,2]]) {
      for (const res of ['2K', '4K'] as const) {
        const layout = computeSquareLayout(cols, rows, res);
        const gridW = cols * layout.cellSize + (cols + 1) * layout.border;
        const gridH = rows * (layout.cellSize + layout.headerH) + (rows + 1) * layout.border;
        expect(gridW).toBeLessThanOrEqual(layout.canvasW);
        expect(gridH).toBeLessThanOrEqual(layout.canvasH);
      }
    }
  });

  it('maximizes cell size across all grid configs', () => {
    // For a 3x3 grid at 2K, 1:1 canvas should give the best cell size
    const layout = computeSquareLayout(3, 3, '2K');
    // Manually compute what 1:1 would give
    const base = 2048;
    const maxFromW = Math.floor((base - 4 * 2) / 3);
    const maxFromH = Math.floor((base - 4 * 2) / 3) - 14;
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
    // Two aspect ratios might yield the same cellSize but different canvas areas
    // The function should pick the smaller canvas (tighter fit)
    const layout = computeSquareLayout(6, 6, '2K');
    // 6x6 is square; 1:1 is the tightest fit
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
