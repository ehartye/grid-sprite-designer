# Round 2: Design Principles -- Cross-Pollination

## Reactions to Other Perspectives

### On Maintainer Finding 2 (duplicated save pipeline): Strong agreement, additional nuance

All four perspectives independently flagged the duplicated save-to-history+archive pipeline between `runGeneratePipeline` and `useRegenerateWithFeedback`. The Maintainer adds a specific detail I noted but they articulated well: the `poseId` omission in regenerate's archive call is likely a bug, not intentional. The Conventions perspective adds that `useAddSheet` and `useRunWorkflow` correctly delegate to `runGeneratePipeline`, making `useRegenerateWithFeedback` the sole outlier. This convergence across all four independent analyses makes this the highest-confidence, highest-impact refactoring target in the codebase. The fix has clear scope: extract a shared `saveGenerationResult()` function.

---

### On Maintainer Finding 3: Content-name fallback covers only 2 of 4 types

The Maintainer flags a subtle bug I did not catch: when `contentPresetId` is null (legacy entries), `useRegenerateWithFeedback.ts:127-135` falls back to `WORKFLOW_CONFIGS[spriteType].getContent(currentState)`. The issue is that for a restored generation, the matching state slice may contain stale data from a different sprite type, because `loadGenerationIntoState` only sets the active type's state slice.

From a design principles lens, this is a direct consequence of the DRY violation in my Finding 1. The canonical pipeline (`runGeneratePipeline`) receives `contentName` as a parameter and never guesses. The regeneration hook reimplemented the save logic and introduced this ad-hoc fallback. If the pipeline were shared, this bug class would not exist. This reinforces that extracting a shared save function isn't just about reducing duplication -- it prevents the class of bugs that arises from parallel implementations.

---

### On Maintainer Finding 4: Per-type table multiplication creates N*M schema coupling

The Maintainer identifies that 4 preset tables + 4 link tables with near-identical schemas create pain during migrations (migration 018 touches all 8 tables). I flagged the data-driven `PRESET_TABLES` abstraction as a positive finding (my Finding 6), and it is -- but the Maintainer correctly notes the abstraction only helps at the API layer. At schema evolution time, adding a shared column still requires 4 ALTERs.

From a design principles perspective, this is a tension between normalization (separate tables per type with type-specific columns) and DRY (a single polymorphic table). The Maintainer suggests consolidating into `content_presets` with a `sprite_type` discriminator + JSON `type_fields`. This is a sound approach: the `PRESET_TABLES` abstraction already proves the API layer can handle per-type differences from a unified backend. Pushing that unification into the DB would reduce the migration surface from O(N) to O(1) for shared column changes.

---

### On Maintainer Finding 7: Schema/Migration dual truth source

This has a clear design principles implication. The dual-truth-source pattern (schema.js for fresh DBs, migrations.js for existing DBs) violates Single Source of Truth. The Maintainer's suggestion of a test comparing `PRAGMA table_info` between the two paths is the minimum fix. The stronger architectural fix is to derive the schema FROM the migration chain, but the test approach is pragmatic and catches drift immediately with minimal effort.

---

### On Maintainer Finding 9 and Conventions Finding 8: `setTimeout(r, 0)` state propagation hack

Both perspectives converge on this. From a Dependency Inversion perspective, this is the wrong dependency direction. The caller (SpriteReview) knows the settings at call time but dispatches them into global state, then hopes the callee reads them back via a stateRef. The data should flow directly as parameters: `regenerate({ ...opts, model, imageSize, thinkingLevel })`. This eliminates both the setTimeout hack AND reduces coupling between the regeneration hook and global state. The `RegenerateOptions` interface already accepts `imageSize` -- extending it with `model` and `thinkingLevel` is trivial.

---

### On Conventions Finding 2: Inconsistent state management patterns across settings hooks

This adds an important dimension to my Finding 3 (SpriteReview God Object). The three different patterns (`useReducer` for postProcessing, multi-`useState` for chromaKey, multi-`useState` for posterize) create three different APIs that SpriteReview must orchestrate. From a Cohesion perspective, these are all aspects of the same domain concept -- "editor post-processing settings" -- and should use the same state management pattern.

The Conventions suggestion to consolidate chroma and posterize into the existing `usePostProcessingState` reducer is the right approach. This would also cascade benefits into the settings persistence lifecycle (my Finding 3): instead of the restore dance calling 3 different hook APIs (lines 236-268), a single RESTORE dispatch on the consolidated reducer would suffice. The `skipNextSaveRef` guard might even become unnecessary if the save effect compares against a "last saved" snapshot rather than tracking individual changes across 25+ dependency array items.

---

### On Conventions Finding 3: Type safety bypassed via `as Action` casts

The `as Action` casts in `UnifiedConfigPanel.tsx` are a type system concern I didn't explicitly flag, but they connect to my Finding 4 (loose `ContentPreset` type). Both findings point to the same root cause: the data-driven approach (using config objects to drive behavior polymorphically) is architecturally sound but fights TypeScript's nominal type system. The `SPRITE_TYPE_CONFIGS` map in UnifiedConfigPanel is structurally the right pattern (like `PRESET_TABLES`), but the dynamic action dispatch requires casts that break the discriminated union's safety guarantees.

The Conventions suggestion of a per-sprite-type dispatch helper is correct. Alternatively, a generic `SET_CONTENT` action with a `spriteType` discriminator (instead of separate `SET_CHARACTER`/`SET_BUILDING`/etc. actions) would let the data-driven pattern work without casts.

