# Architecture Review: Synthesis Report

**Date:** 2026-04-08
**Codebase:** Grid Sprite Designer
**Perspectives:** Maintainer, Design Principles, Conventions & Idioms, Data Integrity

---

## Independent Findings (Round 1)

### Consensus Concerns (flagged by 2+ perspectives independently)

#### 1. Duplicated Save-to-History + Archive Pipeline [ALL FOUR PERSPECTIVES]

The "save history record, save sprites, archive to disk" sequence is fully implemented in both `runGeneratePipeline` (`useGenericWorkflow.ts:158-248`) and `useRegenerateWithFeedback` (`lines 139-208`). The two implementations have diverged:

- **Archive payload omits `poseId`** in `useRegenerateWithFeedback.ts:194` -- regeneration archives use `poseName` but not `poseId`
- **Extraction failure creates different database states.** `runGeneratePipeline` dispatches `EXTRACTION_COMPLETE` with empty sprites (transitioning to review for re-extract); `useRegenerateWithFeedback` dispatches only `SET_STATUS` (leaving the UI stuck while saving a zero-sprite record to the database)
- **Error handling paths diverge.** The main pipeline logs explicit error messages; the regeneration path has weaker checks

Meanwhile, `useAddSheet` and `useRunWorkflow` correctly delegate to `runGeneratePipeline` -- making `useRegenerateWithFeedback` the sole outlier.

**Sources:** Maintainer F2, Design Principles F1, Conventions F5, Data Integrity F7

---

#### 2. SpriteReview Is a God Component [ALL FOUR PERSPECTIVES]

`SpriteReview.tsx` (684 lines) manages 15+ pieces of local state, 7 custom hooks, 3+ interlinked `useEffect` chains, and the entire review experience. The settings load/save cycle (lines 200-343) uses a `skipNextSaveRef` guard to prevent restore from echo-writing back to the DB -- a hack around overlapping dependency graphs. The save effect has a 25+ item dependency array. The processing pipeline effect has 15+ items.

All perspectives agree on the decomposition direction but differ on ordering:
- **Maintainer:** Extract `useReviewSettings` (load/save/restore lifecycle)
- **Design Principles:** Extract `useReviewPersistence` + `useProcessingPipeline`
- **Conventions:** Consolidate settings hooks into one reducer FIRST, then extract persistence

**Sources:** Maintainer F1, Design Principles F3, Conventions F1

---

#### 3. `ContentPreset` Type is a Bag of Optionals [THREE PERSPECTIVES]

`ContentPreset` in `src/types/api.ts:55-78` is a flat interface where every sprite-type-specific field is optional, while the app already has a properly discriminated union (`AnyPreset`) in `AppContext.tsx`. Code accesses fields with `|| ''` fallbacks instead of compile-time safety. The two type systems create confusion about which to use.

**Sources:** Maintainer F12, Design Principles F4, Conventions F7

---

#### 4. Untyped Server-Side Code [THREE PERSPECTIVES]

The entire `server/` directory is plain JavaScript with no type annotations, despite TypeScript being configured and `@types/express` being installed. The client has typed API interfaces (`src/types/api.ts`) but the server producing those responses has zero enforcement. The `snake_case` to `camelCase` field mapping in `history.js` is manual and error-prone.

**Sources:** Maintainer F8, Design Principles (via F7), Conventions F4

---

#### 5. AppState Mixes Persistent and Transient Data [TWO PERSPECTIVES]

`AppState` holds preset arrays (change rarely), status messages (change per-interaction), and generation results in a single flat object. Every `SET_STATUS` dispatch re-renders all `useAppState()` consumers. The `RESET` action must explicitly preserve 5 preset arrays -- forgetting one causes data loss.

**Sources:** Maintainer F5, Design Principles F9

---

#### 6. Schema/Migration Dual Truth Source with No Automated Verification [TWO PERSPECTIVES]

`schema.js` defines full tables for new DBs; `migrations.js` defines incremental changes for existing ones. They must produce identical schemas but there is no test verifying this. The existing migration test (`migrations.test.js:38`) is stale -- it asserts the last migration is `020` when the actual last is `026`.

