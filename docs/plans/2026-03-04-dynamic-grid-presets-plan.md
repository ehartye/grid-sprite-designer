# Dynamic Grid Presets & Run Builder Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use h-superpowers:subagent-driven-development, h-superpowers:team-driven-development, or h-superpowers:executing-plans to implement this plan (ask user which approach).

**Goal:** Decouple grid layouts from content presets, add admin page for preset management, and build a run builder for selective multi-grid generation with sprite continuity.

**Architecture:** Grid presets become first-class DB entities linked to content presets via junction tables with per-combo guidance overrides. New admin page (tabbed) manages all presets. Run builder page enables selective multi-grid sequential generation, passing the first completed sheet as a reference image to subsequent runs.

**Tech Stack:** React 18, TypeScript, Express.js, SQLite (better-sqlite3), Vite, existing Gemini API integration

**Design doc:** `docs/plans/2026-03-04-dynamic-grid-presets-design.md`

---

## Task 1: Database Schema — New Tables

**Files:**
- Modify: `server/db.js:30-131` (createSchema function)

**Step 1: Add grid_presets table**

Add after the `background_presets` CREATE TABLE (line ~129):

```javascript
db.exec(`
  CREATE TABLE IF NOT EXISTS grid_presets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    sprite_type TEXT NOT NULL CHECK(sprite_type IN ('character','building','terrain','background')),
    genre TEXT DEFAULT '',
    grid_size TEXT NOT NULL,
    cols INTEGER NOT NULL,
    rows INTEGER NOT NULL,
    cell_labels TEXT NOT NULL DEFAULT '[]',
    cell_groups TEXT NOT NULL DEFAULT '[]',
    generic_guidance TEXT DEFAULT '',
    bg_mode TEXT DEFAULT NULL,
    is_preset INTEGER DEFAULT 1
  )
`);
```

**Step 2: Add junction tables**

Add after grid_presets:

