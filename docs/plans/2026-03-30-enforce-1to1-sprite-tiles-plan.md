# Enforce 1:1 Sprite Tiles Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use h-superpowers:subagent-driven-development, h-superpowers:team-driven-development, or h-superpowers:executing-plans to implement this plan (ask user which approach).

**Goal:** All non-background sprite tiles are always 1:1 squares, with aspect ratio derived from grid layout rather than user-selected.

**Architecture:** Replace hardcoded template params and `getTemplateParams()` with a single `computeSquareLayout()` function that tries all Gemini-supported aspect ratios and picks the one maximizing cell size. Remove aspect ratio UI for non-background types. Purge "RPG Full (Tall)" preset.

**Tech Stack:** TypeScript, Vitest, React, SQLite (better-sqlite3), Express

---

### Task 1: Add `computeSquareLayout()` with tests

**Files:**
- Create: `src/lib/computeSquareLayout.ts`
- Create: `src/lib/__tests__/computeSquareLayout.test.ts`

**Step 1: Write the tests**

```typescript
// src/lib/__tests__/computeSquareLayout.test.ts
import { describe, it, expect } from 'vitest';
import { computeSquareLayout, GEMINI_ASPECT_RATIOS } from '../computeSquareLayout';

describe('computeSquareLayout', () => {
  it('returns square cells for a 6x6 grid at 2K', () => {
    const layout = computeSquareLayout(6, 6, '2K');
    expect(layout.cellSize).toBeGreaterThan(0);
    expect(layout.canvasW).toBeLessThanOrEqual(2048);
    expect(layout.canvasH).toBeLessThanOrEqual(2048);
    expect(layout.headerH).toBe(14);
    expect(layout.border).toBe(2);
  });

  it('returns square cells for a 6x6 grid at 4K', () => {
    const layout = computeSquareLayout(6, 6, '4K');
    expect(layout.cellSize).toBeGreaterThan(0);
    expect(layout.canvasW).toBeLessThanOrEqual(4096);
    expect(layout.canvasH).toBeLessThanOrEqual(4096);
    expect(layout.headerH).toBe(22);
    expect(layout.border).toBe(4);
  });

  it('picks 1:1 aspect ratio for square grids', () => {
    const layout = computeSquareLayout(6, 6, '2K');
    expect(layout.aspectRatio).toBe('1:1');
  });

  it('picks a wider aspect ratio for 8x4 grid', () => {
    const layout = computeSquareLayout(8, 4, '2K');
    // 8 cols, 4 rows = wider than tall, should not be 1:1
    expect(layout.aspectRatio).not.toBe('1:1');
    expect(layout.aspectRatio).not.toBe('2:3');
    expect(layout.aspectRatio).not.toBe('9:16');
  });

  it('picks a wider aspect ratio for 8x6 grid', () => {
    const layout = computeSquareLayout(8, 6, '2K');
    expect(layout.cellSize).toBeGreaterThan(0);
    // Should be landscape-ish
    expect(layout.canvasW).toBeGreaterThanOrEqual(layout.canvasH);
  });

  it('grid fits within canvas bounds', () => {
    for (const [cols, rows] of [[6,6],[8,4],[8,6],[3,3],[4,4],[5,5],[2,2],[2,3],[4,2]]) {
      for (const res of ['2K', '4K'] as const) {
        const layout = computeSquareLayout(cols, rows, res);
        const gridW = cols * layout.cellSize + (cols + 1) * layout.border;
        const gridH = rows * (layout.cellSize + layout.headerH) + (rows + 1) * layout.border;
        expect(gridW).toBeLessThanOrEqual(layout.canvasW);
        expect(gridH).toBeLessThanOrEqual(layout.canvasH);
      }
    }
  });

  it('maximizes cell size across all grid configs', () => {
    // For a 3x3 grid at 2K, 1:1 canvas should give the best cell size
    const layout = computeSquareLayout(3, 3, '2K');
    // Manually compute what 1:1 would give
    const base = 2048;
    const maxFromW = Math.floor((base - 4 * 2) / 3);
    const maxFromH = Math.floor((base - 4 * 2) / 3) - 14;
    expect(layout.cellSize).toBe(Math.min(maxFromW, maxFromH));
  });

  it('derived aspect ratio is always a Gemini-supported ratio', () => {
    const ratios = GEMINI_ASPECT_RATIOS.map(([w, h]) => `${w}:${h}`);
    for (const [cols, rows] of [[6,6],[8,4],[8,6],[3,3],[4,4],[5,5],[2,2],[2,3],[4,2],[1,3]]) {
      const layout = computeSquareLayout(cols, rows, '2K');
      expect(ratios).toContain(layout.aspectRatio);
    }
  });

  it('prefers tighter fit when cell sizes tie', () => {
    // Two aspect ratios might yield the same cellSize but different canvas areas
    // The function should pick the smaller canvas (tighter fit)
    const layout = computeSquareLayout(6, 6, '2K');
    // 6x6 is square; 1:1 is the tightest fit
    expect(layout.aspectRatio).toBe('1:1');
  });

  it('4K cell size is roughly 2x the 2K cell size', () => {
    const layout2K = computeSquareLayout(6, 6, '2K');
    const layout4K = computeSquareLayout(6, 6, '4K');
    const ratio = layout4K.cellSize / layout2K.cellSize;
    expect(ratio).toBeGreaterThan(1.8);
    expect(ratio).toBeLessThan(2.2);
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/__tests__/computeSquareLayout.test.ts`
Expected: FAIL — module not found

