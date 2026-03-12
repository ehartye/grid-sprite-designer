# Review Round 13 — Cross-Pollinated Report

**Date**: 2026-03-08
**Branch**: master (commit b8c4bc8)
**Reviewers**: Testing Strategy & Coverage (testing-reviewer), Build Pipeline & Dependency Management (build-reviewer), Client-Server Contract & Data Flow (contract-reviewer), Code Hygiene & Technical Debt (hygiene-reviewer)

---

## Executive Summary

Round 13 reviewed the Grid Sprite Designer codebase across four domains: testing strategy/coverage, build pipeline/dependency management, client-server contract/data flow, and code hygiene/technical debt. Four independent reviewers produced **45 findings total**: 10 high, 18 medium, and 17 low severity. The reviews converge on five systemic themes:

1. **The CI pipeline provides a false sense of safety** — Coverage thresholds are set at 8% statements / 2% functions, E2E tests are excluded from CI, there is no ESLint configuration, and the server is written in plain JavaScript excluded from type-checking. A developer could delete most tested code, introduce `any`-typed catch blocks, break API contracts, and ship SQL bugs — all without CI catching anything. Three reviewers (testing, build, hygiene) independently identified aspects of this gap.

2. **Client-server data contracts are unenforced and silently broken** — The grid-links endpoint omits `aspectRatio` and `tileShape` fields that the client declares as required, causing silent fallback to defaults. History restoration returns hardcoded empty strings for content fields that were never persisted. No runtime validation (Zod, io-ts, or manual checks) exists on API responses. The server is plain JavaScript, so TypeScript cannot catch these mismatches at compile time. Two reviewers (contract, hygiene) independently found the same history content field gap.

3. **No centralized API client — 20+ raw fetch() calls with ad-hoc error handling** — Every component and hook makes its own `fetch()` call with manually set headers and inconsistent error handling ranging from `catch(() => {})` to proper state dispatch. Admin delete operations don't check `response.ok`. Adding any cross-cutting concern (auth headers, request IDs, retry logic, error normalization) requires touching 20+ call sites.

4. **The core generate pipeline — the app's primary value proposition — has zero tests** — `useGenericWorkflow.ts`, `useRunWorkflow.ts`, `geminiClient.ts`, and `templateGenerator.ts` are all completely untested. The recently consolidated workflow hook (from 4 duplicated hooks) has no regression guard. Server routes for gallery, archive, grid links, grid presets, and state also have no tests. Path traversal protection in the archive route is a security-critical check with no test.

5. **Known dependency vulnerability and missing static analysis** — Vite/esbuild has a known security advisory (GHSA-67mh-4wv8-2f99) affecting the dev server. No ESLint configuration exists anywhere in the project, meaning `as any` casts, unused variables, and unsafe patterns have no automated enforcement. `npm audit` is not part of CI.

---

## High-Severity Findings

### HIGH-1: Zero Tests for the Core Generate Pipeline
**Reviewer**: Testing (T-2)
**Files**: `src/hooks/useGenericWorkflow.ts`, `src/hooks/useRunWorkflow.ts`, `src/api/geminiClient.ts`, `src/lib/templateGenerator.ts`

The entire generate -> extract -> save -> archive pipeline has no unit or integration tests. `runGeneratePipeline()` orchestrates API calls, state dispatch, history saves, and archive saves — all untested. The retry logic in `callGemini` (server-side) is also untested. `templateGenerator.ts` draws canvas grid images with no verification of correct pixel dimensions.

**Cross-ref**: Build-B3 confirms E2E tests are excluded from CI, so even the extraction tests that do exist never gate PRs. Contract-C2 notes the 20+ raw fetch calls have no shared error handling to test against. Hygiene-H2 notes `proceedToNextGrid` and `skipCurrentGrid` are identical — any test of one effectively covers both but the naming creates an illusion of separate coverage.

**Action**: Mock `fetch` and canvas API to unit-test `runGeneratePipeline`. Test `callGemini` retry logic by mocking fetch to return 429 then 200. Test `templateGenerator` produces correct canvas dimensions for given config.

---

### HIGH-2: GridLink API Response Missing `aspectRatio` and `tileShape` Fields
**Reviewer**: Contract (C-1)
**Files**: `server/routes/presets.js:84-111`, `src/context/AppContext.tsx:37-52`

The client `GridLink` interface declares `aspectRatio` and `tileShape` as required fields. The server's grid-links endpoint joins `grid_presets` but only selects `g.bg_mode` — it does NOT include `g.aspect_ratio` or `g.tile_shape`. At runtime, `gridLink.aspectRatio` is `undefined`, and `UnifiedConfigPanel.tsx:203` silently falls back to `'1:1'` via `|| '1:1'`. The preset's intended aspect ratio is never applied in run mode.

**Cross-ref**: Build-B6 notes the server is plain JavaScript excluded from type-checking — TypeScript cannot catch this mismatch. Testing-T-3 notes no server route tests exist for grid-links. Testing-T-2 notes no integration tests verify the generate pipeline receives correct config.

**Action**: Add `g.aspect_ratio`, `g.tile_shape` to the SELECT in the grid-links GET endpoint. Return `aspectRatio: l.aspect_ratio || '1:1'` and `tileShape: l.tile_shape || 'square'` in the response object.

---

