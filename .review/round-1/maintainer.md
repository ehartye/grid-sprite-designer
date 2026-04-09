# Round 1: Maintainer Perspective

Reviewed as: a new developer who has never seen this codebase, encountering it for the first time six months from now.

## Analytical Approach

For each component I asked: can I understand what it does and why without asking the author? I traced coupling paths, identified implicit knowledge, and looked for patterns that accumulate tech debt.

---

## Findings

---

### Finding 1: SpriteReview is a 684-line god component with deeply entangled state

- **What:** `SpriteReview.tsx` manages 15+ pieces of local state, 7 custom hooks, 3 interlinked useEffect chains for settings load/save/processing, inline async logic, and renders the entire review experience. The settings load/save cycle (lines 200-343) uses a `skipNextSaveRef` guard to prevent the save effect from immediately echoing back loaded values -- a correctness hack around the fact that loading and saving share overlapping dependency graphs.
- **Where:** `src/components/grid/SpriteReview.tsx` (entire file, especially lines 93-343)
- **Why it matters:** Adding any new post-processing setting requires updating: (1) `PostProcessingState` type + reducer, (2) the save effect's ~30-item dependency array (line 198/343), (3) the load-then-restore Promise chain, (4) the `EditorSettings` interface, (5) the `RESTORE` action handler. Missing any one silently breaks persistence. The dependency array on line 343 is a maintenance landmine. A new developer cannot understand what triggers what without tracing every dependency.
- **Confidence:** High
- **Suggested alternative:** Extract a `useReviewSettings` hook that encapsulates the load/save/restore cycle, exposing a single `settings` object + `updateSetting` function. The hook internally manages the skip-after-load guard. This collapses 3 effects into 1 hook with a clean API.

---

### Finding 2: Duplicated save-to-history-then-archive pipeline

- **What:** The full "save history -> save sprites -> archive" sequence is implemented in both `runGeneratePipeline` (useGenericWorkflow.ts:159-248) and `useRegenerateWithFeedback` (lines 139-208). The two implementations have subtle differences: the archive payload in regenerate omits `poseId`, and error handling paths differ.
- **Where:** `src/hooks/useGenericWorkflow.ts:159-248` and `src/hooks/useRegenerateWithFeedback.ts:139-208`
- **Why it matters:** When the history/archive API changes, both must be updated in lockstep. The `poseId` omission in regenerate's archive call is likely a bug. A developer adding a field to the history POST body must find and update two locations with no compiler help.
- **Confidence:** High
- **Suggested alternative:** Extract `saveGenerationResult(params)` that handles history POST + sprite POST + archive POST. Both `runGeneratePipeline` and `useRegenerateWithFeedback` delegate to it.

---

### Finding 3: `useRegenerateWithFeedback` has a content-name fallback that only covers 2 of 4 sprite types

- **What:** Lines 127-135 build `contentName` using `WORKFLOW_CONFIGS[spriteType].getContent(currentState)` as a fallback, which is correct. But the function also fetches the preset to get an authoritative name. The issue is subtler: when `contentPresetId` is null (legacy entries), the fallback reads from `state.character` or `state.building` etc., but for a restored generation, these state slices may contain stale data from a different sprite type because `loadGenerationIntoState` only sets the matching type's state slice.
- **Where:** `src/hooks/useRegenerateWithFeedback.ts:127-135`
- **Why it matters:** Regenerating a terrain sheet loaded from gallery may use stale character data for the content name if the character state slice wasn't cleared.
- **Confidence:** Medium
- **Suggested alternative:** Always require `contentPresetId` for regeneration, or store content name/description directly on the history record and read it from there.

---

### Finding 4: Per-type table multiplication creates N*M schema coupling

