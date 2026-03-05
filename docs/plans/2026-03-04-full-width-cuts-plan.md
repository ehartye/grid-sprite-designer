# Full-Width Cut Extraction Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use h-superpowers:subagent-driven-development, h-superpowers:team-driven-development, or h-superpowers:executing-plans to implement this plan (ask user which approach).

**Goal:** Replace per-cell grid detection and header stripping in `spriteExtractor.ts` with full-image-width/height divider detection that slices sprites by cutting out header bars, row dividers, and column dividers.

**Architecture:** Scan every pixel row/column across the full image using a "divider score" (headerLikePct: achromatic-dark + achromatic-bright pixels). Consecutive rows/columns above threshold form cut bands. The rectangles between cuts are sprites. Falls back to symmetrical (evenly-spaced) cuts if detection doesn't yield the expected grid dimensions.

**Tech Stack:** TypeScript, Canvas API, Playwright tests (39 fixtures)

---

### Task 1: Add `computeRowDividerScore` and `computeColDividerScore`

**Files:**
- Modify: `src/lib/spriteExtractor.ts:87-212` (replace old detection functions)

**Step 1: Write the two new scoring functions**

Replace `computeRowDarkness`, `findHighBands`, `mergeNearbyBands`, `computeColumnVariance`, `findLowBands` (lines 87-212) with:

```typescript
/**
 * Compute per-row "divider score" across full image width.
 *
 * For each row, counts pixels that are either:
 *   - achromatic dark: brightness < 25 AND saturation < 20
 *   - achromatic bright: brightness > 200 AND saturation < 30
 *
 * Header bars (dark bg + white text) and thin grid lines both score high.
 * Content rows (colored sprites, backgrounds) score low.
 *
 * Returns a Float64Array of scores in [0, 1] per row.
 */
function computeRowDividerScore(
  data: Uint8ClampedArray,
  width: number,
  height: number,
): Float64Array {
  const scores = new Float64Array(height);
  for (let y = 0; y < height; y++) {
    let dividerPixels = 0;
    let opaquePixels = 0;
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      if (data[i + 3] === 0) continue;
      opaquePixels++;
      const r = data[i], g = data[i + 1], b = data[i + 2];
      const brightness = 0.299 * r + 0.587 * g + 0.114 * b;
      const maxC = Math.max(r, g, b);
      const minC = Math.min(r, g, b);
      const saturation = maxC - minC;
      if (saturation < 20 && brightness < 25) dividerPixels++;      // achromatic dark
      else if (saturation < 30 && brightness > 200) dividerPixels++; // achromatic bright (text)
    }
    scores[y] = opaquePixels > 0 ? dividerPixels / opaquePixels : 0;
  }
  return scores;
}

/**
 * Compute per-column "divider score" across full image height.
 * Same metric as rows but scanned vertically.
 */
function computeColDividerScore(
  data: Uint8ClampedArray,
  width: number,
  height: number,
): Float64Array {
  const scores = new Float64Array(width);
  for (let x = 0; x < width; x++) {
    let dividerPixels = 0;
    let opaquePixels = 0;
    for (let y = 0; y < height; y++) {
      const i = (y * width + x) * 4;
      if (data[i + 3] === 0) continue;
      opaquePixels++;
      const r = data[i], g = data[i + 1], b = data[i + 2];
      const brightness = 0.299 * r + 0.587 * g + 0.114 * b;
      const maxC = Math.max(r, g, b);
      const minC = Math.min(r, g, b);
      const saturation = maxC - minC;
      if (saturation < 20 && brightness < 25) dividerPixels++;
      else if (saturation < 30 && brightness > 200) dividerPixels++;
    }
    scores[x] = opaquePixels > 0 ? dividerPixels / opaquePixels : 0;
  }
  return scores;
}
```

**Step 2: Run tests to verify they still compile**

