# Architecture Review Remediation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use h-superpowers:subagent-driven-development, h-superpowers:team-driven-development, or h-superpowers:executing-plans to implement this plan (ask user which approach).

**Goal:** Address all findings from the 4-perspective architecture review — 3 critical bugs, structural refactors, and cleanup items.

**Architecture:** Bug fixes first (immediate correctness), then structural refactors (SpriteReview decomposition, schema consolidation, AppContext normalization), then cleanup (type safety, dead code, consistency).

**Tech Stack:** React 18, TypeScript, Express, better-sqlite3, Vite

**Note:** Several review findings are already addressed in the current codebase:
- `processSprite` already extracted to `src/lib/spriteProcessor.ts` with config object
- `detectPalette` already extracted to `src/lib/spriteProcessor.ts`
- `RGB` type already centralized in `src/types/color.ts`
- `LOAD_*_PRESET` cases already consolidated to single `LOAD_CONTENT_PRESET`
- `useRegenerateWithFeedback` already uses `stateRef` pattern (line 31-32)

---

## Tier 1: Immediate Bug Fixes

### Task 1: Fix `/max-version` route ordering

The `/max-version` route is registered after `/:id` in Express, so it's caught by the `:id` param matcher and returns 400. All regeneration version numbers default to 2.

**Files:**
- Modify: `server/routes/history.js`

**Step 1: Move the `/max-version` route**

Cut the entire `router.get('/max-version', ...)` block (currently at line ~222) and paste it BEFORE the `router.get('/:id', ...)` route (currently at line ~26). Static routes must precede parameterized routes in Express.

The block to move:
```javascript
router.get('/max-version', (req, res, next) => {
  try {
    const { groupId, gridSize } = req.query;
    if (!groupId) return res.status(400).json({ error: 'groupId is required' });
    const conditions = ['group_id = ?'];
    const params = [groupId];
    if (gridSize) {
      conditions.push('grid_size = ?');
      params.push(gridSize);
    }
    const row = db.prepare(
      `SELECT MAX(generation_version) as max_version FROM generations WHERE ${conditions.join(' AND ')}`
    ).get(...params);
    res.json({ maxVersion: row?.max_version || 1 });
  } catch (err) { next(err); }
});
```

**Step 2: Verify**

Run: `curl http://localhost:3002/api/history/max-version?groupId=test`
Expected: `{"maxVersion":1}` (not 400 error)

**Step 3: Commit**

```bash
git add server/routes/history.js
git commit -m "fix: move /max-version route before /:id to prevent shadowing"
```

---

### Task 2: Fix content name fallback for terrain/background regeneration

In `useRegenerateWithFeedback.ts`, the content name fallback only checks `character` and `building` state, producing empty names for terrain/background regenerations.

**Files:**
- Modify: `src/hooks/useRegenerateWithFeedback.ts:145-154`

**Step 1: Fix the fallback**

Replace lines 145-147:
```typescript
// 8. Fetch content preset name for history
let contentName = currentState.character?.name || currentState.building?.name || '';
let contentDescription = '';
```

With:
```typescript
// 8. Fetch content preset name for history
const { WORKFLOW_CONFIGS } = await import('./useGenericWorkflow');
const fallbackContent = WORKFLOW_CONFIGS[spriteType].getContent(currentState);
let contentName = fallbackContent.name;
let contentDescription = fallbackContent.description;
```

This uses the existing `WORKFLOW_CONFIGS` pattern that handles all 4 sprite types correctly.

**Step 2: Verify**

Run: `npm run typecheck`
Expected: No errors

**Step 3: Commit**

```bash
git add src/hooks/useRegenerateWithFeedback.ts
git commit -m "fix: use WORKFLOW_CONFIGS for content name fallback in all sprite types"
```

---

### Task 3: Add `ON DELETE SET NULL` to `parent_history_id` and consolidate schema

Deleting a parent generation causes FK error (opaque 500). Also consolidates schema.js to match migrated table shape, dropping vestigial `character_preset_id` and `custom_instructions` columns.

**Files:**
- Modify: `server/db/migrations.js`
- Modify: `server/db/schema.js`

**Step 1: Add migration to recreate table with correct FK**

Append to the MIGRATIONS array in `server/db/migrations.js`:

```javascript
{
  name: '026_fix_parent_history_fk',
  sql: `
    CREATE TABLE generations_new AS SELECT * FROM generations;
    DROP TABLE generations;
    CREATE TABLE generations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      content_name TEXT NOT NULL,
      content_description TEXT NOT NULL DEFAULT '',
      content_preset_id TEXT,
      model TEXT NOT NULL DEFAULT 'gemini-3-pro-image-preview',
      image_size TEXT DEFAULT NULL,
      thinking_level TEXT DEFAULT NULL,
      prompt TEXT NOT NULL DEFAULT '',
      template_image TEXT NOT NULL DEFAULT '',
      filled_grid_image TEXT NOT NULL DEFAULT '',
      thumbnail_cell_index INTEGER DEFAULT NULL,
      thumbnail_image TEXT DEFAULT NULL,
      thumbnail_mime TEXT DEFAULT NULL,
      sprite_type TEXT NOT NULL DEFAULT 'character',
      grid_size TEXT DEFAULT NULL,
      aspect_ratio TEXT DEFAULT '1:1',
      group_id TEXT DEFAULT NULL,
      grid_preset_name TEXT DEFAULT NULL,
      feedback_json TEXT DEFAULT NULL,
      parent_history_id INTEGER DEFAULT NULL REFERENCES generations(id) ON DELETE SET NULL,
      generation_version INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    INSERT INTO generations SELECT
      id, content_name, content_description, content_preset_id,
      model, image_size, thinking_level, prompt, template_image,
      filled_grid_image, thumbnail_cell_index, thumbnail_image,
      thumbnail_mime, sprite_type, grid_size, aspect_ratio,
      group_id, grid_preset_name, feedback_json, parent_history_id,
      generation_version, created_at, updated_at
    FROM generations_new;
    DROP TABLE generations_new;
    CREATE INDEX IF NOT EXISTS idx_generations_sprite_type ON generations(sprite_type);
    CREATE INDEX IF NOT EXISTS idx_generations_type_created ON generations(sprite_type, created_at DESC);
  `
},
```

Note: This drops the vestigial `character_preset_id` and `custom_instructions` columns not used by any code.

**Step 2: Update schema.js to match**

Replace the generations CREATE TABLE in `server/db/schema.js` with the same shape as the migration (same column list, same FK clause). This ensures fresh databases match existing migrated databases.

**Step 3: Verify**

Run: Restart dev server, check console for `[Migration] Applied: 026_fix_parent_history_fk`
Run: `npm run typecheck`

**Step 4: Commit**

```bash
git add server/db/migrations.js server/db/schema.js
git commit -m "fix: consolidate schema, add ON DELETE SET NULL to parent_history_id, drop vestigial columns"
```

---

## Tier 2: High-Impact Structural Refactors

### Task 4: Decompose SpriteReview sidebar into PostProcessingSidebar

SpriteReview is 684 lines. The Post-Processing SidebarGroup alone is ~300 lines of JSX. Extract into a focused component.

**Files:**
- Create: `src/components/grid/PostProcessingSidebar.tsx`
- Modify: `src/components/grid/SpriteReview.tsx`

**Step 1: Create PostProcessingSidebar**

Extract everything inside `<SidebarGroup label="Post-Processing">` into a new component. The component receives all settings values and setters as props. It's a pure UI extraction — no state logic changes.

Props should include: posterize state (from `post` hook), pixelize state, outline state, chroma key state (entire `chroma` hook return), alpha snap state, color striker state (struckColors, palette, tolerance), re-extract handler, aaInset.

**Step 2: Update SpriteReview**

Replace the Post-Processing SidebarGroup contents with `<PostProcessingSidebar ... />`.

**Step 3: Verify**

Run: `npm run typecheck && npm run build`

**Step 4: Commit**

```bash
git add src/components/grid/PostProcessingSidebar.tsx src/components/grid/SpriteReview.tsx
git commit -m "refactor: extract PostProcessingSidebar from SpriteReview"
```

---

### Task 5: Extract ReviewActions component

Extract the Actions SidebarGroup (export buttons, add sheet, feedback & regenerate, back button) into a separate component.

**Files:**
- Create: `src/components/grid/ReviewActions.tsx`
- Modify: `src/components/grid/SpriteReview.tsx`

**Step 1: Create ReviewActions**

Props: handleExportSheet, handleExportIndividual, setAddSheetOpen, setFeedbackPanelOpen, hasFeedbackState (boolean), handleRegenerate, regenerating, setStep.

Move the Actions SidebarGroup into this component.

**Step 2: Update SpriteReview**

Replace with `<ReviewActions ... />`.

**Step 3: Verify**

Run: `npm run typecheck && npm run build`

**Step 4: Commit**

```bash
git add src/components/grid/ReviewActions.tsx src/components/grid/SpriteReview.tsx
git commit -m "refactor: extract ReviewActions from SpriteReview"
```

---

