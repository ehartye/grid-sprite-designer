---
name: preset-author
description: Use when the user has a locked sprite preset concept ready to write into server/db/seeds/ (characterPresets.js, buildingPresets.js, terrainPresets.js, or backgroundPresets.js), or asks to "add [name] to the seeds", "turn this concept into a preset entry", "write up [X] as a new [sprite type]", or wants to author a new preset and apply it to the live grid-sprite.db. Enforces walk-cell conventions, directional-language bans, hierarchical guidance shape, and handles live-DB application via hand-written migration.
---

# preset-author

Convergent authoring for a new sprite preset. Takes a locked concept, produces a seed entry that follows every convention, writes it to the seed file, and optionally applies it to the live DB.

## When to use

- User has a concept ready: *"Write up Sergeant Umami as a character preset"*
- *"Add this building concept to buildingPresets.js"*
- *"Turn that into a terrain tileset seed entry"*
- *"Add the Shadowmoth to the character seeds"*

Not for:
- Brainstorming concepts — use `preset-ideate` first.
- Editing an existing preset's wording — that's a direct file edit, not this skill.
- Auditing existing presets for convention drift — that's a separate pass.

## Preconditions

Before writing anything, confirm you have:
1. **Sprite type** — character / building / terrain / background
2. **Name and id slug** — `sergeant-umami`, `moss-cottage`, etc. (lowercase, hyphens, matches existing conventions)
3. **Genre** — from existing taxonomy or explicitly new
4. **Description + visual hook** — the character/building/tileset itself
5. **Equipment/features or cell labels** — what's distinctive
6. **Grid choice** — see Grid preset selection below

If any are missing, ask the user before drafting.

## File locations

| Sprite type | Seed file | Preset table | Grid link table |
|---|---|---|---|
| character | `server/db/seeds/characterPresets.js` | `character_presets` | `character_grid_links` |
| building | `server/db/seeds/buildingPresets.js` | `building_presets` | `building_grid_links` |
| terrain | `server/db/seeds/terrainPresets.js` | `terrain_presets` | `terrain_grid_links` |
| background | `server/db/seeds/backgroundPresets.js` | `background_presets` | `background_grid_links` |

The seed file exports a `seed*Presets(db)` function that contains a `PRESETS` array — append new presets there, grouped by genre if the file is organized that way.

## Preset object shapes

### Character (`characterPresets.js`)

```js
{
  id: 'sergeant-umami',
  name: 'Sergeant Umami',
  genre: 'Food Fantasy',
  description: '...visual description including silhouette, build, stance...',
  equipment: '...specific items, not categories...',
  colorNotes: '...palette deducible from concept...',
  rowGuidance: `
ROW 2 — Idle & Battle Idle:
  Header "Idle Down" (2,0): ...
  ...
`,
  groupGuidance: {
    "Walk South Animation Frames": "Sergeant Umami marches South with ...",
    "Walk North Animation Frames": "Sergeant Umami marches North with ...",
    "Walk West Animation Frames":  "Sergeant Umami marches West with ...",
    "Walk East Animation Frames":  "Sergeant Umami marches East with ...",
  },
},
```

Canonical reference: `sergeant-sriracha` at `characterPresets.js:851`. Study its shape when drafting.

### Building (`buildingPresets.js`)

```js
{
  id: 'mushroom-cottage',
  name: 'Mushroom Cottage',
  genre: 'Classic Fantasy',
  gridSize: '3x3',               // or '2x2' / '2x3' — drives grid creation
  description: '...',
  details: '...construction, materials, structural features...',
  colorNotes: '...',
  cellLabels: JSON.stringify([
    'Spring - Flowers', 'Summer - Butterflies', 'Autumn - Falling Leaves',
    'Winter - Snow Cap', 'Fairy Lights', 'Enchanted Growth',
    'Day - Idle', 'Night - Glow', 'Rain - Wet',
  ]),
  cellGuidance: `ROW 0 — Seasons:
  Header "Spring - Flowers" (0,0): ...
  ...`,
},
```

