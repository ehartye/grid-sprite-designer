# Hierarchical Guidance System Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use h-superpowers:subagent-driven-development, h-superpowers:team-driven-development, or h-superpowers:executing-plans to implement this plan (ask user which approach).

**Goal:** Replace flat single-blob guidance with a three-level hierarchy (overall → group → cell) across all four sprite types, with grid defaults and content-specific additions composed in a single structured prompt pass.

**Architecture:** Six guidance surfaces per generation — grid overall/group/cell (defaults) plus link overall/group/cell (content-specific additions) plus preset overall/group/cell — built into a `HierarchicalGuidance` type used uniformly by all prompt builders. DB migration renames legacy columns and adds two new JSON columns per affected table. All legacy fallback chains and hardcoded guidance constants are removed.

**Tech Stack:** SQLite (better-sqlite3), Express, React/TypeScript, Gemini API

---

## Task 1: DB Migration

**Files:**
- Modify: `server/db/migrations.js` (append new migration)
- Modify: `server/db/schema.js` (update CREATE TABLE statements for new installs)

**Context:**
The migration system at `server/db/migrations.js` has an array `MIGRATIONS` of `{ name, sql }` objects (current latest: `017_clean_isometric_aspect_ratios`). Each migration runs once and is recorded. The schema at `server/db/schema.js` is used for fresh installs only — both must be updated.

**Step 1: Append migration 018 to `server/db/migrations.js`**

Open `server/db/migrations.js`. Find the `MIGRATIONS` array (starts around line 1). Append this entry at the end of the array, after the `017_clean_isometric_aspect_ratios` object:

```javascript
{
  name: '018_hierarchical_guidance',
  sql: `
    -- grid_presets: rename generic_guidance → overall_guidance, add group/cell
    ALTER TABLE grid_presets RENAME COLUMN generic_guidance TO overall_guidance;
    ALTER TABLE grid_presets ADD COLUMN group_guidance TEXT NOT NULL DEFAULT '{}';
    ALTER TABLE grid_presets ADD COLUMN cell_guidance TEXT NOT NULL DEFAULT '{}';

    -- character_grid_links: rename guidance_override → overall_guidance, add group/cell
    ALTER TABLE character_grid_links RENAME COLUMN guidance_override TO overall_guidance;
    ALTER TABLE character_grid_links ADD COLUMN group_guidance TEXT NOT NULL DEFAULT '{}';
    ALTER TABLE character_grid_links ADD COLUMN cell_guidance TEXT NOT NULL DEFAULT '{}';

    -- building_grid_links
    ALTER TABLE building_grid_links RENAME COLUMN guidance_override TO overall_guidance;
    ALTER TABLE building_grid_links ADD COLUMN group_guidance TEXT NOT NULL DEFAULT '{}';
    ALTER TABLE building_grid_links ADD COLUMN cell_guidance TEXT NOT NULL DEFAULT '{}';

    -- terrain_grid_links
    ALTER TABLE terrain_grid_links RENAME COLUMN guidance_override TO overall_guidance;
    ALTER TABLE terrain_grid_links ADD COLUMN group_guidance TEXT NOT NULL DEFAULT '{}';
    ALTER TABLE terrain_grid_links ADD COLUMN cell_guidance TEXT NOT NULL DEFAULT '{}';

    -- background_grid_links
    ALTER TABLE background_grid_links RENAME COLUMN guidance_override TO overall_guidance;
    ALTER TABLE background_grid_links ADD COLUMN group_guidance TEXT NOT NULL DEFAULT '{}';
    ALTER TABLE background_grid_links ADD COLUMN cell_guidance TEXT NOT NULL DEFAULT '{}';

    -- character_presets: rename row_guidance → overall_guidance, add group/cell
    ALTER TABLE character_presets RENAME COLUMN row_guidance TO overall_guidance;
    ALTER TABLE character_presets ADD COLUMN group_guidance TEXT NOT NULL DEFAULT '{}';
    ALTER TABLE character_presets ADD COLUMN cell_guidance TEXT NOT NULL DEFAULT '{}';

    -- building_presets: rename cell_guidance → overall_guidance (must go before ADD COLUMN)
    ALTER TABLE building_presets RENAME COLUMN cell_guidance TO overall_guidance;
    ALTER TABLE building_presets ADD COLUMN group_guidance TEXT NOT NULL DEFAULT '{}';
    ALTER TABLE building_presets ADD COLUMN cell_guidance TEXT NOT NULL DEFAULT '{}';

    -- terrain_presets: rename tile_guidance → overall_guidance
    ALTER TABLE terrain_presets RENAME COLUMN tile_guidance TO overall_guidance;
    ALTER TABLE terrain_presets ADD COLUMN group_guidance TEXT NOT NULL DEFAULT '{}';
    ALTER TABLE terrain_presets ADD COLUMN cell_guidance TEXT NOT NULL DEFAULT '{}';

    -- background_presets: rename layer_guidance → overall_guidance
    ALTER TABLE background_presets RENAME COLUMN layer_guidance TO overall_guidance;
    ALTER TABLE background_presets ADD COLUMN group_guidance TEXT NOT NULL DEFAULT '{}';
    ALTER TABLE background_presets ADD COLUMN cell_guidance TEXT NOT NULL DEFAULT '{}';
  `,
},
```

**Step 2: Update `server/db/schema.js` for fresh installs**

In `server/db/schema.js`, update every affected table's CREATE TABLE statement. Find and replace each guidance column:

In `grid_presets` (~line 120): change `generic_guidance TEXT DEFAULT ''` to:
```sql
overall_guidance TEXT DEFAULT '',
group_guidance TEXT NOT NULL DEFAULT '{}',
cell_guidance TEXT NOT NULL DEFAULT '{}',
```

In `character_grid_links`, `building_grid_links`, `terrain_grid_links`, `background_grid_links` (~lines 131-172): change `guidance_override TEXT DEFAULT ''` to:
```sql
overall_guidance TEXT DEFAULT '',
group_guidance TEXT NOT NULL DEFAULT '{}',
cell_guidance TEXT NOT NULL DEFAULT '{}',
```

In `character_presets` (~line 63): change `row_guidance TEXT NOT NULL DEFAULT ''` to:
```sql
overall_guidance TEXT NOT NULL DEFAULT '',
group_guidance TEXT NOT NULL DEFAULT '{}',
cell_guidance TEXT NOT NULL DEFAULT '{}',
```

In `building_presets` (~line 77): change `cell_guidance TEXT NOT NULL DEFAULT ''` to:
```sql
overall_guidance TEXT NOT NULL DEFAULT '',
group_guidance TEXT NOT NULL DEFAULT '{}',
cell_guidance TEXT NOT NULL DEFAULT '{}',
```

In `terrain_presets` (~line 87): change `tile_guidance TEXT NOT NULL DEFAULT ''` to:
```sql
overall_guidance TEXT NOT NULL DEFAULT '',
group_guidance TEXT NOT NULL DEFAULT '{}',
cell_guidance TEXT NOT NULL DEFAULT '{}',
```

In `background_presets` (~line 103): change `layer_guidance TEXT NOT NULL DEFAULT ''` to:
```sql
overall_guidance TEXT NOT NULL DEFAULT '',
group_guidance TEXT NOT NULL DEFAULT '{}',
cell_guidance TEXT NOT NULL DEFAULT '{}',
```

**Step 3: Verify migration runs**

