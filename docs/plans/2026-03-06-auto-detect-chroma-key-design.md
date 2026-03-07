# Auto-detect Chroma Key Color

## Problem

Prompts ask Gemini for #FF00FF magenta backgrounds, but Gemini sometimes uses a completely different color. The current chroma key is hardcoded to magenta and fails on these generations.

## Design

### Detection function — `detectKeyColor(imageData: ImageData): [number, number, number]`

Added to `chromaKey.ts`.

- Samples a 3px border ring around the edges of the sprite
- Buckets pixel colors by rounding each channel to the nearest 16
- Counts frequency of each bucket
- Returns the RGB center of the most frequent bucket
- Fallback: if no bucket has >20% of edge pixels, returns [255, 0, 255]

### Integration

In `SpriteReview.tsx`, before the `Promise.all` batch:

1. Load the first sprite's ImageData
2. Call `detectKeyColor()` to get `[keyR, keyG, keyB]`
3. Pass detected key color to every `processSprite()` call

`processSprite` signature gains optional `keyR`, `keyG`, `keyB` params, forwarded to `applyChromaKey` and `defringeRecolor`.

### What stays the same

- All UI controls (tolerance, defringe, edge recolor, sensitivity)
- All algorithm logic (two-pass removal, defringe passes, soft edge ramp)
- Settings persistence format
- Prompt builders (still ask for #FF00FF)

### Scope

~3 files: `chromaKey.ts`, `SpriteReview.tsx`, `processSprite` signature.
