# Full-Width Cut Extraction Design

## Goal

Replace per-cell grid detection and header stripping with full-image-width/height divider detection. Identify header bars, row dividers, and column dividers as full-length cut bands, then slice the remaining rectangles as sprites.

## Problem

The current extractor detects grid lines and slices cells, then attempts to strip headers per-cell. This causes false positives on dark-themed content and misses real headers when cell content is also dark. The test harness showed that uniformity across the full image width is the reliable signal — template artifacts span the entire image, content doesn't.

## Approach: Row/Column Score with Fixed Threshold

Scan the posterized image row-by-row and column-by-column. For each row, compute `headerLikePct` across the full image width — the percentage of opaque pixels that are either achromatic-dark (brightness < 25, saturation < 20) or achromatic-bright (brightness > 200, saturation < 30). Consecutive rows above threshold (80%) form a horizontal cut band. Same logic for columns.

### Expected Cuts (6x6 grid = 11 cuts)

- 6 horizontal: 1 header + 5 row dividers → 6 content rows
- 5 vertical: column dividers → 6 content columns
- Result: 36 sprite rectangles

### No outer edge borders expected — only header + internal dividers.

## What Gets Removed

- `computeRowDarkness()`, `findHighBands()`, `mergeNearbyBands()`
- `computeColumnVariance()`, `findLowBands()`
- `selectGridLines()`, `detectGridLines()`
- `stripCellHeaders()`
- Template-based fallback logic

## What Gets Added

- `computeRowDividerScore(imageData, width, height)` → score per row
- `computeColDividerScore(imageData, width, height)` → score per column
- `findCutBands(scores, minRun)` → consecutive bands above threshold
- `sliceGrid(img, hCuts, vCuts, labels)` → ExtractedSprite[]

## Data Flow

```
base64 image
  → load onto canvas
  → posterize for detection
  → computeRowDividerScore() → findCutBands() → horizontal cuts
  → computeColDividerScore() → findCutBands() → vertical cuts
  → validate cut count against manifest
  → if valid: slice rectangles from ORIGINAL image between cuts
  → if invalid: fallback to symmetrical cuts (evenly divide image)
    → still strip detected header band from top if one was found
  → normalize to uniform size
  → return ExtractedSprite[]
```

## Validation & Fallback

If detected cuts don't yield the expected rows/columns from the manifest, fall back to symmetrical cuts — evenly divide the image based on manifest dimensions. Still strip any detected header band from the top if one was found. Log a warning but don't fail. Generations are expensive and must be preserved.

## Detection Image

Use posterized copy (4 bits/channel) for detection to eliminate JPEG artifacts. Extract sprites from the original image.

## Testing

The existing 39-fixture Playwright test suite validates this. Success criteria: all 40 tests pass, including the 2 that currently fail (blacksmith-shop and cyberpunk-noodle-shop header bleed).