### HIGH-3: No ESLint Configuration — Zero Static Analysis
**Reviewer**: Build (B-2)
**Files**: Project root (no `eslint.config.*` or `.eslintrc*` exists)

There is no ESLint configuration anywhere in the project. CI runs typecheck, unit tests, and build — but no linting. Code style violations, unsafe patterns (`any` casts, missing returns, unreachable code), and JS/TS anti-patterns go completely unchecked.

**Cross-ref**: Hygiene-H4 documents 8 `as any` casts in a 50-line span of `UnifiedConfigPanel.tsx`. Hygiene-H9 notes `Record<string, any>` in a public interface. Hygiene-H6 notes an `eslint-disable-line` suppression hiding a real hook dependency issue — but there is no ESLint to suppress. Build-B13 notes `noUnusedLocals` and `noUnusedParameters` are also disabled in tsconfig.

**Action**: Add `eslint` and `eslint-plugin-react-hooks` as devDependencies. Create `eslint.config.js` with `@typescript-eslint/recommended` rules. Add `"lint": "eslint src server"` to scripts and a lint step to CI.

---

### HIGH-4: E2E Tests Excluded from CI Pipeline
**Reviewer**: Build (B-3)
**Files**: `.github/workflows/ci.yml`

The CI pipeline runs only `typecheck`, `test:unit`, and `build`. The Playwright E2E suite (`tests/extraction.spec.ts`) that validates core sprite extraction behavior never runs in CI. Regressions in image processing workflows are not caught automatically.

**Cross-ref**: Testing-T-8 notes the Playwright config only starts Vite (frontend), not the Express backend — the E2E tests are not truly end-to-end even when run locally. Testing-T-4 notes fixture discovery can silently produce zero test cases. Testing-T-1 confirms coverage thresholds would not catch the gap either.

**Action**: Add a CI job that installs Playwright browsers, starts both Vite and Express servers, and runs the E2E suite. Restructure tests to use fixtures for CI runs if a Gemini API key is unavailable.

---

### HIGH-5: Vite/esbuild Known Security Vulnerability (GHSA-67mh-4wv8-2f99)
**Reviewer**: Build (B-4)
**Files**: `package.json:43`, `node_modules/vite` v5.4.21, `node_modules/esbuild` <=0.24.2

`npm audit` reports 2 moderate vulnerabilities: esbuild <=0.24.2 allows any website to send requests to the dev server and read responses (CWE-346, CVSS 5.3). The fix requires upgrading to `vite@7.3.1` (major version bump). Development-server only, not a production risk, but exploitable if a developer visits a malicious site while running `npm run dev`.

**Cross-ref**: Build-B12 notes no `npm audit` step in CI, so this vulnerability was not automatically flagged.

**Action**: Upgrade to `vite@^7.0.0` and `@vitejs/plugin-react@^5.0.0`. Test proxy configuration and HMR after upgrade. Add `npm audit --audit-level=moderate` to CI.

---

### HIGH-6: Coverage Thresholds Provide Zero Regression Protection
**Reviewer**: Testing (T-1), Build (B-5)
**Files**: `vitest.config.ts:12-17`

Coverage thresholds are set at statements: 8%, branches: 15%, functions: 2%, lines: 8%. Actual coverage is ~14% statements, ~20% branches, ~6% functions — the thresholds are below current coverage and provide no safety net. A developer could delete 85% of tested code and still pass CI. The entire `src/hooks/` directory has 0% coverage.

**Cross-ref**: Testing-T-2 notes the consolidated `useGenericWorkflow.ts` has no tests. Testing-T-6 notes zero component/hook tests exist. Build-B3 confirms E2E tests are also excluded from CI. Together, these create a layered gap: low thresholds + missing tests + excluded E2E = no regression protection.

**Action**: Ratchet thresholds to at least 50% statements/lines, 40% branches/functions. Add per-directory overrides for well-tested modules. Each PR should only increase coverage.

---

### HIGH-7: No Centralized API Client — 20+ Scattered fetch() Calls
**Reviewer**: Contract (C-2)
**Files**: `src/hooks/useGenericWorkflow.ts`, `src/components/gallery/GalleryPage.tsx`, `src/components/grid/SpriteReview.tsx`, `src/components/admin/GenericPresetsTab.tsx`, `src/components/admin/LinkedGridPresets.tsx`, `src/components/admin/GridPresetsTab.tsx`, `src/components/config/UnifiedConfigPanel.tsx`, `src/components/shared/GridLinkSelector.tsx`, `src/lib/promptForType.ts`, `src/context/AppContext.tsx`, `src/App.tsx`

Every API call is a raw `fetch()` with manually set headers and ad-hoc error handling. Styles range from `.catch(console.error)` to `.catch(() => {})` to proper dispatch. No base URL abstraction, no shared timeout or retry logic. `geminiClient.ts` demonstrates the right pattern but is the exception.

**Cross-ref**: Contract-C9 notes admin delete operations don't check `response.ok` — server errors are silently swallowed. Hygiene-H12 notes editor settings failures are invisible to the user. Testing-T-2 notes none of these fetch calls are tested.

**Action**: Create `src/api/client.ts` with a typed wrapper handling Content-Type, error extraction from `{ error: string }` envelope, and normalized error throwing. Migrate all 20+ call sites.

---