**Step 3: Write the implementation**

```typescript
// src/lib/computeSquareLayout.ts

/**
 * Compute a square-cell grid layout for a given grid size and resolution.
 * Tries all Gemini-supported aspect ratios and picks the one that maximizes
 * cell size (best use of canvas space). Ties broken by tightest fit.
 */

export const GEMINI_ASPECT_RATIOS: [number, number][] = [
  [1, 1], [2, 3], [3, 2], [3, 4], [4, 3],
  [4, 5], [5, 4], [9, 16], [16, 9], [21, 9],
];

interface ResolutionParams {
  base: number;
  border: number;
  headerH: number;
  fontSize: number;
}

const RESOLUTION_PARAMS: Record<string, ResolutionParams> = {
  '2K': { base: 2048, border: 2, headerH: 14, fontSize: 9 },
  '4K': { base: 4096, border: 4, headerH: 22, fontSize: 14 },
};

export interface SquareLayout {
  cellSize: number;
  headerH: number;
  border: number;
  fontSize: number;
  canvasW: number;
  canvasH: number;
  aspectRatio: string;
}

export function computeSquareLayout(
  cols: number,
  rows: number,
  resolution: '2K' | '4K',
): SquareLayout {
  const params = RESOLUTION_PARAMS[resolution];
  const { base, border, headerH, fontSize } = params;

  let bestCellSize = 0;
  let bestCanvasW = base;
  let bestCanvasH = base;
  let bestRatio = '1:1';
  let bestArea = Infinity;

  for (const [arW, arH] of GEMINI_ASPECT_RATIOS) {
    const arFactor = arW / arH;

    // Canvas dimensions: wider dimension = base
    let canvasW: number;
    let canvasH: number;
    if (arFactor >= 1) {
      canvasW = base;
      canvasH = Math.round(base / arFactor);
    } else {
      canvasW = Math.round(base * arFactor);
      canvasH = base;
    }

    const maxFromWidth = Math.floor((canvasW - (cols + 1) * border) / cols);
    const maxFromHeight = Math.floor((canvasH - (rows + 1) * border) / rows) - headerH;
    const cellSize = Math.min(maxFromWidth, maxFromHeight);

    if (cellSize <= 0) continue;

    const area = canvasW * canvasH;

    if (cellSize > bestCellSize || (cellSize === bestCellSize && area < bestArea)) {
      bestCellSize = cellSize;
      bestCanvasW = canvasW;
      bestCanvasH = canvasH;
      bestRatio = `${arW}:${arH}`;
      bestArea = area;
    }
  }

  return {
    cellSize: bestCellSize,
    headerH,
    border,
    fontSize,
    canvasW: bestCanvasW,
    canvasH: bestCanvasH,
    aspectRatio: bestRatio,
  };
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/__tests__/computeSquareLayout.test.ts`
Expected: All PASS

