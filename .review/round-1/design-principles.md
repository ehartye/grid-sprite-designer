# Design Principles Review - Round 1

## Findings

### Finding 1: Duplicated save-to-history + archive logic across generation flows

**What:** The "save to history, save sprites, archive to disk" sequence is implemented in full in both `runGeneratePipeline()` (`useGenericWorkflow.ts:158-248`) and `useRegenerateWithFeedback.ts:139-208`. Both flows construct the same payload structure, POST to `/api/history`, POST sprites to `/api/history/:id/sprites`, and POST to `/api/archive`. The regeneration hook duplicates ~70 lines of nearly identical fetch-dispatch-error-handling logic.

**Where:**
- `src/hooks/useGenericWorkflow.ts` lines 158-248 (primary pipeline)
- `src/hooks/useRegenerateWithFeedback.ts` lines 139-208 (regeneration pipeline)

**Why this matters:** DRY violation with observable drift. The regeneration hook already diverges: it omits the `poseId` field in the archive sprite payload and has different error handling behavior. On extraction failure, `runGeneratePipeline` dispatches both `EXTRACTION_COMPLETE` with empty sprites (transitioning to review) and `SET_STATUS`, while `useRegenerateWithFeedback` only dispatches `SET_STATUS` -- leaving the UI in a different state after extraction failure depending on which path triggered it. If the save/archive protocol changes (e.g., adding a new field, changing error handling), both locations must be updated in lockstep, and the divergence proves this isn't happening reliably.

**Confidence:** High

**Alternative:** Extract a `saveGenerationResult(params, dispatch, signal)` function that encapsulates the history-save + sprite-save + archive sequence. Both `runGeneratePipeline` and `useRegenerateWithFeedback` would call it. The regeneration hook would call `editGrid` then hand off to the shared save function with additional version/parent fields.

---

### Finding 2: Parallel prompt-building paths with asymmetric reference handling

**What:** There are two independent paths for building prompts:
1. **Single-generate path:** `useGridWorkflow.ts` / `useBuildingWorkflow.ts` / etc. each directly call their respective prompt builder via the `WorkflowConfig.buildPrompt` callback, reading from `AppState`.
2. **Run/add-sheet path:** `promptForType.ts:buildPromptForType()` reconstructs the same per-type dispatch with its own switch statement, reading from a `ContentPreset` API response.

The guidance assembly pattern (`{ overall: X.overallGuidance, groups: X.groupGuidance, cells: X.cellGuidance }`) is duplicated 8 times across these two paths. More critically, the reference-image prefix injection differs by type: character has a clean `buildGridFillPromptWithReference` function, while building/terrain/background use a fragile string replacement (`prompt.replace('The attached image is', 'IMAGE 2 is')` in `promptForType.ts:79,93,108`).

**Where:**
- Single-generate configs: `src/hooks/useGridWorkflow.ts:20-35`, `useBuildingWorkflow.ts:16-37`, etc.
- Run/add-sheet dispatch: `src/lib/promptForType.ts:25-119`
- Reference prefix hack: `src/lib/promptForType.ts:79,93,108`

**Why this matters:** Open/Closed Principle violation. Adding a new sprite type requires touching both the workflow config file AND `promptForType.ts`. The `.replace()` hack for reference prefix injection is fragile -- if any prompt builder rephrases "The attached image is", the replacement silently becomes a no-op and the multi-grid reference instructions vanish without error. The single-generate path reads `styleNotes` from state; the run/add-sheet path hardcodes `styleNotes: ''`, meaning the same content generates different prompts depending on which flow is used.

**Confidence:** High

**Alternative:** Each prompt builder should have a `withReference` variant (following the character pattern), or `buildPromptForType` should become the single entry point used by ALL flows including single-generate. The `buildPrompt` callback in `WorkflowConfig` could delegate to `buildPromptForType` to eliminate the parallel path.

---

### Finding 3: SpriteReview component remains a God Object despite modularization