**Sources:** Maintainer F7, Data Integrity F6

---

### Unique Findings (organized by perspective)

#### Maintainer

- **F3: Content-name fallback covers only some types.** When `contentPresetId` is null (legacy entries), the regeneration hook falls back to state data that may be stale or incomplete. Regenerating a legacy entry loses all guidance context.
- **F4: Per-type table multiplication.** 4 preset + 4 link tables with near-identical schemas. Migration 018 is 30 lines of repetitive ALTERs touching all 8 tables. Adding a shared column requires 4 ALTER statements.
- **F6: Base64 images stored as TEXT in SQLite.** Gallery endpoint runs correlated subqueries pulling full sprite image data. No way to fetch metadata without the multi-MB image payload.
- **F9: `setTimeout(r, 0)` state propagation hack.** SpriteReview dispatches settings to global state then awaits a setTimeout to let React flush before calling `regenerate()`. This has already been copied to at least one other location.
- **F10: Gallery grouping is client-side only.** Groups spanning pages appear as separate partial groups. No server-side group awareness.
- **F11: Hardcoded 6x6 character defaults scattered.** The 6-column default appears as magic numbers in 5+ files instead of referencing `CHARACTER_GRID` constants.

#### Design Principles

- **F2: Parallel prompt-building paths with fragile string replacement.** Building/terrain/background use `prompt.replace('The attached image is', 'IMAGE 2 is')` for multi-grid reference instructions. If any prompt builder rephrases that exact string, the replacement silently becomes a no-op and reference instructions vanish with no error. Character has a dedicated `buildGridFillPromptWithReference` function. Also, single-generate reads `styleNotes` from state while run/add-sheet hardcodes `styleNotes: ''`.
- **F7: Raw `fetch()` calls scattered through business logic.** The Gemini API has a proper client (`geminiClient.ts`), but history/preset/archive APIs use raw fetch everywhere. No centralized URL construction, headers, or error handling for internal endpoints.
- **F8: `loadGenerationIntoState` has redundant type-branching.** Two branching sections mirror each other with near-identical code per sprite type, exactly the pattern `WORKFLOW_CONFIGS` was designed to eliminate.

#### Conventions & Idioms

- **F2: Inconsistent state management patterns.** `usePostProcessingState` uses `useReducer` with typed actions; `useChromaKeySettings` uses 5 `useState` calls; `usePosterizeSettings` uses 2 `useState` calls. All feed into the same save/restore cycle, requiring SpriteReview to speak three different APIs.
- **F3: `as Action` casts bypass type safety.** `UnifiedConfigPanel.tsx` builds actions dynamically and casts with `as Action`, defeating the discriminated union. If someone renames an action, the cast silently produces malformed actions.
- **F6: `useGridWorkflow` naming inconsistency.** The character workflow hook is named "grid" while all others follow `use[Type]Workflow`. Legacy naming from when characters were the only type.
- **F9: Unstable array reference in `useEffect` dependency.** `postState.outline.color` (an RGB tuple) is recreated on every state update, causing unnecessary sprite processing re-runs. The developer solved this for `struckColors` with `JSON.stringify` but didn't apply it to `outline.color`.
- **F13: ESLint disables `no-explicit-any` and two react-hooks rules globally.** New code can introduce `any` and effect-related anti-patterns without friction.

#### Data Integrity

- **F1: Inconsistent CASCADE trust in delete route.** The handler manually deletes sprites (which have CASCADE) but trusts CASCADE for editor_settings. Mixed signals for future developers.
- **F2: Generation version race condition.** Read-then-write `MAX(generation_version)` outside a transaction. No UNIQUE constraint to catch duplicate versions.
- **F3 + F9: Dangling `content_preset_id` on preset delete.** Polymorphic FK with no constraint. Preset deletion leaves stale references. `useRunWorkflow.ts:52` uses a non-null assertion with no fallback -- would throw unhandled.
- **F4: No validation that `generation_id` exists before sprite/settings insert.** FK constraint error produces opaque 500 instead of informative 404.
- **F5: Gallery subquery loads full sprite images for entries without thumbnails.** Falls back to full base64 image data when `thumbnail_image` is null.