```bash
node --input-type=module <<'EOF'
import { getDb } from './server/db/index.js';
const db = getDb();
// Check new columns exist
const cols = db.prepare("PRAGMA table_info(grid_presets)").all().map(c => c.name);
console.assert(cols.includes('overall_guidance'), 'overall_guidance missing from grid_presets');
console.assert(cols.includes('group_guidance'), 'group_guidance missing from grid_presets');
console.assert(cols.includes('cell_guidance'), 'cell_guidance missing from grid_presets');
console.assert(!cols.includes('generic_guidance'), 'generic_guidance still present');
const linkCols = db.prepare("PRAGMA table_info(character_grid_links)").all().map(c => c.name);
console.assert(linkCols.includes('overall_guidance'), 'overall_guidance missing from character_grid_links');
console.assert(!linkCols.includes('guidance_override'), 'guidance_override still present');
const charCols = db.prepare("PRAGMA table_info(character_presets)").all().map(c => c.name);
console.assert(charCols.includes('overall_guidance'), 'overall_guidance missing from character_presets');
console.assert(!charCols.includes('row_guidance'), 'row_guidance still present');
console.log('All column assertions passed.');
EOF
```

Expected: `All column assertions passed.`

**Step 4: Commit**

```bash
git add server/db/migrations.js server/db/schema.js
git commit -m "feat: add migration 018 for hierarchical guidance columns"
```

---

## Task 2: Update Server — presetTables.js and Routes

**Files:**
- Modify: `server/presetTables.js`
- Modify: `server/routes/gridPresets.js`
- Modify: `server/routes/gridLinks.js`
- Modify: `server/routes/presets.js`

**Context:**
`presetTables.js` defines column mappings for generic CRUD. `gridPresets.js` handles GET/POST/PUT for grid presets. `gridLinks.js` handles PUT/DELETE for grid links. `presets.js` has the grid-links GET endpoint that joins grid preset data.

**Step 1: Update `server/presetTables.js`**

Replace the `rowGuidance`/`cellGuidance`/`tileGuidance`/`layerGuidance` column entries with the three new unified columns in all four types. Also add `group_guidance` and `cell_guidance` to each:

```javascript
// server/presetTables.js
export const PRESET_TABLES = {
  character: {
    table: 'character_presets', linkTable: 'character_grid_links', fk: 'character_preset_id',
    columns: [
      ['name', 'name'], ['genre', 'genre', ''], ['description', 'description', ''],
      ['equipment', 'equipment', ''], ['colorNotes', 'color_notes', ''],
      ['overallGuidance', 'overall_guidance', ''],
      ['groupGuidance', 'group_guidance', '{}', true],
      ['cellGuidance', 'cell_guidance', '{}', true],
    ],
  },
  building: {
    table: 'building_presets', linkTable: 'building_grid_links', fk: 'building_preset_id',
    columns: [
      ['name', 'name'], ['genre', 'genre', ''], ['description', 'description', ''],
      ['details', 'details', ''], ['colorNotes', 'color_notes', ''],
      ['gridSize', 'grid_size', '3x3'], ['cellLabels', 'cell_labels', [], true],
      ['overallGuidance', 'overall_guidance', ''],
      ['groupGuidance', 'group_guidance', '{}', true],
      ['cellGuidance', 'cell_guidance', '{}', true],
    ],
  },
  terrain: {
    table: 'terrain_presets', linkTable: 'terrain_grid_links', fk: 'terrain_preset_id',
    columns: [
      ['name', 'name'], ['genre', 'genre', ''], ['description', 'description', ''],
      ['colorNotes', 'color_notes', ''], ['gridSize', 'grid_size', '4x4'],
      ['tileLabels', 'tile_labels', [], true],
      ['overallGuidance', 'overall_guidance', ''],
      ['groupGuidance', 'group_guidance', '{}', true],
      ['cellGuidance', 'cell_guidance', '{}', true],
    ],
  },
  background: {
    table: 'background_presets', linkTable: 'background_grid_links', fk: 'background_preset_id',
    columns: [
      ['name', 'name'], ['genre', 'genre', ''], ['description', 'description', ''],
      ['colorNotes', 'color_notes', ''], ['gridSize', 'grid_size', '1x4'],
      ['bgMode', 'bg_mode', 'parallax'], ['layerLabels', 'layer_labels', [], true],
      ['overallGuidance', 'overall_guidance', ''],
      ['groupGuidance', 'group_guidance', '{}', true],
      ['cellGuidance', 'cell_guidance', '{}', true],
    ],
  },
};
```

Note: The `true` fourth element means the value is JSON-serialized on write and JSON-parsed on read (already handled by `extractPresetValues` and `mapPresetRow` in `utils.js`).

**Step 2: Update `server/routes/gridPresets.js`**

Replace all references to `genericGuidance` with `overallGuidance`, and add the two new fields. Read the full file first to understand current structure, then make these changes:

In the GET handler, update the row mapping (find where `genericGuidance: r.generic_guidance` appears) to:
```javascript
overallGuidance: r.overall_guidance || '',
groupGuidance: JSON.parse(r.group_guidance || '{}'),
cellGuidance: JSON.parse(r.cell_guidance || '{}'),
```

In the POST handler, update the INSERT to include all three columns:
```javascript
// Replace the INSERT statement to include the three guidance columns
const result = db.prepare(`
  INSERT INTO grid_presets (name, sprite_type, genre, grid_size, cols, rows,
    cell_labels, cell_groups, overall_guidance, group_guidance, cell_guidance,
    bg_mode, aspect_ratio, tile_shape, is_preset)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
`).run(
  body.name, body.spriteType, body.genre || '', body.gridSize,
  body.cols, body.rows,
  JSON.stringify(body.cellLabels || []),
  JSON.stringify(body.cellGroups || []),
  body.overallGuidance || '',
  JSON.stringify(body.groupGuidance || {}),
  JSON.stringify(body.cellGuidance || {}),
  body.bgMode || null, body.aspectRatio || '1:1', body.tileShape || 'square'
);
```

In the PUT handler, update the SET clause similarly to include all three guidance fields.

**Step 3: Update `server/routes/gridLinks.js`**

The PUT handler currently only updates `guidance_override` and `sort_order`. Update to accept and save all three guidance levels. Replace the current handler body:

```javascript
router.put('/:type/:id', validatePresetType, (req, res, next) => {
  try {
    const { id } = req.params;
    const config = req.presetConfig;
    const { overallGuidance, groupGuidance, cellGuidance, sortOrder } = req.body;
    const numericId = parseIntParam(id);
    if (numericId === null) return res.status(400).json({ error: 'Invalid id' });
    db.prepare(`
      UPDATE ${config.linkTable}
      SET overall_guidance = ?, group_guidance = ?, cell_guidance = ?, sort_order = ?
      WHERE id = ?
    `).run(
      overallGuidance || '',
      JSON.stringify(groupGuidance || {}),
      JSON.stringify(cellGuidance || {}),
      sortOrder || 0,
      numericId
    );
    res.json({ success: true });
  } catch (err) { next(err); }
});
```

**Step 4: Update `server/routes/presets.js` — grid-links GET**

Find the GET `/:type/:id/grid-links` handler (around line 104). Update the SQL query to select the new columns and update the response mapping.

Replace `g.generic_guidance` with `g.overall_guidance, g.group_guidance, g.cell_guidance` in the SELECT. Replace `l.guidance_override` with `l.overall_guidance, l.group_guidance, l.cell_guidance`. Update the response map:

```javascript
const links = db.prepare(`
  SELECT l.id, l.grid_preset_id, l.sort_order,
         l.overall_guidance as link_overall_guidance,
         l.group_guidance as link_group_guidance,
         l.cell_guidance as link_cell_guidance,
         g.name as grid_name, g.grid_size, g.cols, g.rows,
         g.cell_labels, g.cell_groups,
         g.overall_guidance as grid_overall_guidance,
         g.group_guidance as grid_group_guidance,
         g.cell_guidance as grid_cell_guidance,
         g.bg_mode, g.aspect_ratio, g.tile_shape
  FROM ${table} l
  JOIN grid_presets g ON g.id = l.grid_preset_id
  WHERE l.${fk} = ?
  ORDER BY l.sort_order
