# Synthesis Report: Hierarchical Guidance Migration

---

## Independent Findings (Round 1)

### Consensus Concerns

These issues were flagged independently by 2+ perspectives with no cross-contamination, giving them the highest confidence.

---

#### 1. Frontend types and reducer still use old guidance field names -- data silently dropped on preset load

**Flagged by:** Data Integrity (F1), Maintainer (F1), Conventions (F2, F3)

- **Data Integrity** identified this as a **runtime data loss bug**: the reducer reads `action.preset.rowGuidance` which resolves to `undefined` because the API now returns `overallGuidance` from `mapPresetRow`. All guidance data is silently dropped when a preset is loaded into state.
- **Maintainer** described it as "a parallel naming universe" where old types (`rowGuidance`, `cellGuidance` as string, `tileGuidance`, `layerGuidance`) and new types (`overallGuidance`, `groupGuidance`, `cellGuidance` as `Record<string,string>`) coexist, making the codebase confusing and fragile.
- **Conventions** flagged `rowGuidance` as a dead field and `cellGuidance` as a naming collision (string in `AppState` vs. `Record<string,string>` in `ContentPreset`), defeating TypeScript's ability to catch cross-type misuse.

**Synthesized concern:** The `CharacterPreset`, `BuildingPreset`, `TerrainPreset`, and `BackgroundPreset` interfaces in `AppContext.tsx` and the corresponding reducer cases reference field names the API no longer returns. Guidance data is silently discarded at the reducer boundary. The generation pipeline is accidentally unaffected (it fetches `ContentPreset` directly from the API, bypassing AppState), but the config panel prompt preview, session restore (`loadGeneration.ts`), and UI state all lack guidance data. This is the highest-priority issue in the changeset.

**Key files:** `src/context/AppContext.tsx:62-105,441-505`, `src/lib/loadGeneration.ts:54-102`, `src/components/config/UnifiedConfigPanel.tsx:80,103,126,147`, `src/types/api.ts:18-25`

---

#### 2. Two incompatible preset type systems coexist (`CharacterPreset` et al. vs. `ContentPreset`)

**Flagged by:** Maintainer (F2), Conventions (F4, F10), Data Integrity (F10)

- **Maintainer** noted that per-type interfaces (old shape) and `ContentPreset` (new shape) coexist with an `as ContentPreset` cast at `UnifiedConfigPanel.tsx:297` bridging them unsafely.
- **Conventions** flagged the pervasive `as any` casts (12 instances in `UnifiedConfigPanel`) and the `Record<string, unknown>` typing in `GenericPresetsTab` as symptoms of the missing type unification.
- **Data Integrity** noted `ContentPreset` is a loose superset with all fields optional and no discriminated union, providing no protection against cross-type confusion.

**Synthesized concern:** There is no single source of truth for the shape of a preset. The type system cannot prevent passing a building preset where a character preset is expected. The `as any` and `as ContentPreset` casts are duct tape over a structural gap. A discriminated union on `spriteType` would unify both type hierarchies and eliminate the cast layer.

---

#### 3. IIFE-in-JSX pattern and triplicated group/cell guidance accordion UI

**Flagged by:** Maintainer (F5), Conventions (F1, F12)

- **Maintainer** identified ~80 lines of structurally identical JSX in `LinkedGridPresets.tsx` and `GridPresetsTab.tsx` (grouping logic, ungrouped filter, accordion rendering) with minor callback differences.
- **Conventions** flagged the IIFE `(() => { ... })()` pattern as non-idiomatic React and noted the same logic appears a third time in `GenericPresetsTab.tsx`.

**Synthesized concern:** The group/cell guidance accordion is implemented three times with slight drift. The IIFE pattern makes each copy harder to read and impossible to memoize. Extracting a shared `<GuidanceAccordion>` component would eliminate ~160+ lines of duplication and prevent future drift.

**Key files:** `src/components/admin/LinkedGridPresets.tsx:146-232`, `src/components/admin/GridPresetsTab.tsx:418-495`, `src/components/admin/GenericPresetsTab.tsx:247-292`

