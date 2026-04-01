# Pixelize Feature Design

**Date:** 2026-04-01  
**Status:** Approved

## Overview

Take normalized 1:1 sprites and convert them to common low-pixel-count variants using nearest-neighbor downscaling. The feature is non-destructive during the review session and bakes the small-dimension PNG on save/export. It also informs Gemini's generation prompt so the AI produces art suited to the target resolution from the start.

## Target Sizes

Fixed set: **16×16, 32×32, 48×48, 64×64, 128×128**

## Processing Pipeline

A new `pixelizeSprite(sprite, targetSize)` function is added to `src/lib/spriteExtractor.ts`. It draws the source image onto a `targetSize×targetSize` canvas with `ctx.imageSmoothingEnabled = false` (nearest-neighbor), returning a new `ExtractedSprite` with the small dimensions.

In `processSprite()` in `SpriteReview.tsx`, pixelize runs as the **last pass** — after chroma key, posterize, color strikes, and erasure — because it changes dimensions and all prior passes assume consistent size. Two new params are added: `pixelizeEnabled: boolean` and `pixelizeSize: number`.

The existing `useEffect` driving `processedSprites` re-runs when any processing param changes; pixelize state slots in with no architectural change.

## State & UI

Two new state vars in `SpriteReview`:
- `pixelizeEnabled: boolean` — default `false`
- `pixelizeSize: number` — default `32`

In the processing sidebar, a new row is added directly below the posterize controls:

```
[ ] Pixelize    [16] [32] [48] [64] [128]
                ↑ size buttons only visible when enabled
```

Active size button uses existing highlighted/active button styling.

When `pixelizeEnabled` is true, `<img>` tags in `SpriteGrid` receive `imageRendering: 'pixelated'` so the browser upscales with sharp pixel edges. A `pixelizeEnabled` prop threads from `SpriteReview` → `SpriteGrid` → img style.

Save and export already consume `processedSprites` as their source — no changes needed there. Pixelized images bake in automatically at small dimensions.

## Prompt Engineering

When a pixelize target size is active, resolution-appropriate style guidance is injected into the Gemini generation prompt:

| Target | Guidance injected |
|--------|-------------------|
| 16×16 | "Design for extreme pixel art resolution. Use 2–4 flat colors, bold silhouettes, no gradients, no fine detail." |
| 32×32 | "Design for classic pixel art (SNES-era). Limited palette, clean shapes, minimal shading." |
| 48×48 | "Design for mid-resolution pixel art. Palette of 8–16 colors, defined shading, readable detail." |
| 64×64 | "Design for mid-resolution pixel art. Palette of 8–16 colors, defined shading, readable detail." |
| 128×128 | "Design for high-resolution pixel art. Rich palette, detailed shading, fine features." |

When pixelize is off, no resolution guidance is injected (existing behavior unchanged).

Additionally, the style reference in each prompt builder (`promptBuilder.ts`, `buildingPromptBuilder.ts`, `terrainPromptBuilder.ts`, `backgroundPromptBuilder.ts`) is audited to ensure it does not assume character proportions and is inclusive of all sprite types.

The pixelize target size flows from the config panel into prompt builders at generation time — it is part of the generation config, not only a post-processing preference.

## Data Flow (End-to-End)

1. User selects pixelize target size in config panel → stored in generation config
2. Prompt builder reads target size → injects resolution-appropriate style guidance
3. Gemini generates with pixel art intent
4. Post-extraction: `pixelizeSprite()` downscales to `targetSize×targetSize` (nearest-neighbor)
5. `SpriteGrid` renders with `imageRendering: pixelated`
6. Save/export bakes the small-dimension PNG

## Testing

- Unit test for `pixelizeSprite()`: verify output dimensions match target, verify nearest-neighbor (no interpolation artifacts)
- Unit test for prompt builders: verify resolution guidance string appears for each of the 5 sizes, verify absent when pixelize is off
- Existing `processSprite()` tests pass unchanged (pixelize params are optional/off by default)

## Non-Goals

- No DB migration needed — pixelize is a session-level preference, not persisted
- No per-sprite size selection — all sprites in a session use the same target size
- No upscale path (source is always larger than target)
