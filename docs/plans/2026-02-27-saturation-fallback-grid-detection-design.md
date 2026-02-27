# Saturation Profile Fallback for Colored Grid Lines

## Problem

`detectGridLines()` in `src/lib/spriteExtractor.ts` uses brightness profiling to find dark valleys corresponding to grid lines. When Gemini renders output with pink/magenta grid lines on blue backgrounds instead of dark lines on magenta backgrounds, the brightness-based detection fails because pink lines are bright, not dark.

## Approach

Add a saturation/chroma profile as a fallback. If brightness detection fails to find real grid lines (most lines fall back to template positions), re-detect using saturation peaks instead of brightness valleys.

## Design

### Scope

All changes in `src/lib/spriteExtractor.ts`. No new files. No changes to header detection, chroma key, or UI components.

### New function: `computeSaturationProfile()`

- Same shape as `computeBrightnessProfile()` (returns `Float64Array`, one value per row/column)
- Computes average saturation per column or row: `(max - min) / max` for each pixel's RGB
- Pink/magenta lines have saturation ~1.0 and appear as narrow peaks at expected grid positions

### Modified function: `detectGridLines()`

After the existing brightness-based detection pass:

1. **Quality check**: count how many vertical lines were actually found by brightness (returned a real `GridLine` from `findGridLineInWindow`) vs. fell back to template positions (returned `null`).
2. **If more than half fell back**: compute saturation profiles and run a second detection pass looking for **peaks** (highest saturation) near expected positions instead of valleys (lowest brightness). Expand bands where saturation stays above threshold.
3. Horizontal lines get the same fallback treatment.
4. Cell rectangle derivation remains unchanged.

### New function: `findGridLineBySaturation()`

Mirror of `findGridLineInWindow()` but inverted:
- Find the **maximum** saturation value in the search window (instead of minimum brightness)
- Must be **above** a saturation threshold to count
- Expand band while saturation stays above threshold

### Data flow

```
detectGridLines()
  +-- brightness profiles (existing)
  +-- attempt brightness-based detection (existing)
  +-- quality check: did brightness find real lines?
  |   +-- YES: use brightness results (current path, no change)
  |   +-- NO: compute saturation profiles
  |           +-- find saturation peaks near expected positions
  |           +-- use saturation results for cell rects
  +-- derive cell rectangles (existing)
```

### Edge cases

- **Mixed signals**: if most lines found by brightness, trust brightness (no fallback triggered)
- **Blue background saturation**: blue cells have high saturation too, but it's a wide uniform field, not a narrow band; search window + expected position priors keep detection locked onto actual grid lines
- **Headers**: still grayscale, so existing chromatic header detection works unchanged
