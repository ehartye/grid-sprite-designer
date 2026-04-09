# Data Integrity -- Round 2 Cross-Pollination

My Round 1 findings are locked. Below are reactions to the other perspectives' Round 1 findings, viewed through a data integrity lens.

---

## Reaction to Maintainer Finding 2 + Design Principles Finding 1 + Conventions Finding 5: Duplicated Save Pipeline

All three perspectives independently flagged the duplicated save-to-history + archive pipeline between `runGeneratePipeline` and `useRegenerateWithFeedback`. From a data integrity angle, I want to amplify with specifics:

The divergence is worse than noted. I traced the concrete field differences:

1. **Archive payload omits `poseId`** in `useRegenerateWithFeedback.ts:194` -- regeneration archives use `poseName` but not `poseId`, while `runGeneratePipeline` includes both. Archive files from regeneration have different sprite metadata than archive files from generation.

2. **Extraction failure creates different database states.** In `runGeneratePipeline`, extraction failure dispatches `EXTRACTION_COMPLETE` with empty sprites AND `SET_STATUS` (lines 149-151), transitioning the UI to review with a warning. In `useRegenerateWithFeedback`, extraction failure dispatches only `SET_STATUS` (line 122) -- no `EXTRACTION_COMPLETE`. But the history+sprite save still proceeds with `sprites = []`. This means a regeneration with extraction failure saves a generation record with zero sprites, AND the UI doesn't transition to review -- the user sees a stuck state with no way to retry extraction, while an incomplete record exists in the database.

3. **My Finding 7 (non-atomic save) compounds this.** Both duplicated pipelines independently implement the same two-step save vulnerability. Extracting a shared `saveGenerationResult()` function (as all three perspectives suggest) would fix the atomicity gap in one place.

**Combined recommendation:** Extract `saveGenerationResult()` first, then address atomicity within that single function. Highest correctness/effort ratio.

---

## Reaction to Maintainer Finding 3: Stale Content Name in Regeneration Fallback

The Maintainer identified that `useRegenerateWithFeedback` falls back to `WORKFLOW_CONFIGS[spriteType].getContent(currentState)` for content name when `contentPresetId` is null, and that the state slice may contain stale data.

From a data integrity lens, the impact chain is:

1. The fallback reads the sprite-type-specific state slice (e.g., `state.terrain`)
2. If the state was populated by `loadGenerationIntoState`, the correct type's slice IS set
3. But if `contentPresetId` is null (legacy entry) AND the state slice wasn't populated (edge case), the history record gets an empty or wrong `content_name`
4. This wrong name is stored permanently in the `generations` table

Combined with my Round 1 Finding 3 (dangling `content_preset_id`): when the preset ID is stale AND the fallback reads from the wrong state, the generation gets wrong metadata from two independent failure paths. The database accumulates records with misleading `content_name` values that can never be automatically corrected.

---

## Reaction to Maintainer Finding 4: Per-Type Table Multiplication

The Maintainer suggested consolidating 4 preset + 4 link tables into a single table with a `sprite_type` discriminator.

From a data integrity perspective, the current design has a genuine advantage: **FK constraints are type-safe at the database level.** `character_grid_links.character_preset_id` can ONLY reference `character_presets(id)`, enforced by the engine. A consolidated `content_grid_links` junction would need application-level logic (or CHECK constraints with triggers) to prevent linking a character preset to a building-type grid preset. The `grid_presets.sprite_type` CHECK constraint exists but cross-table type consistency (link's preset type must match the grid preset's sprite type) requires enforcement beyond what simple FKs provide.

The migration pain is real (migration 018 touched all 8 tables). A hybrid approach could work: consolidate the LINK tables (identical schemas minus the FK column name) while keeping per-type preset tables. This reduces migration surface while preserving type-safe FK references for the preset side.

**Data integrity verdict:** The table multiplication provides genuine FK safety guarantees that a consolidated schema would sacrifice. I'd keep per-type preset tables unless triggers/CHECK constraints can replicate the type safety.

---

## Reaction to Maintainer Finding 7: Schema/Migration Sync Has No Automated Verification

The Maintainer proposed a test comparing two databases (fresh schema vs. empty + all migrations). This is the correct fix for the drift I noted in my Round 1 Finding 6 (stale migration test assertion).

I want to add: the comparison should include `PRAGMA index_list` and `PRAGMA foreign_key_list` for each table, not just `table_info`. Migration 026 rebuilds the `generations` table specifically to fix an FK constraint -- if the rebuild had missed an index, only an `index_list` comparison would catch it.

