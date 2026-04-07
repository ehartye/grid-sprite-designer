# Fresh Codebase Review Report

**Date**: 2026-03-07
**Reviewers**: Performance & Bundle Analysis, API Design & Data Flow, Developer Experience & Maintainability, Resilience & Error Recovery

---

## Executive Summary

The Grid Sprite Designer has a solid foundation with well-structured library code and a recently refactored generic workflow hook. However, the application suffers from three systemic issues that compound across all review dimensions: (1) a monolithic `AppContext` that causes full-tree re-renders on every dispatch, amplifying the blast radius of every other bug; (2) pervasive code duplication in config panels and restoration logic that has already caused feature drift (missing Aspect Ratio selector in 3 of 4 panels); and (3) incomplete error propagation in secondary code paths (`reExtract`, history save, gallery load) that silently loses user work. These issues are interconnected -- the monolithic context makes partial failures visible to more components, the duplication means fixes must be applied in multiple places, and the error gaps mean users cannot recover from failures that the performance bottlenecks make more likely.

---

## 1. Performance & Bundle Analysis

### Finding P1 (Critical): Monolithic AppContext causes full-tree re-renders
**File**: `src/context/AppContext.tsx:544-572`

`AppProvider` passes `{ state, dispatch }` as a single context value with no `useMemo`. The 19-field `AppState` includes 4 sprite configs, 5 preset arrays, and a `sprites[]` array holding up to 36 base64-encoded images. Every dispatch -- including trivial `SET_STATUS` toasts -- triggers re-renders in all 20+ consumers. No component in the codebase uses `React.memo`.

**Fix**: Split into `AppStateContext` (read) and `AppDispatchContext` (stable write). Wrap value in `useMemo`. Add `React.memo` to leaf components like `SpriteGrid`.

### Finding P2 (High): O(N) canvas allocations per slider interaction
**Files**: `src/lib/spriteExtractor.ts:376-434`, `src/components/grid/SpriteReview.tsx:27-125`

A 6x6 grid extraction creates up to 73 canvas elements. Slider changes fire `Promise.all(sprites.map(processSprite))` -- 36 concurrent canvas decode/encode operations on the main thread. 11 `console.log` calls in `spriteExtractor.ts` run on every extraction.

**Fix**: Move processing to a Web Worker with `OffscreenCanvas`. Reuse a singleton scratch canvas. Debounce slider-triggered reprocessing (100ms).

### Finding P3 (Medium): setInterval animation loop with per-frame checkerboard repaint
**File**: `src/hooks/useAnimationLoop.ts:91-143`

Uses `setInterval` instead of `requestAnimationFrame`. Repaints a 256-rect checkerboard and creates a `new Image()` with full base64 decode every frame at 20fps.

**Fix**: Pre-render checkerboard to offscreen canvas. Decode sprite image once via `createImageBitmap()`. Switch to `requestAnimationFrame` with elapsed-time throttling.

### Finding P4 (Medium): SpriteGrid not memoized, rebuilds Map every render
**File**: `src/components/grid/SpriteGrid.tsx:29-135`

Plain function component (no `React.memo`) that rebuilds a `Map<number, ExtractedSprite>` on every render. Renders 36 cells with 3 conditional buttons each.

**Fix**: Wrap with `React.memo`. Move Map construction into `useMemo`.

### Finding P5 (Medium): GalleryPage fetches with no cache or abort
**File**: `src/components/gallery/GalleryPage.tsx:117-137`

No `AbortController` to cancel stale requests. Rapid filter changes can produce out-of-order responses causing stale data flash.

**Fix**: Create `AbortController` per fetch, cancel previous on new fetch.

### Finding P6 (Low): No code splitting or lazy loading
**Files**: `vite.config.js:1-19`, `src/App.tsx:7-21`

All page components (`GalleryPage`, `AdminPage` + 5 tabs, `RunBuilderPage`) are eagerly imported despite tab-based navigation.

**Fix**: `React.lazy()` + `Suspense` for page-level components.

### Finding P7 (Low): Base64 image data stored in React state
**Files**: `src/context/AppContext.tsx:178-186`, `src/lib/spriteExtractor.ts`

