# SpriteReview Modularization & Architecture Cleanup

> **For Claude:** REQUIRED SUB-SKILL: Use h-superpowers:subagent-driven-development, h-superpowers:team-driven-development, or h-superpowers:executing-plans to implement this plan (ask user which approach).

**Goal:** Break apart the 1259-line SpriteReview god component and address architectural debt identified in the perspective review, improving modularization, eliminating monolithic files, and promoting common logic reuse.

**Architecture:** Extract pure processing logic from component files into `src/lib/`, introduce a typed options object for the 22-parameter `processSprite` function, consolidate ~15 post-processing `useState` calls into a single state object managed by `useReducer`, extract sidebar JSX into focused sub-components, and fix the stale-closure bug in `useRegenerateWithFeedback`.

**Tech Stack:** React 19, TypeScript, Vitest (unit tests via `npm run test:unit`), canvas-based image processing

---

## Phase 1: Bug Fix & Type Consolidation

### Task 1: Fix stale closure in useRegenerateWithFeedback

The `regenerate` callback captures `state` in its closure and has `state` in its dependency array. The other three generation hooks (`useGenericWorkflow`, `useRunWorkflow`, `useAddSheet`) all use the `stateRef` pattern to avoid stale closures. This is a real bug — if state changes between render and callback execution, the callback uses stale data for API calls that modify server state.

**Files:**
- Modify: `src/hooks/useRegenerateWithFeedback.ts`

**Step 1: Add stateRef pattern**

Replace the direct `state` capture with a ref, matching the pattern from `useGenericWorkflow.ts:273-274`, `useRunWorkflow.ts:21-22`, and `useAddSheet.ts:34-35`.

```typescript
// In useRegenerateWithFeedback(), after the existing lines:
//   const { state, dispatch } = useAppContext();
//   const abortRef = useRef<AbortController | null>(null);

// ADD:
const stateRef = useRef(state);
stateRef.current = state;
```

**Step 2: Update regenerate callback to use stateRef**

In the `regenerate` callback (line 28), change `const currentState = state;` to `const currentState = stateRef.current;` and remove `state` from the dependency array.

```typescript
const regenerate = useCallback(async (opts: RegenerateOptions) => {
    if (isGeneratingRef.current) return;
    isGeneratingRef.current = true;
    setGenerating(true);

    const abort = new AbortController();
    abortRef.current = abort;

    try {
      const { gridLink, imageSize, feedbackState } = opts;
      const currentState = stateRef.current;  // <-- was: state
      // ... rest unchanged
    } finally {
      // ... unchanged
    }
  }, [dispatch]);  // <-- remove state from deps
```

**Step 3: Verify the app compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add src/hooks/useRegenerateWithFeedback.ts
git commit -m "fix: use stateRef pattern in useRegenerateWithFeedback to prevent stale closures"
```

---

### Task 2: Consolidate duplicated RGB type

`type RGB = [number, number, number]` is defined independently in 3 files: `SpriteReview.tsx:29`, `SpriteZoomModal.tsx:10`, `useEditorSettings.ts:8`. The `chromaKey.ts` module uses `[number, number, number]` inline. Define it once and import everywhere.

**Files:**
- Create: `src/types/color.ts`
- Modify: `src/components/grid/SpriteReview.tsx` (remove local `type RGB`)
- Modify: `src/components/grid/SpriteZoomModal.tsx` (remove local `type RGB`)
- Modify: `src/hooks/useEditorSettings.ts` (remove local `type RGB`)

**Step 1: Create the shared type file**

```typescript
// src/types/color.ts
/** RGB color as a 3-element tuple [red, green, blue], each 0-255. */
export type RGB = [number, number, number];
```

**Step 2: Replace local definitions with imports**

In each of the 3 files, remove `type RGB = [number, number, number];` and add `import type { RGB } from '../../types/color';` (or appropriate relative path).

- `SpriteReview.tsx:29` — remove the line, add import
- `SpriteZoomModal.tsx:10` — remove the line, add import
- `useEditorSettings.ts:8` — remove the line, add `import type { RGB } from '../types/color';`

**Step 3: Verify the app compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add src/types/color.ts src/components/grid/SpriteReview.tsx src/components/grid/SpriteZoomModal.tsx src/hooks/useEditorSettings.ts
git commit -m "refactor: consolidate RGB type into src/types/color.ts"
```

