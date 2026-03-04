# Terrain & Background Generation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use h-superpowers:subagent-driven-development, h-superpowers:team-driven-development, or h-superpowers:executing-plans to implement this plan (ask user which approach).

**Goal:** Add terrain and background sprite generation as two new sprite types, mirroring the building pattern.

**Architecture:** Each type gets its own grid configs, prompt builder, workflow hook, config panel, and DB preset table. Shared infrastructure (template generation, sprite extraction, Gemini API) requires no changes. The sprite type union expands from 2 to 4 values, and App.tsx routes to the correct config panel via a map.

**Tech Stack:** React + TypeScript frontend, Express + better-sqlite3 backend, Gemini image generation API, HTML5 Canvas for templates/extraction.

---

## Task 1: Grid Configurations

Add terrain and background grid definitions to the existing gridConfig.ts.

**Files:**
- Modify: `src/lib/gridConfig.ts`

**Step 1: Add terrain grid definitions**

Add after the `BUILDING_GRIDS` export (after line 90):

```typescript
// ── Terrain grids ──────────────────────────────────────────────────────────

/**
 * Terrain grid definitions — square cells for tileable ground tiles.
 * Cell labels populated at runtime from user state.
 *
 * Cell size math (fills full 2048/4096 canvas):
 *   3x3: 680×680 (2K), 1360×1360 (4K) — same as building 3x3
 *   4x4: 509×509 (2K), 1018×1018 (4K)
 *   5x5: 406×406 (2K), 812×812 (4K)
 */
export const TERRAIN_GRIDS: Record<string, GridConfig> = {
  '3x3': {
    id: 'terrain-3x3',
    label: 'Terrain 3\u00d73',
    cols: 3, rows: 3, totalCells: 9, cellLabels: [],
    templates: {
      '2K': { cellW: 680, cellH: 680, headerH: 22, border: 2, fontSize: 14 },
      '4K': { cellW: 1360, cellH: 1360, headerH: 36, border: 4, fontSize: 22 },
    },
  },
  '4x4': {
    id: 'terrain-4x4',
    label: 'Terrain 4\u00d74',
    cols: 4, rows: 4, totalCells: 16, cellLabels: [],
    templates: {
      '2K': { cellW: 509, cellH: 509, headerH: 18, border: 2, fontSize: 11 },
      '4K': { cellW: 1018, cellH: 1018, headerH: 30, border: 4, fontSize: 18 },
    },
  },
  '5x5': {
    id: 'terrain-5x5',
    label: 'Terrain 5\u00d75',
    cols: 5, rows: 5, totalCells: 25, cellLabels: [],
    templates: {
      '2K': { cellW: 406, cellH: 406, headerH: 16, border: 2, fontSize: 10 },
      '4K': { cellW: 812, cellH: 812, headerH: 26, border: 4, fontSize: 16 },
    },
  },
};

export type TerrainGridSize = '3x3' | '4x4' | '5x5';
```

**Step 2: Add background grid definitions**

Add after terrain grids:

```typescript
// ── Background grids ───────────────────────────────────────────────────────

/**
 * Background grid definitions.
 *
 * Parallax mode: 1-column wide rectangular cells stacked vertically.
 *   1x3: 3 layers, 1x4: 4 layers, 1x5: 5 layers
 *   Cells are ~3:1 wide (full canvas width, height divided by rows).
 *
 * Scene mode: square/slightly-wide cells for full scene variants.
 *   2x2: 4 scenes, 3x2: 6 scenes, 3x3: 9 scenes
 */
export const BACKGROUND_GRIDS: Record<string, GridConfig> = {
  // Parallax layers — wide horizontal strips
  '1x3': {
    id: 'bg-parallax-1x3',
    label: 'Parallax 1\u00d73',
    cols: 1, rows: 3, totalCells: 3, cellLabels: [],
    templates: {
      '2K': { cellW: 2044, cellH: 680, headerH: 22, border: 2, fontSize: 14 },
      '4K': { cellW: 4088, cellH: 1360, headerH: 36, border: 4, fontSize: 22 },
    },
  },
  '1x4': {
    id: 'bg-parallax-1x4',
    label: 'Parallax 1\u00d74',
    cols: 1, rows: 4, totalCells: 4, cellLabels: [],
    templates: {
      '2K': { cellW: 2044, cellH: 509, headerH: 18, border: 2, fontSize: 11 },
      '4K': { cellW: 4088, cellH: 1018, headerH: 30, border: 4, fontSize: 18 },
    },
  },
  '1x5': {
    id: 'bg-parallax-1x5',
    label: 'Parallax 1\u00d75',
    cols: 1, rows: 5, totalCells: 5, cellLabels: [],
    templates: {
      '2K': { cellW: 2044, cellH: 406, headerH: 16, border: 2, fontSize: 10 },
      '4K': { cellW: 4088, cellH: 812, headerH: 26, border: 4, fontSize: 16 },
    },
  },
  // Scene variations — square cells
  '2x2': {
    id: 'bg-scene-2x2',
    label: 'Scene 2\u00d72',
    cols: 2, rows: 2, totalCells: 4, cellLabels: [],
    templates: {
      '2K': { cellW: 1021, cellH: 1021, headerH: 28, border: 2, fontSize: 18 },
      '4K': { cellW: 2042, cellH: 2042, headerH: 44, border: 4, fontSize: 28 },
    },
  },
  '3x2': {
    id: 'bg-scene-3x2',
    label: 'Scene 3\u00d72',
    cols: 3, rows: 2, totalCells: 6, cellLabels: [],
    templates: {
      '2K': { cellW: 680, cellH: 1021, headerH: 22, border: 2, fontSize: 14 },
      '4K': { cellW: 1360, cellH: 2042, headerH: 36, border: 4, fontSize: 22 },
    },
  },
  '3x3-scene': {
    id: 'bg-scene-3x3',
    label: 'Scene 3\u00d73',
    cols: 3, rows: 3, totalCells: 9, cellLabels: [],
    templates: {
      '2K': { cellW: 680, cellH: 680, headerH: 22, border: 2, fontSize: 14 },
      '4K': { cellW: 1360, cellH: 1360, headerH: 36, border: 4, fontSize: 22 },
    },
  },
};

export type BackgroundGridSize = '1x3' | '1x4' | '1x5' | '2x2' | '3x2' | '3x3-scene';
export type BackgroundMode = 'parallax' | 'scene';
```

