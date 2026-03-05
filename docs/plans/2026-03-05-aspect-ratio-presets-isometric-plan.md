# Aspect Ratio, New Presets & Isometric Support Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use h-superpowers:subagent-driven-development, h-superpowers:team-driven-development, or h-superpowers:executing-plans to implement this plan (ask user which approach).

**Goal:** Add aspect ratio config to grid presets, create ~40 Post-Apocalyptic and Sci-Fi Horror presets, add isometric grid support, and pre-link multi-sheet animation series.

**Architecture:** Extend `grid_presets` table with `aspect_ratio` and `tile_shape` columns. Pass aspect ratio through the generation pipeline (client → server → Gemini API). Modify template generator for non-square canvases. Add preset data as new seed functions in `server/db.js`. Isometric support is handled entirely through grid preset configuration.

**Tech Stack:** SQLite (better-sqlite3), Express.js, React 18, TypeScript, Canvas API, Google Gemini API (Nano Banana Pro)

---

## Task 1: Add aspect_ratio and tile_shape to schema

**Files:**
- Modify: `server/db.js:134-148` (grid_presets CREATE TABLE)
- Modify: `server/db.js:196-207` (migrateSchema)

**Step 1: Add migration entries for grid_presets columns**

In `server/db.js`, add two new migrations to `migrateSchema()` at line 202 (after existing migrations):

```javascript
// Inside migrateSchema(), add to the migrations array:
"ALTER TABLE grid_presets ADD COLUMN aspect_ratio TEXT DEFAULT '1:1'",
"ALTER TABLE grid_presets ADD COLUMN tile_shape TEXT DEFAULT 'square'",
"ALTER TABLE generations ADD COLUMN aspect_ratio TEXT DEFAULT '1:1'",
```

**Step 2: Update grid_presets CREATE TABLE for new databases**

In `server/db.js`, update the `CREATE TABLE IF NOT EXISTS grid_presets` block (lines 134-148) to include the new columns:

```sql
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
  aspect_ratio TEXT DEFAULT '1:1',
  tile_shape TEXT DEFAULT 'square',
  is_preset INTEGER DEFAULT 1,
  UNIQUE(name, sprite_type, grid_size)
)
```

**Step 3: Verify server starts without errors**

Run: `node server/index.js`
Expected: Server starts, no migration errors. DB has new columns.

**Step 4: Commit**

```bash
git add server/db.js
git commit -m "feat: add aspect_ratio and tile_shape columns to grid_presets and generations"
```

---

## Task 2: Update server API to handle aspect_ratio

**Files:**
- Modify: `server/routes/generate.js:65-103` (POST /generate-grid)
- Modify: `server/index.js:284-353` (grid-preset CRUD endpoints)

**Step 1: Accept and pass aspectRatio in generate endpoint**

In `server/routes/generate.js`, line 67, add `aspectRatio` to destructured request body:

```javascript
const { model, prompt, templateImage, imageSize = '2K', referenceImage, aspectRatio = '1:1' } = req.body;
```

Then update generationConfig at line 96-103 to use the dynamic value:

```javascript
const generationConfig = {
  responseModalities: ['TEXT', 'IMAGE'],
  temperature: 1.0,
  imageConfig: {
    aspectRatio,
    imageSize,
  },
};
```

**Step 2: Return aspect_ratio in grid-preset GET endpoint**

In `server/index.js`, update the GET `/api/grid-presets` response mapping (line 293-306) to include the new fields:

```javascript
res.json(rows.map(r => ({
  id: r.id,
  name: r.name,
  spriteType: r.sprite_type,
  genre: r.genre,
  gridSize: r.grid_size,
  cols: r.cols,
  rows: r.rows,
  cellLabels: JSON.parse(r.cell_labels),
  cellGroups: JSON.parse(r.cell_groups),
  genericGuidance: r.generic_guidance,
  bgMode: r.bg_mode,
  aspectRatio: r.aspect_ratio || '1:1',
  tileShape: r.tile_shape || 'square',
  isPreset: r.is_preset,
})));
```

**Step 3: Accept aspect_ratio and tile_shape in grid-preset POST endpoint**

In `server/index.js`, update POST `/api/grid-presets` (line 310-322):

```javascript
const { name, spriteType, genre, gridSize, cols, rows, cellLabels, cellGroups, genericGuidance, bgMode, aspectRatio, tileShape } = req.body;
// ...
const result = db.prepare(`
  INSERT INTO grid_presets (name, sprite_type, genre, grid_size, cols, rows, cell_labels, cell_groups, generic_guidance, bg_mode, aspect_ratio, tile_shape, is_preset)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
`).run(name, spriteType, genre || '', gridSize, cols, rows,
  JSON.stringify(cellLabels || []), JSON.stringify(cellGroups || []), genericGuidance || '', bgMode || null,
  aspectRatio || '1:1', tileShape || 'square');
```

**Step 4: Accept aspect_ratio and tile_shape in grid-preset PUT endpoint**

In `server/index.js`, update PUT `/api/grid-presets/:id` (line 325-338):

```javascript
const { name, genre, gridSize, cols, rows, cellLabels, cellGroups, genericGuidance, bgMode, aspectRatio, tileShape } = req.body;
const result = db.prepare(`
  UPDATE grid_presets SET name=?, genre=?, grid_size=?, cols=?, rows=?, cell_labels=?, cell_groups=?, generic_guidance=?, bg_mode=?, aspect_ratio=?, tile_shape=?
  WHERE id=?
`).run(name, genre || '', gridSize, cols, rows,
  JSON.stringify(cellLabels || []), JSON.stringify(cellGroups || []), genericGuidance || '', bgMode || null,
  aspectRatio || '1:1', tileShape || 'square', id);
```

**Step 5: Verify via curl**

```bash
# Create a test grid preset with aspect ratio
curl -s -X POST http://localhost:5174/api/grid-presets \
  -H 'Content-Type: application/json' \
  -d '{"name":"Test Iso","spriteType":"terrain","gridSize":"4x4","cols":4,"rows":4,"aspectRatio":"16:9","tileShape":"diamond"}'

# Verify it shows the new fields
curl -s http://localhost:5174/api/grid-presets | jq '.[0]'
```

Expected: Response includes `aspectRatio: "16:9"` and `tileShape: "diamond"`.

**Step 6: Commit**

```bash
git add server/routes/generate.js server/index.js
git commit -m "feat: pass aspect_ratio through server API and grid preset CRUD"
```

---

## Task 3: Update frontend types and state

**Files:**
- Modify: `src/context/AppContext.tsx:21-48` (GridPreset & GridLink interfaces)
- Modify: `src/context/AppContext.tsx:109-205` (AppState)

**Step 1: Add aspectRatio and tileShape to GridPreset interface**