- **What:** 4 preset tables + 4 link tables with near-identical schemas. Migration 018 is a 30-line multi-ALTER touching all 8 tables. Schema.js has 4 near-identical CREATE TABLE blocks for presets and 4 for links.
- **Where:** `server/db/schema.js:67-202`, `server/db/migrations.js` (migration 018)
- **Why it matters:** Adding a new sprite type requires: 2 new DB tables, schema.js update, PRESET_TABLES entry, seed file, migration. Adding a shared column requires 4 ALTER statements. Migration 018 demonstrates the pain already. The `PRESET_TABLES` abstraction in `presetTables.js` is good but only helps at the API layer, not at schema evolution time.
- **Confidence:** High
- **Suggested alternative:** Consolidate into `content_presets` (with `sprite_type` discriminator + JSON `type_fields` for type-specific data) and `content_grid_links`. The PRESET_TABLES config already abstracts per-type differences at the API layer; push that abstraction into the DB.

---

### Finding 5: AppState is a monolithic bag mixing ephemeral UI state with persistent domain data

- **What:** `AppState` (AppContext.tsx:116-230) holds everything in a single flat object: ephemeral workflow state (`step`, `status`, `error`, `templateImage`), domain model data (presets, grid configs), generation results (`filledGridImage`, `sprites`), and session metadata (`historyId`). `useAppState()` returns the entire object, so any state change re-renders every consumer.
- **Where:** `src/context/AppContext.tsx:116-230`
- **Why it matters:** Every `SET_STATUS` dispatch re-renders components that only care about presets. Every preset load re-renders the review panel. `RESTORE_SESSION` uses conditional spreads that silently leave stale data if a type is forgotten. A new developer calling `useAppState()` gets no hint which fields are relevant.
- **Confidence:** Medium (functional today, worsens with scale)
- **Suggested alternative:** Split into `WorkflowContext` (step, status, generation results), `PresetContext` (preset arrays), and `SessionContext` (historyId, source context). Components subscribe to only what they need.

---

### Finding 6: Base64 image data stored as TEXT in SQLite with no separation of concerns

- **What:** `generations.filled_grid_image` and `sprites.image_data` store full base64 images as TEXT. A 4K grid is ~5-15MB of base64 per row. The gallery endpoint runs a correlated subquery pulling sprite image data for every row. The history GET endpoint always returns the full `filled_grid_image`.
- **Where:** `server/db/schema.js:13,38`, `server/routes/gallery.js:31-34`, `server/routes/history.js:48-56`
- **Why it matters:** CLAUDE.md already warns "rows can be large." As the gallery grows, queries slow. There's no way to fetch history metadata without also transferring the multi-MB image. The output/ archive directory already exists for disk-based storage but isn't used as the primary source.
- **Confidence:** High
- **Suggested alternative:** Store images on disk and keep paths in DB. Or split history GET into a metadata endpoint and a separate image endpoint. Ensure gallery queries never touch `filled_grid_image`.

---

### Finding 7: Schema and migrations must be kept in sync manually with no automated verification

- **What:** `schema.js` defines full tables for new DBs, `migrations.js` defines incremental changes for existing ones. They must produce identical schemas. The error-swallowing in `migrateSchema` (lines 222-231) catches `duplicate column` and `already exists` errors and silently records migrations as applied.
- **Where:** `server/db/schema.js` and `server/db/migrations.js:192-255`
- **Why it matters:** Drift between schema.js and the migration chain is invisible. Migration 011 renames `character_name` to `content_name`, but schema.js creates columns as `content_name` from the start, so on a fresh DB the migration is silently skipped. A developer adding a column must update both files and manually verify consistency.
- **Confidence:** High
- **Suggested alternative:** Add a test that creates a fresh DB via schema.js and another via empty DB + all migrations, then compares `PRAGMA table_info` for every table. This catches drift immediately.

---

### Finding 8: No TypeScript on the server side

- **What:** The entire `server/` directory is plain JavaScript with no type annotations and minimal JSDoc. Function signatures like `createHistoryRouter(db)`, `extractPresetValues(body, columns)` provide no contract about inputs or outputs.
- **Where:** All files in `server/`
- **Why it matters:** The frontend has good TypeScript coverage with explicit API types (`types/api.ts`), but the server producing those responses has zero type safety. When the API contract changes, there's no compiler to catch mismatches between what the server sends and what `HistoryResponse` expects. A new developer must read implementations to understand data shapes.
- **Confidence:** High
- **Suggested alternative:** Migrate incrementally to TypeScript, starting with `utils.ts` and `presetTables.ts` that define core data shapes. At minimum, add JSDoc to exported functions.

