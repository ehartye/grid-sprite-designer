# Outline Recolor Feature Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use h-superpowers:subagent-driven-development, h-superpowers:team-driven-development, or h-superpowers:executing-plans to implement this plan (ask user which approach).

**Goal:** Add `outlineSprite()` — a post-processing pass that paints N pixels of a chosen color around sprites (inward and/or outward) with partial-alpha fringe solidification.

**Architecture:** New export in `src/lib/chromaKey.ts`. Wired into `processSprite()` in `SpriteReview.tsx` after `defringeRecolor`, before `strikeColors`. Four new state vars + sidebar UI + persistence via `EditorSettings`.

**Tech Stack:** TypeScript, React hooks, Canvas 2D ImageData manipulation, Vitest

---

### Task 1: `outlineSprite()` function + unit tests

**Files:**
- Modify: `src/lib/chromaKey.ts` (append export after `defringeRecolor`)
- Modify: `src/lib/__tests__/chromaKey.test.ts` (append new `describe` block)

---

**Step 1: Write the failing tests**

Append to the bottom of `src/lib/__tests__/chromaKey.test.ts`:

```typescript
import { outlineSprite } from '../chromaKey';

describe('outlineSprite', () => {
  it('solidifies partial-alpha fringe pixels to full alpha with outline color', () => {
    // 3x3: center opaque white, one edge pixel at alpha=128 (fringe), rest transparent
    const img = makeImageData(3, 3, [0, 0, 0, 0]);
    setPixel(img, 1, 1, 255, 255, 255, 255); // center opaque
    setPixel(img, 1, 0, 200, 100, 100, 128); // fringe at top (partial alpha)

    const result = outlineSprite(img, 0, 0, 0, 0, 0); // black outline, no depth
    const [r, g, b, a] = getPixel(result, 1, 0);
    expect(a).toBe(255);
    expect(r).toBe(0);
    expect(g).toBe(0);
    expect(b).toBe(0);
  });

  it('is a no-op when outDepth=0, inDepth=0 and no partial-alpha pixels', () => {
    // 3x3: center opaque, rest fully transparent (no fringe)
    const img = makeImageData(3, 3, [0, 0, 0, 0]);
    setPixel(img, 1, 1, 255, 255, 255, 255);

    const result = outlineSprite(img, 0, 0, 255, 0, 0); // red, but no depth
    // Center unchanged
    expect(getPixel(result, 1, 1)).toEqual([255, 255, 255, 255]);
    // Transparent neighbors still transparent
    expect(getPixel(result, 0, 0)[3]).toBe(0);
    expect(getPixel(result, 1, 0)[3]).toBe(0);
  });

  it('expands outward by 1 pixel when outDepth=1', () => {
    // 3x3: single opaque pixel at center, rest transparent
    const img = makeImageData(3, 3, [0, 0, 0, 0]);
    setPixel(img, 1, 1, 255, 255, 255, 255);

    const result = outlineSprite(img, 1, 0, 0, 0, 0); // black, out=1
    // 4 cardinal neighbors should now be opaque black
    expect(getPixel(result, 1, 0)).toEqual([0, 0, 0, 255]); // above
    expect(getPixel(result, 1, 2)).toEqual([0, 0, 0, 255]); // below
    expect(getPixel(result, 0, 1)).toEqual([0, 0, 0, 255]); // left
    expect(getPixel(result, 2, 1)).toEqual([0, 0, 0, 255]); // right
    // Corners unchanged (diagonal, not 4-directional)
    expect(getPixel(result, 0, 0)[3]).toBe(0);
  });

  it('expands outward by 2 pixels when outDepth=2', () => {
    // 5x5: single opaque pixel at center (2,2)
    const img = makeImageData(5, 5, [0, 0, 0, 0]);
    setPixel(img, 2, 2, 255, 255, 255, 255);

    const result = outlineSprite(img, 2, 0, 0, 0, 0);
    // 2 steps out along cardinal axes should be outline
    expect(getPixel(result, 2, 0)[3]).toBe(255); // 2 up
    expect(getPixel(result, 2, 4)[3]).toBe(255); // 2 down
    expect(getPixel(result, 0, 2)[3]).toBe(255); // 2 left
    expect(getPixel(result, 4, 2)[3]).toBe(255); // 2 right
  });

  it('recolors inward ring when inDepth=1', () => {
    // 5x5 fully opaque white square
    const img = makeImageData(5, 5, [255, 255, 255, 255]);

    const result = outlineSprite(img, 0, 1, 0, 0, 0); // black, in=1
    // Edge pixels (border) should be recolored black
    expect(getPixel(result, 0, 0)).toEqual([0, 0, 0, 255]);
    expect(getPixel(result, 4, 4)).toEqual([0, 0, 0, 255]);
    expect(getPixel(result, 2, 0)).toEqual([0, 0, 0, 255]);
    // Interior pixel (2,2) should still be white
    expect(getPixel(result, 2, 2)).toEqual([255, 255, 255, 255]);
  });

  it('uses specified RGB color for all three phases', () => {
    // Phase 1 (fringe solidify): partial-alpha pixel → uses specified color
    const img = makeImageData(3, 3, [0, 0, 0, 0]);
    setPixel(img, 1, 1, 255, 255, 255, 255);
    setPixel(img, 1, 0, 200, 100, 100, 128); // fringe

    const result = outlineSprite(img, 1, 0, 255, 0, 128); // custom color
    // Fringe pixel solidified with custom color
    const fringe = getPixel(result, 1, 0);
    expect(fringe[0]).toBe(255);
    expect(fringe[1]).toBe(0);
    expect(fringe[2]).toBe(128);
    expect(fringe[3]).toBe(255);
    // Outward expansion also uses custom color (e.g., pixel below center)
    const expanded = getPixel(result, 1, 2);
    expect(expanded[0]).toBe(255);
    expect(expanded[1]).toBe(0);
    expect(expanded[2]).toBe(128);
    expect(expanded[3]).toBe(255);
  });

  it('does not mutate the source ImageData', () => {
    const img = makeImageData(3, 3, [0, 0, 0, 0]);
    setPixel(img, 1, 1, 255, 255, 255, 255);
    const origAlpha = img.data[3];
    outlineSprite(img, 1, 1, 0, 0, 0);
    expect(img.data[3]).toBe(origAlpha);
  });
});
```