`).all(id);

res.json(links.map(l => ({
  id: l.id,
  gridPresetId: l.grid_preset_id,
  gridGuidance: {
    overall: l.grid_overall_guidance || '',
    groups: JSON.parse(l.grid_group_guidance || '{}'),
    cells: JSON.parse(l.grid_cell_guidance || '{}'),
  },
  linkGuidance: {
    overall: l.link_overall_guidance || '',
    groups: JSON.parse(l.link_group_guidance || '{}'),
    cells: JSON.parse(l.link_cell_guidance || '{}'),
  },
  sortOrder: l.sort_order,
  gridName: l.grid_name,
  gridSize: l.grid_size,
  cols: l.cols,
  rows: l.rows,
  cellLabels: JSON.parse(l.cell_labels),
  cellGroups: JSON.parse(l.cell_groups),
  bgMode: l.bg_mode,
  aspectRatio: l.aspect_ratio || '1:1',
  tileShape: l.tile_shape || 'square',
})));
```

Also update the POST `/:type/:id/grid-links` handler to accept `overallGuidance`, `groupGuidance`, `cellGuidance` instead of `guidanceOverride`:

```javascript
const { gridPresetId, overallGuidance, groupGuidance, cellGuidance, sortOrder } = req.body;
if (!gridPresetId) return res.status(400).json({ error: 'Missing gridPresetId' });
const result = db.prepare(`
  INSERT INTO ${table} (${fk}, grid_preset_id, overall_guidance, group_guidance, cell_guidance, sort_order)
  VALUES (?, ?, ?, ?, ?, ?)
`).run(id, gridPresetId,
  overallGuidance || '',
  JSON.stringify(groupGuidance || {}),
  JSON.stringify(cellGuidance || {}),
  sortOrder || 0
);
```

**Step 5: Verify server starts without errors**

```bash
npm run dev
```

Expected: Server starts, no errors about unknown columns. Hit `GET /api/grid-presets` and confirm response includes `overallGuidance`, `groupGuidance`, `cellGuidance` fields.

**Step 6: Commit**

```bash
git add server/presetTables.js server/routes/gridPresets.js server/routes/gridLinks.js server/routes/presets.js
git commit -m "feat: update server routes and presetTables for hierarchical guidance"
```

---

## Task 3: Update TypeScript Types

**Files:**
- Modify: `src/context/AppContext.tsx` (lines 21-52)
- Modify: `src/types/api.ts` (lines 50-73)

**Context:**
`AppContext.tsx` defines `GridPreset`, `GridLink`, `CellGroup`. `api.ts` defines `ContentPreset`. All guidance fields need updating to the new `HierarchicalGuidance` shape.

**Step 1: Add `HierarchicalGuidance` interface to `src/context/AppContext.tsx`**

At the top of the interfaces section (before `CellGroup`), add:

```typescript
export interface HierarchicalGuidance {
  overall: string;
  groups: Record<string, string>;
  cells: Record<string, string>;
}
```

**Step 2: Update `GridPreset` in `src/context/AppContext.tsx`**

Replace `genericGuidance: string;` with:
```typescript
guidance: HierarchicalGuidance;
```

**Step 3: Update `GridLink` in `src/context/AppContext.tsx`**

Replace `guidanceOverride: string;` and `genericGuidance: string;` with:
```typescript
gridGuidance: HierarchicalGuidance;
linkGuidance: HierarchicalGuidance;
```

**Step 4: Update `ContentPreset` in `src/types/api.ts`**

Replace the type-specific guidance fields (`rowGuidance`, `cellGuidance`, `tileGuidance`, `layerGuidance`) with the unified structure. The full interface becomes:

```typescript
export interface ContentPreset {
  id?: string;
  name: string;
  description: string;
  genre?: string;
  // Character-specific
  equipment?: string;
  colorNotes?: string;
  // Building-specific
  details?: string;
  cellLabels?: string[];
  // Terrain-specific
  tileLabels?: string[];
  // Background-specific
  bgMode?: 'parallax' | 'scene';
  // Common
  gridSize?: string;
  styleNotes?: string;
  // Unified guidance (replaces rowGuidance, cellGuidance, tileGuidance, layerGuidance)
  overallGuidance?: string;
  groupGuidance?: Record<string, string>;
  cellGuidance?: Record<string, string>;
}
```

**Step 5: Fix TypeScript compile errors from the type changes**

Run `npm run build` (or `npx tsc --noEmit`) to find all call sites that referenced the old field names. They'll be fixed in subsequent tasks, but note them now:

```bash
npx tsc --noEmit 2>&1 | grep -E "genericGuidance|guidanceOverride|rowGuidance|cellGuidance.*string|tileGuidance|layerGuidance" | head -30
```

**Step 6: Commit**

```bash
git add src/context/AppContext.tsx src/types/api.ts
git commit -m "feat: update TypeScript types for hierarchical guidance"
```

---

## Task 4: Implement `buildGuidanceBlock` in promptBuilderBase.ts

**Files:**
- Modify: `src/lib/promptBuilderBase.ts` (full rewrite of guidance utilities)

**Context:**
`promptBuilderBase.ts` currently exports `buildCellDescriptions()`, `composeGuidance()`, `CLOSING_INSTRUCTION`, `PIXELIZE_GUIDANCE`, `getPixelizeGuidance()`, and `REFERENCE_PREFIX`. We remove `buildCellDescriptions` and `composeGuidance` and add `buildGuidanceBlock`. The rest stays.

**Step 1: Write failing test for `buildGuidanceBlock`**

Create `src/lib/__tests__/promptBuilderBase.test.ts`:

```typescript
import { buildGuidanceBlock } from '../promptBuilderBase';
import type { HierarchicalGuidance } from '../../context/AppContext';
import type { CellGroup } from '../../context/AppContext';

const empty: HierarchicalGuidance = { overall: '', groups: {}, cells: {} };

const cellGroups: CellGroup[] = [
  { name: 'Walk Down Animation Frames', cells: [0, 1, 2] },
  { name: 'Walk Up Animation Frames', cells: [3, 4, 5] },
];
const cellLabels = ['Walk Down 1', 'Walk Down 2', 'Walk Down 3', 'Walk Up 1', 'Walk Up 2', 'Walk Up 3'];

test('includes overall guidance from grid source', () => {
  const grid: HierarchicalGuidance = { overall: 'Grid overall.', groups: {}, cells: {} };
  const result = buildGuidanceBlock(grid, empty, empty, cellGroups, cellLabels, 6);
  expect(result).toContain('Grid overall.');
});

test('composes cell guidance from all three sources', () => {
  const grid: HierarchicalGuidance = { overall: '', groups: {}, cells: { 'Walk Down 1': 'Default walk.' } };
  const link: HierarchicalGuidance = { overall: '', groups: {}, cells: { 'Walk Down 1': 'Link addition.' } };
  const preset: HierarchicalGuidance = { overall: '', groups: {}, cells: { 'Walk Down 1': 'Preset detail.' } };
  const result = buildGuidanceBlock(grid, link, preset, cellGroups, cellLabels, 6);
  expect(result).toContain('Default walk.');
  expect(result).toContain('Link addition.');
  expect(result).toContain('Preset detail.');
});

test('cell appears within its group section', () => {
  const grid: HierarchicalGuidance = { overall: '', groups: {}, cells: { 'Walk Down 1': 'stride desc' } };
  const result = buildGuidanceBlock(grid, empty, empty, cellGroups, cellLabels, 6);
  const groupIdx = result.indexOf('Walk Down Animation Frames');
  const cellIdx = result.indexOf('Walk Down 1');
  expect(groupIdx).toBeGreaterThan(-1);
  expect(cellIdx).toBeGreaterThan(groupIdx);
});

test('omits sections with no guidance', () => {
  const result = buildGuidanceBlock(empty, empty, empty, cellGroups, cellLabels, 6);
  // Should still list all cells but no guidance text
  expect(result).toContain('Walk Down 1');
  expect(result).not.toContain('OVERALL GUIDANCE');
});

test('group guidance appears before cells in that group', () => {
  const grid: HierarchicalGuidance = {
    overall: '', groups: { 'Walk Down Animation Frames': 'Group note.' }, cells: { 'Walk Down 1': 'Cell note.' }
  };
  const result = buildGuidanceBlock(grid, empty, empty, cellGroups, cellLabels, 6);
  const groupNoteIdx = result.indexOf('Group note.');
  const cellNoteIdx = result.indexOf('Cell note.');
  expect(groupNoteIdx).toBeGreaterThan(-1);
  expect(cellNoteIdx).toBeGreaterThan(groupNoteIdx);
});
```

