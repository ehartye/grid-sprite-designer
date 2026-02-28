# Code Review — Grid Sprite Designer

**Date:** 2026-02-27
**Branch:** `dynamic-grid-detection`
**Reviewers:** 4-agent team (algorithms, security, frontend, infrastructure)

---

## Executive Summary

The Grid Sprite Designer is a well-structured application with a clear workflow and thoughtful core algorithms. However, this review identified **95 findings** across 4 review domains, including **5 critical issues** that should be addressed before any production use. The most urgent concerns are:

1. **Race condition** — cancelling a generation does not abort the in-flight API call, allowing stale results to corrupt fresh sessions
2. **Memory leak** — dangling `Image.onload` callbacks in two components can draw to stale canvas state
3. **Test harness divergence** — tests exercise a duplicated copy of the extraction algorithm, not the production code
4. **Open CORS + no auth** — all API endpoints are accessible from any origin with no authentication
5. **Wrong argument** in `spriteExtractor.ts` silently assumes square cells

Below is the full consolidated review organized by severity.

---

## Finding Summary by Severity

| Severity | Count |
|----------|-------|
| Critical | 5 |
| High | 18 |
| Medium | 22 |
| Low | 18 |
| Info | 10 |

---

## Critical Findings

### C1 — Race condition: cancel does not abort in-flight generation
**Area:** Frontend — `GeneratingOverlay.tsx:25`, `useGridWorkflow.ts:16-116`
`reset()` dispatches `RESET` returning state to `initialState`, but the `generate()` async function continues running. When it resolves, it dispatches `GENERATE_COMPLETE` / `EXTRACTION_COMPLETE` / `SET_HISTORY_ID` into what the user believes is a fresh session. If the user immediately starts a new generation, two concurrent `generate()` calls race and dispatch results out of order.
**Fix:** Introduce an AbortController or a generation-ID ref that `generate()` checks before each dispatch.

### C2 — Memory leak: dangling Image.onload in canvas draw effects
**Area:** Frontend — `SpriteReview.tsx:175-212`, `AnimationPreview.tsx:59-97`
A `new Image()` is created inside a useEffect with no cleanup. If the effect re-runs before the image loads (rapid frame changes), the previous `onload` fires into stale canvas state.
**Fix:** Add a `let cancelled = false` guard and set `img.src = ''` in the cleanup return.

### C3 — Test harness duplicates production algorithm
**Area:** Tests — `tests/extract-test.html` (458 lines inline JS)
The Playwright tests exercise a full copy of the grid detection algorithm in `extract-test.html`, **not** `src/lib/spriteExtractor.ts`. Any divergence goes undetected. The design doc explicitly acknowledges this as a separate "mirror" task.
**Fix:** Refactor tests to import from the built/bundled `spriteExtractor` module.

### C4 — CORS wide open + no authentication on any endpoint
**Area:** Security — `server/index.js:18`, all routes
`app.use(cors())` allows any origin. All endpoints (delete, archive/write-to-disk, history, sprites) are completely unauthenticated. Combined, this is a CSRF risk — any page the user visits can call the API.
**Fix:** Restrict CORS to `http://localhost:5174` for dev. Add localhost-only request validation at minimum.

### C5 — Wrong argument passed to detectGridLines
**Area:** Algorithms — `spriteExtractor.ts:421`
`templateCellH` is passed for both width and height parameters, silently assuming square cells. `ExtractionConfig` is missing a `templateCellW` field entirely.
**Fix:** Add `templateCellW` to `ExtractionConfig` and pass it correctly.

---

## High Findings

### H1 — No rate limiting on any route, including AI generation
**Area:** Security — `server/index.js`, `server/routes/generate.js`
No rate limiting middleware. `/api/generate-grid` proxies to a paid Gemini API. The retry-on-429 logic means the server makes repeated calls on the client's behalf.
**Fix:** Add `express-rate-limit`, especially on `/api/generate-grid`.

### H2 — Unvalidated model name interpolated into Gemini API URL
**Area:** Security — `server/routes/generate.js:8`
The `model` field from the request body is interpolated directly into the URL with no allowlist.
**Fix:** Validate against an explicit list of accepted Gemini model identifiers.

### H3 — 50MB global JSON body limit, no per-route limits
**Area:** Security — `server/index.js:19`
A single 50MB limit applies to all routes. Could enable DoS via memory exhaustion.
**Fix:** Use a smaller default and apply 50MB only to routes that handle image data.

