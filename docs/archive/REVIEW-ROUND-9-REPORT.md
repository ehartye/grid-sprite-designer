# Review Round 9 Report

## 1. Executive Summary

This report consolidates independent findings from four specialized reviewers examining the Grid Sprite Designer codebase: Test Coverage & Quality, Build & Deployment Readiness, Concurrency & Race Conditions, and Code Duplication & DRY. A total of **52 findings** were identified across **14 HIGH**, **20 MEDIUM**, and **18 LOW** severity items.

The most critical themes center on **test coverage gaps** and **deployment readiness**. The project has zero test coverage for all 17 React components, all 13 custom hooks, and 6 of 7 server route files. Coverage thresholds in CI are set at 2-10%, rendering them meaningless. On the deployment side, there is no production serving strategy for the frontend, no security headers, no Dockerfile, and a 981MB SQLite database storing base64-encoded images with no size limits or cleanup policy. These issues compound: untested code with no CI safety net being deployed without security hardening.

Concurrency and duplication findings are less severe individually but form systemic patterns. Three different double-submit guard mechanisms exist across workflow hooks, gallery fetches lack cancellation (allowing stale data to overwrite fresh results), and prompt builders share ~70% structural boilerplate across four files. Notably, the codebase has already undergone significant DRY refactoring (unified workflow hooks, consolidated config panels, shared preset route config), and the remaining duplication is concentrated in prompt construction and sprite-type branching patterns. The cross-pollination analysis reveals that many findings amplify each other -- for example, the repeated `PRESET_TABLES` validation pattern (DRY) creates a security surface (Build) that is completely unverified (Test).

---

## 2. High-Severity Findings

### H1. Coverage thresholds provide zero regression protection
**Reviewer**: Test, Build (cross-ref)
**File**: `vitest.config.ts:12-17`
**Details**: Thresholds are set at `statements: 8, branches: 10, functions: 2, lines: 7`. A developer could delete most tests and CI would still pass. The CI pipeline at `.github/workflows/ci.yml:27` runs `npm run test:unit` but these thresholds provide no meaningful gate.

### H2. Zero test coverage for 6 server route files (~400+ LOC)
**Reviewer**: Test
**Files**: `server/routes/presets.js` (132 lines), `server/routes/gallery.js` (59 lines), `server/routes/archive.js` (79 lines), `server/routes/gridPresets.js` (84 lines), `server/routes/gridLinks.js` (39 lines), `server/routes/state.js` (31 lines), `server/routes/generate.js` (159 lines)
**Details**: These routes handle database operations, file system writes, and external API calls with zero validation testing. The `presets.js` file constructs SQL via string interpolation (`DELETE FROM ${config.linkTable}`) -- this pattern is safety-critical and untested. The `archive.js` route uses synchronous `writeFileSync` which could conflict under concurrent requests.
**Cross-ref**: DRY [M4], Concurrency [M5]

### H3. Zero React component tests -- 17 components untested
**Reviewer**: Test
**Files**: All 17 `.tsx` files under `src/components/`
**Details**: UI behavior, form validation, modal interactions, keyboard handlers, and state interactions are entirely untested. Components like `SpriteReview` and `GeneratingOverlay` manage complex async state transitions that are invisible without component tests.
**Cross-ref**: Concurrency [H1, H2]

### H4. Zero test coverage for all 13 custom hooks
**Reviewer**: Test
**Files**: `src/hooks/useGenericWorkflow.ts` (345 lines), `src/hooks/useRunWorkflow.ts` (123 lines), and 11 others
**Details**: The workflow hooks contain the core application orchestration: generate -> extract -> save -> archive pipeline, abort handling, error dispatch, and multi-grid run sequencing. `useGenericWorkflow.ts` uses module-level mutable state (`activeAbortController`, `activeGenerating`) for concurrency control with zero test coverage.
**Cross-ref**: Concurrency [H1], DRY [L3]