**Step 5: Commit**

```bash
git add src/lib/computeSquareLayout.ts src/lib/__tests__/computeSquareLayout.test.ts
git commit -m "feat: add computeSquareLayout for 1:1 tile enforcement"
```

---

### Task 2: Refactor `gridConfig.ts` — remove hardcoded templates, use `computeSquareLayout()`

**Files:**
- Modify: `src/lib/gridConfig.ts`
- Modify: `src/lib/__tests__/gridConfig.test.ts`

**Step 1: Update the tests**

Replace the existing template-dependent tests with new ones:

```typescript
// src/lib/__tests__/gridConfig.test.ts
// Keep all existing tests EXCEPT:
// - "has 2K and 4K templates" test (lines 23-27) — delete
// - "calculates template params for known grid sizes" test (lines 174-193) — delete
// - "calculates fallback template params for unknown grid sizes" test (lines 195-213) — delete
//
// The gridPresetToConfig tests that check aspectRatio should still pass
// since aspectRatio is still on the config, just no longer has templates.
//
// Add new test:

it('gridPresetToConfig does not include templates property', () => {
  const preset = {
    id: 1,
    name: 'Test',
    spriteType: 'building' as const,
    genre: '',
    gridSize: '3x3',
    cols: 3,
    rows: 3,
    cellLabels: [],
    cellGroups: [],
    genericGuidance: '',
    aspectRatio: '1:1',
    tileShape: 'square' as const,
  };
  const config = gridPresetToConfig(preset);
  expect(config).not.toHaveProperty('templates');
});
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/__tests__/gridConfig.test.ts`
Expected: FAIL — templates still exist on config

**Step 3: Modify `gridConfig.ts`**

Changes:
1. Remove `templates` property from `GridConfig` interface (make optional or remove)
2. Remove `templates` from `CHARACTER_GRID`, all `BUILDING_GRIDS`, all `TERRAIN_GRIDS`
3. Keep `templates` on `BACKGROUND_GRIDS` (exempt)
4. Delete `getTemplateParams()` function entirely (lines 245-279)
5. Remove `templates` from `gridPresetToConfig()` return value (line 298)

The `GridConfig` interface becomes:

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
  /** Only present on background grids (exempt from 1:1 enforcement) */
  templates?: {
    '2K': TemplateParams;
    '4K': TemplateParams;
  };
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/__tests__/gridConfig.test.ts`
Expected: All PASS

**Step 5: Commit**

```bash
git add src/lib/gridConfig.ts src/lib/__tests__/gridConfig.test.ts
git commit -m "refactor: remove hardcoded templates from non-background grids"
```

---

### Task 3: Refactor `templateGenerator.ts` — use `computeSquareLayout()`

**Files:**
- Modify: `src/lib/templateGenerator.ts`

**Step 1: Rewrite `generateTemplate()`**

Replace the current signature and implementation. The function now accepts a `SquareLayout` for non-background grids, or the legacy `TemplateConfig` for backgrounds.

```typescript
// New imports at top
import type { SquareLayout } from './computeSquareLayout';

// Remove: TemplateConfig interface (lines 14-20)
// Remove: CONFIG_2K, CONFIG_4K constants (lines 22-36)
// Keep: CHROMA_PINK, BLACK, WHITE constants

/**
 * Generate the template grid as a canvas.
 * For non-background grids, uses SquareLayout (1:1 cells).
 * For background grids, uses legacy cellW/cellH from GridConfig.templates.
 */
