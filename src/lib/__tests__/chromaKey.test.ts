import { describe, it, expect } from 'vitest';
import { detectKeyColor, applyChromaKey, strikeColors, outlineSprite } from '../chromaKey';

/** Create a small ImageData-like object for testing. */
function makeImageData(width: number, height: number, fill: [number, number, number, number]): ImageData {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = fill[0];
    data[i + 1] = fill[1];
    data[i + 2] = fill[2];
    data[i + 3] = fill[3];
  }
  return { data, width, height, colorSpace: 'srgb' } as ImageData;
}

/** Set a single pixel in an ImageData. */
function setPixel(img: ImageData, x: number, y: number, r: number, g: number, b: number, a = 255) {
  const i = (y * img.width + x) * 4;
  img.data[i] = r;
  img.data[i + 1] = g;
  img.data[i + 2] = b;
  img.data[i + 3] = a;
}

/** Get pixel RGBA from ImageData. */
function getPixel(img: ImageData, x: number, y: number): [number, number, number, number] {
  const i = (y * img.width + x) * 4;
  return [img.data[i], img.data[i + 1], img.data[i + 2], img.data[i + 3]];
}

describe('detectKeyColor', () => {
  it('detects magenta when all edge pixels are magenta', () => {
    const img = makeImageData(10, 10, [255, 0, 255, 255]);
    const [r, g, b] = detectKeyColor(img);
    // Should detect close to magenta
    expect(r).toBeGreaterThan(240);
    expect(g).toBeLessThan(16);
    expect(b).toBeGreaterThan(240);
  });

  it('detects green when all edge pixels are green', () => {
    const img = makeImageData(10, 10, [0, 255, 0, 255]);
    const [r, g, b] = detectKeyColor(img);
    expect(r).toBeLessThan(16);
    expect(g).toBeGreaterThan(240);
    expect(b).toBeLessThan(16);
  });

  it('falls back to magenta for all-transparent images', () => {
    const img = makeImageData(10, 10, [0, 0, 0, 0]);
    const [r, g, b] = detectKeyColor(img);
    expect(r).toBe(255);
    expect(g).toBe(0);
    expect(b).toBe(255);
  });

  it('detects edge color ignoring interior pixels', () => {
    // 10x10 image: edges are blue, interior is red
    const img = makeImageData(10, 10, [0, 0, 255, 255]);
    // Fill interior with red (pixels not in border of width 3)
    for (let y = 3; y < 7; y++) {
      for (let x = 3; x < 7; x++) {
        setPixel(img, x, y, 255, 0, 0);
      }
    }
    const [r, g, b] = detectKeyColor(img);
    // Should detect blue (the edge color), not red
    expect(r).toBeLessThan(16);
    expect(g).toBeLessThan(16);
    expect(b).toBeGreaterThan(240);
  });
});

describe('applyChromaKey', () => {
  it('returns unchanged data when tolerance is 0', () => {
    const img = makeImageData(4, 4, [255, 0, 255, 255]);
    const result = applyChromaKey(img, 0);
    expect(result.data[3]).toBe(255); // alpha unchanged
  });

  it('makes magenta pixels transparent', () => {
    const img = makeImageData(4, 4, [255, 0, 255, 255]);
    const result = applyChromaKey(img, 30);
    // All pixels should be transparent (alpha = 0) since they match the key
    for (let i = 0; i < result.data.length; i += 4) {
      expect(result.data[i + 3]).toBe(0);
    }
  });

  it('preserves non-key-colored pixels', () => {
    const img = makeImageData(4, 4, [0, 128, 0, 255]); // green
    const result = applyChromaKey(img, 30);
    // Green is far from magenta, should be preserved
    for (let i = 0; i < result.data.length; i += 4) {
      expect(result.data[i + 3]).toBe(255);
    }
  });

  it('uses custom key color', () => {
    const img = makeImageData(4, 4, [0, 255, 0, 255]); // green
    const result = applyChromaKey(img, 30, undefined, 0, 255, 0); // key = green
    for (let i = 0; i < result.data.length; i += 4) {
      expect(result.data[i + 3]).toBe(0);
    }
  });

  it('does not mutate the source ImageData', () => {
    const img = makeImageData(4, 4, [255, 0, 255, 255]);
    const origAlpha = img.data[3];
    applyChromaKey(img, 30);
    expect(img.data[3]).toBe(origAlpha);
  });
});