In `src/context/AppContext.tsx`, update the `GridPreset` interface (lines 21-33):

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
  aspectRatio: string;
  tileShape: 'square' | 'diamond';
}
```

**Step 2: Add aspectRatio and tileShape to GridLink interface**

Update `GridLink` (lines 35-48):

```typescript
export interface GridLink {
  id: number;
  gridPresetId: number;
  guidanceOverride: string;
  sortOrder: number;
  gridName: string;
  gridSize: string;
  cols: number;
  rows: number;
  cellLabels: string[];
  cellGroups: CellGroup[];
  genericGuidance: string;
  bgMode?: 'parallax' | 'scene' | null;
  aspectRatio: string;
  tileShape: 'square' | 'diamond';
}
```

**Step 3: Add aspectRatio to AppState**

In `AppState` interface (after `imageSize` at line 157), add:

```typescript
aspectRatio: string;
```

And in `initialState` (after `imageSize: '2K'` at line 248), add:

```typescript
aspectRatio: '1:1',
```

**Step 4: Add SET_ASPECT_RATIO reducer action**

Find where other SET_ actions are handled in the reducer and add:

```typescript
case 'SET_ASPECT_RATIO':
  return { ...state, aspectRatio: action.payload };
```

**Step 5: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No type errors (may have some existing ones — just ensure no NEW errors).

**Step 6: Commit**

```bash
git add src/context/AppContext.tsx
git commit -m "feat: add aspectRatio and tileShape to frontend types and state"
```

---

## Task 4: Update template generator for non-square canvases

**Files:**
- Modify: `src/lib/templateGenerator.ts:50-110`

**Step 1: Add aspect ratio parameter to generateTemplate**

Update `generateTemplate()` to accept an `aspectRatio` parameter and calculate non-square canvas dimensions:

```typescript
export function generateTemplate(
  config: TemplateConfig = CONFIG_2K,
  gridConfig?: GridConfig,
  aspectRatio: string = '1:1',
): { canvas: HTMLCanvasElement; base64: string; width: number; height: number } {
  const { cellW, cellH, headerH, border, fontSize } = config;

  const cols = gridConfig?.cols ?? COLS;
  const rows = gridConfig?.rows ?? ROWS;
  const cellLabels = gridConfig?.cellLabels ?? CELL_LABELS;

  const gridW = cols * cellW + (cols + 1) * border;
  const gridH = rows * cellH + (rows + 1) * border;

  // Parse aspect ratio to calculate canvas dimensions
  const [arW, arH] = aspectRatio.split(':').map(Number);
  const arFactor = (arW && arH) ? arW / arH : 1;

  let canvasW: number;
  let canvasH: number;
  if (arFactor >= 1) {
    // Landscape or square: width is the larger dimension
    canvasW = Math.max(gridW, Math.ceil(gridH * arFactor));
    canvasH = Math.max(gridH, Math.ceil(gridW / arFactor));
  } else {
    // Portrait: height is the larger dimension
    canvasW = Math.max(gridW, Math.ceil(gridH * arFactor));
    canvasH = Math.max(gridH, Math.ceil(gridW / arFactor));
  }

  const canvas = document.createElement('canvas');
  canvas.width = canvasW;
  canvas.height = canvasH;
  const ctx = canvas.getContext('2d')!;

  // Fill entire canvas with black
  ctx.fillStyle = BLACK;
  ctx.fillRect(0, 0, canvasW, canvasH);

  // Offset to center the grid on the canvas
  const offsetX = Math.floor((canvasW - gridW) / 2);
  const offsetY = Math.floor((canvasH - gridH) / 2);

  // ... rest of the function unchanged (uses offsetX, offsetY) ...

  return { canvas, base64, width: canvasW, height: canvasH };
}
```

**Step 2: Update getCellBounds similarly**

Update `getCellBounds()` (lines 115-134) to also accept `aspectRatio` parameter and use non-square canvas dimensions for offset calculation:

```typescript
export function getCellBounds(
  cellIndex: number,
  config: TemplateConfig = CONFIG_2K,
  gridConfig?: GridConfig,
  aspectRatio: string = '1:1',
): { x: number; y: number; w: number; h: number } {
  const cols = gridConfig?.cols ?? COLS;
  const rows = gridConfig?.rows ?? ROWS;

  const gridW = cols * config.cellW + (cols + 1) * config.border;
  const gridH = rows * config.cellH + (rows + 1) * config.border;

  const [arW, arH] = aspectRatio.split(':').map(Number);
  const arFactor = (arW && arH) ? arW / arH : 1;
  let canvasW: number;
  let canvasH: number;
  if (arFactor >= 1) {
    canvasW = Math.max(gridW, Math.ceil(gridH * arFactor));
    canvasH = Math.max(gridH, Math.ceil(gridW / arFactor));
  } else {
    canvasW = Math.max(gridW, Math.ceil(gridH * arFactor));
    canvasH = Math.max(gridH, Math.ceil(gridW / arFactor));
  }

  const offsetX = Math.floor((canvasW - gridW) / 2);
  const offsetY = Math.floor((canvasH - gridH) / 2);

  const col = cellIndex % cols;
  const row = Math.floor(cellIndex / cols);
  const x = offsetX + config.border + col * (config.cellW + config.border);
  const y = offsetY + config.border + row * (config.cellH + config.border) + config.headerH;
  return { x, y, w: config.cellW, h: config.cellH - config.headerH };
}
```

**Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No new type errors.

**Step 4: Commit**

```bash
git add src/lib/templateGenerator.ts
git commit -m "feat: support non-square canvas dimensions in template generator"
```

---

## Task 5: Update gridConfig for aspect-ratio-aware cell sizing

**Files:**
- Modify: `src/lib/gridConfig.ts:18-29` (GridConfig interface)
- Modify: `src/lib/gridConfig.ts:243-287` (getTemplateParams, gridPresetToConfig)

**Step 1: Add aspectRatio to GridConfig interface**

Update `GridConfig` interface (lines 18-29):

```typescript
export interface GridConfig {
  id: string;
  label: string;
  cols: number;
  rows: number;
  totalCells: number;
  cellLabels: string[];
  aspectRatio?: string;
  tileShape?: 'square' | 'diamond';
  templates: {
    '2K': TemplateParams;
    '4K': TemplateParams;
  };
}
```

**Step 2: Update getTemplateParams for aspect ratio**

Update `getTemplateParams()` (line 243) to accept and use aspect ratio for fallback calculations:

```typescript
function getTemplateParams(gridSize: string, spriteType: string, aspectRatio: string = '1:1'): GridConfig['templates'] {
  // Existing lookups for known grid types (unchanged)
  if (spriteType === 'character' && gridSize === '6x6') return CHARACTER_GRID.templates;
  if (spriteType === 'building' && BUILDING_GRIDS[gridSize]) return BUILDING_GRIDS[gridSize].templates;
  if (spriteType === 'terrain' && TERRAIN_GRIDS[gridSize]) return TERRAIN_GRIDS[gridSize].templates;
  if (spriteType === 'background' && BACKGROUND_GRIDS[gridSize]) return BACKGROUND_GRIDS[gridSize].templates;

  // Fallback: calculate proportional cell sizes
  const [colStr, rowStr] = gridSize.split('x');
  const cols = parseInt(colStr, 10) || 3;
  const rows = parseInt(rowStr, 10) || 3;

  // Parse aspect ratio for canvas size calculation
  const [arW, arH] = aspectRatio.split(':').map(Number);
  const arFactor = (arW && arH) ? arW / arH : 1;

  // Base sizes: 2048 for 2K, 4096 for 4K
  const base2K = 2048;
  const base4K = 4096;

  const canvasW2K = arFactor >= 1 ? base2K : Math.round(base2K * arFactor);
  const canvasH2K = arFactor >= 1 ? Math.round(base2K / arFactor) : base2K;
  const canvasW4K = arFactor >= 1 ? base4K : Math.round(base4K * arFactor);
  const canvasH4K = arFactor >= 1 ? Math.round(base4K / arFactor) : base4K;

  // Subtract border space: (cols+1)*2 for 2K, (cols+1)*4 for 4K
  const cellW2K = Math.floor((canvasW2K - (cols + 1) * 2) / cols);
  const cellH2K = Math.floor((canvasH2K - (rows + 1) * 2) / rows);
  const cellW4K = Math.floor((canvasW4K - (cols + 1) * 4) / cols);
  const cellH4K = Math.floor((canvasH4K - (rows + 1) * 4) / rows);

  return {
    '2K': { cellW: cellW2K, cellH: cellH2K, headerH: 22, border: 2, fontSize: 14 },
    '4K': { cellW: cellW4K, cellH: cellH4K, headerH: 36, border: 4, fontSize: 22 },
  };
}
```

**Step 3: Update gridPresetToConfig to pass aspect ratio through**

Update `gridPresetToConfig()` (line 274-287):

```typescript
export function gridPresetToConfig(preset: any, spriteType?: string): GridConfig {
  const resolvedSpriteType = spriteType || preset.spriteType || 'character';
  const label = preset.name || preset.gridName || `Grid ${preset.gridSize}`;
  const id = preset.gridPresetId || preset.id;
  const aspectRatio = preset.aspectRatio || '1:1';
  const tileShape = preset.tileShape || 'square';
  return {
    id: `preset-${id}`,
    label,
    cols: preset.cols,
    rows: preset.rows,
    totalCells: preset.cols * preset.rows,
    cellLabels: preset.cellLabels,
    aspectRatio,
    tileShape,
    templates: getTemplateParams(preset.gridSize, resolvedSpriteType, aspectRatio),
  };
}
```

**Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

**Step 5: Commit**

```bash
git add src/lib/gridConfig.ts
git commit -m "feat: aspect-ratio-aware cell sizing in gridConfig"
```

---

## Task 6: Pass aspectRatio through Gemini client

**Files:**
- Modify: `src/api/geminiClient.ts:10-34`

**Step 1: Add aspectRatio parameter to generateGrid()**

```typescript
export async function generateGrid(
  model: string,
  prompt: string,
  templateImage: { data: string; mimeType: string },
  imageSize: string = '2K',
  signal?: AbortSignal,
  referenceImage?: { data: string; mimeType: string },
  aspectRatio: string = '1:1',
): Promise<GridGenerateResult> {
  const body: Record<string, unknown> = { model, prompt, templateImage, imageSize, aspectRatio };
  if (referenceImage) body.referenceImage = referenceImage;

  const response = await fetch('/api/generate-grid', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
    throw new Error(err.error || `Generation failed (${response.status})`);
  }

  return response.json();
}
```

**Step 2: Update all call sites**

Search for all calls to `generateGrid()` and pass the `aspectRatio` from app state. The primary call site is in the generation hook/handler. Find it and add the `aspectRatio` argument.

**Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

**Step 4: Commit**

```bash
git add src/api/geminiClient.ts
git commit -m "feat: pass aspectRatio through Gemini client to server"
```

---

## Task 7: Update all generateGrid() call sites

**Files:**
- Search and modify all files that call `generateGrid()` or `generateTemplate()`

**Step 1: Find all call sites**

```bash
grep -rn 'generateGrid\|generateTemplate' src/ --include='*.ts' --include='*.tsx'
```

**Step 2: Update each call site**

For `generateTemplate()` calls: add the `aspectRatio` argument from the current grid's config.
For `generateGrid()` calls: add the `aspectRatio` argument from app state.

The exact changes depend on where these calls occur — likely in:
- `src/components/config/ConfigPanel.tsx` or a generation hook
- `src/hooks/useGeneration.ts` or similar

Pass `state.aspectRatio` or the current grid link's `aspectRatio` to both functions.

**Step 3: When starting a run or generation, set aspectRatio from grid preset**

When a grid link is selected for generation, read its `aspectRatio` and dispatch `SET_ASPECT_RATIO` to set it in app state.

**Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

**Step 5: Commit**

```bash
git add -A
git commit -m "feat: wire aspectRatio through all generation call sites"
```

---

## Task 8: Admin UI — add aspect ratio and tile shape fields

**Files:**
- Modify: `src/components/admin/GridPresetsTab.tsx:13-40`

**Step 1: Add fields to EditingPreset interface**

In `GridPresetsTab.tsx`, update `EditingPreset` (lines 13-25):

```typescript
interface EditingPreset {
  id?: number;
  name: string;
  spriteType: SpriteType;
  genre: string;
  gridSize: string;
  cols: number;
  rows: number;
  cellLabels: string[];
  cellGroups: CellGroup[];
  genericGuidance: string;
  bgMode: 'parallax' | 'scene' | null;
  aspectRatio: string;
  tileShape: 'square' | 'diamond';
}
```

**Step 2: Update emptyPreset()**

```typescript
function emptyPreset(): EditingPreset {
  return {
    name: '',
    spriteType: 'character',
    genre: '',
    gridSize: '6x6',
    cols: 6,
    rows: 6,
    cellLabels: Array(36).fill(''),
    cellGroups: [],
    genericGuidance: '',
    bgMode: null,
    aspectRatio: '1:1',
    tileShape: 'square',
  };
}
```

**Step 3: Add form fields in the JSX**

Find the form section in the component (where name, spriteType, genre etc. are rendered) and add after the bgMode field:

```tsx
<label>
  Aspect Ratio
  <select
    value={editing.aspectRatio}
    onChange={e => setEditing({ ...editing, aspectRatio: e.target.value })}
  >
    {['1:1','2:3','3:2','3:4','4:3','4:5','5:4','9:16','16:9','21:9'].map(r =>
      <option key={r} value={r}>{r}</option>
    )}
  </select>