**Step 3: Add helper functions**

```typescript
export function getTerrainGridConfig(
  gridSize: TerrainGridSize,
  cellLabels: string[],
): GridConfig {
  const base = TERRAIN_GRIDS[gridSize];
  return { ...base, cellLabels: cellLabels.slice(0, base.totalCells) };
}

export function getBackgroundGridConfig(
  gridSize: BackgroundGridSize,
  cellLabels: string[],
): GridConfig {
  const base = BACKGROUND_GRIDS[gridSize];
  return { ...base, cellLabels: cellLabels.slice(0, base.totalCells) };
}
```

**Step 4: Commit**

```bash
git add src/lib/gridConfig.ts
git commit -m "feat: add terrain and background grid configurations"
```

---

## Task 2: AppContext — Types, State, and Actions

Expand the sprite type system to support terrain and background.

**Files:**
- Modify: `src/context/AppContext.tsx`

**Step 1: Add type definitions**

After `BuildingPreset` interface (line 34), add:

```typescript
export interface TerrainPreset {
  id: string;
  name: string;
  genre: string;
  gridSize: TerrainGridSize;
  description: string;
  colorNotes: string;
  tileLabels: string[];
  tileGuidance: string;
}

export interface BackgroundPreset {
  id: string;
  name: string;
  genre: string;
  gridSize: BackgroundGridSize;
  bgMode: BackgroundMode;
  description: string;
  colorNotes: string;
  layerLabels: string[];
  layerGuidance: string;
}
```

**Step 2: Update SpriteType and imports**

Change line 11:
```typescript
export type SpriteType = 'character' | 'building' | 'terrain' | 'background';
```

Add imports from gridConfig:
```typescript
import type { TerrainGridSize, BackgroundGridSize, BackgroundMode } from '../lib/gridConfig';
```

**Step 3: Add terrain and background state to AppState**

After `building` object in AppState (line 64), add:

```typescript
  terrain: {
    name: string;
    description: string;
    colorNotes: string;
    styleNotes: string;
    tileGuidance: string;
    gridSize: TerrainGridSize;
    cellLabels: string[];
  };

  background: {
    name: string;
    description: string;
    colorNotes: string;
    styleNotes: string;
    layerGuidance: string;
    bgMode: BackgroundMode;
    gridSize: BackgroundGridSize;
    cellLabels: string[];
  };
```

Add preset arrays after `buildingPresets` (line 94):
```typescript
  terrainPresets: TerrainPreset[];
  backgroundPresets: BackgroundPreset[];
```

**Step 4: Update initialState**

Add after the `building` initial values:
```typescript
  terrain: {
    name: '',
    description: '',
    colorNotes: '',
    styleNotes: '',
    tileGuidance: '',
    gridSize: '4x4' as TerrainGridSize,
    cellLabels: Array(16).fill(''),
  },
  background: {
    name: '',
    description: '',
    colorNotes: '',
    styleNotes: '',
    layerGuidance: '',
    bgMode: 'parallax' as BackgroundMode,
    gridSize: '1x4' as BackgroundGridSize,
    cellLabels: Array(4).fill(''),
  },
```

And:
```typescript
  terrainPresets: [],
  backgroundPresets: [],
```

**Step 5: Add Action types**

