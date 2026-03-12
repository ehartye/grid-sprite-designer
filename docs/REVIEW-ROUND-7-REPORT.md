# Review Round 7 — Unified Cross-Pollinated Report

**Date**: 2026-03-08
**Reviewers**: state-reviewer, error-reviewer, types-reviewer, modules-reviewer
**Scope**: Full codebase — state management, error handling & observability, type safety & API contracts, module boundaries & cohesion

---

## 1. Executive Summary

Four independent reviewers examined the Grid Sprite Designer codebase from orthogonal perspectives. Their findings converge on three systemic themes: (1) **the monolithic AppContext is both a state management problem and a type safety problem** -- its 50+ field single-context design forces excessive re-renders while its co-located type definitions, 34-variant Action union, and 30-case reducer create a module boundary violation that ripples through the entire import graph; (2) **the absence of runtime validation at trust boundaries** -- the client blindly trusts all `response.json()` calls (types-reviewer found 8+ unvalidated API consumption sites) while the server accepts `req.body` with zero validation on its entirely untyped JavaScript codebase, and the error reviewer confirmed there is no global error boundary, no `unhandledrejection` listener, and no `window.onerror` handler to catch what falls through; (3) **prompt builder duplication remains the last major copy-paste pattern** -- the workflow hook duplication was successfully eliminated by `useGenericWorkflow`, but the four prompt builder files (~550 lines total, ~70% boilerplate) and the `loadGeneration.ts` 5-way sprite-type branching still await the same factory treatment.

A notable positive pattern emerged: the `useGenericWorkflow` factory, the state/dispatch context split, and the `PRESET_TABLES` data-driven config on the server demonstrate that the team knows how to eliminate duplication when they focus on it. The remaining issues are areas where that same discipline has not yet been applied. The server side (`db.js` at 4,327 lines and `index.js` at 661 lines) represents the largest concentration of technical debt, combining the modules reviewer's god-file concerns with the types reviewer's "zero type safety" finding and the error reviewer's crash-recovery gaps.

The most impactful single change would be adding a React `ErrorBoundary` (error-H1) -- it is trivial to implement, prevents white-screen crashes, and enables every other error handling improvement to degrade gracefully. The highest-effort, highest-reward change is splitting `AppContext` (state-H1, modules-F3, types-H2) -- it touches the most code but resolves findings from all four reviewers simultaneously.

---

## 2. High-Severity Findings

### H1. No React Error Boundary -- Entire App White-Screens on Render Errors
- **Source**: error-reviewer
- **File**: `src/App.tsx:169-175`
- **Detail**: Zero `ErrorBoundary`, `componentDidCatch`, or `getDerivedStateFromError` anywhere in the codebase. Any render-time exception (corrupted sprite data, null reference on `state.run.selectedGridLinks`, canvas errors) kills the entire app with no recovery and no diagnostics.
- **Cross-references**: state-H1 (monolithic context means one bad field crashes everything), modules-F3 (AppContext has no error boundary integration), error-H3 (no global error handler either)

### H2. Monolithic Context Causes Excessive Re-renders
- **Source**: state-reviewer
- **File**: `src/context/AppContext.tsx:547-598`
- **Detail**: ~50 fields in a single context. `useAppState()` returns the full state object, so every consumer re-renders on any state change. `StatusBanner` re-renders when sprites change; `SpriteReview` re-renders when presets load. During sprite processing, every slider adjustment triggers a full cascade because effects dispatch `SET_STATUS`.
- **Cross-references**: types-H2 (consumers escape to `as any` because generic access to sprite-type-specific fields has no typed path), modules-F3 (type definitions, reducer, and provider all co-located in one 607-line file), state-M1 (`useAppContext()` returns both state+dispatch, negating the split pattern), state-M6 (RunState is global but only used by 2 components)

### H3. `gridPresetToConfig` Implementation Signature Uses `any`
- **Source**: types-reviewer
- **File**: `src/lib/gridConfig.ts:293`
- **Detail**: Two typed overload signatures exist, but the implementation uses `preset: any`. Inside the function body, all field access (`preset.name`, `preset.cols`, etc.) is completely unchecked. If the API response shape changes, no compile error surfaces.
- **Cross-references**: error-M1 (API responses feeding this function are not status-checked), modules-F5 (this function couples to both GridPreset and GridLink shapes)

