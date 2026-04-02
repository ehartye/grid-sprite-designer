# Hierarchical Guidance System Design

**Goal:** Replace the flat single-blob guidance model with a three-level hierarchy (overall → group → cell) applied uniformly across all four sprite types, with default guidance at the grid level and content-specific additions at both the link and preset levels.

**Architecture:** Six guidance surfaces per generation — grid overall/group/cell (defaults) plus link overall/group/cell (content-specific additions). Composed in a single structured pass, group-by-group and cell-by-cell, in the prompt.

**Tech Stack:** SQLite (better-sqlite3), Express, React/TypeScript, Gemini API

---

## Section 1 — Data Model

### `grid_presets` table
| Column | Type | Notes |
|--------|------|-------|
| `overall_guidance` | TEXT | Renamed from `generic_guidance`. Grid-wide context. |
| `group_guidance` | TEXT (JSON) | New. Dict keyed by group name: `{"Walk Down Animation Frames": "..."}` |
| `cell_guidance` | TEXT (JSON) | New. Dict keyed by cell label: `{"Walk Down 1": "..."}` |

### All four link tables (`character_grid_links`, `building_grid_links`, `terrain_grid_links`, `background_grid_links`)
| Column | Type | Notes |
|--------|------|-------|
| `overall_guidance` | TEXT | Renamed from `guidance_override`. Content-specific overall addition. |
| `group_guidance` | TEXT (JSON) | New. Same structure as grid-level. |
| `cell_guidance` | TEXT (JSON) | New. Same structure as grid-level. |

### All four content preset tables
| Table | Old column | New column |
|-------|-----------|------------|
| `character_presets` | `row_guidance` | `overall_guidance` |
| `building_presets` | `cell_guidance` | `overall_guidance` |
| `terrain_presets` | `tile_guidance` | `overall_guidance` |
| `background_presets` | `layer_guidance` | `overall_guidance` |

All four also gain `group_guidance TEXT DEFAULT '{}'` and `cell_guidance TEXT DEFAULT '{}'`.

Note: `building_presets.cell_guidance` (TEXT blob) must be renamed to `overall_guidance` before the new JSON `cell_guidance` column is added.

JSON format for group/cell guidance dicts:
```json
{
  "Walk Down Animation Frames": "3-frame walk cycle. Frames progress left-leg → both → right-leg.",
  "Walk Up Animation Frames": "Same cycle, character faces away."
}
```
```json
{
  "Walk Down 1": "Left leg forward, right leg back, arms swinging naturally.",
  "Walk Down 2": "Contact pose — feet together, arms at sides."
}
```

---

## Section 2 — Prompt Template

The prompt builder iterates groups in `cell_groups` order, then cells within each group, composing all three sources inline at each level. One pass. No separate "CHARACTER-SPECIFIC POSE NOTES" block.

```
[preamble — character description, equipment, color palette, chroma key rules,
 centering, equipment consistency, movement continuity, full body visibility]

OVERALL GUIDANCE:
{grid.overall_guidance}
{link.overall_guidance if non-empty}
{preset.overall_guidance if non-empty}

---

GROUP: Walk Down Animation Frames
{grid.group_guidance["Walk Down Animation Frames"] if non-empty}
{link.group_guidance["Walk Down Animation Frames"] if non-empty}
{preset.group_guidance["Walk Down Animation Frames"] if non-empty}

  Cell "Walk Down 1" (0,0):
  {grid.cell_guidance["Walk Down 1"] if non-empty}
  {link.cell_guidance["Walk Down 1"] if non-empty}
  {preset.cell_guidance["Walk Down 1"] if non-empty}

  Cell "Walk Down 2" (0,1):
  ...

---

GROUP: Walk Left Animation Frames
...
```

Rules:
- Empty guidance surfaces are omitted entirely — no blank sections or empty labels
- The three sources at each level are concatenated in order (grid → link → preset), separated by a newline
- Cells not belonging to any group are rendered in a final "Ungrouped Cells" section
- All four sprite types use the same composition function

**Removed entirely:**
- `composeGuidance()` in `promptBuilderBase.ts`
- All fallback chains (`gridGenericGuidance?.trim() || GENERIC_ROW_GUIDANCE`, `guidanceOverride?.trim() || character.rowGuidance.trim()`)
- `GENERIC_ROW_GUIDANCE` hardcoded constant in `promptBuilder.ts`
- Separate `CHARACTER-SPECIFIC POSE NOTES` block pattern
- `buildCellDescriptions()` (replaced by the new grouped iteration)

**New function:**
```typescript
function buildGuidanceBlock(
  gridGuidance: HierarchicalGuidance,
  linkGuidance: HierarchicalGuidance,
  presetGuidance: HierarchicalGuidance,
  cellGroups: CellGroup[],
  cellLabels: string[],
): string

interface HierarchicalGuidance {
  overall: string;
  groups: Record<string, string>;
  cells: Record<string, string>;
}
```

---

## Section 3 — Seeding & Migration

### DB Migration (new migration version)