### HIGH-8: History Response Omits Persisted Content Fields — Silent Data Loss on Restore
**Reviewer**: Contract (C-3), Hygiene (H-13)
**Files**: `server/routes/history.js:38-65`, `src/types/api.ts:9-35`

The server returns `equipment: ''`, `colorNotes: ''`, `styleNotes: ''`, `rowGuidance: ''` as hardcoded empty strings — these fields are never persisted to the `generations` table. Only `content_name` and `content_description` are stored. When a character generation is restored from history, all detail fields are blank even if the user entered them. `filledGridMimeType` is also hardcoded to `'image/png'` regardless of actual type.

**Cross-ref**: Contract-C5 notes no runtime response validation exists, so the empty strings are accepted without question. Build-B6 notes server JS is not type-checked, so there is no compile-time signal that the response shape is incomplete.

**Action**: Either persist the full content fields in the DB (add columns or a JSON blob) or remove the misleading stub fields from the response and document which fields are not persisted.

---

### HIGH-9: Server Routes with No Tests — Gallery, Archive, GridLinks, GridPresets, State
**Reviewer**: Testing (T-3)
**Files**: `server/routes/gallery.js`, `server/routes/archive.js`, `server/routes/gridLinks.js`, `server/routes/gridPresets.js`, `server/routes/state.js`

The majority of the server's CRUD surface is untested. Archive path traversal protection (`resolve(folderPath).startsWith(resolvedOutputDir)`) is a security-critical check with no test. Gallery pagination logic is untested. Grid links and grid presets CRUD have no tests.

**Cross-ref**: Build-B6 notes server JS is not type-checked — SQL bugs are invisible. Testing-T-5 notes history tests use a mock DB that hides SQL errors, while presets tests use real in-memory SQLite (stronger pattern). Contract-C1 notes the grid-links endpoint has a real bug (missing fields) that would have been caught by a contract test.

**Action**: Use the in-memory SQLite pattern from `presets.test.js` to test these routes. The `findHandler()` helper from `history.test.js` enables testing route handlers without starting an HTTP server.

---

### HIGH-10: Server Code Uses Plain JavaScript — Not Type-Checked
**Reviewer**: Build (B-6)
**Files**: `tsconfig.json:23`, `server/*.js`

The entire Express server is plain JavaScript. `tsconfig.json` includes only `"src"`, so `npm run typecheck` never validates server code. Type errors in route handlers, database queries, and API response shapes are invisible at compile time.

**Cross-ref**: Contract-C1 demonstrates the real-world impact: the grid-links endpoint omits fields the client expects, but TypeScript cannot catch this because the server is untyped. Contract-C3 notes history response shape mismatches. Hygiene-H10 notes inconsistent naming (`spriteType` vs `type`) across server routes that type-checking would surface.

**Action**: Migrate server to TypeScript, or at minimum add JSDoc type annotations and configure `allowJs: true` + `checkJs: true` in a separate `tsconfig.server.json`. Add server type-checking to the CI typecheck step.

---

## Medium-Severity Findings

### MED-1: No Runtime Response Validation — Client Trusts All API Responses
**Reviewer**: Contract (C-5)
**Files**: `src/hooks/useGenericWorkflow.ts:165`, `src/api/geminiClient.ts:34`, `src/components/gallery/GalleryPage.tsx:131`, `src/lib/promptForType.ts:27`

All API responses are accepted as-is with TypeScript type assertions. If the server returns an unexpected shape (failed migration, HTML error page, schema change), the client silently receives `undefined` fields. The only defense is a `Number.isFinite(histId)` check in `useGenericWorkflow.ts:166-171`.

**Action**: Add Zod schemas for the 3-4 most critical endpoints. At minimum, validate `result.image` has `data` and `mimeType` before dispatching in the generate flow.

---

### MED-2: `GalleryResponse` Interface Duplicated in Two Files
**Reviewer**: Contract (C-4), Hygiene (H-3)
**Files**: `src/types/api.ts:77-92`, `src/components/gallery/GalleryPage.tsx:28-33`

Two independent `GalleryResponse` interfaces. Neither matches the full server response shape. The local type in `GalleryPage.tsx` shadows the canonical type in `api.ts`.

**Cross-ref**: Hygiene-H11 notes `GalleryEntry` and `GalleryGroup` types are also only defined locally in `GalleryPage.tsx`.

**Action**: Remove the local duplicate. Import from `src/types/api.ts`. Move `GalleryEntry` and `GalleryGroup` to `api.ts` as well.

---

### MED-3: `as any` Cluster in UnifiedConfigPanel.tsx
**Reviewer**: Hygiene (H-4)
**Files**: `src/components/config/UnifiedConfigPanel.tsx:225-270`

Eight `as any` casts in a 50-line span. Content is typed as `Record<string, unknown>` despite the component knowing `spriteType` — the type information is discarded unnecessarily. Typos in field names produce `undefined` at runtime rather than compile errors.

**Cross-ref**: Build-B2 notes no ESLint to flag these casts. Contract-C5 notes no runtime validation either. The casts exist because there is no discriminated union abstraction for sprite-type content.

**Action**: Create a typed helper or discriminated union for content access. Replace `content` typed as `Record<string, unknown>` with per-type narrowing.

---