---

## Cross-Pollination Insights (Round 2)

### Tradeoff Tensions

#### 1. SpriteReview Decomposition: Which Cut First?

All perspectives agree SpriteReview needs decomposition but the ordering matters:

- **Conventions' approach wins:** Consolidate chroma/posterize settings into the existing `usePostProcessingState` reducer FIRST. This eliminates the three-API restore dance, which eliminates `skipNextSaveRef`, which makes the persistence hook extraction straightforward.
- **Recommended sequence:** (1) Consolidate settings into one reducer, (2) Extract persistence hook, (3) Extract processing pipeline, (4) Extract export logic.

#### 2. Per-Type Table Multiplication vs. Schema Consolidation

- **Maintainer + Conventions:** Consolidate into a single `content_presets` table with a `sprite_type` discriminator + JSON for type-specific fields. Reduces migration surface from O(N) to O(1).
- **Data Integrity counterpoint:** The current 8-table design provides genuine FK type safety at the database level. A consolidated `content_grid_links` table would need application-level logic to prevent cross-type linking.
- **Resolution:** A hybrid approach -- consolidate link tables (identical schemas) while keeping per-type preset tables -- reduces migration pain while preserving FK safety. Alternatively, accept the current design if no new sprite types are planned.

#### 3. Untyped Server: Full TypeScript Migration vs. API Client Layer

- **Maintainer:** Migrate server to TypeScript incrementally, starting with `utils.ts` and `presetTables.ts`.
- **Conventions:** JSDoc as a lighter alternative.
- **Design Principles:** Creating typed API clients on the frontend delivers more immediate value than server-side typing.
- **Resolution:** The API client approach is the higher-leverage fix. Creating `api/historyClient.ts` and `api/presetsClient.ts` enforces the contract at the boundary the frontend actually consumes, and enables the save pipeline extraction. Server typing remains valuable but is lower priority.

#### 4. `ContentPreset` Type Strategy

- **Maintainer:** Use existing `AnyPreset` at the `fetchContentPreset` boundary (least new code).
- **Design Principles:** Mapped types `PresetForType<T>` (most type-safe).
- **Conventions:** Add `spriteType` discriminator to `ContentPreset`.
- **Resolution:** Use `AnyPreset` -- the discriminated union already exists and is well-tested. Validate and narrow the API response in `fetchContentPreset`.

### Amplified Concerns

#### 1. Save Pipeline Duplication Is a Data Integrity Requirement, Not Just DRY

The combination of (a) duplicated save logic, (b) wrong content name in one path, (c) different extraction failure handling, and (d) non-atomic saves in both paths means the extraction is a **data integrity requirement**. Two independent paths to the database, each with different bugs, each producing differently-corrupted records. A single shared function would have one set of bugs to fix.

#### 2. The `.replace()` Prompt Hack Stores Misleading Data

When the string replacement is a no-op, not only does Gemini receive wrong instructions (functional bug), but the stored `prompt` in the `generations` table doesn't reflect what was intended (data integrity bug). Reviewing the stored prompt shows the un-replaced text, making it look correct when it's actually broken.

#### 3. `as Action` Casts + Untyped Server = End-to-End Type Hole

A malformed action from a cast in `UnifiedConfigPanel` could produce incorrect state that flows through fetch to the untyped server to the database. Low probability in practice, but the trust chain from UI to storage has no type enforcement at any boundary.

### New Insights

#### 1. The Three-API Settings Pattern Is the Root Cause of `skipNextSaveRef`

Conventions' Finding 2 (inconsistent settings hooks) and Maintainer's Finding 1 (SpriteReview complexity) are the same problem from different angles. If all editor settings lived in one reducer, load/save would be: load from server -> dispatch single RESTORE -> save effect compares whole state to last-saved snapshot. The `skipNextSaveRef` exists because settings arrive through three different hook APIs, each triggering the save effect independently. Consolidation eliminates both problems simultaneously.

