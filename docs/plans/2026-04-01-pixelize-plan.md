# Pixelize Feature Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use h-superpowers:subagent-driven-development, h-superpowers:team-driven-development, or h-superpowers:executing-plans to implement this plan (ask user which approach).

**Goal:** Add a non-destructive pixelize post-processing pass that downscales normalized 1:1 sprites to retro pixel art sizes (16/32/48/64/128), with matching Gemini prompt guidance so the AI generates art suited to the target resolution.

**Architecture:** A `pixelizeSprite()` function in `spriteExtractor.ts` does nearest-neighbor downscaling. In `SpriteReview`, two new state vars (`pixelizeEnabled`, `pixelizeSize`) drive a sidebar toggle + size buttons, and the pixelize pass runs last in `processSprite()`. `SpriteGrid` gets an `imageRendering: pixelated` CSS prop when enabled. At generation time, `UnifiedConfigPanel` passes `pixelizeSize` through `buildPromptForType()` into each prompt builder, injecting resolution-specific style guidance. Style references are audited across all builders to not assume character sprite proportions.

**Tech Stack:** TypeScript, React, Canvas 2D API (`imageSmoothingEnabled = false`), existing `processSprite()` pipeline in SpriteReview.tsx

---

### Task 1: `pixelizeSprite()` function + tests

**Files:**
- Modify: `src/lib/spriteExtractor.ts` — add `pixelizeSprite()` export near the end, before `composeSpriteSheet`
- Create: `src/lib/__tests__/spriteExtractor.test.ts`

**Step 1: Write the failing test**

Create `src/lib/__tests__/spriteExtractor.test.ts`:

```typescript
import { pixelizeSprite } from '../spriteExtractor';
import { ExtractedSprite } from '../spriteExtractor';

// Minimal 1x1 white PNG base64
const WHITE_1X1_PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI6QAAAABJRU5ErkJggg==';

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
  it('returns a sprite with target dimensions', async () => {
    const sprite = makeSprite(256, 256);
    const result = await pixelizeSprite(sprite, 32);
    expect(result.width).toBe(32);
    expect(result.height).toBe(32);
  });

  it('returns all 5 valid target sizes', async () => {
    const sprite = makeSprite(256, 256);
    for (const size of [16, 32, 48, 64, 128]) {
      const result = await pixelizeSprite(sprite, size);
      expect(result.width).toBe(size);
      expect(result.height).toBe(size);
    }
  });

  it('preserves cellIndex and label', async () => {
    const sprite = { ...makeSprite(128, 128), cellIndex: 5, label: 'Attack 1' };
    const result = await pixelizeSprite(sprite, 16);
    expect(result.cellIndex).toBe(5);
    expect(result.label).toBe('Attack 1');
  });

  it('returns a valid base64 PNG string', async () => {
    const sprite = makeSprite(256, 256);
    const result = await pixelizeSprite(sprite, 32);
    expect(result.imageData).toBeTruthy();
    expect(result.mimeType).toBe('image/png');
    // Should be a non-empty base64 string
    expect(result.imageData.length).toBeGreaterThan(0);
  });
});
```

**Step 2: Run the test to confirm it fails**

```bash
npm test -- --testPathPattern=spriteExtractor --watch=false
```
Expected: FAIL with `pixelizeSprite is not a function`

**Step 3: Implement `pixelizeSprite()` in `src/lib/spriteExtractor.ts`**

Add this export after `normalizeSprites` (around line 484), before `composeSpriteSheet`:

```typescript
/**
 * Downscale a sprite to a target pixel art size using nearest-neighbor interpolation.
 * Returns a new ExtractedSprite with targetSize×targetSize dimensions.
 * Use imageSmoothingEnabled = false to preserve hard pixel edges.
 */
export async function pixelizeSprite(
  sprite: ExtractedSprite,
  targetSize: number,
): Promise<ExtractedSprite> {
  const img = await loadImage(sprite.imageData, sprite.mimeType);

  const canvas = document.createElement('canvas');
  canvas.width = targetSize;
  canvas.height = targetSize;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, 0, 0, targetSize, targetSize);

  const dataUrl = canvas.toDataURL('image/png');
  return {
    ...sprite,
    imageData: dataUrl.split(',')[1],
    width: targetSize,
    height: targetSize,
  };
}
```

**Step 4: Run the test to confirm it passes**