### MED-4: `lastHistoryId` State Endpoint Race Condition and Type Round-Trip
**Reviewer**: Contract (C-6)
**Files**: `src/context/AppContext.tsx:594-611`, `src/App.tsx:35-44`

The state sync endpoint is called from both AppContext (PUT on historyId change) and App.tsx (DELETE on session restore). A race exists: if the user resets state before the PUT completes, the DELETE may execute first, leaving stale `lastHistoryId`. The value also goes through a number -> string -> number round-trip.

**Action**: Centralize `lastHistoryId` persistence in a single hook. Document the type round-trip.

---

### MED-5: Inconsistent URL Scheme for Presets API
**Reviewer**: Contract (C-7)
**Files**: `server/routes/presets.js:9-24,27-69`

The list endpoint uses query param (`?type=character`) while all CRUD endpoints use path param (`/:type/:id`). The GET list also handles type validation manually instead of using `validatePresetType` middleware.

**Action**: Normalize to `GET /api/presets/:type` to match CRUD pattern. Apply `validatePresetType` middleware uniformly.

---

### MED-6: E2E Tests Require Fixtures That May Not Exist — Silent Pass
**Reviewer**: Testing (T-4)
**Files**: `tests/extraction.spec.ts:50-61`

The E2E tests dynamically discover fixtures from `test-fixtures/`. If the directory is empty or missing, the `describe` block has zero test cases and silently passes — a false-green scenario. The posterization test hardcodes `mosskin-spirit.png` and fails with a confusing error if absent.

**Action**: Add a test asserting `fixtures.length > 0`. Use `test.skip` with a clear message when fixtures are absent.

---

### MED-7: History Route Tests Use Mocked DB — Miss Real SQL Behavior
**Reviewer**: Testing (T-5)
**Files**: `server/__tests__/history.test.js`

`history.test.js` uses hand-rolled `mockDb()` stubs. SQL queries are never executed — only route validation logic is tested. The INSERT SQL could be syntactically broken and tests would still pass. Contrast with `presets.test.js` which uses real in-memory SQLite.

**Action**: Replace `mockDb()` with the `freshDb()` pattern (real in-memory SQLite) to catch schema mismatches and SQL bugs.

---

### MED-8: No Tests for React Components or Hooks
**Reviewer**: Testing (T-6)
**Files**: `src/components/` (all 15+ TSX files), `src/hooks/` (all 10 hooks)

The reducer is well-tested (~80 test cases). But the context provider, all hooks, and all components have zero test coverage. `ErrorBoundary.tsx` — designed to catch failures — has no test verifying it renders a fallback.

**Action**: Add React Testing Library tests for `ErrorBoundary`, `StatusBanner`, `useChromaKeySettings`, and `usePosterizeSettings` as starting points.

---

### MED-9: Canvas API Testing Gap — templateGenerator Untestable in Node
**Reviewer**: Testing (T-7)
**Files**: `vitest.config.ts:5-6`

`spriteExtractor.ts` and `templateGenerator.ts` depend on browser canvas APIs. The setup file polyfills `ImageData` but not the full canvas context. `templateGenerator.ts` has no tests partly for this reason.

**Action**: Add `canvas` or `@napi-rs/canvas` as a dev dependency, or extract pure computational logic from canvas-drawing functions into testable pure functions.

---

### MED-10: Playwright Config Does Not Start Express Backend
**Reviewer**: Testing (T-8)
**Files**: `playwright.config.ts:11-16`

The Playwright config only starts the Vite dev server. The Express backend is not started, so E2E tests are not truly end-to-end — they test the extraction harness in isolation.

**Cross-ref**: Contract-C1 notes client-server contract has no integration tests. Build-B3 notes E2E tests are excluded from CI entirely.

**Action**: Add a second `webServer` entry to start Express. Add at least one true E2E test exercising the full flow with a mocked Gemini response.

---

### MED-11: Duplicate Reference Prefix String in Prompt Builders
**Reviewer**: Hygiene (H-1)
**Files**: `src/lib/promptBuilder.ts:236-244`, `src/lib/promptForType.ts:14-22`

The multi-grid "reference image" prefix text is defined identically in two places. `promptForType.ts` exports `REFERENCE_PREFIX` as a constant. `promptBuilder.ts` defines a local variable with character-for-character identical text without importing the constant.

**Action**: Import `REFERENCE_PREFIX` from `promptForType.ts` in `promptBuilder.ts`, or move it to `promptBuilderBase.ts`.

---

### MED-12: `proceedToNextGrid` and `skipCurrentGrid` Are Functionally Identical
**Reviewer**: Hygiene (H-2)
**Files**: `src/hooks/useRunWorkflow.ts:99-113`

Two separately named callbacks with identical bodies — both check `isGeneratingRef.current`, dispatch `NEXT_GRID`, and differ only in the warning message. The UI maps them to distinct buttons but the behavior is the same.

**Action**: Consolidate to a single `advanceToNextGrid()` callback. UI buttons can have different labels without separate handlers.

---

### MED-13: Node.js Version Mismatch Between engines and CI
**Reviewer**: Build (B-7)
**Files**: `package.json:7`, `.github/workflows/ci.yml:18`

`engines` specifies `>=20`, CI runs Node 22. No `.nvmrc` pins local dev version. `node --watch` behavior differs between versions.

