# Review Round 8 -- Cross-Pollinated Report

**Date**: 2026-03-08
**Reviewers**: data-reviewer, lifecycle-reviewer, api-reviewer, ergonomics-reviewer

---

## 1. Executive Summary

Four independent reviewers examined the Grid Sprite Designer codebase from complementary perspectives: data integrity and persistence, component lifecycle and rendering, API surface and contract consistency, and developer ergonomics and maintainability. Despite working independently, their findings converge on three systemic themes. First, the application's multi-sprite-type architecture relies on parallel registries, inconsistent field naming, and type-unsafe casts that multiply the cost and risk of every change. Second, data integrity is undermined by missing validation on both the client (no request body checks) and server (no JSON schema enforcement, inconsistent idempotency), with multi-step operations lacking transactional guarantees. Third, lifecycle correctness issues -- including a broken cancel mechanism, potential settings clobbering on load, and a monolithic context causing excessive re-renders -- create user-visible reliability gaps.

The codebase has clear architectural strengths: the `useGenericWorkflow` + `WorkflowConfig` abstraction, the `UnifiedConfigPanel` config-driven approach, the server route modularization, and the split context pattern all demonstrate sound engineering judgment. However, these good abstractions are incomplete -- they stop short of eliminating the underlying duplication and type-safety gaps they were designed to address. The highest-impact improvements involve completing the unification work already begun: a single sprite-type registry, uniform field names, and transactional multi-step operations.

Across all four reviewers, 16 findings were rated High severity, 23 Medium, and 19 Low. The cross-pollination analysis below reveals that many individually-moderate findings compound into high-severity systemic risks when viewed together.

---

## 2. High-Severity Findings

### H1. Monolithic Context Forces Full Re-render Cascade
- **Reviewer**: lifecycle-reviewer
- **File**: `src/context/AppContext.tsx:577-583`
- **Issue**: `AppStateContext.Provider value={state}` passes the entire `AppState` object as a single value. Every state change (status messages, preset loads, field updates, timer-driven status clears) causes ALL `useAppState()` consumers to re-render, including heavy components like `SpriteReview`, `AnimationPreview`, and `SpriteGrid`. The dispatch context is correctly split, but the state context is not.
- **Impact**: Unnecessary re-render cascade across the entire component tree on every state mutation.
- **Cross-references**: Ergonomics H1 (as-any casts in consumers that process this state), Ergonomics M7 (callers using `useAppContext` instead of split hooks amplify the problem), Lifecycle L1/L2 (React.memo on child components is defeated by new object references from this context).

### H2. Cancel Button Does Not Abort the In-Flight Network Request
- **Reviewer**: lifecycle-reviewer
- **File**: `src/components/shared/GeneratingOverlay.tsx:13-14`
- **Issue**: `GeneratingOverlay` instantiates its own `useGenericWorkflow` to get `cancelGeneration`, but this creates a separate `abortRef` from the one used by the actual generation in `App.tsx`'s `useRunWorkflow`. Clicking "Cancel" dispatches `RESET` but does not abort the fetch. The generation completes server-side, wastes API credits, and the response arrives after the user has moved on.
- **Impact**: Cancel is cosmetic only. Server-side work and API costs are not prevented.
- **Cross-references**: API M3 (the server has no way to know the client cancelled), Data H2 (orphan generation records may be created from the completed-but-cancelled request).

### H3. Save-Settings Effect May Clobber DB with Defaults on Load
- **Reviewer**: lifecycle-reviewer
- **File**: `src/components/grid/SpriteReview.tsx:295-315`
- **Issue**: The `settingsLoaded` guard prevents save before load completes, but when `settingsLoaded` transitions to `true`, the save effect fires immediately. Whether it sees the restored values or the reset defaults depends on React batching timing. If intermediate reset calls (lines 254-258) trigger a render before the `.then()` resolves, the save effect fires with default values, overwriting the DB.
- **Impact**: Potential data loss -- saved editor settings could be overwritten with defaults on reload.
- **Cross-references**: Data M2 (editor_settings stores arbitrary JSON with no shape validation, so corrupt writes go undetected), API M9 (no server-side validation on settings values), Lifecycle H2 (the effect dependency array omits several called functions).

### H4. SpriteReview Load Effect Has Missing Dependencies -- Latent Infinite Loop Risk
- **Reviewer**: lifecycle-reviewer
- **File**: `src/components/grid/SpriteReview.tsx:245-292`
- **Issue**: The effect depends on `[state.historyId, loadSettings]` but calls `selection.resetSelection()`, `chroma.resetChromaKey()`, `post.resetPosterize()`, etc. without listing them in the dependency array. These callbacks are currently stable (empty-dep `useCallback`), but if any gained dependencies, the effect would silently break or loop.
- **Impact**: Latent correctness risk that violates exhaustive-deps rules.
- **Cross-references**: Ergonomics H1 (the hook API design makes it easy to miss deps), Lifecycle M1 (similar eslint suppression pattern in GridLinkSelector).