### Task 6: Create `usePostProcessingState` composition hook

Consolidate the ~12 individual useState calls for post-processing settings into a single composition hook.

**Files:**
- Create: `src/hooks/usePostProcessingState.ts`
- Modify: `src/components/grid/SpriteReview.tsx`

**Step 1: Create the hook**

Consolidate these useState calls into a single hook:
- pixelizeEnabled, pixelizeSize
- outlineEnabled, outlineOutDepth, outlineInDepth, outlineColor
- alphaSnapEnabled, alphaSnapThreshold
- struckColors, showRareColors, strikeTolerance
- aaInset

Return a flat object with all values and setters, plus `resetAll()` and `restoreFromSettings(settings)` methods.

**Step 2: Update SpriteReview**

Replace the ~12 useState calls with `const postProcess = usePostProcessingState();`.
Update all references to use `postProcess.pixelizeEnabled` etc.

**Step 3: Verify**

Run: `npm run typecheck && npm run build`

**Step 4: Commit**

```bash
git add src/hooks/usePostProcessingState.ts src/components/grid/SpriteReview.tsx
git commit -m "refactor: consolidate post-processing state into usePostProcessingState hook"
```

---

### Task 7: Fix `SELECT *` in history detail route

Reads unused multi-MB `template_image` blob into memory on every fetch.

**Files:**
- Modify: `server/routes/history.js`

**Step 1: Replace `SELECT *` with explicit columns**

Replace:
```javascript
const gen = db.prepare('SELECT * FROM generations WHERE id = ?').get(id);
```

With explicit column list excluding `template_image`:
```javascript
const gen = db.prepare(`
  SELECT id, content_name, content_description, model, image_size, thinking_level,
         prompt, filled_grid_image, thumbnail_cell_index, thumbnail_image, thumbnail_mime,
         sprite_type, grid_size, aspect_ratio, group_id, content_preset_id,
         grid_preset_name, feedback_json, parent_history_id, generation_version,
         created_at, updated_at
  FROM generations WHERE id = ?
`).get(id);
```

**Step 2: Commit**

```bash
git add server/routes/history.js
git commit -m "perf: select explicit columns in history detail, skip template_image blob"
```

---

## Tier 3: Medium-Impact Improvements

### Task 8: Add JSON validation to feedback PATCH endpoint

Stores `feedbackJson` without validating it's valid JSON.

**Files:**
- Modify: `server/routes/history.js`

**Step 1: Add validation after the type check**

```javascript
try { JSON.parse(feedbackJson); }
catch { return res.status(400).json({ error: 'feedbackJson must be valid JSON' }); }
```

**Step 2: Commit**

```bash
git add server/routes/history.js
git commit -m "fix: validate feedbackJson is valid JSON before storing"
```

---

### Task 9: Escape LIKE wildcards in gallery search

User input passed directly as LIKE pattern.

**Files:**
- Modify: `server/routes/gallery.js`

**Step 1: Escape wildcards**

Replace:
```javascript
const search = req.query.search ? `%${req.query.search}%` : null;
```

With:
```javascript
const rawSearch = req.query.search || '';
const search = rawSearch ? `%${rawSearch.replace(/[%_]/g, '\\$&')}%` : null;
```

Update the LIKE clause: `"g.content_name LIKE ? ESCAPE '\\'"`.

**Step 2: Commit**

```bash
git add server/routes/gallery.js
git commit -m "fix: escape LIKE wildcards in gallery search"
```

---

### Task 10: Compute version numbers server-side

Client fetches max-version then POSTs with incremented value — race condition.

**Files:**
- Modify: `server/routes/history.js`
- Modify: `src/hooks/useRegenerateWithFeedback.ts`

**Step 1: Add server-side computation in POST handler**

When `parentHistoryId` is provided, compute version as:
```javascript
let effectiveVersion = generationVersion || 1;
if (parentHistoryId && !generationVersion) {
  const maxRow = db.prepare(
    'SELECT MAX(generation_version) as mv FROM generations WHERE group_id = ? AND grid_size = ?'
  ).get(groupId || null, gridSize || null);
  effectiveVersion = (maxRow?.mv || 1) + 1;
}
```

**Step 2: Simplify client**

Remove the `/max-version` fetch in `useRegenerateWithFeedback.ts` (lines ~64-80). Pass `parentHistoryId` only — omit `generationVersion` to let server compute.

**Step 3: Commit**

```bash
git add server/routes/history.js src/hooks/useRegenerateWithFeedback.ts
git commit -m "refactor: compute generation version server-side to prevent race conditions"
```

---

### Task 11: Replace inline `window.innerWidth` checks with CSS