**Step 2: Run to verify tests fail**

```bash
npx vitest run src/lib/__tests__/chromaKey.test.ts
```

Expected: FAIL — `outlineSprite` is not exported from `../chromaKey`.

**Step 3: Implement `outlineSprite` in `src/lib/chromaKey.ts`**

Append after the `strikeColors` function (after line 332):

```typescript
/**
 * Draw a pixel outline around sprites.
 * Three phases run in sequence:
 *  1. Solidify fringe — partial-alpha pixels (0 < alpha < 255) → alpha=255, RGB=outline color.
 *  2. Outward expansion — paint transparent pixels adjacent to opaque pixels (outDepth iterations).
 *  3. Inward recolor — recolor opaque pixels adjacent to transparent pixels (inDepth iterations).
 * All three phases use the same (r, g, b) outline color.
 */
export function outlineSprite(
  source: ImageData,
  outDepth: number,
  inDepth: number,
  r: number,
  g: number,
  b: number,
): ImageData {
  const { width, height } = source;
  const out = new ImageData(
    new Uint8ClampedArray(source.data),
    width,
    height,
  );
  const data = out.data;

  // ── Phase 1: Solidify fringe ─────────────────────────────────────────────
  // Partial-alpha pixels are remnants of chroma key's soft ramp.
  // Snap them to full alpha with the outline color so outward expansion
  // starts from a hard edge.
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3];
    if (a > 0 && a < 255) {
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = 255;
    }
  }

  // ── Phase 2: Outward expansion ───────────────────────────────────────────
  // Each iteration expands the opaque region one pixel outward (4-directional).
  // Alpha snapshot at start of each iteration prevents mid-pass mutation from
  // letting the expansion "chain" beyond one layer per iteration.
  for (let pass = 0; pass < outDepth; pass++) {
    const alphaSnap = new Uint8Array(width * height);
    for (let pi = 0; pi < width * height; pi++) {
      alphaSnap[pi] = data[pi * 4 + 3];
    }

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const pi = y * width + x;
        if (alphaSnap[pi] !== 0) continue; // only transparent pixels

        // Check 4 cardinal neighbors for an opaque pixel
        const hasOpaque =
          (x > 0 && alphaSnap[pi - 1] === 255) ||
          (x < width - 1 && alphaSnap[pi + 1] === 255) ||
          (y > 0 && alphaSnap[pi - width] === 255) ||
          (y < height - 1 && alphaSnap[pi + width] === 255);

        if (hasOpaque) {
          const i = pi * 4;
          data[i] = r;
          data[i + 1] = g;
          data[i + 2] = b;
          data[i + 3] = 255;
        }
      }
    }
  }

  // ── Phase 3: Inward recolor ──────────────────────────────────────────────
  // Each iteration recolors the outermost ring of opaque pixels.
  // Alpha is preserved (no new pixels created, only RGB changed).
  for (let pass = 0; pass < inDepth; pass++) {
    const alphaSnap = new Uint8Array(width * height);
    for (let pi = 0; pi < width * height; pi++) {
      alphaSnap[pi] = data[pi * 4 + 3];
    }

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const pi = y * width + x;
        if (alphaSnap[pi] === 0) continue; // only opaque pixels

        // Check 4 cardinal neighbors for a transparent pixel
        const hasTransparent =
          (x > 0 && alphaSnap[pi - 1] === 0) ||
          (x < width - 1 && alphaSnap[pi + 1] === 0) ||
          (y > 0 && alphaSnap[pi - width] === 0) ||
          (y < height - 1 && alphaSnap[pi + width] === 0);

        if (hasTransparent) {
          const i = pi * 4;
          data[i] = r;
          data[i + 1] = g;
          data[i + 2] = b;
          // alpha unchanged
        }
      }
    }
  }

  return out;
}
```