---

### Task 3: Delete duplicate GridOverride in api.ts

`GridOverride` is defined in both `src/lib/spriteExtractor.ts:33-38` (the real consumer) and `src/types/api.ts:110-113`. The `api.ts` copy appears unused by any import.

**Files:**
- Modify: `src/types/api.ts` (remove lines 109-115)

**Step 1: Verify api.ts GridOverride is unused**

Run: `grep -r "from.*api.*GridOverride\|api.*import.*GridOverride" src/` to confirm nothing imports `GridOverride` from `api.ts`.

**Step 2: Remove the duplicate interface**

Delete lines 109-115 from `src/types/api.ts` (the `GridOverride` interface and its comment).

**Step 3: Verify the app compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add src/types/api.ts
git commit -m "refactor: remove duplicate GridOverride from api.ts (canonical copy in spriteExtractor.ts)"
```

---

## Phase 2: Extract processSprite to Library

### Task 4: Define ProcessSpriteOptions interface

The 22-parameter `processSprite` function is the core refactoring target. Its parameters naturally group into sub-configs matching the sidebar sections. This task creates the options type that both the function and the new state hook will use.

**Files:**
- Create: `src/lib/spriteProcessor.ts`
- Test: `src/lib/__tests__/spriteProcessor.test.ts`

**Step 1: Write failing test for processSprite with options object**

```typescript
// src/lib/__tests__/spriteProcessor.test.ts
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
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/__tests__/spriteProcessor.test.ts`
Expected: FAIL — `ProcessSpriteOptions` not found

**Step 3: Write the type and re-export processSprite/detectPalette**

```typescript
// src/lib/spriteProcessor.ts
import type { RGB } from '../types/color';
import type { ExtractedSprite } from './spriteExtractor';
import { pixelizeSprite } from './spriteExtractor';
import { applyChromaKey, defringeRecolor, snapAlpha, outlineSprite, strikeColors, detectKeyColor } from './chromaKey';
import { posterize } from './imagePreprocess';

export interface PosterizeConfig {
  enabled: boolean;
  bits: number;
}

export interface ChromaConfig {
  enabled: boolean;
  tolerance: number;
  defringeCore: number;
  edgeRecolorPasses: number;
  recolorSensitivity: number;
}

export interface PixelizeConfig {
  enabled: boolean;
  size: number;
}

export interface OutlineConfig {
  enabled: boolean;
  outDepth: number;
  inDepth: number;
  color: RGB;
}

export interface AlphaSnapConfig {
  enabled: boolean;
  threshold: number;
}

export interface ColorStrikeConfig {
  colors: RGB[];
  tolerance: number;
}

export interface ProcessSpriteOptions {
  posterize: PosterizeConfig;
  chroma: ChromaConfig;
  pixelize: PixelizeConfig;
  outline: OutlineConfig;
  alphaSnap: AlphaSnapConfig;
  colorStrike: ColorStrikeConfig;
  erasedPixels?: Set<string>;
  /** Chroma key color auto-detected per batch; pass through if pre-detected */
  chromaKeyColor?: RGB;
}

/** Helper: load a base64 sprite into an Image element. */
function loadSpriteImage(sprite: ExtractedSprite): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load sprite'));
    img.src = `data:${sprite.mimeType};base64,${sprite.imageData}`;
  });
}

/**
 * Apply the full post-processing pipeline to a single sprite.
 * Replaces the 22-parameter function previously defined in SpriteReview.tsx.
 */