**What:** `SpriteReview.tsx` is a 684-line component that orchestrates: grid display, sprite selection/swap/mirror/zoom, chroma key processing, posterization, color striking, pixelization, outlining, alpha snapping, erasure, animation preview, palette detection, feedback state, regeneration triggering, version chain navigation, editor settings save/load, export (sheet and individual), add-sheet modal, and thumbnail management. It manages 15+ `useState` calls, 5+ custom hooks, and 3+ `useEffect` chains with massive dependency arrays.

**Where:** `src/components/grid/SpriteReview.tsx` (entire file)

**Why this matters:** Single Responsibility violation. The component has too many reasons to change. The settings persistence lifecycle (lines 200-343) is 135 lines with a fragile `skipNextSaveRef` pattern to prevent restored values from echo-writing back to the DB -- this temporal coupling with React's render cycle is a code smell indicating the logic wants to be its own hook. The 25+ item dependency array at line 343 for the save effect is a maintenance hazard. The processing pipeline effect (lines 156-198) has a similarly large dependency array. Adding any new persisted post-processing setting requires modifying both arrays.

**Confidence:** High. Recent modularization (PostProcessingSidebar, ReviewActions, SidebarGroup extraction) addressed the UI layer, but the state orchestration remains concentrated.

**Alternative:** Extract `useReviewPersistence(historyId, stateBundle)` to own the load/save lifecycle. Extract `useProcessingPipeline(sprites, processOptions)` for the processing effects. SpriteReview becomes a layout shell that wires sub-components to hooks.

---

### Finding 4: `ContentPreset` type is a loose superset rather than a discriminated union

**What:** `src/types/api.ts:55-78` defines `ContentPreset` as a single interface with all fields from all sprite types marked optional. Compare with `AppContext.tsx:74-99` which properly uses discriminated unions (`CharacterPreset | BuildingPreset | TerrainPreset | BackgroundPreset` via `AnyPreset`). The loose `ContentPreset` is used in `buildPromptForType`, `buildGenerationRequest`, and `useAddSheet` -- these functions access type-specific fields (e.g., `contentPreset.equipment`, `contentPreset.bgMode`) with `|| ''` fallbacks instead of compile-time safety.

**Where:** `src/types/api.ts:55-78`, consumed in `src/lib/promptForType.ts:47-109`

**Why this matters:** TypeScript can't catch cases where building-specific fields are accessed for a character preset. The `|| ''` fallbacks are band-aids for a type hole. If a new required field is added to one sprite type, the compiler won't flag callers that forget to handle it. The frontend state types already solved this correctly with `AnyPreset` -- the API types didn't follow suit.

**Confidence:** Medium -- runtime behavior is correct because switch-case guards access patterns, but the compile-time safety gap is real and could cause silent bugs during refactoring.

**Alternative:** Use the same discriminated union pattern from `AppContext.tsx` for the API preset type, or use mapped types: `PresetForType<T extends SpriteType>` to enforce type-correct field access.

---

### Finding 5: Well-designed Strategy Pattern in useGenericWorkflow (positive)

**What:** The `useGenericWorkflow` hook implements a clean Strategy Pattern via `WorkflowConfig`. Each sprite type provides a small config object (`getContent`, `buildGridConfig`, `buildPrompt`, `getReExtractGridConfig`) while the generic hook owns the shared pipeline logic. The per-type workflow files are thin ~45-line wrappers. The `WORKFLOW_CONFIGS` map at line 404 enables runtime lookup by sprite type.

**Where:** `src/hooks/useGenericWorkflow.ts` (WorkflowConfig interface + hook), per-type configs

**Why this matters (positively):** Textbook application of the Open/Closed Principle. Adding a new sprite type requires only creating a new config object and registering it in `WORKFLOW_CONFIGS`. The pipeline logic (`runGeneratePipeline`) is reused across single-generate, add-sheet, and multi-grid-run flows. The separation of strategy (what to generate) from mechanism (how to generate) is clean.

**Confidence:** High