### H5. No unit tests for `spriteExtractor.ts` core extraction logic
**Reviewer**: Test
**File**: `src/lib/spriteExtractor.ts` (521 lines)
**Details**: The most algorithmically complex file in the project -- divider scoring, cut band detection, content span computation, normalization -- has zero Vitest tests. Pure functions like `computeRowDividerScore`, `findCutBands`, and `cutBandsToContentSpans` operate on typed arrays and are trivially testable in Node.js. Playwright E2E tests cover extraction indirectly but do not run in CI.
**Cross-ref**: Build [M1]

### H6. `imagePreprocess.ts` (posterize) has zero unit tests
**Reviewer**: Test
**File**: `src/lib/imagePreprocess.ts` (56 lines)
**Details**: The `posterize()` function is a pure function operating on `ImageData`, trivially testable with the existing `setup.ts` polyfill but completely untested in CI.

### H7. `templateGenerator.ts` has zero unit tests
**Reviewer**: Test
**File**: `src/lib/templateGenerator.ts` (161 lines)
**Details**: `generateTemplate()` and `getCellBounds()` contain non-trivial math for grid layout, aspect ratio handling, and cell positioning. Canvas dependency prevents direct Node.js testing, but the math logic could be extracted and tested independently.

### H8. No production serving strategy for frontend
**Reviewer**: Build
**Files**: `vite.config.js`, `server/index.js`
**Details**: After `npm run build`, there is no way to run the app in production. The Express server does not serve `dist/` as static files. No reverse proxy configuration exists. `npm run preview` starts Vite's preview server without API proxy support.
**Cross-ref**: Build [H11]

### H9. No security headers (CSP, HSTS, X-Frame-Options)
**Reviewer**: Build
**File**: `server/index.js`
**Details**: Zero security headers configured. No `helmet` middleware. The app is vulnerable to clickjacking, content type sniffing, and has no CSP to limit script execution origins. The `helmet` package is not even a dependency. Google Fonts loaded in `index.html` would need CSP `font-src`/`style-src` allowlisting.

### H10. SQLite database stores ~1GB of base64 images without limits
**Reviewer**: Build
**Files**: `server/db/schema.js:20-30`, `server/db/index.js:19-21`
**Details**: The `sprites` table stores full base64-encoded images in TEXT columns. Current database is 981MB with a 153MB WAL file. No size limits, no `busy_timeout` pragma, no backup strategy, no VACUUM scheduling. Base64 TEXT wastes ~33% storage vs BLOB. Gallery queries pull thumbnail data inline for up to 100 entries per page.
**Cross-ref**: Concurrency [M5]

### H11. 50MB JSON body limit creates DoS vector
**Reviewer**: Build
**File**: `server/index.js:28`
**Details**: `express.json({ limit: '50mb' })` is applied globally to ALL routes, not just the generation endpoint. Any endpoint accepts 50MB payloads. Only `/api/generate-grid` has rate limiting (10 req/min). An attacker could exhaust server memory via concurrent large requests to unprotected endpoints.

### H12. Module-level singleton guard is unreliable under concurrent code paths
**Reviewer**: Concurrency
**Files**: `src/hooks/useGenericWorkflow.ts:207-208, 246-247`
**Details**: `activeAbortController` is overwritten at line 250 without aborting the previous controller. If two calls enter via different code paths (e.g., `useAddSheet` calls `runGeneratePipeline` directly without the module-level guard), the old controller is orphaned and its request continues in the background unabortably.
**Cross-ref**: DRY [L3], Test [H4]

### H13. useAddSheet lacks ref-based double-submit prevention
**Reviewer**: Concurrency
**Files**: `src/hooks/useAddSheet.ts:48-59`
**Details**: Uses React `useState` (`generating`) for its guard, but `setGenerating(true)` is a queued state update -- it doesn't take effect synchronously. Double-clicks within the same frame bypass the guard. The `abortRef` is overwritten without aborting the previous controller. Unlike `useGenericWorkflow` (module-level boolean) and `useRunWorkflow` (`useRef`), this hook has NO ref-based guard.
**Cross-ref**: DRY [L3]