**Step 2: Run test to verify it fails**

```bash
npx jest src/lib/__tests__/promptBuilderBase.test.ts
```

Expected: FAIL — `buildGuidanceBlock is not exported`

**Step 3: Implement `buildGuidanceBlock` in `src/lib/promptBuilderBase.ts`**

Replace the `buildCellDescriptions` and `composeGuidance` exports with `buildGuidanceBlock`. Keep `CLOSING_INSTRUCTION`, `PIXELIZE_GUIDANCE`, `getPixelizeGuidance`, and `REFERENCE_PREFIX` unchanged.

```typescript
import type { CellGroup, HierarchicalGuidance } from '../context/AppContext';

/**
 * Compose the full guidance block for a prompt, iterating groups then cells.
 * Merges grid defaults, link-level additions, and preset-level additions at each level.
 * Empty sources are silently omitted.
 */
export function buildGuidanceBlock(
  gridGuidance: HierarchicalGuidance,
  linkGuidance: HierarchicalGuidance,
  presetGuidance: HierarchicalGuidance,
  cellGroups: CellGroup[],
  cellLabels: string[],
  cols: number,
): string {
  const parts: string[] = [];

  // Overall section
  const overallParts = [gridGuidance.overall, linkGuidance.overall, presetGuidance.overall]
    .map(s => s?.trim()).filter(Boolean);
  if (overallParts.length) {
    parts.push(`OVERALL GUIDANCE:\n${overallParts.join('\n')}`);
  }

  // Determine which cell indices belong to groups
  const groupedIndices = new Set(cellGroups.flatMap(g => g.cells));

  // Group-by-group, cell-by-cell
  for (const group of cellGroups) {
    const groupLines: string[] = [];

    // Group-level guidance
    const groupGuidanceParts = [
      gridGuidance.groups[group.name],
      linkGuidance.groups[group.name],
      presetGuidance.groups[group.name],
    ].map(s => s?.trim()).filter(Boolean);
    if (groupGuidanceParts.length) {
      groupLines.push(groupGuidanceParts.join('\n'));
    }

    // Cells in this group
    for (const cellIdx of group.cells) {
      const label = cellLabels[cellIdx];
      if (!label) continue;
      const row = Math.floor(cellIdx / cols);
      const col = cellIdx % cols;

      const cellGuidanceParts = [
        gridGuidance.cells[label],
        linkGuidance.cells[label],
        presetGuidance.cells[label],
      ].map(s => s?.trim()).filter(Boolean);

      const header = `  Cell "${label}" (${row},${col})`;
      if (cellGuidanceParts.length) {
        groupLines.push(`${header}:\n    ${cellGuidanceParts.join('\n    ')}`);
      } else {
        groupLines.push(header);
      }
    }

    parts.push(`GROUP: ${group.name}\n${groupLines.join('\n\n')}`);
  }

  // Ungrouped cells
  const ungroupedCells = cellLabels
    .map((label, idx) => ({ label, idx }))
    .filter(({ idx }) => !groupedIndices.has(idx) && cellLabels[idx]);

  if (ungroupedCells.length) {
    const ungroupedLines = ungroupedCells.map(({ label, idx }) => {
      const row = Math.floor(idx / cols);
      const col = idx % cols;
      const cellGuidanceParts = [
        gridGuidance.cells[label],
        linkGuidance.cells[label],
        presetGuidance.cells[label],
      ].map(s => s?.trim()).filter(Boolean);
      const header = `  Cell "${label}" (${row},${col})`;
      return cellGuidanceParts.length
        ? `${header}:\n    ${cellGuidanceParts.join('\n    ')}`
        : header;
    });
    parts.push(`UNGROUPED CELLS\n${ungroupedLines.join('\n\n')}`);
  }

  return parts.join('\n\n---\n\n');
}
```