export function generateTemplate(
  layout: SquareLayout,
  gridConfig: GridConfig,
): { canvas: HTMLCanvasElement; base64: string; width: number; height: number } {
  const { cellSize, headerH, border, fontSize, canvasW, canvasH } = layout;

  const cols = gridConfig.cols;
  const rows = gridConfig.rows;
  const cellLabels = gridConfig.cellLabels;

  const cellW = cellSize;
  const cellH = cellSize + headerH; // total cell height including header

  const gridW = cols * cellW + (cols + 1) * border;
  const gridH = rows * cellH + (rows + 1) * border;

  const canvas = document.createElement('canvas');
  canvas.width = canvasW;
  canvas.height = canvasH;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = BLACK;
  ctx.fillRect(0, 0, canvasW, canvasH);

  const offsetX = Math.floor((canvasW - gridW) / 2);
  const offsetY = Math.floor((canvasH - gridH) / 2);

  ctx.font = `bold ${fontSize}px Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const totalCells = cols * rows;
  for (let idx = 0; idx < totalCells; idx++) {
    const col = idx % cols;
    const row = Math.floor(idx / cols);
    const label = idx < cellLabels.length ? cellLabels[idx] : `Cell ${row},${col}`;

    const x0 = offsetX + border + col * (cellW + border);
    const y0 = offsetY + border + row * (cellH + border);

    // Header strip
    ctx.fillStyle = BLACK;
    ctx.fillRect(x0, y0, cellW, headerH);
    ctx.fillStyle = WHITE;
    ctx.fillText(label, x0 + cellW / 2, y0 + headerH / 2);

    // Content area (1:1 square)
    ctx.fillStyle = CHROMA_PINK;
    ctx.fillRect(x0, y0 + headerH, cellW, cellSize);
  }

  const dataUrl = canvas.toDataURL('image/png');
  const base64 = dataUrl.split(',')[1];

  return { canvas, base64, width: canvasW, height: canvasH };
}

/**
 * Legacy template generator for background grids (exempt from 1:1).
 * Uses non-square cellW/cellH from BACKGROUND_GRIDS templates.
 */
export function generateBackgroundTemplate(
  config: { cellW: number; cellH: number; headerH: number; border: number; fontSize: number },
  gridConfig: GridConfig,
  aspectRatio: string = '1:1',
): { canvas: HTMLCanvasElement; base64: string; width: number; height: number } {
  // This is the existing generateTemplate logic, preserved for backgrounds.
  // Move the current implementation here with its aspect-ratio canvas sizing.
  const { cellW, cellH, headerH, border, fontSize } = config;
  const cols = gridConfig.cols;
  const rows = gridConfig.rows;
  const cellLabels = gridConfig.cellLabels;

  const gridW = cols * cellW + (cols + 1) * border;
  const gridH = rows * cellH + (rows + 1) * border;

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

  const canvas = document.createElement('canvas');
  canvas.width = canvasW;
  canvas.height = canvasH;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = BLACK;
  ctx.fillRect(0, 0, canvasW, canvasH);

  const offsetX = Math.floor((canvasW - gridW) / 2);
  const offsetY = Math.floor((canvasH - gridH) / 2);

  ctx.font = `bold ${fontSize}px Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const totalCells = cols * rows;
  for (let idx = 0; idx < totalCells; idx++) {
    const col = idx % cols;
    const row = Math.floor(idx / cols);
    const label = idx < cellLabels.length ? cellLabels[idx] : `Cell ${row},${col}`;

    const x0 = offsetX + border + col * (cellW + border);
    const y0 = offsetY + border + row * (cellH + border);

    ctx.fillStyle = BLACK;
    ctx.fillRect(x0, y0, cellW, headerH);
    ctx.fillStyle = WHITE;
    ctx.fillText(label, x0 + cellW / 2, y0 + headerH / 2);

    ctx.fillStyle = CHROMA_PINK;
    ctx.fillRect(x0, y0 + headerH, cellW, cellH - headerH);
  }

  const dataUrl = canvas.toDataURL('image/png');
  const base64 = dataUrl.split(',')[1];

  return { canvas, base64, width: canvasW, height: canvasH };
}
```

Also update `getCellBounds()` to accept `SquareLayout`:

```typescript
export function getCellBounds(
  cellIndex: number,
  layout: SquareLayout,
  gridConfig: GridConfig,
): { x: number; y: number; w: number; h: number } {
  const { cellSize, headerH, border, canvasW, canvasH } = layout;
  const cols = gridConfig.cols;
  const rows = gridConfig.rows;
  const cellH = cellSize + headerH;

  const gridW = cols * cellSize + (cols + 1) * border;
  const gridH = rows * cellH + (rows + 1) * border;

  const offsetX = Math.floor((canvasW - gridW) / 2);
  const offsetY = Math.floor((canvasH - gridH) / 2);

  const col = cellIndex % cols;
  const row = Math.floor(cellIndex / cols);
  const x = offsetX + border + col * (cellSize + border);
  const y = offsetY + border + row * (cellH + border) + headerH;
  return { x, y, w: cellSize, h: cellSize };
}
```

**Step 2: Run existing tests to check for breakage**

Run: `npx vitest run`
Expected: Compilation errors in files that import old TemplateConfig/CONFIG_2K/CONFIG_4K — these get fixed in Tasks 4-5.

**Step 3: Commit**

```bash
git add src/lib/templateGenerator.ts
git commit -m "refactor: templateGenerator uses SquareLayout for 1:1 cells"
```

---

### Task 4: Update generation pipeline to use `computeSquareLayout()`

**Files:**
- Modify: `src/hooks/useGenericWorkflow.ts` (lines 41-93, 297-306)
- Modify: `src/hooks/useRunWorkflow.ts` (lines 51-69)

**Step 1: Update `useGenericWorkflow.ts`**

In `PipelineParams` (line 46): remove `aspectRatio` field. In `runGeneratePipeline()`:

```typescript
// Replace lines ~67-82 with:
import { computeSquareLayout } from '../lib/computeSquareLayout';
import { generateTemplate, generateBackgroundTemplate } from '../lib/templateGenerator';