export async function processSprite(
  sprite: ExtractedSprite,
  opts: ProcessSpriteOptions,
): Promise<ExtractedSprite> {
  const { posterize: post, chroma, pixelize, outline, alphaSnap, colorStrike } = opts;
  const hasErasure = opts.erasedPixels && opts.erasedPixels.size > 0;

  if (!post.enabled && !chroma.enabled && colorStrike.colors.length === 0 && !hasErasure && !chroma.edgeRecolorPasses && !pixelize.enabled && !outline.enabled && !alphaSnap.enabled) {
    return sprite;
  }

  const img = await loadSpriteImage(sprite);

  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0);

  let imageData = ctx.getImageData(0, 0, img.width, img.height);
  if (post.enabled) imageData = posterize(imageData, post.bits);

  const [keyR, keyG, keyB] = opts.chromaKeyColor ?? [255, 0, 255];
  if (chroma.enabled) imageData = applyChromaKey(imageData, chroma.tolerance, chroma.defringeCore, keyR, keyG, keyB);
  if (chroma.edgeRecolorPasses > 0) imageData = defringeRecolor(imageData, keyR, keyG, keyB, chroma.edgeRecolorPasses, chroma.recolorSensitivity);
  if (alphaSnap.enabled) imageData = snapAlpha(imageData, alphaSnap.threshold);
  if (colorStrike.colors.length > 0) imageData = strikeColors(imageData, colorStrike.colors, colorStrike.tolerance);

  ctx.putImageData(imageData, 0, 0);

  // Pixelize pass
  let workingSprite: ExtractedSprite;
  if (pixelize.enabled) {
    const dataUrl = canvas.toDataURL('image/png');
    const intermediate: ExtractedSprite = { ...sprite, imageData: dataUrl.split(',')[1], mimeType: 'image/png' };
    workingSprite = await pixelizeSprite(intermediate, pixelize.size);
  } else {
    const dataUrl = canvas.toDataURL('image/png');
    workingSprite = { ...sprite, imageData: dataUrl.split(',')[1], mimeType: 'image/png' };
  }

  // Erasure pass
  if (hasErasure) {
    const imgE = await loadSpriteImage(workingSprite);
    const cE = document.createElement('canvas');
    cE.width = imgE.width;
    cE.height = imgE.height;
    const ctxE = cE.getContext('2d')!;
    ctxE.drawImage(imgE, 0, 0);
    const idE = ctxE.getImageData(0, 0, imgE.width, imgE.height);
    const scaleX = imgE.width / sprite.width;
    const scaleY = imgE.height / sprite.height;
    for (const key of opts.erasedPixels!) {
      const sep = key.indexOf(',');
      const ex = parseInt(key.substring(0, sep), 10);
      const ey = parseInt(key.substring(sep + 1), 10);
      const sx = Math.round(ex * scaleX);
      const sy = Math.round(ey * scaleY);
      if (sx >= 0 && sy >= 0 && sx < imgE.width && sy < imgE.height) {
        idE.data[(sy * imgE.width + sx) * 4 + 3] = 0;
      }
    }
    ctxE.putImageData(idE, 0, 0);
    workingSprite = { ...workingSprite, imageData: cE.toDataURL('image/png').split(',')[1], mimeType: 'image/png' };
  }

  // Outline pass
  if (outline.enabled) {
    const img2 = await loadSpriteImage(workingSprite);
    const c2 = document.createElement('canvas');
    c2.width = img2.width;
    c2.height = img2.height;
    const ctx2 = c2.getContext('2d')!;
    ctx2.drawImage(img2, 0, 0);
    let id2 = ctx2.getImageData(0, 0, img2.width, img2.height);
    id2 = outlineSprite(id2, outline.outDepth, outline.inDepth, outline.color[0], outline.color[1], outline.color[2]);
    ctx2.putImageData(id2, 0, 0);
    return { ...workingSprite, imageData: c2.toDataURL('image/png').split(',')[1], mimeType: 'image/png' };
  }

  return workingSprite;
}

/**
 * Detect distinct colors from sprites using 4-bit quantization.
 * Moved from SpriteReview.tsx — pure function with no React dependency.
 */
export async function detectPalette(sprites: ExtractedSprite[], maxColors = 144): Promise<RGB[]> {
  const counts = new Map<number, { r: number; g: number; b: number; n: number }>();

  for (const sprite of sprites.slice(0, 12)) {
    const img = await loadSpriteImage(sprite);
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0);
    const data = ctx.getImageData(0, 0, img.width, img.height).data;

    for (let i = 0; i < data.length; i += 8) {
      if (data[i + 3] === 0) continue;
      const qr = data[i] >> 4;
      const qg = data[i + 1] >> 4;
      const qb = data[i + 2] >> 4;
      const key = (qr << 8) | (qg << 4) | qb;
      const entry = counts.get(key);
      if (entry) {
        entry.r += data[i];
        entry.g += data[i + 1];
        entry.b += data[i + 2];
        entry.n++;
      } else {
        counts.set(key, { r: data[i], g: data[i + 1], b: data[i + 2], n: 1 });
      }
    }
  }

  return Array.from(counts.values())
    .sort((a, b) => b.n - a.n)
    .slice(0, maxColors)
    .map((e) => [Math.round(e.r / e.n), Math.round(e.g / e.n), Math.round(e.b / e.n)]);
}