Large base64 strings (2-4MB) stored in state force React's reconciler to diff them. Data URLs are reconstructed via string interpolation on every render for all 36 cells.

**Fix**: Cache data URLs in `useMemo`. Consider `URL.createObjectURL(blob)` for large images.

---

## 2. API Design & Data Flow

### Finding A1 (High): Silent cascade failure on history save
**Files**: `src/hooks/useGenericWorkflow.ts:130-154`, `src/hooks/useAddSheet.ts:181-203`

Two-step history save (POST history, then POST sprites) never checks `histResp.ok`. If the server returns 500, `histData.id` is `undefined`, and the follow-up request hits `/api/history/undefined/sprites`. The generation is silently lost.

**Fix**: Check `histResp.ok` before parsing. Consider merging into a single atomic `POST /api/history` endpoint that accepts sprites inline.

### Finding A2 (Medium): fetchContentPreset fetches entire list to get one record
**File**: `src/lib/promptForType.ts:24-30`

No `GET /api/presets/:type/:id` endpoint exists. The client fetches the full preset list and does client-side `find()`. In multi-grid runs, this repeats for every grid.

**Fix**: Add `GET /api/presets/:type/:id` server endpoint.

### Finding A3 (Medium): History-load restoration logic duplicated
**Files**: `src/App.tsx:35-157`, `src/components/gallery/GalleryPage.tsx:159-320`

Identical 4-way sprite-type branching, grid dimension inference, and extraction calls are copy-pasted. Error handling has already diverged (App.tsx uses `console.warn`; GalleryPage dispatches `SET_STATUS`).

**Fix**: Extract a shared `loadGenerationIntoState(id, dispatch)` function or custom hook.

### Finding A4 (Medium-Low): AppState carries all 4 sprite configs simultaneously
**File**: `src/context/AppContext.tsx:114-218`

Only one sprite type is active at a time, but all four configs are always present. Every consumer re-renders on any state change regardless of active type.

**Fix**: Split context or use selector hooks. See P1.

### Finding A5 (Low): REST convention inconsistencies
**File**: `server/index.js`

Mixed resource modeling (query param vs. path segment for type), missing 409 for already-set group, silent success on deleting non-existent records, open-ended `/api/state/:key` endpoint with no schema validation.

### Finding A6 (Low): Preset ID type inconsistency (TEXT vs INTEGER)
**Files**: `server/db.js:81-132`, `src/context/AppContext.tsx:54-97`

Content preset tables use `TEXT PRIMARY KEY` (slugs), but new presets created via POST return integer IDs. Strict equality comparisons (`===`) can fail on type mismatch.

---

## 3. Developer Experience & Maintainability

### Finding D1 (High): Config panel UI duplication -- 4 components, ~85% shared code
**Files**: `src/components/config/ConfigPanel.tsx`, `BuildingConfigPanel.tsx`, `TerrainConfigPanel.tsx`, `BackgroundConfigPanel.tsx`

Despite the workflow hooks being refactored into a factory pattern, config panels remain duplicated. Identical code blocks: sprite type toggle, preset fetch, presets-by-genre grouping, image size selector, generate button.

**Concrete bug**: The Aspect Ratio selector exists in `ConfigPanel.tsx:229-241` but is **missing** from `BuildingConfigPanel.tsx` and `TerrainConfigPanel.tsx`. The state and action (`SET_ASPECT_RATIO`) exist but are unreachable for those sprite types.

**Fix**: Extract shared sub-components (`SpriteTypeToggle`, `ImageSizeSelector`, `AspectRatioSelector`, `GenerateButton`) or create a single `UnifiedConfigPanel`.

### Finding D2 (High): TypeScript `any` escape hatches in critical data paths
**Files**: `src/hooks/useGenericWorkflow.ts:57`, `src/lib/promptForType.ts:36`, `src/App.tsx` (6+ locations), `src/components/gallery/GalleryPage.tsx` (4+ locations)

The shared workflow pipeline defines `dispatch: (action: any) => void`, bypassing the `Action` discriminated union entirely. No shared API response types exist. `tsconfig.json` disables `noUnusedLocals` and `noUnusedParameters`.