// Inside runGeneratePipeline:
const isBackground = spriteType === 'background';

let template: { canvas: HTMLCanvasElement; base64: string; width: number; height: number };
let aspectRatio: string;

if (isBackground && gridConfig.templates) {
  // Background: use legacy path with stored aspect ratio
  const templateParams = gridConfig.templates[imageSize];
  aspectRatio = gridConfig.aspectRatio || '1:1';
  template = generateBackgroundTemplate(templateParams, gridConfig, aspectRatio);
} else {
  // All other types: compute square layout, derive aspect ratio
  const layout = computeSquareLayout(gridConfig.cols, gridConfig.rows, imageSize);
  aspectRatio = layout.aspectRatio;
  template = generateTemplate(layout, gridConfig);
}
```

Pass the derived `aspectRatio` to the Gemini API call and history save (same as before, just sourced differently).

In the `generate()` function (~line 297): same pattern — compute layout for non-backgrounds, use legacy for backgrounds.

**Step 2: Update `useRunWorkflow.ts`**

Same pattern at line 56: replace `const aspectRatio = gridConfig.aspectRatio || '1:1'` with the computed layout.

**Step 3: Run tests**

Run: `npx vitest run src/hooks/__tests__/useGenericWorkflow.test.tsx`
Expected: PASS (update mock if needed to remove aspectRatio from pipeline params)

**Step 4: Commit**

```bash
git add src/hooks/useGenericWorkflow.ts src/hooks/useRunWorkflow.ts
git commit -m "feat: generation pipeline uses computeSquareLayout for non-backgrounds"
```

---

### Task 5: Update `useAddSheet.ts` and any remaining callers

**Files:**
- Modify: `src/hooks/useAddSheet.ts`
- Modify: `src/components/grid/AddSheetModal.tsx` (if it references aspect ratio)

**Step 1: Find all remaining imports of old template symbols**

Run: `grep -rn "CONFIG_2K\|CONFIG_4K\|TemplateConfig\|getTemplateParams" src/`

Fix each file to use `computeSquareLayout()` instead.

**Step 2: Run full test suite**

Run: `npx vitest run`
Expected: All PASS

**Step 3: Commit**

```bash
git add -A
git commit -m "fix: update remaining callers to use computeSquareLayout"
```

---

### Task 6: Remove aspect ratio UI for non-background types

**Files:**
- Modify: `src/components/config/UnifiedConfigPanel.tsx` (lines 439-451)
- Modify: `src/components/admin/GridPresetsTab.tsx` (lines 306-318)
- Modify: `src/context/AppContext.tsx` (line 292, 369-370)
- Modify: `src/context/__tests__/appReducer.test.ts`

**Step 1: Update `UnifiedConfigPanel.tsx`**

Wrap the aspect ratio selector in a condition:

```tsx
{/* Aspect Ratio — only for backgrounds */}
{state.spriteType === 'background' && (
  <div className="config-field">
    <label>Aspect Ratio</label>
    <select
      className="admin-select"
      value={state.aspectRatio}
      onChange={e => dispatch({ type: 'SET_ASPECT_RATIO', payload: e.target.value })}
    >
      {['1:1','2:3','3:2','3:4','4:3','4:5','5:4','9:16','16:9','21:9'].map(r =>
        <option key={r} value={r}>{r}</option>
      )}
    </select>
  </div>
)}
```

**Step 2: Update `GridPresetsTab.tsx`**

Wrap the aspect ratio dropdown similarly:

```tsx
{editing.spriteType === 'background' && (
  <label className="admin-label">
    Aspect Ratio
    <select ...>
      ...
    </select>
  </label>
)}
```

The tile shape dropdown stays visible for all types.

**Step 3: Keep `SET_ASPECT_RATIO` in reducer**

The action and state field stay (backgrounds still use them). No reducer changes needed. Update the test to clarify it's for background use.

**Step 4: Run tests and verify**

Run: `npx vitest run`
Expected: All PASS

**Step 5: Commit**

```bash
git add src/components/config/UnifiedConfigPanel.tsx src/components/admin/GridPresetsTab.tsx
git commit -m "feat: hide aspect ratio selector for non-background sprite types"
```

---

### Task 7: Update `SpriteGrid.tsx` — simplify cell aspect calculation

**Files:**
- Modify: `src/components/grid/SpriteGrid.tsx` (lines 44-61)

**Step 1: Simplify cell aspect logic**

Replace lines 44-61:

```typescript
// For non-background types, cells are always 1:1.
// For backgrounds, derive from sprite dimensions or fallback to canvas ratio.
const firstSprite = sprites[0];
let cellAspect: string;
if (firstSprite && firstSprite.height > 0) {
  cellAspect = `${firstSprite.width} / ${firstSprite.height}`;
} else {
  cellAspect = '1';
}
```

The old code that computed `cellAR = (canvasAR * rows) / cols` for non-1:1 aspect ratios is no longer needed since non-background cells are always square.

Background grids still use sprite dimensions to derive aspect (the first branch handles this correctly since extracted background sprites will have non-square dimensions).

**Step 2: Commit**

```bash
git add src/components/grid/SpriteGrid.tsx
git commit -m "refactor: simplify SpriteGrid cell aspect (cells are always 1:1 for non-backgrounds)"
```

---

### Task 8: Purge "RPG Full (Tall)" preset

**Files:**
- Modify: `server/db/seeds/characterPresets.js` (lines 2126-2185)
- Modify: `server/db/migrations.js`

**Step 1: Add migration to delete the preset and re-link its characters**

```javascript
// In MIGRATIONS array in server/db/migrations.js, add:
{
  name: '016_remove_rpg_full_tall',
  sql: `
    -- Re-link characters from RPG Full (Tall) to RPG Full
    UPDATE character_grid_links
    SET grid_preset_id = (SELECT id FROM grid_presets WHERE name = 'RPG Full' AND sprite_type = 'character' LIMIT 1)
    WHERE grid_preset_id = (SELECT id FROM grid_presets WHERE name = 'RPG Full (Tall)' AND sprite_type = 'character' LIMIT 1)
      AND (SELECT id FROM grid_presets WHERE name = 'RPG Full' AND sprite_type = 'character' LIMIT 1) IS NOT NULL;
    -- Delete the Tall preset
    DELETE FROM grid_presets WHERE name = 'RPG Full (Tall)' AND sprite_type = 'character';
  `
},
```

**Step 2: Remove from seed file**

Delete lines 2126-2185 in `server/db/seeds/characterPresets.js` (the entire "RPG Full (Tall)" block including the pickle-rick/sewer-rat/sewer-cockroach re-linking). Those characters will get linked to RPG Full via the regular seed flow.

**Step 3: Run server and verify**

Run: `node -e "const Database = require('better-sqlite3'); const db = new Database('data/grid-sprite.db'); console.log(db.prepare(\"SELECT name FROM grid_presets WHERE name LIKE '%Tall%'\").all());"`
Expected: Empty array after migration runs

**Step 4: Commit**

```bash
git add server/db/migrations.js server/db/seeds/characterPresets.js
git commit -m "feat: purge RPG Full (Tall) preset, re-link characters to RPG Full"
```

---

### Task 9: Update isometric preset seeds — clean up aspect ratios and diamond guidance

**Files:**
- Modify: `server/db/seeds/isometricGridPresets.js`
- Modify: `server/db/migrations.js`

**Step 1: Update seed file**

In `server/db/seeds/isometricGridPresets.js`:
- Change all `aspectRatio: '16:9'` to `aspectRatio: '1:1'` (the value is now ignored for non-backgrounds but should be clean)
- Update the existence check on line 2 to not filter by `aspect_ratio = '16:9'`
- Update diamond terrain `genericGuidance` for Iso Wasteland Floor and Iso Hive Floor:
  - Change "Each tile is a diamond (rhombus) shape with 2:1 width-to-height ratio" to "Each tile is a 2:1 isometric diamond (rhombus) centered within the square cell on a magenta (#FF00FF) background. The diamond's width is the full cell width, its height is half the cell width."

**Step 2: Add migration for existing DB rows**

```javascript
// In MIGRATIONS array:
{
  name: '017_clean_isometric_aspect_ratios',
  sql: "UPDATE grid_presets SET aspect_ratio = '1:1' WHERE sprite_type != 'background' AND aspect_ratio != '1:1'"
},
```

**Step 3: Commit**

```bash
git add server/db/seeds/isometricGridPresets.js server/db/migrations.js
git commit -m "fix: clean up isometric preset aspect ratios and diamond tile guidance"
```

---

### Task 10: Update server tests

**Files:**
- Modify: `server/__tests__/presets.test.js` (lines 147-210)

**Step 1: Update aspect ratio assertions**

The test at line 156 asserts `aspectRatio` is `'16:9'` for isometric presets. After migration 017, all non-background presets have `'1:1'`. Update the assertion.

The test at line 186 asserting default `'1:1'` should still pass.

**Step 2: Run server tests**

Run: `npx vitest run server/__tests__/presets.test.js` (or however server tests run)

**Step 3: Commit**

```bash
git add server/__tests__/presets.test.js
git commit -m "test: update server preset tests for 1:1 aspect ratio cleanup"
```

---

### Task 11: Full integration verification

**Step 1: Run full test suite**

Run: `npx vitest run`
Expected: All PASS

**Step 2: Run typecheck**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Run linter**

Run: `npm run lint`
Expected: No errors

**Step 4: Manual smoke test**

Start the dev server (`npm run dev`) and verify:
- Character 6x6 grid: template shows 6x6 square cells on ~1:1 canvas
- Iso Walk 8x6: template shows 8x6 square cells on a wider canvas
- Iso Attack 8x4: template shows 8x4 square cells on a wider canvas
- Building 2x3: template shows 2x3 square cells on a taller canvas
- Building 3x3: template shows 3x3 square cells on ~1:1 canvas
- Terrain 4x4: template shows 4x4 square cells on ~1:1 canvas
- Background parallax: template shows wide rectangular cells (exempt)
- Aspect ratio selector hidden for all types except background
- RPG Full (Tall) no longer appears in grid presets
- Admin panel: aspect ratio dropdown hidden for non-background presets

**Step 5: Commit any final fixes, then final commit**

```bash
git commit -m "feat: enforce 1:1 sprite tiles for all non-background types"
```