No `groupGuidance` for buildings in the current codebase — buildings use per-cell variant descriptions. The `gridSize` + `cellLabels` on the preset drive automatic grid creation.

Canonical reference: `medieval-inn` at `buildingPresets.js:5`.

### Terrain (`terrainPresets.js`)

```js
{
  id: 'enchanted-grove',
  name: 'Enchanted Grove',
  genre: 'Classic Fantasy',
  gridSize: '4x4',               // 3x3 / 4x4 / 5x5 typical
  description: '...biome feel, general mood...',
  colorNotes: '...',
  tileLabels: JSON.stringify([
    'Moss 1', 'Moss 2', 'Moss 3',
    'Glowing Root', 'Fairy Ring',
    ...16 tile names total...
  ]),
  cellGuidance: `ROW 0 — Base Tiles:
  Header "Moss 1" (0,0): ...
  ...`,
},
```

Terrain cells are tile types: base variations (2-3 variants of the primary tile so the grid has organic variety), special features (hazards, paths, objects), transitions (edges between tiles). Canonical reference: `grassland-plains` or similar in `terrainPresets.js`.

### Background (`backgroundPresets.js`)

```js
{
  id: 'sunset-coastline',
  name: 'Sunset Coastline',
  genre: 'Classic Fantasy',
  gridSize: '1x4',               // '1xN' for parallax, 'MxN' for variants
  bgMode: 'parallax',            // 'parallax' | 'variants'
  description: '...',
  colorNotes: '...',
  layerLabels: JSON.stringify([
    'Sunset Sky & Far Clouds',
    'Horizon & Distant Water',
    'Waves & Surf',
    'Beach & Foreground Rocks',
  ]),
  cellGuidance: `LAYER 0 — Sunset Sky & Far Clouds:
  Header "Sunset Sky & Far Clouds" (0,0): ...
  ...`,
},
```

Backgrounds have two distinct shapes:
- **`bgMode: 'parallax'`** — 1xN grid where each cell is a depth layer from far to near. Each cell must tile horizontally. Use for side-scrolling scenes.
- **`bgMode: 'variants'`** — MxN grid where each cell is the same scene under different conditions (day/night/storm/abandoned/etc.). Use for static backdrops that need atmospheric variety.

Canonical references: `enchanted-forest` (parallax) and `cyberpunk-city` (variants).

## Grid preset selection

Different sprite types relate to grid presets differently.

**Character**: grid presets are reusable — pick from existing.

| Grid name | Size | Use for |
|---|---|---|
| RPG Full | 6x6 | Standard character: walk (4 dirs) + idle + battle + attack + special + damage + KO + victory + status |
| Athletic Movement 1 | 6x6 | Sprint + leap + dodge roll sequences |

Default is RPG Full. Pick Athletic Movement 1 only if the concept is specifically about athletic motion. A character can be linked to multiple grids — author once, link twice.

The seed's `seedCharacterPresets` currently auto-links every character to RPG Full via `character_grid_links`. If you need Athletic Movement 1 too, you'll need to extend the seed link loop — flag this to the user before authoring.

**Building / Terrain / Background**: the grid is created from the preset's own `gridSize` + `cellLabels` (buildings), `tileLabels` (terrain), or `layerLabels` (backgrounds). The seed file auto-inserts into `grid_presets` using these fields. You do not pick an existing grid — the grid is paired 1:1 with the content preset.

## Conventions (DO NOT VIOLATE)

These are the rules established by the walk-cleanup pass. Violating any of them regresses recent work.

### Walk-cell convention (character, RPG Full only)

1. **Walk cells are blank.** The 12 cells `Walk {South,North,West,East} {1,2,3}` must have empty strings in `cell_guidance`. The RPG Full grid preset already owns walk mechanics ("mid-stride, left leg forward…"). The character should not repeat them.

2. **Walk flavor lives at the group level.** Populate all four `Walk {Dir} Animation Frames` keys in `groupGuidance` with a character-specific motion signature.