### H14. Prompt builders share ~70% structural boilerplate across 4 files
**Reviewer**: DRY
**Files**: `src/lib/promptBuilder.ts` (246 lines), `src/lib/buildingPromptBuilder.ts` (102 lines), `src/lib/terrainPromptBuilder.ts` (90 lines), `src/lib/backgroundPromptBuilder.ts` (112 lines)
**Details**: ~550 lines total with duplicated template preambles, description block construction, cell description loops, guidance composition, chroma key warnings, and closing instructions. ~120 lines could be eliminated by extracting a shared `buildPromptBase()` function. The `promptForType.ts` dispatcher (133 lines) would also simplify.
**Cross-ref**: DRY [L4]

---

## 3. Medium-Severity Findings

### M1. Playwright E2E tests not executed in CI
**Reviewer**: Test, Build (cross-ref)
**Files**: `.github/workflows/ci.yml`, `tests/extraction.spec.ts`
**Details**: CI runs `npm run test:unit` and `npm run build` but NOT Playwright tests. The fixture-based extraction suite -- the primary regression test for sprite extraction quality -- provides no CI protection.

### M2. `geminiClient.ts` API client has zero tests
**Reviewer**: Test
**File**: `src/api/geminiClient.ts` (50 lines)
**Details**: `generateGrid()` and `testConnection()` handle HTTP errors, JSON parsing, and abort signals -- all untested. Could be easily tested with `fetch` mocking.

### M3. `server/routes/generate.js` retry logic is untested
**Reviewer**: Test
**File**: `server/routes/generate.js:9-32`
**Details**: Exponential backoff retry for 429 responses (`MAX_RETRIES = 3`, `BASE_DELAY_MS = 2000`) has zero tests. No timeout on upstream requests -- a hanging Gemini request hangs the server indefinitely. Multiple concurrent generation requests could create a thundering herd during rate limiting.
**Cross-ref**: Concurrency [M5]

### M4. `loadGeneration.test.ts` mocks away the integration path
**Reviewer**: Test
**File**: `src/lib/__tests__/loadGeneration.test.ts:7-10`
**Details**: `extractSprites` is fully mocked, meaning the `loadGenerationIntoState -> extractSprites` integration path is never tested. API changes to `extractSprites` would be masked.

### M5. `poses.ts` animation definitions have zero tests
**Reviewer**: Test
**File**: `src/lib/poses.ts` (127 lines)
**Details**: `POSES` is derived from `CELL_LABELS` via complex regex-based mapping. `ANIMATIONS` defines frame sequences using cell indices. Neither is tested -- cell label changes could silently break animations.

### M6. Server history tests use low-fidelity mock DB
**Reviewer**: Test
**File**: `server/__tests__/history.test.js:37-46`
**Details**: Mock DB returns canned responses for all calls. SQL query errors, column name mismatches, and type coercion issues won't be caught. The `migrations.test.js` file already demonstrates a better pattern using real in-memory SQLite.

### M7. E2E test relies on fixture files that may be absent
**Reviewer**: Test
**File**: `tests/extraction.spec.ts:50-61`
**Details**: Tests dynamically discover `.manifest.json` files in `test-fixtures/`. If fixtures are missing (clean clone without LFS), all tests are silently skipped, giving false confidence of zero failures.

### M8. Gallery fetch has no cancellation -- stale responses overwrite newer data
**Reviewer**: Concurrency
**File**: `src/components/gallery/GalleryPage.tsx:122-142, 145-147`
**Details**: `fetchGallery` uses no AbortController. Rapid filter changes cause racing fetches -- if an older response arrives after a newer one, stale results overwrite the correct filtered view. Users see results that don't match their selected filters.

### M9. Editor settings debounced save can race with load
**Reviewer**: Concurrency
**Files**: `src/hooks/useEditorSettings.ts:47-63`, `src/components/grid/SpriteReview.tsx:248-297, 300-326`
**Details**: The `skipNextSaveRef` mechanism prevents save/load races in most cases, but in React concurrent mode or strict mode, the save effect could fire with stale `settingsLoaded=true` before the queued `setSettingsLoaded(false)` takes effect.
**Cross-ref**: Test [H4]