**Fix**: Create `src/types/api.ts` with response interfaces. Change dispatch type to `React.Dispatch<Action>`. Enable strict tsconfig flags.

### Finding D3 (Medium): Debug console logging in production hot paths
**Files**: `src/lib/spriteExtractor.ts` (11 calls), `src/components/grid/SpriteReview.tsx:236`

Unconditional `console.log` calls emit 60+ lines during a 6-grid run. No debug flag mechanism exists. Real errors are invisible in the noise.

**Fix**: Create a `debugLog` utility gated on `import.meta.env.DEV`.

### Finding D4 (Medium): Session restore as 120-line untestable inline effect
**File**: `src/App.tsx:31-157`

120-line async IIFE inside `useEffect`. Contains two separate if/else chains for sprite-type branching. Silently swallows all errors with `console.warn`. Partial restores leave the UI in undefined state.

**Fix**: Extract into `src/hooks/useSessionRestore.ts`.

### Finding D5 (Medium): Presets re-fetched on every sprite-type switch
**Files**: All 4 config panels + `RunBuilderPage.tsx:39`

Each config panel fetches presets on mount. Since `App.tsx` switches between 4 different component trees (unmount/remount on type change), every sprite type switch incurs a network round-trip despite presets already being stored in AppContext.

**Fix**: Check `presets.length > 0` before fetching, or centralize preset loading in `AppProvider`.

### Finding D6 (Low): Placeholder model name in production default
**Files**: `src/context/AppContext.tsx:261`, `src/api/geminiClient.ts:37`

Default model is `'nano-banana-pro-preview'` -- a nonsensical placeholder. The real model (`gemini-2.5-flash-image`) only appears in `server/db.js:42`.

**Fix**: Define a shared constant and validate model names.

---

## 4. Resilience & Error Recovery

### Finding R1 (Critical): reExtract has no error handling -- silent failures
**Files**: `src/hooks/useGenericWorkflow.ts:241-261`, `src/lib/spriteExtractor.ts:396-399`, `src/components/grid/SpriteReview.tsx:794`

`extractSprites()` can throw (e.g., cut detection finds wrong cell count). The `reExtract()` function has no try/catch. The user clicks "Re-extract Sprites," nothing happens, no error message appears. The primary generation path IS protected by the outer `generate()` catch, but `reExtract` is a separate unguarded path.

**Fix**: Wrap `reExtract` in try/catch, dispatch `SET_STATUS` with actionable error message on failure.

### Finding R2 (High): Race condition in multi-grid run navigation
**Files**: `src/hooks/useRunWorkflow.ts:92-98`, `src/context/AppContext.tsx:493-516`

`proceedToNextGrid` and `skipCurrentGrid` dispatch `NEXT_GRID` unconditionally, ignoring whether generation is still in flight (`isGeneratingRef.current`). This can cause reference sheets from the wrong grid index. Both functions are identical despite semantically different purposes.

**Fix**: Guard navigation behind `!isGeneratingRef.current`. Differentiate skip from proceed in the reducer.

### Finding R3 (High): Two-step history save with no HTTP status check
**Files**: `src/hooks/useGenericWorkflow.ts:129-163`, `src/hooks/useAddSheet.ts:181-208`

Same as A1. When `histResp` is not ok, `histData.id` is undefined. `SET_HISTORY_ID` dispatches with `undefined`, which becomes `NaN`. The `lastHistoryId` sync effect then persists `NaN` to the server, corrupting future session restores.

### Finding R4 (Medium): fetchContentPreset breaks if preset deleted mid-run
**File**: `src/lib/promptForType.ts:24-31`

If an admin deletes a content preset between grid iterations, `fetchContentPreset` throws, the run aborts, and all run context is lost with no resume capability.

### Finding R5 (Medium): Gallery load extraction has no error recovery path
**File**: `src/components/gallery/GalleryPage.tsx:298-299`

If `extractSprites` throws during gallery load, state is partially loaded (`GENERATE_COMPLETE` already dispatched). User lands on Review screen with populated grid image but zero sprites and no guidance.