#### 2. The Save Pipeline and API Client Gap Are the Same Problem

The duplicated save pipeline (Conventions F5) and scattered raw `fetch()` calls (Design Principles F7) are two symptoms of one cause: save operations aren't abstracted. Creating `api/historyClient.ts` with typed functions would: (a) centralize fetch calls, (b) make the shared `saveGenerationResult()` trivial to implement, (c) eliminate inconsistent error handling, and (d) provide the natural place to address save atomicity.

#### 3. The Codebase Has a Clear Well-Factored / Debt Stratification

- **Well-factored:** `useGenericWorkflow` + `WORKFLOW_CONFIGS`, `presetTables.js`, `buildGuidanceBlock`, `buildGenerationRequest`, `UnifiedConfigPanel`, server route factories, React context split (state/dispatch/ref)
- **Debt-laden:** SpriteReview (god component + settings complexity), `useRegenerateWithFeedback` (duplicated pipeline), `loadGenerationIntoState` (type branching), AppContext (monolithic state), server schema (drift from migrations)

The well-factored layers share a principle: config objects or strategy interfaces for per-type variation. The debt layers use if/else chains, raw state accumulation, or copy-paste with divergence. The refactoring path is to extend the config-driven pattern into the debt-laden areas.

#### 4. The `setTimeout(0)` Pattern Has Already Been Copied

Conventions found two instances of the `setTimeout(0)` flush hack. The fact that it's been replicated means a developer encountered the pattern and assumed it was established idiom. Fixing the root cause (pass settings as parameters to `regenerate()`) prevents further propagation.

#### 5. Data Integrity Gaps Form a Compound Risk

Version race conditions, dangling preset references, non-atomic saves, and stale test assertions are each minor for a single-user app. Together they form a cluster of "things that don't quite work right" that a new developer encounters as confusing, disconnected symptoms.

---

## Suggested Alternatives (prioritized)

### Priority 1: Extract Shared Save Pipeline (High Impact, Medium Effort)

**What:** Extract `saveGenerationResult()` from `runGeneratePipeline` to handle history POST + sprite POST + archive POST. Both `runGeneratePipeline` and `useRegenerateWithFeedback` delegate to it.

**Why first:** All four perspectives flagged this independently. Fixes: duplicated save logic, missing `poseId` in regeneration archives, divergent extraction error handling, and provides a single location to address non-atomic save risk. This is a data integrity requirement, not just a code quality improvement.

**Enables:** Adding a `status` column for incomplete entries, combining into a transactional endpoint, consistent error handling.

### Priority 2: Create Internal API Client Layer (High Impact, Medium Effort)

**What:** Create `api/historyClient.ts` and `api/presetsClient.ts` alongside the existing `geminiClient.ts`. Export typed functions: `saveGeneration()`, `saveSprites()`, `archiveGeneration()`, `fetchContentPreset()`, etc.

**Why second:** Force-multiplier. Makes Priority 1 cleaner (shared function calls typed client methods instead of raw fetch). Centralizes URL construction, headers, and error handling. Fixes the scattered `fetch()` calls flagged by Design Principles.

### Priority 3: Consolidate Editor Settings Into One Reducer (High Impact, Medium Effort)

**What:** Merge `useChromaKeySettings` (5 useStates) and `usePosterizeSettings` (2 useStates) into the existing `usePostProcessingState` reducer. Add a `RESTORE` action that replaces the multi-API restore dance.

**Why third:** Prerequisite for clean SpriteReview decomposition. Eliminates the `skipNextSaveRef` guard, reduces the save effect dependency array from 25+ items to a handful, and makes the persistence hook extraction straightforward.

### Priority 4: Extract `useEditorPersistence` Hook from SpriteReview (High Impact, Low Effort after P3)