/**
 * Auto-detect the chroma key color from the first sprite in a batch.
 * Extracted so the detection runs once per batch, not per-sprite.
 */
export async function detectChromaKeyColor(sprites: ExtractedSprite[]): Promise<RGB> {
  if (sprites.length === 0) return [255, 0, 255];
  const first = sprites[0];
  const img = await loadSpriteImage(first);
  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0);
  const imageData = ctx.getImageData(0, 0, img.width, img.height);
  return detectKeyColor(imageData) as RGB;
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/__tests__/spriteProcessor.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/spriteProcessor.ts src/lib/__tests__/spriteProcessor.test.ts
git commit -m "refactor: extract processSprite and detectPalette to src/lib/spriteProcessor.ts"
```

---

### Task 5: Wire SpriteReview to use the extracted processSprite

Replace the inline `processSprite` and `detectPalette` in `SpriteReview.tsx` with imports from the new module.

**Files:**
- Modify: `src/components/grid/SpriteReview.tsx`

**Step 1: Replace inline functions with imports**

At the top of `SpriteReview.tsx`, add:
```typescript
import { processSprite, detectPalette, detectChromaKeyColor } from '../../lib/spriteProcessor';
import type { ProcessSpriteOptions } from '../../lib/spriteProcessor';
```

Delete the entire `async function processSprite(...)` block (lines 31-143) and the `async function detectPalette(...)` block (lines 146-188).

**Step 2: Update the palette detection effect (around line 295)**

Replace the `processSprite` call in the palette detection effect:
```typescript
const sourcePromise = post.posterizeOutput
  ? Promise.all(sprites.map(s => processSprite(s, {
      posterize: { enabled: true, bits: post.posterizeBits },
      chroma: { enabled: false, tolerance: 0, defringeCore: 0, edgeRecolorPasses: 0, recolorSensitivity: 0 },
      pixelize: { enabled: false, size: 32 },
      outline: { enabled: false, outDepth: 0, inDepth: 0, color: [0, 0, 0] },
      alphaSnap: { enabled: false, threshold: 128 },
      colorStrike: { colors: [], tolerance: 0 },
    })))
  : Promise.resolve(sprites);
```

**Step 3: Update the main processing effect (around line 314)**

Replace the ~300-character `processSprite` call site with the options object:
```typescript
(async () => {
  let chromaKeyColor: RGB | undefined;
  if (chroma.chromaEnabled && sprites.length > 0) {
    chromaKeyColor = await detectChromaKeyColor(sprites);
    debugLog(`[ChromaKey] Auto-detected key color: rgb(${chromaKeyColor.join(', ')})`);
  }

  const opts: ProcessSpriteOptions = {
    posterize: { enabled: post.posterizeOutput, bits: post.posterizeBits },
    chroma: {
      enabled: chroma.chromaEnabled,
      tolerance: chroma.chromaTolerance,
      defringeCore: chroma.defringeCore,
      edgeRecolorPasses: chroma.edgeRecolorPasses,
      recolorSensitivity: chroma.recolorSensitivity,
    },
    pixelize: { enabled: pixelizeEnabled, size: pixelizeSize },
    outline: { enabled: outlineEnabled, outDepth: outlineOutDepth, inDepth: outlineInDepth, color: outlineColor },
    alphaSnap: { enabled: alphaSnapEnabled, threshold: alphaSnapThreshold },
    colorStrike: { colors: struckColors, tolerance: strikeTolerance },
    chromaKeyColor,
  };

  const result = await Promise.all(sprites.map((s) =>
    processSprite(s, { ...opts, erasedPixels: selection.erasedPixels.get(s.cellIndex) }),
  ));
  if (!cancelled) setProcessedSprites(result);
})();
```

**Step 4: Verify the app compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 5: Commit**

```bash
git add src/components/grid/SpriteReview.tsx
git commit -m "refactor: wire SpriteReview to use extracted processSprite from lib"
```

---

## Phase 3: Decompose SpriteReview Component

### Task 6: Create usePostProcessingState hook

Consolidate the ~15 individual `useState` calls for post-processing settings into a single `useReducer`. The parameter groups from `ProcessSpriteOptions` naturally define the state shape.

**Files:**
- Create: `src/hooks/usePostProcessingState.ts`
- Test: `src/hooks/__tests__/usePostProcessingState.test.tsx`

**Step 1: Write failing test**

```typescript
// src/hooks/__tests__/usePostProcessingState.test.tsx
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePostProcessingState } from '../usePostProcessingState';