describe('strikeColors', () => {
  it('returns copy when colors list is empty', () => {
    const img = makeImageData(4, 4, [128, 64, 32, 255]);
    const result = strikeColors(img, []);
    expect(result.data[3]).toBe(255);
    // Should be a copy, not the same reference
    expect(result.data).not.toBe(img.data);
  });

  it('makes matching pixels transparent', () => {
    const img = makeImageData(2, 2, [100, 50, 25, 255]);
    const result = strikeColors(img, [[100, 50, 25]]);
    for (let i = 0; i < result.data.length; i += 4) {
      expect(result.data[i + 3]).toBe(0);
    }
  });

  it('preserves non-matching pixels', () => {
    const img = makeImageData(2, 2, [100, 50, 25, 255]);
    const result = strikeColors(img, [[0, 0, 0]]); // black, far from [100,50,25]
    for (let i = 0; i < result.data.length; i += 4) {
      expect(result.data[i + 3]).toBe(255);
    }
  });

  it('handles multiple strike colors', () => {
    const img = makeImageData(2, 2, [0, 0, 0, 255]);
    setPixel(img, 0, 0, 255, 0, 0); // red
    setPixel(img, 1, 0, 0, 0, 255); // blue

    const result = strikeColors(img, [[255, 0, 0], [0, 0, 255]]);
    // Red and blue pixels should be transparent
    expect(getPixel(result, 0, 0)[3]).toBe(0);
    expect(getPixel(result, 1, 0)[3]).toBe(0);
    // Black pixels remain (far from both red and blue)
    expect(getPixel(result, 0, 1)[3]).toBe(255);
  });

  it('skips already-transparent pixels', () => {
    const img = makeImageData(2, 2, [100, 50, 25, 0]); // already transparent
    const result = strikeColors(img, [[100, 50, 25]]);
    // Should remain transparent (alpha 0) — no change
    for (let i = 0; i < result.data.length; i += 4) {
      expect(result.data[i + 3]).toBe(0);
    }
  });

  it('respects tolerance parameter', () => {
    const img = makeImageData(1, 1, [100, 50, 25, 255]);
    // Very tight tolerance — color [110, 50, 25] is dist=10 from target
    const tight = strikeColors(img, [[110, 50, 25]], 5);
    expect(tight.data[3]).toBe(255); // not close enough

    const loose = strikeColors(img, [[110, 50, 25]], 20);
    expect(loose.data[3]).toBe(0); // within tolerance
  });
});