**Alternative:** N/A -- positive finding. The pattern should be extended to resolve Finding 2.

---

### Finding 6: Data-driven preset table configuration eliminates server duplication (positive)

**What:** `server/presetTables.js` defines a `PRESET_TABLES` configuration object that drives all CRUD operations in `server/routes/presets.js`. Column definitions, table names, link tables, and foreign keys are all declarative. `extractPresetValues`, `mapPresetRow`, and the route handlers are type-agnostic.

**Where:** `server/presetTables.js`, `server/routes/presets.js`, `server/utils.js`

**Why this matters (positively):** Excellent DRY application. Adding a new sprite type's preset CRUD requires only a `PRESET_TABLES` entry and a DB table. No new route files or handler functions. The `validatePresetType` middleware gates access cleanly. The `UnifiedConfigPanel` on the frontend mirrors this data-driven approach with its `SPRITE_TYPE_CONFIGS` map.

**Confidence:** High

**Alternative:** N/A -- positive finding. Good model for other areas of the codebase.

---

### Finding 7: Tight coupling between generation flows and raw fetch() calls

**What:** All three generation flows (`runGeneratePipeline`, `useRegenerateWithFeedback`, `useAddSheet`) directly call `fetch()` for history saving, sprite saving, archive saving, group backfilling, and content preset fetching. There is no API client layer for internal backend endpoints. The Gemini API has a proper client (`src/api/geminiClient.ts`), but the history/preset/archive APIs are called with raw fetch scattered throughout hooks and components.

**Where:**
- `src/hooks/useGenericWorkflow.ts` lines 168-246
- `src/hooks/useRegenerateWithFeedback.ts` lines 54-208
- `src/hooks/useAddSheet.ts` lines 84-94
- `src/components/grid/SpriteReview.tsx` lines 72-79, 289-301, 431-438, 469-472

**Why this matters:** Dependency Inversion violation. The high-level business logic depends directly on low-level transport details (URL construction, headers, JSON parsing). If the API shape changes (field rename, new required header, authentication), every raw fetch call site must be updated. The Gemini client demonstrates the right pattern -- `generateGrid()` and `editGrid()` abstract the transport -- but it wasn't applied to the internal API.

**Confidence:** Medium-High. Manageable at current scale but creates friction for API evolution.

**Alternative:** Create `api/historyClient.ts` and `api/presetsClient.ts` alongside `geminiClient.ts`. Each would export typed functions like `saveGeneration(params)`, `saveSprites(historyId, sprites)`, `archiveGeneration(params)`. This also enables Finding 1's refactoring more cleanly.

---

### Finding 8: loadGenerationIntoState contains redundant type-branching logic

**What:** `src/lib/loadGeneration.ts:50-163` has two branching sections that mirror each other. Lines 50-111 construct `character`/`building`/`terrain`/`background` state objects from a `HistoryResponse`. Lines 140-163 construct extraction config overrides by checking `gridSize in *_GRIDS` for each type and calling the corresponding `get*GridConfig`. Each branch constructs nearly identical objects with the same shared fields (name, description, colorNotes, styleNotes, overallGuidance, groupGuidance, cellGuidance).

**Where:** `src/lib/loadGeneration.ts:50-163`

**Why this matters:** Adding a new sprite type requires adding branches in both sections. The repeated shared-fields-plus-type-extensions pattern is a textbook case for a registry approach -- similar to `PRESET_TABLES` on the server or `SPRITE_TYPE_CONFIGS` in `UnifiedConfigPanel`.

**Confidence:** Medium

**Alternative:** Create a `LOAD_CONFIG` registry mapping sprite type to its grid map, config builder function, and default state shape. `loadGenerationIntoState` would do a registry lookup instead of a switch chain.

---

### Finding 9: AppState mixes persistent domain data with transient workflow state

**What:** `AppState` (lines 116-230) combines: persistent domain data (preset arrays, grid presets), generation results (filledGridImage, sprites, historyId), transient UI state (step, status, error, statusType), and workflow orchestration (run state, templateImage). The `RESET` action (line 586-596) must explicitly preserve 5 preset arrays while clearing everything else -- a new preset type being forgotten here would cause data loss.