describe('usePostProcessingState', () => {
  it('returns default state', () => {
    const { result } = renderHook(() => usePostProcessingState());
    expect(result.current.state.pixelize.enabled).toBe(false);
    expect(result.current.state.pixelize.size).toBe(32);
    expect(result.current.state.outline.enabled).toBe(false);
    expect(result.current.state.colorStrike.colors).toEqual([]);
    expect(result.current.state.struckColors).toEqual([]);
  });

  it('can update pixelize settings', () => {
    const { result } = renderHook(() => usePostProcessingState());
    act(() => result.current.dispatch({ type: 'SET_PIXELIZE', enabled: true, size: 64 }));
    expect(result.current.state.pixelize.enabled).toBe(true);
    expect(result.current.state.pixelize.size).toBe(64);
  });

  it('can add and clear struck colors', () => {
    const { result } = renderHook(() => usePostProcessingState());
    act(() => result.current.dispatch({ type: 'STRIKE_COLOR', color: [255, 0, 0] }));
    expect(result.current.state.struckColors).toEqual([[255, 0, 0]]);
    act(() => result.current.dispatch({ type: 'CLEAR_STRUCK_COLORS' }));
    expect(result.current.state.struckColors).toEqual([]);
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
    expect(result.current.state.struckColors).toEqual([[0, 128, 0]]);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/hooks/__tests__/usePostProcessingState.test.tsx`
Expected: FAIL

**Step 3: Implement the hook**

```typescript
// src/hooks/usePostProcessingState.ts
import { useReducer } from 'react';
import type { RGB } from '../types/color';

export interface PostProcessingState {
  pixelize: { enabled: boolean; size: number };
  outline: { enabled: boolean; outDepth: number; inDepth: number; color: RGB };
  alphaSnap: { enabled: boolean; threshold: number };
  struckColors: RGB[];
  strikeTolerance: number;
  showRareColors: boolean;
  aaInset: number;
  eraserBrushW: number;
  eraserBrushH: number;
}

export type PostProcessingAction =
  | { type: 'SET_PIXELIZE'; enabled: boolean; size?: number }
  | { type: 'SET_PIXELIZE_SIZE'; size: number }
  | { type: 'SET_OUTLINE'; enabled: boolean }
  | { type: 'SET_OUTLINE_DEPTH'; outDepth?: number; inDepth?: number }
  | { type: 'SET_OUTLINE_COLOR'; color: RGB }
  | { type: 'SET_ALPHA_SNAP'; enabled: boolean; threshold?: number }
  | { type: 'SET_ALPHA_SNAP_THRESHOLD'; threshold: number }
  | { type: 'SET_STRIKE_TOLERANCE'; tolerance: number }
  | { type: 'STRIKE_COLOR'; color: RGB }
  | { type: 'UNSTRIKE_COLOR'; color: RGB }
  | { type: 'CLEAR_STRUCK_COLORS' }
  | { type: 'SET_SHOW_RARE_COLORS'; show: boolean }
  | { type: 'SET_AA_INSET'; inset: number }
  | { type: 'SET_ERASER_BRUSH'; w?: number; h?: number }
  | { type: 'RESTORE'; settings: Partial<{
      pixelizeEnabled: boolean; pixelizeSize: number;
      outlineEnabled: boolean; outlineOutDepth: number; outlineInDepth: number; outlineColor: RGB;
      alphaSnapEnabled: boolean; alphaSnapThreshold: number;
      strikeTolerance: number; struckColors: RGB[];
      aaInset: number;
    }> }
  | { type: 'RESET' };

const INITIAL: PostProcessingState = {
  pixelize: { enabled: false, size: 32 },
  outline: { enabled: false, outDepth: 1, inDepth: 0, color: [0, 0, 0] },
  alphaSnap: { enabled: false, threshold: 128 },
  struckColors: [],
  strikeTolerance: 10,
  showRareColors: false,
  aaInset: 3,
  eraserBrushW: 1,
  eraserBrushH: 1,
};

function colorEquals(a: RGB, b: RGB): boolean {
  return a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
}

function reducer(state: PostProcessingState, action: PostProcessingAction): PostProcessingState {
  switch (action.type) {
    case 'SET_PIXELIZE':
      return { ...state, pixelize: { enabled: action.enabled, size: action.size ?? state.pixelize.size } };
    case 'SET_PIXELIZE_SIZE':
      return { ...state, pixelize: { ...state.pixelize, size: action.size } };
    case 'SET_OUTLINE':
      return { ...state, outline: { ...state.outline, enabled: action.enabled } };
    case 'SET_OUTLINE_DEPTH':
      return { ...state, outline: { ...state.outline, outDepth: action.outDepth ?? state.outline.outDepth, inDepth: action.inDepth ?? state.outline.inDepth } };
    case 'SET_OUTLINE_COLOR':
      return { ...state, outline: { ...state.outline, color: action.color } };
    case 'SET_ALPHA_SNAP':
      return { ...state, alphaSnap: { enabled: action.enabled, threshold: action.threshold ?? state.alphaSnap.threshold } };
    case 'SET_ALPHA_SNAP_THRESHOLD':
      return { ...state, alphaSnap: { ...state.alphaSnap, threshold: action.threshold } };
    case 'SET_STRIKE_TOLERANCE':
      return { ...state, strikeTolerance: action.tolerance };
    case 'STRIKE_COLOR':
      if (state.struckColors.some(c => colorEquals(c, action.color))) return state;
      return { ...state, struckColors: [...state.struckColors, action.color] };
    case 'UNSTRIKE_COLOR':
      return { ...state, struckColors: state.struckColors.filter(c => !colorEquals(c, action.color)) };
    case 'CLEAR_STRUCK_COLORS':
      return { ...state, struckColors: [] };
    case 'SET_SHOW_RARE_COLORS':
      return { ...state, showRareColors: action.show };
    case 'SET_AA_INSET':
      return { ...state, aaInset: action.inset };
    case 'SET_ERASER_BRUSH':
      return { ...state, eraserBrushW: action.w ?? state.eraserBrushW, eraserBrushH: action.h ?? state.eraserBrushH };
    case 'RESTORE': {
      const s = action.settings;
      return {
        ...state,
        pixelize: { enabled: s.pixelizeEnabled ?? state.pixelize.enabled, size: s.pixelizeSize ?? state.pixelize.size },
        outline: {
          enabled: s.outlineEnabled ?? state.outline.enabled,
          outDepth: s.outlineOutDepth ?? state.outline.outDepth,
          inDepth: s.outlineInDepth ?? state.outline.inDepth,
          color: s.outlineColor ?? state.outline.color,
        },
        alphaSnap: { enabled: s.alphaSnapEnabled ?? state.alphaSnap.enabled, threshold: s.alphaSnapThreshold ?? state.alphaSnap.threshold },
        strikeTolerance: s.strikeTolerance ?? state.strikeTolerance,
        struckColors: s.struckColors ?? state.struckColors,
        aaInset: s.aaInset ?? state.aaInset,
      };
    }
    case 'RESET':
      return INITIAL;
    default:
      return state;
  }
}

export function usePostProcessingState() {
  const [state, dispatch] = useReducer(reducer, INITIAL);
  return { state, dispatch };
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/hooks/__tests__/usePostProcessingState.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add src/hooks/usePostProcessingState.ts src/hooks/__tests__/usePostProcessingState.test.tsx
git commit -m "feat: add usePostProcessingState hook consolidating 15 useState calls"
```

---

### Task 7: Extract PostProcessingSidebar component

The sidebar JSX in SpriteReview (lines ~783-1174, roughly 400 lines) is all post-processing controls: Posterize, Pixelize, Outline, Chroma Key, Color Striker, Re-extract. Extract it into a standalone component that receives the post-processing state and dispatch.

**Files:**
- Create: `src/components/grid/PostProcessingSidebar.tsx`
- Modify: `src/components/grid/SpriteReview.tsx`

**Step 1: Create PostProcessingSidebar component**

Create `src/components/grid/PostProcessingSidebar.tsx`. This component receives:
- `postState` and `postDispatch` from `usePostProcessingState`
- `chroma` from `useChromaKeySettings`
- `post` (posterize) from `usePosterizeSettings`
- `palette: RGB[]`
- `reExtract` callback
- `onZoomStrikeColor` / `onZoomUnstrikeColor` callbacks

Move the entire `<SidebarGroup label="Post-Processing">` block from SpriteReview into this component, replacing individual state setters with `postDispatch` calls.

This is a mechanical move — the JSX and logic are identical, just wired through the consolidated state instead of individual `useState` hooks.

**Step 2: Update SpriteReview to render PostProcessingSidebar**

Replace the ~400 lines of sidebar JSX with:
```tsx
<PostProcessingSidebar
  postState={postState}
  postDispatch={postDispatch}
  chroma={chroma}
  posterize={post}
  palette={palette}
  reExtract={reExtract}
/>
```

**Step 3: Verify the app compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add src/components/grid/PostProcessingSidebar.tsx src/components/grid/SpriteReview.tsx
git commit -m "refactor: extract PostProcessingSidebar from SpriteReview (~400 lines)"
```

---

### Task 8: Extract ReviewActions component

The Actions sidebar group (lines ~1177-1209) plus version bar (lines ~683-709) are a coherent unit: export controls, add-sheet button, feedback/regenerate button, back button, and version navigation.

**Files:**
- Create: `src/components/grid/ReviewActions.tsx`
- Modify: `src/components/grid/SpriteReview.tsx`

**Step 1: Create ReviewActions component**

Extract the version bar and `<SidebarGroup label="Actions">` block into `ReviewActions`. Props:
- `displaySprites`, `dynamicCols`, `state`, `dispatch`
- `handleExportSheet`, `handleExportIndividual`
- `onAddSheet`, `onFeedbackOpen`, `onBack`
- `versionInfo`, `navigateToVersion`

**Step 2: Update SpriteReview to render ReviewActions**

Replace the version bar and Actions SidebarGroup with:
```tsx
<ReviewActions
  versionInfo={versionInfo}
  onNavigateVersion={navigateToVersion}
  onExportSheet={handleExportSheet}
  onExportIndividual={handleExportIndividual}
  onAddSheet={() => setAddSheetOpen(true)}
  onFeedbackOpen={() => setFeedbackPanelOpen(true)}
  onBack={() => setStep('configure')}
/>
```

**Step 3: Verify the app compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add src/components/grid/ReviewActions.tsx src/components/grid/SpriteReview.tsx
git commit -m "refactor: extract ReviewActions from SpriteReview"
```

---

### Task 9: Wire usePostProcessingState into SpriteReview

Replace the ~15 individual `useState` calls in SpriteReview with the consolidated `usePostProcessingState` hook. Update the settings load/save effects to use the hook's `dispatch({ type: 'RESTORE' })` and `state` object.

**Files:**
- Modify: `src/components/grid/SpriteReview.tsx`

**Step 1: Replace useState calls with usePostProcessingState**

Remove these individual state declarations (lines ~252-267):
```
struckColors, showRareColors, aaInset, pixelizeEnabled, pixelizeSize,
outlineEnabled, outlineOutDepth, outlineInDepth, outlineColor,
alphaSnapEnabled, alphaSnapThreshold, eraserBrushW, eraserBrushH, strikeTolerance
```

Replace with:
```typescript
const { state: postState, dispatch: postDispatch } = usePostProcessingState();
```

**Step 2: Update settings load effect to use RESTORE**

In the settings load effect, replace individual setter calls with:
```typescript
postDispatch({
  type: 'RESTORE',
  settings: {
    pixelizeEnabled: settings.pixelizeEnabled ?? false,
    pixelizeSize: settings.pixelizeSize ?? 32,
    outlineEnabled: settings.outlineEnabled ?? false,
    outlineOutDepth: settings.outlineOutDepth ?? 1,
    outlineInDepth: settings.outlineInDepth ?? 0,
    outlineColor: settings.outlineColor ?? [0, 0, 0],
    alphaSnapEnabled: settings.alphaSnapEnabled ?? false,
    alphaSnapThreshold: settings.alphaSnapThreshold ?? 128,
    strikeTolerance: settings.strikeTolerance ?? 10,
    struckColors: settings.struckColors,
    aaInset: settings.aaInset,
  },
});
```

**Step 3: Update settings save effect**

Update the save effect to read from `postState` instead of individual state variables.

**Step 4: Verify the app compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 5: Commit**

```bash
git add src/components/grid/SpriteReview.tsx
git commit -m "refactor: wire SpriteReview to usePostProcessingState, replacing 15 useState calls"
```

---

## Phase 4: Reducer Cleanup

### Task 10: Unify LOAD_*_PRESET reducer cases

Four near-identical reducer cases (`LOAD_CHARACTER_PRESET`, `LOAD_BUILDING_PRESET`, `LOAD_TERRAIN_PRESET`, `LOAD_BACKGROUND_PRESET`) do the same thing: update `activeContentPresetIds`, map preset fields to content state, and pad cell labels. Unify them using a config map.

**Files:**
- Modify: `src/context/AppContext.tsx`
- Test: `src/context/__tests__/appReducer.test.ts`

**Step 1: Write failing test for generic LOAD_CONTENT_PRESET action**

Add test to `appReducer.test.ts`:
```typescript
describe('LOAD_CONTENT_PRESET', () => {
  it('loads a building preset via generic action', () => {
    const preset: BuildingPreset = {
      id: 'b1', name: 'Tower', genre: 'fantasy', description: 'A tower',
      colorNotes: '', details: 'tall', overallGuidance: '', groupGuidance: {}, cellGuidance: {},
      spriteType: 'building', gridSize: '3x3', cellLabels: ['a','b','c','d','e','f','g','h','i'],
    };
    const result = reducer(initialState, { type: 'LOAD_CONTENT_PRESET', preset });
    expect(result.activeContentPresetIds.building).toBe('b1');
    expect(result.building.name).toBe('Tower');
    expect(result.building.details).toBe('tall');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/context/__tests__/appReducer.test.ts`
Expected: FAIL — `LOAD_CONTENT_PRESET` not a valid action type

**Step 3: Add LOAD_CONTENT_PRESET action**

Add to the Action union:
```typescript
| { type: 'LOAD_CONTENT_PRESET'; preset: AnyPreset }
```

Add a single generic handler in the reducer that dispatches by `preset.spriteType`, using a helper function to map preset fields to content state and pad cell labels. The four existing `LOAD_*_PRESET` cases remain temporarily as aliases.

**Step 4: Run tests**

Run: `npx vitest run src/context/__tests__/appReducer.test.ts`
Expected: PASS

**Step 5: Migrate callers to LOAD_CONTENT_PRESET**

Search for all dispatch calls using the four specific actions and replace with the generic one. Then remove the four specific cases from the reducer.

**Step 6: Run all unit tests**

Run: `npx vitest run`
Expected: All pass

**Step 7: Commit**

```bash
git add src/context/AppContext.tsx src/context/__tests__/appReducer.test.ts
git commit -m "refactor: unify four LOAD_*_PRESET reducer cases into generic LOAD_CONTENT_PRESET"
```

---

## Phase 5: Final Verification

### Task 11: Run full test suite and type check

**Step 1: Type check**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 2: Run all unit tests**

Run: `npx vitest run`
Expected: All pass

**Step 3: Verify SpriteReview line count**

Run: `wc -l src/components/grid/SpriteReview.tsx`
Expected: ~400-500 lines (down from 1259)

**Step 4: Final commit if any cleanup needed**

---

## Summary of Expected Outcomes

| Metric | Before | After |
|--------|--------|-------|
| SpriteReview.tsx lines | 1259 | ~400-500 |
| processSprite parameters | 22 positional | 1 options object |
| Post-processing useState calls | ~15 | 1 useReducer |
| RGB type definitions | 3 duplicates | 1 shared |
| GridOverride definitions | 2 duplicates | 1 |
| LOAD_*_PRESET reducer cases | 4 near-identical | 1 generic |
| Stale closure bug | Present | Fixed |

## Out of Scope (Future Work)

These items from the review are intentionally deferred:
- **Settings load/save state machine** — `skipNextSaveRef` refactoring (medium risk, needs careful testing)
- **GridDimensions value object** — cross-cutting change touching many files
- **Richer history data model** — requires server-side schema changes
- **API boundary validation** — systematic effort across all fetch calls
- **sharedAbortController refactoring** — needs architecture decision on cancellation ownership
- **`as any` / `as Action` casts in UnifiedConfigPanel** — type system work requiring generic redesign