Also remove the `buildCellDescriptions` and `composeGuidance` function exports (they will no longer be used). Keep the imports for `GridConfig` only if still needed (it won't be after this task).

**Step 4: Run tests to verify they pass**

```bash
npx jest src/lib/__tests__/promptBuilderBase.test.ts
```

Expected: 5 tests passing.

**Step 5: Commit**

```bash
git add src/lib/promptBuilderBase.ts src/lib/__tests__/promptBuilderBase.test.ts
git commit -m "feat: implement buildGuidanceBlock, remove legacy composeGuidance/buildCellDescriptions"
```

---

## Task 5: Rewrite Character Prompt Builder

**Files:**
- Modify: `src/lib/promptBuilder.ts` (full rewrite)

**Context:**
`promptBuilder.ts` exports `CharacterConfig`, `buildGridFillPrompt`, and `buildGridFillPromptWithReference`. The new version removes `rowGuidance` from `CharacterConfig`, removes the `GENERIC_ROW_GUIDANCE` constant, and replaces the guidance section with a call to `buildGuidanceBlock`.

**Step 1: Update `CharacterConfig` interface**

Remove `rowGuidance` from the interface. The new interface:

```typescript
export interface CharacterConfig {
  name: string;
  description: string;
  equipment: string;
  colorNotes: string;
  styleNotes: string;
}
```

**Step 2: Remove `GENERIC_ROW_GUIDANCE` constant**

Delete the entire `GENERIC_ROW_GUIDANCE` constant (lines ~18-139). It is no longer used — all guidance now comes from the DB.

**Step 3: Rewrite `buildGridFillPrompt`**

Replace the function signature and body. The new version takes `HierarchicalGuidance` objects instead of flat strings:

```typescript
import { buildGuidanceBlock, CLOSING_INSTRUCTION, REFERENCE_PREFIX } from './promptBuilderBase';
import type { CellGroup, HierarchicalGuidance } from '../context/AppContext';

/**
 * Build the full prompt for filling a character sprite sheet.
 */
export function buildGridFillPrompt(
  character: CharacterConfig,
  gridGuidance: HierarchicalGuidance,
  linkGuidance: HierarchicalGuidance,
  presetGuidance: HierarchicalGuidance,
  cellGroups: CellGroup[],
  cellLabels: string[],
  cols: number,
  rows: number,
): string {
  const totalCells = cols * rows;

  const charBlock = [
    `Fill every pink cell area with a pixel-art sprite of a ${character.name.toUpperCase()} character.`,
    ``,
    `Character appearance: ${character.description}`,
    character.equipment ? `Equipment: ${character.equipment}` : '',
    character.colorNotes ? `Color palette: ${character.colorNotes}` : '',
    character.styleNotes ? `Additional style notes: ${character.styleNotes}` : '',
  ].filter(Boolean).join('\n');

  const guidanceBlock = buildGuidanceBlock(
    gridGuidance, linkGuidance, presetGuidance, cellGroups, cellLabels, cols
  );

  return `\
You are filling in a sprite sheet template. The attached image is a ${cols}×${rows} grid \
(${totalCells} cells) on a bright magenta (#FF00FF) chroma-key background. Each cell has \
a thin black header strip with white text labeling the pose. You MUST preserve \
every header strip and its text exactly as-is — do not erase, move, or redraw them.

${charBlock}

Keep the magenta #FF00FF background behind each sprite for chroma keying.
Do NOT draw outside the cell boundaries or over the black grid lines.

CENTERING IS CRITICAL: Every sprite must be precisely centered both
horizontally and vertically within its cell's pink content area (below the
header strip). The character's feet should rest at a consistent baseline
roughly 80% down the cell, and the sprite should be horizontally centered
with equal pink space on the left and right. Standing poses should all share
the same vertical baseline so they tile cleanly. Even action poses (attack
swings, casting, damage recoil) must keep the character's center of mass
near the middle of the cell — do not let poses drift to the edges. KO/lying
poses should be centered horizontally even though they are low to the ground.

EQUIPMENT CONSISTENCY: Held items must stay in the same hand across all
poses — if the character wields a sword in their right hand, it remains in
the right hand in every cell (side-view poses naturally mirror this).
Back-worn items (capes, backpacks, slung shields, quivers, sheathed weapons)
must appear consistently on the character's back in every pose where the
back or side is visible. Do not omit, move, or swap equipment between cells.

FULL BODY VISIBILITY: The character's entire body must be visible within every
cell — nothing clipped or cut off. Scale the sprite to fit comfortably with a
margin of pink background on all sides. Effects (shadows, auras, VFX) must stay
fully within the cell and not bleed into adjacent cells.

MOVEMENT CONTINUITY: In animation sequences, body position must alternate
naturally between frames. If the character's right leg is forward in one frame,
the next stride forward uses the left leg. Arms and other limbs follow the same
principle — each frame progresses the motion cycle rather than repeating or
mirroring the same position.

Below is the exact layout. Each cell must match its header's pose exactly.

${guidanceBlock}

${CLOSING_INSTRUCTION}`;
}

/**
 * Build prompt for subsequent grids in a multi-grid run (reference image provided).
 */
export function buildGridFillPromptWithReference(
  character: CharacterConfig,
  gridGuidance: HierarchicalGuidance,
  linkGuidance: HierarchicalGuidance,
  presetGuidance: HierarchicalGuidance,
  cellGroups: CellGroup[],
  cellLabels: string[],
  cols: number,
  rows: number,
): string {
  const base = buildGridFillPrompt(
    character, gridGuidance, linkGuidance, presetGuidance, cellGroups, cellLabels, cols, rows
  ).replace(
    'You are filling in a sprite sheet template. The attached image is',
    'You are filling in a sprite sheet template. IMAGE 2 is',
  );
  return REFERENCE_PREFIX + base;
}
```

**Step 4: Commit**

```bash
git add src/lib/promptBuilder.ts
git commit -m "feat: rewrite character prompt builder to use HierarchicalGuidance"
```

---

## Task 6: Rewrite Building, Terrain, Background Prompt Builders

**Files:**
- Modify: `src/lib/buildingPromptBuilder.ts`
- Modify: `src/lib/terrainPromptBuilder.ts`
- Modify: `src/lib/backgroundPromptBuilder.ts`

**Context:**
Each currently takes `gridGenericGuidance?: string` and `guidanceOverride?: string` and calls `composeGuidance()` and `buildCellDescriptions()`. Replace with the `HierarchicalGuidance` pattern.

**Step 1: Update `BuildingConfig` in `buildingPromptBuilder.ts`**

Remove `cellGuidance: string` from the interface. The new interface:
```typescript
export interface BuildingConfig {
  name: string;
  description: string;
  details: string;
  colorNotes: string;
  styleNotes: string;
}
```

Update `buildBuildingPrompt` signature to:
```typescript
export function buildBuildingPrompt(
  building: BuildingConfig,
  gridGuidance: HierarchicalGuidance,
  linkGuidance: HierarchicalGuidance,
  presetGuidance: HierarchicalGuidance,
  cellGroups: CellGroup[],
  cellLabels: string[],
  cols: number,
  rows: number,
): string
```

Replace the `composeGuidance(...)` call and `buildCellDescriptions(...)` call with `buildGuidanceBlock(gridGuidance, linkGuidance, presetGuidance, cellGroups, cellLabels, cols)`.

Keep all the building-specific preamble text (CHROMA BACKGROUND SACRED, centering rules, etc.) but replace the guidance assembly at the end.

**Step 2: Update `TerrainConfig` in `terrainPromptBuilder.ts`**

Remove `tileGuidance: string`. Same signature update and `buildGuidanceBlock` replacement.

**Step 3: Update `BackgroundConfig` in `backgroundPromptBuilder.ts`**

Remove `layerGuidance: string`. Same pattern.

**Step 4: Commit**

```bash
git add src/lib/buildingPromptBuilder.ts src/lib/terrainPromptBuilder.ts src/lib/backgroundPromptBuilder.ts
git commit -m "feat: update building/terrain/background prompt builders to use HierarchicalGuidance"
```

---

## Task 7: Update `promptForType.ts`

**Files:**
- Modify: `src/lib/promptForType.ts`

**Context:**
`promptForType.ts` is the dispatcher. It currently builds type-specific config objects from `contentPreset` (extracting `rowGuidance` etc.) and passes `gridLink.genericGuidance` / `gridLink.guidanceOverride` to each builder. All of this changes.

**Step 1: Update `buildPromptForType`**

The function now reads `HierarchicalGuidance` from `gridLink.gridGuidance`, `gridLink.linkGuidance`, and builds `presetGuidance` from the content preset's new fields. Full new implementation:

```typescript
export function buildPromptForType(
  spriteType: SpriteType,
  contentPreset: ContentPreset,
  gridLink: GridLink,
  gridConfig: GridConfig,
  isSubsequentGrid: boolean,
  pixelizeSize?: number,
): string {
  const { gridGuidance, linkGuidance, cellGroups, cellLabels, cols, rows } = gridLink;

  // Build preset-level guidance from the content preset's guidance fields
  const presetGuidance: HierarchicalGuidance = {
    overall: contentPreset.overallGuidance || '',
    groups: contentPreset.groupGuidance || {},
    cells: contentPreset.cellGuidance || {},
  };

  let prompt: string;

  switch (spriteType) {
    case 'character': {
      const charConfig: CharacterConfig = {
        name: contentPreset.name,
        description: contentPreset.description,
        equipment: contentPreset.equipment || '',
        colorNotes: contentPreset.colorNotes || '',
        styleNotes: '',
      };
      if (isSubsequentGrid) {
        prompt = buildGridFillPromptWithReference(
          charConfig, gridGuidance, linkGuidance, presetGuidance,
          cellGroups, cellLabels, cols, rows,
        );
      } else {
        prompt = buildGridFillPrompt(
          charConfig, gridGuidance, linkGuidance, presetGuidance,
          cellGroups, cellLabels, cols, rows,
        );
      }
      break;
    }
    case 'building': {
      const buildingConfig: BuildingConfig = {
        name: contentPreset.name,
        description: contentPreset.description,
        details: contentPreset.details || '',
        colorNotes: contentPreset.colorNotes || '',
        styleNotes: '',
      };
      prompt = buildBuildingPrompt(
        buildingConfig, gridGuidance, linkGuidance, presetGuidance,
        cellGroups, cellLabels, cols, rows,
      );
      if (isSubsequentGrid) prompt = REFERENCE_PREFIX + prompt.replace('The attached image is', 'IMAGE 2 is');
      break;
    }
    case 'terrain': {
      const terrainConfig: TerrainConfig = {
        name: contentPreset.name,
        description: contentPreset.description,
        colorNotes: contentPreset.colorNotes || '',
        styleNotes: '',
      };
      prompt = buildTerrainPrompt(
        terrainConfig, gridGuidance, linkGuidance, presetGuidance,
        cellGroups, cellLabels, cols, rows,
      );
      if (isSubsequentGrid) prompt = REFERENCE_PREFIX + prompt.replace('The attached image is', 'IMAGE 2 is');
      break;
    }
    case 'background': {
      const bgConfig: BackgroundConfig = {
        name: contentPreset.name,
        description: contentPreset.description,
        colorNotes: contentPreset.colorNotes || '',
        styleNotes: '',
        bgMode: contentPreset.bgMode || (gridLink.bgMode as 'parallax' | 'scene') || 'parallax',
      };
      prompt = buildBackgroundPrompt(
        bgConfig, gridGuidance, linkGuidance, presetGuidance,
        cellGroups, cellLabels, cols, rows,
      );
      if (isSubsequentGrid) prompt = REFERENCE_PREFIX + prompt.replace('The attached image is', 'IMAGE 2 is');
      break;
    }
    default:
      throw new Error(`Unknown sprite type: ${spriteType}`);
  }

  const g = getPixelizeGuidance(pixelizeSize);
  if (g) prompt += '\n\n' + g;

  return prompt;
}
```

Also fix any remaining TypeScript errors from the type changes (remove `gridLink.genericGuidance`, `gridLink.guidanceOverride` references, update `gridPresetToConfig` if it reads from `gridLink`).

**Step 2: Fix `gridPresetToConfig` in `src/lib/gridConfig.ts`**

Find `gridPresetToConfig` which converts a `GridLink` into a `GridConfig`. Remove any reference to `genericGuidance` or `guidanceOverride`. `GridConfig` likely just needs `cols`, `rows`, `cellLabels`, `cellGroups`, `totalCells` — no guidance fields.

**Step 3: Fix `useGenericWorkflow.ts` and `useAddSheet.ts`**

In `useGenericWorkflow.ts`, find `WORKFLOW_CONFIGS` and any place that reads `rowGuidance`, `cellGuidance` etc. from content state. Remove those references — guidance now comes through `contentPreset.overallGuidance` etc.

In `useAddSheet.ts`, verify no direct guidance field reads beyond what's passed to `buildPromptForType`.

**Step 4: Run TypeScript check**

```bash
npx tsc --noEmit
```

Expected: Zero errors.

**Step 5: Commit**

```bash
git add src/lib/promptForType.ts src/lib/gridConfig.ts src/hooks/useGenericWorkflow.ts src/hooks/useAddSheet.ts
git commit -m "feat: update promptForType dispatcher and hooks to use HierarchicalGuidance"
```

---

## Task 8: Write Guidance Decomposer and Update gridPresets Seed

**Files:**
- Create: `server/db/seeds/decomposeGuidance.js` (helper)
- Modify: `server/db/seeds/gridPresets.js`

**Context:**
Existing guidance blobs use the format `Header "Label" (r,c): text...` with multi-line cell descriptions. We parse these into `cell_guidance` JSON dicts. Everything that isn't a `Header "..."` line goes into `overall_guidance`. `group_guidance` starts as `{}` (to be filled via UI later).

**Step 1: Create `server/db/seeds/decomposeGuidance.js`**

```javascript
/**
 * Parse a guidance blob in the `Header "Label" (r,c): text...` format into
 * { overall, groups, cells } structure.
 *
 * - Lines matching `  Header "LABEL" (r,c): ...` → cells["LABEL"]
 * - Continuation lines (4+ space indent) belong to the previous cell
 * - All other lines → overall (preamble text, ROW headers, etc.)
 */
export function decomposeGuidanceBlob(blob) {
  if (!blob?.trim()) return { overall: '', groups: {}, cells: {} };

  const lines = blob.split('\n');
  const cells = {};
  const nonCellLines = [];

  let currentLabel = null;
  let currentLines = [];

  const cellHeaderRegex = /^ {1,8}Header\s+"([^"]+)"\s+\(\d+,\d+\)\s*:\s*(.*)/;

  function flushCell() {
    if (currentLabel !== null) {
      const text = currentLines.join('\n').trim();
      if (text) cells[currentLabel] = text;
      currentLabel = null;
      currentLines = [];
    }
  }

  for (const line of lines) {
    const match = line.match(cellHeaderRegex);
    if (match) {
      flushCell();
      currentLabel = match[1];
      const rest = match[2].trim();
      if (rest) currentLines.push(rest);
    } else if (currentLabel !== null && /^ {4}/.test(line)) {
      // Continuation line for current cell (4+ space indent)
      const trimmed = line.trim();
      if (trimmed) currentLines.push(trimmed);
    } else {
      flushCell();
      nonCellLines.push(line);
    }
  }
  flushCell();

  return {
    overall: nonCellLines.join('\n').trim(),
    groups: {},
    cells,
  };
}
```

**Step 2: Verify decomposer handles RPG Full guidance correctly**

```bash
node --input-type=module <<'EOF'
import { getDb } from './server/db/index.js';
import { decomposeGuidanceBlob } from './server/db/seeds/decomposeGuidance.js';

const db = getDb();
const row = db.prepare("SELECT overall_guidance, cell_labels FROM grid_presets WHERE name='RPG Full'").get();
const labels = JSON.parse(row.cell_labels);
const result = decomposeGuidanceBlob(row.overall_guidance);

console.log('Cell labels found:', Object.keys(result.cells).length, 'of', labels.length);
console.log('Missing cells:', labels.filter(l => !result.cells[l]));
console.log('Overall (first 100):', result.overall.slice(0, 100));
console.log('Sample cell (Walk Down 1):', result.cells['Walk Down 1']?.slice(0, 80));
EOF
```

Expected: Most cell labels found (some may be missing if the current `overall_guidance` doesn't have all cells — that's OK, partial decomposition is acceptable).

**Step 3: Update `server/db/seeds/gridPresets.js`**

Import `decomposeGuidanceBlob` and use it to pre-decompose all existing guidance blobs when building the seed data. Update the insert statement and each grid's object to include `group_guidance` and `cell_guidance`.

The insert statement changes from:
```javascript
insertGrid.run(name, spriteType, genre, gridSize, cols, rows, cellLabels, cellGroups, genericGuidance, bgMode);
```

To:
```javascript
const { overall, groups, cells } = decomposeGuidanceBlob(rawGuidance);
insertGrid.run(
  name, spriteType, genre, gridSize, cols, rows, cellLabels, cellGroups,
  overall,
  JSON.stringify(groups),
  JSON.stringify(cells),
  bgMode
);
```

Update the `INSERT INTO grid_presets` statement to include `overall_guidance, group_guidance, cell_guidance` instead of `generic_guidance`.

Update the RPG Full guidance variable to reflect the current cell layout (with the new labels: Walk Down/Up/Left/Right, Idle Down/Up/Left/Right, Critical, Weak, Attack 1-3, Special 1-3, Damage 1-3, KO 1-3, Battle Idle 1-3, Victory 1-3). Write out the guidance blob in the same `Header "Label" (r,c): ...` format for each of the 36 cells.

Do the same for Athletic Movement 1 and any other grid presets with guidance text.

**Step 4: Verify seed produces correct output on a fresh DB**

```bash
node --input-type=module <<'EOF'
import { getDb } from './server/db/index.js';
const db = getDb();
const row = db.prepare("SELECT name, overall_guidance, group_guidance, cell_guidance FROM grid_presets WHERE name='RPG Full'").get();
const cells = JSON.parse(row.cell_guidance);
console.log('RPG Full cell count:', Object.keys(cells).length);
console.log('Walk Down 1:', cells['Walk Down 1']?.slice(0, 60));
console.log('group_guidance:', row.group_guidance);
EOF
```

Expected: `cell_count` > 0, Walk Down 1 has guidance text, group_guidance is `{}` (groups filled via UI later).

**Step 5: Commit**

```bash
git add server/db/seeds/decomposeGuidance.js server/db/seeds/gridPresets.js
git commit -m "feat: decompose grid preset guidance blobs into cell_guidance JSON"
```

---

## Task 9: Update Character Presets Seed

**Files:**
- Modify: `server/db/seeds/characterPresets.js`

**Context:**
Each character preset has a `rowGuidance` blob with `Header "Label" (r,c): ...` sections. Decompose these into `cell_guidance`. The insert statement uses `row_guidance` column (now renamed to `overall_guidance`).

**Step 1: Update import and decompose each preset's `rowGuidance`**

At the top of `characterPresets.js`, add:
```javascript
import { decomposeGuidanceBlob } from './decomposeGuidance.js';
```

Update the PRESETS array: rename `rowGuidance` to `rawGuidance` in each preset object (this is a temp field used during seeding only).

Update the insert statement from:
```javascript
insert.run(p.id, p.name, p.genre, p.description, p.equipment, p.colorNotes, p.rowGuidance);
```

To:
```javascript
const { overall, groups, cells } = decomposeGuidanceBlob(p.rawGuidance);
insert.run(p.id, p.name, p.genre, p.description, p.equipment, p.colorNotes,
  overall, JSON.stringify(groups), JSON.stringify(cells));
```

Update the INSERT SQL to use `overall_guidance, group_guidance, cell_guidance` instead of `row_guidance`:
```javascript
const insert = db.prepare(`
  INSERT OR IGNORE INTO character_presets
    (id, name, genre, description, equipment, color_notes, overall_guidance, group_guidance, cell_guidance, is_preset)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
`);
```

**Step 2: Verify decomposition on an existing preset**

```bash
node --input-type=module <<'EOF'
import { getDb } from './server/db/index.js';
const db = getDb();
const row = db.prepare("SELECT name, cell_guidance FROM character_presets WHERE id='cecil-paladin'").get();
if (row) {
  const cells = JSON.parse(row.cell_guidance || '{}');
  console.log('Cecil cell guidance count:', Object.keys(cells).length);
  console.log('Sample:', Object.entries(cells)[0]);
} else {
  console.log('Cecil not found (INSERT OR IGNORE skips if already seeded — check a fresh DB)');
}
EOF
```

**Step 3: Commit**

```bash
git add server/db/seeds/characterPresets.js
git commit -m "feat: decompose character preset rowGuidance into cell_guidance JSON"
```

---

## Task 10: Update Building, Terrain, Background Preset Seeds

**Files:**
- Modify: `server/db/seeds/buildingPresets.js`
- Modify: `server/db/seeds/terrainPresets.js`
- Modify: `server/db/seeds/backgroundPresets.js`

**Context:**
Same pattern as character presets. Each has a type-specific guidance field (cellGuidance, tileGuidance, layerGuidance) that needs decomposing. Column names in DB are now `overall_guidance`, `group_guidance`, `cell_guidance` for all types.

**Step 1: Update `buildingPresets.js`**

- Import `decomposeGuidanceBlob`
- Rename `cellGuidance` → `rawGuidance` in each preset object
- Update INSERT SQL to use `overall_guidance, group_guidance, cell_guidance`
- Decompose `rawGuidance` before insert

**Step 2: Update `terrainPresets.js`**

- Same pattern: `tileGuidance` → `rawGuidance`

**Step 3: Update `backgroundPresets.js`**

- Same pattern: `layerGuidance` → `rawGuidance`

**Step 4: Verify server starts and seeds without errors**

```bash
npm run dev
```

Expected: `[DB] Seeded N building presets`, `[DB] Seeded N terrain presets`, `[DB] Seeded N background presets` — no errors.

**Step 5: Commit**

```bash
git add server/db/seeds/buildingPresets.js server/db/seeds/terrainPresets.js server/db/seeds/backgroundPresets.js
git commit -m "feat: decompose building/terrain/background guidance blobs into cell_guidance JSON"
```

---

## Task 11: Update Grid Preset Editor UI (`GridPresetsTab.tsx`)

**Files:**
- Modify: `src/components/admin/GridPresetsTab.tsx`

**Context:**
The editor currently has a single `genericGuidance` textarea. Replace with three sections: Overall (textarea), Group (one textarea per group from `cellGroups`), Cell (one textarea per cell from `cellLabels`).

**Step 1: Update `EditingPreset` interface and `emptyPreset()`**

Replace `genericGuidance: string` with:
```typescript
overallGuidance: string;
groupGuidance: Record<string, string>;
cellGuidance: Record<string, string>;
```

Update `emptyPreset()`:
```typescript
overallGuidance: '',
groupGuidance: {},
cellGuidance: {},
```

**Step 2: Update `handleSave` body**

Replace `genericGuidance: editing.genericGuidance` with:
```javascript
overallGuidance: editing.overallGuidance,
groupGuidance: editing.groupGuidance,
cellGuidance: editing.cellGuidance,
```

**Step 3: Update load logic**

When loading a preset into `editing` state (find where `setEditing({ ...preset, ... })` is called), map the new fields:
```javascript
overallGuidance: preset.guidance.overall,
groupGuidance: preset.guidance.groups,
cellGuidance: preset.guidance.cells,
```

**Step 4: Replace the guidance textarea in the form**

Find the single `genericGuidance` textarea and replace it with three sections:

```tsx
{/* Overall Guidance */}
<label className="admin-label">
  Overall Guidance
  <textarea
    className="admin-textarea"
    rows={4}
    value={editing.overallGuidance}
    onChange={e => setEditing(prev => prev ? { ...prev, overallGuidance: e.target.value } : null)}
    placeholder="Overall guidance that applies to all cells..."
  />
</label>

{/* Group Guidance — one per cell group */}
{editing.cellGroups.length > 0 && (
  <div className="admin-subsection">
    <h5 className="admin-subsection-title">Group Guidance</h5>
    {editing.cellGroups.map(group => (
      <label key={group.name} className="admin-label">
        {group.name}
        <textarea
          className="admin-textarea"
          rows={2}
          value={editing.groupGuidance[group.name] || ''}
          onChange={e => setEditing(prev => prev ? {
            ...prev,
            groupGuidance: { ...prev.groupGuidance, [group.name]: e.target.value }
          } : null)}
          placeholder={`Guidance for ${group.name} group...`}
        />
      </label>
    ))}
  </div>
)}

{/* Cell Guidance — one per cell label */}
{editing.cellLabels.filter(Boolean).length > 0 && (
  <div className="admin-subsection">
    <h5 className="admin-subsection-title">Cell Guidance</h5>
    {editing.cellLabels.map((label, idx) => {
      if (!label) return null;
      const row = Math.floor(idx / editing.cols);
      const col = idx % editing.cols;
      return (
        <label key={idx} className="admin-label">
          {label} ({row},{col})
          <textarea
            className="admin-textarea"
            rows={2}
            value={editing.cellGuidance[label] || ''}
            onChange={e => setEditing(prev => prev ? {
              ...prev,
              cellGuidance: { ...prev.cellGuidance, [label]: e.target.value }
            } : null)}
            placeholder={`Guidance for "${label}"...`}
          />
        </label>
      );
    })}
  </div>
)}
```

**Step 5: Commit**

```bash
git add src/components/admin/GridPresetsTab.tsx
git commit -m "feat: update GridPresetsTab to three-level guidance UI"
```

---

## Task 12: Update Link Editor UI (`LinkedGridPresets.tsx`)

**Files:**
- Modify: `src/components/admin/LinkedGridPresets.tsx`

**Context:**
The link editor has one `guidanceOverride` textarea per link. Replace with three sections. The group and cell textareas use keys from `link.cellGroups` and `link.cellLabels` (already available on the `GridLink` object).

**Step 1: Update local link state shape**

The `links` state array holds `GridLink` objects. The new `GridLink` has `gridGuidance` and `linkGuidance` instead of flat fields. Update all references accordingly.

**Step 2: Update `updateGuidance` call signature**

The function that POSTs to `/api/grid-links/:type/:id` needs to send `overallGuidance`, `groupGuidance`, `cellGuidance`. Update:

```typescript
const updateGuidance = async (linkId: number, overallGuidance: string, groupGuidance: Record<string, string>, cellGuidance: Record<string, string>, sortOrder: number) => {
  await fetch(`/api/grid-links/${spriteType}/${linkId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ overallGuidance, groupGuidance, cellGuidance, sortOrder }),
  });
};
```

**Step 3: Replace guidance override section with three-section UI**

Find the guidance textarea section in the link map (around line 128-142) and replace with:

```tsx
{/* Overall link guidance */}
<label className="admin-label" style={{ marginBottom: '0.25rem' }}>
  Overall Guidance (content-specific additions)
  <textarea
    className="admin-textarea"
    rows={2}
    value={link.linkGuidance.overall}
    onChange={e => {
      setLinks(links.map(l => l.id === link.id
        ? { ...l, linkGuidance: { ...l.linkGuidance, overall: e.target.value } }
        : l));
    }}
    onBlur={() => updateGuidance(link.id, link.linkGuidance.overall, link.linkGuidance.groups, link.linkGuidance.cells, link.sortOrder)}
    placeholder="Overall content-specific additions..."
  />