### H4. No Runtime Validation of API Responses Anywhere in Client
- **Source**: types-reviewer
- **Files**: `src/api/geminiClient.ts:34`, `src/lib/promptForType.ts:28`, `src/App.tsx:34,44`, `src/components/gallery/GalleryPage.tsx:125`, `src/hooks/useGenericWorkflow.ts:154`, `src/components/config/UnifiedConfigPanel.tsx:186`, `src/components/shared/GridLinkSelector.tsx:31`, `src/components/admin/GenericPresetsTab.tsx:99`
- **Detail**: All `response.json()` calls are trusted blindly with type annotations only. The sole exception is `useGenericWorkflow.ts:155-161` which validates `histData.id` via `Number.isFinite()`.
- **Cross-references**: error-M1 (many of these also skip `res.ok` checks -- server errors parsed as valid data), types-H4 (server is untyped JS so the "typed" contract is one-sided)

### H5. UnifiedConfigPanel Uses 15+ `as any` Casts to Bypass TypeScript
- **Source**: types-reviewer
- **File**: `src/components/config/UnifiedConfigPanel.tsx:225-272`
- **Detail**: Content state accessed as `Record<string, unknown>`, then cast to `as any` for sprite-type-specific fields (`gridSize`, `cellLabels`, `bgMode`). Also uses `as Action` casts on dispatch calls. The generic config-driven approach erases TypeScript's ability to narrow types.
- **Cross-references**: state-H2 (AppState stores `character`, `building`, etc. as separate named properties rather than a discriminated union), modules-F3 (the Action union type is 34 variants with no utility types)

### H6. Server-Side Code is Entirely Untyped JavaScript
- **Source**: types-reviewer
- **Files**: `server/index.js`, `server/routes/generate.js`, `server/db.js`, `server/utils.js`, `server/presetTables.js`
- **Detail**: Zero type annotations. `req.body` completely unvalidated. `req.query` unvalidated. Database rows are untyped. `JSON.parse` calls on DB data (`cell_labels`, `cell_groups`) are unguarded inside routes that have outer try/catch but give opaque 500 errors.
- **Cross-references**: error-H4 (no `unhandledRejection` handler), error-H5 (corrupt JSON in DB causes opaque 500s), modules-F1 (db.js is 4,327 lines), modules-F2 (index.js is 661 lines with ~30 inline routes)

### H7. Race Condition in Auto-Trigger Effect (App.tsx)
- **Source**: state-reviewer
- **File**: `src/App.tsx:64-74`
- **Detail**: `runTriggerRef` uses `${run.currentGridIndex}` as dedup key, but if React batched re-renders cause `run-active` to appear twice with the same index (e.g., after `COMPLETE_GRID` + `NEXT_GRID` dispatched together), a grid could be silently skipped in multi-grid runs.
- **Cross-references**: error-M7 (`GENERATE_ERROR` resets entire run to null -- no partial failure recovery)

### H8. Multiple Rapid Dispatches in `loadGenerationIntoState` Without Batching
- **Source**: state-reviewer
- **File**: `src/lib/loadGeneration.ts:41-196`
- **Detail**: 4-6 sequential dispatches across `await` boundaries. React 18 batches synchronous updates, but dispatches before/after the `await extractSprites` call are in separate batches, causing intermediate renders with incomplete state (e.g., sprite type set but grid config not yet).
- **Cross-references**: error-M3 (if any dispatch throws, subsequent ones are skipped, leaving partial state), types-M6 (`data.spriteType` cast to `SpriteType` without validation), modules-F9 (5-way branching pattern)

### H9. `handleExportIndividual` Has No try/catch
- **Source**: error-reviewer
- **File**: `src/components/grid/SpriteReview.tsx:371-387`
- **Detail**: `handleExportSheet` (line 349-368) is wrapped in try/catch, but `handleExportIndividual` calls `await getExportSprites()` with no error handling. Canvas operations and image loading can throw on corrupt data.
- **Cross-references**: types-M2 (the sibling catch uses `err: any`), modules-F7 (SpriteReview is 849 lines with mixed concerns)

