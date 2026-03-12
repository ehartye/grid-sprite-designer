# Grid Sprite Designer — Review Round 4 Report

**Date:** 2026-03-07
**Reviewers:** Architecture, Testing, Operations, UX
**Branch:** master (commit f29a775)

---

## Executive Summary

The codebase has made meaningful progress with the `useGenericWorkflow` factory and `UnifiedConfigPanel` refactors, but the abstraction was not applied uniformly — admin CRUD, state management, gallery loading, and deployment remain in their pre-refactor form. The most urgent issues are a state bug causing potential infinite retry loops on generation failure, silent data loss when loading gallery entries during active editing, and a server with no graceful shutdown risking SQLite WAL corruption. Test coverage sits at approximately 15-20% of meaningful business logic, with zero tests for the central reducer, the generate pipeline, or any server-side code.

---

## 1. Component Architecture & React Patterns

### Finding A1: All 4 Workflow Hooks Instantiated Simultaneously (Medium)
**Files:** `src/components/config/UnifiedConfigPanel.tsx:160-175`, `src/components/grid/SpriteReview.tsx:133-160`

`useActiveWorkflow()` calls all four workflow hooks unconditionally on every render (required by Rules of Hooks), then selects the correct one via switch. This means 4 context subscriptions, 4 ref initializations, and 4 abort controller setups are active when only 1 is used. The same pattern repeats in SpriteReview for `reExtract`.

**Root cause:** The `WorkflowConfig` objects are embedded inside wrapper hooks rather than exported as a shared map. Components could call `useGenericWorkflow(WORKFLOW_CONFIGS[spriteType])` directly.

### Finding A2: Monolithic AppState Context (Medium)
**File:** `src/context/AppContext.tsx:114-218`

