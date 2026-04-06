# Data Integrity -- Round 2 Reactions

## Reactions

### Maintainer Finding 1 (Stale type definitions create a parallel naming universe)

This directly overlaps with my Finding 1. The Maintainer frames it as a readability/comprehension problem for new developers. From a Data Integrity standpoint, this is not just confusing -- it is a **runtime data loss bug**. The reducer reads `action.preset.rowGuidance` which resolves to `undefined` because the API returns `overallGuidance`. The guidance data physically exists in the API response but is discarded at the reducer boundary. The Maintainer notes it "works by accident because the prompt builders now pull guidance from HierarchicalGuidance on GridLink rather than from the per-type preset state." This is a critical nuance I should have explored further in Round 1: the `promptForType.ts` path fetches the preset via `fetchContentPreset` and reads `overallGuidance` directly from the `ContentPreset` type, bypassing the broken reducer entirely. So the **generation pipeline is not broken** -- it works because it never touches the stale AppState. What IS broken is the config panel's prompt preview (which may read from AppState) and the `loadGeneration.ts` session restore (which writes the stale fields into state). The data loss is real but scoped to the UI display layer, not the prompt sent to Gemini.

### Maintainer Finding 2 (Two incompatible preset type systems coexist)

From a Data Integrity standpoint, this is more critical than it appears as a maintainability issue. The coexistence of `CharacterPreset` (old shape) and `ContentPreset` (new shape) means there are two different "truths" about what a preset looks like. Code that casts between them (the `as ContentPreset` at UnifiedConfigPanel line 297) is performing an unsafe boundary crossing -- the compiler cannot verify that the runtime object matches the target type. This is exactly the kind of implicit shape assumption that lets data corruption propagate silently. Any code path that receives a per-type preset and assumes it has `overallGuidance` (because it was cast to `ContentPreset`) will work at runtime only because the API response includes that field even though the per-type TypeScript interface doesn't declare it.

### Maintainer Finding 9 (No validation that cell guidance keys match actual cell labels)

From a Data Integrity standpoint, this is actually more critical than it appears as a UX concern. Orphaned guidance keys are a form of **silent data rot**. The guidance data is stored permanently in the database, occupying the `cell_guidance` JSON column, but never surfaces in any prompt. Over time, edits and label renames accumulate orphaned entries. Worse: if a cell label is renamed in a grid preset (e.g., "Cast 1" to "Special 1" -- which already happened via `RPG_FULL_RENAME`), the corresponding cell guidance entries on all linked presets become orphaned unless a migration explicitly renames those keys. The `RPG_FULL_RENAME` map handles this for the initial seed decomposition but does nothing for user-created guidance entries on existing links.

### Conventions Finding F3 (Inconsistent naming -- `cellGuidance` means two different things)

From a Data Integrity standpoint, this naming collision is a direct hazard for data corruption at storage boundaries. If someone writes code that passes `AppState.building.cellGuidance` (a `string`) into a function expecting `Record<string, string>`, the JSON.stringify on the storage path will wrap the string in quotes, producing `"\"some text\""` rather than `{"key": "value"}`. When read back, `JSON.parse` will succeed (returning the bare string), but `buildGuidanceBlock` will try to access `.cells[label]` on a string, getting `undefined` for every key. This is a type-shape mismatch that the current loose typing cannot catch. The Conventions perspective correctly identifies the naming collision; from my lens, the consequence is corrupted guidance that silently produces empty prompts.

### Conventions Finding F10 (GenericPresetsTab uses `Record<string, unknown>`)

From a Data Integrity standpoint, this matters because `GenericPresetsTab` is the admin CRUD interface -- it is a **write path to the database**. When the admin saves a preset, the data flows from `Record<string, unknown>` state through `extractPresetValues` into a SQL INSERT/UPDATE. The `Record<string, unknown>` typing means there is no compile-time guarantee that the saved data matches the schema. Combined with my Finding 4 (`||` vs `??` in `extractPresetValues`), this is a double gap: the types don't enforce the shape, and the runtime doesn't enforce the values. A field typo in the admin UI config would result in `undefined` reaching `extractPresetValues`, which would silently use the default, and the user's intended data would be lost.

### Conventions Finding F11 (decomposeGuidance.js is untyped)