### M10. Two-request history save is not atomic
**Reviewer**: Concurrency
**Files**: `src/hooks/useGenericWorkflow.ts:130-174`, `server/routes/history.js:68-92, 94-142`
**Details**: POST to `/api/history` followed by POST to `/api/history/:id/sprites` are separate HTTP requests. Server crash or client disconnect between them creates a generation record without sprites. No transaction wraps the two operations at the HTTP level.

### M11. useEffect auto-trigger for run generation has complexity risk
**Reviewer**: Concurrency
**File**: `src/App.tsx:84-95`
**Details**: The auto-trigger keyed on `run.currentGridIndex` could double-fire in React StrictMode. Defended in depth by `isGeneratingRef` guard in `useRunWorkflow.ts:39`, but the interaction is complex and untested.
**Cross-ref**: Test [H4]

### M12. No code splitting in Vite build
**Reviewer**: Build
**Files**: `vite.config.js`
**Details**: Entire app builds into a single 305KB JS bundle with no `manualChunks` configuration. AdminPage (rarely accessed) and GalleryPage (secondary tab) are not lazy-loaded. No compression middleware configured.

### M13. CI pipeline missing lint, E2E, and security audit steps
**Reviewer**: Build
**File**: `.github/workflows/ci.yml`
**Details**: Pipeline runs `npm ci -> typecheck -> test:unit -> build`. Missing: Playwright tests, ESLint (no config exists), `npm audit`, bundle size check. Coverage thresholds are effectively disabled.
**Cross-ref**: Test [H1]

### M14. CORS defaults to localhost origins in production
**Reviewer**: Build
**File**: `server/index.js:24-27`
**Details**: Without `ALLOWED_ORIGINS` env var, CORS defaults to `localhost:5173` and `localhost:5174`. In production without this env var, CORS blocks all real client origins. No documentation of required env vars.

### M15. No Dockerfile or deployment configuration
**Reviewer**: Build
**Details**: No Dockerfile, docker-compose.yml, Procfile, or deployment config. Native dependency `better-sqlite3` requires build tools. No process manager configured. Health check at `/health` returns static OK without verifying database connectivity.
**Cross-ref**: Build [H8]

### M16. Shell command injection risk in port-kill error handler
**Reviewer**: Build
**File**: `server/index.js:74-104`
**Details**: The `EADDRINUSE` error handler interpolates `PORT` into shell commands (`netstat -ano | findstr ":${PORT}"`, `taskkill /F /PID`). While gated behind `NODE_ENV === 'development'`, the `PORT` env variable flows into `execSync` at lines 81, 89 without sanitization.

### M17. Content name extraction pattern repeated 4x
**Reviewer**: DRY
**Files**: `src/components/grid/SpriteReview.tsx:367-371, 387-391`, `src/hooks/useAddSheet.ts:96-105`
**Details**: A 4-way ternary chain (`state.spriteType === 'building' ? state.building.name : ...`) appears 3 times across 2 files. Could use `WORKFLOW_CONFIGS[state.spriteType].getContent(state).name` which already exists.

### M18. Color striker button rendering duplicated in SpriteReview
**Reviewer**: DRY
**File**: `src/components/grid/SpriteReview.tsx:706-773`
**Details**: 20+ line button rendering block is copy-pasted for primary palette (colors 0-71) and overflow palette (72+). Identical except for array slice range and key offset. Should be extracted to a `ColorSwatchGrid` component.

### M19. Repeated PRESET_TABLES validation pattern (9 occurrences)
**Reviewer**: DRY
**Files**: `server/routes/presets.js` (7 occurrences), `server/routes/gridLinks.js` (2 occurrences)
**Details**: `const config = PRESET_TABLES[type]; if (!config) return res.status(400).json(...)` is repeated 9 times across ~18 lines. Should be Express middleware. A missed check in a new endpoint opens SQL injection via `${config.table}` interpolation.
**Cross-ref**: Build [H2], Test [H2]

