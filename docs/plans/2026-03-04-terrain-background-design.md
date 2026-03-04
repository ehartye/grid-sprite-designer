# Terrain & Background Generation Design

**Date**: 2026-03-04
**Approach**: Mirror the building pattern (Approach A)

## Overview

Add two new sprite types — terrain and background — alongside existing character and building types. Each gets its own config panel, prompt builder, workflow hook, grid configs, and preset table, following the same modular pattern used when building was added.

## Sprite Type System

Type union expands to:
```typescript
SpriteType = 'character' | 'building' | 'terrain' | 'background'
```

AppContext gains `terrain` and `background` config objects plus `terrainPresets` and `backgroundPresets` arrays.

## Grid Configurations

### Terrain (square cells, variable size)

| Grid | Cells | Use case |
|------|-------|----------|
| 3x3  | 9     | Compact tileset — a few base + key transitions |
| 4x4  | 16    | Standard tileset — base variants + edges/corners |
| 5x5  | 25    | Full tileset — all transitions covered |

### Background — Parallax Layers (wide rectangular cells, stacked vertically)

| Grid | Cells | Aspect | Use case |
|------|-------|--------|----------|
| 1x3  | 3     | ~3:1 wide | Simple 3-layer parallax |
| 1x4  | 4     | ~3:1 wide | 4-layer parallax |
| 1x5  | 5     | ~3:1 wide | Detailed 5-layer parallax |

### Background — Scene Variations (square or slightly wide cells)

| Grid | Cells | Use case |
|------|-------|----------|
| 2x2  | 4     | 4 scene variants |
| 3x2  | 6     | 6 variants |
| 3x3  | 9     | 9 variants |

## Config Panels

### TerrainConfigPanel

- Preset selector (`/api/presets?type=terrain`)
- Grid size selector (3x3, 4x4, 5x5)
- Terrain name, description
- Tile guidance (per-cell labels: "Base Grass", "Grass-to-Dirt Edge N", etc.)
- Color notes, style notes
- Image size (2K/4K), prompt preview

### BackgroundConfigPanel

- Preset selector (`/api/presets?type=background`)
- Mode selector: Parallax Layers vs Scene Variations
- Grid size selector (options change based on mode)
- Background name, description
- Layer/scene guidance (per-cell labels)
- Color notes, style notes
- Image size (2K/4K), prompt preview

### App.tsx Routing

Switch from ternary to map:
- character → ConfigPanel
- building → BuildingConfigPanel
- terrain → TerrainConfigPanel
- background → BackgroundConfigPanel

## Prompt Builders

### buildTerrainPrompt()

- Template structure description
- Terrain description from user inputs
- Tileability guidance: edges align in color, texture, and pattern
- Transition guidance: which terrain types meet, from which direction
- Consistency: same art style, palette, scale across all cells
- Chroma background preservation
- Per-cell labels with specific tile type instructions

### buildBackgroundPrompt()

Two strategies based on mode:

**Parallax mode**: Each cell is one horizontal layer at a specific depth. Layers stack top-to-bottom, each tiles horizontally, foreground has more detail, background is simpler/hazier.

**Scene variations mode**: Each cell is a complete standalone scene. Same composition/layout across variants, only lighting/weather/time-of-day changes. Similar to building prompt style.

Both include chroma preservation, centering, and boundary rules.

## Workflow Hooks

`useTerrainWorkflow()` and `useBackgroundWorkflow()` follow the same orchestration as `useBuildingWorkflow`:

1. Validate fields
2. Get grid config + template params
3. Generate template via `generateTemplate()`
4. Build prompt via type-specific prompt builder
5. Call Gemini API via `generateGrid()`
6. Extract sprites via `extractSprites()` with grid override
7. Save to DB + archive

## Database

### New tables

**terrain_presets**: id, name, genre, grid_size, description, tile_labels (JSON), color_notes, tile_guidance

**background_presets**: id, name, genre, grid_size, bg_mode ('parallax'|'scene'), description, layer_labels (JSON), color_notes, layer_guidance

### Seed presets (~6 each)

**Terrain**: Grassland Plains (4x4), Dungeon Stone (3x3), Desert Dunes (4x4), Snow Tundra (3x3), Volcanic Rock (4x4), Forest Floor (5x5)

**Background**: Enchanted Forest (parallax 1x4), Mountain Range (parallax 1x5), Haunted Graveyard (scene 3x2), Ocean Sunset (parallax 1x3), Cyberpunk City (scene 2x2), Underwater Reef (parallax 1x4)

## Extraction & Gallery

No changes needed to sprite extraction — per-cell header stripping and grid detection already handle any grid configuration.

Gallery `handleLoad` needs new types added to the switch logic for restoring correct config state.

## Files to Create

- `src/lib/terrainGridConfig.ts` (or extend `gridConfig.ts`)
- `src/lib/terrainPromptBuilder.ts`
- `src/lib/backgroundPromptBuilder.ts`
- `src/hooks/useTerrainWorkflow.ts`
- `src/hooks/useBackgroundWorkflow.ts`
- `src/components/config/TerrainConfigPanel.tsx`
- `src/components/config/BackgroundConfigPanel.tsx`

## Files to Modify

- `src/context/AppContext.tsx` — new types, config objects, actions, presets
- `src/lib/gridConfig.ts` — terrain + background grid definitions
- `src/App.tsx` — route to new config panels
- `src/components/layout/AppHeader.tsx` — handle new sprite types
- `src/components/shared/GeneratingOverlay.tsx` — dynamic cell count for new types
- `src/components/gallery/GalleryPage.tsx` — restore terrain/background from gallery
- `server/db.js` — new preset tables + seed data
- `server/index.js` — preset endpoints (already generic, minimal changes)