---

### On Conventions Finding 9: Unstable array reference in useEffect dependency

This is a concrete, actionable finding I missed. The `postState.outline.color` RGB tuple is a new array reference on every reducer state update, causing the heavy sprite processing pipeline to re-run even when the color hasn't changed. The developer already solved this for `struckColors` (line 97: `const struckKey = JSON.stringify(postState.struckColors)`) but didn't apply the same treatment to `outline.color`. This is a Low-effort/High-impact fix.

---

### On Data Integrity Finding 2: Generation version race condition

Low practical risk for a single-user app, but the pattern is architecturally incorrect. The read-then-write without a transaction is a classic race condition. From a design principles perspective, the fix (wrapping in `db.transaction()` or using `INSERT ... SELECT MAX()+1`) follows the principle of making invariants enforceable by the system rather than relying on access patterns.

---

### On Data Integrity Finding 3: `content_preset_id` is a dangling reference

The Data Integrity perspective correctly identifies that `useRunWorkflow.ts:52` uses a non-null assertion (`run.contentPresetId!`) with no fallback when fetching a content preset. If the preset was deleted after a run started, this would throw an unhandled error. From a Defensive Programming perspective, the regeneration and add-sheet flows handle this gracefully with try/catch, but the run workflow does not. This is an inconsistency in error handling strategy across the three generation flows -- another symptom of the flows not being fully unified.

---

### On Data Integrity Finding 7: Non-atomic history + sprites save

This directly amplifies my Finding 1. The non-atomic save is duplicated across both `runGeneratePipeline` and `useRegenerateWithFeedback`, so the orphaned-record risk exists in both paths. Extracting a shared `saveGenerationResult()` (my suggestion) would be the natural place to also address atomicity -- either by combining into a single transactional endpoint or by implementing compensating logic (delete the history record if sprite save fails).

---

## Tensions

### SpriteReview decomposition: Which extractions to prioritize?

All three other perspectives agree with my Finding 3 (SpriteReview is a God Object) and agree on the solution direction (extract hooks). The Maintainer suggests `useReviewSettings`, Conventions suggests `useEditorPersistence` + `useSpriteProcessing`, and I suggested `useReviewPersistence` + `useProcessingPipeline`. My priority ordering:

1. **Settings persistence** (highest value-to-risk): 135 lines with temporal coupling via `skipNextSaveRef`. Most fragile, most self-contained, cleanest extraction boundary.
2. **Sprite processing pipeline**: Two effects (palette detection + full processing) with clear inputs/outputs. Natural unit.
3. **Export logic**: ~40 lines, already fairly contained. Lower priority.

### Schema consolidation vs. per-type tables

The Maintainer advocates consolidating 8 preset tables into a polymorphic model. I flagged `PRESET_TABLES` as a positive pattern. These aren't contradictory -- the API abstraction is good regardless of the underlying table structure. The question is whether the migration pain (O(N) ALTERs for shared columns) justifies the upfront cost of a polymorphic table redesign. For a single-developer project with 4 types, the current approach is viable; at 6+ types, the consolidation pays for itself.

---

## New Insights From Cross-Pollination

### Insight 1: The regeneration pipeline is the single highest-leverage refactoring target

Four independent perspectives flagged issues in `useRegenerateWithFeedback`: duplicated save pipeline (all four), content-name fallback bug (Maintainer), missing poseId (Conventions), non-atomic save risk (Data Integrity), extraction error handling divergence (Design Principles). The convergence means this is not a matter of taste -- it is the clear #1 priority. Scope: extract shared `saveGenerationResult()`, fix content-name fallback, add the missing `poseId`.

### Insight 2: Consolidating settings hooks would cascade benefits into persistence

If chroma/posterize are consolidated into `usePostProcessingState` (Conventions Finding 2), the SpriteReview persistence lifecycle (my Finding 3) becomes dramatically simpler. Instead of restoring via 3 different hook APIs, a single RESTORE dispatch suffices. The save effect dependency array shrinks from 25+ items to a handful. The `skipNextSaveRef` guard might become a simple "compare with last-saved snapshot" pattern. This is a case where fixing one concern (inconsistent state management) unlocks fixing another (fragile persistence lifecycle).

### Insight 3: The `as Action` casts point toward a reducer action design improvement

Conventions Finding 3 (type safety bypassed) and my observation of the data-driven UnifiedConfigPanel suggest that the 4 separate `SET_CHARACTER`/`SET_BUILDING`/`SET_TERRAIN`/`SET_BACKGROUND` actions could be replaced with a single `SET_CONTENT` action carrying a `spriteType` discriminator and the content payload. This would let the data-driven config panel dispatch without `as Action` casts while reducing the action union and reducer cases. The same approach could collapse the 4 `SET_*_PRESETS` actions into `SET_PRESETS`.

### Insight 4: Storing richer history data eliminates multiple conditional branches

The Maintainer suggests storing full GridConfig with history entries. If extended to include cell groups and structured preset fields, this would simultaneously eliminate: the if/else chain in `loadGeneration.ts` (my Finding 8), the grid size inference heuristics, the type assertion unsafety, and the `bgMode` inference hack (`data.gridSize.startsWith('1x') ? 'parallax' : 'scene'`). Better data representation at the persistence layer cascades into simplified consumer code -- a classic demonstration that improving the data model eliminates conditional logic.