### M20. loadGeneration sprite-type branching is verbose
**Reviewer**: DRY
**File**: `src/lib/loadGeneration.ts:48-176`
**Details**: 65-line if/else for populating config state and 24-line if/else for extraction grid config. Both follow the same pattern per sprite type. A lookup table would reduce to ~15 lines of data-driven code. ~50 lines eliminable.

---

## 4. Low-Severity Findings

### L1. `chromaKey.test.ts` missing edge cases
**Reviewer**: Test
**File**: `src/lib/__tests__/chromaKey.test.ts:57-71`

### L2. Prompt builder tests only verify substring containment
**Reviewer**: Test
**Files**: `*PromptBuilder.test.ts` (4 files)

### L3. `appReducer.test.ts` incomplete action type coverage
**Reviewer**: Test
**File**: `src/context/__tests__/appReducer.test.ts`

### L4. No snapshot or visual regression tests
**Reviewer**: Test

### L5. Vitest setup only polyfills `ImageData` -- canvas APIs unavailable
**Reviewer**: Test
**File**: `src/lib/__tests__/setup.ts`

### L6. Sprite processing effects have fire-and-forget async work
**Reviewer**: Concurrency
**File**: `src/components/grid/SpriteReview.tsx:183-199, 202-238`
**Details**: Rapid setting toggles cause multiple concurrent CPU-intensive canvas processing batches. The `cancelled` flag prevents data corruption, but wasted work causes UI jank (~50-200ms per batch for 36 sprites).

### L7. `beforeunload` flush has no delivery guarantee
**Reviewer**: Concurrency
**File**: `src/hooks/useEditorSettings.ts:83-98`
**Details**: `keepalive` requests have a 64KB body size limit. Large `erasedPixels` maps could exceed this, silently failing and losing editor state on page close.

### L8. No AbortController for preset/grid-link fetches
**Reviewer**: Concurrency
**Files**: `src/components/config/UnifiedConfigPanel.tsx:183-198`, `src/components/grid/AddSheetModal.tsx:37-59`

### L9. Multi-tab state inconsistency
**Reviewer**: Concurrency
**Files**: `src/context/AppContext.tsx:555-571`, `server/routes/state.js:13-19`
**Details**: No `BroadcastChannel` or `localStorage` events for cross-tab coordination. Two tabs can independently modify the same DB records (editor settings for the same historyId) without conflict detection.

### L10. Legacy empty DB file at root
**Reviewer**: Build
**File**: `grid-sprites.db`

### L11. Google Fonts loaded from CDN with no fallback
**Reviewer**: Build
**File**: `index.html:7-9`

### L12. Unvalidated state key storage
**Reviewer**: Build
**File**: `server/routes/state.js:6-28`
**Details**: `/api/state/:key` endpoints accept any arbitrary key string. No allowlist for state keys.

### L13. Migration errors silently continue
**Reviewer**: Build
**File**: `server/db/migrations.js:40-48`
**Details**: Non-duplicate-column migration errors are logged but execution continues, potentially leaving DB in partially-migrated state. No transaction wrapping individual migrations.
**Cross-ref**: Concurrency [M10]

### L14. Coverage thresholds effectively zero (duplicate of H1)
**Reviewer**: Build
**File**: `vitest.config.ts:12-17`

### L15. Reducer LOAD_*_PRESET cases follow identical pattern
**Reviewer**: DRY
**File**: `src/context/AppContext.tsx:405-482`

### L16. Abort/cancel pattern duplicated across 3 hooks
**Reviewer**: DRY
**Files**: `src/hooks/useGenericWorkflow.ts:231`, `src/hooks/useRunWorkflow.ts:24`, `src/hooks/useAddSheet.ts:38`
**Details**: Identical cleanup effects and cancel functions. A `useAbortable()` hook would eliminate ~15 lines.

