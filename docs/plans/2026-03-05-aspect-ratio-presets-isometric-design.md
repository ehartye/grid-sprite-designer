# Aspect Ratio, New Presets & Isometric Support Design

**Date:** 2026-03-05
**Status:** Approved

## Summary

Add aspect ratio as a configurable property on grid presets, expand the preset catalog with Post-Apocalyptic and Sci-Fi Horror (HR Giger) genres across all sprite types, introduce isometric grid support via tile_shape, and create pre-linked multi-sheet animation series for key characters.

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Aspect ratio location | Grid preset property with user override | Smart defaults per grid type, user can change at generation time |
| Isometric architecture | Extend grid_presets (no new tables) | Minimal schema changes, reuses all existing infrastructure |
| Animation series | Expand existing run system | Pre-linked grid sequences per character via grid_links table |
| Tiling support | Research-informed presets only | No new tile-assembly code; AI guidance handles edge consistency |
| Preset scope | ~40+ presets (go big) | Full genre coverage + isometric variants + multi-sheet series |

## 1. Schema Changes

### grid_presets table

Add two columns:

```sql
ALTER TABLE grid_presets ADD COLUMN aspect_ratio TEXT DEFAULT '1:1';
ALTER TABLE grid_presets ADD COLUMN tile_shape TEXT DEFAULT 'square';
```

- `aspect_ratio`: One of the 10 Nano Banana Pro supported ratios: `1:1`, `2:3`, `3:2`, `3:4`, `4:3`, `4:5`, `5:4`, `9:16`, `16:9`, `21:9`
- `tile_shape`: `'square'` (standard rectangular cells) or `'diamond'` (isometric 2:1 diamond cells)

### generations table

Add one column to record the actual ratio used:

```sql
ALTER TABLE generations ADD COLUMN aspect_ratio TEXT DEFAULT '1:1';
```

### Migration

All existing grid_presets receive `aspect_ratio='1:1'` and `tile_shape='square'` (the defaults handle this).

## 2. Server & Generation Pipeline

### server/routes/generate.js

- Accept `aspectRatio` from client request body
- Pass to Gemini API's `imageConfig.aspectRatio` (currently hardcoded `'1:1'`)
- Store in generations table

### src/lib/templateGenerator.ts

- Accept aspect ratio parameter
- Calculate canvas dimensions: parse ratio string, multiply by imageSize base
  - Example: `16:9` at `2K` → 2048×1152
  - Example: `1:1` at `2K` → 2048×2048 (unchanged)
- For `tile_shape: 'diamond'`: draw diamond outlines within cells instead of simple rectangles
- Cell dimensions become non-square when aspect ratio ≠ 1:1

### src/lib/spriteExtractor.ts

- Handle non-square canvas dimensions in full-width cut detection
- Expected cell dimensions adjust based on canvas aspect ratio
- No changes to cut detection algorithm itself (it works on rows/columns independently)

### src/api/geminiClient.ts

- Pass `aspectRatio` through to server in generate request

### Prompt builders

- When `tile_shape` is `'diamond'`, add isometric-specific instructions to the prompt (e.g., "Draw each sprite within a diamond-shaped tile with 2:1 width-to-height ratio")

## 3. UI Changes

### ConfigPanel

- Aspect ratio dropdown populated from grid preset default
- User can override before generating
- When tile_shape is 'diamond', show note about isometric mode

### Grid Preset Admin (AdminPanel)

- New `aspect_ratio` dropdown field (10 options)
- New `tile_shape` toggle: square / diamond

## 4. Preset Catalog

### 4.1 Post-Apocalyptic Genre

#### Characters (5)

| Name | Description | Equipment | Colors |
|------|-------------|-----------|--------|
| Wasteland Wanderer | Lone survivor, weathered and resourceful | Leather duster, gas mask, makeshift spear, salvaged backpack | Dusty brown, faded olive, rust orange |
| Vault Dweller | Tech-equipped underground shelter survivor | Blue jumpsuit with yellow trim, Pip-Boy wrist computer, laser pistol | Blue, yellow, chrome |
| Raider Warlord | Brutal scavenger leader, intimidating | Spiked armor from scrap metal, mohawk, chain weapon, war paint | Black, rust red, bone white |
| Mutant Enforcer | Oversized irradiated brute, tragic figure | Crude super sledge, torn clothing, radiation scars | Sickly green, purple bruising, grey |
| Caravan Trader | Traveling merchant, pragmatic survivor | Wide-brimmed hat, pack harness, barter goods, revolver | Tan, brown leather, brass |