</label>

<label>
  Tile Shape
  <select
    value={editing.tileShape}
    onChange={e => setEditing({ ...editing, tileShape: e.target.value as 'square' | 'diamond' })}
  >
    <option value="square">Square</option>
    <option value="diamond">Diamond (Isometric)</option>
  </select>
</label>
```

**Step 4: Include new fields in save POST/PUT body**

Find the save function and ensure `aspectRatio` and `tileShape` are included in the request body sent to the API.

**Step 5: Include new fields when loading preset for editing**

When a preset is clicked to edit, ensure `aspectRatio` and `tileShape` are populated from the preset data (with defaults for existing presets that don't have these fields yet).

**Step 6: Verify in browser**

Navigate to `/admin`, open Grid Presets tab. Verify:
- New dropdowns appear for Aspect Ratio and Tile Shape
- Creating a new grid preset with non-1:1 ratio saves correctly
- Editing existing presets shows 1:1 / square defaults

**Step 7: Commit**

```bash
git add src/components/admin/GridPresetsTab.tsx
git commit -m "feat: add aspect ratio and tile shape fields to admin grid presets"
```

---

## Task 9: Config UI — aspect ratio display and override

**Files:**
- Modify: `src/components/config/ConfigPanel.tsx`

**Step 1: Show current aspect ratio from selected grid**

When a grid link is selected, display its aspect ratio near the image size toggle. If the grid has a non-1:1 aspect ratio, show a badge or note.

**Step 2: Add aspect ratio override dropdown**

Add a dropdown below the image size selector that shows the current grid's aspect ratio and allows the user to override it:

```tsx
<label>
  Aspect Ratio
  <select
    value={state.aspectRatio}
    onChange={e => dispatch({ type: 'SET_ASPECT_RATIO', payload: e.target.value })}
  >
    {['1:1','2:3','3:2','3:4','4:3','4:5','5:4','9:16','16:9','21:9'].map(r =>
      <option key={r} value={r}>{r}</option>
    )}
  </select>