---

### Finding 9: `setTimeout(r, 0)` state propagation hack in SpriteReview

- **What:** Line 489 uses `await new Promise(r => setTimeout(r, 0))` between dispatching model/imageSize/thinkingLevel updates and calling `regenerate()`. Comment: "Allow dispatches to propagate to stateRef in the hook."
- **Where:** `src/components/grid/SpriteReview.tsx:489`
- **Why it matters:** This is a timing hack that relies on React 18's batch update behavior. A new developer cannot understand why this exists or what breaks without it. It indicates the regeneration hook reads settings from global state via `stateRef` instead of accepting them as parameters.
- **Confidence:** High
- **Suggested alternative:** Pass model, imageSize, and thinkingLevel directly as fields in `RegenerateOptions` instead of dispatching to global state and waiting for propagation. The interface already accepts `imageSize` -- extend it.

---

### Finding 10: Gallery grouping is client-side only, inconsistent across pages

- **What:** Gallery grouping (GalleryPage.tsx:49-88) groups entries by `groupId` or `contentName` on the current page only. A group spanning two pages appears as separate partial groups on each.
- **Where:** `src/components/gallery/GalleryPage.tsx:49-88`, `server/routes/gallery.js`
- **Why it matters:** As the gallery grows and users generate many sheets per character, pagination splits groups unpredictably. The server query returns flat rows with no group awareness.
- **Confidence:** Medium
- **Suggested alternative:** Server-side grouping: a `GROUP BY group_id` query returning group metadata, with entries fetched on expand. Or at minimum, a `group_id`-stable pagination that keeps groups together.

---

### Finding 11: Hardcoded 6x6 character defaults scattered across multiple files

- **What:** The 6-column, 6-row, 36-cell character grid default appears as magic numbers in at least 5 files: `SpriteReview.tsx:50-52` (`isCharacter ? 6 : undefined`), `loadGeneration.ts:119-127` (default `gridCols = 6`), `useGridWorkflow.ts:39` (6x6 null check). The `CHARACTER_GRID` constant exists but isn't used consistently.
- **Where:** `src/components/grid/SpriteReview.tsx:50-52`, `src/lib/loadGeneration.ts:119-127`, `src/hooks/useGridWorkflow.ts:39`
- **Why it matters:** If the default character grid changes, a developer must find and update all scattered `6` literals. Missing one causes silent extraction or display bugs.
- **Confidence:** Medium
- **Suggested alternative:** All fallback logic should reference `CHARACTER_GRID.cols`/`CHARACTER_GRID.rows` from `gridConfig.ts`.

---

### Finding 12: `ContentPreset` is an untyped superset bag that defeats type safety

- **What:** `ContentPreset` in `types/api.ts:55-78` is a flat interface where every type-specific field is optional. No discriminator. Code relies on `contentPreset.equipment || ''` by convention. Meanwhile, `AppContext.tsx` correctly uses `AnyPreset` as a discriminated union.
- **Where:** `src/types/api.ts:55-78`
- **Why it matters:** Adding a terrain-specific field gets no compile-time guidance. The two type systems (discriminated union in context vs flat superset in API) create confusion about which to use.
- **Confidence:** Medium
- **Suggested alternative:** Use `AnyPreset` as the canonical type. Validate and narrow the API response in `fetchContentPreset`.

---

## Summary

The codebase has solid architectural bones -- `useGenericWorkflow` + `runGeneratePipeline` is well-designed, `WORKFLOW_CONFIGS` correctly centralizes per-type behavior, and `presetTables.js` is a clean data-driven server abstraction. The three biggest maintainability risks are: (1) SpriteReview's entangled state management, where the settings persistence lifecycle is one refactor away from breaking; (2) the duplicated save pipeline between `runGeneratePipeline` and `useRegenerateWithFeedback`, which will drift over time; and (3) implicit knowledge dependencies (the setTimeout hack, manual schema-migration sync, scattered magic numbers) that a newcomer would struggle to discover without the original author's guidance.
