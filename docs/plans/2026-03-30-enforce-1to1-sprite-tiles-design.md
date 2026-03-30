# Enforce 1:1 Sprite Tiles Design

**Date:** 2026-03-30
**Status:** Approved

## Problem

Individual sprite tiles can end up non-square due to:
1. Hardcoded non-square cell templates (Building 2x3, Scene 3x2, all Parallax)
2. `getTemplateParams()` fallback dividing canvas width by cols and height by rows independently
3. Aspect ratio selector stretching canvas (and cells) for all sprite types
4. Custom admin presets with any cols/rows + aspect ratio combination

Sprites extracted from these non-square cells produce non-square tiles, which is wrong for game assets.

## Decision

All non-background sprite tiles must be 1:1 squares. The header label sits above each cell, outside the square content area. Backgrounds are exempt.

## Design

### Core Layout Engine

New function `computeSquareLayout(cols, rows, resolution)` replaces all hardcoded template params and `getTemplateParams()`.

**Algorithm:**
1. Define constants per resolution: `{ base: 2048|4096, border: 2|4, headerH: 14|22, fontSize: 9|14 }`
2. For each Gemini-supported aspect ratio, compute canvas dimensions (wider dimension = base)
3. For each canvas, solve for largest square cell that fits:
   - `maxFromWidth = floor((canvasW - (cols+1) * border) / cols)`
   - `maxFromHeight = floor((canvasH - (rows+1) * border) / rows) - headerH`
   - `cellSize = min(maxFromWidth, maxFromHeight)`
4. Pick the aspect ratio that maximizes `cellSize`
5. If tied, pick tightest fit (smallest canvas area)

**Output:** `{ cellSize, headerH, border, fontSize, canvasW, canvasH, aspectRatio }`

### Template Generator

`generateTemplate()` uses `computeSquareLayout()` output. Each cell drawn as:

```
+-------------------+
|  Black + Label    |  headerH (outside the square)
+-------------------+
|                   |
|  Magenta fill     |  cellSize x cellSize (1:1)
|  (content area)   |
|                   |
+-------------------+
```

Canvas dimensions from layout computation. Grid centered on canvas. Black padding fills unused space.

Old `CONFIG_2K`/`CONFIG_4K` constants, `TemplateConfig` interface removed.

### Data & Preset Changes

**Purge:**
- "RPG Full (Tall)" (id: 2) — 6x6 with 2:3 aspect ratio. Redundant with RPG Full once cells are 1:1.

**Fix:**
- Isometric presets: stored `aspect_ratio` changed from `'16:9'` to `'1:1'` in seeds (ignored for non-backgrounds, but cleaned up for clarity)
- Diamond terrain guidance updated: "draw a 2:1 isometric diamond centered within the square cell on magenta background"

**Schema:**
- `aspect_ratio` column kept (backgrounds use it), ignored for non-background code paths
- `tile_shape` column kept as prompt hint, not a cell dimension modifier

**Hardcoded grids (`gridConfig.ts`):**
- `CHARACTER_GRID`, `BUILDING_GRIDS`, `TERRAIN_GRIDS`: `templates` property removed. Pure layout descriptors.
- `BACKGROUND_GRIDS`: unchanged, keeps non-square templates.
- `getTemplateParams()` removed.

### UI Changes

- Aspect ratio selector removed for character/building/terrain in `UnifiedConfigPanel.tsx`
- Aspect ratio dropdown removed for non-background presets in `GridPresetsTab.tsx`
- Background keeps aspect ratio selector as-is

### Pipeline & API

- Generation pipeline calls `computeSquareLayout()` before `generateTemplate()`, passes derived `aspectRatio` to Gemini API
- Backgrounds continue using stored/selected aspect ratio
- Server validation (`ALLOWED_ASPECT_RATIOS`) unchanged
- History records the derived aspect ratio
- Sprite extraction unchanged (cut detection works on whatever comes back)
- `SpriteGrid.tsx` naturally resolves to 1:1 for non-background sprites

## Code Removed

- `TemplateConfig` interface, `CONFIG_2K`, `CONFIG_4K` in `templateGenerator.ts`
- `templates` on `CHARACTER_GRID`, `BUILDING_GRIDS`, `TERRAIN_GRIDS`
- `getTemplateParams()` in `gridConfig.ts`
- Aspect ratio UI for non-background types
- "RPG Full (Tall)" preset

## Code Kept

- `aspect_ratio` DB column (backgrounds)
- `BACKGROUND_GRIDS` with non-square templates
- `ALLOWED_ASPECT_RATIOS` server validation
- Aspect ratio in generation history
- `tile_shape` column and diamond concept