describe('outlineSprite', () => {
  it('solidifies fringe pixels to outline color', () => {
    // 3x3, center opaque white, one edge pixel at alpha=128 with pink RGB
    const img = makeImageData(3, 3, [0, 0, 0, 0]);
    setPixel(img, 1, 1, 255, 255, 255, 255); // center opaque white
    setPixel(img, 1, 0, 200, 100, 200, 128); // top-center partial alpha pink

    // outDepth=1 triggers Phase 1 (fringe solidification is prep for outward expansion)
    const result = outlineSprite(img, 1, 0, 0, 0, 0);

    const [r, g, b, a] = getPixel(result, 1, 0);
    expect(a).toBe(255);
    expect(r).toBe(0);
    expect(g).toBe(0);
    expect(b).toBe(0);
  });

  it('is a no-op when outDepth=0, inDepth=0, and no fringe', () => {
    // single opaque center pixel, transparent surroundings
    const img = makeImageData(3, 3, [0, 0, 0, 0]);
    setPixel(img, 1, 1, 255, 255, 255, 255);

    const result = outlineSprite(img, 0, 0, 0, 0, 0);

    // Center stays opaque white
    expect(getPixel(result, 1, 1)).toEqual([255, 255, 255, 255]);
    // All surroundings still transparent
    expect(getPixel(result, 0, 0)[3]).toBe(0);
    expect(getPixel(result, 1, 0)[3]).toBe(0);
    expect(getPixel(result, 2, 0)[3]).toBe(0);
    expect(getPixel(result, 0, 1)[3]).toBe(0);
    expect(getPixel(result, 2, 1)[3]).toBe(0);
    expect(getPixel(result, 0, 2)[3]).toBe(0);
    expect(getPixel(result, 1, 2)[3]).toBe(0);
    expect(getPixel(result, 2, 2)[3]).toBe(0);
  });

  it('expands outline outward by 1 pixel', () => {
    // single opaque center pixel in 3x3
    const img = makeImageData(3, 3, [0, 0, 0, 0]);
    setPixel(img, 1, 1, 255, 255, 255, 255);

    const result = outlineSprite(img, 1, 0, 0, 0, 0);

    // 4 cardinal neighbors become opaque black
    expect(getPixel(result, 1, 0)).toEqual([0, 0, 0, 255]);
    expect(getPixel(result, 0, 1)).toEqual([0, 0, 0, 255]);
    expect(getPixel(result, 2, 1)).toEqual([0, 0, 0, 255]);
    expect(getPixel(result, 1, 2)).toEqual([0, 0, 0, 255]);
    // Corners remain transparent
    expect(getPixel(result, 0, 0)[3]).toBe(0);
    expect(getPixel(result, 2, 0)[3]).toBe(0);
    expect(getPixel(result, 0, 2)[3]).toBe(0);
    expect(getPixel(result, 2, 2)[3]).toBe(0);
  });

  it('expands outline outward by 2 pixels', () => {
    // single opaque center pixel in 5x5
    const img = makeImageData(5, 5, [0, 0, 0, 0]);
    setPixel(img, 2, 2, 255, 255, 255, 255);

    const result = outlineSprite(img, 2, 0, 0, 0, 0);

    // 2 steps along cardinal axes should be opaque
    expect(getPixel(result, 2, 0)[3]).toBe(255); // up 2
    expect(getPixel(result, 2, 4)[3]).toBe(255); // down 2
    expect(getPixel(result, 0, 2)[3]).toBe(255); // left 2
    expect(getPixel(result, 4, 2)[3]).toBe(255); // right 2
    // 1 step along cardinal axes also opaque
    expect(getPixel(result, 2, 1)[3]).toBe(255);
    expect(getPixel(result, 2, 3)[3]).toBe(255);
    expect(getPixel(result, 1, 2)[3]).toBe(255);
    expect(getPixel(result, 3, 2)[3]).toBe(255);
    // Diagonal neighbors of first ring should also be filled (they neighbor the cardinal pixels)
    expect(getPixel(result, 1, 1)[3]).toBe(255);
    expect(getPixel(result, 3, 1)[3]).toBe(255);
    expect(getPixel(result, 1, 3)[3]).toBe(255);
    expect(getPixel(result, 3, 3)[3]).toBe(255);
  });

  it('recolors inward by 1 pixel', () => {
    // 5x5 fully opaque white square
    const img = makeImageData(5, 5, [255, 255, 255, 255]);

    const result = outlineSprite(img, 0, 1, 0, 0, 0);

    // Border pixels should be recolored to black
    // Top row
    for (let x = 0; x < 5; x++) {
      expect(getPixel(result, x, 0).slice(0, 3)).toEqual([0, 0, 0]);
    }
    // Bottom row
    for (let x = 0; x < 5; x++) {
      expect(getPixel(result, x, 4).slice(0, 3)).toEqual([0, 0, 0]);
    }
    // Left and right edges (middle rows)
    for (let y = 1; y < 4; y++) {
      expect(getPixel(result, 0, y).slice(0, 3)).toEqual([0, 0, 0]);
      expect(getPixel(result, 4, y).slice(0, 3)).toEqual([0, 0, 0]);
    }
    // Interior pixel (2,2) should still be white
    expect(getPixel(result, 2, 2).slice(0, 3)).toEqual([255, 255, 255]);
  });

  it('uses specified RGB color, not hardcoded values', () => {
    // Test fringe solidification with non-black color
    const img = makeImageData(3, 3, [0, 0, 0, 0]);
    setPixel(img, 1, 1, 255, 255, 255, 255);
    setPixel(img, 1, 0, 200, 100, 200, 128); // partial alpha fringe

    const result = outlineSprite(img, 1, 0, 255, 0, 0); // red outline

    // Fringe pixel should be red
    const [fr, fg, fb] = getPixel(result, 1, 0);
    expect(fr).toBe(255);
    expect(fg).toBe(0);
    expect(fb).toBe(0);

    // Outward expansion should also be red
    const [or_, og, ob] = getPixel(result, 0, 1);
    expect(or_).toBe(255);
    expect(og).toBe(0);
    expect(ob).toBe(0);
  });

  it('inward recolor works when edge pixels border partial-alpha fringe (chroma key case)', () => {
    // 3x3: outer ring is partial-alpha fringe (as left by chroma key), center is fully opaque
    const img = makeImageData(3, 3, [200, 200, 200, 128]); // fringe alpha
    setPixel(img, 1, 1, 255, 255, 255, 255); // fully opaque center

    const result = outlineSprite(img, 0, 1, 0, 0, 0); // inward only, black
    // Center (only fully-opaque pixel) has partial-alpha neighbors → should be recolored
    expect(getPixel(result, 1, 1).slice(0, 3)).toEqual([0, 0, 0]);
    // Fringe pixels are skipped (alpha < 255) — RGB unchanged
    expect(getPixel(result, 0, 0)[3]).toBe(128);
  });

  it('does not mutate source ImageData', () => {
    const img = makeImageData(3, 3, [0, 0, 0, 0]);
    setPixel(img, 1, 1, 255, 255, 255, 255);
    const origData = new Uint8ClampedArray(img.data);

    outlineSprite(img, 1, 1, 0, 0, 0);

    expect(img.data).toEqual(origData);
  });
});
