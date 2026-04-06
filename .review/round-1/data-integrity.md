# Data Integrity Review -- Hierarchical Guidance Migration

## Findings

### 1. Frontend TypeScript types still use old column names -- data silently lost on preset load

- **What:** The `CharacterPreset`, `BuildingPreset`, `TerrainPreset`, and `BackgroundPreset` interfaces in `AppContext.tsx` still declare the old field names (`rowGuidance: string`, `cellGuidance: string`, `tileGuidance: string`, `layerGuidance: string`). The API now returns `overallGuidance`, `groupGuidance`, and `cellGuidance` (the new hierarchical shape) from `mapPresetRow` via `presetTables.js`. When the reducer handles `LOAD_CHARACTER_PRESET`, it reads `action.preset.rowGuidance` (line 441), which is `undefined` because the API returned `overallGuidance` instead. The same mismatch exists for all four sprite types.
- **Where:**
  - `src/context/AppContext.tsx:62-105` (stale interfaces)
  - `src/context/AppContext.tsx:441` (`action.preset.rowGuidance` -- undefined at runtime)
  - `src/context/AppContext.tsx:459` (`action.preset.cellGuidance` -- now a `Record<string,string>`, was a `string`)
  - `src/context/AppContext.tsx:483` (`action.preset.tileGuidance` -- undefined)
  - `src/context/AppContext.tsx:503` (`action.preset.layerGuidance` -- undefined)
  - `src/context/AppContext.tsx:122-167` (stale `AppState` shape)
- **Why it matters:** When a user selects a preset, all guidance data is silently dropped. The old field names map to `undefined`, so guidance is stored as empty string in state. The prompt builder then has no guidance to include, producing degraded prompts. This is a **functional regression** affecting every preset load across all sprite types.
- **Suggested alternative:** Update the frontend interfaces and reducer to use the new hierarchical shape: `overallGuidance: string; groupGuidance: Record<string, string>; cellGuidance: Record<string, string>`. Update `LOAD_*_PRESET` reducer cases accordingly. The `AppState.character` / `building` / `terrain` / `background` objects should carry the hierarchical guidance (or at minimum, the `overallGuidance` field). The `UnifiedConfigPanel` default content objects (lines 80, 103, 126, 147) also need updating.

---

### 2. Migration 018 is non-atomic -- partial application leaves database in inconsistent state

- **What:** Migration `018_hierarchical_guidance` is a single `db.exec()` call containing 27 DDL statements across 9 tables. SQLite's `db.exec` does NOT wrap multiple statements in a transaction. If (for example) the `character_presets` rename succeeds but the `building_presets` rename fails (e.g., the old column name was already changed), some tables will have the new schema and others won't. The error handler then records the migration as "already applied" if the error message includes "no such column", permanently preventing the remaining statements from running.
- **Where:** `server/db/migrations.js:41-88` (migration SQL), `server/db/migrations.js:110-124` (error handler)
- **Why it matters:** On an existing database where some columns were already renamed (e.g., by a prior aborted run or manual intervention), the "no such column" error from the first failed rename will cause the entire migration to be marked as applied, leaving tables that haven't been migrated. The new seed code and API routes will then fail with column-not-found errors.
- **Suggested alternative:** Wrap the multi-statement migration in an explicit `BEGIN; ... COMMIT;` block, or split it into individual per-table migrations (018a through 018i) so each can be tracked independently. Alternatively, check for column existence before each rename using `PRAGMA table_info`.

---

### 3. `INSERT OR IGNORE` seeds cannot update existing stale data after schema change

- **What:** All seed files use `INSERT OR IGNORE` based on the primary key (`id`). After the migration renames columns and decomposes guidance blobs into the new `overall_guidance` / `group_guidance` / `cell_guidance` structure, the seed will silently skip any preset that already exists in the database. Existing rows will retain whatever was in the old column (now renamed to `overall_guidance`) and will have `{}` for `group_guidance` and `cell_guidance`. The decomposed per-cell guidance that should live on the grid links will never be written.
- **Where:** All seed files: `characterPresets.js:2098`, `buildingPresets.js:524`, `terrainPresets.js:444`, `backgroundPresets.js:222`, `gridPresets.js:161`
- **Why it matters:** Any existing database that had seed data before the migration will have presets with the old monolithic guidance blob sitting in `overall_guidance` (undecomposed) and empty `cell_guidance` on both the preset and link rows. New databases will get the correctly decomposed data. This creates a silent data divergence between fresh and migrated databases -- migrated databases produce prompts with the old blob format that the new `buildGuidanceBlock` function doesn't understand.
- **Suggested alternative:** Add a one-time data migration step (either in migration 018 or as a post-migration hook) that decomposes existing guidance blobs in-place. This could be a JS migration function rather than pure SQL, running `decomposeGuidanceBlob` on each existing row and updating the three columns accordingly.