### H4 — Path traversal / unvalidated imageData written to disk
**Area:** Security — `server/index.js:163-186`
The archive endpoint writes `s.imageData` (decoded from base64) to disk without validating it is non-empty or valid image data. `cellIndex` is also unvalidated.
**Fix:** Validate sprites array entries have integer cellIndex in range, non-empty imageData.

### H5 — Raw exception messages sent to clients
**Area:** Security — `server/index.js:195,228`, `server/routes/generate.js:125,148`
`err.message` is returned directly, potentially exposing file paths, SQL errors, or internal logic.
**Fix:** Log full errors server-side; return generic messages to clients.

### H6 — templateCellW missing from ExtractionConfig
**Area:** Algorithms — `spriteExtractor.ts:22-38`
Config has `templateCellH` but no `templateCellW`. The square-cell assumption papers over this.
**Fix:** Add `templateCellW` field to `ExtractionConfig`.

### H7 — detectGridLines search window based on height only
**Area:** Algorithms — `spriteExtractor.ts:286`
A single `searchWindow` derived from `height` is used for both horizontal and vertical line detection. For non-square images, vertical search is wrong.
**Fix:** Use `width * 0.05` for vertical lines, `height * 0.05` for horizontal.

### H8 — Band expansion can escape search window bounds
**Area:** Algorithms — `spriteExtractor.ts:184-193`
After finding `minIdx`, band expansion walks the full profile unconditionally. If two grid lines are close, one band can swallow the other.
**Fix:** Clamp expansion to `[start, end]`.

### H9 — composeSpriteSheet assumes all cells have identical dimensions
**Area:** Algorithms — `spriteExtractor.ts:525-526`
`sprites[0]` dimensions are used for all cells. No validation that dimensions match.
**Fix:** Validate all sprite dimensions match, or handle variable sizes.

### H10 — SOFT_EDGE_WIDTH and defringeThreshold are undocumented magic numbers
**Area:** Algorithms — `chromaKey.ts:35,63`
`SOFT_EDGE_WIDTH = 60`, `defringeThreshold = 500` are critical to output quality with no documentation of derivation or expected ranges.
**Fix:** Add comments explaining the derivation and expected value ranges.

### H11 — coreThreshold scale factor of 3 is implicit
**Area:** Algorithms — `chromaKey.ts:34`
`tolerance * 3` converts UI slider value to Manhattan color distance. If slider range changes, this breaks silently.
**Fix:** Document the scaling and tolerance range contract.

### H12 — GalleryPage: no user feedback on extraction errors
**Area:** Frontend — `GalleryPage.tsx:49-91`
If `extractSprites` throws, the error is only logged to console. `GENERATE_COMPLETE` has already fired, leaving state in limbo.
**Fix:** Dispatch a status/error message to the user.

### H13 — GalleryPage always uses CONFIG_2K regardless of original generation size
**Area:** Frontend — `GalleryPage.tsx:72-78`
Re-extraction always uses 2K config. If the original was 4K, extraction produces garbage.
**Fix:** Store `imageSize` in history and use the matching config.
**Status:** DEFERRED — focusing on 2K only for now. TODO when 4K support is prioritized.

### H14 — Rapid programmatic download clicks throttled by browsers
**Area:** Frontend — `SpriteReview.tsx:261-271`
`link.click()` in a loop for 36 sprites. Most browsers throttle this.
**Fix:** Use JSZip to bundle downloads, or sequence with delays.

### H15 — AppHeader: setTimeout not cleaned up on unmount
**Area:** Frontend — `AppHeader.tsx:31-35`
Two `setTimeout` calls are never stored or cleared.
**Fix:** Store timeout ID in a ref and clear in useEffect cleanup.

### H16 — .gitignore critically incomplete
**Area:** Infrastructure — `.gitignore`
Missing: `playwright-report/`, `test-results/`, `.playwright-mcp/`, test output PNGs, `.env` (only `.env.local` ignored). `colored-grid.jpg` fixture should be committed.
**Fix:** Add missing entries; commit the test fixture.

### H17 — No README
**Area:** Infrastructure
No documentation on what the project does, how to set up, run, or test it.
**Fix:** Create a README with setup instructions, required env vars, and dev workflow.

### H18 — No CI/CD
**Area:** Infrastructure
No GitHub Actions or CI configuration. Tests are never automatically run.
**Fix:** Add a basic CI workflow that runs `tsc --noEmit` and `playwright test`.

---

## Medium Findings