### H5. Multi-Table History Creation Lacks Transactional Guarantee
- **Reviewer**: data-reviewer
- **File**: `src/hooks/useGenericWorkflow.ts:131-174`
- **Issue**: History creation uses two separate HTTP calls: `POST /api/history` (creates the generation row) then `POST /api/history/:id/sprites` (creates sprite rows). If the second call fails, a generation row exists without sprites -- a partial record. `SET_HISTORY_ID` is dispatched before sprites are saved.
- **Impact**: Orphan generation records with `sprite_count: 0` and no thumbnail appear in the gallery.
- **Cross-references**: API H3/H4 (neither endpoint validates its request body, so partial data can also corrupt), Lifecycle H2 (cancel during this two-step process creates orphans), H2 above (cancelled generations complete server-side creating orphans).

### H6. POST /api/test-connection Returns 200 on Upstream Failure
- **Reviewer**: api-reviewer
- **File**: `server/routes/generate.js:148-154`
- **Issue**: When the Gemini API returns an error, the test-connection endpoint catches it and responds with HTTP 200 and `{ success: false }`. The client checks `response.ok` (which passes for 200), so it must also check the `success` field -- a two-level error checking anti-pattern.
- **Impact**: Clients that rely on HTTP status codes for error handling (standard practice) will miss failures.
- **Cross-references**: Ergonomics M5 (no JSDoc on route handlers means this non-standard behavior is undocumented), API M7 (inconsistent error format across routes).

### H7. POST /api/history Lacks Request Body Validation
- **Reviewer**: api-reviewer
- **File**: `server/routes/history.js:62-77`
- **Issue**: The endpoint destructures `contentName`, `contentDescription`, `model`, `prompt`, etc. from `req.body` with no validation. An empty body silently inserts NULL values for every column.
- **Impact**: Corrupt generation records that crash when loaded from gallery.
- **Cross-references**: Data H2 (partial records from split creation), Data M1 (JSON columns also lack validation), Ergonomics M5 (no request shape documentation).

### H8. POST /api/history/:id/sprites Has No Validation on Sprites Array
- **Reviewer**: api-reviewer
- **File**: `server/routes/history.js:79-100`
- **Issue**: The endpoint iterates `req.body.sprites` with no checks that it exists, is an array, or that elements have required fields. Sending `{ sprites: null }` throws an unhandled error.
- **Impact**: Unhandled exceptions from malformed requests.
- **Cross-references**: Data L6 (no unique constraint on generation_id + cell_index means retries create duplicates), Data H2 (this is the second step of the non-transactional creation).

### H9. History Deletion Does Not Explicitly Remove editor_settings
- **Reviewer**: data-reviewer
- **File**: `server/routes/history.js:145-154`
- **Issue**: `DELETE /:id` explicitly deletes sprites (line 150) but relies on CASCADE for `editor_settings`. This is inconsistent -- if the developer didn't trust CASCADE for sprites, editor_settings should also be explicit. CASCADE depends on `PRAGMA foreign_keys = ON` being active.
- **Impact**: Potential orphan `editor_settings` rows accumulating in the database.
- **Cross-references**: API M6 (DELETE endpoints have inconsistent behavior regarding 404 and cleanup), Lifecycle H3 (editor settings are already fragile during load/save cycles).

### H10. Migration System Has No Version Tracking
- **Reviewer**: data-reviewer
- **File**: `server/db/migrations.js:1-25`
- **Issue**: Migrations run every startup as a flat array with individual try/catch blocks. There is no migration version table, no tracking, and no rollback. The system relies on error message string matching (`'duplicate column'`, `'already exists'`, `'no such column'`) to skip already-applied migrations. The `RENAME COLUMN` migrations (lines 13-14) are not idempotent -- error conflation between "already renamed" and "genuinely missing column" is masked.
- **Impact**: Partially-migrated databases, fragile string-based idempotency.
- **Cross-references**: Ergonomics H2 (a new developer adding migrations must understand the implicit idempotency contract), Data M3 (seed idempotency is also inconsistent).

### H11. Pervasive `as any` Casting in UnifiedConfigPanel
- **Reviewer**: ergonomics-reviewer
- **File**: `src/components/config/UnifiedConfigPanel.tsx:224-233,257-274`
- **Issue**: `handlePresetChange` uses `(content as any)` in 7 places and `promptPreview` uses it in 4 more places to access grid-related fields. This is the main config UI component and its type holes defeat the unification effort.
- **Impact**: Typos in field names are not caught at compile time. Runtime errors from mistyped fields won't surface until user interaction.
- **Cross-references**: Ergonomics H3 (inconsistent field naming makes casts feel necessary), H1 above (context consumers process this state and propagate type-unsafe values).