Run: `npx playwright test --grep "mosskin-spirit" 2>&1 | tail -5`
Expected: Test runs (may pass or fail — we haven't wired up the new functions yet, old code still in place alongside new)

**Step 3: Commit**

```bash
git add src/lib/spriteExtractor.ts
git commit -m "feat: add full-width divider score functions"
```

---

### Task 2: Add `findCutBands` utility

**Files:**
- Modify: `src/lib/spriteExtractor.ts` (add after scoring functions)

**Step 1: Write `findCutBands`**

Add this function after the scoring functions:

```typescript
const DIVIDER_THRESHOLD = 0.80;
const MIN_CUT_RUN = 1;

/**
 * Find contiguous bands of rows/columns whose divider score exceeds the threshold.
 * Each band represents a full-width/height cut (header bar, row divider, or column divider).
 *
 * @param scores - Per-row or per-column divider scores from computeRow/ColDividerScore
 * @param threshold - Minimum score to qualify as a divider pixel row/column (default 0.80)
 * @param minRun - Minimum consecutive rows/columns to form a band (default 1)
 * @returns Array of {start, end} bands (inclusive indices)
 */
function findCutBands(
  scores: Float64Array,
  threshold: number = DIVIDER_THRESHOLD,
  minRun: number = MIN_CUT_RUN,
): Band[] {
  const bands: Band[] = [];
  let i = 0;
  while (i < scores.length) {
    if (scores[i] >= threshold) {
      const start = i;
      while (i < scores.length && scores[i] >= threshold) i++;
      if (i - start >= minRun) {
        bands.push({ start, end: i - 1 });
      }
    } else {
      i++;
    }
  }
  return bands;
}
```

**Step 2: Commit**

```bash
git add src/lib/spriteExtractor.ts
git commit -m "feat: add findCutBands for contiguous divider detection"
```

---

### Task 3: Replace `detectGridLines` with `detectCuts`

**Files:**
- Modify: `src/lib/spriteExtractor.ts:256-393` (replace `selectGridLines`, `spansAreEven`, `detectGridLines`)

**Step 1: Write `detectCuts` function**

Remove these functions entirely:
- `gridLinesToCellSpans` (lines 219-249)
- `selectGridLines` (lines 256-287)
- `spansAreEven` (lines 289-297)
- `detectGridLines` (lines 315-393)
- `templateAxisSpans` (lines 399-415)
- `templateFallback` (lines 420-445)

Replace with:

```typescript
/**
 * Detect full-width horizontal and vertical cuts, then compute cell rects
 * from the content regions between cuts.
 *
 * Fallback: if detected cuts don't yield the expected grid dimensions,
 * falls back to symmetrical (evenly-spaced) cuts. Still strips any
 * detected header band from the top row if one was found.
 */
function detectCuts(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  aaInset: number,
  gridCols: number,
  gridRows: number,
): CellRect[] {
  // ── Horizontal cuts ──
  const rowScores = computeRowDividerScore(data, width, height);
  const hCuts = findCutBands(rowScores);
  console.log(`[CutDetect] Horizontal cuts: ${hCuts.length}`, hCuts.map(b => `${b.start}-${b.end} (${b.end - b.start + 1}px)`));

  // ── Vertical cuts ──
  const colScores = computeColDividerScore(data, width, height);
  const vCuts = findCutBands(colScores);
  console.log(`[CutDetect] Vertical cuts: ${vCuts.length}`, vCuts.map(b => `${b.start}-${b.end} (${b.end - b.start + 1}px)`));

  // ── Compute content spans between cuts ──
  const hSpans = cutBandsToContentSpans(hCuts, height, aaInset);
  const vSpans = cutBandsToContentSpans(vCuts, width, aaInset);
  console.log(`[CutDetect] Content regions: ${hSpans.length} rows × ${vSpans.length} cols`);

  let finalRows: Array<{ start: number; size: number }>;
  let finalCols: Array<{ start: number; size: number }>;

  if (hSpans.length === gridRows && vSpans.length === gridCols) {
    // Full detection succeeded
    finalRows = hSpans;
    finalCols = vSpans;
  } else {
    // Fallback to symmetrical cuts
    console.warn(
      `[CutDetect] FALLBACK: detected ${hSpans.length} rows (expected ${gridRows}), ` +
      `${vSpans.length} cols (expected ${gridCols}). Using symmetrical cuts.`
    );

    // Check if we at least found a header band at the top
    let headerEnd = 0;
    if (hCuts.length > 0 && hCuts[0].start < height * 0.1) {
      headerEnd = hCuts[0].end + 1;
      console.log(`[CutDetect] Stripping detected header: rows 0-${hCuts[0].end} (${headerEnd}px)`);
    }

    const contentHeight = height - headerEnd;
    const contentWidth = width;
    const rowSize = Math.floor(contentHeight / gridRows);
    const colSize = Math.floor(contentWidth / gridCols);

    finalRows = [];
    for (let r = 0; r < gridRows; r++) {
      const start = headerEnd + r * rowSize + aaInset;
      const size = rowSize - 2 * aaInset;
      finalRows.push({ start, size: Math.max(size, 1) });
    }

    finalCols = [];
    for (let c = 0; c < gridCols; c++) {
      const start = c * colSize + aaInset;
      const size = colSize - 2 * aaInset;
      finalCols.push({ start, size: Math.max(size, 1) });
    }
  }

  // ── Build cell rects ──
  const cells: CellRect[] = [];
  for (let row = 0; row < gridRows; row++) {
    for (let col = 0; col < gridCols; col++) {
      if (row < finalRows.length && col < finalCols.length) {
        cells.push({
          x: finalCols[col].start,
          y: finalRows[row].start,
          w: finalCols[col].size,
          h: finalRows[row].size,
        });
      }
    }
  }

  return cells;
}

/**
 * Convert cut bands into content spans (the gaps between cuts).
 * Content spans start after a cut's end and extend to the next cut's start,
 * with aaInset trimmed from each edge.
 */
function cutBandsToContentSpans(
  cuts: Band[],
  totalSize: number,
  aaInset: number,
): Array<{ start: number; size: number }> {
  const sorted = [...cuts].sort((a, b) => a.start - b.start);
  const spans: Array<{ start: number; size: number }> = [];

  // Content before the first cut (if the first cut doesn't start at 0)
  let prevEnd = -1;
  for (const cut of sorted) {
    const start = prevEnd + 1 + aaInset;
    const end = cut.start - aaInset;
    const size = end - start;
    if (size > 0) {
      spans.push({ start, size });
    }
    prevEnd = cut.end;
  }

  // Content after the last cut
  const lastStart = prevEnd + 1 + aaInset;
  const lastSize = totalSize - lastStart - aaInset;
  if (lastSize > 0) {
    spans.push({ start: lastStart, size: lastSize });
  }

  return spans;
}
```

**Step 2: Commit**

```bash
git add src/lib/spriteExtractor.ts
git commit -m "feat: replace grid detection with full-width cut detection"
```

---

### Task 4: Remove `stripCellHeaders` and update `extractSprites`

**Files:**
- Modify: `src/lib/spriteExtractor.ts:447-596` (remove stripCellHeaders, update extractSprites)

**Step 1: Delete `stripCellHeaders` function**

Remove the entire `stripCellHeaders` function (lines 459-494 in current file) and its comment block (lines 447-458).

**Step 2: Update `extractSprites` to use `detectCuts`**

The `extractSprites` function currently calls `detectGridLines` and `stripCellHeaders`. Replace those calls with `detectCuts`. The updated function body:

```typescript
export async function extractSprites(
  gridBase64: string,
  gridMimeType: string,
  config: Partial<ExtractionConfig> = {},
): Promise<ExtractedSprite[]> {
  const cfg = { ...DEFAULT_EXTRACTION, ...config };
  const gridCols = cfg.gridOverride?.cols ?? COLS;
  const gridRows = cfg.gridOverride?.rows ?? ROWS;
  const totalCells = cfg.gridOverride?.totalCells ?? TOTAL_CELLS;
  const cellLabels = cfg.gridOverride?.cellLabels ?? CELL_LABELS;

  const img = await loadImage(gridBase64, gridMimeType);

  // Draw the full grid onto a canvas to read pixels
  const gridCanvas = document.createElement('canvas');
  gridCanvas.width = img.width;
  gridCanvas.height = img.height;
  const gridCtx = gridCanvas.getContext('2d')!;
  gridCtx.drawImage(img, 0, 0);

  const originalData = gridCtx.getImageData(0, 0, img.width, img.height);

  // Posterize a copy for cut detection — absorbs JPEG artifacts and makes
  // grid lines / backgrounds perfectly uniform without touching the original.
  const detectionData = posterize(originalData, cfg.posterizeBits);

  const cells = detectCuts(
    detectionData.data, img.width, img.height,
    cfg.aaInset,
    gridCols, gridRows,
  );

  if (cells.length !== totalCells) {
    throw new Error(
      `Cut detection found ${cells.length} cells, expected ${totalCells}`,
    );
  }

  // Crop from the original image — posterization for output is handled
  // client-side in the processSprite pipeline for instant toggling.
  const sprites: ExtractedSprite[] = [];

  for (let idx = 0; idx < totalCells; idx++) {
    const cell = cells[idx];

    const workCanvas = document.createElement('canvas');
    workCanvas.width = cell.w;
    workCanvas.height = cell.h;
    const workCtx = workCanvas.getContext('2d')!;

    workCtx.clearRect(0, 0, cell.w, cell.h);
    workCtx.drawImage(
      img,
      cell.x, cell.y, cell.w, cell.h,
      0, 0, cell.w, cell.h,
    );

    const dataUrl = workCanvas.toDataURL('image/png');
    const base64 = dataUrl.split(',')[1];

    sprites.push({
      cellIndex: idx,
      label: idx < cellLabels.length ? cellLabels[idx] : `Cell ${idx}`,
      imageData: base64,
      mimeType: 'image/png',
      width: cell.w,
      height: cell.h,
    });
  }

  return normalizeSprites(sprites);
}
```

**Step 3: Clean up `ExtractionConfig`**

Remove fields no longer used by the new detection: `headerH`, `border`, `templateCellW`, `templateCellH`. Keep `aaInset` and `posterizeBits`. Update `DEFAULT_EXTRACTION`:

```typescript
export interface ExtractionConfig {
  /** Extra inset (px) to clip anti-aliased border remnants */
  aaInset: number;
  /** Bits per channel for posterization during grid detection (1-8) */
  posterizeBits: number;
  /** Override grid dimensions for non-6x6 grids */
  gridOverride?: GridOverride;
}

const DEFAULT_EXTRACTION: ExtractionConfig = {
  aaInset: 3,
  posterizeBits: 4,
};
```

**Step 4: Clean up the file header comment**

Replace the file header comment (lines 1-14) with:

```typescript
/**
 * Extract individual sprites from a filled grid image.
 *
 * Supports 6x6 character grids (default) and variable-size grids
 * (3x3 buildings, 2x3 terrain, etc.) via optional gridOverride config.
 *
 * Detection: Full-width/height divider scoring. Scans each pixel row
 * and column across the entire image, scoring the percentage of
 * achromatic-dark or achromatic-bright pixels. Consecutive high-scoring
 * rows/columns are identified as cut bands (headers, row dividers,
 * column dividers). The content rectangles between cuts are the sprites.
 *
 * Fallback: If cuts don't yield the expected grid dimensions, falls back
 * to symmetrical (evenly-spaced) division of the image.
 */
```

**Step 5: Commit**

```bash
git add src/lib/spriteExtractor.ts
git commit -m "refactor: remove stripCellHeaders, clean up ExtractionConfig"
```

---

### Task 5: Fix any callers that reference removed config fields

**Files:**
- Search: all `.ts` and `.tsx` files for `headerH`, `border`, `templateCellW`, `templateCellH`

**Step 1: Find all references to removed fields**

Run: `grep -rn 'headerH\|templateCellW\|templateCellH\|\.border' src/ tests/ --include='*.ts' --include='*.tsx' --include='*.html'`

Any files that pass these fields to `extractSprites` or `ExtractionConfig` need to be updated to stop passing them. The `extractSprites` function will simply ignore unknown fields via the spread into `cfg`, but TypeScript will error on the type mismatch.

**Step 2: Update callers**

For each caller found, remove references to `headerH`, `border`, `templateCellW`, `templateCellH`. These fields are no longer part of `ExtractionConfig`.

Key files likely affected:
- `tests/extraction-harness.html` — the test harness builds `extractionConfig` from manifest fields including `templateCellW`, `templateCellH`, `headerH`, `border`. Remove those assignments since the new API doesn't use them.
- Any component that calls `extractSprites` with explicit config.

**Step 3: Commit**

```bash
git add -A
git commit -m "fix: remove references to deprecated ExtractionConfig fields"
```

---

### Task 6: Run the full test suite and fix issues

**Files:**
- Test: `tests/extraction.spec.ts` (39 fixture tests + 1 posterization test)

**Step 1: Run the full Playwright test suite**

Run: `npx playwright test 2>&1 | tail -20`
Expected: 40/40 pass (including blacksmith-shop and cyberpunk-noodle-shop which previously failed due to header bleed)

**Step 2: If any tests fail, diagnose and fix**

Common issues to watch for:
- **Threshold too strict**: If some fixtures' dividers don't hit 80%, lower `DIVIDER_THRESHOLD`
- **Threshold too loose**: If content rows score above threshold, raise it
- **aaInset too aggressive**: If sprite edges are clipped, reduce `aaInset`
- **Off-by-one in span calculation**: Check `cutBandsToContentSpans` edge math
- **Fallback path issues**: If symmetrical fallback produces wrong cell sizes

Debug by opening the test harness in a browser:
```
http://localhost:5173/tests/extraction-harness.html?fixture=blacksmith-shop.png&manifest=...
```

**Step 3: Generate the audit report**

Run: `npx tsx tests/report-generator.ts`
Open: `test-results/audit-report.html` to visually inspect all sprites

**Step 4: Commit fixes if any**

```bash
git add -A
git commit -m "fix: tune cut detection for full test suite"
```

---

### Task 7: Final cleanup and commit

**Files:**
- Modify: `src/lib/spriteExtractor.ts` (remove any leftover dead code)

**Step 1: Verify no dead code remains**

Check that these are all gone:
- `computeRowDarkness`
- `findHighBands`
- `mergeNearbyBands`
- `computeColumnVariance`
- `findLowBands`
- `gridLinesToCellSpans`
- `selectGridLines`
- `spansAreEven`
- `detectGridLines`
- `templateAxisSpans`
- `templateFallback`
- `stripCellHeaders`

**Step 2: Run tests one final time**

Run: `npx playwright test 2>&1 | tail -5`
Expected: All pass

**Step 3: Commit if needed**

```bash
git add src/lib/spriteExtractor.ts
git commit -m "chore: remove dead grid detection code"
```