### L17. `promptForType` switch mirrors prompt builder structure
**Reviewer**: DRY
**File**: `src/lib/promptForType.ts:41-129`

### L18. UnifiedConfigPanel still has type-specific edge-case branching
**Reviewer**: DRY
**File**: `src/components/config/UnifiedConfigPanel.tsx:224-234`

---

## 5. Cross-Pollination Matrix

| Theme | Test | Build | Concurrency | DRY |
|-------|------|-------|-------------|-----|
| **Coverage thresholds useless** | H1 (primary) | M13, L14 | -- | -- |
| **Server routes untested** | H2 (primary) | -- | M5 (SQLite) | M19 (validation duplication) |
| **No E2E in CI** | M1 (primary) | M13 | -- | -- |
| **Double-submit guards inconsistent** | H4 (untested) | -- | H12, H13 (primary) | L16 (duplicated pattern) |
| **Stale fetch results** | H3 (untested) | -- | M8 (primary) | -- |
| **No production deployment path** | -- | H8, M15 (primary) | -- | -- |
| **Security headers missing** | -- | H9 (primary) | -- | -- |
| **Database growth unbounded** | -- | H10 (primary) | M5 (busy_timeout) | -- |
| **DoS via body size** | -- | H11 (primary) | -- | -- |
| **PRESET_TABLES validation repeated** | H2 (untested) | -- | -- | M19 (primary) |
| **Prompt builder duplication** | L2 (weak tests) | -- | -- | H14 (primary) |
| **Sprite-type branching** | -- | -- | -- | M17, M20 (primary) |
| **Save/load race conditions** | H4 (untested) | -- | M9 (primary) | -- |
| **History save non-atomic** | -- | -- | M10 (primary) | -- |
| **Shell injection in error handler** | -- | M16 (primary) | -- | -- |
| **Migration error handling** | -- | L13 | M10 (related) | -- |

---

## 6. Root Cause Analysis

### Root Cause 1: Test Infrastructure Immaturity
The project has Vitest and Playwright configured but lacks the supporting libraries (`@testing-library/react`, `msw`, `canvas` polyfill) needed to test its primary surface areas: React components, custom hooks, and canvas-dependent algorithms. Coverage thresholds were set permissively during early development and never ratcheted up. **This single root cause underlies 12 of the 14 HIGH findings** -- every untested module is a blind spot for the other reviewers' findings.

### Root Cause 2: No Production Deployment Target
The project was developed as a local development tool and lacks any production deployment story. No static file serving, no security headers, no Dockerfile, no process manager, no health checks with DB verification. The CORS configuration defaults to localhost. This is not inherently wrong for a personal tool, but it means the codebase cannot be deployed beyond a single developer's machine without significant additional work.

### Root Cause 3: Incomplete Abstraction Consolidation
Significant DRY refactoring has already been completed (workflow hooks, config panels, preset routes), but the consolidation stopped short of full completion. Prompt builders, sprite-type branching, and double-submit guard patterns still have 3-4 implementations each. The existing `WORKFLOW_CONFIGS` map and `PRESET_TABLES` dictionary demonstrate the correct pattern -- it just hasn't been applied to all remaining duplication sites.

### Root Cause 4: Fetch Lifecycle Not Centralized
Every `useEffect` that fetches data implements its own fetch-and-cleanup pattern (or lacks cleanup entirely). There is no shared `useFetch` or AbortController wrapper. This causes the stale-data races in gallery, presets, and grid-links, and forces each new fetch site to re-implement cancellation logic.

---

## 7. Recommended Action Priority

### Immediate (This Sprint)

| Priority | Finding IDs | Action |
|----------|-------------|--------|
| 1 | H1, L14 | Raise coverage thresholds to match actual coverage (~30-40%) and enforce in CI |
| 2 | H12, H13 | Add ref-based double-submit guard to `useAddSheet`; abort previous controller before overwriting in `useGenericWorkflow` |
| 3 | H11 | Scope 50MB body limit to `/api/generate-grid` only; apply sensible default (1MB) to other routes |
| 4 | M19 | Extract `validatePresetType` Express middleware to eliminate 9 repeated validation blocks |
| 5 | M8 | Add AbortController to `fetchGallery` with cleanup in useEffect |