**Action**: Add `.nvmrc` with `22`. Consider tightening `engines` to `>=22`.

---

### MED-14: Single Monolithic JavaScript Bundle — No Code Splitting
**Reviewer**: Build (B-8)
**Files**: `vite.config.js`, `dist/assets/index-*.js` (308KB raw, ~85KB gzip)

No route-based or component-based code splitting. The bundle grows linearly as features are added.

**Cross-ref**: Adding new sprite types (architecture concern) would grow the bundle further without splitting.

**Action**: Add `manualChunks` for vendor libraries. Consider lazy-loading the admin panel and sprite-type config panels.

---

### MED-15: Google Fonts Loaded from External CDN
**Reviewer**: Build (B-9)
**Files**: `index.html:7-9`

Three Google Fonts families loaded from external CDN. Implications: network latency, Google tracking, no offline support, CSP complexity.

**Action**: Self-host fonts using `@fontsource` npm packages.

---

### MED-16: `Record<string, any>` in PipelineParams Interface
**Reviewer**: Hygiene (H-9)
**Files**: `src/hooks/useGenericWorkflow.ts:47`

`historyExtras?: Record<string, any>` uses `any` in a public interface. The actual values are well-typed (`groupId`, `contentPresetId`).

**Action**: Create a narrow `HistoryExtras` interface with the specific fields.

---

### MED-17: Naming Inconsistency: `spriteType` vs `type` Across Server Routes
**Reviewer**: Hygiene (H-10)
**Files**: `server/routes/presets.js`, `server/routes/history.js`, `server/routes/gallery.js`, `server/routes/generate.js`

The same concept uses two different names across server routes. `presets` and `gallery` use `type`, `history` uses `spriteType`.

**Cross-ref**: Build-B6 notes server JS is not type-checked — inconsistencies like this are invisible.

**Action**: Standardize to one name across all routes. Document the choice.

---

### MED-18: Inline Gallery Types Not in Canonical Types File
**Reviewer**: Hygiene (H-11)
**Files**: `src/components/gallery/GalleryPage.tsx:11-33`

`GalleryEntry` and `GalleryGroup` interfaces are declared locally in `GalleryPage.tsx` and not exported. Any future component displaying gallery data would need to re-declare them.

**Action**: Move to `src/types/api.ts` alongside the existing `GalleryResponse`.

---

## Low-Severity Findings

### LOW-1: `templateImage` Stored in History But Never Returned to Client
**Reviewer**: Contract (C-8)
**Files**: `server/routes/history.js:87,38-65`

The template image is persisted via POST but not included in GET. Session restore cannot replay the exact grid template used.

---

### LOW-2: Admin Fetch Calls Missing Error Response Body Parsing
**Reviewer**: Contract (C-9)
**Files**: `src/components/admin/GridPresetsTab.tsx:123`, `src/components/admin/LinkedGridPresets.tsx:41-56`

Several admin fetch calls don't check `response.ok` and don't read the `{ error: string }` envelope from the server on failures.

---

### LOW-3: `@deprecated` Exports Still Actively Imported by 6 Production Files
**Reviewer**: Hygiene (H-5)
**Files**: `src/lib/poses.ts:21,97`, importers: `gridConfig.ts`, `spriteExtractor.ts`, `templateGenerator.ts`, `SpriteGrid.tsx`, `useAnimationLoop.ts`, `AnimationPreview.tsx`

`CELL_LABELS` and `ANIMATIONS` are marked `@deprecated` but are load-bearing runtime fallbacks. The deprecation markers are misleading.

**Action**: Either remove `@deprecated` if the fallback is permanent, or add a date annotation.

---

### LOW-4: eslint-disable Hides Real Hook Dependency Issue
**Reviewer**: Hygiene (H-6)
**Files**: `src/components/shared/GridLinkSelector.tsx:46`

`onSelectionChange` excluded from effect deps via lint suppression. If the parent changes the handler without changing `presetId` or `spriteType`, the stale handler is called.

**Action**: Use a ref-based callback pattern and remove the suppressor.

---

### LOW-5: Hardcoded Placeholder Model Name in Three Locations
**Reviewer**: Hygiene (H-7)
**Files**: `src/context/AppContext.tsx:260`, `src/api/geminiClient.ts:37`, `server/routes/generate.js:196`

`'nano-banana-pro-preview'` is hardcoded in three places. Not a real Gemini model but accepted by `ALLOWED_MODELS`.

**Action**: Extract a `DEFAULT_MODEL` constant in a shared config file.

---

### LOW-6: `console.log` Bypasses debugLog Convention in chromaKey.ts
**Reviewer**: Hygiene (H-8)
**Files**: `src/lib/chromaKey.ts:284`

The only `console.log` in `src/lib/` not routed through the `debugLog` abstraction. Already DEV-gated but inconsistent with the project convention.

**Action**: Replace with `debugLog(...)`.

---

### LOW-7: Silent Editor Settings Failure — Not User-Visible
**Reviewer**: Hygiene (H-12)
**Files**: `src/hooks/useEditorSettings.ts:60,94`

Failed settings-save operations use `console.error` only — no `SET_STATUS` dispatch. The user receives no feedback if settings fail to save.

**Action**: Dispatch `SET_STATUS` with `statusType: 'warning'` on save failures.

---

