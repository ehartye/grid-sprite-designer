# Data Integrity -- Round 1 Findings

## Finding 1: Delete Route Manually Deletes Sprites But Ignores editor_settings (Inconsistent CASCADE Trust)

- **What:** The `DELETE /:id` handler manually deletes sprites before deleting the generation: `DELETE FROM sprites WHERE generation_id = ?` followed by `DELETE FROM generations WHERE id = ?`. The `sprites` table has `ON DELETE CASCADE` on `generation_id` (schema.js:41), making the manual delete redundant. Meanwhile `editor_settings` also has `ON DELETE CASCADE` (schema.js:52) but is NOT manually deleted. This inconsistency suggests the author didn't fully trust CASCADE but only applied the manual workaround to one of two child tables.
- **Where:** `server/routes/history.js:231-232`, `server/db/schema.js:41,52`
- **Why this matters:** Maintenance hazard. If someone ever disables `foreign_keys` (e.g., during a migration -- migration 026 actually rebuilds the generations table), the manual sprite delete would work but editor_settings would be orphaned. Currently not a data loss bug because `foreign_keys = ON` is set at connection time.
- **Confidence:** High
- **Suggested alternative:** Either trust CASCADE for both (remove the manual sprite delete) or add a manual editor_settings delete too. Trusting CASCADE is cleaner.

---

## Finding 2: Generation Version Race Condition on Concurrent Writes

- **What:** When creating a generation with `parentHistoryId` but no explicit `generationVersion`, the server reads `MAX(generation_version)` and increments it (history.js:112-115). This read-then-write is NOT inside a transaction, so two concurrent requests for the same group/gridSize could both read the same MAX and insert duplicate version numbers. There is no UNIQUE constraint on `(group_id, grid_size, generation_version)` to catch this.
- **Where:** `server/routes/history.js:110-121`
- **Why this matters:** Duplicate version numbers within a group confuse version chain display and the `/max-version` endpoint. Low practical risk for a single-user local app but the pattern is incorrect.
- **Confidence:** High
- **Suggested alternative:** Wrap the MAX query + INSERT in a `db.transaction()`, or use a single `INSERT ... SELECT MAX(...)+1` statement.

---

## Finding 3: `content_preset_id` is a Dangling Reference (No FK Constraint)

- **What:** `generations.content_preset_id` (schema.js:7) stores a text ID that references one of four preset tables depending on `sprite_type`. Because it's polymorphic, there's no FK constraint. If a content preset is deleted, all generations referencing it retain a stale ID pointing to nothing. The backfill logic in `migrations.js:237-254` matches by name, which also goes stale if preset names change.
- **Where:** `server/db/schema.js:7`, `server/routes/history.js:97,121`
- **Why this matters:** The regeneration hooks (`useRegenerateWithFeedback.ts:131-135`, `useAddSheet.ts:112-118`) have try/catch fallbacks for missing presets. But `useRunWorkflow.ts:52` calls `fetchContentPreset(run.spriteType, run.contentPresetId!)` with a non-null assertion and NO fallback -- it would throw an unhandled error if the preset was deleted after a run started.
- **Confidence:** High
- **Suggested alternative:** Accept as a soft link (most flows degrade gracefully), but add a fallback in `useRunWorkflow.ts:52` and consider nullifying `content_preset_id` references when a preset is deleted.

---

## Finding 4: No Validation That `generation_id` Exists Before Sprite/Settings Insert

- **What:** `POST /:id/sprites` (history.js:127-178) and `PUT /:id/settings` (history.js:211-224) insert child rows referencing `:id` as `generation_id` without verifying the parent generation exists. With `foreign_keys = ON`, inserting against a nonexistent ID throws a FK constraint error that bubbles up as a generic 500 "Internal server error" instead of a clear 404.
- **Where:** `server/routes/history.js:127-178`, `server/routes/history.js:211-224`
- **Why this matters:** In normal flow the client creates the generation first, so this rarely fires. But the API surface accepts arbitrary IDs, and the FK error produces an opaque 500 rather than an informative 404.
- **Confidence:** High
- **Suggested alternative:** Add an existence check before insert, or catch the FK constraint error and map it to 404.

---

## Finding 5: Gallery Subquery Loads Full Sprite Images When Thumbnails Are Missing

- **What:** The gallery query (gallery.js:33-34) uses `COALESCE(g.thumbnail_image, (SELECT s.image_data FROM sprites s WHERE ...))` to fall back to sprite data when no thumbnail is pre-set. The `image_data` column contains full base64-encoded sprite images. For 24 rows per page, this could mean 24 sprite image lookups.
- **Where:** `server/routes/gallery.js:31-36`
- **Why this matters:** Gallery performance degrades for entries without pre-set thumbnails. SQLite's COALESCE does short-circuit, so entries with `thumbnail_image` set are fine. The concern is older/legacy entries that were created before thumbnail support was added.
- **Confidence:** Medium -- impact depends on thumbnail population rate.
- **Suggested alternative:** Eagerly populate `thumbnail_image` during generation save, or add a backfill migration for existing entries.

---

## Finding 6: Stale Migration Test Assertion