---

### 4. `extractPresetValues` uses `||` for falsy detection -- loses legitimate empty strings and `0` values

- **What:** The `extractPresetValues` function in `server/utils.js:10-14` uses `raw || defaultVal` to apply defaults. This means empty string `""`, `0`, `false`, and `null` all fall through to the default. For JSON fields, `raw || defaultVal` will serialize the default when the user sends an empty object `{}` (which is truthy, fine) but will also serialize the default when the user sends `0` or `false` (which are unusual but valid JSON values that would be lost).
- **Where:** `server/utils.js:10-14`
- **Why it matters:** Most critically for non-JSON columns: if a user explicitly sends `name: ""` in a PUT request to clear a field, the function falls through to the default, silently ignoring the update. For `gridSize`, sending a value of `"0"` or any falsy-but-valid string is lost. The practical impact is moderate since most fields are non-empty strings, but it violates the principle of least surprise.
- **Suggested alternative:** Use `raw ?? defaultVal` (nullish coalescing) instead of `raw || defaultVal`. This preserves empty strings and `0` while still applying defaults for `null` and `undefined`.

---

### 5. No JSON validation on storage boundary -- malformed JSON stored permanently

- **What:** The `group_guidance` and `cell_guidance` columns are `TEXT NOT NULL DEFAULT '{}'` -- there is no CHECK constraint or application-level validation ensuring the stored text is valid JSON. The API routes call `JSON.stringify` on incoming data before storage (good), but direct database manipulation, manual SQL, or a malformed migration could insert invalid JSON. The retrieval paths (`JSON.parse(r.group_guidance || '{}')` in routes) will throw an unhandled exception if the stored value is not valid JSON, crashing the request.
- **Where:**
  - `server/db/schema.js:64-65`, and all similar `group_guidance`/`cell_guidance` column definitions
  - `server/routes/gridPresets.js:28-29` (unguarded `JSON.parse`)
  - `server/routes/presets.js:130-131, 135-136, 143-144` (unguarded `JSON.parse`)
  - `server/utils.js:21` (`mapPresetRow` does `JSON.parse` with no try/catch)
- **Why it matters:** A single malformed JSON value in any guidance column will cause every API call that reads that table to crash with a 500 error. SQLite has a `json_valid()` function available as a CHECK constraint, or the parse sites could wrap in try/catch.
- **Suggested alternative:** Add `CHECK(json_valid(group_guidance))` and `CHECK(json_valid(cell_guidance))` constraints to the schema, or at minimum wrap `JSON.parse` calls in try/catch with sensible fallbacks. SQLite supports `json_valid()` natively.

---

### 6. `HistoryResponse.content.rowGuidance` declared but never populated -- dead type field

- **What:** The `HistoryResponse` TypeScript interface at `src/types/api.ts:24` declares `rowGuidance?: string` inside `content`, but the server's history route (`server/routes/history.js:42-45`) only returns `name` and `description` in the content object. The `loadGeneration.ts:101` code reads `data.content.rowGuidance` which is always `undefined`. The type creates a false expectation that guidance data is available from history.
- **Where:**
  - `src/types/api.ts:18-25` (stale type declaration)
  - `src/lib/loadGeneration.ts:101` (reads `data.content.rowGuidance || ''` -- always empty)
- **Why it matters:** Low severity. The field is always undefined at runtime and falls to empty string, so there's no crash. But it suggests the session-restore path was never fully connected to guidance data, and the stale type makes the code misleading for future developers.
- **Suggested alternative:** Remove `rowGuidance` (and other dead content fields like `equipment`, `colorNotes`, `styleNotes`) from `HistoryResponse.content`, or populate them on the server if the intent is to restore full preset state from history.

---

### 7. Animation series seeds insert `overall_guidance` on link without `group_guidance`/`cell_guidance` columns