Add to the Action union:
```typescript
  | { type: 'SET_TERRAIN'; terrain: AppState['terrain'] }
  | { type: 'SET_BACKGROUND'; background: AppState['background'] }
  | { type: 'SET_TERRAIN_PRESETS'; presets: TerrainPreset[] }
  | { type: 'LOAD_TERRAIN_PRESET'; preset: TerrainPreset }
  | { type: 'SET_BACKGROUND_PRESETS'; presets: BackgroundPreset[] }
  | { type: 'LOAD_BACKGROUND_PRESET'; preset: BackgroundPreset }
```

**Step 6: Add reducer cases**

Add to the reducer switch:
```typescript
    case 'SET_TERRAIN':
      return { ...state, terrain: action.terrain };
    case 'SET_BACKGROUND':
      return { ...state, background: action.background };
    case 'SET_TERRAIN_PRESETS':
      return { ...state, terrainPresets: action.presets };
    case 'LOAD_TERRAIN_PRESET': {
      const tGrid = TERRAIN_GRIDS[action.preset.gridSize];
      const tLabels = action.preset.tileLabels.slice(0, tGrid?.totalCells ?? 16);
      while (tLabels.length < (tGrid?.totalCells ?? 16)) tLabels.push('');
      return {
        ...state,
        terrain: {
          name: action.preset.name,
          description: action.preset.description,
          colorNotes: action.preset.colorNotes,
          styleNotes: '',
          tileGuidance: action.preset.tileGuidance,
          gridSize: action.preset.gridSize,
          cellLabels: tLabels,
        },
      };
    }
    case 'SET_BACKGROUND_PRESETS':
      return { ...state, backgroundPresets: action.presets };
    case 'LOAD_BACKGROUND_PRESET': {
      const bGrid = BACKGROUND_GRIDS[action.preset.gridSize];
      const bLabels = action.preset.layerLabels.slice(0, bGrid?.totalCells ?? 4);
      while (bLabels.length < (bGrid?.totalCells ?? 4)) bLabels.push('');
      return {
        ...state,
        background: {
          name: action.preset.name,
          description: action.preset.description,
          colorNotes: action.preset.colorNotes,
          styleNotes: '',
          layerGuidance: action.preset.layerGuidance,
          bgMode: action.preset.bgMode,
          gridSize: action.preset.gridSize,
          cellLabels: bLabels,
        },
      };
    }
```

Update the RESET case to preserve new presets:
```typescript
    case 'RESET':
      return {
        ...initialState,
        presets: state.presets,
        buildingPresets: state.buildingPresets,
        terrainPresets: state.terrainPresets,
        backgroundPresets: state.backgroundPresets,
      };
```

Add imports for TERRAIN_GRIDS and BACKGROUND_GRIDS at the top.

**Step 7: Commit**

```bash
git add src/context/AppContext.tsx
git commit -m "feat: add terrain and background types to AppContext"
```

---

## Task 3: Terrain Prompt Builder

**Files:**
- Create: `src/lib/terrainPromptBuilder.ts`

**Step 1: Write the prompt builder**

```typescript
/**
 * Build the grid-fill prompt for Gemini — terrain tile variant.
 * Combines template structure instructions with terrain-specific guidance
 * for tileable ground tiles and transition pieces.
 */

import type { GridConfig } from './gridConfig';

export interface TerrainConfig {
  name: string;
  description: string;
  colorNotes: string;
  styleNotes: string;
  tileGuidance: string;
}

export function buildTerrainPrompt(
  terrain: TerrainConfig,
  grid: GridConfig,
): string {
  const descBlock = [
    `Fill every pink cell area with an SNES-era 16-bit pixel-art terrain tile for a`,
    `${terrain.name.toUpperCase()} tileset.`,
    ``,
    `Terrain description: ${terrain.description}`,
    terrain.colorNotes ? `Color palette: ${terrain.colorNotes}` : '',
    terrain.styleNotes ? `Additional style notes: ${terrain.styleNotes}` : '',
    ``,
    `  \u2022 Style reference: Final Fantasy VI / Chrono Trigger overworld tilesets`,
    `  \u2022 Consistent palette, texture density, and perspective across ALL ${grid.totalCells} tiles`,
    `  \u2022 Each cell is one distinct tile variant — base tiles, edges, corners, or transitions as labeled`,
  ].filter(Boolean).join('\n');

  const cellDescriptions: string[] = [];
  for (let idx = 0; idx < grid.totalCells; idx++) {
    const row = Math.floor(idx / grid.cols);
    const col = idx % grid.cols;
    const label = idx < grid.cellLabels.length ? grid.cellLabels[idx] : `Tile ${row},${col}`;
    cellDescriptions.push(`  Header "${label}" (${row},${col}): Fill with the terrain tile matching this label.`);
  }

  const customGuidance = terrain.tileGuidance.trim()
    ? `\nTERRAIN-SPECIFIC TILE NOTES (use these to refine each tile):\n${terrain.tileGuidance.trim()}\n`
    : '';

  return `\