**Step 4: Run tests to verify they pass**

```bash
npx vitest run src/lib/__tests__/chromaKey.test.ts
```

Expected: All tests pass (including all pre-existing tests).

**Step 5: Commit**

```bash
git add src/lib/chromaKey.ts src/lib/__tests__/chromaKey.test.ts
git commit -m "feat: add outlineSprite() with solidify/expand/recolor phases"
```

---

### Task 2: Wire outline into pipeline, state, UI, and persistence

**Files:**
- Modify: `src/components/grid/SpriteReview.tsx`
- Modify: `src/hooks/useEditorSettings.ts`

---

**Step 1: Add `outlineSprite` to persistence types**

In `src/hooks/useEditorSettings.ts`:

Add to the `EditorSettings` interface (after `pixelizeSize: number;` on line 25):
```typescript
  outlineEnabled: boolean;
  outlineOutDepth: number;
  outlineInDepth: number;
  outlineColor: [number, number, number];
```

Add to `DEFAULTS` (after `pixelizeSize: 32,` on line 43):
```typescript
  outlineEnabled: false,
  outlineOutDepth: 1,
  outlineInDepth: 0,
  outlineColor: [0, 0, 0],
```

**Step 2: Add `outlineSprite` to the import in SpriteReview.tsx**

Change line 19 of `src/components/grid/SpriteReview.tsx`:
```typescript
import { applyChromaKey, defringeRecolor, strikeColors, detectKeyColor } from '../../lib/chromaKey';
```
to:
```typescript
import { applyChromaKey, defringeRecolor, outlineSprite, strikeColors, detectKeyColor } from '../../lib/chromaKey';
```

**Step 3: Add outline params to `processSprite()`**

In `src/components/grid/SpriteReview.tsx`, update the `processSprite` function signature (lines 25-41). Add after `pixelizeSize = 32,`:
```typescript
  outlineEnabled = false,
  outlineOutDepth = 1,
  outlineInDepth = 0,
  outlineColor: RGB = [0, 0, 0],
```

Update the early-return guard (line 43) — add `&& !outlineEnabled` to the condition:
```typescript
  if (!posterizeOutput && !chromaEnabled && struckColors.length === 0 && !hasErasure && !edgeRecolorPasses && !pixelizeEnabled && !outlineEnabled) return sprite;
```

Insert the outline pass after `defringeRecolor` (after line 61) and before `strikeColors`:
```typescript
  if (outlineEnabled) imageData = outlineSprite(imageData, outlineOutDepth, outlineInDepth, outlineColor[0], outlineColor[1], outlineColor[2]);
```

**Step 4: Add state vars in SpriteReview**

In `src/components/grid/SpriteReview.tsx`, after line 175 (`const [pixelizeSize, setPixelizeSize] = useState(32);`), add:
```typescript
  const [outlineEnabled, setOutlineEnabled] = useState(false);
  const [outlineOutDepth, setOutlineOutDepth] = useState(1);
  const [outlineInDepth, setOutlineInDepth] = useState(0);
  const [outlineColor, setOutlineColor] = useState<RGB>([0, 0, 0]);
```

**Step 5: Add outline to the process-sprites effect dependency array and guard**

In the process-sprites `useEffect` guard (line 215), add `&& !outlineEnabled`:
```typescript
    if (!post.posterizeOutput && !chroma.chromaEnabled && struckColors.length === 0 && selection.erasedPixels.size === 0 && !chroma.edgeRecolorPasses && !pixelizeEnabled && !outlineEnabled) {
```

In the `processSprite` call (line 244), add outline params at the end:
```typescript
        processSprite(s, post.posterizeOutput, post.posterizeBits, chroma.chromaEnabled, chroma.chromaTolerance, struckColors, selection.erasedPixels.get(s.cellIndex), chroma.edgeRecolorPasses, chroma.recolorSensitivity, chroma.defringeCore, keyR, keyG, keyB, pixelizeEnabled, pixelizeSize, outlineEnabled, outlineOutDepth, outlineInDepth, outlineColor),
```

Add `outlineEnabled, outlineOutDepth, outlineInDepth, outlineColor` to the `useEffect` dependency array at line 250.

**Step 6: Add outline to load and save settings**