3. **Template across compass directions.** The four group entries are almost identical — only the compass word differs. Pattern:
   ```
   "{Name} {verb}s {Direction} with {gait/stance detail}, {equipment/garment flavor}. {Ambient-effect flavor}."
   ```
   Example (Sriracha): *"Sergeant Sriracha marches {Direction} with military precision, the chili-pepper grenade bandolier bouncing with each step. A small heat shimmer radiates from his bright red body."*

4. **Do not strip walk-frame headers from `rowGuidance`** for fresh authoring — just don't include them. (The old seeds had per-frame Walk cell headers; the seed rewriter already removed them. Don't re-add.)

### Language bans (all sprite types, all cells)

These phrases must not appear anywhere in a preset:

- "left foot" / "right foot" / "left leg" / "right leg" / "mid-step" / "feet together" / "neutral mid-step" / "mirror of" — walking-mechanic language owned by the grid preset, not the content preset
- "facing the viewer" / "facing away" / "facing the camera" / "facing away from the camera" — camera-relative language. The grid preset already defines compass directions in its overall guidance.
- "facing left" / "facing right" (except as compass-referenced: *"facing West at ease"* is fine because the grid label is Idle West)
- "in profile" / "side-view" / "back-view" / "front-view" — camera-relative
- "from behind" / "viewed from the back" — camera-relative

These are stripped by `decomposeGuidanceBlob`'s `stripRedundantDirections` on seed load, but don't rely on that — write correctly in the source.

### Compass language (preferred)

For idle and action cells on RPG Full characters, aligning the cell label with compass phrasing in the prose is fine and expected:
- "Idle South" cell → *"Sergeant Sriracha stands at ease facing South, hands behind his back…"*
- "Idle West" cell → *"At ease facing West, one hand resting on the jalapeño knife…"*

### Hierarchical guidance layers

Text lives at three nested levels. When authoring, place guidance at the most-specific level that applies.

| Layer | Field | Applies when |
|---|---|---|
| Preset overall | `preset.overall_guidance` (auto-derived from rowGuidance preamble) | Character-wide style, personality, constants |
| Grid link group | `character_grid_links.group_guidance` (from `preset.groupGuidance`) | Applies to all cells in a group (walk direction, battle group, etc.) |
| Grid link cell | `character_grid_links.cell_guidance` (from `preset.rowGuidance` Header lines) | Applies to a single cell |

Never duplicate — if it's in group, don't repeat in cell; if it's in overall, don't repeat in group.

### Cell label format (character RPG Full)

The current cell labels are compass-based. Old labels (Walk Down/Up/Left/Right, Idle Down/Up/Left/Right, Weak Pose, Critical Pose, Cast 1/2/3) have been renamed. If authoring from an older template, use `RPG_FULL_RENAME` in `server/db/seeds/decomposeGuidance.js` as the authoritative mapping. Cell labels in use:

```
Walk South 1/2/3, Walk North 1/2/3, Walk West 1/2/3, Walk East 1/2/3,
Idle South, Idle North, Idle West, Idle East,
Battle Idle 1/2/3,
Attack 1/2/3,
Special 1/2/3,
Damage 1/2/3,
KO 1/2/3,
Victory 1/2/3,
Weak, Critical
```

## Authoring workflow

1. **Confirm preconditions.** Don't start writing until sprite type, name, genre, visual hook, and grid choice are all locked.

2. **Locate insertion point.** Read the existing seed file to find the right place. Preserve genre grouping if the file is organized that way. Keep presets in a consistent order (check neighbors).

3. **Draft the preset object.** Start from the canonical reference for the sprite type. Fill in every field. For characters, leave walk cells entirely out of `rowGuidance` — don't write them blank-string, just omit the walk Header lines. Populate `groupGuidance` with four compass-templated entries.

4. **Show the draft.** Display the complete preset object to the user before writing. Call out any convention-relevant choices (verb selection, color palette, variant axis).

