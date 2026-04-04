---
name: preset-ideate
description: Use when the user wants to brainstorm a new sprite preset concept for grid-sprite-designer — character, building, terrain tileset, or background scene — or asks for help coming up with a new character/villain/creature/location/environment idea, or asks to explore what a given genre or theme could look like as a preset. Returns 3-5 concept sketches with a suggested grid preset.
---

# preset-ideate

Divergent brainstorming for a new sprite preset in this repo. Produces 3-5 concept sketches the user can pick from, each one specific enough to hand directly to `preset-author`.

## When to use

- "Let's come up with a new character for the food fantasy set"
- "I want a wasteland scavenger villain" / "give me some ice mage ideas"
- "What's a good Sci-Fi building to add" / "brainstorm a haunted terrain tileset"
- "Explore some concepts for a Cyberpunk background"
- User supplies a seed (genre, motif, vibe, gap in the roster) and wants options.

Not for:
- User already has a locked concept — go straight to `preset-author`.
- Fixing/refining an existing preset — that's a direct edit task.

## Canonical archetypes (motion signatures for characters)

When proposing character concepts, aim for distinct motion verbs so the group-level walk flavor varies across the roster. The live roster already covers:

| Motion style | Verb | Example preset | Signature detail |
|---|---|---|---|
| Militant | marches | sergeant-sriracha | bandolier bouncing, heat shimmer |
| Graceful | glides | duchess-gelato | frozen skirt swirling, frost crystals |
| Aggressive | stomps | raider-warlord | spiked ball dragging, mohawk banner |
| Stealthy | skulks / slinks | shadow-weaver, pepperoni-pete | cloak wrapping, cheese strings trailing |
| Swift | dashes / strides | hayate-ninja, chrono-blade | scarf trailing dynamically |
| Lumbering | lumbers | general-gumbo, mutant-enforcer | cauldron sloshing, ground shaking |
| Creature-slither | slithers / crawls | voidmaw-parasite, spore-lurker | segmented body undulating, cilia rippling |
| Creature-hover | pulses / hovers | arc-jelly, fluxbot-drone | bell contracting, fins spinning |
| Creature-squish | bounces / squishes | gel-slime | jelly-physics wobble, inner glow |
| Predator stalk | stalks | xenomorph-drone | digitigrade, tail counterbalance |
| Swarm | scuttles | facehugger-swarm | coordinated formation, wet organic sheen |
| Waddle | waddles / struts | baron-brioche, mosskin-spirit | cape fluttering, flowers bobbing |

Pick a motion slot the roster is thin on, or deliberately double up on a crowded one if the concept needs it.

## Grid preset selection

Different sprite types relate to grid presets differently — this affects how you pitch concepts.

**Character** — grids are **reusable across presets**. Pick from existing:

| Grid | Size | Use for |
|---|---|---|
| RPG Full | 6x6 | Standard RPG character: walk (all 4 directions), idle, battle idle, attack, special, damage, KO, victory, weak/critical |
| Athletic Movement 1 | 6x6 | Sprint, leap, dodge roll sequences — for athletic / parkour / action characters |

Default to RPG Full unless the concept is specifically about sprint/parkour motion. A character can link to multiple grids.

**Building / Terrain / Background** — grids are typically **authored alongside the preset**. The `cellLabels` on the preset object drives grid creation. So ideation should include the cell-label list, not pick a grid.

- **Building** sizes in use: 2x2, 2x3, 3x3. Cell axis is usually a "variant" sequence (time of day, damage state, activity level, seasonal change, mood).
- **Terrain** sizes in use: 3x3, 4x4, 5x5. Cells are tile types (base tiles × 2-3, special features, transitions, hazards).
- **Background** has two modes: `parallax` (1xN strips, each cell is a depth layer from far to near) and `variants` (MxN, each cell is a scene variant under different conditions). Typical sizes: 1x3-1x5 parallax, 2x2-3x2 variants.

## Ideation process

1. **Clarify the seed.** Ask *only* what's blocking — genre, sprite type, vibe. Don't over-interrogate. If the user says "a food fantasy villain", you have enough.

2. **Generate 3-5 sketches.** Each sketch is a compact card:

   ```
   Name — short tagline
   Visual hook: one-line silhouette description
   Equipment/features: 2-3 concrete items
   Personality twist: what makes them interesting (1 line)
   Motion signature (characters only): verb + flavor detail
   Variant axis (buildings/backgrounds) or tile variety (terrain)
   Suggested grid: RPG Full / Athletic Movement 1 / new 3x3 variant grid / 1x4 parallax / etc.
   ```

3. **Offer mental foils.** For every serious concept, include one deliberately weird / contrasting option so the user has something to push against.

4. **Stop when the user locks one** (or asks for a different direction — then regenerate with the new constraint).

5. **Hand off to preset-author.** Once locked, tell the user: *"Ready to write this up — want me to invoke preset-author?"*

## What makes a strong sketch

- **Concrete visual hook.** "A pickle in a rat-skeleton exosuit" is a hook. "A fantasy warrior" is not.
- **Specific equipment, not categories.** "A baguette rapier with a butter-pat crossguard" beats "a sword".
- **Color palette implied by the concept.** Sriracha is obviously red + green-cap + chrome. Don't write one without the palette being deducible.
- **Motion signature that differs from the adjacent character in the pack.** If the concept lives next to Hayate (dash), don't pitch another dash character — pitch a creature-slither or a lumber.
- **Genre tag matches existing taxonomy.** Genres in use: Classic Fantasy, Food Fantasy, Sci-Fi, Wasteland, Cyberpunk (and similar). Invent a new genre only if the concept genuinely doesn't fit.

## Red flags in your own sketches

- Generic names ("Warrior", "Knight", "Mage") — always give them a proper noun.
- Equipment lists that could belong to any character — specificity is the point.
- Motion signatures that collide with an existing preset's verb + flavor combo.
- Building/terrain/background concepts where the cell axis is vague — "variations" is not a variant axis; "day / night / damaged / ruined" is.

## After locking a concept

Hand the locked concept to `preset-author` for the write-up. Do not begin editing the seed file from inside this skill — `preset-author` handles the authoring conventions, file locations, and live-DB application.