### Short-Term (Next 2-4 Weeks)

| Priority | Finding IDs | Action |
|----------|-------------|--------|
| 6 | H2, H5, H6 | Add unit tests for `spriteExtractor.ts` pure functions, `imagePreprocess.ts`, and server routes using in-memory SQLite pattern |
| 7 | H14 | Extract shared `buildPromptBase()` to eliminate ~120 lines of prompt builder duplication |
| 8 | H9 | Install and configure `helmet` middleware with appropriate CSP for Google Fonts and base64 images |
| 9 | H10 | Add `busy_timeout` pragma, implement generation count limits or cleanup policy, consider BLOB storage |
| 10 | M1, M13 | Add Playwright to CI pipeline (or scheduled workflow); add `npm audit` step |
| 11 | M10 | Combine generation + sprites save into a single atomic endpoint |
| 12 | M16 | Sanitize PORT variable or replace shell-based port detection with Node.js net module |

### Medium-Term (1-3 Months)

| Priority | Finding IDs | Action |
|----------|-------------|--------|
| 13 | H3, H4, L5 | Install `@testing-library/react`, `msw`, and `canvas` polyfill; add component and hook tests |
| 14 | H8, M15 | Add `express.static('dist')` serving and create Dockerfile with multi-stage build |
| 15 | M12 | Add code splitting via `React.lazy` for AdminPage and GalleryPage |
| 16 | M17, M20, L15, L18 | Extend config-driven patterns to remaining sprite-type branching sites |
| 17 | L16 | Extract `useAbortable()` hook to consolidate abort/cancel pattern |
| 18 | L9 | Document multi-tab as known limitation or implement BroadcastChannel coordination |

---

## 8. Positive Findings

1. **Successful DRY refactoring already completed**: Four ~220-line near-identical workflow hooks have been consolidated into thin wrappers (30-34 lines each) around a shared `useGenericWorkflow` factory. Four separate config panels are now a unified `UnifiedConfigPanel` using a data-driven `SPRITE_TYPE_CONFIGS` map. Server preset routes use a shared `PRESET_TABLES` config map. This demonstrates strong architectural awareness.

2. **Well-structured existing tests**: The tests that do exist use precise, meaningful assertions (not just `toBeDefined()`). Test data helpers (`makeDispatch()`, `makeData()`, `makeSprite()`, `makeRunState()`) are clean and reusable. The `typeRegistrations.test.js` canary test pattern catches type registration drift between client and server.

3. **Defense-in-depth for concurrency**: The auto-trigger effect in `App.tsx` is defended by both `runTriggerRef` deduplication AND `isGeneratingRef` in `useRunWorkflow`. The `cancelled` boolean pattern in sprite processing effects correctly prevents stale results from corrupting state. The `beforeunload` handler correctly uses `keepalive: true` with ref-captured values.

4. **WAL mode and synchronous SQLite**: The choice of `better-sqlite3` (synchronous) with WAL mode provides natural serialization of database operations within the single Node.js process, avoiding an entire class of database concurrency bugs.

5. **Server-side rate limiting on generate endpoint**: The `/api/generate-grid` endpoint has rate limiting (10 req/min), protecting the most expensive operation (Gemini API calls) from abuse.

6. **Vitest + Playwright test architecture**: The split between fast unit tests (Vitest) and thorough E2E tests (Playwright with fixture-based extraction validation) is a sound architectural choice. The infrastructure just needs the coverage gaps filled.

7. **Migrations system exists and handles idempotency**: The migration system correctly handles `duplicate column` and `already exists` errors for idempotent re-runs, allowing safe restarts without manual DB intervention.

---

*Report compiled from independent findings by 4 reviewers. No prior review documents were consulted.*