### H12. Three+ Parallel Config Registries With No Compile-Time Sync
- **Reviewer**: ergonomics-reviewer
- **Files**: `src/hooks/useGenericWorkflow.ts:325-330` (WORKFLOW_CONFIGS), `src/components/config/UnifiedConfigPanel.tsx:67-159` (SPRITE_TYPE_CONFIGS), `src/components/admin/GenericPresetsTab.tsx:33-81` (PRESET_TAB_CONFIGS), `server/presetTables.js:3-38` (PRESET_TABLES)
- **Issue**: Adding a new sprite type requires updating 4 separate config maps in 4 files with different shapes. No compile-time guarantee they stay in sync.
- **Impact**: Missing any registry causes subtle runtime failures. New developers must discover all 4 by grepping.
- **Cross-references**: Ergonomics H3 (field naming diverges across registries), Data M4 (schema.js is a 5th implicit registry), API M1 (query param naming also diverges per type).

### H13. Inconsistent Field Naming Across Sprite Type Boundaries
- **Reviewer**: ergonomics-reviewer
- **Files**: `src/context/AppContext.tsx:119-158`, `src/types/api.ts:51-74`, `server/presetTables.js`
- **Issue**: The same concept has different names per sprite type: `rowGuidance` / `cellGuidance` / `tileGuidance` / `layerGuidance`. Similarly `cellLabels` / `tileLabels` / `layerLabels`. The `ContentPreset` type uses a massive optional-field superset that compiles even when passing wrong-type fields.
- **Impact**: High cognitive load. Frequent cross-referencing needed.
- **Cross-references**: H11 (this naming divergence is why `as any` casts feel necessary), H12 (each registry uses its own naming variant), Ergonomics M3 (prompt builders also duplicate per-type text).

### H14. Preset Type Validation Uses String Interpolation Into SQL
- **Reviewer**: data-reviewer
- **File**: `server/routes/presets.js:14,29,44,57,60,76-77,90-96`
- **Issue**: Table and column names from `PRESET_TABLES` config are interpolated into SQL: `` `SELECT * FROM ${config.table}` ``. While values are currently hardcoded constants, the pattern is dangerous. The `type` parameter comes from `req.query.type` or `req.params.type` -- the sole guard is `if (!config)` at line 12. If `PRESET_TABLES` lookup ever returned a user-controlled value, this would be SQL injection.
- **Impact**: Currently low risk (values are static), but the pattern is a maintenance hazard.
- **Cross-references**: API M1 (type parameter naming is inconsistent across routes, increasing the chance of a validation miss), H12 (the PRESET_TABLES registry is one of 4+ that must stay in sync).

### H15. POST /api/history Returns BigInt -- Type Mismatch With Client
- **Reviewer**: api-reviewer
- **File**: `server/routes/history.js:75`, client: `src/hooks/useGenericWorkflow.ts:154-155`
- **Issue**: SQLite's `lastInsertRowid` is a BigInt. The server returns it without converting to Number. The client does `Number(histData.id)` which could lose precision for large IDs. Compare with `server/routes/presets.js:46` which correctly converts. Inconsistent handling across endpoints.
- **Impact**: Potential ID precision loss for large databases; inconsistent pattern across endpoints.
- **Cross-references**: Data M4 (mixed ID strategies: TEXT PKs vs INTEGER PKs), H5 (this ID is used in the second step of non-transactional creation).

### H16. Duplicated "Get Content Name" Pattern in 4+ Locations
- **Reviewer**: ergonomics-reviewer
- **Files**: `src/components/grid/SpriteReview.tsx:356-360,376-380`, `src/hooks/useAddSheet.ts:96-106`, `src/lib/loadGeneration.ts:42-113`
- **Issue**: The pattern `state.spriteType === 'building' ? state.building.name : ...` is repeated verbatim in 4+ places. Each new sprite type requires updating all locations. `WORKFLOW_CONFIGS[type].getContent(state).name` exists but callers don't use it.
- **Impact**: High duplication, easy to miss one location during changes.
- **Cross-references**: H12 (another manifestation of the missing unified registry), Ergonomics M6 (`loadGenerationIntoState` has a 63-line version of this pattern).

---

## 3. Medium-Severity Findings

### M1. GridLinkSelector Calls `onSelectionChange` With Stale Closure
- **Reviewer**: lifecycle-reviewer
- **File**: `src/components/shared/GridLinkSelector.tsx:21-46`
- **Issue**: The effect calls `onSelectionChange` but excludes it from the dependency array with an eslint-disable comment. If the parent re-creates the callback, the effect uses a stale closure.
- **Cross-references**: H4 (same pattern of suppressed exhaustive-deps), Ergonomics M7 (inconsistent hook usage).