---

#### 4. `decomposeGuidanceBlob` regex is fragile and undocumented; untyped JS produces `HierarchicalGuidance` shape

**Flagged by:** Maintainer (F6), Conventions (F11)

- **Maintainer** noted the parser regex is tightly coupled to a format documented nowhere except the JSDoc, with implicit rules (1-8 leading spaces, 4+ space continuation lines) that silently misclassify data on any deviation.
- **Conventions** noted the file is untyped JavaScript producing objects that must match the TypeScript `HierarchicalGuidance` interface, with no compile-time or runtime check ensuring they stay in sync.

**Synthesized concern:** The seed decomposition function is a critical data boundary with no type contract and a fragile parser. Misformatted seed blobs silently misroute guidance into the wrong bucket. New seeds should use structured objects directly rather than the blob format.

**Key file:** `server/db/seeds/decomposeGuidance.js`

---

#### 5. Unused `_rows` parameter in `buildGridFillPrompt`

**Flagged by:** Maintainer (F10), Conventions (F13)

- Both noted the underscore-prefixed unused parameter as a minor code smell indicating the character prompt builder is structurally different from the other three.

**Synthesized concern:** Low severity. Either use the parameter (include grid dimensions in the character prompt) or remove it. The asymmetry between the character builder and the other three should at minimum be documented.

**Key file:** `src/lib/promptBuilder.ts:28`

---

### Unique Findings

Findings caught by only one perspective, valuable because they required a specific analytical lens.

---

#### Data Integrity (unique)

- **F2: Migration 018 is non-atomic.** SQLite `db.exec()` with 27 DDL statements has no implicit transaction. A partial failure plus the "already applied" error-swallowing behavior can leave tables half-migrated permanently. (`server/db/migrations.js:41-88,110-124`)

- **F3: `INSERT OR IGNORE` seeds cannot refresh stale data.** Existing databases retain the old monolithic guidance blob (now sitting in the renamed `overall_guidance` column) with empty `group_guidance`/`cell_guidance`. Fresh databases get correctly decomposed data. No reconciliation mechanism exists. (All seed files)

- **F4: `extractPresetValues` uses `||` instead of `??`.** Empty strings, `0`, and `false` are treated as missing values and replaced with defaults. (`server/utils.js:10-14`)

- **F5: No JSON validation on storage boundary.** A single malformed JSON value in `group_guidance` or `cell_guidance` crashes all reads for that table via unguarded `JSON.parse`. (`server/utils.js:21`, `server/routes/presets.js`, `server/routes/gridPresets.js`)

- **F6: `HistoryResponse.content.rowGuidance` declared but never populated.** Dead type field suggesting session-restore was never fully connected to guidance. (`src/types/api.ts:18-25`, `src/lib/loadGeneration.ts:101`)

- **F7: Animation series seeds omit `group_guidance`/`cell_guidance` columns.** Inconsistent with other seeds that explicitly pass `'{}'`. (`server/db/seeds/animationSeries.js:12-13`)

- **F8: Grid preset seeds for building/terrain/background omit group/cell guidance.** Only character grid seeds include both columns explicitly. (`server/db/seeds/buildingPresets.js:543`, `terrainPresets.js:462`, `backgroundPresets.js:240`)

- **F9: No optimistic locking on grid link writes.** Concurrent edits silently overwrite each other. (`server/routes/gridLinks.js:15-24`)

---

#### Maintainer (unique)

- **F3: `EMPTY_GUIDANCE` sentinel duplicated 9 times.** The constant `{ overall: '', groups: {}, cells: {} }` is defined independently in 9 files despite being a natural export for `promptBuilderBase.ts`. (Multiple hooks and test files)

- **F4: Fragile string `.replace()` for reference image injection.** Two different replacement strategies (53-character phrase for character, shorter phrase for others) silently no-op if prompt wording changes. (`src/lib/promptBuilder.ts:79-81`, `src/lib/promptForType.ts:77,91,106`)