#### Buildings (4)

| Name | Grid Size | Description | Details |
|------|-----------|-------------|---------|
| Ruined Gas Station | 3×3 | Collapsed canopy roadside station | Rusted pumps, boarded windows, faded signage, overgrown parking lot |
| Fortified Settlement Gate | 3×3 | Scrap-built community entrance | Scrap metal walls, watchtower, barbed wire, guard posts, makeshift gate |
| Underground Bunker Entrance | 2×2 | Hidden survival shelter access | Heavy blast door, radiation warning signs, camouflaged hillside entrance |
| Irradiated Church | 3×3 | Crumbling place of worship | Broken steeple, glowing green interior, collapsed roof sections, overgrown graveyard |

#### Terrain (3)

| Name | Grid Size | Description | Tiling Notes |
|------|-----------|-------------|-------------|
| Cracked Desert Wasteland | 4×4 | Sun-baked post-nuclear earth | Center variants with cracks/debris, edges blend to clean sand, corners for path transitions |
| Toxic Swamp | 4×4 | Murky irradiated wetland | Glowing green pools, dead trees, bubbling surface, toxic fog |
| Ruined Highway | 4×4 | Cracked asphalt with overgrowth | Lane markings, potholes, rusted vehicle debris, grass through cracks |

#### Backgrounds (3)

| Name | Grid Size | BG Mode | Description |
|------|-----------|---------|-------------|
| Nuclear Sunset Skyline | 1×4 | parallax | Ruined city silhouette, orange-red sky, mushroom cloud remnant on horizon |
| Underground Vault Interior | 1×4 | parallax | Clean metal walls, flickering fluorescent lights, vault door in distance |
| Wasteland Trading Post | 2×2 | scene | Market stalls, scrap structures, dusty atmosphere, day/night variants |

### 4.2 Sci-Fi Horror / HR Giger Genre

#### Characters (5)

| Name | Description | Equipment | Colors |
|------|-------------|-----------|--------|
| Xenomorph Drone | Elongated skull, biomechanical exoskeleton, inner jaw mechanism | Claws, tail with blade tip, dorsal tubes, translucent inner mouth | Obsidian black, dark blue highlights, silver teeth |
| Xenomorph Warrior | Ridged head crest, heavier build, more aggressive stance | Larger claws, armored tail, chitinous chest plates | Black, dark brown undertones, acid-green blood |
| Facehugger Swarm | Spider-like parasitic creatures, unsettling movement | Gripping finger-legs, muscular tail, ventral proboscis | Pale flesh, pink-grey, translucent membranes |
| Biomechanical Entity | HR Giger-inspired fusion of organic tissue and mechanical structure | Tubes, ribbed pipes, exposed vertebrae, chrome plating over flesh | Chrome silver, flesh pink, dark steel, bone |
| Space Marine | Heavy-armored human soldier, colonial military aesthetic | Pulse rifle, motion tracker, tactical helmet, chest-mounted lamp | Olive drab, gunmetal grey, amber visor |

#### Buildings (4)

| Name | Grid Size | Description | Details |
|------|-----------|-------------|---------|
| Hive Chamber | 3×3 | Organic resin-walled alien nest | Cocooned victims along walls, dripping resin, egg clusters, dim amber light |
| Derelict Ship Corridor | 3×3 | Biomechanical alien vessel interior | Ribbed Giger-esque walls, fog, emergency strip lighting, skeletal arches |
| Egg Chamber | 2×2 | Breeding ground for facehuggers | Leathery eggs on organic floor, blue-green mist, pulsing bioluminescence |
| Biomechanical Temple | 3×3 | Giger cathedral of impossible geometry | Skeletal ribbed arches, organic pipes, chrome altar, living walls |

#### Terrain (3)

