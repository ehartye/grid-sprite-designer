# Saturation Fallback Grid Detection — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add saturation-based grid line detection as a fallback when brightness profiling fails (colored grid lines like pink/magenta on blue backgrounds).

**Architecture:** Add `computeSaturationProfile()` and `findGridLineBySaturationPeak()` alongside existing brightness functions. Modify `detectGridLines()` to check brightness detection quality and fall back to saturation peaks when needed. Mirror all changes into the test HTML harness.

**Tech Stack:** TypeScript (browser), Canvas API, Playwright tests

---

### Task 1: Add `computeSaturationProfile()` to spriteExtractor.ts

**Files:**
- Modify: `src/lib/spriteExtractor.ts:55-93` (after `computeBrightnessProfile`)

**Step 1: Write `computeSaturationProfile()`**

Insert directly after `computeBrightnessProfile()` (after line 93). Same shape, same sampling pattern, but computes average saturation `(max - min) / max` instead of luminance:

```typescript
/**
 * Compute average saturation for each row or column.
 * Saturation = (max - min) / max for each pixel's RGB channels.
 * High-saturation columns/rows correspond to colored grid lines (pink, magenta).
 */
function computeSaturationProfile(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  axis: 'horizontal' | 'vertical',
): Float64Array {
  const len = axis === 'horizontal' ? height : width;
  const profile = new Float64Array(len);

  if (axis === 'horizontal') {
    for (let y = 0; y < height; y++) {
      let sum = 0;
      let count = 0;
      for (let x = 0; x < width; x += 2) {
        const i = (y * width + x) * 4;
        const maxC = Math.max(data[i], data[i + 1], data[i + 2]);
        if (maxC > 0) {
          const minC = Math.min(data[i], data[i + 1], data[i + 2]);
          sum += (maxC - minC) / maxC;
        }
        count++;
      }
      profile[y] = sum / count;
    }
  } else {
    for (let x = 0; x < width; x++) {
      let sum = 0;
      let count = 0;
      for (let y = 0; y < height; y += 2) {
        const i = (y * width + x) * 4;
        const maxC = Math.max(data[i], data[i + 1], data[i + 2]);
        if (maxC > 0) {
          const minC = Math.min(data[i], data[i + 1], data[i + 2]);
          sum += (maxC - minC) / maxC;
        }
        count++;
      }
      profile[x] = sum / count;
    }
  }

  return profile;
}
```

**Step 2: Build and verify no compile errors**

Run: `npx tsc --noEmit`
Expected: no errors

**Step 3: Commit**

```bash
git add src/lib/spriteExtractor.ts
git commit -m "feat: add computeSaturationProfile for colored grid line detection"
```

---

### Task 2: Add `findGridLineBySaturationPeak()` to spriteExtractor.ts

**Files:**
- Modify: `src/lib/spriteExtractor.ts` (after `findGridLineInWindow`, around line 145)

**Step 1: Write `findGridLineBySaturationPeak()`**

Insert after `findGridLineInWindow()`. This is the inverted mirror — finds the **highest peak** instead of the deepest valley, and expands while values stay **above** threshold:

```typescript
/**
 * Find a grid line near an expected position by searching for the highest
 * saturation peak within a window, then expanding to the full saturated band.
 * This is the inverse of findGridLineInWindow — for colored (not dark) lines.
 */
function findGridLineBySaturationPeak(
  profile: Float64Array,
  expectedPos: number,
  windowRadius: number,
  threshold: number,
): GridLine | null {
  const start = Math.max(0, expectedPos - windowRadius);
  const end = Math.min(profile.length - 1, expectedPos + windowRadius);

  // Find the most saturated position in the window
  let maxVal = -Infinity;
  let maxIdx = expectedPos;
  for (let i = start; i <= end; i++) {
    if (profile[i] > maxVal) {
      maxVal = profile[i];
      maxIdx = i;
    }
  }

  // Must be above threshold to count
  if (maxVal < threshold) return null;

  // Expand the band: consecutive positions above threshold
  let bandStart = maxIdx;
  let bandEnd = maxIdx;
  while (bandStart > 0 && profile[bandStart - 1] > threshold) bandStart--;
  while (bandEnd < profile.length - 1 && profile[bandEnd + 1] > threshold) bandEnd++;

  return {
    center: maxIdx,
    start: bandStart,
    end: bandEnd,
  };
}
```

**Step 2: Build and verify no compile errors**

Run: `npx tsc --noEmit`
Expected: no errors

**Step 3: Commit**

```bash
git add src/lib/spriteExtractor.ts
git commit -m "feat: add findGridLineBySaturationPeak for colored line detection"
```

---

### Task 3: Modify `detectGridLines()` to use saturation fallback

**Files:**
- Modify: `src/lib/spriteExtractor.ts:161-253` (the `detectGridLines` function)

**Step 1: Refactor vertical line detection with quality check and fallback**

The key change: after the existing brightness detection for vertical lines, count how many were actually found vs. fell back to template. If more than half fell back, re-run detection using saturation peaks.

