import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ExtractedSprite } from '../spriteExtractor';

// Minimal 1x1 white PNG base64
const WHITE_1X1_PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI6QAAAABJRU5ErkJggg==';

// ── Canvas / Image mocks for Node environment ──────────────────────────────

let mockCtx: Record<string, any>;
let mockCanvas: Record<string, any>;

beforeEach(() => {
  mockCtx = {
    imageSmoothingEnabled: true,
    drawImage: vi.fn(),
  };
  mockCanvas = {
    width: 0,
    height: 0,
    getContext: vi.fn(() => mockCtx),
    toDataURL: vi.fn(() => `data:image/png;base64,${WHITE_1X1_PNG}`),
  };

  vi.stubGlobal('document', {
    createElement: vi.fn((tag: string) => {
      if (tag === 'canvas') return mockCanvas;
      return {};
    }),
  });

  // Mock Image constructor used by loadImage()
  vi.stubGlobal('Image', class MockImage {
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    _src = '';
    width = 1;
    height = 1;
    set src(val: string) {
      this._src = val;
      // Trigger onload asynchronously
      Promise.resolve().then(() => this.onload?.());
    }
    get src() { return this._src; }
  });
});

function makeSprite(w: number, h: number): ExtractedSprite {
  return {
    cellIndex: 0,
    label: 'test',
    imageData: WHITE_1X1_PNG,
    mimeType: 'image/png',
    width: w,
    height: h,
  };
}

describe('pixelizeSprite', () => {
  it('returns a sprite with target dimensions using nearest-neighbor', async () => {
    const { pixelizeSprite } = await import('../spriteExtractor');
    const sprite = makeSprite(256, 256);
    const result = await pixelizeSprite(sprite, 32);
    expect(result.width).toBe(32);
    expect(result.height).toBe(32);
    expect(mockCtx.imageSmoothingEnabled).toBe(false);
    expect(mockCtx.drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 32, 32);
  });

  it('works for all 5 valid sizes', async () => {
    const { pixelizeSprite } = await import('../spriteExtractor');
    const sprite = makeSprite(256, 256);
    for (const size of [16, 32, 48, 64, 128]) {
      const result = await pixelizeSprite(sprite, size);
      expect(result.width).toBe(size);
      expect(result.height).toBe(size);
    }
  });

  it('preserves cellIndex and label', async () => {
    const { pixelizeSprite } = await import('../spriteExtractor');
    const sprite = { ...makeSprite(128, 128), cellIndex: 5, label: 'Attack 1' };
    const result = await pixelizeSprite(sprite, 16);
    expect(result.cellIndex).toBe(5);
    expect(result.label).toBe('Attack 1');
  });

  it('returns a valid base64 PNG string', async () => {
    const { pixelizeSprite } = await import('../spriteExtractor');
    const sprite = makeSprite(256, 256);
    const result = await pixelizeSprite(sprite, 32);
    expect(result.imageData).toBeTruthy();
    expect(result.mimeType).toBe('image/png');
    expect(result.imageData.length).toBeGreaterThan(0);
  });
});