- **What:** The test at `migrations.test.js:38` asserts `expect(rows.at(-1).name).toBe('020_add_generation_thinking_level')` but the actual last migration is `026_fix_parent_history_fk`. This assertion is stale -- when `createSchema` runs first and then `migrateSchema` runs on an empty in-memory DB, ALL migrations (including 021-026) are recorded. The last one should be `026_fix_parent_history_fk`.
- **Where:** `server/__tests__/migrations.test.js:38`
- **Why this matters:** Either this test is failing (and being ignored), or it's not being run at all. Either way it's not providing the intended safety net.
- **Confidence:** High
- **Suggested alternative:** Update the assertion to `026_fix_parent_history_fk`.

---

## Finding 7: Non-Atomic History + Sprites Save Creates Orphan Risk

- **What:** `runGeneratePipeline()` saves the generation record and sprites as two separate HTTP requests (useGenericWorkflow.ts:168-218). If the sprite save fails (network error, abort, server crash), a generation record exists with zero sprites. The same pattern exists in `useRegenerateWithFeedback.ts:157-203`. There is no cleanup, retry, or status flag to distinguish complete from incomplete entries.
- **Where:** `src/hooks/useGenericWorkflow.ts:168-218`, `src/hooks/useRegenerateWithFeedback.ts:139-208`
- **Why this matters:** Gallery and history list will show entries with zero sprites. Loading such entries displays an empty review screen with no way to recover. The archive POST is also a separate request that can fail independently.
- **Confidence:** High
- **Suggested alternative:** Combine history + sprites into a single transactional endpoint, or add a `status` column to filter incomplete entries from queries.

---

## Finding 8: `feedback_json` Validated as String but Stored JSON is Parsed on Read

- **What:** The `PATCH /:id/feedback` handler (history.js:271-284) validates that `feedbackJson` is a string AND validates it parses as JSON (lines 279-280). This is actually correct -- the handler does call `JSON.parse(feedbackJson)` in a try-catch and returns 400 on parse failure. However, the `GET /:id` handler returns `feedbackJson` as a raw string (line 80: `feedbackJson: gen.feedback_json || null`). The frontend must parse it again. If someone writes invalid JSON directly to the DB (bypassing the API), the frontend would get a corrupt string.
- **Where:** `server/routes/history.js:271-284`, `server/routes/history.js:80`
- **Why this matters:** Low risk -- the API validates on write. But storing as TEXT and returning as TEXT means the consumer must know to parse it. A `json_valid()` CHECK constraint on the column would be a stronger guarantee.
- **Confidence:** Low -- defense-in-depth concern, not a current bug.
- **Suggested alternative:** No action needed; the API-level validation is adequate.

---

## Finding 9: Preset Delete Does Not Cascade to `generations.content_preset_id`

- **What:** The `DELETE /:type/:id` preset handler (presets.js:83-101) deletes the preset and its grid links (which cascade). But it does NOT nullify `generations.content_preset_id` for any generation records that reference the deleted preset. This is related to Finding 3 but specifically about the delete flow.
- **Where:** `server/routes/presets.js:83-101`
- **Why this matters:** After deleting a preset, existing generations retain a `content_preset_id` pointing to a non-existent preset. The `fetchContentPreset` calls in regeneration/add-sheet flows will fail, falling back to state data in most cases but throwing in `useRunWorkflow.ts`.
- **Confidence:** High
- **Suggested alternative:** Add `UPDATE generations SET content_preset_id = NULL WHERE content_preset_id = ? AND sprite_type = ?` to the preset delete handler.

---

## Finding 10: `hasColumn` Helper Uses String Interpolation in PRAGMA

- **What:** The `hasColumn()` function in `migrations.js:182` uses string interpolation: `` `PRAGMA table_info(${table})` ``. The `table` parameter comes from regex extraction of hardcoded migration SQL, so it's not exploitable. But the pattern is an unsafe habit.
- **Where:** `server/db/migrations.js:182`
- **Why this matters:** Not a current vulnerability since migrations are compile-time constants. Flagging as a code hygiene note.
- **Confidence:** High for pattern being unsafe; Low for actual risk.
- **Suggested alternative:** No immediate action needed.

---

## Summary

The most impactful findings are:

1. **Non-atomic history+sprites save** (Finding 7) -- can produce orphaned generation records with zero sprites
2. **Version race condition** (Finding 2) -- correctness issue, mitigated by single-user nature
3. **Dangling content_preset_id on preset delete** (Findings 3, 9) -- `useRunWorkflow` has no fallback and would throw
4. **Stale test assertion** (Finding 6) -- safety net is broken
5. **Opaque 500 on child insert with bad generation_id** (Finding 4) -- poor API error reporting

The schema is well-normalized with appropriate FK constraints, indexes matching query patterns (`sprite_type+created_at` for gallery, `generation_id+cell_index` for sprites), and correct CASCADE rules on child tables. The migration system handles upgrade paths correctly with column-existence checks. The main data integrity gaps are around soft references (polymorphic FK to presets) and the two-step save pattern that breaks atomicity across HTTP boundaries.
