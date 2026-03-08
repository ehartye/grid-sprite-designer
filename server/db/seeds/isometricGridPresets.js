export function seedIsometricGridPresets(db) {
  const existing = db.prepare("SELECT COUNT(*) as count FROM grid_presets WHERE genre IN ('Post-Apocalyptic','Sci-Fi Horror','Isometric') AND aspect_ratio = '16:9'").get();
  if (existing.count > 0) return;

  const GRIDS = [
    // Terrain grids (diamond tiles)
    {
      name: 'Iso Wasteland Floor 4\u00d74',
      spriteType: 'terrain',
      genre: 'Post-Apocalyptic',
      gridSize: '4x4',
      cols: 4, rows: 4,
      aspectRatio: '16:9',
      tileShape: 'diamond',
      cellLabels: ['Center 1','Center 2','Center 3','Edge N','Edge S','Edge E','Edge W',
                   'Corner NE','Corner NW','Corner SE','Corner SW',
                   'Inner NE','Inner NW','Inner SE','Inner SW','Variant'],
      genericGuidance: `Isometric 2:1 diamond tile set for a post-apocalyptic wasteland floor. Each cell contains one diamond-shaped tile drawn at isometric perspective (roughly 30-degree top-down angle). Tiles must seamlessly connect when placed adjacent in an isometric grid.

TILE DRAWING RULES:
- Each tile is a diamond (rhombus) shape with 2:1 width-to-height ratio
- Draw the tile centered in the cell on a magenta (#FF00FF) background
- Edges of adjacent tiles must match perfectly when tiled
- Maintain consistent lighting from top-left
- Use cracked concrete, sand, rubble, and sparse dead vegetation textures

TILE TYPES:
- Center tiles: Main walkable floor variants, mostly flat cracked concrete with sand
- Edge tiles: Tiles that border another terrain type, with transition on one side
- Corner tiles: Tiles at terrain boundary corners, two edges transition
- Inner tiles: Inner corner variants for concave terrain shapes
- Variant: Special feature tile (drain grate, manhole cover, rubble pile)`,
    },
    {
      name: 'Iso Hive Floor 4\u00d74',
      spriteType: 'terrain',
      genre: 'Sci-Fi Horror',
      gridSize: '4x4',
      cols: 4, rows: 4,
      aspectRatio: '16:9',
      tileShape: 'diamond',
      cellLabels: ['Center 1','Center 2','Center 3','Edge N','Edge S','Edge E','Edge W',
                   'Corner NE','Corner NW','Corner SE','Corner SW',
                   'Inner NE','Inner NW','Inner SE','Inner SW','Variant'],
      genericGuidance: `Isometric 2:1 diamond tile set for an alien hive floor. Each cell contains one diamond-shaped tile drawn at isometric perspective (roughly 30-degree top-down angle). Tiles must seamlessly connect when placed adjacent in an isometric grid.

TILE DRAWING RULES:
- Each tile is a diamond (rhombus) shape with 2:1 width-to-height ratio
- Draw the tile centered in the cell on a magenta (#FF00FF) background
- Edges of adjacent tiles must match perfectly when tiled
- Maintain consistent lighting from bioluminescent sources within the floor
- Use organic textures: resin-coated chitin, membrane, pulsing veins, hardened secretions

TILE TYPES:
- Center tiles: Main hive floor variants with organic ribbed texture and faint bioluminescent veins
- Edge tiles: Transition tiles where hive floor meets bare rock or metal, organic growths creeping outward
- Corner tiles: Corner boundary transitions with thicker organic growth
- Inner tiles: Inner corner variants for concave boundaries
- Variant: Special feature tile (egg chamber indent, nutrient canal, nerve cluster node)`,
    },
    // Wall grids (square cells showing wall orientations)
    {
      name: 'Iso Wasteland Walls 4\u00d72',
      spriteType: 'building',
      genre: 'Post-Apocalyptic',
      gridSize: '4x2',
      cols: 4, rows: 2,
      aspectRatio: '16:9',
      tileShape: 'square',
      cellLabels: ['Wall Left','Wall Upper','Corner Upper-Left (Upper)','Corner Upper-Left (Left)',
                   'Corner Upper-Right','Corner Lower-Left','Corner Lower-Right','Pillar'],
      genericGuidance: `Isometric wall tile set for post-apocalyptic structures. Each cell shows a wall segment from isometric perspective. Walls are drawn as tall, thin structures viewed at the standard isometric angle.

WALL DRAWING RULES:
- Each wall segment has consistent height (roughly 1.5x the base diamond width)
- Left-facing walls show the left surface, upper-facing walls show the upper surface
- Corner pieces combine two wall surfaces meeting at a corner
- Maintain consistent brick/concrete/rebar texture with weathering and damage
- Use rubble and debris at wall bases
- Consistent lighting from top-left: left walls are lit, upper walls are shadowed

WALL TYPES:
- Wall Left: Straight wall segment facing left (camera-left surface visible)
- Wall Upper: Straight wall segment facing upper (camera-upper surface visible)
- Corners: L-shaped wall pieces showing two surfaces meeting
- Pillar: Freestanding column/support pillar, visible from all sides`,
    },
    {
      name: 'Iso Hive Walls 4\u00d72',
      spriteType: 'building',
      genre: 'Sci-Fi Horror',
      gridSize: '4x2',
      cols: 4, rows: 2,
      aspectRatio: '16:9',
      tileShape: 'square',
      cellLabels: ['Wall Left','Wall Upper','Corner Upper-Left (Upper)','Corner Upper-Left (Left)',
                   'Corner Upper-Right','Corner Lower-Left','Corner Lower-Right','Pillar'],
      genericGuidance: `Isometric wall tile set for alien hive structures. Each cell shows an organic wall segment from isometric perspective. Walls are grown structures of hardened resin and chitin.

WALL DRAWING RULES:
- Each wall segment has consistent height (roughly 1.5x the base diamond width)
- Left-facing walls show the left surface, upper-facing walls show the upper surface
- Corner pieces combine two wall surfaces meeting at a corner
- Use organic textures: ribbed chitin, translucent resin patches, embedded cocoons
- Bioluminescent veins run along wall surfaces providing dim green/purple light
- Consistent lighting from internal bioluminescence plus dim top-left ambient

WALL TYPES:
- Wall Left: Straight organic wall facing left with visible ribbing and vein patterns
- Wall Upper: Straight organic wall facing upper, slightly more shadowed
- Corners: L-shaped organic wall pieces with thicker growth at the junction
- Pillar: Freestanding organic column with spiral ribbing and luminous node at top`,
    },
    // Character grids (8-direction animation)
    {
      name: 'Iso Walk Cycle 8\u00d76',
      spriteType: 'character',
      genre: 'Isometric',
      gridSize: '8x6',
      cols: 8, rows: 6,
      aspectRatio: '16:9',
      tileShape: 'square',
      cellLabels: [
        'S Frame 1','S Frame 2','S Frame 3','S Frame 4','S Frame 5','S Frame 6','S Frame 7','S Frame 8',
        'SW Frame 1','SW Frame 2','SW Frame 3','SW Frame 4','SW Frame 5','SW Frame 6','SW Frame 7','SW Frame 8',
        'W Frame 1','W Frame 2','W Frame 3','W Frame 4','W Frame 5','W Frame 6','W Frame 7','W Frame 8',
        'NW Frame 1','NW Frame 2','NW Frame 3','NW Frame 4','NW Frame 5','NW Frame 6','NW Frame 7','NW Frame 8',
        'N Frame 1','N Frame 2','N Frame 3','N Frame 4','N Frame 5','N Frame 6','N Frame 7','N Frame 8',
        'NE Frame 1','NE Frame 2','NE Frame 3','NE Frame 4','NE Frame 5','NE Frame 6','NE Frame 7','NE Frame 8',
      ],
      genericGuidance: `8-direction isometric walk cycle animation sheet. Each row is one direction, each column is one animation frame. 8 frames per direction for smooth looping walk animation.

ISOMETRIC PERSPECTIVE RULES:
- Camera angle is standard isometric (approx. 30 degrees from horizontal)
- Character proportions must remain perfectly consistent across all frames and directions
- S = facing camera (toward bottom of screen), N = facing away (toward top)
- SW = facing bottom-left, W = facing left, NW = facing top-left
- NE = facing top-right (can be horizontally mirrored from NW in-engine, but draw unique)
- E and SE directions omitted (mirrored from W and SW in-engine)

ANIMATION RULES:
- Frame 1 = contact pose (front foot touches ground)
- Frame 3 = passing pose (legs cross)
- Frame 5 = second contact pose (other foot)
- Frame 7 = second passing pose
- Frames 2,4,6,8 = in-between frames for smooth motion
- Arms swing opposite to legs
- Slight body bob (up on passing, down on contact)
- Each direction shows the character at the correct isometric angle for that direction`,
    },
    {
      name: 'Iso Attack Cycle 8\u00d74',
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
      genericGuidance: `8-direction isometric attack cycle animation sheet. 4 directions (S, SW, W, NW) with 8 frames each. Remaining directions can be mirrored in-engine.

ANIMATION RULES:
- Frame 1-2: Wind-up (weapon drawn back, weight shifting)
- Frame 3-4: Strike (weapon swinging forward, peak motion blur feel)
- Frame 5-6: Impact/follow-through (weapon extended, impact effect)
- Frame 7-8: Recovery (returning to ready stance)
- Maintain consistent character proportions and weapon across all frames
- Each direction shows the attack from the correct isometric angle
- Weapon trail or motion lines encouraged on frames 3-4`,
    },
    {
      name: 'Iso Idle Cycle 8\u00d74',
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
      genericGuidance: `8-direction isometric idle cycle animation sheet. 4 directions (S, SW, W, NW) with 8 frames each for a subtle breathing/shifting idle animation.

ANIMATION RULES:
- Subtle, looping idle animation (character standing in place)
- Frame 1: Base standing pose
- Frame 2-3: Slight chest expansion (breathing in)
- Frame 4: Peak inhale, slight weight shift
- Frame 5-6: Exhale, slight settle
- Frame 7-8: Return to base, possible subtle head turn or weapon adjustment
- Movement should be very subtle — only a few pixels of difference between frames
- Maintain consistent character proportions across all frames and directions
- Character should look alive but not actively moving`,
    },
    {
      name: 'Iso Death Sequence 8\u00d74',
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
      genericGuidance: `8-direction isometric death sequence animation sheet. 4 directions (S, SW, W, NW) with 8 frames each. This is a one-shot animation (not looping).

ANIMATION RULES:
- Frame 1: Hit reaction (flinching back from impact)
- Frame 2: Stagger (losing balance, weapon dropping)
- Frame 3: Knees buckling, beginning to fall
- Frame 4-5: Falling to ground
- Frame 6: Impact with ground
- Frame 7: Settling, final position
- Frame 8: Final death pose (lying still on ground, used as static corpse sprite)
- Weapon should be dropped/released by frame 3
- Each direction shows the fall from the correct isometric angle
- Final frame should work as a standalone static sprite`,
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