- **F7: `presetTables.js` column config uses positional arrays.** Meaning of each position is undocumented; extending the format is error-prone. (`server/presetTables.js:1-47`, `server/utils.js:9-14`)

- **F8: Prompt preview asymmetric across sprite types.** Character preview uses real guidance; building/terrain/background always pass `EMPTY_GUIDANCE`, making the preview misleading. (`src/components/config/UnifiedConfigPanel.tsx:257-330`)

- **F9: No validation that cell guidance keys match actual cell labels.** Typos in guidance keys are stored permanently but never surface in prompts. (`src/components/admin/GenericPresetsTab.tsx:247-292`, `src/lib/promptBuilderBase.ts:55-59`)

---

#### Conventions & Idioms (unique)

- **F5: `setCellGroupCells` has a stale closure risk.** `updateCellGroup` is not wrapped in `useCallback`, making the `useCallback` on `setCellGroupCells` effectively useless -- re-creates every render. (`src/components/admin/GridPresetsTab.tsx:165-182`)

- **F6: Inconsistent `confirm()` vs. `window.confirm()`.** Admin components use bare `confirm()`; main app uses `window.confirm()`. Can cause issues in testing environments. (Multiple files)

- **F7: `field-sizing: content` has limited browser support.** No Safari support; no fallback provided. (`src/styles/admin.css:200`)

- **F8: Redundant `as const` assertions on inline string literals.** May actually be necessary if `satisfies` is not used on the config object -- requires verification before removal. (`src/components/admin/GenericPresetsTab.tsx:43-86`)

- **F9: Inline styles mixed with CSS class system in admin components.** `LinkedGridPresets` uses inline styles for patterns that `GridPresetsTab` handles with CSS classes. (`src/components/admin/LinkedGridPresets.tsx`)

---

## Cross-Pollination Insights (Round 2)

### Tradeoff Tensions

These are genuine tradeoffs where perspectives explicitly disagree. They require the user's judgment.

---

#### Tension 1: "Dead field" vs. "Data loss bug" -- severity framing

- **Maintainer + Conventions** initially characterized the stale `rowGuidance`/`cellGuidance` fields as dead code or naming inconsistencies (maintenance concern, can wait).
- **Data Integrity** characterized them as a functional regression where guidance is silently dropped on every preset load (P0 bug, fix now).
- **Resolution in Round 2:** Both Maintainer and Conventions acknowledged in Round 2 that Data Integrity's framing is more accurate. However, the practical impact is scoped: the generation pipeline bypasses AppState entirely, so prompts sent to Gemini are correct. The regression affects UI display (prompt preview, config panel state, session restore), not generation quality.
- **User judgment needed:** Is the broken prompt preview / session restore path worth a P0 fix, or is it tolerable given that actual generation is unaffected?

---

#### Tension 2: Config-driven flexibility vs. type safety

- **Conventions** argues `GenericPresetsTab` should use typed generics instead of `Record<string, unknown>`.
- **Maintainer** argues `presetTables.js` should use named objects instead of positional arrays.
- **The tension:** Both the frontend and backend chose a data-driven approach to avoid per-type boilerplate. Making types stricter would partially undo the DRY benefit. The four sprite types share enough structure that config-driven is reasonable, but different enough that per-type code might actually be clearer.
- **User judgment needed:** Should the config-driven approach be preserved (and made type-safe with `satisfies`, discriminated unions, etc.), or are the four sprite types different enough to justify per-type components/routes?

---

#### Tension 3: Extracting shared `<GuidanceAccordion>` vs. component cohesion

- **All three perspectives** agree the triplicated accordion logic should be consolidated.
- **Conventions (Round 2)** notes the three consumers have genuinely different update mechanisms (API call on blur, local `setEditing`, generic `updateField` with `Record<string, unknown>`), so the shared component would need a complex callback interface.
- **User judgment needed:** Does extracting the component actually reduce complexity, or does it just move it into a complex `onChange` prop contract?