### Finding R6 (Medium): Server port conflict resolution uses arbitrary timeout
**File**: `server/index.js:644-674`

Port conflict recovery uses `execSync('taskkill /F')` + 1-second `setTimeout`. If the port isn't released in time, the server throws without retry.

### Finding R7 (Low): historyId sync is fire-and-forget
**File**: `src/context/AppContext.tsx:549-565`

PUT to `/api/state/lastHistoryId` catches errors with only `console.error`. Server state can silently diverge.

### Finding R8 (Low): Error status banners auto-fade after 5 seconds
**File**: `src/components/shared/StatusBanner.tsx:34-43`

Error messages auto-fade identically to success messages. Users focused elsewhere miss error notifications entirely.

**Fix**: Error-type messages should require explicit dismissal or use a 30+ second timeout.

### Finding R9 (Low): Canvas getContext('2d')! non-null assertions
**File**: `src/components/grid/SpriteReview.tsx:55,97,229`

Non-null assertions on `getContext('2d')` suppress TypeScript errors. Under memory pressure (48 simultaneous canvas operations during chroma + posterize), context creation can return `null`.

---

## Cross-Cutting Themes

### Theme 1: The Monolithic Context Is a Force Multiplier for Every Other Bug

The single `AppContext` with 19 fields, no `useMemo`, and no `React.memo` anywhere in the codebase means that every bug, every failed dispatch, and every stale value propagates to the entire component tree instantly. Findings P1, A4, R3, and R7 all identify different consequences of this same root cause:

- **P1**: Every `SET_STATUS` toast re-renders 20+ components including heavy canvas grids
- **A4**: Inactive sprite-type configs are diffed on every render despite being unused
- **R3**: A corrupted `historyId: NaN` from a failed save propagates to all consumers simultaneously
- **R7**: Fire-and-forget sync means diverged server state is invisible across the app

Splitting context into read/write and adding selectors would reduce the blast radius of all these issues.

### Theme 2: Duplication Creates Feature Drift and Bug Multiplication

The config panel duplication (D1) is not merely a DX annoyance -- it has already caused a concrete bug (missing Aspect Ratio in 3 panels) and amplifies every other finding:

- **D1 + A3**: Restoration logic is duplicated between App.tsx and GalleryPage.tsx with diverging error handling
- **D1 + R1**: `reExtract` is an unguarded secondary path because it was separated from the guarded primary path during the workflow refactor
- **D1 + D5**: Preset fetching logic is duplicated 4x with no cache check
- **R3 + A1**: The history save bug exists in both `useGenericWorkflow.ts` and `useAddSheet.ts` independently

The workflow hooks were successfully refactored into a factory pattern. The same treatment needs to be applied to config panels and restoration logic.

### Theme 3: Secondary Code Paths Lack Error Propagation

The primary generation pipeline (`runGeneratePipeline`) has reasonable error handling. But every secondary path silently fails:

- **R1**: `reExtract` -- no try/catch at all
- **R3/A1**: History save -- no `response.ok` check
- **R5**: Gallery load extraction -- partial state on failure
- **D4**: Session restore -- `console.warn` only
- **R7**: historyId sync -- `console.error` only
- **D3**: Debug logging noise makes real errors invisible

The pattern is consistent: primary paths dispatch `GENERATE_ERROR`; secondary paths either swallow errors entirely or log to console where they're invisible under debug noise.

### Theme 4: Canvas Processing Is Both a Performance Bottleneck and a Resilience Risk

Findings P2, P3, R1, and R9 form a chain: the extraction pipeline creates dozens of canvases (P2), the animation loop creates images every frame (P3), failures in extraction are unhandled (R1), and canvas context creation uses non-null assertions (R9). Under memory pressure from the 48+ simultaneous canvas operations, `getContext('2d')` can return null, causing a runtime crash with no error recovery.

Moving canvas processing to a Web Worker (P2 fix) also provides a natural error boundary for R1 and R9.

### Theme 5: Network Latency Amplifies Race Conditions