In the `loadSettings` block (lines 299-300), after `setPixelizeSize(settings.pixelizeSize ?? 32);` add:
```typescript
        setOutlineEnabled(settings.outlineEnabled ?? false);
        setOutlineOutDepth(settings.outlineOutDepth ?? 1);
        setOutlineInDepth(settings.outlineInDepth ?? 0);
        setOutlineColor(settings.outlineColor ?? [0, 0, 0]);
```

In the `saveSettings` call (lines 326-341), add after `pixelizeSize,`:
```typescript
      outlineEnabled,
      outlineOutDepth,
      outlineInDepth,
      outlineColor,
```

Add `outlineEnabled, outlineOutDepth, outlineInDepth, outlineColor` to the save-settings `useEffect` dependency array (line 342).

**Step 7: Add outline UI in sidebar**

In `src/components/grid/SpriteReview.tsx`, insert a new `sidebar-section` directly after the Pixelize section (after the closing `</div>` of the Pixelize section, around line 647). Insert this:

```tsx
        {/* Outline */}
        <div className="sidebar-section">
          <h3>
            Outline
            <span title="Paint a pixel outline around sprites. Outward adds pixels into the transparent area; Inward recolors the outermost opaque ring." style={{ cursor: 'help', marginLeft: 4, fontSize: '0.7rem', color: 'var(--text-muted)' }}>&#9432;</span>
          </h3>
          <div className="anim-group-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <button
              className={`anim-group-btn ${!outlineEnabled ? 'active' : ''}`}
              onClick={() => setOutlineEnabled(false)}
            >
              Off
            </button>
            <button
              className={`anim-group-btn ${outlineEnabled ? 'active' : ''}`}
              onClick={() => setOutlineEnabled(true)}
            >
              On
            </button>
          </div>
          {outlineEnabled && (
            <>
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Out</label>
                    <span className="slider-value">{outlineOutDepth}</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={8}
                    value={outlineOutDepth}
                    onChange={(e) => setOutlineOutDepth(Number(e.target.value))}
                    style={{ width: '100%' }}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>In</label>
                    <span className="slider-value">{outlineInDepth}</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={8}
                    value={outlineInDepth}
                    onChange={(e) => setOutlineInDepth(Number(e.target.value))}
                    style={{ width: '100%' }}
                  />
                </div>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8 }}>
                {/* Fixed: black and white */}
                {([[0,0,0],[255,255,255]] as RGB[]).map(([cr, cg, cb], idx) => {
                  const isSelected = outlineColor[0] === cr && outlineColor[1] === cg && outlineColor[2] === cb;
                  return (
                    <button
                      key={idx}
                      onClick={() => setOutlineColor([cr, cg, cb])}
                      title={idx === 0 ? 'Black' : 'White'}
                      style={{
                        width: 24,
                        height: 24,
                        backgroundColor: `rgb(${cr},${cg},${cb})`,
                        border: isSelected ? '2px solid var(--accent)' : '2px solid var(--border)',
                        borderRadius: 4,
                        cursor: 'pointer',
                      }}
                    />
                  );
                })}
                {/* Top 10 palette colors */}
                {palette.slice(0, 10).map(([cr, cg, cb], i) => {
                  const isSelected = outlineColor[0] === cr && outlineColor[1] === cg && outlineColor[2] === cb;
                  return (
                    <button
                      key={i + 2}
                      onClick={() => setOutlineColor([cr, cg, cb])}
                      title={`rgb(${cr}, ${cg}, ${cb})`}
                      style={{
                        width: 24,
                        height: 24,
                        backgroundColor: `rgb(${cr},${cg},${cb})`,
                        border: isSelected ? '2px solid var(--accent)' : '2px solid var(--border)',
                        borderRadius: 4,
                        cursor: 'pointer',
                      }}
                    />
                  );
                })}
              </div>
            </>
          )}
        </div>
```

**Step 8: Run the full test suite**

```bash
npx vitest run
```

Expected: All tests pass. No regressions.

**Step 9: Manual smoke test in browser**

1. Open a generation with sprites that have a magenta background.
2. Enable Chroma Key → verify sprites go transparent.
3. Enable Outline (On). Set Out=1, In=0, color=Black → verify black border appears 1px outside sprites.
4. Set Out=0, In=1 → verify innermost ring of sprite pixels turns black, no new pixels added outside.
5. Set Out=2, In=2 → verify 2px outward ring + 2px inward recolor.
6. Change color to white, then a palette swatch → verify color updates live.
7. Switch to a different generation, return → verify outline settings are restored from persistence.

**Step 10: Commit**

```bash
git add src/components/grid/SpriteReview.tsx src/hooks/useEditorSettings.ts
git commit -m "feat: wire outline recolor into pipeline, state, UI, and persistence"
```