```javascript
db.exec(`
  CREATE TABLE IF NOT EXISTS character_grid_links (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    character_preset_id INTEGER NOT NULL REFERENCES character_presets(id) ON DELETE CASCADE,
    grid_preset_id INTEGER NOT NULL REFERENCES grid_presets(id) ON DELETE CASCADE,
    guidance_override TEXT DEFAULT '',
    sort_order INTEGER DEFAULT 0,
    UNIQUE(character_preset_id, grid_preset_id)
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS building_grid_links (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    building_preset_id INTEGER NOT NULL REFERENCES building_presets(id) ON DELETE CASCADE,
    grid_preset_id INTEGER NOT NULL REFERENCES grid_presets(id) ON DELETE CASCADE,
    guidance_override TEXT DEFAULT '',
    sort_order INTEGER DEFAULT 0,
    UNIQUE(building_preset_id, grid_preset_id)
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS terrain_grid_links (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    terrain_preset_id INTEGER NOT NULL REFERENCES terrain_presets(id) ON DELETE CASCADE,
    grid_preset_id INTEGER NOT NULL REFERENCES grid_presets(id) ON DELETE CASCADE,
    guidance_override TEXT DEFAULT '',
    sort_order INTEGER DEFAULT 0,
    UNIQUE(terrain_preset_id, grid_preset_id)
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS background_grid_links (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    background_preset_id INTEGER NOT NULL REFERENCES background_presets(id) ON DELETE CASCADE,
    grid_preset_id INTEGER NOT NULL REFERENCES grid_presets(id) ON DELETE CASCADE,
    guidance_override TEXT DEFAULT '',
    sort_order INTEGER DEFAULT 0,
    UNIQUE(background_preset_id, grid_preset_id)
  )
`);
```

**Step 3: Verify schema creates cleanly**

Run: `rm -f data/sprites.db && node -e "require('./server/db.js')"`
Expected: No errors, database recreated with new tables

**Step 4: Commit**

```bash
git add server/db.js
git commit -m "feat: add grid_presets and junction tables to schema"
```

---

## Task 2: Seed Grid Presets — Character Grids

**Files:**
- Modify: `server/db.js` (new function `seedGridPresets`)
- Reference: `src/lib/poses.ts:21-43` (CELL_LABELS), `src/lib/poses.ts:96-113` (ANIMATIONS), `src/lib/promptBuilder.ts:15-136` (GENERIC_ROW_GUIDANCE)

**Step 1: Create seedGridPresets function**

Add a new function `seedGridPresets(db)` in db.js. This creates the default character grid preset by porting `CELL_LABELS`, `ANIMATIONS`, and `GENERIC_ROW_GUIDANCE`:

```javascript
function seedGridPresets(db) {
  const existing = db.prepare('SELECT COUNT(*) as count FROM grid_presets').get();
  if (existing.count > 0) return;

  const characterCellLabels = JSON.stringify([
    'Walk Down 1','Walk Down 2','Walk Down 3','Walk Up 1','Walk Up 2','Walk Up 3',
    'Walk Left 1','Walk Left 2','Walk Left 3','Walk Right 1','Walk Right 2','Walk Right 3',
    'Idle Down','Idle Up','Idle Left','Idle Right','Battle Idle 1','Battle Idle 2',
    'Battle Idle 3','Attack 1','Attack 2','Attack 3','Cast 1','Cast 2',
    'Cast 3','Damage 1','Damage 2','Damage 3','KO 1','KO 2',
    'KO 3','Victory 1','Victory 2','Victory 3','Weak Pose','Critical Pose'
  ]);

  const characterCellGroups = JSON.stringify([
    { name: 'Walk Down', cells: [0,1,2] },
    { name: 'Walk Up', cells: [3,4,5] },
    { name: 'Walk Left', cells: [6,7,8] },
    { name: 'Walk Right', cells: [9,10,11] },
    { name: 'Idle', cells: [12,13,14,15] },
    { name: 'Battle Idle', cells: [16,17,18] },
    { name: 'Attack', cells: [19,20,21] },
    { name: 'Cast', cells: [22,23,24] },
    { name: 'Damage', cells: [25,26,27] },
    { name: 'KO', cells: [28,29,30] },
    { name: 'Victory', cells: [31,32,33] },
    { name: 'Status', cells: [34,35] }
  ]);

  // Copy the GENERIC_ROW_GUIDANCE from promptBuilder.ts as the generic_guidance
  const rpgFullGuidance = `<PASTE GENERIC_ROW_GUIDANCE content from promptBuilder.ts lines 15-136>`;

  const insertGrid = db.prepare(`
    INSERT INTO grid_presets (name, sprite_type, genre, grid_size, cols, rows, cell_labels, cell_groups, generic_guidance, is_preset)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
  `);

  // RPG Full 6x6 character grid
  insertGrid.run('RPG Full', 'character', 'RPG', '6x6', 6, 6, characterCellLabels, characterCellGroups, rpgFullGuidance);
}
```

**Step 2: Call seedGridPresets from initializeDatabase**

Add `seedGridPresets(db)` call in the initializeDatabase function (around line 23-26) BEFORE seedPresets so grid presets exist before character links are created.

**Step 3: Verify seed runs cleanly**

Run: `rm -f data/sprites.db && node -e "require('./server/db.js')"`
Expected: grid_presets table has 1 row (RPG Full 6x6)

**Step 4: Commit**

```bash
git add server/db.js
git commit -m "feat: seed RPG Full 6x6 character grid preset"
```

---

## Task 3: Seed Grid Presets — Building, Terrain, Background Grids

**Files:**
- Modify: `server/db.js` (extend seedGridPresets function)
- Reference: existing seed data in `seedBuildingPresets` (line ~1485), `seedTerrainPresets` (line ~1812), `seedBackgroundPresets` (line ~2045)

**Step 1: Extract unique grid configurations from existing building presets**

Look at each existing building preset's grid_size and cell_labels. Create a grid preset for each unique combination. For buildings, the cell_guidance from each preset becomes split: generic part → grid preset's generic_guidance, building-specific part → junction guidance_override.

Add to `seedGridPresets`:

```javascript
// Building grids — extract from existing building preset patterns
// Example: "3x3 Day Cycle" grid with labels ["Morning", "Afternoon", "Evening", ...]
insertGrid.run('3x3 Day Cycle', 'building', 'General', '3x3', 3, 3,
  JSON.stringify(['Morning','Afternoon','Evening','Night','Dawn','Dusk','Overcast','Rainy','Snowy']),
  JSON.stringify([
    { name: 'Daytime', cells: [0,1,2] },
    { name: 'Nighttime', cells: [3,4,5] },
    { name: 'Weather', cells: [6,7,8] }
  ]),
  '<generic building day cycle guidance>'
);
// ... repeat for each unique building grid pattern found in existing presets
```

Follow the same pattern for terrain and background grids, extracting from existing seed data.

**Step 2: Port terrain grid presets**

Extract unique grid patterns from `seedTerrainPresets`. Each terrain preset has a grid_size and tile_labels — create grid presets for common patterns (e.g., "3x3 Terrain Tileset", "4x4 Terrain Tileset", "5x5 Terrain Tileset").

**Step 3: Port background grid presets**

Extract from `seedBackgroundPresets`. Background grids have both `bg_mode` and `grid_size`. Create grid presets like "1x3 Parallax Layers", "2x2 Scene Variations", etc. Set the `bg_mode` field on these.

**Step 4: Verify all grid presets seed correctly**

Run: `rm -f data/sprites.db && node -e "const db = require('./server/db.js'); console.log(db.prepare('SELECT id, name, sprite_type, grid_size FROM grid_presets').all())"`
Expected: All grid presets listed for all 4 sprite types

**Step 5: Commit**

```bash
git add server/db.js
git commit -m "feat: seed grid presets for building, terrain, and background"
```

---

## Task 4: Create Junction Links for Existing Presets

**Files:**
- Modify: `server/db.js` — update seedPresets, seedBuildingPresets, seedTerrainPresets, seedBackgroundPresets

**Step 1: Link character presets to RPG Full 6x6 grid**

After character presets are seeded, create junction links. Each character's current `row_guidance` becomes the `guidance_override` in the link:

```javascript
// At end of seedPresets function:
const rpgFullGrid = db.prepare("SELECT id FROM grid_presets WHERE name = 'RPG Full' AND sprite_type = 'character'").get();
if (rpgFullGrid) {
  const insertLink = db.prepare(`
    INSERT OR IGNORE INTO character_grid_links (character_preset_id, grid_preset_id, guidance_override, sort_order)
    VALUES (?, ?, ?, 0)
  `);
  const chars = db.prepare('SELECT id, row_guidance FROM character_presets').all();
  for (const char of chars) {
    insertLink.run(char.id, rpgFullGrid.id, char.row_guidance || '');
  }
}
```

**Step 2: Link building presets to their grid presets**

Match each building preset's grid_size + cell_labels to the appropriate grid preset. Put the building's cell_guidance as the guidance_override:

```javascript
// At end of seedBuildingPresets function:
const insertBuildingLink = db.prepare(`
  INSERT OR IGNORE INTO building_grid_links (building_preset_id, grid_preset_id, guidance_override, sort_order)
  VALUES (?, ?, ?, 0)
`);
// For each building preset, find matching grid preset by grid_size and link them
```

**Step 3: Link terrain and background presets similarly**

Same pattern: match by grid_size (and bg_mode for backgrounds), put existing guidance as override.

**Step 4: Verify links**

Run: `rm -f data/sprites.db && node -e "const db = require('./server/db.js'); console.log('char links:', db.prepare('SELECT COUNT(*) as c FROM character_grid_links').get()); console.log('building links:', db.prepare('SELECT COUNT(*) as c FROM building_grid_links').get());"`
Expected: Link counts match preset counts

**Step 5: Commit**

```bash
git add server/db.js
git commit -m "feat: create junction links for all existing presets"
```

---

## Task 5: Grid Preset API Endpoints

**Files:**
- Modify: `server/index.js:127-200` (add new endpoints)

**Step 1: Add grid preset CRUD endpoints**

```javascript
// GET /api/grid-presets — list grid presets, filterable by sprite_type
app.get('/api/grid-presets', (req, res) => {
  const { sprite_type } = req.query;
  let rows;
  if (sprite_type) {
    rows = db.prepare('SELECT * FROM grid_presets WHERE sprite_type = ? ORDER BY name').all(sprite_type);
  } else {
    rows = db.prepare('SELECT * FROM grid_presets ORDER BY sprite_type, name').all();
  }
  res.json(rows.map(r => ({
    ...r,
    cellLabels: JSON.parse(r.cell_labels),
    cellGroups: JSON.parse(r.cell_groups),
    genericGuidance: r.generic_guidance,
    bgMode: r.bg_mode
  })));
});

// POST /api/grid-presets — create grid preset
app.post('/api/grid-presets', (req, res) => {
  const { name, spriteType, genre, gridSize, cols, rows, cellLabels, cellGroups, genericGuidance, bgMode } = req.body;
  const result = db.prepare(`
    INSERT INTO grid_presets (name, sprite_type, genre, grid_size, cols, rows, cell_labels, cell_groups, generic_guidance, bg_mode, is_preset)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
  `).run(name, spriteType, genre || '', gridSize, cols, rows,
    JSON.stringify(cellLabels), JSON.stringify(cellGroups || []), genericGuidance || '', bgMode || null);
  res.json({ id: result.lastInsertRowid });
});

// PUT /api/grid-presets/:id — update grid preset
app.put('/api/grid-presets/:id', (req, res) => {
  const { name, genre, gridSize, cols, rows, cellLabels, cellGroups, genericGuidance, bgMode } = req.body;
  db.prepare(`
    UPDATE grid_presets SET name=?, genre=?, grid_size=?, cols=?, rows=?, cell_labels=?, cell_groups=?, generic_guidance=?, bg_mode=?
    WHERE id=?
  `).run(name, genre || '', gridSize, cols, rows,
    JSON.stringify(cellLabels), JSON.stringify(cellGroups || []), genericGuidance || '', bgMode || null, req.params.id);
  res.json({ success: true });
});

// DELETE /api/grid-presets/:id — delete grid preset
app.delete('/api/grid-presets/:id', (req, res) => {
  const linkCount = db.prepare(`
    SELECT (SELECT COUNT(*) FROM character_grid_links WHERE grid_preset_id=?) +
           (SELECT COUNT(*) FROM building_grid_links WHERE grid_preset_id=?) +
           (SELECT COUNT(*) FROM terrain_grid_links WHERE grid_preset_id=?) +
           (SELECT COUNT(*) FROM background_grid_links WHERE grid_preset_id=?) as total
  `).get(req.params.id, req.params.id, req.params.id, req.params.id);
  db.prepare('DELETE FROM grid_presets WHERE id=?').run(req.params.id);
  res.json({ success: true, unlinked: linkCount.total });
});
```

**Step 2: Verify endpoints work**

Run: `npm run dev` then `curl http://localhost:5173/api/grid-presets`
Expected: JSON array of seeded grid presets

**Step 3: Commit**

```bash
git add server/index.js
git commit -m "feat: add CRUD endpoints for grid presets"
```

---

## Task 6: Grid Link API Endpoints

**Files:**
- Modify: `server/index.js`

**Step 1: Add grid link endpoints for all sprite types**

```javascript
// GET /api/presets/:type/:id/grid-links — get linked grids for a content preset
app.get('/api/presets/:type/:id/grid-links', (req, res) => {
  const { type, id } = req.params;
  const table = `${type}_grid_links`;
  const fk = `${type === 'character' ? 'character' : type}_preset_id`;
  const links = db.prepare(`
    SELECT l.*, g.name as grid_name, g.grid_size, g.cols, g.rows,
           g.cell_labels, g.cell_groups, g.generic_guidance, g.bg_mode
    FROM ${table} l
    JOIN grid_presets g ON g.id = l.grid_preset_id
    WHERE l.${fk} = ?
    ORDER BY l.sort_order
  `).all(id);
  res.json(links.map(l => ({
    id: l.id,
    gridPresetId: l.grid_preset_id,
    guidanceOverride: l.guidance_override,
    sortOrder: l.sort_order,
    gridName: l.grid_name,
    gridSize: l.grid_size,
    cols: l.cols,
    rows: l.rows,
    cellLabels: JSON.parse(l.cell_labels),
    cellGroups: JSON.parse(l.cell_groups),
    genericGuidance: l.generic_guidance,
    bgMode: l.bg_mode
  })));
});

// POST /api/presets/:type/:id/grid-links — add grid link
app.post('/api/presets/:type/:id/grid-links', (req, res) => {
  const { type, id } = req.params;
  const { gridPresetId, guidanceOverride, sortOrder } = req.body;
  const table = `${type}_grid_links`;
  const fk = `${type === 'character' ? 'character' : type}_preset_id`;
  const result = db.prepare(`
    INSERT INTO ${table} (${fk}, grid_preset_id, guidance_override, sort_order)
    VALUES (?, ?, ?, ?)
  `).run(id, gridPresetId, guidanceOverride || '', sortOrder || 0);
  res.json({ id: result.lastInsertRowid });
});

// PUT /api/grid-links/:type/:id — update a grid link
app.put('/api/grid-links/:type/:id', (req, res) => {
  const { type, id } = req.params;
  const { guidanceOverride, sortOrder } = req.body;
  const table = `${type}_grid_links`;
  db.prepare(`UPDATE ${table} SET guidance_override=?, sort_order=? WHERE id=?`)
    .run(guidanceOverride || '', sortOrder || 0, id);
  res.json({ success: true });
});

// DELETE /api/grid-links/:type/:id — remove grid link
app.delete('/api/grid-links/:type/:id', (req, res) => {
  const { type, id } = req.params;
  const table = `${type}_grid_links`;
  db.prepare(`DELETE FROM ${table} WHERE id=?`).run(id);
  res.json({ success: true });
});
```

**Step 2: Verify link endpoints**

Run: `curl http://localhost:5173/api/presets/character/1/grid-links`
Expected: JSON array with the RPG Full 6x6 link for character preset 1

**Step 3: Commit**

```bash
git add server/index.js
git commit -m "feat: add CRUD endpoints for grid preset links"
```

---

## Task 7: Update TypeScript Types

**Files:**
- Modify: `src/context/AppContext.tsx:16-59` (preset interfaces), `src/context/AppContext.tsx:65-147` (AppState)

**Step 1: Add GridPreset and GridLink interfaces**

Add before the existing preset interfaces (line ~16):

```typescript
export interface GridPreset {
  id: number;
  name: string;
  spriteType: 'character' | 'building' | 'terrain' | 'background';
  genre: string;
  gridSize: string;
  cols: number;
  rows: number;
  cellLabels: string[];
  cellGroups: CellGroup[];
  genericGuidance: string;
  bgMode?: 'parallax' | 'scene' | null;
}

export interface CellGroup {
  name: string;
  cells: number[];
}

export interface GridLink {
  id: number;
  gridPresetId: number;
  guidanceOverride: string;
  sortOrder: number;
  // Joined grid preset fields:
  gridName: string;
  gridSize: string;
  cols: number;
  rows: number;
  cellLabels: string[];
  cellGroups: CellGroup[];
  genericGuidance: string;
  bgMode?: 'parallax' | 'scene' | null;
}
```

**Step 2: Simplify content preset interfaces**

Remove grid-specific fields from existing interfaces:

- `BuildingPreset`: remove `gridSize`, `cellLabels`, `cellGuidance`
- `TerrainPreset`: remove `gridSize`, `tileLabels`, `tileGuidance`
- `BackgroundPreset`: remove `gridSize`, `bgMode`, `layerLabels`, `layerGuidance`
- `CharacterPreset`: keep as-is for now (rowGuidance removal happens after migration is stable)

**Step 3: Add grid presets to AppState**

Add to AppState interface:

```typescript
gridPresets: GridPreset[];
```

**Step 4: Add new action types**

Add to Action union:

```typescript
| { type: 'SET_GRID_PRESETS'; payload: GridPreset[] }
```

**Step 5: Add reducer case**

```typescript
case 'SET_GRID_PRESETS':
  return { ...state, gridPresets: action.payload };
```

**Step 6: Commit**

```bash
git add src/context/AppContext.tsx
git commit -m "feat: add GridPreset and GridLink TypeScript types"
```

---

## Task 8: Dynamic Grid Config from Grid Presets

**Files:**
- Modify: `src/lib/gridConfig.ts:17-238`

**Step 1: Add function to convert GridPreset to GridConfig**

The existing `GridConfig` interface is already suitable. Add a conversion function:

```typescript
import type { GridPreset } from '../context/AppContext';

export function gridPresetToConfig(preset: GridPreset): GridConfig {
  // Look up template params from the existing grid definitions by grid_size
  const templateParams = getTemplateParams(preset.gridSize, preset.spriteType);
  return {
    id: `custom-${preset.id}`,
    label: preset.name,
    cols: preset.cols,
    rows: preset.rows,
    totalCells: preset.cols * preset.rows,
    cellLabels: preset.cellLabels,
    templates: templateParams
  };
}

function getTemplateParams(gridSize: string, spriteType: string): GridConfig['templates'] {
  // Map gridSize to existing template params from BUILDING_GRIDS, TERRAIN_GRIDS, etc.
  // For character 6x6, use CHARACTER_GRID templates
  // For new sizes not in existing configs, calculate proportionally
  if (spriteType === 'character' && gridSize === '6x6') return CHARACTER_GRID.templates;
  if (spriteType === 'building') return BUILDING_GRIDS[gridSize as BuildingGridSize]?.templates ?? BUILDING_GRIDS['3x3'].templates;
  if (spriteType === 'terrain') return TERRAIN_GRIDS[gridSize as TerrainGridSize]?.templates ?? TERRAIN_GRIDS['3x3'].templates;
  if (spriteType === 'background') return BACKGROUND_GRIDS[gridSize as BackgroundGridSize]?.templates ?? BACKGROUND_GRIDS['2x2'].templates;
  return CHARACTER_GRID.templates; // fallback
}
```

**Step 2: Commit**

```bash
git add src/lib/gridConfig.ts
git commit -m "feat: add gridPresetToConfig conversion function"
```

---

## Task 9: Refactor Prompt Builders for Layered Guidance

**Files:**
- Modify: `src/lib/promptBuilder.ts:141-205` (buildGridFillPrompt)
- Modify: `src/lib/buildingPromptBuilder.ts`
- Modify: `src/lib/terrainPromptBuilder.ts`
- Modify: `src/lib/backgroundPromptBuilder.ts`

**Step 1: Update character prompt builder**

Modify `buildGridFillPrompt` to accept grid preset guidance + override instead of reading from `character.rowGuidance`:

```typescript
export function buildGridFillPrompt(
  character: CharacterConfig,
  gridGenericGuidance: string,
  guidanceOverride: string,
  cellLabels: string[]
): string {
  // Use gridGenericGuidance instead of GENERIC_ROW_GUIDANCE constant
  // Append guidanceOverride after generic guidance
  // Use cellLabels instead of hardcoded CELL_LABELS
  const finalGuidance = gridGenericGuidance + (guidanceOverride ? '\n\n' + guidanceOverride : '');
  // ... build prompt with finalGuidance and cellLabels
}
```

Keep `GENERIC_ROW_GUIDANCE` as a fallback for now, but the primary path should use the grid preset's `genericGuidance`.

**Step 2: Add reference image prompt variant**

Add a new function for subsequent runs in a multi-grid batch:

```typescript
export function buildGridFillPromptWithReference(
  character: CharacterConfig,
  gridGenericGuidance: string,
  guidanceOverride: string,
  cellLabels: string[]
): string {
  // Same as buildGridFillPrompt but adds explicit image instructions:
  // "You are given two images.
  //  IMAGE 1 is a previously completed sprite sheet — use it as visual reference
  //  to maintain consistent proportions, color palette, art style, and character identity.
  //  IMAGE 2 is a blank template grid — fill each labeled cell according to the guidance below."
  // Then the rest of the prompt follows.
}
```

**Step 3: Apply same pattern to building, terrain, background prompt builders**

Each builder gets updated to accept `genericGuidance` and `guidanceOverride` parameters instead of reading guidance from the content preset object.

**Step 4: Commit**

```bash
git add src/lib/promptBuilder.ts src/lib/buildingPromptBuilder.ts src/lib/terrainPromptBuilder.ts src/lib/backgroundPromptBuilder.ts
git commit -m "feat: refactor prompt builders for layered guidance from grid presets"
```

---

## Task 10: Update Generation Workflow for Grid Presets

**Files:**
- Modify: `src/hooks/useGridWorkflow.ts:27-115`
- Modify: `src/hooks/useBuildingWorkflow.ts`
- Modify: `src/hooks/useTerrainWorkflow.ts`
- Modify: `src/hooks/useBackgroundWorkflow.ts`

**Step 1: Update useGridWorkflow to accept grid preset + link**

The generate function currently calls `buildGridFillPrompt(state.character)`. Update it to:

1. Accept a `GridLink` parameter (or read from state)
2. Convert the grid link's grid preset to a `GridConfig` via `gridPresetToConfig`
3. Pass `gridLink.genericGuidance`, `gridLink.guidanceOverride`, and `gridLink.cellLabels` to the prompt builder
4. Generate the template using the dynamic GridConfig

```typescript
const generate = useCallback(async (gridLink: GridLink) => {
  const gridConfig = gridPresetToConfig(gridLink);
  // Step 1: generate template with dynamic gridConfig
  const templateImage = await generateTemplate(gridConfig, state.imageSize);
  // Step 2: build prompt with layered guidance
  const prompt = buildGridFillPrompt(
    state.character,
    gridLink.genericGuidance,
    gridLink.guidanceOverride,
    gridLink.cellLabels
  );
  // Step 3: call Gemini API
  // Step 4: extract sprites using dynamic gridConfig
}, [state]);
```

**Step 2: Apply same pattern to building, terrain, background workflows**

**Step 3: Commit**

```bash
git add src/hooks/useGridWorkflow.ts src/hooks/useBuildingWorkflow.ts src/hooks/useTerrainWorkflow.ts src/hooks/useBackgroundWorkflow.ts
git commit -m "feat: update generation workflows to use grid presets"
```

---

## Task 11: Update Generate API for Reference Images

**Files:**
- Modify: `server/routes/generate.js:62-127`

**Step 1: Support reference_image in generate endpoint**

Update the POST `/api/generate-grid` handler to accept an optional `referenceImage` in the request body. When present, send it as the first image part:

```javascript
router.post('/generate-grid', async (req, res) => {
  const { model, prompt, templateImage, imageSize, referenceImage } = req.body;

  const parts = [];

  // If reference image provided (subsequent runs), add it first
  if (referenceImage) {
    parts.push({
      inlineData: {
        data: referenceImage.replace(/^data:image\/\w+;base64,/, ''),
        mimeType: 'image/png'
      }
    });
  }

  // Template image (always present)
  parts.push({
    inlineData: {
      data: templateImage.replace(/^data:image\/\w+;base64,/, ''),
      mimeType: 'image/png'
    }
  });

  // Prompt text
  parts.push({ text: prompt });

  // ... rest of the handler unchanged
});
```

**Step 2: Commit**

```bash
git add server/routes/generate.js
git commit -m "feat: support reference image in generate endpoint for sprite continuity"
```

---

## Task 12: Admin Page — Grid Presets Tab

**Files:**
- Create: `src/components/admin/AdminPage.tsx`
- Create: `src/components/admin/GridPresetsTab.tsx`
- Create: `src/styles/admin.css`
- Modify: `src/App.tsx:186-199` (add routing)

**Step 1: Create AdminPage shell with tabs**

```typescript
// src/components/admin/AdminPage.tsx
import { useState } from 'react';
import GridPresetsTab from './GridPresetsTab';
import '../../styles/admin.css';

type AdminTab = 'grid-presets' | 'characters' | 'buildings' | 'terrain' | 'backgrounds';

export default function AdminPage({ onBack }: { onBack: () => void }) {
  const [activeTab, setActiveTab] = useState<AdminTab>('grid-presets');

  return (
    <div className="admin-page">
      <header className="admin-header">
        <button onClick={onBack}>Back</button>
        <h1>Preset Admin</h1>
      </header>
      <nav className="admin-tabs">
        {(['grid-presets','characters','buildings','terrain','backgrounds'] as AdminTab[]).map(tab => (
          <button key={tab} className={activeTab === tab ? 'active' : ''} onClick={() => setActiveTab(tab)}>
            {tab.replace('-', ' ').replace(/\b\w/g, c => c.toUpperCase())}
          </button>
        ))}
      </nav>
      <main className="admin-content">
        {activeTab === 'grid-presets' && <GridPresetsTab />}
        {activeTab === 'characters' && <div>Character presets (Task 13)</div>}
        {activeTab === 'buildings' && <div>Building presets (Task 13)</div>}
        {activeTab === 'terrain' && <div>Terrain presets (Task 13)</div>}
        {activeTab === 'backgrounds' && <div>Background presets (Task 13)</div>}
      </main>
    </div>
  );
}
```

**Step 2: Create GridPresetsTab with CRUD**

```typescript
// src/components/admin/GridPresetsTab.tsx
// - Fetch grid presets from /api/grid-presets
// - Filter by sprite type sub-tabs
// - List view: name, sprite type, grid size, cell count
// - Click to edit: name, sprite type, grid_size, cols, rows
// - Cell labels editor: add/remove/reorder inputs
// - Cell groups editor: name + multi-select cell checkboxes
// - Generic guidance textarea
// - Save / Delete buttons
// - Visual grid preview (small canvas showing labeled cells)
```

**Step 3: Add admin nav link to AppHeader**

Modify `src/components/layout/AppHeader.tsx` to add "Admin" button that sets `step` to `'admin'`.

**Step 4: Add admin step to App.tsx routing**

Add `'admin'` to the step union type and render `<AdminPage>` when `state.step === 'admin'`.

**Step 5: Basic CSS for admin layout**

```css
/* src/styles/admin.css */
.admin-page { padding: 1rem; max-width: 1200px; margin: 0 auto; }
.admin-tabs { display: flex; gap: 0.5rem; border-bottom: 1px solid #333; padding-bottom: 0.5rem; margin-bottom: 1rem; }
.admin-tabs button { padding: 0.5rem 1rem; background: #1a1a2e; border: 1px solid #333; color: #ccc; cursor: pointer; }
.admin-tabs button.active { background: #16213e; border-color: #0f3460; color: #fff; }
.admin-content { min-height: 400px; }
```

**Step 6: Commit**

```bash
git add src/components/admin/ src/styles/admin.css src/App.tsx src/components/layout/AppHeader.tsx
git commit -m "feat: add admin page with grid presets tab"
```

---

## Task 13: Admin Page — Content Preset Tabs

**Files:**
- Create: `src/components/admin/CharacterPresetsTab.tsx`
- Create: `src/components/admin/BuildingPresetsTab.tsx`
- Create: `src/components/admin/TerrainPresetsTab.tsx`
- Create: `src/components/admin/BackgroundPresetsTab.tsx`
- Modify: `src/components/admin/AdminPage.tsx` (wire up tabs)

**Step 1: Create CharacterPresetsTab**

- List all character presets (from `/api/presets`)
- Click to edit: name, genre, description, equipment, colorNotes, styleNotes
- **Linked Grid Presets section:**
  - Fetch links from `/api/presets/character/:id/grid-links`
  - Show each linked grid with name, grid size
  - Per-link guidance_override textarea
  - Add link button (dropdown of available grid presets for sprite_type=character)
  - Remove link button
  - Drag to reorder (updates sort_order)

**Step 2: Create BuildingPresetsTab, TerrainPresetsTab, BackgroundPresetsTab**

Same pattern as character but with type-specific fields:
- Building: name, genre, description, details, colorNotes, styleNotes + linked grids
- Terrain: name, genre, description, colorNotes, styleNotes + linked grids
- Background: name, genre, description, colorNotes, styleNotes + linked grids

**Step 3: Wire tabs into AdminPage**

Replace placeholder divs with actual components.

**Step 4: Commit**

```bash
git add src/components/admin/
git commit -m "feat: add content preset tabs to admin page with grid link management"
```

---

## Task 14: Update Preset API Endpoints for New Schema

**Files:**
- Modify: `server/index.js` (existing GET /api/presets endpoints)

**Step 1: Update GET /api/presets to exclude grid-specific fields**

The existing preset endpoints return cellLabels, cellGuidance, etc. from the content preset table. Update them to:
- Still return content preset fields (name, genre, description, etc.)
- Remove grid-specific fields (gridSize, cellLabels, cellGuidance, etc.) from the response
- Add a `gridLinkCount` field showing how many grid presets are linked

**Step 2: Add PUT and DELETE endpoints for content presets**

Currently only GET exists. Add update and delete for each type:

```javascript
// PUT /api/presets/:type/:id — update content preset
app.put('/api/presets/:type/:id', (req, res) => { /* ... */ });

// DELETE /api/presets/:type/:id — delete content preset
app.delete('/api/presets/:type/:id', (req, res) => { /* ... */ });

// POST /api/presets/:type — create content preset
app.post('/api/presets/:type', (req, res) => { /* ... */ });
```

**Step 3: Commit**

```bash
git add server/index.js
git commit -m "feat: update preset endpoints for new schema, add CRUD for content presets"
```

---

## Task 15: Run Builder Page

**Files:**
- Create: `src/components/run/RunBuilderPage.tsx`
- Create: `src/styles/run-builder.css`
- Modify: `src/App.tsx` (add routing)
- Modify: `src/components/layout/AppHeader.tsx` (add nav link)

**Step 1: Create RunBuilderPage**

```typescript
// src/components/run/RunBuilderPage.tsx
// Flow:
// 1. Sprite type selector (segmented control)
// 2. Content preset dropdown (fetched from /api/presets?type=X)
// 3. On preset selection, fetch grid links from /api/presets/:type/:id/grid-links
// 4. Display checkboxes for each linked grid preset:
//    - Checkbox, grid name, grid size, cell label count
//    - Drag handles for reorder (first checked = reference sheet)
// 5. Image size selector (2K / 4K)
// 6. "Start Run" button — dispatches run configuration to AppState
```

**Step 2: Add run state to AppContext**

Add to AppState:

```typescript
run: {
  active: boolean;
  contentPresetId: number | null;
  spriteType: SpriteType;
  selectedGridLinks: GridLink[];
  currentGridIndex: number;
  referenceSheet: string | null; // base64 of first completed grid
  imageSize: '2K' | '4K';
} | null;
```

Add actions:

```typescript
| { type: 'START_RUN'; payload: { contentPresetId: number; spriteType: SpriteType; gridLinks: GridLink[]; imageSize: '2K' | '4K' } }
| { type: 'COMPLETE_GRID'; payload: { filledGridImage: string } }
| { type: 'NEXT_GRID' }
| { type: 'END_RUN' }
```

**Step 3: Add routing for run builder and active run**

Add `'run-builder'` and `'run-active'` to the step union. Route appropriately in App.tsx.

**Step 4: Commit**

```bash
git add src/components/run/ src/styles/run-builder.css src/App.tsx src/context/AppContext.tsx src/components/layout/AppHeader.tsx
git commit -m "feat: add run builder page for selective multi-grid generation"
```

---

## Task 16: Multi-Grid Generation Orchestration

**Files:**
- Create: `src/hooks/useRunWorkflow.ts`
- Modify: `src/hooks/useGridWorkflow.ts` (extract reusable generation logic)

**Step 1: Create useRunWorkflow hook**

```typescript
// src/hooks/useRunWorkflow.ts
// Orchestrates sequential generation of multiple grids in a run:
//
// 1. For each selected grid link (in order):
//    a. Generate template from grid preset's GridConfig
//    b. Build prompt with layered guidance (generic + override)
//    c. If first grid: standard single-image call
//       If subsequent: add referenceSheet as IMAGE 1, template as IMAGE 2
//       Use buildGridFillPromptWithReference for prompt text
//    d. Call Gemini API via /api/generate-grid (with referenceImage if applicable)
//    e. Extract sprites from filled grid
//    f. Move to review step for this grid
//    g. Wait for user to approve / proceed
//    h. If first grid: store filled grid as referenceSheet
//    i. Move to next grid
// 2. After all grids complete: END_RUN
```

**Step 2: Wire run workflow into App.tsx**

When `state.run?.active`, use `useRunWorkflow` instead of individual workflow hooks. The review component gets "Next Grid" / "Skip" buttons and a progress indicator.

**Step 3: Commit**

```bash
git add src/hooks/useRunWorkflow.ts src/hooks/useGridWorkflow.ts src/App.tsx
git commit -m "feat: add multi-grid generation orchestration with reference sheet continuity"
```

---

## Task 17: Dynamic Animation Preview from Cell Groups

**Files:**
- Modify: `src/components/preview/AnimationPreview.tsx:9,96-113,168-177`

**Step 1: Accept cell groups as prop instead of hardcoded ANIMATIONS**

Currently imports `ANIMATIONS` from `poses.ts`. Change to accept cell groups from the current grid preset:

```typescript
interface AnimationPreviewProps {
  sprites: ExtractedSprite[];
  cellGroups?: CellGroup[]; // from grid preset
}

export default function AnimationPreview({ sprites, cellGroups }: AnimationPreviewProps) {
  // Convert cellGroups to animation definitions
  const animations: AnimationDef[] = cellGroups?.length
    ? cellGroups.map(g => ({ name: g.name, frames: g.cells, loop: true }))
    : ANIMATIONS; // fallback to hardcoded for backward compat

  // ... rest uses `animations` instead of `ANIMATIONS`
}
```

**Step 2: Update animation button rendering**

The button grid (lines 168-177) already maps over an array — just change it to use the dynamic `animations` array instead of imported `ANIMATIONS`.

**Step 3: Pass cellGroups from parent components**

In SpriteReview and wherever AnimationPreview is rendered, pass the current grid preset's `cellGroups` as a prop.

**Step 4: Commit**

```bash
git add src/components/preview/AnimationPreview.tsx src/components/grid/SpriteReview.tsx
git commit -m "feat: dynamic animation preview buttons from grid preset cell groups"
```

---

## Task 18: Simplify Config Panels

**Files:**
- Modify: `src/components/config/ConfigPanel.tsx`
- Modify: `src/components/config/BuildingConfigPanel.tsx`
- Modify: `src/components/config/TerrainConfigPanel.tsx`
- Modify: `src/components/config/BackgroundConfigPanel.tsx`

**Step 1: Update ConfigPanel (characters)**

- Remove the inline `rowGuidance` textarea (lines 192-199)
- After preset selection, show linked grid presets as read-only chips/badges
- Add "Edit in Admin" link that navigates to admin page
- Keep "Quick Generate" button that uses the first linked grid preset
- The run builder handles multi-grid generation

**Step 2: Update BuildingConfigPanel**

- Remove inline grid size selector (lines 57-71)
- Remove inline cell label inputs (lines 186-250)
- Remove cellGuidance textarea
- Show linked grid presets as badges
- Quick generate with first linked grid

**Step 3: Update TerrainConfigPanel and BackgroundConfigPanel**

Same pattern — remove inline grid/label/guidance controls, show linked presets, add admin link.

**Step 4: Commit**

```bash
git add src/components/config/ConfigPanel.tsx src/components/config/BuildingConfigPanel.tsx src/components/config/TerrainConfigPanel.tsx src/components/config/BackgroundConfigPanel.tsx
git commit -m "feat: simplify config panels, remove inline grid controls"
```

---

## Task 19: Update SpriteReview for Dynamic Cell Labels

**Files:**
- Modify: `src/components/grid/SpriteReview.tsx`

**Step 1: Pass dynamic cell labels from grid preset**

SpriteReview currently gets cell labels from grid config. Update to accept them from the active grid preset (via state or props):

- When in a run, use the current grid link's `cellLabels`
- When quick-generating, use the first linked grid preset's `cellLabels`
- Fallback to existing behavior for backward compatibility

**Step 2: Add run progress UI**

When `state.run?.active`:
- Show "Grid X of Y" progress indicator
- Show "Next Grid" button that dispatches `NEXT_GRID`
- Show "End Run" button that dispatches `END_RUN`

**Step 3: Commit**

```bash
git add src/components/grid/SpriteReview.tsx
git commit -m "feat: dynamic cell labels in review, add run progress controls"
```

---

## Task 20: Clean Up Legacy Code

**Files:**
- Modify: `src/lib/poses.ts` — keep CELL_LABELS and ANIMATIONS as fallbacks but add deprecation comments
- Modify: `src/lib/promptBuilder.ts` — keep GENERIC_ROW_GUIDANCE as fallback
- Modify: `server/db.js` — optionally remove old grid-specific columns from content preset tables (or leave for backwards compat)

**Step 1: Add deprecation comments**

Mark `CELL_LABELS`, `ANIMATIONS`, and `GENERIC_ROW_GUIDANCE` with comments indicating they're fallbacks and the source of truth is now the grid_presets table.

**Step 2: Verify backward compatibility**

Ensure that if no grid presets are linked to a content preset, the system falls back to the old behavior (using hardcoded labels/guidance).

**Step 3: Run full app test**

Start the dev server, test:
1. Character generation with grid preset (new flow)
2. Character generation without grid preset (fallback flow)
3. Building/terrain/background generation with grid presets
4. Admin page CRUD for all preset types
5. Run builder with multi-grid generation
6. Animation preview with dynamic cell groups
7. Reference sheet continuity across grids

**Step 4: Commit**

```bash
git add -A
git commit -m "feat: add legacy fallbacks, complete dynamic grid preset system"
```

---

## Summary

| Task | Description | Depends On |
|------|-------------|------------|
| 1 | DB schema — new tables | — |
| 2 | Seed character grid presets | 1 |
| 3 | Seed building/terrain/background grid presets | 1 |
| 4 | Create junction links for existing presets | 2, 3 |
| 5 | Grid preset API endpoints | 1 |
| 6 | Grid link API endpoints | 1 |
| 7 | TypeScript types | — |
| 8 | Dynamic grid config conversion | 7 |
| 9 | Refactor prompt builders | 7 |
| 10 | Update generation workflows | 8, 9 |
| 11 | Generate API reference image support | — |
| 12 | Admin page — grid presets tab | 5, 7 |
| 13 | Admin page — content preset tabs | 6, 12 |
| 14 | Update preset API for new schema | 5, 6 |
| 15 | Run builder page | 7, 14 |
| 16 | Multi-grid generation orchestration | 10, 11, 15 |
| 17 | Dynamic animation preview | 7, 8 |
| 18 | Simplify config panels | 7, 12 |
| 19 | Update SpriteReview | 7, 16, 17 |
| 20 | Clean up legacy code | all above |

**Parallelizable groups:**
- Group A (backend, no deps): Tasks 1, 5, 6, 11
- Group B (types, no deps): Tasks 7, 8, 9
- Group C (seed data): Tasks 2, 3, 4 (sequential)
- Group D (UI): Tasks 12, 13, 15, 17, 18, 19 (after Group B)
- Group E (workflow): Tasks 10, 16 (after Groups A+B)
- Task 20: after all
