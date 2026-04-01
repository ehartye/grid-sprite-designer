# Outline Recolor Feature Design

**Date:** 2026-04-01  
**Status:** Approved

## Overview

A new sprite post-processing pass that draws a clean pixel outline around sprites. Runs after chroma key and defringe recolor, giving sprites a crisp, consistent border suitable for pixel art. Supports separate inward/outward depth controls and any color from the sprite's palette.

## The `outlineSprite()` Function

New export in `src/lib/chromaKey.ts`. Three phases run in sequence:

**Phase 1 — Solidify fringe:** Scan all pixels where `0 < alpha < 255`. Set alpha to 255 and RGB to the outline color. Cleans up the partial-alpha ramp left by chroma key into a hard pixel edge.

**Phase 2 — Outward expansion** (if `outDepth > 0`): Iterate `outDepth` times. Each iteration: snapshot current alpha, find transparent pixels with at least one opaque neighbor (4-directional), paint them outline color at full alpha. Each iteration expands one pixel layer outward.

**Phase 3 — Inward recolor** (if `inDepth > 0`): Iterate `inDepth` times. Each iteration: snapshot current alpha, find opaque pixels with at least one transparent neighbor (4-directional), replace RGB with outline color (alpha unchanged). Each iteration moves one pixel layer deeper into the sprite.

```typescript
export function outlineSprite(
  source: ImageData,
  outDepth: number,
  inDepth: number,
  r: number,
  g: number,
  b: number,
): ImageData
```

## State & UI

Four new state vars in `SpriteReview`:
- `outlineEnabled: boolean` — default `false`
- `outlineOutDepth: number` — default `1`
- `outlineInDepth: number` — default `0`
- `outlineColor: [number, number, number]` — default `[0, 0, 0]` (black)

Sidebar row below edge recolor controls:

```
[ ] Outline
    Out [1]  In [0]
    [■] [□]  [● ● ● ● ● ● ● ● ● ●]
     blk wht   ← top 10 palette swatches →
```

- Black and white are always present as fixed options
- Palette swatches show top 10 colors by frequency from the existing `palette` state (already detected in SpriteReview from the current sprite set)
- Selected color gets a highlight ring

## Pipeline Position

Runs after `defringeRecolor`, before `pixelizeSprite`:

```
applyChromaKey → defringeRecolor → outlineSprite → pixelizeSprite
```

Outline runs on already-cleaned transparent edges, not on the original magenta background.

## Persistence

Add to `EditorSettings` in `useEditorSettings.ts`:
- `outlineEnabled: boolean`
- `outlineOutDepth: number`
- `outlineInDepth: number`
- `outlineColor: [number, number, number]`

Save/restore alongside other editor settings per generation.

## Testing

Unit tests in `src/lib/__tests__/chromaKey.test.ts`:
- Solidify fringe: partial-alpha pixel becomes alpha=255 with outline color
- Outward expansion: single opaque pixel with `outDepth=2` → 2 adjacent transparent pixels become outline color
- Inward recolor: filled square with `inDepth=1` → outermost ring recolored, interior unchanged
- No-op: `outDepth=0, inDepth=0` → no pixels changed
- Color correctness: all three phases use the specified RGB, not hardcoded values

`processSprite()` gets new params with safe defaults — all existing tests pass unchanged.

## Non-Goals

- No per-sprite outline color — all sprites in the session use the same color
- No diagonal-only neighbor detection — 4-directional adjacency is sufficient for pixel art
- No separate fringe-solidify toggle — it always runs when outline is enabled (it's a prerequisite for clean outward expansion)