Replace the current Step 1 block (lines ~199-204) and Step 2-3 blocks with this expanded logic:

```typescript
  // ── Step 1: Detect vertical lines via brightness (clean — no header confusion) ──
  let vLines: GridLine[] = [];
  let vFoundCount = 0;
  for (const pos of expectedV) {
    const line = findGridLineInWindow(vProfile, pos, searchWindow, vThreshold);
    if (line) vFoundCount++;
    vLines.push(line || { center: pos, start: pos, end: pos });
  }

  // ── Step 1b: Saturation fallback for vertical lines ──
  // If brightness missed most lines (colored lines like pink/magenta),
  // re-detect using saturation peaks instead of brightness valleys.
  if (vFoundCount <= Math.floor(expectedV.length / 2)) {
    const vSatProfile = smoothProfile(
      computeSaturationProfile(data, width, height, 'vertical'),
    );
    // Threshold: top 15% of saturation values in the profile
    const sortedSat = Array.from(vSatProfile).sort((a, b) => a - b);
    const satThreshold = sortedSat[Math.floor(sortedSat.length * 0.85)];

    const vSatLines: GridLine[] = [];
    for (const pos of expectedV) {
      const line = findGridLineBySaturationPeak(vSatProfile, pos, searchWindow, satThreshold);
      vSatLines.push(line || { center: pos, start: pos, end: pos });
    }
    vLines = vSatLines;
  }

  // ── Step 2: Measure actual border width from vertical bands ──
  const interiorVBands = vLines.slice(1, -1);
  const avgBorderWidth = interiorVBands.length > 0
    ? Math.round(
        interiorVBands.reduce((s, l) => s + (l.end - l.start + 1), 0)
        / interiorVBands.length,
      )
    : templateBorder;
  const halfBorder = Math.ceil(avgBorderWidth / 2);

  // ── Step 3: Detect horizontal line CENTERS ──
  // Try brightness first, fall back to saturation if needed.
  let hCenters: number[] = [];
  let hFoundCount = 0;
  for (const pos of expectedH) {
    const line = findGridLineInWindow(hProfile, pos, searchWindow, hThreshold);
    if (line) hFoundCount++;
    hCenters.push(line ? line.center : pos);
  }

  if (hFoundCount <= Math.floor(expectedH.length / 2)) {
    const hSatProfile = smoothProfile(
      computeSaturationProfile(data, width, height, 'horizontal'),
    );
    const sortedSat = Array.from(hSatProfile).sort((a, b) => a - b);
    const satThreshold = sortedSat[Math.floor(sortedSat.length * 0.85)];

    hCenters = [];
    for (const pos of expectedH) {
      const line = findGridLineBySaturationPeak(hSatProfile, pos, searchWindow, satThreshold);
      hCenters.push(line ? line.center : pos);
    }
  }
```

The Step 4 (derive cell rectangles) stays exactly the same.

**Step 2: Build and verify no compile errors**

Run: `npx tsc --noEmit`
Expected: no errors

**Step 3: Run existing Playwright tests to verify dark-line case still works**

Run: `npx playwright test tests/extraction.spec.ts`
Expected: PASS — the existing `filled-grid.jpg` fixture uses dark grid lines, so brightness detection should still handle it without triggering the fallback.

**Step 4: Commit**

```bash
git add src/lib/spriteExtractor.ts
git commit -m "feat: saturation fallback in detectGridLines for colored grid lines"
```

---

### Task 4: Mirror changes into test HTML harness

**Files:**
- Modify: `tests/extract-test.html:70-185` (the inline JS detection functions)

**Step 1: Add `computeSaturationProfile` and `findGridLineBySaturationPeak` to the inline JS**

After the existing `findGridLineInWindow` function (around line 119), add the JS equivalents:

```javascript
    function computeSaturationProfile(data, width, height, axis) {
      const len = axis === 'horizontal' ? height : width;
      const profile = new Float64Array(len);
      if (axis === 'horizontal') {
        for (let y = 0; y < height; y++) {
          let sum = 0, count = 0;
          for (let x = 0; x < width; x += 2) {
            const i = (y * width + x) * 4;
            const maxC = Math.max(data[i], data[i+1], data[i+2]);
            if (maxC > 0) {
              const minC = Math.min(data[i], data[i+1], data[i+2]);
              sum += (maxC - minC) / maxC;
            }
            count++;
          }
          profile[y] = sum / count;
        }
      } else {
        for (let x = 0; x < width; x++) {
          let sum = 0, count = 0;
          for (let y = 0; y < height; y += 2) {
            const i = (y * width + x) * 4;
            const maxC = Math.max(data[i], data[i+1], data[i+2]);
            if (maxC > 0) {
              const minC = Math.min(data[i], data[i+1], data[i+2]);
              sum += (maxC - minC) / maxC;
            }
            count++;
          }
          profile[x] = sum / count;
        }
      }
      return profile;
    }

    function findGridLineBySaturationPeak(profile, expectedPos, windowRadius, threshold) {
      const start = Math.max(0, expectedPos - windowRadius);
      const end = Math.min(profile.length - 1, expectedPos + windowRadius);
      let maxVal = -Infinity, maxIdx = expectedPos;
      for (let i = start; i <= end; i++) {
        if (profile[i] > maxVal) { maxVal = profile[i]; maxIdx = i; }
      }
      if (maxVal < threshold) return null;
      let bandStart = maxIdx, bandEnd = maxIdx;
      while (bandStart > 0 && profile[bandStart-1] > threshold) bandStart--;
      while (bandEnd < profile.length-1 && profile[bandEnd+1] > threshold) bandEnd++;
      return { center: maxIdx, start: bandStart, end: bandEnd };
    }
```