**What:** Move the settings load/save/restore lifecycle (lines 200-343) into a dedicated hook. Expose `settings` object + `updateSetting` function. Internally manage the comparison with last-saved state.

**Why fourth:** After Priority 3, this becomes a clean extraction of ~50 lines instead of a complex refactoring of 135 lines with temporal coupling.

### Priority 5: Fix `setTimeout(0)` Hack -- Pass Settings as Parameters (Medium Impact, Low Effort)

**What:** Extend `RegenerateOptions` to include `model`, `imageSize`, and `thinkingLevel`. Pass directly instead of dispatching to global state and waiting for propagation.

**Why fifth:** Eliminates timing-dependent code that has already been copied. The interface already accepts `imageSize` -- extending it is trivial.

### Priority 6: Unify Prompt Building Paths (Medium Impact, Medium Effort)

**What:** Either give every prompt builder a `withReference` variant (following the character pattern), or route all flows through `buildPromptForType` as the single entry point. Eliminate the `.replace('The attached image is', ...)` hack.

**Why sixth:** The string replacement is the most fragile coupling in the codebase -- a silent-failure mode with no tests. Also fixes the `styleNotes` inconsistency between single-generate and run/add-sheet flows.

### Priority 7: Fix Stale Migration Test + Add Schema Drift Detection (Medium Impact, Low Effort)

**What:** (a) Update the migration test assertion from `020` to `026`. (b) Add a test that creates a fresh DB via `schema.js` and another via empty DB + all migrations, then compares `PRAGMA table_info`, `PRAGMA index_list`, and `PRAGMA foreign_key_list` for every table.

**Why seventh:** Low effort, high safety value. The existing test is supposed to be a safety net and it's broken.

### Priority 8: Add Fallback in `useRunWorkflow` for Missing Presets (Low Impact, Low Effort)

**What:** Add try/catch around `fetchContentPreset` at `useRunWorkflow.ts:52`, matching the pattern used in `useRegenerateWithFeedback` and `useAddSheet`. Also add `UPDATE generations SET content_preset_id = NULL` to the preset delete handler.

### Priority 9: Fix Unstable Array Reference in Processing Effect (Low Impact, Low Effort)

**What:** Apply `JSON.stringify` to `postState.outline.color` in the processing effect dependency array, matching the existing pattern for `struckColors`.

### Priority 10: Set ESLint Disabled Rules to `warn` (Low Impact, Low Effort)

**What:** Change `no-explicit-any`, `react-hooks/set-state-in-effect`, and `react-hooks/refs` from `'off'` to `'warn'`. Surfaces violations in new code without breaking the build.

---

## Blind Spots

### 1. No Performance Profiling Under Load

No perspective examined actual rendering performance, memory usage with large base64 images in state, or SQLite query performance with a full gallery. The base64-in-TEXT storage concern (Maintainer F6) and gallery subquery concern (Data Integrity F5) are speculative without profiling data.

### 2. No Error Recovery UX Analysis

The review focused on code structure but not user experience during failures. What does the user see when extraction fails? When a save partially completes? When a preset is deleted mid-run? The non-atomic save creates orphaned records, but no perspective examined whether the UI surfaces this or how a user would recover.

### 3. No Security Review

No perspective examined authentication, authorization, input sanitization beyond the `hasColumn` PRAGMA interpolation note, or the implications of the 50MB body limit. The server accepts arbitrary JSON bodies with no schema validation beyond field-presence checks.

### 4. No Test Coverage Analysis

Beyond the stale migration test, no perspective systematically assessed test coverage. The Playwright e2e tests and Vitest unit tests were not evaluated for coverage of the identified risk areas (save pipeline, settings persistence, prompt building paths, extraction error handling).

### 5. Concurrent Session Behavior

The version race condition (Data Integrity F2) was noted but the broader question of what happens with multiple browser tabs or sessions was not explored. State is managed client-side with no server-side session awareness.

### 6. Accessibility and Cross-Browser Concerns

No perspective examined the CSS design system, keyboard navigation, screen reader support, or browser compatibility of the canvas-based sprite operations.