```bash
npm test -- --testPathPattern=spriteExtractor --watch=false
```
Expected: PASS (4 tests)

**Step 5: Commit**

```bash
git add src/lib/spriteExtractor.ts src/lib/__tests__/spriteExtractor.test.ts
git commit -m "feat: add pixelizeSprite() with nearest-neighbor downscaling"
```

---

### Task 2: `getPixelizeGuidance()` in promptBuilderBase + tests

**Files:**
- Modify: `src/lib/promptBuilderBase.ts` — add `getPixelizeGuidance()` export
- Modify: `src/lib/__tests__/promptBuilder.test.ts` — add tests for the new function

**Step 1: Write the failing tests**

Open `src/lib/__tests__/promptBuilder.test.ts` and add at the end:

```typescript
import { getPixelizeGuidance } from '../promptBuilderBase';

describe('getPixelizeGuidance', () => {
  it('returns guidance for each valid target size', () => {
    expect(getPixelizeGuidance(16)).toContain('extreme pixel art');
    expect(getPixelizeGuidance(32)).toContain('classic pixel art');
    expect(getPixelizeGuidance(48)).toContain('mid-resolution pixel art');
    expect(getPixelizeGuidance(64)).toContain('mid-resolution pixel art');
    expect(getPixelizeGuidance(128)).toContain('high-resolution pixel art');
  });

  it('returns empty string when size is undefined', () => {
    expect(getPixelizeGuidance(undefined)).toBe('');
  });

  it('returns empty string for unknown sizes', () => {
    expect(getPixelizeGuidance(999)).toBe('');
  });
});
```

**Step 2: Run test to confirm it fails**

```bash
npm test -- --testPathPattern=promptBuilder --watch=false
```
Expected: FAIL with `getPixelizeGuidance is not a function`

**Step 3: Implement `getPixelizeGuidance()` in `src/lib/promptBuilderBase.ts`**

Add at the bottom of the file (after the `REFERENCE_PREFIX` export):

```typescript
const PIXELIZE_GUIDANCE: Record<number, string> = {
  16:  'TARGET PIXEL SIZE: 16×16 — Design for extreme pixel art resolution. Use 2–4 flat colors, bold silhouettes, no gradients, no fine detail. Every pixel counts; prioritize readable shape over surface detail.',
  32:  'TARGET PIXEL SIZE: 32×32 — Design for classic pixel art (NES/early SNES era). Limited palette of 4–8 colors, clean shapes, minimal shading. Sprites should read clearly as strong silhouettes.',
  48:  'TARGET PIXEL SIZE: 48×48 — Design for mid-resolution pixel art. Palette of 8–16 colors, defined shading with dithering, readable detail on key features.',
  64:  'TARGET PIXEL SIZE: 64×64 — Design for mid-resolution pixel art. Palette of 8–16 colors, defined shading, fine readable detail on faces, equipment, and surfaces.',
  128: 'TARGET PIXEL SIZE: 128×128 — Design for high-resolution pixel art. Rich palette, detailed shading with smooth dithering, fine features and textures visible. SNES/GBA era fidelity.',
};

/**
 * Return resolution-appropriate style guidance for Gemini based on the pixelize target size.
 * Returns empty string when pixelize is off (undefined) or size is not in the valid set.
 */
export function getPixelizeGuidance(targetSize: number | undefined): string {
  if (targetSize === undefined) return '';
  return PIXELIZE_GUIDANCE[targetSize] ?? '';
}
```

**Step 4: Run test to confirm it passes**

