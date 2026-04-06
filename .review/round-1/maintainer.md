# Maintainer Perspective Review

Reviewer lens: A new developer encountering this codebase for the first time, 6 months after the hierarchical guidance migration was implemented.

---

### Findings

---

#### 1. Stale type definitions create a parallel naming universe

- **What:** The `CharacterPreset`, `BuildingPreset`, `TerrainPreset`, and `BackgroundPreset` interfaces in `AppContext.tsx` still use the old field names (`rowGuidance`, `cellGuidance` as a flat string, `tileGuidance`, `layerGuidance`). The database, server routes, and admin UI all speak the new hierarchical language (`overallGuidance`, `groupGuidance`, `cellGuidance` as `Record<string,string>`). The app state types, reducer actions (e.g., `LOAD_CHARACTER_PRESET`), `loadGeneration.ts`, and `UnifiedConfigPanel.tsx` default content all still reference the old names.
- **Where:** `src/context/AppContext.tsx:62-105` (interfaces), `src/context/AppContext.tsx:230-265` (initial state), `src/context/AppContext.tsx:435-505` (reducer), `src/lib/loadGeneration.ts:54-102`, `src/components/config/UnifiedConfigPanel.tsx:80,103,126,147` (defaultContent), `src/types/api.ts:24` (HistoryResponse.content.rowGuidance)
- **Why it matters:** A new developer sees `rowGuidance: string` on the `CharacterPreset` type, looks at the database column which is now `overall_guidance`, sees the server return `overallGuidance`, and must mentally reconcile three naming conventions. The reducer maps `action.preset.rowGuidance` into state, but the API now returns `overallGuidance` from `mapPresetRow`. This is either silently broken (the old field is always empty because the API no longer sends it) or works by accident because the prompt builders now pull guidance from `HierarchicalGuidance` on `GridLink` rather than from the per-type preset state. Either way, this is a ticking confusion bomb.
- **Suggested alternative:** Complete the rename: update `CharacterPreset.rowGuidance` to `overallGuidance`, `BuildingPreset.cellGuidance: string` to `overallGuidance: string` (or remove it entirely since guidance is now hierarchical and lives on GridLink/ContentPreset), and do the same for terrain and background. Update the reducer, `loadGeneration.ts`, and `UnifiedConfigPanel` defaults to match. The old flat guidance fields on these per-type preset interfaces appear to be dead weight now that `ContentPreset` + `HierarchicalGuidance` handle everything.

---

#### 2. Two incompatible preset type systems coexist

- **What:** There are two distinct type hierarchies for presets: (a) the per-type interfaces (`CharacterPreset`, `BuildingPreset`, etc.) used by the app state, reducer, and `UnifiedConfigPanel`, and (b) the `ContentPreset` interface in `types/api.ts` used by `promptForType.ts` and the admin panel. These have different shapes -- `ContentPreset` has `overallGuidance`, `groupGuidance`, `cellGuidance` (the new hierarchical fields), while the per-type interfaces have the old flat fields.
- **Where:** `src/types/api.ts:50-73` (ContentPreset), `src/context/AppContext.tsx:62-105` (per-type interfaces), `src/lib/promptForType.ts:27-39` (uses ContentPreset), `src/components/config/UnifiedConfigPanel.tsx:297-304` (casts between them)
- **Why it matters:** `UnifiedConfigPanel.tsx:297` casts a preset from the per-type list (`AnyPreset`) to `ContentPreset` to access `overallGuidance`/`groupGuidance`/`cellGuidance`. This works at runtime because the API response includes these fields, but it bypasses TypeScript's type checking -- the per-type interfaces don't declare these fields. A new developer cannot tell from the types which fields are actually available. The `as ContentPreset` cast on line 297 is the duct tape holding this together.
- **Suggested alternative:** Either consolidate to a single `ContentPreset` type used everywhere, or add the hierarchical guidance fields to the per-type interfaces. The per-type interfaces should match what the API actually returns.

---

#### 3. `EMPTY_GUIDANCE` sentinel is duplicated 9 times

- **What:** The constant `{ overall: '', groups: {}, cells: {} }` is independently defined in 9 files: `useGridWorkflow.ts`, `useBuildingWorkflow.ts`, `useTerrainWorkflow.ts`, `useBackgroundWorkflow.ts`, `UnifiedConfigPanel.tsx`, and all 4 prompt builder test files plus `promptBuilder.test.ts`.
- **Where:** `src/hooks/useGridWorkflow.ts:11`, `src/hooks/useBuildingWorkflow.ts:11`, `src/hooks/useTerrainWorkflow.ts:11`, `src/hooks/useBackgroundWorkflow.ts:11`, `src/components/config/UnifiedConfigPanel.tsx:255`
- **Why it matters:** If the `HierarchicalGuidance` shape changes (e.g., adding a `meta` field), every one of these must be updated. This is already exported from none of the shared modules despite being a natural fit for `promptBuilderBase.ts`.
- **Suggested alternative:** Export a single `EMPTY_GUIDANCE` constant from `promptBuilderBase.ts` and import it everywhere. It already exports other shared constants (`CLOSING_INSTRUCTION`, `REFERENCE_PREFIX`).

