# Round 2: Maintainer Perspective -- Cross-Pollination

My Round 1 findings are locked. This document contains only reactions to other perspectives' findings, tensions between perspectives, and new insights triggered by the cross-reading.

---

## Reactions

### Reaction to Design Principles Finding 2: Asymmetric Reference Handling via `.replace()`

This is the single most fragile coupling I missed. The building/terrain/background prompt builders inject the multi-grid reference prefix via `prompt.replace('The attached image is', 'IMAGE 2 is')` in `promptForType.ts:79,93,108`, while character has a dedicated `buildGridFillPromptWithReference` function. A new developer creating a fifth sprite type has zero signals that their prompt must include the exact string "The attached image is" for multi-grid runs to work. If they rephrase it, reference continuity silently vanishes with no error, no test failure, no warning. This is exactly the kind of implicit knowledge trap my analytical lens targets, and I should have caught it. From a maintainer standpoint, this is a higher priority than many of my findings because the failure mode is completely silent.

### Reaction to Data Integrity Finding 2: Generation Version Race Condition

My review didn't examine the atomicity of the version computation. The read-then-write pattern in `history.js:110-121` (read MAX, then INSERT) outside a transaction is a textbook race condition. For a single-user local app the practical risk is low, but the pattern is wrong in principle and would become a real bug if the app ever supports concurrent sessions. The suggestion to use a single `INSERT ... SELECT MAX(...)+1` is strictly better.

### Reaction to Data Integrity Finding 7: Non-Atomic History + Sprites Save

This compounds with my Finding 2 (duplicated save pipeline). There are now two non-atomic save paths that can each produce orphaned generation records with zero sprites. If the sprite POST fails after the history POST succeeds, the gallery shows an empty entry with no way to recover. Data Integrity's suggestion of a `status` column (pending/complete) is practical and would also help with gallery filtering. My recommendation to extract `saveGenerationResult()` becomes even more important when paired with this fix -- a single function can implement the transactional semantics once.

### Reaction to Data Integrity Finding 3: Dangling `content_preset_id` Reference

The polymorphic FK to one of four preset tables is a real operational hazard. Most flows handle the missing preset gracefully with try/catch, but `useRunWorkflow.ts:52` uses `fetchContentPreset(run.spriteType, run.contentPresetId!)` with a non-null assertion and no fallback. If a user deletes a preset that's referenced by an active run, this throws unhandled. From a maintainer perspective, the fix has two parts: (1) add a try/catch fallback in `useRunWorkflow`, and (2) nullify `content_preset_id` on preset delete. The second prevents the first from ever firing.

### Reaction to Data Integrity Finding 9: Preset Delete Doesn't Nullify Generation References

Directly related to Finding 3 above. The delete handler in `presets.js:83-101` deletes the preset and its grid links but leaves all `generations.content_preset_id` entries pointing at nothing. The suggested `UPDATE generations SET content_preset_id = NULL WHERE content_preset_id = ? AND sprite_type = ?` is simple and correct.

### Reaction to Data Integrity Finding 1: Inconsistent CASCADE Trust in Delete Route

A clean example of how partial safety measures can be worse than none. The delete handler manually deletes sprites (redundant with CASCADE) but trusts CASCADE for editor_settings. A new developer sees the manual sprite delete and assumes CASCADE can't be trusted, then adds manual deletes for every new child table. Or they see editor_settings relying on CASCADE and omit manual deletes everywhere. Either way the inconsistency creates confusion. Trust CASCADE for both and remove the manual sprite delete.

### Reaction to Data Integrity Finding 6: Stale Migration Test Assertion

The test asserting the last migration is `020_add_generation_thinking_level` when the actual last is `026_fix_parent_history_fk` means the test isn't catching drift. This is the exact safety net that my Finding 7 (schema/migration sync) needs, and it's broken. Fixing the assertion is trivial but essential.

### Reaction to Conventions & Idioms Finding 2: Inconsistent State Management Patterns