Also, my Finding 6 (stale test asserting last migration is `020` when it's actually `026`) is a symptom of this same gap. The one test that should catch drift is itself broken.

---

## Reaction to Design Principles Finding 2: Fragile `.replace()` Prompt Hack

The `.replace('The attached image is', 'IMAGE 2 is')` pattern in `promptForType.ts` has a secondary data integrity angle: the generated prompt is stored in `generations.prompt`. If the replace is a no-op (because the source string changed), the stored prompt has incorrect reference-image instructions. This means:

1. Gemini receives ambiguous instructions (functional bug)
2. The stored prompt in the DB doesn't accurately reflect what was intended (data integrity bug)
3. Reviewing the stored prompt in the UI would show the un-replaced text, making it look correct when it's actually broken

This is a case where a prompt-building bug creates misleading historical data.

---

## Reaction to Conventions Finding 3: `as Action` Casts in Dynamic Dispatch

From a data integrity perspective, the `as Action` casts in `UnifiedConfigPanel` could create malformed state that eventually gets persisted. The flow:

1. `UnifiedConfigPanel` builds an action with `as Action` (bypassing type safety)
2. The reducer processes it (or silently drops unknown fields)
3. State is used to build the history POST body
4. The server has no type guards on incoming request bodies (Conventions Finding 4)
5. The value is written to the database

If a cast produces a malformed action that sets `state.character.name` to an unexpected type, this flows through fetch to the server to the INSERT. The combination of unsafe casts on the client + untyped server creates an end-to-end path where type errors can reach the database.

**Severity:** Low in practice -- the reducer would need to mishandle the cast AND the value would need to survive serialization. But it's a principled concern about the trust chain from UI to storage.

---

## Reaction to Design Principles Finding 9 / Maintainer Finding 5: AppState Mixing Persistent and Transient State

Both perspectives flagged AppState mixing persistent domain data with transient UI state. From a data integrity view, this creates a specific risk in `RESTORE_SESSION`.

The reducer's `RESTORE_SESSION` does `return { ...state, ...action.payload }` with `as` casts. If session data contains stale keys that overlap with domain data (e.g., a preset array field), the restore overwrites fresh preset data with stale session data. The monolithic state shape has no boundary between "restorable fields" and "never-restore fields."

The suggestion to split into `PresetsContext` and `WorkflowContext` naturally eliminates this class of bug -- session restore only touches workflow context, presets are independently managed.

---

## Reaction to Conventions Finding 9: Unstable Array Reference in Dependency Array

The unstable `outline.color` array reference causing unnecessary processing pipeline re-runs is primarily a performance concern. But there's a subtle data integrity angle: if the processing is triggered repeatedly and the user saves sprites between re-runs, the saved sprites could reflect a processing state that was immediately superseded. In practice the processing is deterministic so the results are identical, but it's worth noting if non-deterministic processing (e.g., dithering) is ever added.

---

## New Compound Insights from Cross-Pollination

### Insight 1: Systematically Corrupted Non-Character Regeneration Chains

My Round 1 analysis revealed that the server-side version computation at `history.js:112-115` computes version when `parentHistoryId` is provided without explicit `generationVersion`. Combined with Maintainer Finding 3 (wrong content name for non-character types), every non-character regeneration chain risks entries with: (a) potentially wrong `content_name` from stale state fallback, and (b) correct `parent_history_id` but version numbers that depend on group_id matching correctly. The version chain is traversable via `parent_history_id`, but the metadata displayed in gallery (name, version number) may be incorrect for all non-character regeneration operations.

### Insight 2: Duplicated Save Pipeline = Duplicated Validation Gap

Both save paths validate `histId` is finite before saving sprites. But neither path cleans up a partially-saved history entry if sprite saving fails. And the regeneration path has a weaker check: it checks `histResp.ok` then `Number.isFinite(histId)`, while the main pipeline also logs explicit error messages. Consolidation would unify the validation, closing this gap.

### Insight 3: Save Pipeline Extraction Is a Data Integrity Requirement, Not Just DRY

The combination of (a) duplicated save logic, (b) wrong content name in one path, (c) different extraction failure handling in each path, and (d) non-atomic saves in both paths means the save pipeline extraction is not merely a code quality improvement. It's a **data integrity requirement** -- two independent paths to the database, each with different bugs, each producing differently-corrupted records. A single shared function would have one set of bugs to fix.

---

## Summary: Cross-Perspective Priority Matrix

| Priority | Issue | Sources |
|----------|-------|---------|
| **High** | Duplicated save pipeline creates two independent paths for incorrect data to enter the DB. Extraction failure in regen saves zero-sprite records with no UI recovery. | Maintainer F2, DP F1, Conv F5, my F7 |
| **High** | Stale content name from wrong state slice gets permanently saved to DB during regeneration | Maintainer F3, combined with my F3/F9 |
| **Medium** | Schema/migration drift has no automated detection; existing migration test is stale | Maintainer F7, my F6 |
| **Medium** | Per-type table multiplication is annoying but provides genuine FK type safety; consolidation would lose DB-level guarantees | Maintainer F4 |
| **Low** | `as Action` casts + untyped server = end-to-end path for type errors to reach DB | Conv F3, Conv F4 |
| **Low** | `.replace()` prompt hack stores misleading prompt history in DB when it's a no-op | DP F2 |