### H10. No Global Error Handlers on Client or Server
- **Source**: error-reviewer
- **Files**: Client (no `unhandledrejection`, no `window.onerror`), Server (`server/index.js` -- no `process.on('unhandledRejection')`)
- **Detail**: Combined with H1, both rendering errors AND async errors can silently crash the app. Server has only `SIGTERM`/`SIGINT` handlers.
- **Cross-references**: error-H1 (no ErrorBoundary), error-L7 (no logging/telemetry infrastructure)

### H11. server/db.js is a 4,327-line God File
- **Source**: modules-reviewer
- **File**: `server/db.js` (4,327 lines, 498KB)
- **Detail**: Contains schema creation, migration logic, and all seed data for 7+ entity types hardcoded inline. The `src/data/` directory exists but is empty.
- **Cross-references**: types-H4 (entirely untyped), error-H5 (seed/init failures could take down DB initialization)

### H12. server/index.js is a 661-line Route Monolith
- **Source**: modules-reviewer
- **File**: `server/index.js:1-661`
- **Detail**: ~30 route handlers inline covering history, presets, grid presets, grid links, thumbnails, gallery, app state, editor settings, archive, and server lifecycle. Only `routes/generate.js` was extracted.
- **Cross-references**: types-H4 (all req.body access unvalidated), error-L2 (global error handler gives generic 500 for everything)

---

## 3. Medium-Severity Findings

### M1. Multiple fetch() Chains Missing `res.ok` Checks
- **Source**: error-reviewer
- **Files**: `src/components/shared/GridLinkSelector.tsx:31`, `src/components/grid/AddSheetModal.tsx:45`, `src/components/run/RunBuilderPage.tsx:36,54`, `src/components/config/UnifiedConfigPanel.tsx:186`, `src/components/grid/SpriteReview.tsx:262`
- **Detail**: Server error responses (400/404/500) are silently parsed as valid data, populating state with `{ error: "..." }` objects. Contrast with `geminiClient.ts:29` and `GalleryPage.tsx:167` which DO check `response.ok`.
- **Cross-references**: types-H4 (no runtime validation), modules-F7 (no shared fetch wrapper)

### M2. Admin Components Have Silent Failures on CRUD Operations
- **Source**: error-reviewer
- **Files**: `src/components/admin/LinkedGridPresets.tsx:21-67`, `src/components/admin/GridPresetsTab.tsx:52-57`
- **Detail**: `addLink()`, `removeLink()`, `updateGuidance()` have no catch blocks. `fetchLinks()` and `fetchPresets()` check `res.ok` but silently do nothing on failure.
- **Cross-references**: modules-F2 (no shared error handling for admin CRUD)

### M3. State/Dispatch Split Pattern Negated by `useAppContext()`
- **Source**: state-reviewer
- **File**: `src/context/AppContext.tsx:601-605`
- **Detail**: The codebase correctly splits into `AppStateContext` and `AppDispatchContext`, but `useAppContext()` returns both, and most consumers use it. Components that only need dispatch still subscribe to state changes.
- **Cross-references**: state-H2 (monolithic context), modules-F3 (all three hooks in same file)

### M4. Redundant `processedSprites` State in SpriteReview
- **Source**: state-reviewer
- **File**: `src/components/grid/SpriteReview.tsx:158`
- **Detail**: `processedSprites` stored in `useState` but entirely derived from `sprites` + settings. Updated via async effect, creating a render cycle where it's stale relative to latest settings.
- **Cross-references**: modules-F7 (SpriteReview is 849 lines, this state management adds complexity)

### M5. Prompt Builder Duplication (~70% Boilerplate)
- **Source**: modules-reviewer
- **Files**: `src/lib/promptBuilder.ts` (246 lines), `src/lib/buildingPromptBuilder.ts` (102 lines), `src/lib/terrainPromptBuilder.ts` (90 lines), `src/lib/backgroundPromptBuilder.ts` (112 lines)
- **Detail**: All four follow identical patterns: description block, cell description loop, guidance composition, template assembly. ~70% shared boilerplate. The reference prefix in `promptForType.ts:14-22` duplicates `promptBuilder.ts:234-242`.
- **Cross-references**: modules-F11 (useGenericWorkflow successfully eliminated the same pattern for workflows -- same approach needed here)