This is a root cause I circled around but didn't name directly. The three settings hooks (`useChromaKeySettings` with 5 useStates, `usePosterizeSettings` with 2 useStates, `usePostProcessingState` with useReducer) all feed into the same save/restore cycle in SpriteReview. The multi-API restore dance in SpriteReview lines 218-263 (`restoreChromaKey()`, `restorePosterize()`, `postDispatch RESTORE`) exists specifically because these three hooks have three different APIs. If they were consolidated into the existing `usePostProcessingState` reducer, the restore would be a single dispatch and the `skipNextSaveRef` guard I flagged in my Finding 1 would become unnecessary. This is the root cause of the settings persistence complexity.

### Reaction to Conventions & Idioms Finding 3: `as Action` Casts Bypass Type Safety

I missed this. `UnifiedConfigPanel.tsx:201-205` builds action objects dynamically with `{ type: config.setContentAction, [config.contentStateKey]: value } as Action`. This defeats the entire purpose of the discriminated union in the reducer. If someone renames `SET_CHARACTER` to `UPDATE_CHARACTER`, this cast silently sends a malformed action. From a maintainer standpoint, this is the kind of bug that only surfaces as "the form stopped saving" with no compilation error and no runtime exception -- just silent state corruption.

### Reaction to Conventions & Idioms Finding 9: Unstable Array Reference in useEffect Dependency

The `postState.outline.color` (an `[r,g,b]` tuple) is recreated on every reducer state update, causing unnecessary sprite reprocessing. The developer already solved this for `struckColors` with `JSON.stringify` (SpriteReview line 97), but didn't apply the same fix to `outline.color`. This is a concrete performance bug with a one-line fix. From a maintainer perspective, the deeper issue is that the pattern needs to be documented: "all array/object values in processing effect dependencies must be serialized."

### Reaction to Conventions & Idioms Finding 6: `useGridWorkflow` Naming

Small but real. The file `useGridWorkflow.ts` sounds like it manages the grid system, not character sprites. The exported config is correctly named `characterConfig`, but the file/hook name creates confusion when grep-ing for "grid" functionality. A rename to `useCharacterWorkflow.ts` is low-risk and high-clarity.

### Reaction to Conventions & Idioms Finding 13: ESLint Disables react-hooks Rules

The disabled `react-hooks/set-state-in-effect` rule is directly relevant to the SpriteReview effects I flagged. Setting to `warn` would catch new instances of the pattern while not requiring immediate cleanup of existing violations. Good defense-in-depth.

### Reaction to Design Principles Finding 7: Raw fetch() Calls Scattered Through Business Logic

I flagged the duplicated save pipeline but didn't generalize to the broader missing API client layer. Design Principles correctly identifies that `geminiClient.ts` demonstrates the right pattern, but it wasn't applied to the internal API. Creating `api/historyClient.ts` would also make my Finding 2 (extract `saveGenerationResult`) cleaner -- the shared function would call typed client methods instead of raw fetch.

### Reaction to Design Principles Finding 8: `loadGenerationIntoState` Has Redundant Type-Branching

My Finding 11 (hardcoded 6x6 defaults) is a specific instance of this broader problem. The two branching sections in `loadGeneration.ts` (lines 50-111 for state construction, lines 140-163 for extraction config) could both use a registry lookup similar to `WORKFLOW_CONFIGS`. The existing `getReExtractGridConfig` from the workflow configs is almost exactly what the extraction branch needs.

---

## Tensions

### Tension 1: Schema Consolidation Priority (My Finding 4 vs Design Principles Finding 6)

My Finding 4 flagged the 4+4 table structure as duplication that compounds migration pain. Design Principles Finding 6 praises `presetTables.js` as making the duplication manageable at the application layer. Both are correct. The tension: the data-driven server code compensates for schema duplication, making the application-layer cost near zero, but migration 018 (30 lines of repetitive ALTER) demonstrates the schema-evolution cost remains high. Resolution depends on future trajectory: if a fifth sprite type is planned, consolidate the schema first; if not, the current approach is tolerable.

### Tension 2: SpriteReview Decomposition -- Which Cut First?

All four perspectives agree SpriteReview needs decomposition but disagree on ordering:
- **My Round 1:** Extract processing pipeline, version chain, export
- **Design Principles:** Extract persistence hook, export helper
- **Conventions & Idioms:** Consolidate settings into one reducer first, then extract persistence