---

#### 4. Fragile string `.replace()` for multi-grid reference prompts

- **What:** The character prompt builder has a dedicated `buildGridFillPromptWithReference()` function that uses `.replace('your chroma-keyed, cell-labeled template is attached', 'IMAGE 2 is your chroma-keyed, cell-labeled template')`. The building, terrain, and background builders use a different approach in `promptForType.ts` via `.replace('The attached image is', 'IMAGE 2 is')`. If anyone edits the prompt template text and changes these exact substrings, the reference image injection silently fails (the original text stays, `.replace()` returns unchanged).
- **Where:** `src/lib/promptBuilder.ts:79-81` (character approach), `src/lib/promptForType.ts:77,91,106` (other types approach)
- **Why it matters:** Two different mechanisms for the same purpose. The character builder's replacement target ("your chroma-keyed, cell-labeled template is attached") is a 53-character phrase embedded in a whimsical paragraph. The other builders' target ("The attached image is") is a shorter phrase in a different style of prompt. If either prompt template is edited for wording improvements, the `.replace()` will silently no-op. No test validates that the replacement actually happens in the full prompt (the test at `promptBuilder.test.ts:146` only checks the output contains "IMAGE 2", not that the original phrase was removed).
- **Suggested alternative:** Use a placeholder token (e.g., `{{TEMPLATE_REFERENCE}}`) in all prompt templates, then replace it with either the single-image or multi-image phrasing. This makes the injection point explicit and grep-able.

---

#### 5. Massive duplicated accordion UI pattern across three components

- **What:** The group/cell guidance accordion pattern -- computing `groupedIndices`, filtering `ungrouped` cells, rendering `<details>` with group guidance textareas and per-cell textareas, computing `row`/`col` from `cellIdx / cols` -- is implemented three separate times with nearly identical logic in `LinkedGridPresets.tsx` (lines 146-232), `GridPresetsTab.tsx` (lines 418-495), and conceptually in `GenericPresetsTab.tsx` (lines 247-292 with the guidance-pairs pattern).
- **Where:** `src/components/admin/LinkedGridPresets.tsx:146-232`, `src/components/admin/GridPresetsTab.tsx:418-495`
- **Why it matters:** `LinkedGridPresets` and `GridPresetsTab` have ~80 lines of structurally identical JSX with minor differences (one reads from `link.linkGuidance` and calls `updateGuidance()` on blur; the other reads from `editing.cellGuidance` and calls `setEditing()`). Bugs fixed in one will not propagate to the other. The IIFE pattern `{(() => { ... })()}` used to introduce local variables inside JSX is also unusual enough that a new developer will pause to understand it.
- **Suggested alternative:** Extract a `GuidanceAccordion` component that accepts `cellGroups`, `cellLabels`, `cols`, `guidanceValues`, and an `onChange` callback. This eliminates ~80 lines per consumer and makes the pattern testable in isolation.

---

#### 6. `decomposeGuidanceBlob` regex is tightly coupled to seed format with no documentation of format rules

- **What:** The parser uses `cellHeaderRegex = /^ {1,8}Header\s+"([^"]+)"\s+\(\d+,\d+\)\s*:\s*(.*)/` and relies on continuation lines having 4+ space indent. This format is not documented anywhere except in the JSDoc on the function itself. The seed files contain hand-written blobs in this format.
- **Where:** `server/db/seeds/decomposeGuidance.js:23` (regex), `server/db/seeds/gridPresets.js:44-158` (rpgFullGuidance blob), `server/db/seeds/characterPresets.js` (per-character blobs)
- **Why it matters:** A new developer editing seed data must reverse-engineer the format from the regex. The format has implicit rules: exactly 1-8 leading spaces before "Header", continuation lines need 4+ spaces, lines without these patterns become "overall" guidance. If a seed contributor uses tabs, or uses 9 spaces, or formats the header slightly differently, the parser silently drops that cell into the "overall" bucket. The `RPG_FULL_RENAME` map is also implicit knowledge -- it exists because the seed data was written with old label names ("Cast 1", "Weak Pose") that were later renamed, but this history is only documented via the map's JSDoc, not in the seed data itself.
- **Suggested alternative:** Either (a) document the blob format in a comment block at the top of `decomposeGuidance.js` with examples of correct and incorrect formatting, or (b) stop using the blob format entirely and write seeds directly as `{ overall, groups, cells }` objects (the decomposed format). The blob format is a migration artifact; new seeds should use structured data directly.

