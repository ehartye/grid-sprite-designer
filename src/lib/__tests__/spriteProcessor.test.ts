import { describe, it, expect } from 'vitest';
import type { ProcessSpriteOptions } from '../spriteProcessor';

describe('ProcessSpriteOptions', () => {
  it('has expected shape with grouped sub-objects', () => {
    const opts: ProcessSpriteOptions = {
      posterize: { enabled: false, bits: 4 },
      chroma: { enabled: false, tolerance: 80, defringeCore: 240, edgeRecolorPasses: 0, recolorSensitivity: 50 },
      pixelize: { enabled: false, size: 32 },
      outline: { enabled: false, outDepth: 1, inDepth: 0, color: [0, 0, 0] },
      alphaSnap: { enabled: false, threshold: 128 },
      colorStrike: { colors: [], tolerance: 10 },
    };
    expect(opts.posterize.enabled).toBe(false);
    expect(opts.chroma.tolerance).toBe(80);
    expect(opts.pixelize.size).toBe(32);
    expect(opts.outline.color).toEqual([0, 0, 0]);
    expect(opts.alphaSnap.threshold).toBe(128);
    expect(opts.colorStrike.colors).toEqual([]);
  });

  it('accepts optional chromaKeyColor and erasedPixels', () => {
    const opts: ProcessSpriteOptions = {
      posterize: { enabled: false, bits: 4 },
      chroma: { enabled: false, tolerance: 80, defringeCore: 240, edgeRecolorPasses: 0, recolorSensitivity: 50 },
      pixelize: { enabled: false, size: 32 },
      outline: { enabled: false, outDepth: 1, inDepth: 0, color: [0, 0, 0] },
      alphaSnap: { enabled: false, threshold: 128 },
      colorStrike: { colors: [], tolerance: 10 },
      chromaKeyColor: [255, 0, 255],
      erasedPixels: new Set(['1,2', '3,4']),
    };
    expect(opts.chromaKeyColor).toEqual([255, 0, 255]);
    expect(opts.erasedPixels?.size).toBe(2);
  });
});