You are filling in a sprite sheet template. The attached image is a ${grid.cols}\u00d7${grid.rows} grid
(${grid.totalCells} cells) on a bright magenta (#FF00FF) chroma-key background. Each cell has
a thin black header strip with white text labeling the tile variant. You MUST preserve
every header strip and its text exactly as-is \u2014 do not erase, move, or redraw them.

${descBlock}

CHROMA BACKGROUND IS SACRED: The magenta #FF00FF background behind each tile
MUST remain pure, unmodified magenta (#FF00FF) at all times. This is a chroma-key
background used for transparency \u2014 it is NOT part of the terrain. Do NOT tint, shade,
darken, or blend the magenta background under any circumstances.
Do NOT draw outside the cell boundaries or over the black grid lines.

TILEABILITY IS CRITICAL: Each terrain tile must be designed so that its edges
align seamlessly with adjacent tiles of the same type. Colors, textures, and
patterns at the edges should blend naturally when tiles are placed next to each
other in a tilemap. Base tiles should tile seamlessly with themselves.
Edge and corner tiles should transition cleanly between the two terrain types
indicated by their label.

FILL THE CELL: Unlike character or building sprites that float on the chroma
background, terrain tiles should FILL the entire cell content area edge-to-edge
(below the header strip). There should be NO magenta background visible in
terrain tile cells \u2014 the tile IS the ground.

CONSISTENCY: All tiles must share the same art style, color palette, texture
density, and viewing perspective. They are parts of one unified tileset.

CELL LAYOUT (${grid.cols}\u00d7${grid.rows} grid, 0-indexed):

${cellDescriptions.join('\n')}
${customGuidance}
Return the completed sprite sheet as a single image. Preserve ALL header text exactly.`;
}
```

**Step 2: Commit**

```bash
git add src/lib/terrainPromptBuilder.ts
git commit -m "feat: add terrain prompt builder"
```

---

## Task 4: Background Prompt Builder

**Files:**
- Create: `src/lib/backgroundPromptBuilder.ts`

**Step 1: Write the prompt builder**

```typescript
/**
 * Build the grid-fill prompt for Gemini — background variant.
 * Supports two modes: parallax layers (wide horizontal strips)
 * and scene variations (full scenes with lighting/weather changes).
 */

import type { GridConfig } from './gridConfig';
import type { BackgroundMode } from './gridConfig';

export interface BackgroundConfig {
  name: string;
  description: string;
  colorNotes: string;
  styleNotes: string;
  layerGuidance: string;
  bgMode: BackgroundMode;
}

export function buildBackgroundPrompt(
  bg: BackgroundConfig,
  grid: GridConfig,
): string {
  const descBlock = [
    `Fill every pink cell area with an SNES-era 16-bit pixel-art background`,
    bg.bgMode === 'parallax'
      ? `layer for a ${bg.name.toUpperCase()} parallax scrolling background.`
      : `scene variant of ${bg.name.toUpperCase()}.`,
    ``,
    `Background description: ${bg.description}`,
    bg.colorNotes ? `Color palette: ${bg.colorNotes}` : '',
    bg.styleNotes ? `Additional style notes: ${bg.styleNotes}` : '',
    ``,
    `  \u2022 Style reference: Final Fantasy VI / Chrono Trigger background art`,
    `  \u2022 Consistent palette and art style across ALL ${grid.totalCells} cells`,
  ].filter(Boolean).join('\n');

  const cellDescriptions: string[] = [];
  for (let idx = 0; idx < grid.totalCells; idx++) {
    const row = Math.floor(idx / grid.cols);
    const col = idx % grid.cols;
    const label = idx < grid.cellLabels.length ? grid.cellLabels[idx] : `Cell ${row},${col}`;
    cellDescriptions.push(`  Header "${label}" (${row},${col}): Fill with the background ${bg.bgMode === 'parallax' ? 'layer' : 'scene'} matching this label.`);
  }

  const customGuidance = bg.layerGuidance.trim()
    ? `\nBACKGROUND-SPECIFIC NOTES (use these to refine each ${bg.bgMode === 'parallax' ? 'layer' : 'scene'}):\n${bg.layerGuidance.trim()}\n`
    : '';

  const modeGuidance = bg.bgMode === 'parallax'
    ? `PARALLAX LAYER DESIGN: Each cell is one horizontal layer of a parallax
scrolling background. Layers are ordered top-to-bottom from farthest (sky)
to nearest (ground). Design rules:
  \u2022 Each layer must tile HORIZONTALLY \u2014 the left and right edges should connect seamlessly
  \u2022 Far layers (sky, distant features): simpler detail, lighter/hazier colors, atmospheric perspective
  \u2022 Near layers (foreground, ground): more detail, stronger colors, larger elements
  \u2022 Each layer should have transparent areas (magenta background) where layers below show through
  \u2022 The topmost layer (sky) should fill the entire cell with no magenta visible
  \u2022 Lower layers should have magenta at the top where the sky shows through

FILL HORIZONTALLY: Each layer should span the full width of the cell.
The layer content fills from the bottom up, with magenta background above
where the sky or farther layers would show through.`
    : `SCENE VARIATION DESIGN: Each cell is a complete standalone background scene.
All scenes depict the SAME location \u2014 only the conditions change (time of day,
weather, season, mood). Design rules:
  \u2022 Same composition, layout, and structural elements across all scenes
  \u2022 Horizon line, major landmarks, and proportions must be identical
  \u2022 Only lighting, color temperature, weather effects, and atmospheric conditions change
  \u2022 Each scene should fill the ENTIRE cell \u2014 no magenta background should be visible
  \u2022 Maintain consistent art style and level of detail across all variants

FILL THE CELL: Scene backgrounds should fill the entire cell content area
edge-to-edge (below the header strip). There should be NO magenta background
visible \u2014 the scene IS the background.`;

  return `\
You are filling in a sprite sheet template. The attached image is a ${grid.cols}\u00d7${grid.rows} grid
(${grid.totalCells} cells) on a bright magenta (#FF00FF) chroma-key background. Each cell has
a thin black header strip with white text labeling the ${bg.bgMode === 'parallax' ? 'layer' : 'scene'}. You MUST preserve
every header strip and its text exactly as-is \u2014 do not erase, move, or redraw them.

${descBlock}

CHROMA BACKGROUND IS SACRED: The magenta #FF00FF background areas
MUST remain pure, unmodified magenta (#FF00FF). This is a chroma-key
background used for transparency \u2014 it is NOT part of the scene. Do NOT tint, shade,
darken, or blend the magenta background under any circumstances, even if the cell
depicts nighttime, darkness, fog, or other atmospheric conditions.
Do NOT draw outside the cell boundaries or over the black grid lines.

${modeGuidance}

CONSISTENCY: All ${bg.bgMode === 'parallax' ? 'layers' : 'scenes'} must share the same art style and color palette.
They are parts of one unified background ${bg.bgMode === 'parallax' ? 'system' : 'set'}.

CELL LAYOUT (${grid.cols}\u00d7${grid.rows} grid, 0-indexed):

${cellDescriptions.join('\n')}
${customGuidance}
Return the completed sprite sheet as a single image. Preserve ALL header text exactly.`;
}
```

**Step 2: Commit**

```bash
git add src/lib/backgroundPromptBuilder.ts
git commit -m "feat: add background prompt builder with parallax and scene modes"
```

---

## Task 5: Workflow Hooks

Create useTerrainWorkflow and useBackgroundWorkflow, mirroring useBuildingWorkflow.

**Files:**
- Create: `src/hooks/useTerrainWorkflow.ts`
- Create: `src/hooks/useBackgroundWorkflow.ts`

**Step 1: Write useTerrainWorkflow.ts**

Copy the pattern from `src/hooks/useBuildingWorkflow.ts` but change:
- Import `buildTerrainPrompt` from `../lib/terrainPromptBuilder`
- Import `getTerrainGridConfig` from `../lib/gridConfig`
- Use `state.terrain` instead of `state.building`
- Validate `state.terrain.name` and `state.terrain.description`
- Call `getTerrainGridConfig(state.terrain.gridSize, state.terrain.cellLabels)`
- Call `buildTerrainPrompt(state.terrain, gridConfig)`
- Set `spriteType: 'terrain'` and `gridSize: state.terrain.gridSize` in history POST
- Dependencies: `[state.terrain, state.model, state.imageSize, dispatch]`

**Step 2: Write useBackgroundWorkflow.ts**

Same pattern but:
- Import `buildBackgroundPrompt` from `../lib/backgroundPromptBuilder`
- Import `getBackgroundGridConfig` from `../lib/gridConfig`
- Use `state.background` instead of `state.building`
- Validate `state.background.name` and `state.background.description`
- Call `getBackgroundGridConfig(state.background.gridSize, state.background.cellLabels)`
- Call `buildBackgroundPrompt(state.background, gridConfig)`
- Set `spriteType: 'background'` and `gridSize: state.background.gridSize` in history POST
- Dependencies: `[state.background, state.model, state.imageSize, dispatch]`

**Step 3: Commit**

```bash
git add src/hooks/useTerrainWorkflow.ts src/hooks/useBackgroundWorkflow.ts
git commit -m "feat: add terrain and background workflow hooks"
```

---

## Task 6: Config Panels

Create TerrainConfigPanel and BackgroundConfigPanel, mirroring BuildingConfigPanel.

**Files:**
- Create: `src/components/config/TerrainConfigPanel.tsx`
- Create: `src/components/config/BackgroundConfigPanel.tsx`

**Step 1: Write TerrainConfigPanel.tsx**

Mirror `BuildingConfigPanel.tsx` with these differences:
- Import `useTerrainWorkflow` instead of `useBuildingWorkflow`
- Import `TerrainPreset, TerrainGridSize` from AppContext
- Import `getTerrainGridConfig, TERRAIN_GRIDS` from gridConfig
- Import `buildTerrainPrompt` from terrainPromptBuilder
- Grid size options: `['3x3', '4x4', '5x5']` with cells `[9, 16, 25]`
- State: `state.terrain` instead of `state.building`
- Dispatch: `SET_TERRAIN` instead of `SET_BUILDING`
- Presets: `state.terrainPresets`, `SET_TERRAIN_PRESETS`, `LOAD_TERRAIN_PRESET`
- Fetch presets: `/api/presets?type=terrain`
- Field labels: "Terrain Name", "Terrain Description" (no "Structural Details" field)
- Cell labels section label: "Tile Labels"
- Cell guidance label: "Tile Guidance"
- Sprite type toggle: 4 buttons (Character, Building, Terrain, Background)
- Section heading: "Terrain Setup"

**Step 2: Write BackgroundConfigPanel.tsx**

Mirror `BuildingConfigPanel.tsx` with these differences:
- Import `useBackgroundWorkflow`
- Import `BackgroundPreset, BackgroundGridSize, BackgroundMode` from AppContext
- Import `getBackgroundGridConfig, BACKGROUND_GRIDS` from gridConfig
- Import `buildBackgroundPrompt` from backgroundPromptBuilder
- **Mode selector**: segmented control for Parallax / Scene before grid size
- Grid size options change based on mode:
  - Parallax: `['1x3', '1x4', '1x5']` with cells `[3, 4, 5]`
  - Scene: `['2x2', '3x2', '3x3-scene']` with cells `[4, 6, 9]`
- When mode changes, reset gridSize to first option of that mode and resize cellLabels
- State: `state.background`
- Dispatch: `SET_BACKGROUND`
- Presets: `state.backgroundPresets`, `SET_BACKGROUND_PRESETS`, `LOAD_BACKGROUND_PRESET`
- Fetch presets: `/api/presets?type=background`
- Field labels: "Background Name", "Background Description" (no "Structural Details")
- Cell labels section label: "Layer Labels" (parallax) or "Scene Labels" (scene)
- Cell guidance label: "Layer Guidance" / "Scene Guidance"
- Sprite type toggle: 4 buttons
- Section heading: "Background Setup"

**Step 3: Commit**

```bash
git add src/components/config/TerrainConfigPanel.tsx src/components/config/BackgroundConfigPanel.tsx
git commit -m "feat: add terrain and background config panels"
```

---

## Task 7: Update App.tsx and Shared Components

Wire the new sprite types into the app routing and shared UI components.

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/shared/GeneratingOverlay.tsx`
- Modify: `src/components/layout/AppHeader.tsx`

**Step 1: Update App.tsx imports and config panel routing**

Add imports:
```typescript
import { TerrainConfigPanel } from './components/config/TerrainConfigPanel';
import { BackgroundConfigPanel } from './components/config/BackgroundConfigPanel';
import { getTerrainGridConfig, getBackgroundGridConfig, type TerrainGridSize, type BackgroundGridSize } from './lib/gridConfig';
```

Replace the ternary at line 128:
```typescript
{state.step === 'configure' && (() => {
  switch (state.spriteType) {
    case 'building': return <BuildingConfigPanel />;
    case 'terrain': return <TerrainConfigPanel />;
    case 'background': return <BackgroundConfigPanel />;
    default: return <ConfigPanel />;
  }
})()}
```

**Step 2: Update session restoration in App.tsx**

In the `useEffect` restoration block, add handling for terrain and background after the building block (around line 65):

```typescript
        if (spriteType === 'terrain' && data.gridSize) {
          const spriteLabels = data.sprites?.map((s: any) => s.label) || [];
          dispatch({
            type: 'SET_TERRAIN',
            terrain: {
              name: data.character?.name || '',
              description: data.character?.description || '',
              colorNotes: '',
              styleNotes: '',
              tileGuidance: '',
              gridSize: data.gridSize,
              cellLabels: spriteLabels,
            },
          });
        } else if (spriteType === 'background' && data.gridSize) {
          const spriteLabels = data.sprites?.map((s: any) => s.label) || [];
          dispatch({
            type: 'SET_BACKGROUND',
            background: {
              name: data.character?.name || '',
              description: data.character?.description || '',
              colorNotes: '',
              styleNotes: '',
              layerGuidance: '',
              bgMode: data.gridSize.startsWith('1x') ? 'parallax' : 'scene',
              gridSize: data.gridSize,
              cellLabels: spriteLabels,
            },
          });
        }
```

Update the extraction config block to handle terrain and background:

```typescript
          if (spriteType === 'terrain' && data.gridSize) {
            const spriteLabels = data.sprites?.map((s: any) => s.label) || [];
            const gridConfig = getTerrainGridConfig(data.gridSize as TerrainGridSize, spriteLabels);
            const templateParams = gridConfig.templates['2K'];
            extractionConfig = {
              headerH: templateParams.headerH,
              border: templateParams.border,
              templateCellW: templateParams.cellW,
              templateCellH: templateParams.cellH,
              gridOverride: {
                cols: gridConfig.cols, rows: gridConfig.rows,
                totalCells: gridConfig.totalCells, cellLabels: gridConfig.cellLabels,
              },
            };
          } else if (spriteType === 'background' && data.gridSize) {
            const spriteLabels = data.sprites?.map((s: any) => s.label) || [];
            const gridConfig = getBackgroundGridConfig(data.gridSize as BackgroundGridSize, spriteLabels);
            const templateParams = gridConfig.templates['2K'];
            extractionConfig = {
              headerH: templateParams.headerH,
              border: templateParams.border,
              templateCellW: templateParams.cellW,
              templateCellH: templateParams.cellH,
              gridOverride: {
                cols: gridConfig.cols, rows: gridConfig.rows,
                totalCells: gridConfig.totalCells, cellLabels: gridConfig.cellLabels,
              },
            };
          }
```

**Step 3: Update GeneratingOverlay.tsx**

Change the cellCount computation to handle all sprite types:

```typescript
import { BUILDING_GRIDS, TERRAIN_GRIDS, BACKGROUND_GRIDS } from '../../lib/gridConfig';

// ...

  let cellCount = 36;
  if (state.spriteType === 'building') {
    cellCount = BUILDING_GRIDS[state.building.gridSize]?.totalCells ?? 9;
  } else if (state.spriteType === 'terrain') {
    cellCount = TERRAIN_GRIDS[state.terrain.gridSize]?.totalCells ?? 16;
  } else if (state.spriteType === 'background') {
    cellCount = BACKGROUND_GRIDS[state.background.gridSize]?.totalCells ?? 4;
  }
```

**Step 4: Update GalleryPage.tsx**

In `handleLoad`, add terrain and background branches after the building block:

```typescript
        if (spriteType === 'terrain' && data.gridSize) {
          const spriteLabels = data.sprites?.map((s: any) => s.label) || [];
          dispatch({
            type: 'SET_TERRAIN',
            terrain: {
              name: data.character?.name || '',
              description: data.character?.description || '',
              colorNotes: '', styleNotes: '', tileGuidance: '',
              gridSize: data.gridSize,
              cellLabels: spriteLabels,
            },
          });
        } else if (spriteType === 'background' && data.gridSize) {
          const spriteLabels = data.sprites?.map((s: any) => s.label) || [];
          dispatch({
            type: 'SET_BACKGROUND',
            background: {
              name: data.character?.name || '',
              description: data.character?.description || '',
              colorNotes: '', styleNotes: '', layerGuidance: '',
              bgMode: data.gridSize.startsWith('1x') ? 'parallax' : 'scene',
              gridSize: data.gridSize,
              cellLabels: spriteLabels,
            },
          });
        }
```

And in the extraction config block, add the same terrain/background grid config logic (import `getTerrainGridConfig`, `getBackgroundGridConfig`, `TerrainGridSize`, `BackgroundGridSize`).

**Step 5: Commit**

```bash
git add src/App.tsx src/components/shared/GeneratingOverlay.tsx src/components/gallery/GalleryPage.tsx
git commit -m "feat: wire terrain and background into app routing and shared components"
```

---

## Task 8: Database — Preset Tables and Seed Data

**Files:**
- Modify: `server/db.js`

**Step 1: Add terrain_presets and background_presets tables**

In `createSchema()`, after the building_presets CREATE TABLE, add:

```sql
    CREATE TABLE IF NOT EXISTS terrain_presets (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      genre TEXT NOT NULL DEFAULT '',
      grid_size TEXT NOT NULL DEFAULT '4x4',
      description TEXT NOT NULL DEFAULT '',
      color_notes TEXT NOT NULL DEFAULT '',
      tile_labels TEXT NOT NULL DEFAULT '[]',
      tile_guidance TEXT NOT NULL DEFAULT '',
      is_preset INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS background_presets (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      genre TEXT NOT NULL DEFAULT '',
      grid_size TEXT NOT NULL DEFAULT '1x4',
      bg_mode TEXT NOT NULL DEFAULT 'parallax',
      description TEXT NOT NULL DEFAULT '',
      color_notes TEXT NOT NULL DEFAULT '',
      layer_labels TEXT NOT NULL DEFAULT '[]',
      layer_guidance TEXT NOT NULL DEFAULT '',
      is_preset INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
```

**Step 2: Add seedTerrainPresets() function**

6 presets:
1. Grassland Plains (4x4, Nature) — base grass, dirt path, edges, corners
2. Dungeon Stone (3x3, Dungeon) — stone floor, cracked, mossy, wall base
3. Desert Dunes (4x4, Desert) — sand, rock, oasis edges
4. Snow Tundra (3x3, Arctic) — snow, ice, frozen ground
5. Volcanic Rock (4x4, Elemental) — lava, obsidian, ash, lava edges
6. Forest Floor (5x5, Nature) — moss, roots, clearings, path transitions

Each with appropriate tile_labels JSON array and tile_guidance text.

**Step 3: Add seedBackgroundPresets() function**

6 presets:
1. Enchanted Forest (parallax 1x4, Fantasy) — sky, canopy, mid trees, ground
2. Mountain Range (parallax 1x5, Nature) — sky, far peaks, near mountains, hills, ground
3. Haunted Graveyard (scene 3x2, Horror) — day/dusk/night/fog/rain/storm
4. Ocean Sunset (parallax 1x3, Nature) — sky, horizon, water
5. Cyberpunk City (scene 2x2, Sci-Fi) — day/night/rain/neon
6. Underwater Reef (parallax 1x4, Fantasy) — surface light, mid water, coral, seafloor

**Step 4: Call new seed functions from getDb()**

Add to `getDb()`:
```javascript
  seedTerrainPresets(db);
  seedBackgroundPresets(db);
```

**Step 5: Commit**

```bash
git add server/db.js
git commit -m "feat: add terrain and background preset tables with seed data"
```

---

## Task 9: Server API — Preset Endpoints

**Files:**
- Modify: `server/index.js`

**Step 1: Update the presets GET endpoint**

The existing `/api/presets` endpoint should already handle `?type=terrain` and `?type=background` if it uses a table name lookup pattern. Check current implementation. If it uses a switch/if on the type parameter, add cases for 'terrain' (query `terrain_presets`) and 'background' (query `background_presets`).

The response format for terrain presets:
```json
{
  "id": "...", "name": "...", "genre": "...",
  "gridSize": "4x4", "description": "...",
  "colorNotes": "...", "tileLabels": [...], "tileGuidance": "..."
}
```

For background presets:
```json
{
  "id": "...", "name": "...", "genre": "...",
  "gridSize": "1x4", "bgMode": "parallax", "description": "...",
  "colorNotes": "...", "layerLabels": [...], "layerGuidance": "..."
}
```

Map snake_case DB columns to camelCase in the response, and JSON.parse the labels arrays.

**Step 2: Commit**

```bash
git add server/index.js
git commit -m "feat: serve terrain and background presets from API"
```

---

## Task 10: Update Sprite Type Toggle in All Config Panels

All 4 config panels need the same 4-button sprite type toggle.

**Files:**
- Modify: `src/components/config/ConfigPanel.tsx`
- Modify: `src/components/config/BuildingConfigPanel.tsx`
- Modify: `src/components/config/TerrainConfigPanel.tsx` (already has it from Task 6)
- Modify: `src/components/config/BackgroundConfigPanel.tsx` (already has it from Task 6)

**Step 1: Update ConfigPanel.tsx**

Find the existing 2-button segmented control (Character/Building) and expand to 4:

```tsx
<div className="segmented-control">
  {(['character', 'building', 'terrain', 'background'] as SpriteType[]).map((t) => (
    <button
      key={t}
      type="button"
      className={state.spriteType === t ? 'active' : ''}
      onClick={() => dispatch({ type: 'SET_SPRITE_TYPE', spriteType: t })}
    >
      {t.charAt(0).toUpperCase() + t.slice(1)}
    </button>
  ))}
</div>
```

**Step 2: Update BuildingConfigPanel.tsx with the same 4-button toggle**

**Step 3: Commit**

```bash
git add src/components/config/ConfigPanel.tsx src/components/config/BuildingConfigPanel.tsx
git commit -m "feat: update sprite type toggle to 4 buttons in all config panels"
```

---

## Task 11: Smoke Test and Verification

**Step 1: Start the dev server**

```bash
npm run dev
```

**Step 2: Verify terrain flow**

- Switch to Terrain mode via the type toggle
- Select a preset (e.g., Grassland Plains)
- Verify grid size selector shows 3x3, 4x4, 5x5
- Verify tile labels populate from preset
- Click "View Full Prompt" and verify terrain-specific guidance
- Verify cell count in generate button matches grid size

**Step 3: Verify background flow**

- Switch to Background mode
- Verify mode selector (Parallax / Scene) appears
- Select Parallax: verify grid sizes 1x3, 1x4, 1x5
- Select Scene: verify grid sizes 2x2, 3x2, 3x3
- Select a preset and verify labels populate
- Click "View Full Prompt" and verify mode-appropriate guidance

**Step 4: Verify existing flows still work**

- Switch to Character mode and verify config panel works
- Switch to Building mode and verify config panel works
- Open Gallery and verify it loads correctly

**Step 5: Run extraction tests for regression**

```bash
npx playwright test --reporter=line
```

Expected: All 13 tests pass (no extraction changes were made).

**Step 6: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: address smoke test issues"
```

---

## Task 12: Branch, Push, PR

**Step 1: Create feature branch (if not already on one)**

```bash
git checkout -b feat/terrain-background-generation
```

**Step 2: Push and create PR**

```bash
git push -u origin feat/terrain-background-generation
gh pr create --title "feat: terrain and background sprite generation" --body "..."
```