The multi-grid run race condition (R2) is worsened by large base64 payloads (P7) and redundant full-list preset fetches (A2/D5). Reducing payload sizes and adding single-record endpoints would narrow the race window even without fixing the race condition directly.

---

## Prioritized Recommendations

### P1 -- High Impact, Low-Medium Effort

| # | Recommendation | Addresses | Effort |
|---|----------------|-----------|--------|
| 1 | **Add try/catch to `reExtract` with user-facing error dispatch** | R1 | ~15 min |
| 2 | **Check `histResp.ok` before using history ID** (both useGenericWorkflow.ts and useAddSheet.ts) | R3, A1 | ~30 min |
| 3 | **Guard `proceedToNextGrid`/`skipCurrentGrid` behind `!isGeneratingRef.current`** | R2 | ~30 min |
| 4 | **Wrap AppContext value in `useMemo`; split into State + Dispatch contexts** | P1, A4 | ~2 hr |
| 5 | **Add `React.memo` to SpriteGrid and other leaf components** | P4 | ~1 hr |
| 6 | **Make error status banners persist (no auto-fade for errors)** | R8 | ~15 min |

### P2 -- High Impact, Medium-High Effort

| # | Recommendation | Addresses | Effort |
|---|----------------|-----------|--------|
| 7 | **Unify config panels into a single component with spriteType prop** (fixes missing Aspect Ratio bug) | D1 | ~4 hr |
| 8 | **Extract shared `loadGenerationIntoState()` function** for App.tsx and GalleryPage.tsx | A3, D4 | ~3 hr |
| 9 | **Create `src/types/api.ts`** with response interfaces; type `dispatch` as `React.Dispatch<Action>` | D2 | ~3 hr |
| 10 | **Add `GET /api/presets/:type/:id` endpoint** and update `fetchContentPreset` | A2, R4, D5 | ~2 hr |
| 11 | **Add preset cache check** before fetching (or centralize in AppProvider) | D5 | ~1 hr |
| 12 | **Gate debug logging behind `import.meta.env.DEV`** | D3, P2 (console noise) | ~1 hr |

### P3 -- Medium Impact, Higher Effort or Lower Urgency

| # | Recommendation | Addresses | Effort |
|---|----------------|-----------|--------|
| 13 | **Move sprite processing to Web Worker with OffscreenCanvas** | P2, R9 | ~8 hr |
| 14 | **Debounce slider-triggered sprite reprocessing** (100ms) | P2 | ~1 hr |
| 15 | **Pre-render checkerboard; use `createImageBitmap` in animation loop** | P3 | ~2 hr |
| 16 | **Add AbortController to GalleryPage fetch** | P5 | ~1 hr |
| 17 | **Add `React.lazy` code splitting for GalleryPage and AdminPage** | P6 | ~1 hr |
| 18 | **Merge history + sprites into single atomic POST endpoint** | A1, R3 | ~4 hr |
| 19 | **Cache data URLs via useMemo; consider blob URLs for large images** | P7 | ~2 hr |
| 20 | **Enable `noUnusedLocals` and `noUnusedParameters` in tsconfig** | D2 | ~2 hr |
| 21 | **Replace placeholder model name with validated constant** | D6 | ~30 min |
| 22 | **Normalize preset ID types (TEXT vs INTEGER)** | A6 | ~3 hr |

---

## Positive Observations

1. **`useGenericWorkflow.ts`** is an excellent factory abstraction -- the workflow hook refactor was well-executed and serves as a model for the config panel unification recommended above.
2. **`gridConfig.ts`** is well-structured with clear separation of static definitions, runtime config builders, and preset converters.
3. **Server's `PRESET_TABLES` pattern** (`server/index.js:132-167`) is a good data-driven approach that eliminated 4x repeated CRUD handler code.
4. **Unit tests** cover pure library functions (`lib/__tests__/`) with a clean `ImageData` polyfill setup.
5. **JSDoc comments** are present on all key functions in `lib/` and `hooks/`, making intent clear without verbosity.
6. The **rate limiting** on `/api/generate-grid` and the **abort signal** infrastructure in the primary generation pipeline show that resilience was considered for the main happy path.