---

### Amplified Concerns

Round 1 findings that gained additional weight from cross-pollination.

---

#### Stale types -> runtime data loss (highest amplification)

All three perspectives escalated this in Round 2. Data Integrity's runtime trace convinced Maintainer and Conventions to reclassify from "confusing" to "broken." The nuance that the generation pipeline is accidentally resilient (because it bypasses AppState) was surfaced by the Maintainer and confirmed by Data Integrity in Round 2.

#### `cellGuidance` naming collision -> potential data corruption

Data Integrity (Round 2) traced the full consequence: passing `AppState.building.cellGuidance` (a string) into a function expecting `Record<string, string>` would produce `"\"some text\""` after `JSON.stringify`, which parses back as a bare string. `buildGuidanceBlock` would then get `undefined` for every label lookup. The naming collision is not just confusing -- it is a corruption vector.

#### `GenericPresetsTab` as `Record<string, unknown>` -> write-path integrity gap

Data Integrity (Round 2) noted this is the admin CRUD interface -- a write path to the database. Combined with `||` defaulting in `extractPresetValues`, a field typo in the admin config silently uses the default value, and the user's intended data is lost.

#### No JSON validation on storage boundary -> table-wide outages

Maintainer (Round 2) confirmed that an unguarded `JSON.parse` crashing on one corrupted row takes down all reads for that entire table, making the issue practically important for debugging.

---

### New Insights

These emerged only from cross-pollination and were not present in any Round 1 output.

---

#### 1. The generation pipeline is accidentally resilient (interaction-dependent)

Surfaced by Data Integrity reacting to Maintainer's Round 1 observation. The `promptForType.ts` path calls `fetchContentPreset` which uses `mapPresetRow` with correct columns, returning proper hierarchical guidance. AppState is never consulted for guidance during generation. This means the stale types cause UI degradation but NOT degraded prompts to Gemini. This significantly changes the severity assessment.

#### 2. `INSERT OR IGNORE` + label renames = compounding data divergence (interaction-dependent)

Surfaced by Data Integrity reacting to Maintainer F9 (orphaned guidance keys). On a migrated database: (1) migration renames columns but doesn't decompose the blob, (2) `INSERT OR IGNORE` skips re-seeding, (3) label renames orphan user-created guidance entries. Three sources of guidance key drift with no reconciliation mechanism.

#### 3. `presetTables.js` positional arrays are the root cause of end-to-end type safety loss (interaction-dependent)

Surfaced by Conventions reacting to Maintainer F7. The chain: positional arrays in `presetTables.js` -> positional destructuring in `utils.js` -> implicit field mapping -> frontend uses `Record<string, unknown>` because it cannot reference server column config -> type safety lost end-to-end. A shared named-object schema would fix both sides.

#### 4. Stale closure pattern is systemic, not isolated (interaction-dependent)

Surfaced by Maintainer reacting to Conventions F5. `LinkedGridPresets.tsx` has the same pattern where `setLinks(links.map(...))` captures `links` from the enclosing scope rather than using `prev => prev.map(...)`. This appears at lines 136, 166, 187, 218 -- a class of bug, not an isolated instance.

---

## Suggested Alternatives

Concrete alternative approaches surfaced across both rounds.