</label>

{/* Group-level link guidance */}
{link.cellGroups.length > 0 && (
  <details>
    <summary className="admin-label" style={{ cursor: 'pointer' }}>Group Guidance</summary>
    {link.cellGroups.map(group => (
      <label key={group.name} className="admin-label" style={{ marginLeft: '1rem' }}>
        {group.name}
        <textarea
          className="admin-textarea"
          rows={2}
          value={link.linkGuidance.groups[group.name] || ''}
          onChange={e => {
            setLinks(links.map(l => l.id === link.id
              ? { ...l, linkGuidance: { ...l.linkGuidance, groups: { ...l.linkGuidance.groups, [group.name]: e.target.value } } }
              : l));
          }}
          onBlur={() => updateGuidance(link.id, link.linkGuidance.overall, link.linkGuidance.groups, link.linkGuidance.cells, link.sortOrder)}
          placeholder={`${group.name} additions...`}
        />
      </label>
    ))}
  </details>
)}

{/* Cell-level link guidance */}
{link.cellLabels.filter(Boolean).length > 0 && (
  <details>
    <summary className="admin-label" style={{ cursor: 'pointer' }}>Cell Guidance</summary>
    {link.cellLabels.map((label, idx) => {
      if (!label) return null;
      const row = Math.floor(idx / link.cols);
      const col = idx % link.cols;
      return (
        <label key={idx} className="admin-label" style={{ marginLeft: '1rem' }}>
          {label} ({row},{col})
          <textarea
            className="admin-textarea"
            rows={2}
            value={link.linkGuidance.cells[label] || ''}
            onChange={e => {
              setLinks(links.map(l => l.id === link.id
                ? { ...l, linkGuidance: { ...l.linkGuidance, cells: { ...l.linkGuidance.cells, [label]: e.target.value } } }
                : l));
            }}
            onBlur={() => updateGuidance(link.id, link.linkGuidance.overall, link.linkGuidance.groups, link.linkGuidance.cells, link.sortOrder)}
            placeholder={`"${label}" additions...`}
          />
        </label>
      );
    })}
  </details>
)}
```

**Step 4: Commit**

```bash
git add src/components/admin/LinkedGridPresets.tsx
git commit -m "feat: update LinkedGridPresets to three-level guidance UI"
```

---

## Task 13: Update Content Preset Editor UI (`GenericPresetsTab.tsx`)

**Files:**
- Modify: `src/components/admin/GenericPresetsTab.tsx`

**Context:**
`GenericPresetsTab` uses `PRESET_TAB_CONFIGS` with per-type field definitions. Currently has `rowGuidance`/`cellGuidance`/`tileGuidance`/`layerGuidance` textarea fields. Replace with three unified fields per type. Because content presets have no fixed grid context, group/cell guidance is an add/edit/remove key-value list.

**Step 1: Update `PRESET_TAB_CONFIGS` for all four types**

Replace the type-specific guidance fields with three unified fields. Add a new field type `'guidance-pairs'` for the key-value list UI:

```typescript
// In all four type configs, replace the old guidance field with:
{ key: 'overallGuidance', label: 'Overall Guidance', type: 'textarea', rows: 3,
  placeholder: 'Overall guidance that applies to all cells...' },
{ key: 'groupGuidance', label: 'Group Guidance', type: 'guidance-pairs',
  placeholder: 'Add group name...' },
{ key: 'cellGuidance', label: 'Cell Guidance', type: 'guidance-pairs',
  placeholder: 'Add cell label...' },