**Where:** `src/context/AppContext.tsx:116-230`, `586-596`

**Why this matters:** Conceptual coupling. Presets change rarely; status messages change per-interaction. Every `SET_STATUS` dispatch causes re-renders for all `useAppState()` consumers. The `RESET` preservation list is error-prone. The separate `AppStateContext`/`AppDispatchContext` split helps with dispatch stability but doesn't address the re-render coupling.

**Confidence:** Medium -- performance impact is likely negligible for this app, but the conceptual coupling makes the state harder to evolve safely.

**Alternative:** Split into `PresetsContext` (preset arrays, grid presets) and `WorkflowContext` (generation state, sprites, step, run, status). `RESET` trivially resets just the workflow context. Preset loading becomes independent of workflow lifecycle.

---

### Finding 10: Clean server architecture with dependency injection (positive)

**What:** The server follows a well-structured pattern: `index.js` handles Express setup and route mounting; each route module is a factory function that receives dependencies (`db`, `apiKey`, `outputDir`) via parameters; the DB layer handles schema/migration/seeding on startup. Rate limiting is applied at the route level. The generate route cleanly separates validation helpers, request builders, and response handlers.

**Where:** `server/` directory structure

**Why this matters (positively):** Dependencies flow inward via function parameters rather than module-level singletons, making routes testable. The factory pattern (`createGenerateRouter(apiKey)`, `createHistoryRouter(db)`) is consistent across all routes. The separation between schema definition (`schema.js`), migrations (`migrations.js`), and seeds (`seeds/`) follows Single Responsibility.

**Confidence:** High

**Alternative:** N/A -- positive finding.

---

## Summary

**Strengths:**
- The Strategy Pattern in `useGenericWorkflow` / `WORKFLOW_CONFIGS` is a textbook application of Open/Closed Principle
- The data-driven `PRESET_TABLES` and `SPRITE_TYPE_CONFIGS` maps eliminate type-specific CRUD/UI duplication
- Server architecture has clean dependency injection via factory functions
- The hierarchical guidance system (`buildGuidanceBlock`) handles 3-level merge (grid -> link -> preset) in a single well-tested function
- Prompt builder base extracts shared constants effectively

**Key Concerns (ranked by impact):**
1. **DRY violation in save/archive logic** (Finding 1) -- highest impact. The regeneration hook duplicates the history-save pipeline with observable drift in extraction error handling and archive payload shapes. This is the most likely source of future bugs.
2. **Parallel prompt-building paths** (Finding 2) -- the `.replace()` hack for reference prefix is the most fragile point in the codebase. If any prompt template wording changes, multi-grid reference instructions silently vanish.
3. **SpriteReview God Object** (Finding 3) -- the settings persistence lifecycle and processing pipeline effects are strong candidates for hook extraction. The 25+ item dependency arrays are maintenance hazards.
4. **Missing API client layer** (Finding 7) -- raw fetch calls scatter transport details through business logic. The existing `geminiClient.ts` demonstrates the right pattern.

**Change Impact Assessment:**
- *Adding a new sprite type:* 5-7 files need changes. The `WORKFLOW_CONFIGS` + `PRESET_TABLES` + `SPRITE_TYPE_CONFIGS` registries make the workflow/CRUD/UI additions clean. The pain points are `promptForType.ts` (switch statement), `loadGeneration.ts` (two branch sections), and `AppContext.tsx` (state/actions/reducer).
- *Adding a new post-processing effect:* `usePostProcessingState.ts`, `spriteProcessor.ts`, `SpriteReview.tsx` (two massive effect dependency arrays), `PostProcessingSidebar.tsx`. The SpriteReview dependency arrays are the riskiest touch point.
- *Changing the history API shape:* Every hook with raw fetch calls needs updating. This is the scenario most improved by an API client layer.