From a Data Integrity standpoint, this is particularly concerning because the function is a **data transformation at a critical boundary** -- it converts the old blob format into the new structured format during seeding. If the output shape drifts from what `buildGuidanceBlock` expects (e.g., someone changes the return to use `cellEntries` instead of `cells`), the guidance data would be stored in the wrong key and silently ignored at prompt time. The lack of a shared type contract between the server-side decomposition and the frontend consumption is a structural integrity gap.

### Maintainer Finding 6 (decomposeGuidanceBlob regex tightly coupled to seed format)

From a Data Integrity standpoint, the fragility of the parser has a specific consequence I want to highlight: **silent data misclassification**. If a seed blob has a line like `  Header "Walk Down 1" (0,0): text` with 9 leading spaces (one more than the 8-space max in the regex), that entire cell's guidance silently becomes part of the `overall` text rather than the `cells` map. The data isn't lost -- it's misrouted. The prompt will include the guidance text but in the wrong section (overall preamble instead of cell-specific), producing a subtly different prompt that the user would never notice without comparing raw prompt output.

---

## Tensions

### Tension 1: "Dead field" vs. "Data loss bug"

Both the Maintainer (Finding 1) and Conventions (Finding F2) characterize the stale `rowGuidance` / `cellGuidance` / etc. fields as "dead" -- implying they are unused baggage. My Finding 1 characterizes them as a "data loss bug" where guidance is silently dropped. The tension exists because both are partially correct: the fields ARE dead in the sense that the generation pipeline doesn't use AppState guidance (it uses ContentPreset fetched directly from the API). But they ARE a data loss bug in the sense that the reducer actively reads these fields from the API response, gets `undefined`, and stores empty strings -- which means the UI state (config panel, prompt preview, session restore) lacks guidance data even though the backend has it. Whether this is "dead code" or "broken code" depends on whether you consider the UI state to be a source of truth or just a display cache.

### Tension 2: Fixing types vs. removing fields

The Maintainer suggests "complete the rename" (update `rowGuidance` to `overallGuidance` everywhere). The Conventions perspective suggests "remove `rowGuidance` from CharacterPreset." My perspective agrees with the Maintainer's approach: the fields should be renamed and their types updated to match the new hierarchical shape, because the `loadGeneration.ts` session-restore path and the `UnifiedConfigPanel` prompt preview both need actual guidance data in AppState. Simply removing the fields would leave those code paths without guidance data at all. The right fix is to update the shape, not delete it.

---

## New Insights

### Insight 1: The generation pipeline is accidentally resilient

Reading the Maintainer's observation that the prompt builders "pull guidance from HierarchicalGuidance on GridLink rather than from the per-type preset state" prompted me to re-trace the actual generation flow. The `useRunWorkflow` / `promptForType.ts` path calls `fetchContentPreset(spriteType, presetId)` which hits `GET /api/presets/:type/:id`, which uses `mapPresetRow` with the correct column config, returning `overallGuidance` / `groupGuidance` / `cellGuidance` in the correct shape. This response is consumed by `buildPromptForType` which constructs `presetGuidance` from these fields. **The AppState is never consulted for guidance during generation.** This means my Round 1 Finding 1, while correct about the data loss in the UI layer, overstated the severity -- the prompt sent to Gemini is correct. The regression is limited to: (a) the prompt preview in UnifiedConfigPanel showing no guidance, (b) the session-restore path in loadGeneration.ts not restoring guidance state, and (c) the config panel state not reflecting the selected preset's guidance.

### Insight 2: `INSERT OR IGNORE` + label renames = double data divergence

The Maintainer's Finding 9 about orphaned guidance keys, combined with my Finding 3 about `INSERT OR IGNORE` not refreshing existing data, reveals a compounding problem. On a migrated database: (1) the migration renames `row_guidance` to `overall_guidance`, leaving the old monolithic blob in the renamed column; (2) `INSERT OR IGNORE` skips re-seeding, so the blob is never decomposed; (3) if someone later renames cell labels in a grid preset (as happened with Cast/Special), any user-created cell guidance entries on links become orphaned with no automated cleanup. There are now three sources of guidance key drift: initial migration, label renames, and manual edits -- none of which have reconciliation mechanisms.

### Insight 3: The `confirm()` vs `window.confirm()` inconsistency (Conventions F6) has a data integrity angle

In test environments where `confirm` is not globally defined (e.g., jsdom without explicit mocking), a bare `confirm()` call in delete handlers could throw a ReferenceError, preventing the delete from executing but also preventing the UI from showing an error (since the throw happens before the API call). This is unlikely in practice but represents an unguarded path in destructive operations.