### LOW-8: Reducer Edge Cases Missing in Tests
**Reviewer**: Testing (T-9)
**Files**: `src/context/__tests__/appReducer.test.ts`

Missing edge cases: invalid `gridSize` strings in `LOAD_BUILDING_PRESET`/`LOAD_TERRAIN_PRESET`, `SET_BUILDING_PRESETS`/`SET_TERRAIN_PRESETS` use empty arrays, `RESTORE_SESSION` doesn't test error state clearing, `NEXT_GRID` boundary behavior untested.

**Action**: Add targeted edge-case tests.

---

### LOW-9: No Documented Production Deployment Path
**Reviewer**: Build (B-10)
**Files**: `package.json`, `server/index.js`

Express does not serve the Vite build output in production mode. No unified production server script exists.

**Action**: Add production static file serving to `server/index.js` when `NODE_ENV=production`.

---

### LOW-10: morgan Listed in Dependencies But Missing from node_modules
**Reviewer**: Build (B-11)
**Files**: `package.json:29`, `server/index.js:6`

`morgan` is in `package.json` and imported in the server but missing from `node_modules`. Local `npm install` would fix this. CI `npm ci` restores it correctly.

---

### LOW-11: No `npm audit` Check in CI
**Reviewer**: Build (B-12)
**Files**: `.github/workflows/ci.yml`

The current esbuild/vite vulnerability was not automatically flagged because CI does not run `npm audit`.

**Action**: Add `npm audit --audit-level=moderate` to CI.

---

### LOW-12: `noUnusedLocals` and `noUnusedParameters` Disabled in tsconfig
**Reviewer**: Build (B-13)
**Files**: `tsconfig.json:15-16`

Dead code variables and unused parameters have no compiler warnings. Combined with no ESLint, there is no static analysis enforcing code cleanliness.

**Action**: Enable both flags and fix resulting errors.

---

### LOW-13: `better-sqlite3` Native Module — No Platform Documentation
**Reviewer**: Build (B-14)
**Files**: `package.json:24`

`better-sqlite3` compiles via `node-gyp`. No documentation about platform considerations for deployment.

---

### LOW-14: History Route Returns Hardcoded Empty Strings (Duplicate of HIGH-8)
**Reviewer**: Hygiene (H-13)
**Files**: `server/routes/history.js:44-48`

Independently confirmed by hygiene reviewer. Same finding as HIGH-8 from contract reviewer — `equipment`, `colorNotes`, `styleNotes`, `rowGuidance` always returned as empty strings.

*Merged into HIGH-8 for action tracking.*

---

### LOW-15: Active API Key in .env.local
**Reviewer**: Build (B-1)
**Files**: `.env.local`

Live Google Gemini API key in `.env.local`. Correctly in `.gitignore` and never committed. Local-only exposure risk.

**Action**: Rotate the key if the machine is shared. Consider a pre-commit hook scanning for API key patterns.

---

### LOW-16: `GalleryResponse` Missing Fields Relative to Server Response
**Reviewer**: Contract (C-4 — additional detail)
**Files**: `src/types/api.ts:77-92`

Both the canonical and local `GalleryResponse` types omit `contentDescription` and `model` fields that the server returns.

*Merged into MED-2 for action tracking.*

---

### LOW-17: Fetch in promptForType Has No Validation
**Reviewer**: Contract (C-5 — additional detail)
**Files**: `src/lib/promptForType.ts:27`

`return res.json()` with no validation of the response shape.

*Merged into MED-1 for action tracking.*

---

## Cross-Pollination Matrix

| Theme | Testing | Build | Contract | Hygiene | Notes |
|-------|---------|-------|----------|---------|-------|
| **CI provides false safety** | T-1 (8% threshold), T-4 (silent fixture pass) | B-2 (no ESLint), B-3 (E2E excluded), B-5 (token thresholds), B-12 (no audit) | -- | -- | Root cause: CI was configured to pass, not to protect |
| **Client-server contract unenforced** | T-3 (no route tests), T-5 (mock DB hides SQL) | B-6 (server untyped) | C-1 (missing fields), C-3 (empty content), C-4 (duplicate types), C-5 (no validation) | H-3 (duplicate GalleryResponse), H-13 (empty history fields) | Root cause: no shared type layer between server JS and client TS |
| **No API client abstraction** | T-2 (fetch calls untested) | -- | C-2 (20+ raw fetches), C-9 (admin no error check) | H-12 (silent settings failure) | Root cause: missing abstraction layer for HTTP concerns |
| **Core pipeline untested** | T-2 (0 pipeline tests), T-7 (canvas untestable) | B-3 (E2E excluded from CI) | C-2 (no shared error handling) | H-2 (identical skip/proceed) | Most critical code path has no regression guard |
| **Type safety erosion** | -- | B-2 (no ESLint), B-6 (server untyped), B-13 (unused vars allowed) | C-5 (no runtime validation) | H-4 (8 `as any` casts), H-9 (`Record<string, any>`), H-6 (lint suppression) | Multiple layers allow type information to leak away |
| **Dependency / security hygiene** | -- | B-1 (API key local), B-4 (Vite CVE), B-11 (morgan missing), B-12 (no audit) | -- | H-7 (placeholder model in ALLOWED_MODELS) | No automated dependency or secret scanning |
| **Naming / convention inconsistency** | -- | B-7 (Node version mismatch) | C-7 (type vs spriteType URL scheme) | H-5 (misleading @deprecated), H-8 (debugLog bypass), H-10 (spriteType vs type) | Small inconsistencies compound into cognitive overhead |
| **Silent failures / data loss** | T-4 (fixtures silently absent) | -- | C-1 (aspectRatio silent fallback), C-3 (content fields erased), C-6 (state race) | H-12 (settings fail silently), H-13 (empty history) | Multiple paths fail without user signal |