</label>
```

**Step 3: Set default aspect ratio when grid link is selected**

When a grid link is selected (in the preset loading or grid selection handler), dispatch `SET_ASPECT_RATIO` with the grid link's `aspectRatio` value so it auto-populates.

**Step 4: Verify in browser**

- Select a preset with linked grids
- Verify aspect ratio dropdown shows grid's default
- Change to a different ratio
- Generate and verify the template canvas has the correct dimensions

**Step 5: Commit**

```bash
git add src/components/config/ConfigPanel.tsx
git commit -m "feat: add aspect ratio selector to config panel"
```

---

## Task 10: Post-Apocalyptic character presets

**Files:**
- Modify: `server/db.js` — add to `seedPresets()` function

**Step 1: Add 5 Post-Apocalyptic character presets**

In `server/db.js`, add the following presets to the `PRESETS` array inside `seedPresets()`. Follow the exact pattern of existing presets (Cecil, Vivienne, etc.) with id, name, genre, description, equipment, colorNotes, and rowGuidance fields.

**Presets to create:**

1. **wasteland-wanderer** — "Wasteland Wanderer"
   - Genre: Post-Apocalyptic
   - Description: Lone survivor, weathered and resourceful, lean build with sun-damaged skin and scars. Moves cautiously, always scanning for threats.
   - Equipment: Leather duster coat, gas mask (worn on forehead when idle), makeshift spear from rebar and sharpened metal, salvaged backpack with dangling canteen.
   - Color Notes: Dusty brown leather, faded olive green undershirt, rust-orange accents, sun-bleached canvas pack, dark goggles.
   - Row Guidance: 6 rows covering all 36 poses. Emphasize survival posture — slightly crouched, alert. Spear held ready. Gas mask pulled down during battle/damage poses. Duster flaps during movement.

2. **vault-dweller** — "Vault Dweller"
   - Genre: Post-Apocalyptic
   - Description: Recently emerged underground shelter survivor, clean-cut appearance contrasting the wasteland. Curious but wary expression. Athletic build.
   - Equipment: Blue jumpsuit with yellow stripe and number patch, Pip-Boy wrist computer (left arm, green screen glow), laser pistol (right hand), small utility belt.
   - Color Notes: Blue jumpsuit, bright yellow trim and number, chrome/green Pip-Boy glow, dark boots, red laser beam for attacks.
   - Row Guidance: 6 rows. Clean, purposeful movement — less survival-instinct, more trained posture. Pip-Boy consulted during idle poses. Laser pistol shots for attacks. Jumpsuit stays clean and bright.

3. **raider-warlord** — "Raider Warlord"
   - Genre: Post-Apocalyptic
   - Description: Brutal scavenger leader, massive intimidating build. Wild mohawk, tribal war paint. Moves with aggressive confidence.
   - Equipment: Spiked shoulder pauldrons from car parts, chain weapon (heavy chain with padlock), leather pants with metal studs, bone necklace, combat boots with blades.
   - Color Notes: Black leather, rust-red war paint, bone-white accessories, gunmetal grey spikes, dirty skin tones.
   - Row Guidance: 6 rows. Aggressive stance — wide-legged, chain swinging. Mohawk prominent from all angles. Attack poses show chain whipped overhead. Victory pose: standing on imaginary defeated foe. War paint visible in all poses.

4. **mutant-enforcer** — "Mutant Enforcer"
   - Genre: Post-Apocalyptic
   - Description: Oversized irradiated brute, tragic mutated figure. Hulking asymmetric build — one arm larger than the other. Lurching gait.
   - Equipment: Crude super sledge (parking meter welded to concrete block), torn pre-war clothing stretched over mutated frame, radiation scars glowing faintly.
   - Color Notes: Sickly green-tinged skin, purple bruising and veins, grey tattered clothing, orange radiation glow from scars, dark brown crude weapon.
   - Row Guidance: 6 rows. Asymmetric movement — larger left arm leads. Lurching walk with heavy footfalls. Super sledge dragged on ground during walk, raised overhead for attacks. Hunched posture. Radiation glow increases during damage/critical poses.

5. **caravan-trader** — "Caravan Trader"
   - Genre: Post-Apocalyptic
   - Description: Traveling merchant, pragmatic survivor with a weathered but friendly face. Medium build, slightly hunched from carrying heavy packs.
   - Equipment: Wide-brimmed hat, leather pack harness with visible trade goods (bottles, fabric rolls), revolver in hip holster, walking stick.
   - Color Notes: Tan and brown leather, brass buckles, faded red bandana, cream-colored hat, dark wood walking stick, metallic revolver.
   - Row Guidance: 6 rows. Friendly but cautious posture. Walking stick used as third leg during walk poses. Hat brim shades face. Revolver drawn only for attack poses (hip-fire style). Pack bounces slightly during movement. Idle poses show adjusting hat or checking goods.

Each character needs full 36-cell row guidance in the same format as existing presets (ROW 0 through ROW 5 with Header references like `Header "Walk Down 1" (0,0):`).

**Step 2: Verify the seed runs**

Delete and recreate the database to test:
```bash
rm data/grid-sprite.db
node -e "require('./server/db.js').getDb()"
```

Expected: No errors. Check character_presets table has 5 new Post-Apocalyptic entries.

**Step 3: Commit**

```bash
git add server/db.js
git commit -m "feat: add 5 Post-Apocalyptic character presets"
```

---

## Task 11: Sci-Fi Horror character presets

**Files:**
- Modify: `server/db.js` — add to `seedPresets()` function

**Step 1: Add 5 Sci-Fi Horror character presets**

Same pattern as Task 10. Add to the PRESETS array:

1. **xenomorph-drone** — "Xenomorph Drone"
   - Genre: Sci-Fi Horror
   - Description: Elongated biomechanical predator, sleek obsidian exoskeleton. Moves on all fours or bipedal. Inner jaw extends during attacks. Eyeless elongated skull.
   - Equipment: Natural weapons — claws, inner jaw, bladed tail, dorsal tubes. No artificial equipment.
   - Color Notes: Obsidian black with dark blue highlights, silver metallic teeth, translucent inner mouth, acid-green blood (visible during damage).
   - Row Guidance: Alien quadrupedal/bipedal movement. Tail always visible and active. Inner jaw extends during attacks. Dorsal tubes prominent from rear/side views. Death poses show acid blood pooling.

2. **xenomorph-warrior** — "Xenomorph Warrior"
   - Genre: Sci-Fi Horror
   - Description: Larger, more heavily armored variant with ridged head crest. More aggressive stance than drone. Thick chitinous plates across chest and limbs.
   - Equipment: Larger claws, armored tail with blade, chitinous chest plates, ridged cranial crest.
   - Color Notes: Black with dark brown undertones, bone-white crest ridges, acid-green blood, darker armor plates.
   - Row Guidance: More upright stance than drone. Crest is key silhouette differentiator. Heavier attacks — lunging with both claws. Tail used as separate weapon in special attacks.

3. **facehugger-swarm** — "Facehugger Swarm"
   - Genre: Sci-Fi Horror
   - Description: Cluster of 3-4 spider-like parasitic creatures moving as a group. Unsettling scuttling movement on finger-like legs.
   - Equipment: Gripping finger-legs, muscular tail, ventral proboscis.
   - Color Notes: Pale flesh, pink-grey translucent skin, darker leg tips, cream-colored underbelly.
   - Row Guidance: Treat as a swarm unit — 3-4 facehuggers visible in each cell moving together. Scuttling walk cycle. Attack shows one leaping toward viewer. Different configurations per pose (clustered, spread, stacked). Smaller scale than other characters.

4. **biomechanical-entity** — "Biomechanical Entity"
   - Genre: Sci-Fi Horror
   - Description: HR Giger-inspired fusion of organic tissue and mechanical structure. Humanoid but deeply uncanny. Exposed vertebrae, chrome plating over muscle, tube-covered limbs.
   - Equipment: Organic tendril extensions, ribbed pipe limbs, exposed chrome vertebral column, biomechanical eye cluster.
   - Color Notes: Chrome silver, exposed flesh pink, dark steel grey, bone white vertebrae, blue-black organic tubes, occasional bioluminescent cyan glow.
   - Row Guidance: Unsettling deliberate movement — mechanical precision with organic fluidity. Tendrils extend and retract during attacks. Chrome catches light differently per angle. Idle poses show subtle mechanical pulsing. Death shows components separating.

5. **space-marine** — "Space Marine"
   - Genre: Sci-Fi Horror
   - Description: Heavy-armored human soldier, colonial military aesthetic. Helmet with amber visor, bulky tactical armor. Determined expression visible through visor.
   - Equipment: Pulse rifle (chunky, angular), motion tracker (handheld, green screen), tactical helmet with flip-down visor, chest-mounted tactical lamp, utility belt with ammo.
   - Color Notes: Olive drab armor, gunmetal grey weapon, amber visor glow, white chest lamp beam, green motion tracker screen, dark brown boots and gloves.
   - Row Guidance: Military trained movement — disciplined and tactical. Pulse rifle in ready position. Motion tracker checked during idle. Lamp creates small light cone in forward direction. Visor reflects ambient light.

**Step 2: Verify seed runs (same as Task 10)**

**Step 3: Commit**

```bash
git add server/db.js
git commit -m "feat: add 5 Sci-Fi Horror character presets"
```

---

## Task 12: Post-Apocalyptic building presets

**Files:**
- Modify: `server/db.js` — add to `seedBuildingPresets()` function

**Step 1: Add 4 Post-Apocalyptic building presets**

Follow the exact pattern of existing building presets (Medieval Inn, Castle Tower, etc.). Each needs: id, name, genre, gridSize, description, details, colorNotes, cellLabels (JSON array), cellGuidance (row-by-row pose descriptions).

1. **ruined-gas-station** — "Ruined Gas Station" (3×3)
   - Genre: Post-Apocalyptic
   - States: Day Abandoned, Day Scavengers, Day Sandstorm / Night Moonlit, Night Firepit, Night Danger / Heavily Damaged, Flooded, Overgrown

2. **fortified-settlement-gate** — "Fortified Settlement Gate" (3×3)
   - Genre: Post-Apocalyptic
   - States: Open Day, Open Busy, Open Traders / Closed Alert, Closed Night, Closed Siege / Damaged, Breached, Destroyed

3. **underground-bunker-entrance** — "Underground Bunker Entrance" (2×2)
   - Genre: Post-Apocalyptic
   - States: Sealed, Open Active / Overgrown Hidden, Emergency Lockdown

4. **irradiated-church** — "Irradiated Church" (3×3)
   - Genre: Post-Apocalyptic
   - States: Day Exterior, Day Glowing Interior, Day Congregation / Dusk Eerie, Dusk Radiation Storm, Dusk Mutants / Night Haunted, Night Worship, Night Collapse

Each preset will auto-create a grid preset and grid link via the existing `seedBuildingPresets()` pattern (lines 2069-2098).

**Step 2: Verify seed runs**

**Step 3: Commit**

```bash
git add server/db.js
git commit -m "feat: add 4 Post-Apocalyptic building presets"
```

---

## Task 13: Sci-Fi Horror building presets

**Files:**
- Modify: `server/db.js` — add to `seedBuildingPresets()` function

**Step 1: Add 4 Sci-Fi Horror building presets**

1. **hive-chamber** — "Hive Chamber" (3×3)
   - Genre: Sci-Fi Horror
   - States: Empty Quiet, Eggs Present, Drone Guarding / Active Hatching, Active Cocooning, Active Queen Nearby / Disturbed Alarm, Disturbed Acid, Disturbed Collapse

2. **derelict-ship-corridor** — "Derelict Ship Corridor" (3×3)
   - Genre: Sci-Fi Horror
   - States: Intact Lit, Intact Emergency, Intact Fog / Damaged Sparks, Damaged Breach, Damaged Overgrown / Infested Light, Infested Heavy, Infested Nest

3. **egg-chamber** — "Egg Chamber" (2×2)
   - Genre: Sci-Fi Horror
   - States: Dormant, Pulsing / Hatching, Destroyed

4. **biomechanical-temple** — "Biomechanical Temple" (3×3)
   - Genre: Sci-Fi Horror
   - States: Dormant Exterior, Dormant Interior Glow, Dormant Detail / Active Pulsing, Active Portal, Active Summoning / Awakened Full Power, Awakened Transformation, Awakened Collapse

**Step 2: Verify seed runs**

**Step 3: Commit**

```bash
git add server/db.js
git commit -m "feat: add 4 Sci-Fi Horror building presets"
```

---

## Task 14: Post-Apocalyptic terrain presets

**Files:**
- Modify: `server/db.js` — add to `seedTerrainPresets()` function

**Step 1: Add 3 Post-Apocalyptic terrain presets**

Follow pattern of existing terrain presets (Grassland Plains, Dungeon Stone, etc.). Each needs: id, name, genre, gridSize, description, colorNotes, tileLabels (JSON array of 16 tile names for 4×4), tileGuidance (row-by-row tile descriptions).

1. **cracked-desert-wasteland** — "Cracked Desert Wasteland" (4×4)
   - Genre: Post-Apocalyptic
   - 16 tiles: Center variants (3), dried brush, edge N/S/E/W, corner NE/NW/SE/SW, inner corner NE/NW/SE/SW, radiation pool
   - Tiling guidance emphasizing seamless edges, sun-baked earth, crack patterns

2. **toxic-swamp** — "Toxic Swamp" (4×4)
   - Genre: Post-Apocalyptic
   - 16 tiles: Murky water center (3), dead tree, edge transitions to dry ground, corners, inner corners, glowing fungus patch
   - Green/purple toxic colors, bubbling surface

3. **ruined-highway** — "Ruined Highway" (4×4)
   - Genre: Post-Apocalyptic
   - 16 tiles: Asphalt center (3), cracked with grass, edge to dirt, corners, inner corners, rusted vehicle debris
   - Grey asphalt, yellow lane markings, green overgrowth

**Step 2: Verify seed runs**

**Step 3: Commit**

```bash
git add server/db.js
git commit -m "feat: add 3 Post-Apocalyptic terrain presets"
```

---

## Task 15: Sci-Fi Horror terrain presets

**Files:**
- Modify: `server/db.js` — add to `seedTerrainPresets()` function

**Step 1: Add 3 Sci-Fi Horror terrain presets**

1. **organic-hive-floor** — "Organic Hive Floor" (4×4)
   - Genre: Sci-Fi Horror
   - 16 tiles following Wang 2-corner pattern: 3 center variants (resin-coated metal, different organic growth patterns), edge tiles transitioning to clean metal, corners, inner corners, acid burn patch

2. **industrial-grating** — "Industrial Grating" (4×4)
   - Genre: Sci-Fi Horror
   - 16 tiles: Steel grating center (3), steam vent, edge to solid floor, corners, inner corners, cable runs

3. **alien-planet-surface** — "Alien Planet Surface" (4×4)
   - Genre: Sci-Fi Horror
   - 16 tiles: Jagged rock center (3), bioluminescent pool, edge to smooth rock, corners, inner corners, alien fungi cluster

**Step 2: Verify seed runs**

**Step 3: Commit**

```bash
git add server/db.js
git commit -m "feat: add 3 Sci-Fi Horror terrain presets"
```

---

## Task 16: Post-Apocalyptic background presets

**Files:**
- Modify: `server/db.js` — add to `seedBackgroundPresets()` function

**Step 1: Add 3 Post-Apocalyptic background presets**

Follow pattern of existing background presets. Each needs: id, name, genre, gridSize, bgMode, description, colorNotes, layerLabels (JSON array), layerGuidance.

1. **nuclear-sunset-skyline** — "Nuclear Sunset Skyline" (1×4, parallax)
   - Genre: Post-Apocalyptic
   - 4 layers: Far sky (orange-red gradient, mushroom cloud remnant), distant ruined cityscape silhouette, mid-ground rubble and dead trees, foreground cracked earth and debris

2. **underground-vault-interior** — "Underground Vault Interior" (1×4, parallax)
   - Genre: Post-Apocalyptic
   - 4 layers: Far wall (metal panels, vault number), mid equipment and lockers, foreground desks and terminals, floor and overhead pipes

3. **wasteland-trading-post** — "Wasteland Trading Post" (2×2, scene)
   - Genre: Post-Apocalyptic
   - 4 scenes: Day bustling, Day quiet, Night campfire, Night abandoned

**Step 2: Verify seed runs**

**Step 3: Commit**

```bash
git add server/db.js
git commit -m "feat: add 3 Post-Apocalyptic background presets"
```

---

## Task 17: Sci-Fi Horror background presets

**Files:**
- Modify: `server/db.js` — add to `seedBackgroundPresets()` function

**Step 1: Add 3 Sci-Fi Horror background presets**

1. **hive-interior** — "Hive Interior" (1×4, parallax)
   - Genre: Sci-Fi Horror
   - 4 layers: Far wall (vast organic cavern), mid resin walls and cocooned figures, near organic pillars, foreground floor and egg clusters

2. **space-station-breach** — "Space Station Breach" (1×4, parallax)
   - Genre: Sci-Fi Horror
   - 4 layers: Space/stars through hull breach, damaged hull and sparking cables, emergency-lit corridor section, foreground debris and warning signs

3. **alien-landscape** — "Alien Landscape" (2×2, scene)
   - Genre: Sci-Fi Horror
   - 4 scenes: Day clear (dual moons), Day storm, Night bioluminescent, Night megastructure active

**Step 2: Verify seed runs**

**Step 3: Commit**

```bash
git add server/db.js
git commit -m "feat: add 3 Sci-Fi Horror background presets"
```

---

## Task 18: Isometric grid presets

**Files:**
- Modify: `server/db.js` — add new `seedIsometricGridPresets()` function, call it from `getDb()`

**Step 1: Create seedIsometricGridPresets function**

Add a new function after the existing seed functions. This creates grid presets only (no content presets — isometric grids link to existing character/terrain/building presets via grid_links).

```javascript
function seedIsometricGridPresets(db) {
  const GRIDS = [
    // Terrain grids (diamond tiles)
    {
      name: 'Iso Wasteland Floor 4×4',
      spriteType: 'terrain',
      genre: 'Post-Apocalyptic',
      gridSize: '4x4',
      cols: 4, rows: 4,
      aspectRatio: '16:9',
      tileShape: 'diamond',
      cellLabels: ['Center 1','Center 2','Center 3','Edge N','Edge S','Edge E','Edge W',
                   'Corner NE','Corner NW','Corner SE','Corner SW',
                   'Inner NE','Inner NW','Inner SE','Inner SW','Variant'],
      genericGuidance: 'Isometric 2:1 diamond tiles... [detailed guidance]',
    },
    {
      name: 'Iso Hive Floor 4×4',
      spriteType: 'terrain',
      genre: 'Sci-Fi Horror',
      gridSize: '4x4',
      cols: 4, rows: 4,
      aspectRatio: '16:9',
      tileShape: 'diamond',
      cellLabels: ['Center 1','Center 2','Center 3','Edge N','Edge S','Edge E','Edge W',
                   'Corner NE','Corner NW','Corner SE','Corner SW',
                   'Inner NE','Inner NW','Inner SE','Inner SW','Variant'],
      genericGuidance: 'Isometric 2:1 diamond tiles... [organic hive guidance]',
    },
    // Wall grids (square cells showing wall orientations)
    {
      name: 'Iso Wasteland Walls 4×2',
      spriteType: 'building',
      genre: 'Post-Apocalyptic',
      gridSize: '4x2',
      cols: 4, rows: 2,
      aspectRatio: '16:9',
      tileShape: 'square',
      cellLabels: ['Wall Left','Wall Upper','Corner Upper-Left (Upper)','Corner Upper-Left (Left)',
                   'Corner Upper-Right','Corner Lower-Left','Corner Lower-Right','Pillar'],
      genericGuidance: 'Isometric wall tiles... [wasteland guidance]',
    },
    {
      name: 'Iso Hive Walls 4×2',
      spriteType: 'building',
      genre: 'Sci-Fi Horror',
      gridSize: '4x2',
      cols: 4, rows: 2,
      aspectRatio: '16:9',
      tileShape: 'square',
      cellLabels: ['Wall Left','Wall Upper','Corner Upper-Left (Upper)','Corner Upper-Left (Left)',
                   'Corner Upper-Right','Corner Lower-Left','Corner Lower-Right','Pillar'],
      genericGuidance: 'Isometric wall tiles... [organic hive guidance]',
    },
    // Character grids (8-direction animation)
    {
      name: 'Iso Walk Cycle 8×6',
      spriteType: 'character',
      genre: 'Isometric',
      gridSize: '8x6',
      cols: 8, rows: 6,
      aspectRatio: '16:9',
      tileShape: 'square',
      cellLabels: [
        // Row 0 (S direction): 8 frames
        'S Frame 1','S Frame 2','S Frame 3','S Frame 4','S Frame 5','S Frame 6','S Frame 7','S Frame 8',
        // Row 1 (SW): 8 frames
        'SW Frame 1','SW Frame 2','SW Frame 3','SW Frame 4','SW Frame 5','SW Frame 6','SW Frame 7','SW Frame 8',
        // Row 2 (W): 8 frames
        'W Frame 1','W Frame 2','W Frame 3','W Frame 4','W Frame 5','W Frame 6','W Frame 7','W Frame 8',
        // Row 3 (NW): 8 frames
        'NW Frame 1','NW Frame 2','NW Frame 3','NW Frame 4','NW Frame 5','NW Frame 6','NW Frame 7','NW Frame 8',
        // Row 4 (N): 8 frames
        'N Frame 1','N Frame 2','N Frame 3','N Frame 4','N Frame 5','N Frame 6','N Frame 7','N Frame 8',
        // Row 5 (NE): 8 frames — NE, E, SE can be mirrored from NW, W, SW
        'NE Frame 1','NE Frame 2','NE Frame 3','NE Frame 4','NE Frame 5','NE Frame 6','NE Frame 7','NE Frame 8',
      ],
      genericGuidance: '8-direction isometric walk cycle... [detailed guidance for each direction]',
    },
    {
      name: 'Iso Attack Cycle 8×4',
      spriteType: 'character',
      genre: 'Isometric',
      gridSize: '8x4',
      cols: 8, rows: 4,
      aspectRatio: '16:9',
      tileShape: 'square',
      cellLabels: [
        'S Atk 1','S Atk 2','S Atk 3','S Atk 4','S Atk 5','S Atk 6','S Atk 7','S Atk 8',
        'SW Atk 1','SW Atk 2','SW Atk 3','SW Atk 4','SW Atk 5','SW Atk 6','SW Atk 7','SW Atk 8',
        'W Atk 1','W Atk 2','W Atk 3','W Atk 4','W Atk 5','W Atk 6','W Atk 7','W Atk 8',
        'NW Atk 1','NW Atk 2','NW Atk 3','NW Atk 4','NW Atk 5','NW Atk 6','NW Atk 7','NW Atk 8',
      ],
      genericGuidance: '8-direction isometric attack cycle... [guidance]',
    },
    {
      name: 'Iso Idle Cycle 8×4',
      spriteType: 'character',
      genre: 'Isometric',
      gridSize: '8x4',
      cols: 8, rows: 4,
      aspectRatio: '16:9',
      tileShape: 'square',
      cellLabels: [
        'S Idle 1','S Idle 2','S Idle 3','S Idle 4','S Idle 5','S Idle 6','S Idle 7','S Idle 8',
        'SW Idle 1','SW Idle 2','SW Idle 3','SW Idle 4','SW Idle 5','SW Idle 6','SW Idle 7','SW Idle 8',
        'W Idle 1','W Idle 2','W Idle 3','W Idle 4','W Idle 5','W Idle 6','W Idle 7','W Idle 8',
        'NW Idle 1','NW Idle 2','NW Idle 3','NW Idle 4','NW Idle 5','NW Idle 6','NW Idle 7','NW Idle 8',
      ],
      genericGuidance: '8-direction isometric idle cycle... [guidance]',
    },
    {
      name: 'Iso Death Sequence 8×4',
      spriteType: 'character',
      genre: 'Isometric',
      gridSize: '8x4',
      cols: 8, rows: 4,
      aspectRatio: '16:9',
      tileShape: 'square',
      cellLabels: [
        'S Death 1','S Death 2','S Death 3','S Death 4','S Death 5','S Death 6','S Death 7','S Death 8',
        'SW Death 1','SW Death 2','SW Death 3','SW Death 4','SW Death 5','SW Death 6','SW Death 7','SW Death 8',
        'W Death 1','W Death 2','W Death 3','W Death 4','W Death 5','W Death 6','W Death 7','W Death 8',
        'NW Death 1','NW Death 2','NW Death 3','NW Death 4','NW Death 5','NW Death 6','NW Death 7','NW Death 8',
      ],
      genericGuidance: '8-direction isometric death sequence... [guidance]',
    },
  ];

  const insert = db.prepare(`
    INSERT OR IGNORE INTO grid_presets (name, sprite_type, genre, grid_size, cols, rows, cell_labels, cell_groups, generic_guidance, bg_mode, aspect_ratio, tile_shape, is_preset)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
  `);

  const insertAll = db.transaction(() => {
    for (const g of GRIDS) {
      const cellGroups = [];
      for (let r = 0; r < g.rows; r++) {
        const cells = [];
        for (let c = 0; c < g.cols; c++) cells.push(r * g.cols + c);
        cellGroups.push({ name: `Row ${r + 1}`, cells });
      }
      insert.run(g.name, g.spriteType, g.genre, g.gridSize, g.cols, g.rows,
        JSON.stringify(g.cellLabels), JSON.stringify(cellGroups),
        g.genericGuidance, null, g.aspectRatio, g.tileShape);
    }
  });

  insertAll();
  console.log(`[DB] Seeded ${GRIDS.length} isometric grid presets.`);
}
```

**Step 2: Call from getDb()**

In `getDb()` (line 10-28), add after existing seed calls:

```javascript
seedIsometricGridPresets(db);
```

**Step 3: Fill in detailed genericGuidance**

Each isometric grid preset needs comprehensive guidance text:
- Terrain grids: Describe diamond tile drawing, edge matching, color consistency
- Wall grids: Describe isometric wall orientation conventions
- Character grids: Describe per-direction pose requirements, isometric perspective angle, consistent proportions across all 8 directions

**Step 4: Verify seed runs**

**Step 5: Commit**

```bash
git add server/db.js
git commit -m "feat: add 8 isometric grid presets"
```

---

## Task 19: Multi-sheet animation series (pre-linked grid links)

**Files:**
- Modify: `server/db.js` — add new `seedAnimationSeries()` function

**Step 1: Create seedAnimationSeries function**

This function creates grid links between character presets and isometric character grid presets to form pre-linked animation series.

```javascript
function seedAnimationSeries(db) {
  const findGrid = db.prepare("SELECT id FROM grid_presets WHERE name = ?");
  const insertLink = db.prepare(`
    INSERT OR IGNORE INTO character_grid_links (character_preset_id, grid_preset_id, guidance_override, sort_order)
    VALUES (?, ?, ?, ?)
  `);

  const SERIES = [
    {
      characterId: 'wasteland-wanderer',
      grids: [
        { name: 'Iso Walk Cycle 8×6', order: 0, guidance: 'Walking cautiously through wasteland...' },
        { name: 'Iso Attack Cycle 8×4', order: 1, guidance: 'Melee spear thrust attacks...' },
        { name: 'Iso Idle Cycle 8×4', order: 2, guidance: 'Standing alert, scanning horizon...' },
        { name: 'Iso Death Sequence 8×4', order: 3, guidance: 'Collapse from exhaustion/damage...' },
      ],
    },
    {
      characterId: 'xenomorph-warrior',
      grids: [
        { name: 'Iso Walk Cycle 8×6', order: 0, guidance: 'Predatory stalking movement...' },
        { name: 'Iso Attack Cycle 8×4', order: 1, guidance: 'Lunging claw attack...' },
        { name: 'Iso Idle Cycle 8×4', order: 2, guidance: 'Alert stance, tail swaying...' },
        { name: 'Iso Death Sequence 8×4', order: 3, guidance: 'Acid blood death, dissolving...' },
      ],
    },
    {
      characterId: 'vault-dweller',
      grids: [
        { name: 'Iso Walk Cycle 8×6', order: 0, guidance: 'Purposeful vault-trained walk...' },
        { name: 'Iso Attack Cycle 8×4', order: 1, guidance: 'Laser pistol firing sequence...' },
        { name: 'Iso Idle Cycle 8×4', order: 2, guidance: 'Checking Pip-Boy readout...' },
        { name: 'Iso Death Sequence 8×4', order: 3, guidance: 'Collapse animation...' },
      ],
    },
    {
      characterId: 'biomechanical-entity',
      grids: [
        { name: 'Iso Walk Cycle 8×6', order: 0, guidance: 'Mechanical-organic crawling movement...' },
        { name: 'Iso Attack Cycle 8×4', order: 1, guidance: 'Tendril lash attack...' },
        { name: 'Iso Idle Cycle 8×4', order: 2, guidance: 'Pulsing/breathing mechanical idle...' },
        { name: 'Iso Death Sequence 8×4', order: 3, guidance: 'Component disassembly/collapse...' },
      ],
    },
  ];

  const linkAll = db.transaction(() => {
    for (const series of SERIES) {
      for (const grid of series.grids) {
        const gridRow = findGrid.get(grid.name);
        if (gridRow) {
          insertLink.run(series.characterId, gridRow.id, grid.guidance, grid.order);
        }
      }
    }
  });

  linkAll();
  console.log(`[DB] Seeded ${SERIES.length} animation series links.`);
}
```

**Step 2: Call from getDb() after seedIsometricGridPresets()**

```javascript
seedAnimationSeries(db);
```

**Step 3: Fill in detailed guidance_override per link**

Each grid link needs a guidance_override describing how the character should perform the specific animation in isometric style. This is the per-character customization that makes the Wasteland Wanderer's walk different from the Xenomorph Warrior's walk.

**Step 4: Verify in the app**

1. Start the app
2. Select the Wasteland Wanderer preset
3. Verify 5 grid links appear (the existing RPG Full 6×6 + 4 new iso grids)
4. Verify the iso grids show correct grid sizes and aspect ratios

**Step 5: Commit**

```bash
git add server/db.js
git commit -m "feat: add pre-linked isometric animation series for 4 characters"
```

---

## Task Dependencies

```
Task 1 (schema) → Task 2 (server API) → Task 3 (frontend types) → Tasks 4,5,6 (parallel: template, gridConfig, client)
                                                                  → Tasks 8,9 (parallel: admin UI, config UI)