```bash
npm test -- --testPathPattern=promptBuilder --watch=false
```
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/promptBuilderBase.ts src/lib/__tests__/promptBuilder.test.ts
git commit -m "feat: add getPixelizeGuidance() to promptBuilderBase"
```

---

### Task 3: Inject pixelize guidance into `buildPromptForType()`

**Files:**
- Modify: `src/lib/promptForType.ts` — add optional `pixelizeSize?: number` param, append guidance to each built prompt

**Step 1: Update `buildPromptForType()` signature and inject guidance**

Open `src/lib/promptForType.ts`. The function signature at line 25 is:

```typescript
export function buildPromptForType(
  spriteType: SpriteType,
  contentPreset: ContentPreset,
  gridLink: GridLink,
  gridConfig: GridConfig,
  isSubsequentGrid: boolean,
): string {
```

Change to:

```typescript
export function buildPromptForType(
  spriteType: SpriteType,
  contentPreset: ContentPreset,
  gridLink: GridLink,
  gridConfig: GridConfig,
  isSubsequentGrid: boolean,
  pixelizeSize?: number,
): string {
```

Also add the import at the top:

```typescript
import { REFERENCE_PREFIX, getPixelizeGuidance } from './promptBuilderBase';
```

Replace the existing `import { REFERENCE_PREFIX }` line with the above.

At the end of the function, before `return prompt;` (around line 123), add:

```typescript
  const pixelizeGuidance = getPixelizeGuidance(pixelizeSize);
  if (pixelizeGuidance) {
    prompt += `\n\n${pixelizeGuidance}`;
  }
```

**Step 2: Run existing tests to confirm no regression**

```bash
npm test -- --testPathPattern=promptForType --watch=false
```
Expected: PASS (or no test file — that's OK, the import change will cause a compile error if broken)

Also run full test suite:
```bash
npm test -- --watch=false
```
Expected: all existing tests pass

**Step 3: Commit**

```bash
git add src/lib/promptForType.ts
git commit -m "feat: inject pixelizeGuidance into buildPromptForType()"
```

---

### Task 4: Audit and update style references in prompt builders

The goal: ensure each builder's style reference line is specific to its sprite type (not character-centric), and "SNES-era 16-bit" is the default that pixelize guidance overrides at runtime.

**Files:**
- Modify: `src/lib/promptBuilder.ts` — character builder (line 165)
- Modify: `src/lib/buildingPromptBuilder.ts` — building builder (line 38)
- Modify: `src/lib/terrainPromptBuilder.ts` — terrain builder (line 36)
- Modify: `src/lib/backgroundPromptBuilder.ts` — background builder (line ~39)

**Step 1: Audit current style references**

Open each file and find the `Style reference:` bullet. They currently read:

- **Character** (`promptBuilder.ts:165`): `Style reference: Final Fantasy VI / Chrono Trigger overworld + battle sprites`
- **Building** (`buildingPromptBuilder.ts:38`): `Style reference: Final Fantasy VI / Chrono Trigger overworld buildings and structures`  
- **Terrain** (`terrainPromptBuilder.ts:36`): `Style reference: Final Fantasy VI / Chrono Trigger overworld tilesets`
- **Background** (`backgroundPromptBuilder.ts:~39`): `Style reference: Final Fantasy VI / Chrono Trigger background art`

These are already type-specific. The issue is the opening line in each builder hardcodes "SNES-era 16-bit pixel-art" — this conflicts with small targets like 16×16. Since pixelize guidance appends a TARGET PIXEL SIZE note that overrides this, update the opening lines to say "pixel-art" without an era assumption, so there's no contradiction:

**In `promptBuilder.ts`** — change the `charBlock` array (around line 157–167):

Old:
```typescript
`Fill every pink cell area with an SNES-era 16-bit pixel-art sprite of a`,
```
New:
```typescript
`Fill every pink cell area with a pixel-art sprite of a`,
```

Also change:
```typescript
`  • Style reference: Final Fantasy VI / Chrono Trigger overworld + battle sprites`,
```
to:
```typescript
`  • Default style reference: Final Fantasy VI / Chrono Trigger overworld + battle sprites (SNES 16-bit)`,
```

**In `buildingPromptBuilder.ts`** (around line 29–41):

Old:
```typescript
`Fill every pink cell area with an SNES-era 16-bit pixel-art sprite of a`,
```
New:
```typescript
`Fill every pink cell area with a pixel-art sprite of a`,
```

Also update style reference bullet:
```typescript
`  • Default style reference: Final Fantasy VI / Chrono Trigger overworld buildings and structures (SNES 16-bit)`,
```

**In `terrainPromptBuilder.ts`** (around line 29):

Old:
```typescript
`Fill every pink cell area with an SNES-era 16-bit pixel-art terrain tile for a`,
```
New:
```typescript
`Fill every pink cell area with a pixel-art terrain tile for a`,
```

Update style reference bullet:
```typescript
`  • Default style reference: Final Fantasy VI / Chrono Trigger overworld tilesets (SNES 16-bit)`,
```

**In `backgroundPromptBuilder.ts`** (around line 29):

Old:
```typescript
`Fill every pink cell area with an SNES-era 16-bit pixel-art background`,
```
New:
```typescript
`Fill every pink cell area with a pixel-art background`,
```

Update style reference bullet:
```typescript
`  • Default style reference: Final Fantasy VI / Chrono Trigger background art (SNES 16-bit)`,
```

**Step 2: Run all tests to confirm no regression**

```bash
npm test -- --watch=false
```
Expected: all tests pass. If any test checks for the literal "SNES-era 16-bit" string, update the test to match the new text.

**Step 3: Commit**

```bash
git add src/lib/promptBuilder.ts src/lib/buildingPromptBuilder.ts src/lib/terrainPromptBuilder.ts src/lib/backgroundPromptBuilder.ts
git commit -m "refactor: remove hardcoded SNES-era assumption from prompt builder opening lines"
```

---

### Task 5: Wire pixelizeSize into UnifiedConfigPanel at generation time

**Files:**
- Modify: `src/components/config/UnifiedConfigPanel.tsx` — add `pixelizeSize` state and UI, pass to `buildPromptForType` for prompt preview

**Step 1: Add `pixelizeSize` state**

In `UnifiedConfigPanel.tsx`, find where `useState` calls are grouped near the top of the component and add:

```typescript
const [pixelizeSize, setPixelizeSize] = useState<number | undefined>(undefined);
```

**Step 2: Find where `buildGridFillPrompt` / `buildBuildingPrompt` etc. are called**

In `UnifiedConfigPanel.tsx`, the prompt builders are called for preview purposes. Find all call sites (there may be a `previewPrompt` state). They all need the `pixelizeSize` passed through. Since the component uses the individual builders (not `buildPromptForType`), the cleanest way is to append the guidance inline:

Find the prompt-building code and after each `buildXxxPrompt(...)` call, add:

```typescript
import { getPixelizeGuidance } from '../../lib/promptBuilderBase';

// ... inside where prompt is built:
const pixelizeGuidance = getPixelizeGuidance(pixelizeSize);
if (pixelizeGuidance) prompt += `\n\n${pixelizeGuidance}`;
```

**Step 3: Add pixelize UI to the config panel**

Find the section in the rendered JSX where generation options are displayed (model selector, image size, etc.) and add:

```tsx
<div className="config-field">
  <label className="config-label">Pixelize Target</label>
  <div className="pixelize-size-row">
    <button
      className={`pixel-size-btn ${pixelizeSize === undefined ? 'active' : ''}`}
      onClick={() => setPixelizeSize(undefined)}
      title="No pixelization — full AI resolution"
    >
      Off
    </button>
    {([16, 32, 48, 64, 128] as const).map(size => (
      <button
        key={size}
        className={`pixel-size-btn ${pixelizeSize === size ? 'active' : ''}`}
        onClick={() => setPixelizeSize(size)}
        title={`Pixelize to ${size}×${size}`}
      >
        {size}
      </button>
    ))}
  </div>
</div>
```

Add CSS in `src/styles/run-builder.css` (or the relevant styles file):

```css
.pixelize-size-row {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}

.pixel-size-btn {
  padding: 3px 8px;
  font-size: 12px;
  border: 1px solid var(--border);
  background: var(--bg-secondary);
  color: var(--text);
  border-radius: 3px;
  cursor: pointer;
}

.pixel-size-btn.active {
  background: var(--accent);
  color: var(--bg);
  border-color: var(--accent);
}
```

**Step 4: Run dev server and verify the config panel shows the pixelize row**

```bash
npm run dev
```

Navigate to the config panel, verify "Pixelize Target" row shows Off/16/32/48/64/128 buttons. Selecting a size should affect the prompt preview if one is shown.

**Step 5: Commit**

```bash
git add src/components/config/UnifiedConfigPanel.tsx src/styles/run-builder.css
git commit -m "feat: add pixelizeSize selector to UnifiedConfigPanel, inject into generation prompt"
```

---

### Task 6: Add pixelize state + UI to SpriteReview, add to processSprite pipeline

**Files:**
- Modify: `src/components/grid/SpriteReview.tsx` — add state, UI, and pipeline step

**Step 1: Add pixelizeEnabled and pixelizeSize state**

In `SpriteReview.tsx`, find the block of `useState` calls (around line 158–164) and add:

```typescript
const [pixelizeEnabled, setPixelizeEnabled] = useState(false);
const [pixelizeSize, setPixelizeSize] = useState(32);
```

Also add the import at the top:
```typescript
import { composeSpriteSheet, ExtractedSprite, pixelizeSprite } from '../../lib/spriteExtractor';
```

**Step 2: Add pixelize pass to `processSprite()`**

The `processSprite` function signature is at line 26. Add two new params at the end:

```typescript
async function processSprite(
  sprite: ExtractedSprite,
  posterizeOutput: boolean,
  posterizeBits: number,
  chromaEnabled: boolean,
  chromaTolerance: number,
  struckColors: RGB[],
  erasedPixels?: Set<string>,
  edgeRecolorPasses = 0,
  recolorSensitivity = 50,
  defringeCore = 240,
  keyR = 255,
  keyG = 0,
  keyB = 255,
  pixelizeEnabled = false,
  pixelizeSize = 32,
): Promise<ExtractedSprite> {
```

Update the early-return guard at line 41 to include pixelize:

```typescript
const hasErasure = erasedPixels && erasedPixels.size > 0;
if (!posterizeOutput && !chromaEnabled && struckColors.length === 0 && !hasErasure && !edgeRecolorPasses && !pixelizeEnabled) return sprite;
```

At the bottom of `processSprite`, after `ctx.putImageData(imageData, 0, 0)` and before the final `return`, add the pixelize pass:

```typescript
  ctx.putImageData(imageData, 0, 0);

  // Pixelize pass — runs last because it changes dimensions
  if (pixelizeEnabled) {
    const dataUrl = canvas.toDataURL('image/png');
    const intermediate = { ...sprite, imageData: dataUrl.split(',')[1], mimeType: 'image/png' as const };
    return pixelizeSprite(intermediate, pixelizeSize);
  }

  const dataUrl = canvas.toDataURL('image/png');
  const base64 = dataUrl.split(',')[1];
  return { ...sprite, imageData: base64, mimeType: 'image/png' };
}
```

**Step 3: Pass new params to all `processSprite()` call sites in SpriteReview**

Search for `processSprite(` in `SpriteReview.tsx`. There will be 2–3 call sites (the main `useEffect`, the palette detection effect, and potentially a re-process path). For each call that should respect pixelization (the main display pipeline), add the two new params:

```typescript
processSprite(
  sprite,
  post.posterizeOutput,
  post.posterizeBits,
  chroma.chromaEnabled,
  chroma.chromaTolerance,
  struckColors,
  erasedPixels,
  chroma.edgeRecolorPasses,
  chroma.recolorSensitivity,
  chroma.defringeCore,
  chroma.keyR,
  chroma.keyG,
  chroma.keyB,
  pixelizeEnabled,   // ← new
  pixelizeSize,      // ← new
)
```

The palette detection call (line ~188) should NOT get pixelize — it detects colors from the original, pixelizing would lose color information. Leave that call site with `false, 32` (defaults).

**Step 4: Add pixelize to the processedSprites useEffect dependency array**

Find the `useEffect` that drives `processedSprites`. Its dependency array will include `struckColors`, `posterize` settings, etc. Add `pixelizeEnabled` and `pixelizeSize`:

```typescript
}, [sprites, post.posterizeOutput, post.posterizeBits, chroma.chromaEnabled, /* ... existing deps ... */, pixelizeEnabled, pixelizeSize]);
```

**Step 5: Add pixelize UI to the sidebar**

Find the posterize controls in the sidebar JSX. They'll look something like a row with a checkbox and bit-depth controls. Add immediately below:

```tsx
{/* Pixelize */}
<div className="process-row">
  <label className="process-toggle">
    <input
      type="checkbox"
      checked={pixelizeEnabled}
      onChange={e => setPixelizeEnabled(e.target.checked)}
    />
    Pixelize
  </label>
  {pixelizeEnabled && (
    <div className="pixelize-size-row">
      {([16, 32, 48, 64, 128] as const).map(size => (
        <button
          key={size}
          className={`pixel-size-btn ${pixelizeSize === size ? 'active' : ''}`}
          onClick={() => setPixelizeSize(size)}
        >
          {size}
        </button>
      ))}
    </div>
  )}
</div>
```

**Step 6: Run dev server and verify**

```bash
npm run dev
```

Generate or load sprites, go to the review step. Toggle Pixelize on, pick 16×16 — sprites should show as blocky pixel art in the grid. Toggle off — original resolution returns. Change sizes — grid updates live.

**Step 7: Run tests**

```bash
npm test -- --watch=false
```
Expected: all pass.

**Step 8: Commit**

```bash
git add src/components/grid/SpriteReview.tsx
git commit -m "feat: add pixelize toggle and size selector to SpriteReview processing pipeline"
```

---

### Task 7: Add `imageRendering: pixelated` to SpriteGrid

**Files:**
- Modify: `src/components/grid/SpriteGrid.tsx` — add `pixelizeEnabled` prop, apply to `<img>` style

**Step 1: Add prop to interface and component**

In `SpriteGrid.tsx`, find the `SpriteGridProps` interface (line 12) and add:

```typescript
/** When true, renders sprites with CSS image-rendering: pixelated for crisp upscaling */
pixelizeEnabled?: boolean;
```

In the destructured props (line 29), add `pixelizeEnabled`:

```typescript
export const SpriteGrid = React.memo(function SpriteGrid({ sprites, onCellClick, selectedCell, mirroredCells, onMirrorToggle, thumbnailCell, onThumbnailSet, onZoomClick, gridCols, cellLabels, pixelizeEnabled }: SpriteGridProps) {
```

**Step 2: Apply `imageRendering: pixelated` to the sprite `<img>` tag**

Find the `<img>` tag inside the cell render (around line 78):

```tsx
<img
  src={`data:${sprite.mimeType};base64,${sprite.imageData}`}
  alt={label}
  draggable={false}
  style={isMirrored ? { transform: 'scaleX(-1)' } : undefined}
/>
```

Change to:

```tsx
<img
  src={`data:${sprite.mimeType};base64,${sprite.imageData}`}
  alt={label}
  draggable={false}
  style={{
    ...(isMirrored ? { transform: 'scaleX(-1)' } : {}),
    ...(pixelizeEnabled ? { imageRendering: 'pixelated' } : {}),
  }}
/>
```

**Step 3: Pass `pixelizeEnabled` from SpriteReview to SpriteGrid**

In `SpriteReview.tsx`, find the `<SpriteGrid ...>` JSX and add the prop:

```tsx
<SpriteGrid
  sprites={displaySprites}
  pixelizeEnabled={pixelizeEnabled}
  // ... other existing props
/>
```

**Step 4: Verify in the browser**

Run the dev server, enable pixelize with a small size (16 or 32). The sprites in the grid should render with hard pixel edges rather than blurry upscaling.

**Step 5: Commit**

```bash
git add src/components/grid/SpriteGrid.tsx src/components/grid/SpriteReview.tsx
git commit -m "feat: apply imageRendering pixelated to SpriteGrid when pixelize is enabled"
```

---

### Task 8: Final integration test

**Step 1: Full test suite**

```bash
npm test -- --watch=false
```
Expected: all tests pass.

**Step 2: Manual smoke test**

1. Start dev server: `npm run dev`
2. Open config panel, set Pixelize Target to 32
3. Generate a character sprite sheet — check that the Gemini prompt in the network tab includes `TARGET PIXEL SIZE: 32×32`
4. After extraction, in the review step, toggle Pixelize on (size 32) — sprites should look pixel-art blocky
5. Try each size — 16 should be very blocky, 128 should look nearly smooth
6. Toggle off — full-resolution sprites return
7. Export/save — verify the saved PNG is 32×32 (open in an image viewer and check dimensions)

**Step 3: Commit (if any final fixups needed)**

```bash
git add -A
git commit -m "fix: pixelize integration cleanup"
```

---

## Notes for Implementer

- The `loadImage()` function in `spriteExtractor.ts` is already defined and used by `normalizeSprites` — `pixelizeSprite` can call it directly since it's in the same file.
- `processSprite` in `SpriteReview.tsx` builds its own canvas from scratch — the pixelize pass runs on whatever canvas state is left after the prior passes by doing a `toDataURL()` → re-load cycle. This is deliberate because `pixelizeSprite` takes an `ExtractedSprite` not raw canvas data.
- CSS `.pixelize-size-row` and `.pixel-size-btn` classes appear in both `UnifiedConfigPanel` and `SpriteReview` — define them once in the shared styles file, not per-component.
- The palette detection `useEffect` in `SpriteReview` samples colors before pixelization — keep it that way. Pixelized 16×16 sprites have too few pixels to detect a meaningful palette.