### M6. `imageSize` Type Inconsistency: `string` vs `'2K' | '4K'`
- **Source**: types-reviewer
- **Files**: `src/context/AppContext.tsx:161` (`string`), `src/context/AppContext.tsx:109` (`'2K' | '4K'`), `src/hooks/useGenericWorkflow.ts:64` (cast), `src/components/config/UnifiedConfigPanel.tsx:472` (cast)
- **Detail**: `AppState.imageSize` is typed as `string` but only `'2K'` and `'4K'` are valid. Forces `as` casts in two locations.
- **Cross-references**: types-L4 (`aspectRatio` has same problem -- `string` instead of union)

### M7. `GENERATE_ERROR` Resets Entire Run State
- **Source**: error-reviewer
- **File**: `src/context/AppContext.tsx:376-384`
- **Detail**: On error, sets `step: 'configure'` and `run: null`. In multi-grid runs, one transient API error aborts the ENTIRE run with no retry or skip option.
- **Cross-references**: state-H7 (race condition in auto-trigger), state-M6 (RunState global but narrowly used)

### M8. Gallery State Entirely Local -- No Sync with Designer
- **Source**: state-reviewer
- **File**: `src/components/gallery/GalleryPage.tsx:53-63`
- **Detail**: Gallery maintains own `entries`, `page`, `search`, `spriteType` state. After generating sprites, the gallery shows stale data until manual navigation triggers refetch.
- **Cross-references**: error-M5 (gallery delete doesn't check response status)

### M9. Settings Load/Save Race in SpriteReview
- **Source**: state-reviewer
- **File**: `src/components/grid/SpriteReview.tsx:240-315`
- **Detail**: If `historyId` changes while a previous load is in-flight, the `cancelled` flag prevents applying stale data but reset operations have already run. Rapid switching could reset editor settings to defaults.
- **Cross-references**: modules-F7 (SpriteReview complexity makes this hard to reason about)

### M10. `loadGenerationIntoState` Casts `spriteType` Without Validation
- **Source**: types-reviewer
- **File**: `src/lib/loadGeneration.ts:38`
- **Detail**: `const spriteType = (data.spriteType || 'character') as SpriteType` -- if DB contains an unknown value, the cast silently accepts it. Grid size casts (lines 49, 67, 84) ARE validated first, but spriteType is not.
- **Cross-references**: types-M7 (`HistoryResponse.spriteType` typed as `string` not `SpriteType`), state-H8 (loadGeneration dispatches 4-6 actions sequentially)

### M11. Sprite Save Response Not Checked After History Save
- **Source**: error-reviewer
- **File**: `src/hooks/useGenericWorkflow.ts:169-174`
- **Detail**: After history save succeeds, the sprite save fetch (`/api/history/${histId}/sprites`) does NOT check `response.ok`. Payload-too-large failures create orphaned history records.
- **Cross-references**: types-H4 (no response validation), types-M1 (`historyExtras` typed as `Record<string, any>`)

### M12. Duplicate Type Definitions Between Client and API Layer
- **Source**: modules-reviewer
- **Files**: `src/context/AppContext.tsx`, `src/types/api.ts`, `src/lib/spriteExtractor.ts:33-38`, `src/components/gallery/GalleryPage.tsx:12-33`
- **Detail**: `GridOverride` defined in both `api.ts` and `spriteExtractor.ts`. `GalleryEntry`/`GalleryResponse` defined locally in `GalleryPage.tsx` despite existing in `api.ts`. Import direction violation: `api.ts` imports from `context/AppContext`.
- **Cross-references**: types-L2 (`BuildingGridSize` also defined in two places)

### M13. GenericPresetsTab Uses `Record<string, unknown>` Throughout
- **Source**: types-reviewer
- **File**: `src/components/admin/GenericPresetsTab.tsx:93-94,109,175`
- **Detail**: All preset data treated as untyped bags. Fields accessed via casting: `p.id as number`, `p.name as string`. Fields are statically known per preset type.
- **Cross-references**: error-M2 (admin CRUD has silent failures), modules-F12 (import direction: types layer imports from context layer)

### M14. Non-null Assertion on `contentPresetId`
- **Source**: types-reviewer
- **File**: `src/hooks/useRunWorkflow.ts:52`
- **Detail**: `run.contentPresetId!` asserts non-null but `RunState.contentPresetId` is typed `string | null`. If null, `fetchContentPreset` is called with `null` and throws a confusing error.
- **Cross-references**: error-M7 (GENERATE_ERROR resets run state, so this can cascade)

### M15. AppContext.tsx is a 607-line Mixed-Responsibility Module
- **Source**: modules-reviewer
- **File**: `src/context/AppContext.tsx:1-607`
- **Detail**: Contains 11 type/interface definitions, 34-member Action union, 30-case reducer, context provider with side effects, 3 custom hooks, and a helper function. Type definitions are imported by 18+ files but live inside a React context file.
- **Cross-references**: state-H2 (monolithic context), types-H5 (as any casts needed because of how types are structured), types-L2 (BuildingGridSize duplicated)

### M16. RunBuilderPage.tsx is Dead Code
- **Source**: modules-reviewer
- **File**: `src/components/run/RunBuilderPage.tsx` (256 lines)
- **Detail**: Never imported or rendered. Run Builder functionality migrated to `UnifiedConfigPanel.tsx` via `GridLinkSelector`. The `WorkflowStep` type still includes `'run-builder'` as a valid step.
- **Cross-references**: types-L1 (tsconfig allows unused code to accumulate)

### M17. Error Status Auto-Fades and Is Single-Slot
- **Source**: error-reviewer
- **File**: `src/components/shared/StatusBanner.tsx:35`
- **Detail**: Error banners auto-dismiss after 30 seconds. Only one status shown at a time -- rapid sequential errors (e.g., history save fail + archive save fail) overwrite each other.
- **Cross-references**: state-L4 (duplicate status messages silently swallowed)

---

## 4. Low-Severity Findings

### L1. `catch (err: any)` Remaining in SpriteReview
- **Sources**: error-reviewer, types-reviewer
- **File**: `src/components/grid/SpriteReview.tsx:365`
- Only remaining instance of the old `catch (err: any)` pattern. All others migrated to `catch (err: unknown)`.

### L2. `BuildingGridSize` Defined in Two Places
- **Source**: types-reviewer
- **Files**: `src/context/AppContext.tsx:14`, `src/lib/gridConfig.ts:95`
- Identical definitions with no compile-time sync enforcement.

### L3. Grid Config Dictionaries Lose Key Narrowing
- **Source**: types-reviewer
- **Files**: `src/lib/gridConfig.ts:56,121,165`
- Typed as `Record<string, GridConfig>` instead of `Record<BuildingGridSize, GridConfig>`. Any string key accepted at compile time.

### L4. `aspectRatio` Not Constrained as a Type
- **Source**: types-reviewer
- **Files**: `src/context/AppContext.tsx:162`, `src/lib/gridConfig.ts:25`
- Typed as `string` but UI offers a fixed set of values. Should be a union type.

### L5. `initialState` Uses `Array.fill('')` -- Shared Reference Pattern
- **Source**: state-reviewer
- **File**: `src/context/AppContext.tsx:239,248,258`
- Safe for primitives (strings) but error-prone if ever changed to objects.

### L6. Preset Caching is Simplistic -- Never Refreshes
- **Source**: state-reviewer
- **File**: `src/components/config/UnifiedConfigPanel.tsx:183-198`
- `if (presetList.length > 0) return;` -- presets never refresh after initial load. Admin edits not visible until page reload.

### L7. GridLinkSelector eslint-disable for exhaustive-deps
- **Source**: state-reviewer
- **File**: `src/components/shared/GridLinkSelector.tsx:46`
- `onSelectionChange` excluded from deps. Works because parent memoizes it, but hidden coupling.

### L8. StatusBanner Duplicate Messages Swallowed
- **Source**: state-reviewer
- **File**: `src/components/shared/StatusBanner.tsx:18-50`
- `prevStatusRef` prevents re-animation, but identical consecutive error messages are silently dropped.

### L9. RESET Preserves Presets But Not `activeContentPresetIds`
- **Source**: state-reviewer
- **File**: `src/context/AppContext.tsx:529-539`
- After reset, dropdown shows "Custom" even though preset content is loaded. Minor UI desync.

### L10. `tsconfig.json` Has `noUnusedLocals: false` and `noUnusedParameters: false`
- **Source**: types-reviewer
- **File**: `tsconfig.json:15-16`
- Allows dead code to accumulate undetected.

### L11. `PRESET_TABLES` Columns Use Untyped Tuple Arrays
- **Source**: types-reviewer
- **File**: `server/presetTables.js:3-38`
- Column mappings defined as `[bodyField, dbColumn, default?, json?]` tuples with no type info.

### L12. Server Global Error Handler Loses Error Details
- **Source**: error-reviewer
- **File**: `server/index.js:603-606`
- Always responds with generic `'Internal server error'`. Could include detail in dev mode.

### L13. `historyId` Sync Failures Only Console-Logged
- **Source**: error-reviewer
- **File**: `src/context/AppContext.tsx:566,569`
- Failed session state persistence only logged, not surfaced to user.

### L14. Editor Settings Load Failure Returns `null` Silently
- **Source**: error-reviewer
- **File**: `src/hooks/useEditorSettings.ts:73-75`
- Bare `catch {}` returns null. Settings silently reset to defaults on endpoint failure.

### L15. No Request Timeout on Most Client Fetch Calls
- **Source**: error-reviewer
- **Detail**: Workflow hooks use `AbortController`, but preset loading, gallery, admin CRUD, and settings have no timeout. Hung server leaves client waiting indefinitely.

### L16. No Logging/Telemetry Infrastructure
- **Source**: error-reviewer
- **Detail**: Client uses only `console.error`/`console.warn`. Server uses only `console.log`/`console.error`. No structured logging, no error reporting integration, no request ID correlation.

### L17. Circular Import in useGenericWorkflow
- **Source**: modules-reviewer
- **File**: `src/hooks/useGenericWorkflow.ts:320-330`
- Bidirectional imports with the 4 type-specific workflow files. Comment says "lazy-loaded" but imports are actually eager static `import` statements.

### L18. Empty `src/data/` Directory
- **Source**: modules-reviewer
- **Detail**: Directory exists but contains no files. Pose/animation data in `src/lib/poses.ts`, seed data in `server/db.js`, UI config in `UnifiedConfigPanel.tsx`.

### L19. `loadGeneration.ts` Has Deep Sprite-Type Branching
- **Source**: modules-reviewer
- **File**: `src/lib/loadGeneration.ts:33-197`
- 5-way if/else chain for sprite type at lines 48-113 and again at 153-176. Same pattern that `useGenericWorkflow` was created to eliminate.

### L20. `useMemo` on Dispatch is Unnecessary
- **Source**: state-reviewer
- **File**: `src/context/AppContext.tsx:575`
- `useReducer`'s dispatch is already stable. The `useMemo` is a no-op that adds confusion.

### L21. `handleErasePixel` Captures `displayOrder` from Closure
- **Source**: state-reviewer
- **File**: `src/hooks/useSpriteSelection.ts:88-99`
- If zoom modal is open and display order changes, erased pixels could be keyed against wrong source sprite. Edge case blocked by modal interaction.

### L22. Stale Closure / Identity Instability in `handleCellClick`
- **Source**: state-reviewer
- **File**: `src/hooks/useSpriteSelection.ts:58-73`
- Callback identity changes on every `swapSource` change, defeating memoization of `SpriteGrid` (potentially 36+ cells re-rendering per click).

---

## 5. Cross-Pollination Matrix

| Theme | State Reviewer | Error Reviewer | Types Reviewer | Modules Reviewer |
|---|---|---|---|---|
| **Monolithic AppContext** | H2 (re-renders), M3 (split negated), M6 (RunState global) | H1 (no ErrorBoundary integration) | H5 (as any casts forced) | M15 (607-line mixed responsibility), F3 (types+reducer+provider co-located) |
| **No Runtime Validation** | H8 (unvalidated loads cause partial state) | M1 (missing res.ok), H9 (unhandled export) | H4 (8+ unvalidated API sites), H3 (any in gridPresetToConfig) | M12 (duplicate type defs create confusion) |
| **Untyped Server** | -- | H4 (no unhandledRejection), H5 (JSON.parse unguarded) | H6 (zero type annotations, unvalidated req.body) | H11 (db.js 4,327-line god file), H12 (index.js 661-line monolith) |
| **Missing Error Boundaries / Global Handlers** | -- | H1 (no ErrorBoundary), H3 (no client global), H4 (no server global) | -- | -- |
| **Prompt Builder Duplication** | -- | -- | -- | M5 (~70% boilerplate across 4 files) |
| **Sprite-Type Branching** | H8 (loadGeneration dispatches) | -- | H5 (as any to access type-specific fields), M10 (spriteType cast) | L19 (5-way branching in loadGeneration) |
| **Silent Fetch Failures** | M8 (gallery stale data) | M1 (res.ok missing), M2 (admin silent), M5 (gallery delete) | -- | -- |
| **Run State Fragility** | H7 (race condition), M6 (RunState scope) | M7 (GENERATE_ERROR resets all) | M14 (contentPresetId! assertion) | -- |
| **Dead Code / Unused Paths** | L5 (Array.fill pattern) | -- | L10 (tsconfig allows unused) | M16 (RunBuilderPage dead code) |
| **Type Narrowing Gaps** | -- | L1 (catch err: any) | M6 (imageSize string), L3 (Record<string>), L4 (aspectRatio string) | L2 (BuildingGridSize duplicate) |
| **Observability Gap** | -- | L16 (no telemetry), L12 (generic 500s), L13 (sync failures logged only) | -- | -- |

---

## 6. Root Cause Analysis

### Root Cause 1: Absence of Abstraction Layers for Shared Concerns

The codebase has a proven pattern for eliminating duplication (`useGenericWorkflow`), but it has only been applied once. The same factory/config-driven approach is needed for:
- Prompt builders (4 files, ~70% boilerplate)
- `loadGeneration.ts` sprite-type branching (5-way if/else)
- Admin CRUD error handling (no shared pattern)
- Client fetch calls (no shared wrapper enforcing `res.ok` + response validation)

Each time duplication exists, bugs must be fixed N times and inconsistencies accumulate (e.g., `handleExportSheet` has try/catch but `handleExportIndividual` does not).

### Root Cause 2: No Trust Boundary Enforcement

The application has no validation layer between external data and internal state. The client trusts server responses, the server trusts client requests, and both trust database contents. This creates a fragile chain where one bad value propagates through the entire system unchecked. The types reviewer's finding that 8+ API consumption sites have no runtime validation and the error reviewer's finding that 5+ fetch chains skip `res.ok` are symptoms of the same root cause: no centralized API client or middleware validation.

### Root Cause 3: Organic Growth Without Periodic Decomposition

The server files (`db.js` at 4,327 lines, `index.js` at 661 lines) and `AppContext.tsx` (607 lines, 11 types, 34 actions, 30 reducer cases) grew organically. Features were added to existing files rather than extracted into focused modules. The `src/data/` directory was created as a future home for extracted data but was never populated. The `SpriteReview` component was partially decomposed into hooks but retains 849 lines including pure utility functions (`processSprite`, `detectPalette`) that belong in `lib/`.

### Root Cause 4: No Error Recovery Architecture

The app has no `ErrorBoundary`, no global error handlers, no error queue (StatusBanner shows one message at a time), and no partial failure recovery for multi-grid runs. This is not a collection of individual oversights but a missing architectural layer. Error handling was added per-feature (some features have it, some don't) rather than designed as a system-wide concern.

---

## 7. Recommended Action Priority

### Immediate (High Impact / Low Effort)

| Priority | Action | Findings Addressed | Effort |
|----------|--------|-------------------|--------|
| 1 | Add React `ErrorBoundary` wrapping `<AppContent>` | H1, H10 | ~30 min |
| 2 | Add `window.addEventListener('unhandledrejection')` + `process.on('unhandledRejection')` | H10 | ~15 min |
| 3 | Add try/catch to `handleExportIndividual` | H9 | ~5 min |
| 4 | Narrow `AppState.imageSize` from `string` to `'2K' \| '4K'` | M6 | ~10 min |
| 5 | Fix `gridPresetToConfig` implementation signature (replace `any` with union) | H3 | ~20 min |
| 6 | Delete `RunBuilderPage.tsx` and remove `'run-builder'` from `WorkflowStep` | M16 | ~10 min |
| 7 | Fix remaining `catch (err: any)` to `catch (err: unknown)` | L1 | ~5 min |

### Short-Term (High Impact / Medium Effort)

| Priority | Action | Findings Addressed | Effort |
|----------|--------|-------------------|--------|
| 8 | Create shared `apiFetch()` wrapper enforcing `res.ok` check + basic shape validation | M1, M2, M11, H4 | ~2 hrs |
| 9 | Add `res.ok` checks to all existing fetch chains | M1, M5 | ~1 hr |
| 10 | Add null check for `contentPresetId` in `useRunWorkflow` | M14 | ~15 min |
| 11 | Validate `spriteType` against known values before casting in `loadGeneration.ts` | M10 | ~15 min |
| 12 | Extract types from AppContext.tsx into `src/types/domain.ts` | M15, M12, L2 | ~2 hrs |
| 13 | Create generic `buildSpritePrompt()` factory for prompt builders | M5 | ~3 hrs |
| 14 | Add compound `LOAD_GENERATION` action to atomically set state | H8 | ~2 hrs |

### Medium-Term (High Impact / High Effort)

| Priority | Action | Findings Addressed | Effort |
|----------|--------|-------------------|--------|
| 15 | Split AppContext into 3 focused contexts (workflow, config, UI) | H2, M3, state-M6 | ~1 day |
| 16 | Extract server routes into modules (history, presets, gridPresets, gallery, archive, state) | H12 | ~1 day |
| 17 | Decompose `server/db.js` into schema, migrations, and seed modules | H11 | ~1 day |
| 18 | Add runtime validation schemas (Zod or manual) at API boundaries | H4, H6 | ~2 days |
| 19 | Migrate server to TypeScript or add JSDoc type annotations | H6, L11 | ~3 days |
| 20 | Add error queue to StatusBanner + partial failure recovery for runs | M7, M17, L8 | ~1 day |
| 21 | Decompose SpriteReview (extract processSprite/detectPalette to lib, extract sidebar sections) | H9, M4, M9, modules-F7 | ~1 day |
| 22 | Enable `noUnusedLocals` and `noUnusedParameters` in tsconfig | L10 | ~2 hrs (fix violations) |

---

## 8. Positive Findings

All four reviewers identified strong patterns that demonstrate architectural awareness:

1. **`useGenericWorkflow` factory pattern** (modules-reviewer): Successfully eliminated 4x workflow hook duplication. Each type-specific hook is now a thin ~34-line wrapper. This is the model for eliminating the remaining duplication (prompt builders, loadGeneration branching).

2. **State/Dispatch context split** (state-reviewer, modules-reviewer): `AppStateContext` + `AppDispatchContext` is the correct pattern for preventing unnecessary re-renders from dispatch-only consumers. The infrastructure is right; it just needs to be used consistently (deprecate `useAppContext()`).

3. **`PRESET_TABLES` data-driven config** (modules-reviewer): The server's preset CRUD uses a config-driven approach that eliminates type-branching. This is the same pattern that should be applied to prompt builders and loadGeneration.

4. **`useModalFocus` hook** (modules-reviewer): Centralized focus trap with restoration -- properly extracted rather than duplicated per modal.

5. **Abort controller pattern** (state-reviewer): Workflow hooks use `AbortController` for generation pipelines, enabling proper cancellation. This should be extended to other fetch calls.

6. **Debounced settings persistence** (state-reviewer): Editor settings are debounce-saved, preventing excessive API calls during rapid slider adjustments.

7. **Component directory organization** (modules-reviewer): `admin/`, `config/`, `gallery/`, `grid/`, `layout/`, `preview/`, `run/`, `shared/` maps well to features and is easy to navigate.

8. **`stateRef` pattern for async closures** (state-reviewer): Using a ref to access current state in async callbacks avoids stale closure bugs -- correctly applied in workflow hooks.

9. **Grid config validation in `loadGeneration`** (types-reviewer): Grid size casts at lines 49, 67, 84 are validated before casting -- the pattern exists, it just needs to be applied to `spriteType` as well.

10. **`Number.isFinite()` validation on history ID** (types-reviewer): The sole runtime validation in the client (`useGenericWorkflow.ts:155-161`) demonstrates awareness of the need -- it should be the norm, not the exception.

---

*Report compiled from independent findings by 4 reviewers. No prior review documents were consulted.*