Task 1 → Task 18 (iso grid presets, needs aspect_ratio column)
Task 10,11 (character presets, independent of schema changes)
Task 12,13 (building presets, independent)
Task 14,15 (terrain presets, independent)
Task 16,17 (background presets, independent)
Task 18 → Task 19 (animation series links iso grids to characters)

Tasks 10-17 are independent of each other and can run in parallel.
Tasks 10,11 must complete before Task 19 (which links characters to iso grids).
```

## Parallelization Guide

**Sequential chain (must be ordered):**
Tasks 1 → 2 → 3 → 7 (schema → server → types → call sites)

**After Task 1 completes, parallel group A:**
- Task 4 (template generator)
- Task 5 (gridConfig)
- Task 6 (gemini client)
- Task 8 (admin UI)
- Task 9 (config UI)

**Independent parallel group B (can start immediately):**
- Task 10 (post-apoc characters)
- Task 11 (sci-fi horror characters)
- Task 12 (post-apoc buildings)
- Task 13 (sci-fi horror buildings)
- Task 14 (post-apoc terrain)
- Task 15 (sci-fi horror terrain)
- Task 16 (post-apoc backgrounds)
- Task 17 (sci-fi horror backgrounds)

**After Tasks 1, 10, 11 complete:**
- Task 18 (iso grid presets)

**After Tasks 10, 11, 18 complete:**
- Task 19 (animation series links)