**Step 2: Update `detectGridLines` in the inline JS to match the TypeScript version**

Mirror the same quality-check + fallback logic from Task 3 into the inline `detectGridLines` function. Replace the vertical line detection block and horizontal centers block with the fallback-aware versions.

**Step 3: Run existing Playwright tests**

Run: `npx playwright test tests/extraction.spec.ts`
Expected: PASS — same fixture, same behavior

**Step 4: Commit**

```bash
git add tests/extract-test.html
git commit -m "feat: mirror saturation fallback into test HTML harness"
```

---

### Task 5: Add Playwright test for colored-grid fixture

**Files:**
- Create: `test-fixtures/colored-grid-readme.md` (placeholder instructions since we need a real fixture)
- Modify: `tests/extraction.spec.ts` (add a second test case)

**Step 1: Add test case for colored grid lines**

The user needs to provide a real Gemini output with pink lines on blue background as `test-fixtures/colored-grid.jpg`. Add a conditional test that runs when the fixture exists:

Add after the existing test in `tests/extraction.spec.ts`:

```typescript
  test('colored grid lines should extract correctly', async ({ page }) => {
    const fixturePath = join(ROOT, 'test-fixtures', 'colored-grid.jpg');
    if (!existsSync(fixturePath)) {
      test.skip();
      return;
    }

    // Point the test harness at the colored fixture
    await page.goto(`http://localhost:${port}/tests/extract-test.html`, {
      waitUntil: 'domcontentloaded',
    });

    // Override the fixture path before extraction runs
    await page.evaluate(() => {
      // The test harness loads /test-fixtures/filled-grid.jpg by default.
      // We need a variant that loads colored-grid.jpg instead.
      // For now, we reload with a query param.
    });

    // Alternative: create a small variant HTML or pass fixture via query param.
    // For this test, navigate to a URL with fixture param:
    await page.goto(
      `http://localhost:${port}/tests/extract-test.html?fixture=colored-grid.jpg`,
      { waitUntil: 'domcontentloaded' },
    );

    await page.waitForFunction(() => (window as any).__extractionDone === true, {
      timeout: 30000,
    });

    const results = await page.evaluate(() => (window as any).__results);
    expect(results).toHaveLength(36);

    const MAX_ALLOWED_BLEED = 15;
    const failures: string[] = [];
    for (const r of results) {
      if (r.headerBleedPct > MAX_ALLOWED_BLEED) {
        failures.push(`${r.label}: ${r.headerBleedPct}% header bleed`);
      }
    }

    await page.screenshot({
      path: join(ROOT, 'test-fixtures', 'colored-grid-results.png'),
      fullPage: true,
    });

    expect(failures, `${failures.length} sprites have header bleed:\n${failures.join('\n')}`).toHaveLength(0);
  });
```

**Step 2: Update extract-test.html to support fixture query param**

In the `run()` function, change the hardcoded fixture path to read from a query param:

Replace line 215:
```javascript
    const img = await loadImg('/test-fixtures/filled-grid.jpg');
```

With:
```javascript
    const params = new URLSearchParams(window.location.search);
    const fixture = params.get('fixture') || 'filled-grid.jpg';
    const img = await loadImg(`/test-fixtures/${fixture}`);
```

**Step 3: Run tests**

Run: `npx playwright test tests/extraction.spec.ts`
Expected: First test PASS, second test SKIPPED (until fixture is added)

**Step 4: Commit**

```bash
git add tests/extraction.spec.ts tests/extract-test.html
git commit -m "test: add conditional colored-grid test, support fixture query param"
```

---

### Summary

| Task | What | Files |
|------|------|-------|
| 1 | `computeSaturationProfile()` | `src/lib/spriteExtractor.ts` |
| 2 | `findGridLineBySaturationPeak()` | `src/lib/spriteExtractor.ts` |
| 3 | Fallback logic in `detectGridLines()` | `src/lib/spriteExtractor.ts` |
| 4 | Mirror all JS changes into test harness | `tests/extract-test.html` |
| 5 | Playwright test for colored fixture | `tests/extraction.spec.ts`, `tests/extract-test.html` |

After implementation, the user should save a Gemini output with pink grid lines as `test-fixtures/colored-grid.jpg` and re-run tests to validate end-to-end.