| # | Proposal | Proposed By | Problem Solved | Tradeoff Introduced |
|---|----------|-------------|----------------|---------------------|
| 1 | Update frontend interfaces and reducer to use `overallGuidance`, `groupGuidance: Record<string,string>`, `cellGuidance: Record<string,string>` | Data Integrity, Maintainer | Eliminates silent data loss on preset load; aligns UI state with API | Requires updating reducer, `loadGeneration.ts`, `UnifiedConfigPanel` defaults, and all consuming components |
| 2 | Create discriminated union `ContentPreset = CharacterContentPreset \| BuildingContentPreset \| ...` with `spriteType` discriminator | Data Integrity, Conventions | Eliminates cross-type confusion, removes need for `as any` casts, unifies the two type hierarchies | Adds per-type interface boilerplate; may conflict with config-driven `GenericPresetsTab` approach |
| 3 | Wrap migration 018 in explicit `BEGIN; ... COMMIT;` or split into per-table migrations | Data Integrity | Prevents half-migrated databases | Minor additional complexity in migration runner |
| 4 | Add post-migration data decomposition step for existing databases | Data Integrity | Eliminates fresh-vs-migrated database divergence | Requires a JS migration function calling `decomposeGuidanceBlob` on each existing row |
| 5 | Use `??` instead of `\|\|` in `extractPresetValues` | Data Integrity | Preserves empty strings and `0` values on PUT requests | None -- strictly better for this use case |
| 6 | Add `CHECK(json_valid(group_guidance))` constraints or wrap `JSON.parse` in try/catch | Data Integrity, Conventions | Prevents one corrupted row from crashing all reads | CHECK constraints require SQLite JSON1 extension (usually available); try/catch adds code at every parse site |
| 7 | Export `EMPTY_GUIDANCE` from `promptBuilderBase.ts` | Maintainer | Eliminates 9 duplicated constant definitions | Trivial change, no meaningful tradeoff |
| 8 | Use placeholder tokens (e.g., `{{TEMPLATE_REFERENCE}}`) instead of `.replace()` on prose | Maintainer, Conventions | Makes reference image injection explicit and grep-able; prevents silent failure on prompt wording changes | Requires updating all prompt templates |
| 9 | Replace positional arrays in `presetTables.js` with named objects | Maintainer, Conventions | Self-documenting config, extensible, enables shared type contracts | Requires updating `extractPresetValues` and `mapPresetRow` destructuring |
| 10 | Extract shared `<GuidanceAccordion>` component | Maintainer, Conventions | Eliminates ~160+ lines of triplicated code | Requires a flexible callback interface to accommodate three different update mechanisms |
| 11 | Use `setEditing(prev => ...)` updater pattern instead of capturing state in closures | Conventions | Eliminates stale closure bugs in `GridPresetsTab` and `LinkedGridPresets` | Minor refactor to callback patterns |
| 12 | Validate cell guidance keys against linked grid cell labels with autocomplete | Maintainer | Prevents orphaned guidance entries from accumulating | Requires fetching linked grid labels into the admin UI; adds UI complexity |

---

## Blind Spots

Areas the selected perspectives (Data Integrity, Maintainer, Conventions & Idioms) did not adequately cover.

| Gap | Recommended Perspective |
|-----|------------------------|
| **Performance impact of hierarchical guidance.** The `buildGuidanceBlock` function merges guidance from three sources (grid, link, preset) for every cell on every generation. For large grids (e.g., 6x6 = 36 cells), this involves multiple object lookups per cell. No perspective assessed whether this is a bottleneck or whether the merged guidance significantly increases prompt token count. | **Performance** perspective |
| **Security of the admin API routes.** The grid links and preset CRUD endpoints accept arbitrary JSON for `group_guidance` and `cell_guidance` with no size limits or sanitization. No perspective assessed injection risk or DoS via oversized guidance payloads. | **Security** perspective |
| **User experience of the guidance editing workflow.** No perspective evaluated whether the three-tier guidance model (overall/group/cell) is intuitive for end users, whether the admin UI makes the hierarchy discoverable, or whether the prompt preview gaps would confuse users in practice. | **UX / End-User** perspective |
| **Test coverage of the new guidance paths.** The prompt builder tests were mentioned but no perspective systematically assessed whether the guidance merge logic, the decomposition function, or the migration are tested. The stale closure and `.replace()` fragility issues both suggest gaps in test coverage. | **Testing** perspective |
| **Deployment and rollback story.** Migration 018 is non-atomic and `INSERT OR IGNORE` creates database divergence, but no perspective assessed the overall deployment sequence, rollback safety, or whether there is a migration down path. | **DevOps / Deployment** perspective |