```sql
-- grid_presets
ALTER TABLE grid_presets RENAME COLUMN generic_guidance TO overall_guidance;
ALTER TABLE grid_presets ADD COLUMN group_guidance TEXT NOT NULL DEFAULT '{}';
ALTER TABLE grid_presets ADD COLUMN cell_guidance TEXT NOT NULL DEFAULT '{}';

-- link tables (all four)
ALTER TABLE character_grid_links RENAME COLUMN guidance_override TO overall_guidance;
ALTER TABLE character_grid_links ADD COLUMN group_guidance TEXT NOT NULL DEFAULT '{}';
ALTER TABLE character_grid_links ADD COLUMN cell_guidance TEXT NOT NULL DEFAULT '{}';
-- (repeat for building, terrain, background link tables)

-- character_presets
ALTER TABLE character_presets RENAME COLUMN row_guidance TO overall_guidance;
ALTER TABLE character_presets ADD COLUMN group_guidance TEXT NOT NULL DEFAULT '{}';
ALTER TABLE character_presets ADD COLUMN cell_guidance TEXT NOT NULL DEFAULT '{}';

-- building_presets (cell_guidance rename required first)
ALTER TABLE building_presets RENAME COLUMN cell_guidance TO overall_guidance;
ALTER TABLE building_presets ADD COLUMN group_guidance TEXT NOT NULL DEFAULT '{}';
ALTER TABLE building_presets ADD COLUMN cell_guidance TEXT NOT NULL DEFAULT '{}';

-- terrain_presets
ALTER TABLE terrain_presets RENAME COLUMN tile_guidance TO overall_guidance;
ALTER TABLE terrain_presets ADD COLUMN group_guidance TEXT NOT NULL DEFAULT '{}';
ALTER TABLE terrain_presets ADD COLUMN cell_guidance TEXT NOT NULL DEFAULT '{}';

-- background_presets
ALTER TABLE background_presets RENAME COLUMN layer_guidance TO overall_guidance;
ALTER TABLE background_presets ADD COLUMN group_guidance TEXT NOT NULL DEFAULT '{}';
ALTER TABLE background_presets ADD COLUMN cell_guidance TEXT NOT NULL DEFAULT '{}';
```

### Seed File Changes

**`gridPresets.js`** — Decompose existing `generic_guidance` blobs:
- Parse `Header "Label" (r,c): ...` lines → `cell_guidance` dict entries keyed by label
- Parse `ROW N — GroupName (...):\n` intro lines → `group_guidance` dict entries keyed by group name
- Any remaining text → `overall_guidance`
- Apply to RPG Full, Athletic Movement 1, and all other grid presets with guidance

**`characterPresets.js`** — Decompose existing `rowGuidance` blobs:
- Same `Header "Label" (r,c): ...` parsing → `cell_guidance`
- Row-level intro lines → `group_guidance`
- Overall character notes → `overall_guidance`
- Remove `rowGuidance` field from all preset objects

**`buildingPresets.js`, `terrainPresets.js`, `backgroundPresets.js`** — Decompose where format allows:
- Named cell/tile/layer entries → `cell_guidance`
- Section headers → `group_guidance`
- Remainder → `overall_guidance`

Seed guards use `INSERT OR IGNORE` with explicit IDs throughout — no genre-based existence checks that would block re-seeding after column additions.

---

## Section 4 — UI

### Grid Preset Editor (`GridPresetsTab.tsx`)
Replace single `genericGuidance` textarea with three collapsible sections:

1. **Overall Guidance** — plain textarea (same as today, just renamed)
2. **Group Guidance** — one textarea per group, rendered from `cell_groups`; labeled with group name; saves as JSON dict on blur
3. **Cell Guidance** — one textarea per cell label, rendered from `cell_labels` with (row, col) shown; saves as JSON dict on blur

Group/cell sections only render after `cell_groups` / `cell_labels` are populated.

### Link Editor (`LinkedGridPresets.tsx`)
Same three-section structure. Group and cell textareas are generated from the linked grid's `cell_groups` / `cell_labels` so keys are always valid. Existing `guidance_override` textarea becomes the Overall section.

### Content Preset Editor (`GenericPresetsTab.tsx`)
Replace `rowGuidance` / `cellGuidance` / `tileGuidance` / `layerGuidance` textarea with three sections:

1. **Overall Guidance** — plain textarea
2. **Group Guidance** — add/edit/remove list of label → text pairs (free-form, no grid context at preset level)
3. **Cell Guidance** — same add/edit/remove list

The free-form list UI is used because content presets are not bound to a specific grid; values only apply at generation time when a label matches the active grid's labels.

---

## Removed Fields (no holdovers)

| Location | Removed | Replaced by |
|----------|---------|-------------|
| `grid_presets` | `generic_guidance` | `overall_guidance` |
| All link tables | `guidance_override` | `overall_guidance` |
| `character_presets` | `row_guidance` | `overall_guidance` |
| `building_presets` | `cell_guidance` (TEXT blob) | `overall_guidance` |
| `terrain_presets` | `tile_guidance` | `overall_guidance` |
| `background_presets` | `layer_guidance` | `overall_guidance` |
| `promptBuilderBase.ts` | `composeGuidance()`, `buildCellDescriptions()` | `buildGuidanceBlock()` |
| `promptBuilder.ts` | `GENERIC_ROW_GUIDANCE` constant | seed data only |
| All prompt builders | fallback chains, legacy pose blocks | unified `buildGuidanceBlock()` |
| `ContentPreset` type | `rowGuidance`, `cellGuidance`, `tileGuidance`, `layerGuidance` | `overallGuidance`, `groupGuidance`, `cellGuidance` |
| `GridLink` type | `genericGuidance`, `guidanceOverride` | `overallGuidance`, `groupGuidance`, `cellGuidance` |