```

Update `emptyDefaults` in each config to:
```typescript
{ name: '', genre: '', description: '', /* type-specific fields */, overallGuidance: '', groupGuidance: {}, cellGuidance: {} }
```

**Step 2: Add `guidance-pairs` field renderer**

In the form rendering logic (around lines 215-250), add a branch for `guidance-pairs` type. This renders a list of existing key-value pairs plus an "Add" row:

```tsx
} else if (field.type === 'guidance-pairs') {
  const pairs = (editing[field.key] as Record<string, string>) || {};
  return (
    <div key={field.key} className="admin-guidance-pairs">
      <label className="admin-label">{field.label}</label>
      {Object.entries(pairs).map(([key, value]) => (
        <div key={key} className="admin-guidance-pair">
          <span className="admin-guidance-pair-key">{key}</span>
          <textarea
            className="admin-textarea"
            rows={2}
            value={value}
            onChange={e => updateField(field.key, { ...pairs, [key]: e.target.value })}
          />
          <button
            className="btn btn-sm btn-danger"
            onClick={() => {
              const next = { ...pairs };
              delete next[key];
              updateField(field.key, next);
            }}
          >×</button>
        </div>
      ))}
      <div className="admin-guidance-pair-add">
        <input
          className="admin-input"
          placeholder={field.placeholder}
          onKeyDown={e => {
            if (e.key === 'Enter' && e.currentTarget.value.trim()) {
              const newKey = e.currentTarget.value.trim();
              if (!pairs[newKey]) {
                updateField(field.key, { ...pairs, [newKey]: '' });
                e.currentTarget.value = '';
              }
            }
          }}
        />
        <span className="admin-hint">Press Enter to add</span>
      </div>
    </div>
  );
}
```

**Step 3: Update save handler**

The save handler already uses `updateField` which calls the generic PATCH/PUT endpoint. Since `presetTables.js` was updated to include `overallGuidance`, `groupGuidance`, `cellGuidance`, the generic CRUD route handles them automatically. No additional changes needed in the HTTP call.

**Step 4: Commit**

```bash
git add src/components/admin/GenericPresetsTab.tsx
git commit -m "feat: update GenericPresetsTab to three-level guidance with key-value pair UI"
```

---

## Task 14: End-to-End Verification

**No files to modify.** This task is a smoke test of the full pipeline.

**Step 1: Start dev server**

```bash
npm run dev
```

Expected: Clean start, no errors.

**Step 2: Verify a generation produces a prompt with the new structure**

In the app, trigger a generation for a character preset with an RPG Full grid link. In the browser console, the debug log `[Gemini Prompt]` should show:

- `OVERALL GUIDANCE:` section at the top
- `GROUP: Walk Down Animation Frames` sections
- `Cell "Walk Down 1" (0,0):` entries inside each group
- No `CHARACTER-SPECIFIC POSE NOTES:` block at the end

**Step 3: Verify admin UI shows three guidance sections**

Navigate to the admin panel → Grid Presets. Edit RPG Full. Confirm three sections appear: Overall Guidance (populated), Group Guidance (empty textareas per group), Cell Guidance (populated textareas per cell).

Navigate to a character preset. Confirm three guidance sections appear, with cell guidance populated from the decomposed rowGuidance.

**Step 4: Verify saving works**

Edit a cell guidance field in the grid preset admin UI. Save. Reload. Confirm the change persisted.

**Step 5: Run full test suite**

```bash
npm test
```

Expected: All tests pass.

**Step 6: Final commit and push**

```bash
git add -A
git commit -m "feat: complete hierarchical guidance system implementation"
git push origin master
```