All four sprite type configs and preset arrays are stored in a single flat `AppState`. Any change triggers re-renders across the entire tree. Additionally, `activeContentPresetId` (line 166) is shared across all sprite types — switching types leaves a stale preset ID that causes silent failures in `AddSheetModal` grid link fetches. The `useMemo` around `dispatch` at line 565 is a no-op (React's `useReducer` dispatch is already stable).

### Finding A3: Admin Preset Tabs — 4x Identical CRUD with Silent Errors (Medium-High)
**Files:** `src/components/admin/CharacterPresetsTab.tsx`, `BuildingPresetsTab.tsx`, `TerrainPresetsTab.tsx`, `BackgroundPresetsTab.tsx`

All four tabs duplicate the same CRUD pattern. Two active bugs exist in all 4:
1. `handleSave` uses `try/finally` with no `catch` — API errors fail silently (e.g., `CharacterPresetsTab.tsx:60-91`)
2. `handleDelete` uses `window.confirm()` — inconsistent with the inline confirmation pattern used in `GalleryPage.tsx:197-199`

### Finding A4: SpriteReview God Component (Low-Medium)
**File:** `src/components/grid/SpriteReview.tsx` (852 lines)

Handles 12+ responsibilities including sprite processing, chroma key UI, posterize UI, animation groups, export logic, pixel erasure tracking, and settings persistence. The `processSprite` and `detectPalette` utility functions (lines 28-126) should be extracted to `src/lib/spriteProcessing.ts`.

### Finding A5: App.tsx Run UI Duplicated 3x (Low)
**File:** `src/App.tsx:76-162`

The run progress display (grid index, grid name, cancel button) is copy-pasted across three conditional branches. Should be extracted to a `RunProgressBar` component.

### Positive Patterns
- `useGenericWorkflow.ts` — excellent `WorkflowConfig` interface abstraction
- Context dispatch/state split — correctly separated `AppStateContext` and `AppDispatchContext`
- `useModalFocus.ts` — well-implemented focus trap with Tab cycling, Escape handling, and focus restoration
- `runGeneratePipeline` extracted as a standalone async function for reuse
- `SPRITE_TYPE_CONFIGS` data table avoids per-type branching for labels/placeholders

---

## 2. Testing Strategy & Code Coverage

### Finding T1: Zero Tests for Core State Management (Critical)
**Files:** `src/context/AppContext.tsx:330-533`, `src/hooks/useGenericWorkflow.ts:56-200`, `src/lib/loadGeneration.ts:30-181`

The 270-line central reducer (20+ action types) has zero tests. Key untested behaviors:
- `LOAD_BUILDING_PRESET` (line 409): cell label padding/truncation
- `NEXT_GRID` (line 504): run termination off-by-one risk
- `RESET` (line 519): preset preservation invariant
- `GENERATE_ERROR`: does not clear `state.run` (confirmed bug — see UX Finding U2)

`runGeneratePipeline()` — the entire generate-extract-save pipeline — has zero tests. Abort signal handling, history save failures, and archive failures are all untested. The function has inline `fetch()` calls with no injection seam for mocking.

`loadGenerationIntoState()` has a grid inference heuristic (line 108) that produces wrong layouts for prime sprite counts (7 sprites -> 1 column x 7 rows). Untested.

### Finding T2: Server-Side Logic Has Zero Coverage (High)
**Files:** `server/index.js`, `server/routes/generate.js`, `server/db.js`

The vitest config excludes `server/` entirely. Untested pure functions include:
- `parseIntParam()` (line 32) — used as ID validator for 15+ endpoints
- `parseGeminiResponse()` (lines 33-52) — null/undefined candidates not handled
- `callGemini()` retry logic (lines 8-31) — exponential backoff untested
- `mapPresetRow()` (line 185) — malformed JSON crashes the request

### Finding T3: Playwright Infrastructure Gaps (High)
**File:** `playwright.config.ts:11-15`

The `webServer` config starts only Vite (port 5174), not the backend (port 3002). Any Playwright test exercising API calls silently fails. No CI configuration exists. The Playwright suite only covers pixel-level extraction accuracy — zero e2e tests for user workflows, gallery navigation, or error recovery. Empty `FIXTURES_DIR` produces zero tests with no warning (silent pass).

### Finding T4: Existing Tests Are Well-Written (Positive)
The 7 Vitest unit tests in `src/lib/__tests__/` are solid: `chromaKey.test.ts` covers edge cases, `gridConfig.test.ts` tests mutation safety, `promptBuilder.test.ts` tests override hierarchy. These cover ~15-20% of meaningful logic.

### Finding T5: Test Configuration Issues (Medium)
No coverage reporting configured in `vitest.config.ts`. No test timeouts. `templateGenerator.ts` uses `document.createElement('canvas')` — untestable in Node without Canvas polyfill (only ImageData is polyfilled in setup.ts).

---

## 3. Production Readiness & Operations

### Finding O1: No Graceful Shutdown — SQLite WAL at Risk (Critical)
**Files:** `server/index.js:653-687`, `server/db.js:18`

No `SIGTERM`/`SIGINT` handlers. The EADDRINUSE handler uses `execSync` shell commands (`netstat`, `lsof`, `taskkill`) to kill whatever occupies the port — fragile, cross-platform dangerous, and masks the root cause. SQLite WAL mode is enabled (`db.js:18`) but `db.close()` is never called. Abrupt termination risks WAL corruption and data loss.

### Finding O2: API Key Exposure + Hardcoded CORS (High)
**Files:** `.env.local:1`, `server/index.js:18`

`.env.local` contains a live Gemini API key. While `.gitignore`d, there is no key rotation, format validation, or audit trail. CORS is hardcoded to `localhost:5173` and `localhost:5174` with no env var override — any non-localhost deployment is blocked. No `.env.example` file documents required variables.

### Finding O3: No Health Check + Test Routes in Production (High)
**Files:** `server/index.js:641-651`, `server/routes/generate.js:149-150`

No `/health` endpoint exists for monitoring or orchestration. Test fixture routes (`/tests`, `/test-fixtures`) are served unconditionally with no `NODE_ENV` guard. Error messages from `generate.js:150` leak raw Node.js error strings (`err.message`) to the client.

### Finding O4: No Structured Logging (Medium)
**Files:** `server/index.js` (9 calls), `server/routes/generate.js` (6 calls), `server/db.js` (12 calls)

27 `console.log/error/warn` calls across 3 server files. No structured format, log levels, request IDs, or correlation IDs. The global error handler logs full error objects including stack traces and query strings.

### Finding O5: No Deployment Configuration (Medium)
No Dockerfile, docker-compose, PM2 config, nginx config, or production `start` script. The server can only be started via `node --watch` (dev mode). The built `dist/` directory is never served by Express.

### Finding O6: Rate Limiting Only on Generate Endpoint (Medium)
**Files:** `server/routes/generate.js:57-63`, `server/index.js`

Only `POST /api/generate-grid` has rate limiting. The archive endpoint (`POST /api/archive`) accepts arbitrary base64 data and writes to disk with no request count limit, file size cap, or disk quota check. The 50MB JSON body limit is the only constraint.

### Finding O7: Fragile Database Migration Strategy (Low)
**File:** `server/db.js:200-231`

Migrations are raw `ALTER TABLE` statements in a try/catch that swallows ALL errors (not just "column already exists"). No versioning table, no rollback mechanism. Backfill operations run on every startup regardless of need.

---

## 4. User Experience Flow & Edge Cases

### Finding U1: Generate Button Gives No Feedback When Disabled (High)
**File:** `src/components/config/UnifiedConfigPanel.tsx:264-266, 469-495`

Two disablement conditions (`canGenerate` from name/description, `selectedGridLinks.length === 0`) surface no explanation to the user. The `GridLinkSelector` renders `null` when no preset is selected (line 71), hiding the entire grid selection section. New users see a grayed-out button with no way to self-diagnose.

### Finding U2: Run Mid-Failure Creates Orphaned State — Potential Infinite Retry (High)
**Files:** `src/App.tsx:59-70`, `src/context/AppContext.tsx:367-373`, `src/hooks/useRunWorkflow.ts:83-89`

`GENERATE_ERROR` sets `step: 'configure'` but does NOT clear `state.run`. This leaves `state.run.active === true` while the UI shows the configure panel. The auto-trigger effect at `App.tsx:59-70` can re-fire on the next render cycle, creating a potential infinite retry loop against the API. Additionally, multi-grid runs have no confirmation step — users are immediately committed to N API calls with no way to cancel without losing partial results.

### Finding U3: Gallery Load Silently Destroys In-Progress Work (High)
**File:** `src/components/gallery/GalleryPage.tsx:157-191`

`handleLoad` dispatches `RESET` (line 165) immediately before checking for unsaved work. Chroma key settings, color strikes, sprite reordering, and pixel erasures are all lost instantly with no confirmation dialog. `onSwitchToDesigner()` fires before extraction completes, leaving a brief flash of the configure panel. `erasedPixels` is local state only (never persisted), so pixel erasures are permanently lost.

### Finding U4: No Undo/Redo Anywhere in the Workflow (Medium)
**Files:** `src/context/AppContext.tsx`, `src/hooks/useSpriteSelection.ts`

No undo stack exists. Pixel erasure (local state only, never persisted), cell swaps (only bulk "Reset Swaps"), and color strikes have no granular undo. The `erasedPixels` state is not included in `EditorSettings` persistence.

### Finding U5: Arrow Key Conflicts Between Review and Animation (Medium)
**Files:** `src/hooks/useAnimationLoop.ts:145-175`, `src/components/preview/AnimationPreview.tsx:129-160`

Both `useAnimationLoop` and `AnimationPreview` register global `keydown` handlers for arrow keys. `useAnimationLoop` calls `e.preventDefault()` on arrows (line 153), blocking sidebar scrolling on small screens. When the zoom modal is open, its Escape handler and `useAnimationLoop`'s handler are both active simultaneously.

### Finding U6: Session Restore Race Condition (Low-Medium)
**File:** `src/App.tsx:27-47`

Session restore runs asynchronously on mount. If the user navigates to Gallery/Admin before restore completes, the restore fires `EXTRACTION_COMPLETE` and forces `step: 'review'` while the user is on a different tab — creating state/tab inconsistency.

### Finding U7: Add Sheet Cancel Loses Original Sprites (Low)
**File:** `src/components/grid/AddSheetModal.tsx:81-117`

Cancelling during add-sheet generation dispatches `RESET`, which clears ALL state including the original sprites. Users expect to return to their previous review state.

### Finding U8: Gallery Empty State Is Character-Centric (Low)
**File:** `src/components/gallery/GalleryPage.tsx:268-271`

"No generations yet. Create your first character!" — the app supports 4 sprite types.

---

## 5. Cross-Cutting Themes

### Theme 1: Incomplete Abstraction Layer — The Root Cause

All four reviewers independently converge on the same root issue: the app expanded from one sprite type to four by cloning rather than abstracting. The `useGenericWorkflow` refactor correctly solved the workflow hook layer, but the same pattern was NOT applied to:
- **How hooks are selected in components** (4x instantiation workaround) — Architecture
- **The AppState schema** (flat context with shared `activeContentPresetId`) — Architecture + UX
- **Admin CRUD tabs** (4 identical components with silent errors) — Architecture
- **Gallery load path** (`loadGenerationIntoState` 4-way switch) — Testing
- **State transition guards** (no "dirty state" concept, no unsaved-work protection) — UX

The `WorkflowConfig` pattern is the right model. Exporting configs as a named map (`WORKFLOW_CONFIGS`) would fix the hook fan-out (A1), enable config-level unit tests (T1), and establish the pattern for admin and gallery abstractions.

### Theme 2: Destructive State Transitions Without Guards

Three separate findings describe destructive operations with no user protection:
- `GENERATE_ERROR` doesn't clear `state.run`, creating orphaned state (U2)
- Gallery load dispatches `RESET` with no unsaved-work check (U3)
- Add Sheet cancel dispatches `RESET`, losing original sprites (U7)

The app has no `isDirty` flag, no `useUnsavedWorkGuard` hook, and no confirmation architecture for destructive transitions. Each destructive action was added ad-hoc without a shared guard pattern.

### Theme 3: Architecture Gaps Cause Testing Gaps (and Vice Versa)

The monolithic reducer is simultaneously the hardest code to test and the most likely to contain bugs. The fat `AppState` requires constructing complete fixtures for every test. `runGeneratePipeline` has inline `fetch()` calls with no injection seam. These architectural choices make testing expensive, which explains the 15-20% coverage. The arch-test cross-pollination identified that splitting the reducer and exporting `WORKFLOW_CONFIGS` would both improve architecture AND enable testing — the same refactor serves both goals.

UX-test cross-pollination further sharpens this: the 3 highest-severity UX findings (U1 disabled button, U2 orphaned run state, U3 gallery data loss) all have zero automated test coverage. This creates a compounding risk — the bugs exist undetected today, and any future fix could regress silently. The `loadGenerationIntoState` grid inference heuristic (`loadGeneration.ts:108`) and `bgMode` string-prefix check (`loadGeneration.ts:80`: `data.gridSize.startsWith('1x') ? 'parallax' : 'scene'`) are particularly fragile untested paths that directly affect what users see after a gallery load.

### Theme 4: Development-Only Assumptions Baked Into Server

The server has no concept of environment modes:
- EADDRINUSE handler kills processes and auto-restarts (O1)
- Test fixture routes served unconditionally (O3)
- CORS hardcoded to localhost (O2)
- No health endpoint (O3)
- No graceful shutdown or `db.close()` (O1)
- All logging is unstructured `console.*` (O4)

Every server behavior assumes it's running on a developer's machine. Adding `NODE_ENV` awareness is the minimum first step.

### Theme 5: Silent Failures Across All Layers

- Admin `handleSave` — `try/finally` with no `catch`, errors swallowed (A3)
- History/archive saves — `console.warn()` instead of `SET_STATUS` dispatch (T1)
- Gallery load grid link fetch — `console.error` + `setGridLinks([])` on stale preset ID (UX cross-pollination)
- Database migrations — `catch (_)` swallows all errors including syntax errors (O7)
- Empty Playwright fixture directory — zero tests generated, no warning (T3)

---

## 6. Prioritized Recommendations

### P1 — Critical / High Impact, Reasonable Effort

| # | Recommendation | Findings | Effort |
|---|---------------|----------|--------|
| 1 | **Fix GENERATE_ERROR to clear `state.run`** — one-line fix prevents infinite retry loop | U2, A2 | Trivial |
| 2 | **Add unsaved-work guard before gallery RESET** — confirmation dialog when `step !== 'configure'` | U3 | Low |
| 3 | **Add graceful shutdown + `db.close()`** — SIGTERM/SIGINT handlers, remove EADDRINUSE auto-kill | O1 | Low |
| 4 | **Fix admin `handleSave` silent errors** — add `catch` block with `SET_STATUS` dispatch in all 4 tabs | A3 | Low |
| 5 | **Add reducer unit tests** — pure function, no mocking needed, target 30-40 cases | T1 | Medium |
| 6 | **Gate test routes behind `NODE_ENV`** and add `/health` endpoint | O3 | Low |
| 7 | **Add `.env.example`** documenting GEMINI_API_KEY, PORT, DB_PATH, ALLOWED_ORIGINS | O2 | Trivial |

### P2 — High Impact, Medium Effort

| # | Recommendation | Findings | Effort |
|---|---------------|----------|--------|
| 8 | **Export `WORKFLOW_CONFIGS` as named map** — fixes hook fan-out, enables config tests, establishes pattern for load/admin | A1, T1 | Medium |
| 9 | **Add `validationMessage` to WorkflowConfig** — surface disabled-button reasons to users | U1, A1 | Medium |
| 10 | **Track `activeContentPresetId` per sprite type** — prevent stale preset ID across type switches | A2, UX cross-poll | Medium |
| 11 | **Add server pure-function tests** — parseIntParam, parseGeminiResponse, mapPresetRow | T2 | Medium |
| 12 | **Fix Playwright config to start backend** or add API mocking via `page.route()` | T3 | Medium |
| 13 | **Add CORS env var** (`ALLOWED_ORIGINS`) and normalize error messages in generate.js | O2, O3 | Low |
| 14 | **Persist `erasedPixels` in EditorSettings** — prevent permanent pixel erasure loss | U4 | Medium |
| 15 | **Add coverage reporting** to vitest.config.ts with minimum threshold | T5 | Low |

### P3 — Medium Impact, Higher Effort / Lower Urgency

| # | Recommendation | Findings | Effort |
|---|---------------|----------|--------|
| 16 | **Extract generic `PresetTabConfig` for admin CRUD** — eliminate 4x tab duplication | A3 | Medium-High |
| 17 | **Split AppState** — separate `PresetsContext` from active workflow state | A2 | Medium-High |
| 18 | **Extract SpriteReview** — move `processSprite`/`detectPalette` to `src/lib/`, extract sidebar component | A4 | Medium |
| 19 | **Scope keyboard handlers** — check `document.activeElement`, remove blanket `preventDefault` on arrows | U5 | Medium |
| 20 | **Add structured logging** (pino/winston) with request IDs and log levels | O4 | Medium |
| 21 | **Implement proper DB migration versioning** — `schema_migrations` table | O7 | Medium |
| 22 | **Add deployment configuration** — Dockerfile, production start script, static asset serving | O5 | Medium-High |
| 23 | **Add `runGeneratePipeline` integration tests** with mocked fetch | T1 | Medium-High |
| 24 | **Add rate limiting to write endpoints** (archive, history) with disk quota checks | O6 | Medium |
| 25 | **Fix Add Sheet cancel** — restore to review step instead of full RESET | U7 | Medium |
| 26 | **Add CI pipeline** (GitHub Actions) with test execution and secrets management | T3 | Medium |

---

## 7. Positive Observations

1. **`useGenericWorkflow` + `WorkflowConfig`** is an excellent abstraction that correctly identifies the shared workflow pattern. It demonstrates the team knows how to build good abstractions — the remaining work is applying this pattern more broadly.

2. **Context dispatch/state split** (`AppStateContext` / `AppDispatchContext`) follows React best practices and prevents unnecessary re-renders from dispatch consumers.

3. **`useModalFocus` hook** implements proper focus trap with Tab cycling, Escape handling, and focus restoration — a reusable pattern that shows attention to accessibility.

4. **`runGeneratePipeline` extraction** as a standalone async function enables reuse between `useGenericWorkflow` and `useRunWorkflow` without duplication.

5. **Existing unit tests are high quality** — `chromaKey.test.ts`, `gridConfig.test.ts`, and the prompt builder tests demonstrate thorough edge case coverage and good testing practices within their scope.

6. **`SPRITE_TYPE_CONFIGS` data table** in UnifiedConfigPanel is the right data-driven approach for component variation, avoiding per-type branching for UI strings.

7. **45+ extraction test fixtures** with pixel-level accuracy validation via Playwright show strong investment in correctness for the core extraction algorithm.

8. **The `PRESET_TABLES` dictionary pattern** in the server centralizes preset type validation — the right approach, just needs to be extended to a middleware layer.

---

*Report compiled from findings by: arch-reviewer, test-reviewer, ops-reviewer, ux-reviewer*
*Cross-pollination insights integrated from: arch+ux, arch+test, ux+arch, ops+all*