---

## Root Cause Analysis

### 1. No Shared Type Layer Between Server and Client
The most impactful structural gap is that the Express server is plain JavaScript while the client is TypeScript. There is no shared type definition, no code generation, and no runtime validation bridge. The `src/types/api.ts` file declares response shapes that the server does not validate against. When the server omits a field (HIGH-2: `aspectRatio`), returns stub data (HIGH-8: empty content fields), or changes its response shape, TypeScript provides no signal — the client silently accepts wrong data. This single architectural decision cascades into: unenforced contracts, duplicate type definitions, silent data loss on session restore, and untestable API boundaries.

### 2. CI Configured to Pass, Not to Protect
The CI pipeline has the structure of quality enforcement but none of the substance. Coverage thresholds are set below actual coverage (never trigger). E2E tests exist but are excluded from CI. No ESLint configuration exists. No `npm audit` runs. `noUnusedLocals` and `noUnusedParameters` are disabled. The result is a green CI badge that protects against almost nothing — only TypeScript compilation errors and the small subset of unit tests that exist. Three of the four reviewers independently identified aspects of this gap, making it the most cross-cutting systemic issue.

### 3. Missing HTTP Abstraction Layer
The codebase has 20+ raw `fetch()` calls with per-site error handling. This is not just a code hygiene issue — it prevents implementing cross-cutting concerns (auth, request IDs, retries, timeout, error normalization) and makes the API surface untestable as a unit. The `geminiClient.ts` module proves the team can build proper API abstractions; the pattern just wasn't applied to the internal API. Every admin component, every workflow hook, and every state sync operation independently handles HTTP concerns.