| Name | Grid Size | Description | Tiling Notes |
|------|-----------|-------------|-------------|
| Organic Hive Floor | 4×4 | Resin-coated metal with organic growth | Ridged organic spread, acid burn marks, cocooned debris, seamless edges |
| Industrial Grating | 4×4 | Metal walkways and utility corridors | Steel grating patterns, steam vents, dripping condensation, cable runs |
| Alien Planet Surface | 4×4 | Hostile extraterrestrial landscape | Jagged dark rock, bioluminescent pools, alien fungi, toxic atmosphere |

#### Backgrounds (3)

| Name | Grid Size | BG Mode | Description |
|------|-----------|---------|-------------|
| Hive Interior | 1×4 | parallax | Vast organic cavern, resin-coated walls, cocooned figures, warm amber light |
| Space Station Breach | 1×4 | parallax | Hull damage with stars visible, emergency red lighting, floating debris |
| Alien Landscape | 2×2 | scene | Hostile planet surface, dual moons, biomechanical megastructures |

### 4.3 Isometric Grid Presets

All isometric grids use `aspect_ratio: '16:9'` to get a wide canvas suitable for isometric layouts.

#### Terrain Grids

| Name | Sprite Type | Grid | Tile Shape | Cell Labels |
|------|-------------|------|-----------|-------------|
| Iso Wasteland Floor 4×4 | terrain | 4×4 | diamond | center-1, center-2, center-3, edge-N, edge-S, edge-E, edge-W, corner-NE, corner-NW, corner-SE, corner-SW, inner-NE, inner-NW, inner-SE, inner-SW, variant |
| Iso Hive Floor 4×4 | terrain | 4×4 | diamond | (same pattern, organic hive theme) |

#### Wall Grids

| Name | Sprite Type | Grid | Tile Shape | Cell Labels |
|------|-------------|------|-----------|-------------|
| Iso Wasteland Walls 4×2 | building | 4×2 | square | wall-left, wall-upper, corner-upper-left-upper, corner-upper-left-left, corner-upper-right, corner-lower-left, corner-lower-right, pillar |
| Iso Hive Walls 4×2 | building | 4×2 | square | (same orientations, organic hive theme) |

#### Character Grids (8-direction)

| Name | Sprite Type | Grid | Aspect Ratio | Cell Labels |
|------|-------------|------|-------------|-------------|
| Iso Walk Cycle 8×6 | character | 8×6 | 16:9 | Rows: S, SW, W, NW, N, NE, E, SE; Cols: frame-1 through frame-6 |
| Iso Attack Cycle 8×4 | character | 8×4 | 16:9 | Rows: 8 directions; Cols: frame-1 through frame-4 |
| Iso Idle Cycle 8×4 | character | 8×4 | 16:9 | Rows: 8 directions; Cols: frame-1 through frame-4 |
| Iso Death Sequence 8×4 | character | 8×4 | 16:9 | Rows: 8 directions; Cols: frame-1 through frame-4 |

### 4.4 Multi-Sheet Animation Series

Pre-linked grid sequences using the existing run system (grid_links with sort_order).

#### Wasteland Wanderer Series (5 grids)

| Order | Grid Preset | Animation |
|-------|-------------|-----------|
| 1 | Iso Walk Cycle 8×6 | Walking in 8 directions |
| 2 | Iso Attack Cycle 8×4 | Melee spear thrust |
| 3 | Iso Idle Cycle 8×4 | Standing alert, scanning |
| 4 | Iso Death Sequence 8×4 | Collapse and fall |
| 5 | Iso Attack Cycle 8×4 | Special: crouch and aim |

#### Xenomorph Warrior Series (5 grids)

| Order | Grid Preset | Animation |
|-------|-------------|-----------|
| 1 | Iso Walk Cycle 8×6 | Predatory stalking movement |
| 2 | Iso Attack Cycle 8×4 | Lunging claw attack |
| 3 | Iso Idle Cycle 8×4 | Alert stance, tail swaying |
| 4 | Iso Death Sequence 8×4 | Acid blood death |
| 5 | Iso Attack Cycle 8×4 | Tail strike |

#### Vault Dweller Series (4 grids)