### M1 — No input validation on POST /api/history
**Area:** Security — `server/index.js:74-83`
No type, length, or content validation on request body fields.

### M2 — No array check for sprites payload
**Area:** Security — `server/index.js:85-101`
`sprites` is assumed to be an array without checking.

### M3 — User-controlled model in test-connection endpoint
**Area:** Security — `server/routes/generate.js:131`
The test-connection endpoint accepts any model name — acts as an API key oracle.

### M4 — Test directories served in all environments
**Area:** Security — `server/index.js:235-236`
`/tests` and `/test-fixtures` served statically without environment check.

### M5 — Large base64 payloads in gallery list responses
**Area:** Security — `server/index.js:118-135`
Gallery endpoint embeds full base64 thumbnails in list responses (up to 2.5MB).

### M6 — Promise anti-pattern in composeSpriteSheet
**Area:** Algorithms — `spriteExtractor.ts:519`
`new Promise(async (resolve, reject) => { ... })` — async executor anti-pattern.

### M7 — Silent grid-line fallback corrupts avgBorderWidth
**Area:** Algorithms — `spriteExtractor.ts:292-295`
A missed grid line (width 1) is included in the border-width average.

### M8 — Brittle median-based threshold for grid detection
**Area:** Algorithms — `spriteExtractor.ts:278-282`
`median * 0.5` doesn't account for distribution spread.

### M9 — Magic minimum header offset of 2
**Area:** Algorithms — `spriteExtractor.ts:464`
`Math.max(y + 2, 2)` is undocumented.

### M10 — Hard 25% max scan limit for header detection
**Area:** Algorithms — `spriteExtractor.ts:442`
`Math.ceil(ch * 0.25)` silently limits header detection range.

### M11 — Uint8Array re-allocated each defringe pass
**Area:** Algorithms — `chromaKey.ts:65-97`
Could be double-buffered outside the loop.

### M12 — L1 (Manhattan) distance not documented as such
**Area:** Algorithms — `chromaKey.ts:38-44`
`colorDist` uses Manhattan distance (max 765), but this is never documented.

### M13 — cellH semantics ambiguous (total vs content)
**Area:** Algorithms — `templateGenerator.ts:14,83`
`cellH` means "total including header" but is used both ways across files.

### M14 — No validation that headerH < cellH
**Area:** Algorithms — `templateGenerator.ts:83`
Negative fill rect height silently produces empty cells.

### M15 — SpriteReview is 476 lines — SRP violation
**Area:** Frontend — `SpriteReview.tsx`
Handles 7+ responsibilities. Should be decomposed.

### M16 — Identical canvas draw logic duplicated across two components
**Area:** Frontend — `SpriteReview.tsx:174-213`, `AnimationPreview.tsx:58-97`
Copy-pasted verbatim. Extract a shared hook.

### M17 — spriteMap rebuilt every render without useMemo (x2)
**Area:** Frontend — `SpriteReview.tsx:143-146`, `AnimationPreview.tsx:27-31`
New Map reference triggers redundant draw effects.

### M18 — ConfigPanel presetsByGenre not memoized
**Area:** Frontend — `ConfigPanel.tsx:80-85`
`reduce` over presets runs every render.

### M19 — ConfigPanel preset select is uncontrolled
**Area:** Frontend — `ConfigPanel.tsx:94`
Uses `defaultValue` not `value`, so UI doesn't reflect state after reset.

### M20 — StatusBanner nested setTimeout not tracked
**Area:** Frontend — `StatusBanner.tsx:33-38`
Inner timer can fire after unmount.

### M21 — JSON.stringify as useEffect dep workaround
**Area:** Frontend — `SpriteReview.tsx:107,137`
Fragile pattern — floating point imprecision could cause false inequality.

### M22 — Colored grid test silently skips if fixture missing
**Area:** Tests — `tests/extraction.spec.ts:96-129`
The saturation fallback test `test.skip()`s with no CI-visible warning.

---

## Low Findings

### L1 — No WAL checkpointing configured
**Area:** Security — `server/db.js:18`

### L2 — `output/` not in .gitignore
**Area:** Security — `.gitignore`

### L3 — No Content-Security-Policy or security headers
**Area:** Security — `server/index.js`

### L4 — Unused `serve-handler` devDependency
**Area:** Security — `package.json`

### L5 — Saturation 85th percentile threshold fragile for colorful sprites
**Area:** Algorithms — `spriteExtractor.ts:305,341`

### L6 — 1x1 fallback cell continues silently
**Area:** Algorithms — `spriteExtractor.ts:370`