### 4. Test Strategy Inverted — Periphery Tested, Core Untested
The reducer has ~80 test cases — excellent coverage for state transitions. But the generate pipeline (the app's primary value), all React components, all hooks, and most server routes have zero tests. The test investment is concentrated on the simplest-to-test layer (pure reducer functions) while the most complex and failure-prone layers (async pipelines, canvas operations, API integrations, CRUD routes) are completely unguarded. The E2E suite that does exist validates sprite extraction in isolation — not the full application flow.

### 5. Contract Drift Accumulates Silently
Multiple findings reveal a pattern where the API contract has drifted without anyone noticing: `aspectRatio` missing from grid-links (HIGH-2), content fields empty on restore (HIGH-8), `GalleryResponse` duplicated with different shapes (MED-2), `templateImage` stored but never returned (LOW-1). Each drift was invisible because: (a) the server is untyped, (b) the client uses silent fallbacks (`|| '1:1'`, `|| ''`), (c) no integration tests verify the contract, and (d) no runtime validation catches unexpected shapes. The silent fallback pattern is particularly insidious — it masks bugs as "defaults."

---

## Recommended Action Priority

### Immediate (This Sprint)
| Priority | Action | Findings | Effort |
|----------|--------|----------|--------|
| P0 | **Fix grid-links endpoint** — add `aspect_ratio`, `tile_shape` to SELECT | HIGH-2 | 30 min |
| P0 | **Add ESLint** with `@typescript-eslint/recommended` + `react-hooks` plugin, add lint to CI | HIGH-3 | 2 hours |
| P0 | **Upgrade Vite** to v7.x to resolve GHSA-67mh-4wv8-2f99 | HIGH-5 | 2 hours |
| P1 | **Add `npm audit`** to CI pipeline | HIGH-5, LOW-11 | 15 min |
| P1 | **Ratchet coverage thresholds** to 50%+ statements/lines | HIGH-6 | 30 min |
| P1 | **Enable `noUnusedLocals`/`noUnusedParameters`** in tsconfig | LOW-12 | 1 hour |

### Short-Term (Next 2-4 Weeks)
| Priority | Action | Findings | Effort |
|----------|--------|----------|--------|
| P1 | **Add E2E tests to CI** — install Playwright, start both servers | HIGH-4, MED-10 | 3 hours |
| P1 | **Create `src/api/client.ts`** — centralized fetch wrapper with error normalization | HIGH-7 | 4 hours |
| P1 | **Unit-test the generate pipeline** — mock fetch, test `runGeneratePipeline` | HIGH-1, HIGH-6 | 4 hours |
| P2 | **Test untested server routes** — gallery, archive, gridLinks, gridPresets, state using real in-memory SQLite | HIGH-9 | 1 day |
| P2 | **Persist full content fields** in history or remove stub fields from response | HIGH-8 | 3 hours |
| P2 | **Migrate history tests to real DB** — replace `mockDb()` with `freshDb()` pattern | MED-7 | 2 hours |
| P2 | **Add runtime response validation** for critical endpoints (generate, history) | MED-1 | 3 hours |
| P2 | **Deduplicate GalleryResponse** — remove local, import from `api.ts` | MED-2, MED-18 | 30 min |
| P2 | **Consolidate `proceedToNextGrid`/`skipCurrentGrid`** into single callback | MED-12 | 30 min |
| P2 | **Import REFERENCE_PREFIX** instead of duplicating in promptBuilder.ts | MED-11 | 15 min |
| P2 | **Add fixture count assertion** to prevent silent E2E pass | MED-6 | 15 min |
| P2 | **Normalize presets URL scheme** — `GET /api/presets/:type` to match CRUD pattern | MED-5 | 1 hour |
| P2 | **Add `.nvmrc`** pinning Node 22 | MED-13 | 5 min |

### Medium-Term (1-3 Months)
| Priority | Action | Findings | Effort |
|----------|--------|----------|--------|
| P2 | **Migrate server to TypeScript** or add JSDoc types + `checkJs` | HIGH-10 | 1-2 weeks |
| P2 | **Add React Testing Library tests** for ErrorBoundary, StatusBanner, key hooks | MED-8 | 2-3 days |
| P3 | **Replace `as any` cluster** with discriminated union or typed helper in UnifiedConfigPanel | MED-3 | 3 hours |
| P3 | **Create narrow `HistoryExtras` type** to replace `Record<string, any>` | MED-16 | 30 min |
| P3 | **Add canvas polyfill** (`@napi-rs/canvas`) to test setup for templateGenerator | MED-9 | 2 hours |
| P3 | **Add code splitting** — vendor chunk, lazy-load admin panel | MED-14 | 3 hours |
| P3 | **Self-host Google Fonts** via `@fontsource` packages | MED-15 | 1 hour |
| P3 | **Standardize `spriteType` vs `type` naming** across server routes | MED-17 | 1 hour |
| P3 | **Centralize `lastHistoryId` persistence** in single hook, document type round-trip | MED-4 | 2 hours |
| P4 | **Extract `DEFAULT_MODEL` constant** to shared config | LOW-5 | 30 min |
| P4 | **Replace `console.log` with `debugLog`** in chromaKey.ts | LOW-6 | 5 min |
| P4 | **Dispatch `SET_STATUS`** on editor settings save failure | LOW-7 | 30 min |
| P4 | **Add production static file serving** to server/index.js | LOW-9 | 1 hour |
| P4 | **Resolve `@deprecated` markers** — remove or add timeline | LOW-3 | 30 min |
| P4 | **Use ref-based callback** in GridLinkSelector, remove lint suppression | LOW-4 | 30 min |
| P4 | **Add reducer edge-case tests** | LOW-8 | 1 hour |
| P4 | **Document `better-sqlite3` platform requirements** | LOW-13 | 15 min |

---

## Positive Findings

The codebase demonstrates several strong practices that should be maintained and extended:

1. **Reducer test suite is exemplary** — `appReducer.test.ts` has ~80 test cases covering state transitions thoroughly. This is the strongest tested area of the codebase and demonstrates the team's testing ability. The pattern should be extended to hooks and server routes. (Testing)

2. **`presets.test.js` and `migrations.test.js` use real in-memory SQLite** — These tests create actual schemas and run real SQL queries, catching real bugs. This is a materially stronger pattern than the mock-based approach in `history.test.js` and should be the standard for all server tests. (Testing)

3. **`geminiClient.ts` is a well-structured API abstraction** — Proper error handling, typed responses, and clean separation of concerns. This module should serve as the model for the centralized API client (HIGH-7). (Contract)

4. **No TODO/FIXME/HACK comments anywhere** — The codebase is clean of abandoned work markers. No commented-out code was found. File organization is logical and consistent. (Hygiene)

5. **`debugLog` abstraction is consistently applied** — `src/lib/debugLog.ts` correctly gates verbose diagnostic output behind `import.meta.env.DEV`. The pattern is sound and used consistently across the codebase, with only one minor exception (LOW-6). (Hygiene)

6. **Successful workflow consolidation** — The refactoring of 4 duplicate workflow hooks into `useGenericWorkflow.ts` demonstrates the team's ability to identify and eliminate duplication. The consolidation was clean and well-executed. Now it needs test coverage. (Hygiene, Testing)

7. **CI pipeline structure is sound** — The `.github/workflows/ci.yml` runs typecheck, unit tests, and build in the right order. The infrastructure is correct; it just needs the gates tightened (coverage thresholds, ESLint, E2E, audit). (Build)

8. **Git hygiene is excellent** — `.gitignore` correctly excludes `.env.local`, `node_modules`, `dist`, and generated files. No secrets have been committed to git history. (Build)

9. **`PRESET_TABLES` dictionary pattern** — The server-side preset configuration via a single map entry enabling all CRUD operations generically remains the cleanest registration pattern. (Contract, Hygiene)

10. **Effect cleanup patterns are consistent** — AbortController in fetch effects, `cancelled` boolean guards in async image loads, `clearInterval`/`clearTimeout` in animation effects are all properly applied. (Hygiene)

---

*Report compiled from 45 findings across 4 review domains (Testing: 9, Build: 14, Contract: 9, Hygiene: 13). Two findings were independently identified by multiple reviewers: history content field gap (Contract-C3, Hygiene-H13) and GalleryResponse duplication (Contract-C4, Hygiene-H3), confirming cross-reviewer consistency.*