- **What:** The `animationSeries.js` seed inserts into `character_grid_links` with only `(character_preset_id, grid_preset_id, overall_guidance, sort_order)` -- it omits `group_guidance` and `cell_guidance`. These columns are `NOT NULL DEFAULT '{}'` so the INSERT succeeds using the defaults. However, this is inconsistent with how all other seed files explicitly pass `'{}', '{}'` for those columns. If the default were ever changed or removed, this would break.
- **Where:** `server/db/seeds/animationSeries.js:12-13`
- **Why it matters:** Low severity, but creates an implicit dependency on column defaults that other seed files don't share. The inconsistency could mislead someone reading the code into thinking group/cell guidance doesn't apply to animation series links.
- **Suggested alternative:** Explicitly include `group_guidance` and `cell_guidance` in the INSERT statement with `'{}'` values, matching the pattern used in all other seed files.

---

### 8. Grid preset seeds for building/terrain/background omit `group_guidance` and `cell_guidance`

- **What:** The `insertGrid` statements in `buildingPresets.js:543`, `terrainPresets.js:462`, and `backgroundPresets.js:240` insert into `grid_presets` without specifying `group_guidance` or `cell_guidance`, relying on `DEFAULT '{}'`. The character `gridPresets.js:161` seed correctly includes both columns explicitly. This means building/terrain/background grid presets never get grid-level group or cell guidance, even though the schema supports it and the prompt builder (`buildGuidanceBlock`) reads `gridGuidance.groups` and `gridGuidance.cells` from those rows.
- **Where:**
  - `server/db/seeds/buildingPresets.js:543` (missing columns)
  - `server/db/seeds/terrainPresets.js:462` (missing columns)
  - `server/db/seeds/backgroundPresets.js:240` (missing columns)
  - vs. `server/db/seeds/gridPresets.js:161` (includes both)
- **Why it matters:** The API reads `grid_group_guidance` and `grid_cell_guidance` from grid presets (in `presets.js:117-118`). For building/terrain/background grids, these will always be `'{}'` -- which works at the prompt level since `buildGuidanceBlock` merges from three sources, but it means the grid-level cell guidance is missing where it could add value. More importantly, if someone edits a building grid preset via the admin UI and saves cell-level guidance, it works; but the seed data was never structured to populate this layer.
- **Suggested alternative:** This is an intentional design choice where per-cell guidance lives on the link rather than the grid preset. If so, document this in a comment. If not, populate grid-level cell guidance in the seed data.

---

### 9. Concurrent writes to grid links have no optimistic locking

- **What:** The PUT handler for grid links (`server/routes/gridLinks.js:8-28`) performs a blind `UPDATE ... WHERE id = ?` with no version check or row lock. If two admin users simultaneously edit the same grid link's guidance, the last write wins silently with no conflict detection.
- **Where:** `server/routes/gridLinks.js:15-24`
- **Why it matters:** Low severity for a likely single-user app, but if the admin UI is used by multiple people or from multiple tabs, guidance edits can be silently overwritten.
- **Suggested alternative:** Add an `updated_at` timestamp column to link tables and require the client to send the last-known timestamp. Reject the update if it has changed (optimistic concurrency control).

---

### 10. `ContentPreset` type is a loose superset -- no discriminated union

- **What:** The `ContentPreset` interface at `src/types/api.ts:50-73` is a flat superset with all fields optional. There is no discriminated union or required-field enforcement per sprite type. Code that uses `ContentPreset` must use `||` guards everywhere (e.g., `contentPreset.equipment || ''` at `promptForType.ts:48`). If a building preset is accidentally passed where a character preset is expected, TypeScript won't catch it.
- **Where:** `src/types/api.ts:50-73`
- **Why it matters:** The type system provides no protection against cross-type confusion. A building preset missing `equipment` will silently produce a character prompt with empty equipment, and a character preset missing `details` will silently produce a building prompt with empty details. The type system should enforce correctness here.
- **Suggested alternative:** Define per-type interfaces (`CharacterContentPreset`, `BuildingContentPreset`, etc.) with required fields, and use a discriminated union: `type ContentPreset = CharacterContentPreset | BuildingContentPreset | ...` with a `spriteType` discriminator field.

---

## Summary

The server-side schema, migration, and seed changes for hierarchical guidance are structurally sound -- column names are consistent, seeds correctly decompose blobs into the new three-tier structure, and the prompt builder elegantly merges guidance from grid, link, and preset levels. However, the **frontend was not updated to match**: the TypeScript types and reducer still reference old column names (`rowGuidance`, `cellGuidance` as string, `tileGuidance`, `layerGuidance`), meaning all preset guidance data is silently dropped when loaded into the UI. This is the most critical finding. Secondary concerns are the non-atomic migration (which could leave a database half-migrated), `INSERT OR IGNORE` semantics that prevent seed data from being refreshed on existing databases, and the absence of JSON validation at the storage boundary.