Conventions' approach is the best ordering because the settings consolidation is a prerequisite for clean persistence extraction. Consolidating chroma/posterize/post-processing into one reducer eliminates the multi-API restore dance, which eliminates the `skipNextSaveRef`, which makes the persistence hook extraction straightforward. The right sequence is: (1) consolidate settings reducer, (2) extract persistence hook, (3) extract processing pipeline, (4) extract export.

### Tension 3: ContentPreset Type Strategy

My Finding 12, Design Principles Finding 4, and Conventions Finding 7 all flag the `ContentPreset` bag of optionals. Approaches differ:
- My approach: Use existing `AnyPreset` at the `fetchContentPreset` boundary
- Design Principles: Mapped types `PresetForType<T>`
- Conventions: Add `spriteType` discriminator to `ContentPreset`

From a maintainer perspective, using `AnyPreset` is the least-new-code option and the discriminated union already exists. Mapped types add complexity for marginal benefit. The pragmatic fix is: have `fetchContentPreset` validate and narrow to `AnyPreset`.

---

## New Insights

### New Insight 1: The Three-API Settings Pattern Is the Root Cause of `skipNextSaveRef`

Conventions' Finding 2 (inconsistent settings hooks) and my Finding 1 (SpriteReview settings complexity) are the same problem from different angles. If all editor settings lived in one reducer, the load/save lifecycle would be: load from server -> dispatch single RESTORE -> save effect compares whole state to last-saved JSON. The `skipNextSaveRef` exists because settings arrive through three different APIs (`restoreChromaKey`, `restorePosterize`, `postDispatch RESTORE`), each triggering the save effect independently. Consolidating into one reducer eliminates both the multi-API problem AND the skip-guard. This should be step zero in any SpriteReview decomposition.

### New Insight 2: The Duplicated Pipeline Has Three Divergent Steps, Not Just Save

Design Principles Finding 1 identified that extraction error handling also diverges: `runGeneratePipeline` dispatches `EXTRACTION_COMPLETE` with empty sprites on failure (transitioning to review for re-extract), while `useRegenerateWithFeedback` only dispatches `SET_STATUS` (leaving the UI in a different state). Combined with my Finding 2 and Data Integrity Finding 7, the regeneration hook reimplements three post-generation steps with different behavior: extraction error handling, history save, and archive. The shared function should encompass all three, not just save/archive.

### New Insight 3: The Codebase Has a Clear Well-Factored / Debt Stratification

Reading all four perspectives reveals a pattern:
- **Well-factored:** Prompt builder hierarchy, `useGenericWorkflow` + `WORKFLOW_CONFIGS` strategy pattern, `presetTables.js`, `buildGuidanceBlock`, `buildGenerationRequest`, `UnifiedConfigPanel`, server route factories
- **Debt-laden:** SpriteReview (god component + settings complexity), `useRegenerateWithFeedback` (duplicated pipeline), `loadGenerationIntoState` (sparse reconstruction with type branching), AppContext (monolithic state), server schema (drift from migrations)

The well-factored layers share a principle: config objects or strategy interfaces for per-type variation. The debt layers use if/else chains, raw state accumulation, or copy-paste with divergence. The refactoring path is to extend the config-driven pattern from the well-factored layers into the debt-laden ones. Critically, the well-factored parts should be preserved and used as templates, not touched during cleanup.

### New Insight 4: Data Integrity Gaps Form a Compound Risk

Data Integrity's findings about version race conditions, dangling preset references, non-atomic saves, and stale test assertions are each independently minor for a single-user app. But viewed together from a maintainer perspective, they form a cluster of "things that don't quite work right" that a new developer would encounter as confusing, disconnected symptoms. Fix priority based on silent-corruption risk: (1) non-atomic save (orphaned records), (2) dangling preset references (unhandled throws in run workflow), (3) version race condition (wrong version numbers), (4) stale test assertion (broken safety net).

### New Insight 5: The `setTimeout(0)` Pattern Has Already Been Copied

Conventions found two instances of the `setTimeout(0)` flush hack (SpriteReview:489 and AddSheetModal). I only found one. The fact that it's been replicated means a developer encountered the pattern and assumed it was an established idiom. This reinforces the urgency of fixing the root cause (pass settings as parameters) before it propagates further. Every copy increases the surface area of timing-dependent code.
