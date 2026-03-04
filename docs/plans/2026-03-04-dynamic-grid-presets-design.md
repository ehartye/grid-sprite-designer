# Dynamic Grid Presets & Run Builder Design

**Date:** 2026-03-04
**Status:** Approved

## Overview

Decouple grid layouts from content presets across all sprite types. Grid presets become first-class entities defining size, cell labels, cell groups (for animation preview), and generic guidance. Content presets (character, building, terrain, background) link to grid presets via junction tables that store per-combo guidance overrides. A new admin page manages all presets. A run builder enables selective multi-grid generation with sprite continuity via reference sheets.

## Data Model

### New Table: grid_presets

```sql
grid_presets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  sprite_type TEXT NOT NULL,        -- 'character' | 'building' | 'terrain' | 'background'
  genre TEXT DEFAULT '',
  grid_size TEXT NOT NULL,          -- '6x6', '4x4', '3x2', etc.
  cols INTEGER NOT NULL,
  rows INTEGER NOT NULL,
  cell_labels TEXT NOT NULL,        -- JSON array
  cell_groups TEXT DEFAULT '[]',    -- JSON array of {name, cells[]}
  generic_guidance TEXT DEFAULT '',
  bg_mode TEXT DEFAULT NULL,        -- 'parallax' | 'scene' (background only)
  is_preset INTEGER DEFAULT 1
)
```

**Cell groups** define animation preview selection buttons:
```json
[
  {"name": "Walk Down", "cells": [0,1,2]},
  {"name": "Walk Up", "cells": [3,4,5]},
  {"name": "Attack", "cells": [19,20,21]}
]
```

### Modified Content Presets

Remove grid-specific fields from content preset tables:

- **character_presets:** Remove `row_guidance`
- **building_presets:** Remove `grid_size`, `cell_labels`, `cell_guidance`
- **terrain_presets:** Remove `grid_size`, `tile_labels`, `tile_guidance`
- **background_presets:** Remove `grid_size`, `bg_mode`, `layer_labels`, `layer_guidance`

### New Junction Tables

One per sprite type:

```sql
character_grid_links (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  character_preset_id INTEGER REFERENCES character_presets(id) ON DELETE CASCADE,
  grid_preset_id INTEGER REFERENCES grid_presets(id) ON DELETE CASCADE,
  guidance_override TEXT DEFAULT '',
  sort_order INTEGER DEFAULT 0,
  UNIQUE(character_preset_id, grid_preset_id)
)

building_grid_links (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  building_preset_id INTEGER REFERENCES building_presets(id) ON DELETE CASCADE,
  grid_preset_id INTEGER REFERENCES grid_presets(id) ON DELETE CASCADE,
  guidance_override TEXT DEFAULT '',
  sort_order INTEGER DEFAULT 0,
  UNIQUE(building_preset_id, grid_preset_id)
)

terrain_grid_links (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  terrain_preset_id INTEGER REFERENCES terrain_presets(id) ON DELETE CASCADE,
  grid_preset_id INTEGER REFERENCES grid_presets(id) ON DELETE CASCADE,
  guidance_override TEXT DEFAULT '',
  sort_order INTEGER DEFAULT 0,
  UNIQUE(terrain_preset_id, grid_preset_id)
)

background_grid_links (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  background_preset_id INTEGER REFERENCES background_presets(id) ON DELETE CASCADE,
  grid_preset_id INTEGER REFERENCES grid_presets(id) ON DELETE CASCADE,
  guidance_override TEXT DEFAULT '',
  sort_order INTEGER DEFAULT 0,
  UNIQUE(background_preset_id, grid_preset_id)
)
```

### Prompt Guidance Layering

Final guidance = `grid_preset.generic_guidance` + `\n\n` + `junction.guidance_override`

- Generic guidance: describes poses/cells generically (e.g., "Cell 0: character walks forward, left foot leading")
- Override: character-specific details (e.g., "Cecil's holy longsword held at right side, blue cape swaying")

## Admin Page

**Route:** `/admin`