Three components use non-reactive JS mobile detection.

**Files:**
- Modify: `src/components/grid/FeedbackPanel.tsx`
- Modify: `src/components/grid/CellContextMenu.tsx`
- Modify: `src/components/grid/SpriteReview.tsx`
- Modify: `src/styles/global.css`

**Step 1: Remove `isMobile` variables**

Always render both variants. Use CSS media queries to show/hide the mobile vs desktop version:
- `.feedback-panel` gets `.side-panel` always on desktop, `.bottom-sheet` on mobile via CSS
- `.cell-menu-dropdown` gets bottom-sheet behavior via CSS media query
- `.regen-sticky-bar` shown/hidden via CSS

**Step 2: Commit**

```bash
git add src/components/grid/FeedbackPanel.tsx src/components/grid/CellContextMenu.tsx src/components/grid/SpriteReview.tsx src/styles/global.css
git commit -m "refactor: replace JS window.innerWidth checks with CSS media queries"
```

---

## Tier 4: Cleanup

### Task 12: Fix migration error suppression

The catch block swallows errors matching "no such column/table" — can mask real failures.

**Files:**
- Modify: `server/db/migrations.js`

**Step 1: Check preconditions before running ALTER TABLE migrations**

For simple ALTER TABLE ADD COLUMN migrations, check `PRAGMA table_info(table_name)` for column existence before running. Only skip if the column already exists. Don't catch-and-match error strings.

Complex multi-statement migrations can keep the current approach with tighter matching.

**Step 2: Commit**

```bash
git add server/db/migrations.js
git commit -m "fix: check column existence before ALTER TABLE instead of swallowing errors"
```

---

### Task 13: Remove `as any` casts in UnifiedConfigPanel

7 `as any` casts in the preset reset logic.

**Files:**
- Modify: `src/components/config/UnifiedConfigPanel.tsx`

**Step 1: Create typed reset helper**

```typescript
function resetContentForType(spriteType: SpriteType, content: AnyPreset): Partial<AnyPreset> {
  const base = { name: content.name, description: '' };
  if (spriteType === 'building' || spriteType === 'terrain' || spriteType === 'background') {
    return { ...base, gridSize: content.gridSize, cellLabels: [] };
  }
  return base;
}
```

Replace the 7 `as any` casts with this typed helper.

**Step 2: Commit**

```bash
git add src/components/config/UnifiedConfigPanel.tsx
git commit -m "refactor: replace as-any casts with typed reset helper"
```

---

### Task 14: Fix eslint-disable in GridLinkSelector

The dependency suppression masks an unstable parent callback.

**Files:**
- Modify: `src/components/shared/GridLinkSelector.tsx`
- Modify: parent component(s) that pass the callback

**Step 1: Wrap parent callback in useCallback, remove suppression**

Find where GridLinkSelector receives its callback prop, wrap it in `useCallback` in the parent. Then remove `// eslint-disable-line react-hooks/exhaustive-deps` from GridLinkSelector.

**Step 2: Commit**

```bash
git add src/components/shared/GridLinkSelector.tsx
git commit -m "fix: memoize parent callback, remove eslint-disable in GridLinkSelector"
```

---

### Task 15: Add try-catch to JSON.parse on DB columns

Corrupted JSON in preset columns poisons entire API responses.

**Files:**
- Modify: `server/routes/presets.js`
- Modify: `server/routes/gridPresets.js`

**Step 1: Wrap JSON.parse calls in try-catch with defaults**

For each `JSON.parse` on a DB column, wrap:
```javascript
function safeJsonParse(str, fallback = {}) {
  try { return JSON.parse(str); }
  catch { return fallback; }
}
```

Apply to `cell_groups`, `group_guidance`, `cell_guidance` column parsing.

**Step 2: Commit**

```bash
git add server/routes/presets.js server/routes/gridPresets.js
git commit -m "fix: handle corrupted JSON in preset DB columns gracefully"
```

---

### Task 16: Remove sharedAbortController module-level mutable state

Hidden global coupling that breaks React's data flow model.

**Files:**
- Modify: `src/hooks/useGenericWorkflow.ts`

**Step 1: Move cancel to context**

The `cancelActiveGeneration()` function uses a module-level `sharedAbortController`. Replace with a context-based approach: store the cancel function in AppContext or a dedicated ref, so external callers access it through React's data flow instead of module-level imports.

**Step 2: Commit**

```bash
git add src/hooks/useGenericWorkflow.ts src/context/AppContext.tsx
git commit -m "refactor: replace module-level sharedAbortController with context-based cancel"
```