### L7 — Boundary smoothing undocumented
**Area:** Algorithms — `spriteExtractor.ts:149-150`

### L8 — strikeColors has no soft edge
**Area:** Algorithms — `chromaKey.ts:106-142`

### L9 — canvas.getContext('2d')! unguarded null assertion (4 locations)
**Area:** Algorithms — `templateGenerator.ts:55`, `spriteExtractor.ts:408,486,532`

### L10 — getCellBounds no cellIndex range validation
**Area:** Algorithms — `templateGenerator.ts:96-105`

### L11 — `err: any` in catch blocks
**Area:** Frontend — `useGridWorkflow.ts:114`, `SpriteReview.tsx:255`

### L12 — testConnection doesn't check response.ok
**Area:** Frontend — `geminiClient.ts:30-37`

### L13 — Array index as React key
**Area:** Frontend — `SpriteGrid.tsx:28`

### L14 — deleteConfirm not reset on gallery load
**Area:** Frontend — `GalleryPage.tsx:98-111`

### L15 — `--font-pixel` CSS variable never defined
**Area:** Frontend — `AnimationPreview.tsx:137`

### L16 — ~15-20 unused CSS classes in global.css
**Area:** Frontend — `global.css`

### L17 — No `"test"`, `"lint"`, or `"typecheck"` npm scripts
**Area:** Infrastructure — `package.json`

### L18 — `noUnusedLocals` and `noUnusedParameters` disabled in tsconfig
**Area:** Infrastructure — `tsconfig.json:15-16`

---

## Informational Findings

### I1 — API key loaded from `.env.local` only (hardcoded path)
**Area:** Security — `server/index.js:1-2`

### I2 — No database migration strategy
**Area:** Security — `server/db.js`

### I3 — COLS/ROWS hardcoded 6x6 throughout
**Area:** Algorithms — `spriteExtractor.ts`

### I4 — applyChromaKey does not premultiply alpha
**Area:** Algorithms — `chromaKey.ts`

### I5 — CONFIG_4K is clean 2x scale of CONFIG_2K (good)
**Area:** Algorithms — `templateGenerator.ts`

### I6 — Magic string model name duplicated
**Area:** Frontend — `AppContext.tsx:73`, `geminiClient.ts:30`

### I7 — ASCII arrow approximations instead of Unicode
**Area:** Frontend — `SpriteReview.tsx`, `AnimationPreview.tsx`

### I8 — Redundant double context read in AppHeader
**Area:** Frontend — `AppHeader.tsx:8-10`

### I9 — Unused `ROWS` export
**Area:** Frontend — `poses.ts:18`

### I10 — Claude prompt artifact in committed design doc
**Area:** Infrastructure — `docs/plans/2026-02-27-saturation-fallback-plan.md:4`

---

## Prioritized Recommendations

### Immediate (Critical / Correctness)
1. **Fix the generation race condition** (C1) — add AbortController or generation-ID guard
2. **Fix dangling Image.onload** (C2) — add cleanup returns to both useEffects
3. **Fix wrong spriteExtractor arg** (C5) — add `templateCellW` to config
4. **Restrict CORS** (C4) — limit to localhost origins
5. **Refactor test harness** (C3) — tests must exercise production code, not a copy

### Short-term (High / Stability)
6. Add rate limiting on `/api/generate-grid` (H1)
7. Validate `model` against an allowlist (H2)
8. Store `imageSize` in history for correct re-extraction (H13)
9. Add per-route body size limits (H3)
10. Sanitize error messages sent to clients (H5)
11. Add `.gitignore` entries for test output and Playwright dirs (H16)
12. Create a README (H17)
13. Add basic CI (H18)

### Medium-term (Medium / Quality)
14. Decompose SpriteReview into smaller components (M15)
15. Extract shared canvas/animation hooks (M16)
16. Add `useMemo` for spriteMap in both components (M17)
17. Make preset `<select>` controlled (M19)
18. Add input validation on all POST routes (M1, M2)
19. Add `playwright.config.ts` with proper test infrastructure (H16 related)
20. Document magic numbers in chromaKey and spriteExtractor (H10, H11, M8, M9)

### Long-term (Low / Polish)
21. Convert server to TypeScript
22. Add component tests and API integration tests
23. Add ESLint + Prettier
24. Audit and remove dead CSS (~15-20 unused classes)
25. Add security headers (helmet)
26. Add database migration versioning

---

*Generated by 4-agent code review team. No changes were made to the codebase.*