5. **Write to the seed file.** Use the Edit tool to insert the new preset object at the chosen location. Don't touch unrelated presets.

6. **Verify seed parses.** Run `node -e "(async () => { await import('./server/db/seeds/characterPresets.js'); console.log('ok'); })()"` (or the matching sprite type's seed file). Any syntax error needs to be fixed before DB application.

7. **Offer to apply to live DB.** The seed file is the source of truth, but `INSERT OR IGNORE` means running `seedXPresets(db)` against the live DB won't insert a row that already exists — and it will never run for a brand-new preset unless the whole seed is rerun. For a single new preset, hand-write a small one-shot migration script (see below), run it once, delete it.

## Live-DB application

For each new preset, follow this pattern:

1. **Back up first.**
   ```bash
   cp data/grid-sprite.db data/grid-sprite.db.bak-$(date +%Y%m%d-%H%M%S)
   ```

2. **Write a one-shot migration script** under `scripts/` that:
   - Opens `data/grid-sprite.db` with `better-sqlite3`
   - Runs `INSERT OR IGNORE INTO <preset_table>` with the preset fields (hand-written, matching what you just added to the seed)
   - For characters: inserts the `character_grid_links` row linking to the RPG Full grid, with `group_guidance` populated from the same JSON you put in the seed's `groupGuidance` field
   - For buildings/terrain/backgrounds: also inserts the `grid_presets` row (since the grid is paired 1:1 with the content preset)
   - Prints a confirmation line when done

3. **Run it once.** `node scripts/add-<preset-id>.js`

4. **Verify via a direct DB query** that the row appears and the `group_guidance` / `cell_guidance` columns look right.

5. **Delete the one-shot script.** These are not reusable and should not clutter `scripts/`. The seed file remains as the canonical record.

## Quality checklist

Before declaring the preset done, confirm:

- [ ] `id` slug matches `name` (lowercase, hyphens, no spaces)
- [ ] `genre` uses an existing tag or a deliberately new one
- [ ] `description`, `equipment` (or `details` / `colorNotes`), and color info are all filled
- [ ] For characters: `rowGuidance` contains no walk cell Headers; `groupGuidance` has all 4 compass entries
- [ ] No banned phrases anywhere in the text
- [ ] Compass language used where cell labels are compass-based
- [ ] Seed file still parses (`node -e "import('./server/db/seeds/<file>.js')"` exits cleanly)
- [ ] Canonical reference sanity-check: structure matches the canonical preset for this sprite type
- [ ] If applied to live DB: backup exists, one-shot script run + deleted, DB row verified

## Red flags

- About to write per-frame walk cell text for a character → **STOP**. Walk cells are blank; flavor goes in `groupGuidance`.
- About to write "facing the viewer" / "facing left" → **STOP**. Use compass direction or omit.
- About to describe foot mechanics ("left foot leads", "mid-step") → **STOP**. That's grid-preset territory.
- About to run `seedCharacterPresets(db)` against the live DB to add one character → **STOP**. `INSERT OR IGNORE` won't re-apply modified presets; use a one-shot migration.
- About to commit a one-shot migration script → **STOP**. Delete it first.
- About to skip the DB backup → **STOP**. Always back up before a live-DB write.

## Canonical references by archetype

Read these existing presets when in doubt about shape, phrasing, or level of detail:

- **Character, militant/march** — `sergeant-sriracha` (`characterPresets.js`)
- **Character, graceful/glide** — `duchess-gelato`
- **Character, creature/slither** — `spore-lurker`, `voidmaw-parasite`
- **Character, creature/hover** — `arc-jelly`, `fluxbot-drone`
- **Character, creature/squish** — `gel-slime`
- **Character, swarm** — `facehugger-swarm`
- **Building, variant axis (time)** — `medieval-inn`
- **Building, variant axis (damage)** — `castle-tower`, `space-station-module`
- **Terrain, biome tileset** — `grassland-plains`
- **Background, parallax layers** — `enchanted-forest`
- **Background, scene variants** — `cyberpunk-city`