### Layout
Tabbed interface:
1. **Grid Presets** — sub-filtered by sprite type
2. **Character Presets**
3. **Building Presets**
4. **Terrain Presets**
5. **Background Presets**

### Grid Presets Tab
- List view filtered by sprite type sub-tabs
- Each entry: name, sprite type, grid size, cell count, linked content preset count
- Edit form: name, sprite type, grid size (cols/rows), cell labels editor (add/remove/reorder), cell groups editor (name + cell selection), generic guidance textarea
- Visual grid preview with labeled cells
- Delete with confirmation (warn if linked)

### Content Preset Tabs
- List view with name, genre, linked grid count
- Edit form: all content fields (name, description, equipment/details, colorNotes, styleNotes)
- **Linked Grid Presets section:** shows linked grids with:
  - Per-combo guidance override textarea
  - Add/remove grid links
  - Drag to reorder (sets default run order)

## Run Builder

**Route:** `/run`

### Flow
1. Select sprite type
2. Select content preset (dropdown)
3. Grid preset checklist — all linked grids shown with:
   - Checkbox (select/deselect)
   - Name + grid size
   - Cell label preview
   - Drag handle for reorder (first checked = reference sheet)
4. Image size selector (2K / 4K)
5. "Start Run" button

### Generation Sequence

**First grid (A):**
- Generate template, build prompt (content + grid generic guidance + combo override)
- Send to Gemini: `[template_image_A]` + prompt
- Store completed grid as `referenceSheet`
- Enter review flow

**Subsequent grids (B, C, ...):**
- Generate template, build prompt with explicit image instructions:
  > "You are given two images. IMAGE 1 is a previously completed sprite sheet for this character — use it as your visual reference to maintain consistent proportions, color palette, art style, and character identity. IMAGE 2 is a blank template grid — fill each labeled cell according to the guidance below."
- Send to Gemini: `[referenceSheet, template_image_B]` + prompt
- Always reference grid A's completed sheet (first only, not accumulating)

### Review Integration
- After each grid completes, user enters existing review flow
- Animation preview shows cell-group buttons from grid preset (replacing hardcoded groups)
- "Next Grid" / "Skip" buttons to continue run
- Run progress indicator: "Grid 2 of 3"

## Migration Strategy

### Porting Existing Data

**Characters:**
- `GENERIC_ROW_GUIDANCE` from `promptBuilder.ts` → `generic_guidance` on new "RPG Full 6x6" grid preset
- `CELL_LABELS` from `poses.ts` → `cell_labels` on same grid preset
- Hardcoded animation groups → `cell_groups` on same grid preset
- Each character preset's `row_guidance` → `guidance_override` in `character_grid_links`

**Buildings:**
- Each building preset's `grid_size` + `cell_labels` → new grid preset per unique combo
- `cell_guidance` → split into generic (grid preset) and building-specific (junction override)

**Terrain:**
- Each terrain preset's `grid_size` + `tile_labels` → grid presets
- `tile_guidance` → split into generic + override

**Backgrounds:**
- Each background preset's `grid_size` + `bg_mode` + `layer_labels` → grid presets
- `layer_guidance` → split into generic + override

### Config Panel Changes
- Simplified: no inline grid size selectors or cell label editors
- Select content preset → see linked grid presets → link to admin for editing
- Quick generate still possible (uses first linked grid preset)

## API Endpoints

### New Endpoints
```
GET    /api/grid-presets                    — list (filterable by sprite_type)
POST   /api/grid-presets                    — create
PUT    /api/grid-presets/:id                — update
DELETE /api/grid-presets/:id                — delete

GET    /api/presets/:type/:id/grid-links    — get linked grids for a content preset
POST   /api/presets/:type/:id/grid-links    — add grid link with guidance override
PUT    /api/grid-links/:id                  — update link (guidance, sort_order)
DELETE /api/grid-links/:id                  — remove link
```

### Modified Endpoints
```
GET    /api/presets?type=X                  — still works, returns content presets (without grid fields)
POST   /api/generate-grid                   — extended to accept reference_image for continuity
```