| Order | Grid Preset | Animation |
|-------|-------------|-----------|
| 1 | Iso Walk Cycle 8×6 | Purposeful walk |
| 2 | Iso Attack Cycle 8×4 | Laser pistol firing |
| 3 | Iso Idle Cycle 8×4 | Checking Pip-Boy |
| 4 | Iso Death Sequence 8×4 | Collapse |

#### Biomechanical Entity Series (4 grids)

| Order | Grid Preset | Animation |
|-------|-------------|-----------|
| 1 | Iso Walk Cycle 8×6 | Mechanical-organic crawl |
| 2 | Iso Attack Cycle 8×4 | Tendril lash attack |
| 3 | Iso Idle Cycle 8×4 | Pulsing/breathing idle |
| 4 | Iso Death Sequence 8×4 | Disassembly/collapse |

## 5. Tiling Research Summary

No new code in this phase. Research findings inform terrain preset design.

### Key Techniques (for reference)

| Technique | Tile Count | Best For |
|-----------|-----------|----------|
| Random variants | 3-5 per terrain | Ground fill, visual variety |
| Wang 2-corner | 16 per terrain pair | Basic terrain transitions |
| 47-tile blob (autotile) | 47 per terrain pair | Engine-compatible (RPG Maker, Godot) |
| Herringbone Wang | 128 tiles | Advanced aperiodic tiling |

### How Presets Apply This

- Terrain grids use **16 cells (4×4)** which maps to the Wang 2-corner set: center variants + 4 edges + 4 outer corners + 4 inner corners + variant
- Cell labels describe tile positions (edge-N, corner-NE, etc.) so AI generates edge-consistent tiles
- Tile guidance instructs the AI to maintain seamless edges between adjacent tiles
- Multiple center variants (center-1, center-2, center-3) break visible repetition

### Wave Function Collapse Note

WFC is a *consumer* of tile sets, not a generator. The sprite generation tool produces tiles that WFC algorithms can assemble. Generating tiles with consistent, describable edge types enables WFC compatibility.

## 6. Isometric Research Summary

### Key Requirements (for reference)

| Aspect | Specification |
|--------|--------------|
| Floor tile ratio | 2:1 diamond (e.g., 64×32, 128×64, 160×80) |
| Wall orientations | 7 minimum: left, upper, 4 corners, pillar |
| Character directions | 8 (S, SW, W, NW, N, NE, E, SE) |
| Character frames per action | 4-6 typical |
| Mirroring | 5 unique directions, mirror 3 (asymmetric chars break this) |
| Diablo II style | Dark, desaturated, pre-rendered 3D look, weathered/gritty surfaces |
| Standard tile sizes | 64×32 (general), 128×64 (high detail), 160×80 (Diablo II) |

### How Design Applies This

- Isometric floor grids use `tile_shape: 'diamond'` for proper diamond-shaped cells
- `aspect_ratio: '16:9'` provides a wide canvas for isometric layouts
- 8-direction character grids use 8 rows × N frame columns
- Post-Apocalyptic and Sci-Fi Horror color notes emphasize dark, desaturated palettes
- Wall grids include all 7 standard isometric wall orientations

## 7. Supported Aspect Ratios Reference

All 10 Nano Banana Pro supported ratios, with resolution examples at 2K:

| Ratio | 2K Dimensions | 4K Dimensions | Typical Use |
|-------|--------------|--------------|-------------|
| 1:1 | 2048×2048 | 4096×4096 | Standard sprite grids |
| 2:3 | 1365×2048 | 2731×4096 | Portrait sprites |
| 3:2 | 2048×1365 | 4096×2731 | Landscape scenes |
| 3:4 | 1536×2048 | 3072×4096 | Tall character sheets |
| 4:3 | 2048×1536 | 4096×3072 | Classic display ratio |
| 4:5 | 1638×2048 | 3277×4096 | Near-square portrait |
| 5:4 | 2048×1638 | 4096×3277 | Near-square landscape |
| 9:16 | 1152×2048 | 2304×4096 | Vertical/mobile |
| 16:9 | 2048×1152 | 4096×2304 | Widescreen/isometric |
| 21:9 | 2048×878 | 4096×1756 | Ultrawide/cinematic |