---

#### 7. `presetTables.js` column config uses positional arrays instead of named fields

- **What:** Each column entry is `[bodyField, dbColumn, default, json?]` -- a 3-4 element tuple where the meaning of each position is undocumented. The `extractPresetValues` and `mapPresetRow` utilities destructure these positionally: `columns.map(([bodyField, , defaultVal, isJson]) => ...)`.
- **Where:** `server/presetTables.js:1-47`, `server/utils.js:9-14` (extractPresetValues), `server/utils.js:18-26` (mapPresetRow)
- **Why it matters:** Adding a new column property (e.g., "required", "maxLength", "validate") means extending the positional array, which is error-prone and unreadable. A new developer must trace from `presetTables.js` to `utils.js` to understand what position 3 means. The `true` at position 4 meaning "this is JSON" is particularly opaque.
- **Suggested alternative:** Use objects: `{ body: 'colorNotes', db: 'color_notes', default: '', json: false }`. This is self-documenting and extensible.

---

#### 8. Prompt preview in UnifiedConfigPanel is asymmetric across sprite types

- **What:** The character prompt preview (lines 297-325) uses real preset data and grid link data from the selected state. The building/terrain/background prompt previews (lines 260-295) use `EMPTY_GUIDANCE` three times and empty `cellGroups`, meaning they never show any guidance content in the preview. They also ignore the selected grid link entirely and fall back to `getBuildingGridConfig()` etc. from local state.
- **Where:** `src/components/config/UnifiedConfigPanel.tsx:257-330`
- **Why it matters:** For characters, the prompt preview is a faithful representation of what will be sent to Gemini. For all other sprite types, it is misleading -- it shows the prompt without any of the hierarchical guidance that will actually be included at generation time. A user tuning building guidance in the admin panel will not see their changes reflected in the preview.
- **Suggested alternative:** Apply the same pattern used for character to all types: when a preset and grid link are selected, construct the full `presetGuidance` and use the grid link's `gridGuidance`/`linkGuidance` in the preview.

---

#### 9. No validation that cell guidance keys match actual cell labels

- **What:** `HierarchicalGuidance.cells` is `Record<string, string>` keyed by label name. When the admin UI allows free-form key entry (the `guidance-pairs` field type in `GenericPresetsTab.tsx`), there is no validation that the entered key matches an actual cell label in any linked grid. Similarly, `buildGuidanceBlock` silently ignores guidance entries whose keys don't match any label in `cellLabels`.
- **Where:** `src/components/admin/GenericPresetsTab.tsx:247-292` (free-form key input), `src/lib/promptBuilderBase.ts:55-59` (lookup by label)
- **Why it matters:** A user can type "Walk Donw 1" (typo) as a cell guidance key and the guidance will be saved but never appear in the prompt. There is no feedback that the key is orphaned. Over time, presets accumulate dead guidance entries with no visible effect.
- **Suggested alternative:** When the preset has linked grids, validate guidance keys against the union of all linked grid cell labels. Show a warning for unmatched keys. Optionally, offer an autocomplete dropdown of valid labels when adding guidance entries.

---

#### 10. The `_rows` parameter in `buildGridFillPrompt` signals dead code path

- **What:** `buildGridFillPrompt` accepts `_rows: number` (underscore-prefixed, meaning unused). `buildGridFillPromptWithReference` passes `rows` to it. The building/terrain/background builders all accept and use `rows`. The character builder ignores it because its prompt template does not reference grid dimensions.
- **Where:** `src/lib/promptBuilder.ts:29` (`_rows` parameter)
- **Why it matters:** Minor, but symptomatic: the character prompt is the only one with the whimsical "Greetings, expert sprite designer!" style and the only one that does not state the grid dimensions in the prompt. This asymmetry means the character builder is structurally different from the other three, which all share a common opening paragraph. A new developer extending the system must understand that character prompts work differently.
- **Suggested alternative:** Either use `rows` (include grid dimensions in the character prompt as the other builders do) or remove it from the signature. If the whimsical style is intentional and the character prompt is deliberately different, document this design decision.

---

### Summary

The hierarchical guidance migration successfully introduced a clean data model (`HierarchicalGuidance` with overall/groups/cells) and a solid composition function (`buildGuidanceBlock`), but the migration was applied unevenly. The new model is fully wired through the server, admin UI, and prompt builders, while the client-side type definitions, reducer actions, state shape, and `loadGeneration` path still carry the old flat-guidance naming. This creates a two-layer system where the working code and the TypeScript types tell different stories. A new developer would spend significant time reconciling these layers. The most impactful improvements would be: completing the type renames to eliminate the old naming layer, extracting the duplicated accordion UI into a shared component, and replacing the fragile `.replace()` approach to reference image injection with explicit template tokens.