### M2. useAnimationLoop Frame Flash on Animation Switch
- **Reviewer**: lifecycle-reviewer
- **File**: `src/hooks/useAnimationLoop.ts:64-83`
- **Issue**: When `selectedAnim` changes, both the "reset frame" effect and the "animation loop" effect fire simultaneously, potentially causing a flash of the wrong frame before resetting to frame 0.
- **Impact**: Minor visual glitch during animation switching.

### M3. SpriteReview `struckKey` JSON.stringify Runs on Every Render
- **Reviewer**: lifecycle-reviewer
- **File**: `src/components/grid/SpriteReview.tsx:164,202-238`
- **Issue**: `struckKey = JSON.stringify(struckColors)` is computed on every render for deep comparison in a dependency array. For large arrays, this is unnecessary serialization work.
- **Cross-references**: H1 (monolithic context causes more renders than necessary, amplifying this cost).

### M4. StatusBanner Swallows Duplicate Consecutive Error Messages
- **Reviewer**: lifecycle-reviewer
- **File**: `src/components/shared/StatusBanner.tsx:20-60`
- **Issue**: If two identical status messages are dispatched in sequence, the second is ignored because the ref comparison matches. Users miss repeated error notifications.
- **Cross-references**: H6 (test-connection's non-standard error reporting compounds this -- errors may not even reach the status banner).

### M5. AppHeader setTimeout Not Cleaned Up on Unmount
- **Reviewer**: lifecycle-reviewer
- **File**: `src/components/layout/AppHeader.tsx:30-31`
- **Issue**: `setTimeout(() => setTestResult(null), 4000)` is called without storing the timer ID. If unmounted before 4s, React warns about state updates on unmounted components.

### M6. GalleryPage Search Debounce Timer Not Cleaned Up
- **Reviewer**: lifecycle-reviewer
- **File**: `src/components/gallery/GalleryPage.tsx:144-151`
- **Issue**: `searchTimer.current` timeout not cleared on unmount. Rapid typing + tab switch fires setState on unmounted component.
- **Cross-references**: Lifecycle L4 (debounce also resets page to 1, undoing user pagination).

### M7. useEditorSettings `beforeunload` Flush Uses Stale historyId
- **Reviewer**: lifecycle-reviewer
- **File**: `src/hooks/useEditorSettings.ts:79-94`
- **Issue**: The `beforeunload` handler captures `historyId` in its closure. If `historyId` changes but the debounce timer hasn't fired, page unload flushes old settings to the new historyId endpoint.
- **Impact**: Settings from one generation saved to a different generation's record.
- **Cross-references**: H3 (settings save is already fragile), Data M2 (no shape validation means cross-contamination goes undetected).

### M8. Inconsistent Query Parameter Naming Convention
- **Reviewers**: api-reviewer, ergonomics-reviewer
- **Files**: `server/routes/gridPresets.js:10` (`sprite_type`), `server/routes/gallery.js:12` (`spriteType`), `server/routes/presets.js:10` (`type`)
- **Issue**: Three endpoints filter by sprite type using three different parameter names. Client mirrors this inconsistency.
- **Cross-references**: H13 (field naming inconsistency extends from types through APIs to query params), H12 (each registry uses its own conventions).

### M9. Inconsistent Response Shapes for Mutation Endpoints
- **Reviewer**: api-reviewer
- **Files**: Multiple routes
- **Issue**: Mutation endpoints return different shapes: `{ id }`, `{ success: true }`, `{ count }`, `{ folder, spriteCount }`, `{ groupId, alreadySet }`. No consistent envelope.
- **Cross-references**: Ergonomics M5 (no JSDoc documents these shapes), API M7 (error formats also inconsistent).

### M10. Resource Creation Endpoints Return 200 Instead of 201
- **Reviewer**: api-reviewer
- **Files**: `server/routes/history.js:75`, `server/routes/presets.js:46`, `server/routes/gridPresets.js:48`, `server/routes/archive.js:46`
- **Issue**: All POST creation endpoints return HTTP 200 instead of 201 Created.

### M11. History List Returns Raw snake_case DB Column Names
- **Reviewer**: api-reviewer
- **File**: `server/routes/history.js:10-17`
- **Issue**: `GET /api/history/` returns raw DB column names (`content_name`, `created_at`) while the detail endpoint transforms to camelCase (`spriteType`, `contentPresetId`). Same entity, different shapes.
- **Cross-references**: M8 (naming inconsistency at every layer), Ergonomics H3 (field naming divergence).

### M12. Gallery TypeScript Type Missing Fields Returned by Server
- **Reviewer**: api-reviewer
- **File**: `src/types/api.ts:77-92` vs `server/routes/gallery.js:38-54`
- **Issue**: Server returns `contentDescription` and `model` in gallery entries but the TypeScript interfaces omit them. Fields are transmitted but invisible to TypeScript consumers.
- **Cross-references**: H11 (type safety gaps in the main config panel), Ergonomics L5 (Content preset `id` type is also mismatched).

### M13. DELETE /api/grid-links Returns Success Even When Link Doesn't Exist
- **Reviewer**: api-reviewer
- **File**: `server/routes/gridLinks.js:24-35`
- **Issue**: DELETE runs without checking `result.changes`. Deleting a nonexistent link returns `{ success: true }`. Compare with the presets DELETE which correctly returns 404.
- **Cross-references**: H9 (deletion behavior inconsistent across endpoints), M9 (response shape inconsistency).

### M14. Inconsistent Error Format Across Route Modules
- **Reviewer**: api-reviewer
- **Files**: Multiple routes
- **Issue**: Most endpoints return `{ error: "message" }`, but test-connection returns `{ success: false, error }` on 200, and PATCH history returns non-error `{ groupId, alreadySet: true }` for edge cases.
- **Cross-references**: H6 (test-connection is the worst offender), M9 (response shapes inconsistent for success too).

### M15. GET /api/history Hardcoded LIMIT 50, No Pagination
- **Reviewer**: api-reviewer
- **File**: `server/routes/history.js:12-13`
- **Issue**: History list returns at most 50 entries with no pagination. Gallery has proper pagination. Same data, different capabilities.
- **Cross-references**: API L1 (archive listing also unpaginated).

### M16. State Key Endpoint Accepts Arbitrary Keys, No Validation
- **Reviewer**: api-reviewer
- **File**: `server/routes/state.js:6-28`
- **Issue**: `PUT /api/state/:key` accepts any key name with no allowlist. `String(value)` converts objects to `[object Object]`. DELETE succeeds silently for nonexistent keys.
- **Cross-references**: Data L2 (app_state table has no constraints).

### M17. JSON Columns Have No Schema Validation
- **Reviewer**: data-reviewer
- **Files**: `server/db/schema.js:69,82,96,112-113`, `server/routes/gridPresets.js:25-26`
- **Issue**: Multiple columns store JSON strings. No validation on insert/update. `JSON.parse` on read has no try/catch in `gridPresets.js:25-26` -- corrupt JSON crashes the entire listing endpoint.
- **Cross-references**: H7/H8 (request body validation also missing), M16 (state endpoint also stores unvalidated values).

### M18. editor_settings Stores Arbitrary JSON With No Shape Validation
- **Reviewer**: data-reviewer
- **File**: `server/routes/history.js:135`, `src/hooks/useEditorSettings.ts:68`
- **Issue**: `PUT /:id/settings` stores `JSON.stringify(req.body)` directly. Extra/unexpected keys are silently preserved. Schema evolution leaves stale keys.
- **Cross-references**: H3 (save-settings effect may write defaults), M7 (stale historyId flush writes to wrong record).

### M19. Seed Idempotency Is Inconsistent Across Files
- **Reviewer**: data-reviewer
- **Files**: `server/db/seeds/gridPresets.js:2-3`, `server/db/seeds/characterPresets.js:2096+`
- **Issue**: Different seeds use different strategies: count-based skip-all vs. INSERT OR IGNORE. Grid preset seeds skip entirely if ANY preset exists. Seeds have implicit ordering dependencies.
- **Cross-references**: H10 (migration system also lacks proper tracking), Ergonomics L3 (no seed ID constants).

### M20. Mixed ID Strategies: TEXT PKs vs INTEGER PKs
- **Reviewer**: data-reviewer
- **File**: `server/db/schema.js:49,61,75,88` vs `server/db/schema.js:3,104`
- **Issue**: Preset tables use TEXT PKs (slugs) while generations/grid_presets use INTEGER AUTOINCREMENT. `generations.content_preset_id` stores TEXT with no FK constraint -- deleted presets leave dangling references.
- **Impact**: Stale `content_preset_id` in history responses; UI may try to select deleted presets.
- **Cross-references**: H15 (BigInt ID handling inconsistent), H12 (schema is another implicit registry).

### M21. content_preset_id Backfill Migration Matches by Name, Not Type
- **Reviewer**: data-reviewer
- **File**: `server/db/migrations.js:28-39`
- **Issue**: Backfill query matches presets by name across ALL 4 preset tables. If two types have same-named presets, the first match wins regardless of sprite type.
- **Cross-references**: H10 (migration system fragility), M20 (mixed ID strategies compound the issue).

### M22. Misleading Variable Name `charBlock` in Building Prompt Builder
- **Reviewer**: ergonomics-reviewer
- **File**: `src/lib/buildingPromptBuilder.ts:28`
- **Issue**: Copy-paste artifact: variable named `charBlock` constructs a building description.

### M23. `promptForType.ts` Duplicates Reference Prefix From `promptBuilder.ts`
- **Reviewer**: ergonomics-reviewer
- **Files**: `src/lib/promptForType.ts:14-22`, `src/lib/promptBuilder.ts:234-242`
- **Issue**: Same reference image prefix text exists in two places. Character path delegates to `buildGridFillPromptWithReference` while other types manually prepend `REFERENCE_PREFIX`.
- **Cross-references**: H16 (duplication pattern extends across the codebase).

---

## 4. Low-Severity Findings

### L1. SpriteGrid React.memo Defeated by Object Prop References
- **Reviewer**: lifecycle-reviewer
- **File**: `src/components/grid/SpriteGrid.tsx:29`
- **Issue**: `React.memo` wraps SpriteGrid but `mirroredCells` (a Set) and `sprites` (an array) are new references on every parent render, defeating memoization.
- **Cross-references**: H1 (monolithic context amplifies unnecessary re-renders).

### L2. SpriteZoomModal React.memo Defeated by `struckColors` Array
- **Reviewer**: lifecycle-reviewer
- **File**: `src/components/grid/SpriteZoomModal.tsx:23`
- **Issue**: Same pattern as L1. `struckColors` is a new array reference on changes.

### L3. AnimationPreview Duplicates Animation Logic From useAnimationLoop
- **Reviewer**: lifecycle-reviewer
- **File**: `src/components/preview/AnimationPreview.tsx:16-163`
- **Issue**: ~100 lines of duplicated animation loop, frame drawing, and keyboard handling.
- **Cross-references**: H16 (duplication pattern extends to animation logic).

### L4. GalleryPage Debounce Resets Page on Delayed Search
- **Reviewer**: lifecycle-reviewer
- **File**: `src/components/gallery/GalleryPage.tsx:144-151`
- **Issue**: Debounced search calls `setPage(1)`, which can undo manual pagination changes.

### L5. AddSheetModal Effect Resets User Selection on Reprocess
- **Reviewer**: lifecycle-reviewer
- **File**: `src/components/grid/AddSheetModal.tsx:63-69`
- **Issue**: Effect with `currentSprites` in deps re-runs on reprocess, resetting user's manual sprite selection.

### L6. `useMemo(() => dispatch, [])` Is Unnecessary
- **Reviewers**: lifecycle-reviewer, ergonomics-reviewer
- **File**: `src/context/AppContext.tsx:574-575`
- **Issue**: `useReducer` already guarantees `dispatch` stability. The `useMemo` wrapper adds zero value.

### L7. Multiple Hooks Return New Object References Every Render
- **Reviewer**: lifecycle-reviewer
- **Files**: `useChromaKeySettings.ts:52-60`, `usePosterizeSettings.ts:34-39`, `useSpriteSelection.ts:137-158`
- **Issue**: Hooks return new objects on every render. Currently safe because consumers destructure, but latent issue if passed as props.
- **Cross-references**: L1/L2 (memo-breaking pattern).

### L8. App.tsx Mount Effect Lacks AbortController for Fetch Calls
- **Reviewer**: lifecycle-reviewer
- **File**: `src/App.tsx:28-52`
- **Issue**: Session restore fetches without AbortController. Dispatches on unmounted component cause wasted work and potential UI flicker.

### L9. Archive GET Returns Unpaginated Flat Array
- **Reviewer**: api-reviewer
- **File**: `server/routes/archive.js:50-76`
- **Issue**: All archive directories returned at once, no pagination. Will grow unbounded.
- **Cross-references**: M15 (history also lacks pagination).

### L10. No Content-Type Validation on Image Data Fields
- **Reviewer**: api-reviewer
- **Files**: `server/routes/generate.js:56`, `server/routes/history.js:64`
- **Issue**: Endpoints accepting base64 image data perform no validation on data or MIME types.

### L11. URL Path Style Inconsistency
- **Reviewer**: api-reviewer
- **File**: `server/index.js:41-48`
- **Issue**: Routes mix singular/plural and hyphenation: `/api/history` (singular), `/api/presets` (plural), `/api/grid-presets` (plural hyphenated), `/api/generate-grid` (verb-noun).

### L12. Content Preset `id` Type: String in TypeScript, Number at Runtime
- **Reviewer**: api-reviewer
- **File**: `src/types/api.ts:52`
- **Issue**: `ContentPreset` defines `id?: string` but server returns numeric IDs. Works via JS coercion but semantically incorrect.
- **Cross-references**: M20 (mixed ID strategies), H11 (type safety gaps).

### L13. Grid Preset DELETE Proceeds Regardless of Link Count
- **Reviewer**: api-reviewer
- **File**: `server/routes/gridPresets.js:68-81`
- **Issue**: Counts referencing links but deletes unconditionally. Cascade delete without confirmation.
- **Cross-references**: H9 (deletion cleanup inconsistency), M20 (dangling references).

### L14. No updated_at Trigger for Generations Table
- **Reviewer**: data-reviewer
- **File**: `server/db/schema.js:17`
- **Issue**: `updated_at` is set on INSERT only. Some updates manually set it; others (like group_id assignment) do not.

### L15. app_state Table Has No Constraints on Key Values
- **Reviewer**: data-reviewer
- **File**: `server/db/schema.js:44-47`
- **Issue**: No allowlist for keys, no documentation of expected keys.
- **Cross-references**: M16 (endpoint also lacks validation).

### L16. Archive Has No DB Backing -- File-Only Persistence
- **Reviewer**: data-reviewer
- **File**: `server/routes/archive.js:8-47`
- **Issue**: Archives exist only on disk. No DB record links generations to their archives.

### L17. Sprites Table Has No Unique Constraint on (generation_id, cell_index)
- **Reviewer**: data-reviewer
- **File**: `server/db/schema.js:20-30`
- **Issue**: Duplicate sprites for the same cell can be inserted on network retries.
- **Cross-references**: H8 (no sprites array validation), H5 (non-transactional creation).

### L18. Vestigial `styleNotes` Field Ignored in Preset Loading
- **Reviewer**: ergonomics-reviewer
- **File**: `src/context/AppContext.tsx:414,432,456,478`
- **Issue**: `styleNotes` is always hardcoded to `''` when loading presets. Field exists in state but never populated from preset data.

### L19. `debugLog` Utility Used in Only One File
- **Reviewer**: ergonomics-reviewer
- **Files**: `src/lib/debugLog.ts`, `src/components/grid/SpriteReview.tsx:228`
- **Issue**: Dedicated debug logging module used exactly once. All other logging uses `console.*` directly.

---

## 5. Cross-Pollination Matrix

| Theme | Data | Lifecycle | API | Ergonomics |
|-------|------|-----------|-----|------------|
| **Monolithic context / re-render cascade** | | H1 (context value), L1-L2 (memo defeated) | | M7 (useAppContext overuse), H1 (as-any in consumers) |
| **Non-transactional multi-step operations** | H2 (orphan records) | H2 (cancel doesn't abort), M2 (dual abort ref) | H3-H4 (no body validation) | |
| **Settings load/save race condition** | M2 (no shape validation) | H3 (clobber on load), M7 (stale historyId) | M9 (state endpoint unvalidated) | |
| **Missing request body validation** | M1 (JSON schema), H1 (orphan settings) | | H3, H4, M16 (no validation) | M5 (no JSDoc on routes) |
| **Parallel registries / no unified sprite type system** | M4 (mixed PKs), H4 (SQL interpolation) | | M1, M4 (naming inconsistency) | H2 (4 registries), H3 (field naming), H4 (duplication) |
| **Inconsistent API contracts** | | | H1 (200 on failure), M2, M7, M14 (shapes/formats) | M4, M5 (naming, no docs) |
| **Migration/seed fragility** | H3 (no version tracking), M3 (seed idempotency), M6 (name-based backfill) | | | L3 (no seed constants) |
| **Type safety gaps** | | | H2 (BigInt), L5 (id type) | H1 (as-any casts), M12 (missing TS fields) |
| **Deletion inconsistencies** | H1 (orphan settings), M5 (no gen reference check) | | M6 (no 404 on missing link) | |
| **Duplication patterns** | | L3 (animation logic) | M3 (prompt prefix) | H4 (content name), M1 (charBlock), M6 (loadGeneration switch) |

---

## 6. Root Cause Analysis

### RC1. Incomplete Unification of Sprite Type System
The codebase has begun unifying sprite types (via `useGenericWorkflow`, `UnifiedConfigPanel`, `PRESET_TABLES`) but stopped short. Four parallel registries, inconsistent field names (`rowGuidance`/`cellGuidance`/`tileGuidance`/`layerGuidance`), and `as any` casts are symptoms of an unfinished transition. This single root cause drives findings H11, H12, H13, H14, H16, M8, M20, M22, M23, and their downstream effects.

### RC2. Missing Server-Side Validation Layer
No middleware validates request bodies, query parameters, or response shapes. Each route handler does its own ad-hoc validation (or none). This drives H6, H7, H8, M9, M14, M16, M17, M18, and the two-level error checking anti-pattern.

### RC3. Non-Atomic Multi-Step Client-Server Operations
The client-server protocol uses multiple sequential HTTP calls for logically atomic operations (create generation + save sprites). Without server-side transactions or a combined endpoint, failures mid-sequence create partial records. This drives H2, H5, and compounds with H8 and L17.

### RC4. Fragile Schema Evolution Infrastructure
Migrations rely on error string matching for idempotency, seeds use inconsistent strategies, and there is no version tracking. This drives H10, M19, M21 and creates risk for every future schema change.

### RC5. React Performance Architecture Gaps
The monolithic context value, ineffective React.memo usage, and unstable object references create a re-render cascade that affects every component. This drives H1, L1, L2, L7, and amplifies M3.

---

## 7. Recommended Action Priority

### Immediate (high impact, moderate effort)

1. **Add request body validation to POST /api/history and POST /api/history/:id/sprites** (H7, H8). Add basic checks for required fields and types. Prevents corrupt data insertion immediately.

2. **Fix GeneratingOverlay cancel to use the actual workflow's abortRef** (H2). Either pass `cancelGeneration` down from App.tsx or use a shared ref via context. Prevents wasted API credits.

3. **Fix settings save-load race condition** (H3). Add a flag or effect guard that prevents the save effect from running during the same render cycle as the load completion.

4. **Return proper HTTP status codes from test-connection** (H6). Return 502 or 503 when upstream fails instead of 200 with `{ success: false }`.

5. **Add unique constraint on sprites(generation_id, cell_index)** (L17). Prevents duplicate sprites on retry.

### Short-Term (high impact, higher effort)

6. **Create a unified sprite type registry** (H12, H13). Define a single `SpriteTypeRegistration` interface and derive `WORKFLOW_CONFIGS`, `SPRITE_TYPE_CONFIGS`, `PRESET_TAB_CONFIGS`, and `PRESET_TABLES` from it. Normalize field names (`guidance` instead of `rowGuidance`/`cellGuidance`/etc.).

7. **Add typed discriminated union for per-type content** (H11). Replace `as any` casts with proper type narrowing based on `spriteType` discriminator.

8. **Combine history creation into a single atomic endpoint** (H5). Accept generation metadata + sprites in one POST, wrap in a SQLite transaction.

9. **Add request validation middleware** (H7, H8, M16, M17). Use a schema validation library (e.g., zod, joi) for all mutation endpoints.

10. **Add migration version tracking table** (H10). Record which migrations have run, stop relying on error string matching.

### Medium-Term (moderate impact, significant effort)

11. **Split AppState context into focused selectors** (H1). Either use selector-based subscriptions, split into multiple contexts, or adopt Zustand.

12. **Normalize API contracts** (M8, M9, M10, M11, M14). Standardize query param naming (pick camelCase or snake_case), response envelopes, HTTP status codes, and error formats.

13. **Add server-side TypeScript or JSDoc types** (Ergonomics M5, API M12). Document request/response shapes for every endpoint.

14. **Clean up timer/effect leaks** (M5, M6, L8). Add cleanup returns to effects with setTimeout/setInterval/fetch.

15. **Extract `processSprite` and animation logic to shared lib** (L3, Ergonomics L5). Consolidate duplicated image processing and animation utilities.

---

## 8. Positive Findings

All four reviewers independently noted several architectural strengths:

1. **`useGenericWorkflow` + `WorkflowConfig` pattern** (ergonomics-reviewer): Well-executed abstraction that eliminated massive hook duplication. The thin wrapper hooks are clean and easy to understand.

2. **`runGeneratePipeline` extraction** (ergonomics-reviewer): Shared generate pipeline between `useGenericWorkflow` and `useRunWorkflow` is architecturally sound.

3. **`UnifiedConfigPanel` config-driven approach** (ergonomics-reviewer): The right architectural pattern, despite the `as any` leaks. The unification effort is heading in the correct direction.

4. **Server route modularization** (ergonomics-reviewer): `server/routes/*.js` files are focused and well-organized.

5. **`PRESET_TABLES` data-driven approach** (ergonomics-reviewer): Server-side shared column definitions driving CRUD operations is elegant and reduces duplication.

6. **Split context pattern** (lifecycle-reviewer, ergonomics-reviewer): `useAppState`/`useAppDispatch` separation is the right performance pattern -- it just needs to be applied more consistently.

7. **`useModalFocus` hook** (ergonomics-reviewer): Shows good accessibility awareness.

8. **`DEVELOPERS.md`** (ergonomics-reviewer): Well-structured onboarding documentation.

9. **`restoredRef` guard for StrictMode** (lifecycle-reviewer): App.tsx's session restore correctly handles React 18 StrictMode double-mount.

10. **Consistent use of `useCallback` in custom hooks** (lifecycle-reviewer): Hook functions like `resetSelection`, `resetChromaKey` are properly memoized with stable references.

---

*Report compiled from independent findings by 4 reviewers. No prior review documents were consulted.*
