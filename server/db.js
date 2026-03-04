import Database from 'better-sqlite3';
import { mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

let db;

export function getDb() {
  if (db) return db;

  const dataDir = join(__dirname, '..', 'data');
  mkdirSync(dataDir, { recursive: true });

  const dbPath = join(dataDir, 'grid-sprite.db');
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  createSchema(db);
  migrateSchema(db);
  seedGridPresets(db);
  seedPresets(db);
  seedBuildingPresets(db);
  seedTerrainPresets(db);
  seedBackgroundPresets(db);
  return db;
}

function createSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS generations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      character_name TEXT NOT NULL,
      character_description TEXT NOT NULL DEFAULT '',
      character_preset_id TEXT,
      custom_instructions TEXT DEFAULT '',
      model TEXT NOT NULL DEFAULT 'gemini-2.5-flash-image',
      prompt TEXT NOT NULL DEFAULT '',
      template_image TEXT NOT NULL DEFAULT '',
      filled_grid_image TEXT NOT NULL DEFAULT '',
      thumbnail_cell_index INTEGER DEFAULT NULL,
      thumbnail_image TEXT DEFAULT NULL,
      thumbnail_mime TEXT DEFAULT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sprites (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      generation_id INTEGER NOT NULL,
      cell_index INTEGER NOT NULL,
      pose_id TEXT NOT NULL,
      pose_name TEXT NOT NULL,
      image_data TEXT NOT NULL,
      mime_type TEXT NOT NULL DEFAULT 'image/png',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY(generation_id) REFERENCES generations(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_sprites_generation ON sprites(generation_id);

    CREATE TABLE IF NOT EXISTS editor_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      generation_id INTEGER NOT NULL UNIQUE,
      settings TEXT NOT NULL DEFAULT '{}',
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY(generation_id) REFERENCES generations(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_editor_settings_generation ON editor_settings(generation_id);

    CREATE TABLE IF NOT EXISTS app_state (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS character_presets (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      genre TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL DEFAULT '',
      equipment TEXT NOT NULL DEFAULT '',
      color_notes TEXT NOT NULL DEFAULT '',
      row_guidance TEXT NOT NULL DEFAULT '',
      is_preset INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS building_presets (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      genre TEXT NOT NULL DEFAULT '',
      grid_size TEXT NOT NULL DEFAULT '3x3',
      description TEXT NOT NULL DEFAULT '',
      details TEXT NOT NULL DEFAULT '',
      color_notes TEXT NOT NULL DEFAULT '',
      cell_labels TEXT NOT NULL DEFAULT '[]',
      cell_guidance TEXT NOT NULL DEFAULT '',
      is_preset INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

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
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS grid_presets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      sprite_type TEXT NOT NULL CHECK(sprite_type IN ('character','building','terrain','background')),
      genre TEXT DEFAULT '',
      grid_size TEXT NOT NULL,
      cols INTEGER NOT NULL,
      rows INTEGER NOT NULL,
      cell_labels TEXT NOT NULL DEFAULT '[]',
      cell_groups TEXT NOT NULL DEFAULT '[]',
      generic_guidance TEXT DEFAULT '',
      bg_mode TEXT DEFAULT NULL,
      is_preset INTEGER DEFAULT 1
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS character_grid_links (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      character_preset_id TEXT NOT NULL REFERENCES character_presets(id) ON DELETE CASCADE,
      grid_preset_id INTEGER NOT NULL REFERENCES grid_presets(id) ON DELETE CASCADE,
      guidance_override TEXT DEFAULT '',
      sort_order INTEGER DEFAULT 0,
      UNIQUE(character_preset_id, grid_preset_id)
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS building_grid_links (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      building_preset_id TEXT NOT NULL REFERENCES building_presets(id) ON DELETE CASCADE,
      grid_preset_id INTEGER NOT NULL REFERENCES grid_presets(id) ON DELETE CASCADE,
      guidance_override TEXT DEFAULT '',
      sort_order INTEGER DEFAULT 0,
      UNIQUE(building_preset_id, grid_preset_id)
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS terrain_grid_links (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      terrain_preset_id TEXT NOT NULL REFERENCES terrain_presets(id) ON DELETE CASCADE,
      grid_preset_id INTEGER NOT NULL REFERENCES grid_presets(id) ON DELETE CASCADE,
      guidance_override TEXT DEFAULT '',
      sort_order INTEGER DEFAULT 0,
      UNIQUE(terrain_preset_id, grid_preset_id)
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS background_grid_links (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      background_preset_id TEXT NOT NULL REFERENCES background_presets(id) ON DELETE CASCADE,
      grid_preset_id INTEGER NOT NULL REFERENCES grid_presets(id) ON DELETE CASCADE,
      guidance_override TEXT DEFAULT '',
      sort_order INTEGER DEFAULT 0,
      UNIQUE(background_preset_id, grid_preset_id)
    )
  `);
}

function migrateSchema(db) {
  const migrations = [
    'ALTER TABLE generations ADD COLUMN thumbnail_cell_index INTEGER DEFAULT NULL',
    'ALTER TABLE generations ADD COLUMN thumbnail_image TEXT DEFAULT NULL',
    'ALTER TABLE generations ADD COLUMN thumbnail_mime TEXT DEFAULT NULL',
    "ALTER TABLE generations ADD COLUMN sprite_type TEXT NOT NULL DEFAULT 'character'",
    "ALTER TABLE generations ADD COLUMN grid_size TEXT DEFAULT NULL",
  ];
  for (const sql of migrations) {
    try { db.exec(sql); } catch (_) { /* column already exists */ }
  }
}

function seedGridPresets(db) {
  const existing = db.prepare('SELECT COUNT(*) as count FROM grid_presets').get();
  if (existing.count > 0) return;

  const characterCellLabels = JSON.stringify([
    'Walk Down 1','Walk Down 2','Walk Down 3',
    'Walk Up 1','Walk Up 2','Walk Up 3',
    'Walk Left 1','Walk Left 2','Walk Left 3',
    'Walk Right 1','Walk Right 2','Walk Right 3',
    'Idle Down','Idle Up','Idle Left','Idle Right',
    'Battle Idle 1','Battle Idle 2',
    'Battle Idle 3',
    'Attack 1','Attack 2','Attack 3',
    'Cast 1','Cast 2',
    'Cast 3',
    'Damage 1','Damage 2','Damage 3',
    'KO 1','KO 2',
    'KO 3',
    'Victory 1','Victory 2','Victory 3',
    'Weak Pose','Critical Pose'
  ]);

  const characterCellGroups = JSON.stringify([
    { name: 'Walk Down', cells: [0,1,2] },
    { name: 'Walk Up', cells: [3,4,5] },
    { name: 'Walk Left', cells: [6,7,8] },
    { name: 'Walk Right', cells: [9,10,11] },
    { name: 'Idle Down', cells: [12] },
    { name: 'Idle Up', cells: [13] },
    { name: 'Idle Left', cells: [14] },
    { name: 'Idle Right', cells: [15] },
    { name: 'Battle Idle', cells: [16,17,18] },
    { name: 'Attack', cells: [19,20,21] },
    { name: 'Cast', cells: [22,23,24] },
    { name: 'Damage', cells: [25,26,27] },
    { name: 'KO', cells: [28,29,30] },
    { name: 'Victory', cells: [31,32,33] },
    { name: 'Weak', cells: [34] },
    { name: 'Critical', cells: [35] }
  ]);

  const rpgFullGuidance = `\
Each cell in the grid has a WHITE TEXT HEADER that names the pose. Match each
cell's sprite to the header label printed above it. The labels and their
required poses are listed below by row.

ROW 0 — Walk Down & Walk Up (top-down RPG overworld perspective):
  Header "Walk Down 1" (0,0): Character faces the camera, mid-stride with the
    left leg forward and right leg back. Arms swing naturally — left arm back,
    right arm forward. Torso faces directly toward the viewer.
  Header "Walk Down 2" (0,1): Contact pose — feet are together or nearly
    together as they pass each other. Weight is centered, arms at sides. This
    is the neutral mid-cycle frame between the two stride extremes.
  Header "Walk Down 3" (0,2): Mirror of Walk Down 1. Right leg forward, left
    leg back, arms reversed. Identical proportions and posture, just mirrored.
  Header "Walk Up 1" (0,3): Character faces AWAY from the camera showing their
    back. Left leg forward in stride, arms swinging naturally. Hair, cape, or
    backpack details visible from behind.
  Header "Walk Up 2" (0,4): Facing away, contact pose — feet together, arms at
    sides. Same neutral mid-cycle as Walk Down 2, but from the back.
  Header "Walk Up 3" (0,5): Facing away, right leg forward — mirror of Walk
    Up 1. Arms reversed. Same proportions, just the opposite stride.

ROW 1 — Walk Left & Walk Right (side-view overworld perspective):
  Header "Walk Left 1" (1,0): Character in side profile facing left. Left foot
    is forward in a full stride, right foot trails behind. Arms swing opposite
    to legs. Full body is visible in profile.
  Header "Walk Left 2" (1,1): Facing left, contact pose — feet passing each
    other, nearly together. Arms at sides. Neutral mid-cycle frame.
  Header "Walk Left 3" (1,2): Facing left, right foot forward. Mirror-stride
    of Walk Left 1. Arms reversed. Same height and proportions.
  Header "Walk Right 1" (1,3): Character in side profile facing right. Right
    foot forward in full stride, left foot trails. Arms swing naturally.
    This is the horizontal mirror of Walk Left 1.
  Header "Walk Right 2" (1,4): Facing right, contact pose — feet together,
    arms at sides. Neutral mid-cycle. Mirror of Walk Left 2.
  Header "Walk Right 3" (1,5): Facing right, left foot forward. Mirror-stride
    of Walk Right 1. Same height and proportions as all walk frames.

ROW 2 — Idle Stances & Battle Idle (first two frames):
  Header "Idle Down" (2,0): Relaxed standing pose facing the camera. Weight
    evenly distributed, arms resting naturally at sides. Calm, neutral facial
    expression. This is the default overworld resting pose.
  Header "Idle Up" (2,1): Relaxed standing pose facing away from the camera.
    Same relaxed posture as Idle Down, viewed from behind. Back, hair, and
    equipment details visible.
  Header "Idle Left" (2,2): Relaxed standing pose in left-facing profile.
    Weight centered, arms relaxed. Character looks to the left.
  Header "Idle Right" (2,3): Relaxed standing pose in right-facing profile.
    Horizontal mirror of Idle Left. Same posture, same proportions.
  Header "Battle Idle 1" (2,4): Combat-ready stance in side view. Slight
    crouch with knees bent, weapon raised or at the ready, off-hand guarding.
    Weight on the balls of the feet. Alert, tense expression.
  Header "Battle Idle 2" (2,5): Subtle breathing/sway frame — the character
    shifts weight slightly from Battle Idle 1. Weapon may tilt a degree,
    shoulders rise slightly. Small enough difference to animate a living
    idle when looped.

ROW 3 — Battle Idle 3, Attack Sequence, Cast Start:
  Header "Battle Idle 3" (3,0): Third frame of the battle idle sway. Character
    shifts back toward the Battle Idle 1 position. When looped 1→2→3→2, this
    creates a subtle breathing/ready animation.
  Header "Attack 1" (3,1): Wind-up — the character pulls their weapon or fist
    back behind them, body coiling with weight shifting to the rear foot.
    Torso twists to load the swing. Tense, focused expression.
  Header "Attack 2" (3,2): Mid-swing — weapon or fist sweeps forward in a
    powerful arc. Body uncoils, weight transfers to the front foot. Motion
    blur or streak effect is optional but must stay within the cell.
  Header "Attack 3" (3,3): Follow-through — weapon or fist is fully extended
    past the target point. Body is stretched forward, front foot planted.
    The apex of the strike.
  Header "Cast 1" (3,4): Casting begins — arms rise to chest or shoulder
    height, palms open. A small spark or glow starts forming between the
    hands. Feet are planted, body upright. Energy effect is small and
    contained close to the hands.
  Header "Cast 2" (3,5): Casting builds — arms spread wider, energy grows
    brighter between or around the hands. Eyes may glow. The character's
    posture leans slightly into the spell. Energy effect stays compact
    and well within the cell boundaries.

ROW 4 — Cast 3, Damage Sequence, KO Start:
  Header "Cast 3" (4,0): Spell release — arms thrust forward or upward, energy
    erupts outward from the hands. This is the peak of the cast. Any visible
    spell effect (fireball, lightning, rune) must be SMALL and stay fully
    contained within the cell — do not let it fill the cell or crowd edges.
  Header "Damage 1" (4,1): Hit recoil — the character flinches backward as if
    struck. Head snaps back, arms jerk inward. One foot lifts slightly off
    the ground. Pained expression, eyes squinting.
  Header "Damage 2" (4,2): Stagger — the character leans further back from
    the hit, nearly off-balance. Knees bend, arms flail. More intense pain
    on the face. Weight on the back foot.
  Header "Damage 3" (4,3): Recovery — the character catches themselves and
    stumbles forward, regaining balance. Arms come back to a guard position.
    Expression shifts from pain to determination. Transitioning back toward
    a ready stance.
  Header "KO 1" (4,4): Collapse begins — knees buckle, weapon drops or
    dangles. The character's upper body pitches forward and downward. Eyes
    closing, expression going slack. Clearly losing consciousness.
  Header "KO 2" (4,5): Falling — body hits the ground. Character is mostly
    horizontal, one arm may be outstretched breaking the fall. Weapon on the
    ground nearby. Nearly fully down.

ROW 5 — KO 3, Victory Sequence, Status Poses:
  Header "KO 3" (5,0): Fully down — the character lies flat on the ground,
    face-down or on their back, eyes closed. Weapon beside them. Completely
    defeated and motionless. Sprite should be horizontal and centered.
  Header "Victory 1" (5,1): Celebration starts — the character leaps upward
    with a fist pump or weapon thrust. Joyful expression, mouth open.
    Feet may leave the ground slightly. Energetic and triumphant.
  Header "Victory 2" (5,2): Mid-celebration — arms raised overhead in a
    victory gesture (V-sign, weapon held high, or both arms up). Big smile.
    Peak of the celebration motion. Feet back on the ground.
  Header "Victory 3" (5,3): Celebration ends — the character strikes a
    confident final pose. Hand on hip, weapon shouldered, or a cool
    stance. Satisfied grin. This is the held pose after the animation.
  Header "Weak Pose" (5,4): Low HP — the character hunches over with one knee
    on the ground, panting. One hand braces on the knee or the ground.
    Weapon drags. Expression is exhausted and strained. Sweat drops optional
    but must be small and stay in the cell.
  Header "Critical Pose" (5,5): Near death — the character barely stands,
    trembling. Leaning heavily on their weapon like a crutch, or doubled
    over. One eye may be shut. Expression is desperate and pained. On the
    edge of collapse but still fighting.`;

  const insertGrid = db.prepare(`
    INSERT INTO grid_presets (name, sprite_type, genre, grid_size, cols, rows, cell_labels, cell_groups, generic_guidance, bg_mode, is_preset)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
  `);

  insertGrid.run('RPG Full', 'character', 'RPG', '6x6', 6, 6, characterCellLabels, characterCellGroups, rpgFullGuidance, null);

  // --- Building grid presets ---
  // 3x3 building grid: 3 rows of 3 cells each (activity, damage, time-of-day or thematic variants)
  insertGrid.run('3x3 Building', 'building', 'General', '3x3', 3, 3,
    JSON.stringify([
      'Cell 1', 'Cell 2', 'Cell 3',
      'Cell 4', 'Cell 5', 'Cell 6',
      'Cell 7', 'Cell 8', 'Cell 9'
    ]),
    JSON.stringify([
      { name: 'Row 1', cells: [0,1,2] },
      { name: 'Row 2', cells: [3,4,5] },
      { name: 'Row 3', cells: [6,7,8] }
    ]),
    `Each cell in the grid has a WHITE TEXT HEADER that names the variant. Draw the same building in each cell but reflecting the variant described by its header label. Maintain consistent architecture, proportions, and style across all cells. Each row typically represents a thematic group (e.g., activity states, damage states, time of day).`,
    null
  );

  // 2x2 building grid: 4 states/variants
  insertGrid.run('2x2 Building', 'building', 'General', '2x2', 2, 2,
    JSON.stringify(['Cell 1', 'Cell 2', 'Cell 3', 'Cell 4']),
    JSON.stringify([
      { name: 'Row 1', cells: [0,1] },
      { name: 'Row 2', cells: [2,3] }
    ]),
    `Each cell in the grid has a WHITE TEXT HEADER that names the variant. Draw the same building in each cell but reflecting the variant described by its header label. Maintain consistent architecture, proportions, and style across all cells.`,
    null
  );

  // 2x3 building grid: 2 columns, 3 rows (6 states)
  insertGrid.run('2x3 Building', 'building', 'General', '2x3', 2, 3,
    JSON.stringify([
      'Cell 1', 'Cell 2',
      'Cell 3', 'Cell 4',
      'Cell 5', 'Cell 6'
    ]),
    JSON.stringify([
      { name: 'Row 1', cells: [0,1] },
      { name: 'Row 2', cells: [2,3] },
      { name: 'Row 3', cells: [4,5] }
    ]),
    `Each cell in the grid has a WHITE TEXT HEADER that names the variant. Draw the same building in each cell but reflecting the variant described by its header label. Maintain consistent architecture, proportions, and style across all cells. Each row typically represents a thematic group.`,
    null
  );

  // --- Terrain grid presets ---
  // 4x4 terrain tileset: 16 tiles (base tiles, paths, edges, corners)
  insertGrid.run('4x4 Terrain', 'terrain', 'General', '4x4', 4, 4,
    JSON.stringify([
      'Tile 1', 'Tile 2', 'Tile 3', 'Tile 4',
      'Tile 5', 'Tile 6', 'Tile 7', 'Tile 8',
      'Tile 9', 'Tile 10', 'Tile 11', 'Tile 12',
      'Tile 13', 'Tile 14', 'Tile 15', 'Tile 16'
    ]),
    JSON.stringify([
      { name: 'Base Tiles', cells: [0,1,2,3] },
      { name: 'Path Tiles', cells: [4,5,6,7] },
      { name: 'Edge Tiles', cells: [8,9,10,11] },
      { name: 'Corner Tiles', cells: [12,13,14,15] }
    ]),
    `Each cell in the grid has a WHITE TEXT HEADER naming the tile type. All tiles must share the same art style, color palette, and scale. Tiles in each row form a thematic group (base variants, paths, edges, corners). Edge and corner tiles must seamlessly connect with adjacent base tiles.`,
    null
  );

  // 3x3 terrain tileset: 9 tiles
  insertGrid.run('3x3 Terrain', 'terrain', 'General', '3x3', 3, 3,
    JSON.stringify([
      'Tile 1', 'Tile 2', 'Tile 3',
      'Tile 4', 'Tile 5', 'Tile 6',
      'Tile 7', 'Tile 8', 'Tile 9'
    ]),
    JSON.stringify([
      { name: 'Row 1', cells: [0,1,2] },
      { name: 'Row 2', cells: [3,4,5] },
      { name: 'Row 3', cells: [6,7,8] }
    ]),
    `Each cell in the grid has a WHITE TEXT HEADER naming the tile type. All tiles must share the same art style, color palette, and scale. Edge tiles must seamlessly connect with adjacent base tiles. Each row represents a thematic group.`,
    null
  );

  // 5x5 terrain tileset: 25 tiles (large set with base, roots, clearings, paths, edges)
  insertGrid.run('5x5 Terrain', 'terrain', 'General', '5x5', 5, 5,
    JSON.stringify([
      'Tile 1', 'Tile 2', 'Tile 3', 'Tile 4', 'Tile 5',
      'Tile 6', 'Tile 7', 'Tile 8', 'Tile 9', 'Tile 10',
      'Tile 11', 'Tile 12', 'Tile 13', 'Tile 14', 'Tile 15',
      'Tile 16', 'Tile 17', 'Tile 18', 'Tile 19', 'Tile 20',
      'Tile 21', 'Tile 22', 'Tile 23', 'Tile 24', 'Tile 25'
    ]),
    JSON.stringify([
      { name: 'Row 1', cells: [0,1,2,3,4] },
      { name: 'Row 2', cells: [5,6,7,8,9] },
      { name: 'Row 3', cells: [10,11,12,13,14] },
      { name: 'Row 4', cells: [15,16,17,18,19] },
      { name: 'Row 5', cells: [20,21,22,23,24] }
    ]),
    `Each cell in the grid has a WHITE TEXT HEADER naming the tile type. All tiles must share the same art style, color palette, and scale. Edge and corner tiles must seamlessly connect with adjacent base tiles. Each row represents a thematic group.`,
    null
  );

  // --- Background grid presets ---
  // 1x4 parallax: 4 vertical layers (farthest to nearest)
  insertGrid.run('1x4 Parallax', 'background', 'General', '1x4', 1, 4,
    JSON.stringify(['Far Background', 'Mid Background', 'Near Background', 'Foreground']),
    JSON.stringify([
      { name: 'All Layers', cells: [0,1,2,3] }
    ]),
    `LAYER ORDER (top to bottom, farthest to nearest): Each cell is one parallax layer. Draw each layer so it tiles horizontally. Layers stack vertically — the top cell is the farthest background, the bottom cell is the nearest foreground. Maintain consistent color palette and art style across all layers. Each layer must fill its ENTIRE cell with no magenta visible.`,
    'parallax'
  );

  // 1x5 parallax: 5 vertical layers
  insertGrid.run('1x5 Parallax', 'background', 'General', '1x5', 1, 5,
    JSON.stringify(['Far Sky', 'Distant Background', 'Mid Background', 'Near Background', 'Foreground']),
    JSON.stringify([
      { name: 'All Layers', cells: [0,1,2,3,4] }
    ]),
    `LAYER ORDER (top to bottom, farthest to nearest): Each cell is one parallax layer. Draw each layer so it tiles horizontally. Layers stack vertically — the top cell is the farthest background, the bottom cell is the nearest foreground. Maintain consistent color palette and art style across all layers. Each layer must fill its ENTIRE cell with no magenta visible.`,
    'parallax'
  );

  // 1x3 parallax: 3 vertical layers
  insertGrid.run('1x3 Parallax', 'background', 'General', '1x3', 1, 3,
    JSON.stringify(['Background', 'Midground', 'Foreground']),
    JSON.stringify([
      { name: 'All Layers', cells: [0,1,2] }
    ]),
    `LAYER ORDER (top to bottom, farthest to nearest): Each cell is one parallax layer. Draw each layer so it tiles horizontally. Layers stack vertically — the top cell is the farthest background, the bottom cell is the nearest foreground. Maintain consistent color palette and art style across all layers. Each layer must fill its ENTIRE cell with no magenta visible.`,
    'parallax'
  );

  // 3x2 scene: 6 scene variants in a 3-column, 2-row grid
  insertGrid.run('3x2 Scene', 'background', 'General', '3x2', 3, 2,
    JSON.stringify([
      'Variant 1', 'Variant 2', 'Variant 3',
      'Variant 4', 'Variant 5', 'Variant 6'
    ]),
    JSON.stringify([
      { name: 'Row 1', cells: [0,1,2] },
      { name: 'Row 2', cells: [3,4,5] }
    ]),
    `Each cell in the grid has a WHITE TEXT HEADER naming the scene variant. Draw the same scene/environment in each cell but reflecting the condition described by its header label (e.g., different weather, time of day, or supernatural state). Maintain consistent composition, landmark placement, and art style across all cells. Each cell must fill its ENTIRE area with no magenta visible.`,
    'scene'
  );

  // 2x2 scene: 4 scene variants
  insertGrid.run('2x2 Scene', 'background', 'General', '2x2', 2, 2,
    JSON.stringify(['Variant 1', 'Variant 2', 'Variant 3', 'Variant 4']),
    JSON.stringify([
      { name: 'Row 1', cells: [0,1] },
      { name: 'Row 2', cells: [2,3] }
    ]),
    `Each cell in the grid has a WHITE TEXT HEADER naming the scene variant. Draw the same scene/environment in each cell but reflecting the condition described by its header label. Maintain consistent composition, landmark placement, and art style across all cells. Each cell must fill its ENTIRE area with no magenta visible.`,
    'scene'
  );

  console.log('[DB] Seeded grid presets for all sprite types.');
}

function seedPresets(db) {
  const PRESETS = [
    {
      id: 'cecil-paladin',
      name: "Cecil the Paladin",
      genre: "Classic Fantasy",
      description: "A noble paladin with shoulder-length silver-white hair, strong jawline, and piercing blue eyes. Medium athletic build. Stands with confident, upright posture.",
      equipment: "Ornate white-and-gold plate armor with a blue cape, wielding a holy longsword with a glowing blade. Shield with a sun emblem on his back.",
      colorNotes: "Silver-white hair, blue eyes. White and gold armor with blue accents. Cape is royal blue with gold trim.",
      rowGuidance: `ROW 0 — Walk Down & Walk Up:
  Header "Walk Down 1" (0,0): Cecil strides forward with his left foot leading, holy longsword held at his right side and blue cape swaying to the right. His silver-white hair shifts slightly with the step.
  Header "Walk Down 2" (0,1): Cecil stands in a neutral mid-step contact pose with feet together, cape hanging straight and sword arm relaxed at his side. His blue eyes look directly ahead.
  Header "Walk Down 3" (0,2): Mirror of Walk Down 1 — right foot leads forward, cape swaying to the left, sword at his left side. Silver-white hair shifts in the opposite direction.
  Header "Walk Up 1" (0,3): Cecil faces away from the viewer with his left foot forward, the royal blue cape and sun-emblem shield dominating the back view. Gold trim on the cape catches the light.
  Header "Walk Up 2" (0,4): Neutral mid-step facing away, feet together, cape draping straight down over the shield. The gold-and-white armor plating is visible on his shoulders.
  Header "Walk Up 3" (0,5): Mirror of Walk Up 1 — right foot forward facing away, cape swaying to the opposite side. The shield and fold of the cape flow with his stride.

ROW 1 — Walk Left & Walk Right:
  Header "Walk Left 1" (1,0): Cecil faces left with his left foot forward, longsword in his leading hand pointing slightly ahead. The shield on his back is visible and the cape trails behind him.
  Header "Walk Left 2" (1,1): Neutral contact pose facing left, feet aligned, sword arm relaxed at his side. The blue cape hangs naturally and his silver-white hair frames his profile.
  Header "Walk Left 3" (1,2): Mirror of Walk Left 1 — right foot leads while facing left, sword position reversed. Cape swings forward slightly with the stride.
  Header "Walk Right 1" (1,3): Cecil faces right with his right foot forward, longsword extended ahead in his leading hand. The blue cape trails behind and the gold armor trim glints.
  Header "Walk Right 2" (1,4): Neutral contact pose facing right, feet together, cape draping naturally. His strong jawline and determined expression are visible in profile.
  Header "Walk Right 3" (1,5): Mirror of Walk Right 1 — left foot leads while facing right, cape swinging forward slightly. Sword arm trails behind.

ROW 2 — Idle & Battle Idle:
  Header "Idle Down" (2,0): Cecil stands relaxed facing the viewer, longsword held loosely at his right side with the blade pointing down. Cape drapes naturally and his expression is calm and noble.
  Header "Idle Up" (2,1): Relaxed standing pose facing away, cape and shield filling the view. His silver-white hair rests on his shoulders above the blue cape.
  Header "Idle Left" (2,2): Cecil faces left in a relaxed stance, sword visible at his side, weight evenly distributed. His left hand rests near his belt.
  Header "Idle Right" (2,3): Relaxed facing right, the blue cape flowing gently. His right hand holds the sword loosely and the gold-trimmed armor catches ambient light.
  Header "Battle Idle 1" (2,4): Cecil drops into a combat-ready crouch, sword raised at mid-guard and shield arm braced forward. A faint holy glow emanates from the blade.
  Header "Battle Idle 2" (2,5): Slight sway in his battle stance, the holy glow on the longsword intensifying briefly. Cape billows slightly as he shifts his weight between feet.

ROW 3 — Battle Idle 3, Attack, Cast Start:
  Header "Battle Idle 3" (3,0): Cecil holds his battle stance firmly, cape billowing behind him, sword gleaming with holy light. His piercing blue eyes are locked forward in concentration.
  Header "Attack 1" (3,1): Wind-up pose — Cecil pulls the holy longsword back over his right shoulder, body coiled and weight shifting to his back foot. The cape wraps slightly around his torso.
  Header "Attack 2" (3,2): Mid-swing — the holy sword slashes forward in a diagonal arc, a small trail of white-gold light following the blade. His body rotates into the strike.
  Header "Attack 3" (3,3): Follow-through — sword fully extended forward, a small burst of holy light erupting at the blade tip. The cape flies outward from the rotational force.
  Header "Cast 1" (3,4): Cecil raises the longsword overhead with both hands, blade pointing skyward. Small motes of white holy energy begin gathering around the blade.
  Header "Cast 2" (3,5): His eyes glow faintly white as a small pillar of holy light forms around the raised sword. The cape lifts slightly from the energy.

ROW 4 — Cast 3, Damage, KO Start:
  Header "Cast 3" (4,0): The holy spell releases — a small burst of divine light erupts from the sword, cape billowing upward from the energy. His armor glows briefly with golden radiance.
  Header "Damage 1" (4,1): Cecil flinches backward from a hit, raising his left arm defensively while the shield catches impact. His expression shows pain through gritted teeth.
  Header "Damage 2" (4,2): Staggering back further, Cecil leans away with a dent visible in his shoulder armor. His cape whips forward from the force of the blow.
  Header "Damage 3" (4,3): Recovery pose — Cecil plants the longsword tip into the ground for balance, pushing himself back to standing. His cape settles behind him.
  Header "KO 1" (4,4): His knees buckle as his grip on the sword loosens. His head drops and the holy glow on the blade fades. The shield slides off his back.
  Header "KO 2" (4,5): Falling — his body hits the ground on one side, cape spreading beneath him. The longsword slips from his fingers.

ROW 5 — KO 3, Victory, Status Poses:
  Header "KO 3" (5,0): Cecil lies fully on the ground, longsword beside his body and cape draped partially over his face. The holy glow has completely faded from his equipment.
  Header "Victory 1" (5,1): Cecil raises the holy longsword triumphantly overhead with one hand, cape flowing behind him. The blade pulses with renewed holy light.
  Header "Victory 2" (5,2): Sword held high, small holy sparkles erupt around Cecil as the cape billows dramatically. His expression is one of righteous satisfaction.
  Header "Victory 3" (5,3): Cecil plants the longsword into the ground before him and crosses his arms, standing confidently. The cape drapes regally and the blade still faintly glows.
  Header "Weak Pose" (5,4): Cecil kneels on one knee using the longsword as a crutch, panting with visible exhaustion. His armor is scuffed and the cape is torn at the edges.
  Header "Critical Pose" (5,5): Desperate last stand — Cecil barely stands with cracked armor plates, the holy aura around his sword flickering weakly. His blue eyes burn with defiant resolve.`,
    },
    {
      id: 'vivienne-scholar',
      name: "Vivienne the Scholar",
      genre: "Classic Fantasy",
      description: "A studious mage with chin-length dark auburn hair, round spectacles, and warm brown eyes. Petite frame with a thoughtful expression and slightly hunched scholarly posture.",
      equipment: "Flowing purple robes with gold embroidered runes, carrying a thick leather-bound tome in one hand and a crystal-topped staff in the other. A satchel of scrolls at her hip.",
      colorNotes: "Dark auburn hair, brown eyes. Deep purple robes with gold trim and rune patterns. Staff crystal is pale violet. Book is brown leather with gold clasps.",
      rowGuidance: `ROW 0 — Walk Down & Walk Up:
  Header "Walk Down 1" (0,0): Vivienne steps forward with her left foot, the leather-bound tome tucked securely under her left arm and the crystal staff in her right hand. Her purple robes swish to the right.
  Header "Walk Down 2" (0,1): Neutral mid-step contact pose with feet together, spectacles catching a glint of light. The staff rests upright at her side and the tome is held against her chest.
  Header "Walk Down 3" (0,2): Mirror of Walk Down 1 — right foot forward, robes swishing to the left. The satchel of scrolls at her hip bounces gently with the step.
  Header "Walk Up 1" (0,3): Vivienne faces away, the scroll satchel visible at her hip and the gold rune embroidery on the back of her robes on full display. Left foot leads forward.
  Header "Walk Up 2" (0,4): Neutral mid-step facing away, feet together. The gold-embroidered rune patterns on her purple robes are clearly visible across her back.
  Header "Walk Up 3" (0,5): Mirror of Walk Up 1 — right foot forward facing away, satchel swinging slightly. The pale violet crystal atop her staff glows softly.

ROW 1 — Walk Left & Walk Right:
  Header "Walk Left 1" (1,0): Vivienne faces left with her left foot forward, tome held close to her chest and crystal staff extended slightly ahead. The scroll satchel bounces at her far hip.
  Header "Walk Left 2" (1,1): Neutral contact pose facing left, feet aligned. Her chin-length auburn hair sways gently and the staff rests upright beside her.
  Header "Walk Left 3" (1,2): Mirror of Walk Left 1 — right foot leads while facing left, robes swaying forward. The staff crystal pulses with a faint violet light.
  Header "Walk Right 1" (1,3): Vivienne faces right with her right foot forward, crystal staff leading the way with a soft glow. The tome is tucked under her trailing arm.
  Header "Walk Right 2" (1,4): Neutral contact pose facing right, spectacles visible in profile. Her petite frame and slightly hunched scholarly posture are evident.
  Header "Walk Right 3" (1,5): Mirror of Walk Right 1 — left foot leads while facing right, robes trailing. The satchel of scrolls sways with her stride.

ROW 2 — Idle & Battle Idle:
  Header "Idle Down" (2,0): Vivienne stands facing the viewer reading her tome absently, staff resting on her right shoulder. Her spectacles sit low on her nose and her expression is absorbed in thought.
  Header "Idle Up" (2,1): Facing away, the back of her purple robes with gold rune embroidery fills the view. The staff leans against her shoulder and the satchel hangs at her hip.
  Header "Idle Left" (2,2): Vivienne faces left in a relaxed stance, one finger holding her place in the open tome. The staff rests in the crook of her arm.
  Header "Idle Right" (2,3): Facing right, she holds the staff loosely with the crystal end tilted forward. The tome is tucked under her other arm, gold clasps catching light.
  Header "Battle Idle 1" (2,4): Vivienne snaps to attention — the tome floats open before her and the staff is raised with its crystal glowing bright violet. Small arcane symbols drift around her.
  Header "Battle Idle 2" (2,5): The tome pages flip magically on their own as the staff crystal pulses with intensifying violet light. Her auburn hair lifts slightly from the arcane energy.

ROW 3 — Battle Idle 3, Attack, Cast Start:
  Header "Battle Idle 3" (3,0): Vivienne pushes her spectacles up with one finger, settling into a ready stance. The floating tome hovers at her side and the staff crystal hums with energy.
  Header "Attack 1" (3,1): Wind-up — Vivienne pulls the staff back with both hands as the tome snaps shut and tucks itself under her arm. Her weight shifts to her back foot.
  Header "Attack 2" (3,2): Vivienne sweeps the staff forward in an arc, the crystal releasing a small burst of violet arcane energy. Her robes flare outward from the motion.
  Header "Attack 3" (3,3): Follow-through — a compact violet energy blast erupts from the crystal tip as the staff extends fully. Small arcane glyphs shimmer in the blast trail.
  Header "Cast 1" (3,4): The tome floats open before Vivienne, pages glowing. She raises both hands, fingers splayed, as a small circle of golden runes forms around her.
  Header "Cast 2" (3,5): A larger spell circle materializes as her auburn hair floats upward from the magical current. The tome pages turn rapidly and the rune circle spins.

ROW 4 — Cast 3, Damage, KO Start:
  Header "Cast 3" (4,0): The spell releases — a focused beam of violet light shoots from the floating tome as the rune circle collapses inward. Her robes billow from the energy discharge.
  Header "Damage 1" (4,1): Vivienne flinches from a hit, spectacles knocked askew on her face. She clutches the tome protectively to her chest while the staff wavers in her grip.
  Header "Damage 2" (4,2): Staggering backward, a few scrolls spill from her satchel. Her spectacles hang crooked and her expression shows alarm. The staff crystal flickers.
  Header "Damage 3" (4,3): Recovery — Vivienne steadies herself, pushing her spectacles back into place with a trembling hand. She pulls the tome closer and the staff crystal stabilizes.
  Header "KO 1" (4,4): Vivienne collapses forward, curling protectively over the tome. The staff slips from her hand and the crystal dims. Scrolls scatter from the satchel.
  Header "KO 2" (4,5): Falling to her side, Vivienne hugs the tome to her chest. Her spectacles slide off her face and the staff rolls away, crystal going dark.

ROW 5 — KO 3, Victory, Status Poses:
  Header "KO 3" (5,0): Vivienne lies on the ground using the closed tome as a pillow, spectacles fallen beside her face. The staff lies nearby with its crystal completely dim.
  Header "Victory 1" (5,1): Vivienne adjusts her spectacles with a satisfied, slightly smug smile. The tome snaps shut in her hand with a decisive thump.
  Header "Victory 2" (5,2): She raises the staff overhead, the crystal erupting with violet sparkles. The tome floats beside her spinning gently in celebration.
  Header "Victory 3" (5,3): Vivienne tucks the tome under her arm and pushes her spectacles up confidently, staff planted at her side. A few arcane glyphs orbit her like fireflies.
  Header "Weak Pose" (5,4): Vivienne leans heavily on her staff for support, the crystal barely glowing. The tome is clutched tightly to her chest and she pants through parted lips.
  Header "Critical Pose" (5,5): Barely standing, Vivienne holds the open tome before her as its pages swirl protectively in a defensive barrier. Her spectacles are cracked and the staff crystal sputters.`,
    },
    {
      id: 'kael-thornwood',
      name: "Kael Thornwood",
      genre: "Classic Fantasy",
      description: "A lithe elven ranger with long braided golden hair, pointed ears, and sharp green eyes. Lean athletic build with graceful, balanced stance.",
      equipment: "Supple forest-green leather armor with a brown hooded cloak, carrying an elegant longbow across his back and a quiver of silver-tipped arrows. A hunting knife at his belt.",
      colorNotes: "Golden blonde hair, bright green eyes. Forest-green leather with brown cloak and belt. Bow is pale wood with silver inlay. Arrow fletching is emerald green.",
      rowGuidance: `ROW 0 — Walk Down & Walk Up:
  Header "Walk Down 1" (0,0): Kael steps forward on his left foot with a light elven stride, the brown cloak swaying gently to the right. The longbow across his back and quiver of silver-tipped arrows are visible over his shoulder.
  Header "Walk Down 2" (0,1): Neutral mid-step contact pose, feet together, cloak draping naturally. His sharp green eyes look ahead and his braided golden hair hangs over one shoulder.
  Header "Walk Down 3" (0,2): Mirror of Walk Down 1 — right foot leads, cloak swaying left. The emerald-green arrow fletching peeks from the quiver and the hunting knife glints at his belt.
  Header "Walk Up 1" (0,3): Kael faces away with left foot forward, the brown cloak and quiver dominating the back view. His braided golden hair runs down the center of his back.
  Header "Walk Up 2" (0,4): Neutral mid-step facing away, feet together. The pale wood longbow with silver inlay is clearly visible strapped across his back over the cloak.
  Header "Walk Up 3" (0,5): Mirror of Walk Up 1 — right foot forward facing away, cloak swishing. The quiver of emerald-fletched arrows sways with his movement.

ROW 1 — Walk Left & Walk Right:
  Header "Walk Left 1" (1,0): Kael faces left with his left foot forward in a silent, graceful step. The longbow is visible on his back, hunting knife at his belt, and his pointed ears peek through golden hair.
  Header "Walk Left 2" (1,1): Neutral contact pose facing left, weight balanced. His lean silhouette shows the forest-green leather armor and the cloak trailing behind.
  Header "Walk Left 3" (1,2): Mirror of Walk Left 1 — right foot leads while facing left, cloak swaying forward. His braided hair trails behind his pointed ear.
  Header "Walk Right 1" (1,3): Kael faces right with his right foot forward, braided golden hair trailing behind him. The brown cloak flows back and the quiver is visible on his far side.
  Header "Walk Right 2" (1,4): Neutral contact pose facing right, his lean athletic profile visible. The silver inlay on the longbow catches light against the cloak.
  Header "Walk Right 3" (1,5): Mirror of Walk Right 1 — left foot leads while facing right, cloak trailing. His sharp green eyes scan ahead and his pointed ear is prominent.

ROW 2 — Idle & Battle Idle:
  Header "Idle Down" (2,0): Kael stands in a calm watchful stance facing the viewer, right hand resting near the hunting knife at his belt. His pointed ears are alert and his green eyes scan the surroundings.
  Header "Idle Up" (2,1): Relaxed facing away, the cloak draped over his shoulders and the longbow and quiver visible. His braided golden hair rests along his spine.
  Header "Idle Left" (2,2): Facing left in a relaxed stance, one hand touching the bow strap on his shoulder. His elven features are visible in profile with pointed ear prominent.
  Header "Idle Right" (2,3): Facing right, Kael stands casually with his hand near the quiver. The brown cloak shifts slightly in an ambient breeze.
  Header "Battle Idle 1" (2,4): Kael crouches low with the longbow drawn and a silver-tipped arrow nocked, eyes narrowed in focus. The cloak is pulled back to free his arms.
  Header "Battle Idle 2" (2,5): Slight sway in his crouched archer stance, the bowstring taut. He scans for targets, the arrowhead glinting with silver.

ROW 3 — Battle Idle 3, Attack, Cast Start:
  Header "Battle Idle 3" (3,0): Kael holds the drawn bow steady, the silver arrow tip glinting. The bowstring is taut and his braided hair hangs over his shoulder, cloak pulled aside.
  Header "Attack 1" (3,1): Kael draws the bow fully back, pulling the silver-tipped arrow to his cheek. His green eyes narrow with precision and his body coils with tension.
  Header "Attack 2" (3,2): The arrow releases — a silver streak trails from the bow as his fingers snap open. The bowstring vibrates and a small flash marks the departure.
  Header "Attack 3" (3,3): Follow-through — bow arm fully extended, fingers still open from the release. The silver arrow is a small streak at the edge of the cell, cloak blown back.
  Header "Cast 1" (3,4): Kael reaches into his quiver and draws a special arrow wreathed in small green nature energy. Tiny vines spiral around the arrowhead as he nocks it.
  Header "Cast 2" (3,5): The enchanted arrow is drawn back, swirling with green nature magic. Small leaves and thorn fragments orbit the arrowhead and his green eyes glow faintly.

ROW 4 — Cast 3, Damage, KO Start:
  Header "Cast 3" (4,0): The enchanted arrow releases, trailing a small burst of vines and thorns. A compact explosion of green nature energy marks the impact point ahead of his bow arm.
  Header "Damage 1" (4,1): Kael stumbles backward from a hit, his cloak torn at the edge. The bow wavers in his grip and a few arrows spill from the disturbed quiver.
  Header "Damage 2" (4,2): Staggering further, Kael clutches his side with his bow hand. His braided hair is disheveled and the cloak is partially ripped.
  Header "Damage 3" (4,3): Recovery — Kael steadies himself on one knee, drawing a fresh arrow from the quiver. His expression is pained but determined, green eyes still sharp.
  Header "KO 1" (4,4): The longbow slips from his loosening grip as his knees buckle. His golden braid falls across his face and the quiver tilts, spilling arrows.
  Header "KO 2" (4,5): Kael falls onto his side, the bow clattering beside him. His cloak spreads around his body and arrows scatter on the ground.

ROW 5 — KO 3, Victory, Status Poses:
  Header "KO 3" (5,0): Kael lies on the ground wrapped in his brown cloak like a blanket, the longbow resting beside him. His braided hair spills across the ground and his eyes are closed.
  Header "Victory 1" (5,1): Kael spins a silver-tipped arrow between his fingers with a confident smirk, the longbow resting on his shoulder. His green eyes gleam with satisfaction.
  Header "Victory 2" (5,2): He tosses the arrow into the air and catches it deftly, his braided hair swinging. The cloak billows behind him in a dramatic pose.
  Header "Victory 3" (5,3): Kael slings the bow over his shoulder and crosses his arms, smirking with elven grace. A few emerald-fletched arrows remain in his quiver.
  Header "Weak Pose" (5,4): Kael uses the longbow as a crutch to stay upright, panting heavily. His cloak is tattered, the quiver nearly empty, and his green eyes are weary.
  Header "Critical Pose" (5,5): Barely standing, Kael draws his last silver-tipped arrow with trembling hands. His aim wavers but his jaw is set with elven determination.`,
    },
    {
      id: 'chrono-blade',
      name: "Chrono Blade",
      genre: "Sci-Fantasy",
      description: "A time-traveling swordsman with spiky dark blue hair, a determined gaze, and a glowing temporal sigil on his forehead. Athletic build with a dynamic, forward-leaning combat stance.",
      equipment: "Sleek silver-gray light armor with crimson accents, a flowing red scarf that trails behind him, and a gleaming katana with a clock-gear guard. A small chrono-device on his left wrist.",
      colorNotes: "Dark blue spiky hair, amber eyes. Silver-gray armor with red accents and scarf. Katana blade has a faint blue temporal glow. Wrist device pulses cyan.",
      rowGuidance: `ROW 0 — Walk Down & Walk Up:
  Header "Walk Down 1" (0,0): Chrono Blade steps forward on his left foot, the red scarf trailing dynamically to the right. His katana is sheathed at his left hip and the chrono-device on his wrist pulses with faint cyan light.
  Header "Walk Down 2" (0,1): Neutral mid-step contact pose, feet together. His spiky dark blue hair frames the glowing temporal sigil on his forehead. The red scarf settles momentarily.
  Header "Walk Down 3" (0,2): Mirror of Walk Down 1 — right foot forward, scarf trailing to the left. The clock-gear guard on the sheathed katana is visible at his hip.
  Header "Walk Up 1" (0,3): Facing away with left foot forward, the long red scarf streams behind him prominently. The silver-gray armor with crimson accents covers his back and the katana hilt protrudes at his hip.
  Header "Walk Up 2" (0,4): Neutral mid-step facing away, scarf hanging straight. The crimson accents on his silver-gray armor form angular lines across his back.
  Header "Walk Up 3" (0,5): Mirror of Walk Up 1 — right foot forward facing away, scarf streaming to the opposite side. The chrono-device is barely visible on his trailing wrist.

ROW 1 — Walk Left & Walk Right:
  Header "Walk Left 1" (1,0): Chrono Blade faces left with his left foot forward in a brisk stride. The katana hilt juts forward at his hip and the red scarf trails behind his athletic frame.
  Header "Walk Left 2" (1,1): Neutral contact pose facing left, his profile showing the temporal sigil glowing on his forehead. The chrono-device on his near wrist pulses cyan.
  Header "Walk Left 3" (1,2): Mirror of Walk Left 1 — right foot leads while facing left, scarf swinging forward. His spiky dark blue hair sweeps back with the motion.
  Header "Walk Right 1" (1,3): Facing right with right foot forward, katana hilt trailing behind his hip. The red scarf flows dynamically behind him and amber eyes look ahead with determination.
  Header "Walk Right 2" (1,4): Neutral contact pose facing right, feet together. The silver-gray armor crimson accent lines are visible along his side. The temporal sigil glows softly.
  Header "Walk Right 3" (1,5): Mirror of Walk Right 1 — left foot leads while facing right, scarf whipping behind. The chrono-device on his far wrist flashes briefly.

ROW 2 — Idle & Battle Idle:
  Header "Idle Down" (2,0): Chrono Blade stands facing the viewer with his right hand resting on the sheathed katana hilt, scarf drifting lazily. His amber eyes are watchful and the temporal sigil glows faintly.
  Header "Idle Up" (2,1): Facing away, the red scarf drapes down his back over the silver-gray armor. The katana sheath is visible at his left hip and his spiky hair silhouettes against the background.
  Header "Idle Left" (2,2): Facing left in a relaxed stance, hand on katana hilt. His lean profile shows the temporal sigil and the chrono-device glows steadily on his wrist.
  Header "Idle Right" (2,3): Facing right, scarf drifting gently behind him. His right hand rests casually on the clock-gear katana guard, amber eyes scanning ahead.
  Header "Battle Idle 1" (2,4): Chrono Blade draws the katana in a forward-leaning iaido stance, the blade emanating a faint blue temporal glow. A small afterimage trails behind his leading shoulder.
  Header "Battle Idle 2" (2,5): He shifts weight in his battle stance, the temporal sigil blazing brighter. A small translucent afterimage of his previous position lingers briefly beside him.

ROW 3 — Battle Idle 3, Attack, Cast Start:
  Header "Battle Idle 3" (3,0): Chrono Blade holds the drawn katana low and forward, blade glowing blue. The red scarf whips in an unseen temporal wind and his amber eyes are locked on target.
  Header "Attack 1" (3,1): Iaido wind-up — he sheathes the katana and crouches low, hand on the hilt ready to quickdraw. The chrono-device flashes cyan and time seems to compress around him.
  Header "Attack 2" (3,2): Quickdraw slash — the katana is a blur of blue temporal energy as he draws and slashes in one motion. A small arc of blue light trails the blade path.
  Header "Attack 3" (3,3): Follow-through — the katana is fully extended, a fading blue temporal blur trail marking the slash. His scarf catches up a beat late, showing the speed.
  Header "Cast 1" (3,4): Chrono Blade raises his left wrist as the chrono-device activates, projecting small cyan time-distortion circles. The katana is held back in his right hand.
  Header "Cast 2" (3,5): The time-distortion circles expand and spin around him, the temporal sigil blazing. His hair and scarf float upward from the chronal energy.

ROW 4 — Cast 3, Damage, KO Start:
  Header "Cast 3" (4,0): A small time-freeze burst erupts from the chrono-device, sending a ripple of cyan distortion outward. He stands at the center with scarf frozen mid-billow.
  Header "Damage 1" (4,1): Chrono Blade recoils from a hit, the red scarf whipping violently forward. The temporal sigil flickers and a small translucent shield shimmer fades on impact.
  Header "Damage 2" (4,2): Staggering backward, the chrono-device sparks on his wrist. His katana wavers in his grip and the temporal afterimage effect stutters erratically.
  Header "Damage 3" (4,3): Recovery — he plants one foot and steadies himself, katana raised defensively. The scarf settles and the chrono-device stabilizes with a dim cyan pulse.
  Header "KO 1" (4,4): The chrono-device sparks and shorts out as his knees give way. The katana dips toward the ground and the temporal sigil goes dark.
  Header "KO 2" (4,5): Collapsing forward, the katana clatters from his grip. His red scarf pools around him and fading temporal echoes flicker around his falling body.

ROW 5 — KO 3, Victory, Status Poses:
  Header "KO 3" (5,0): Chrono Blade lies on the ground, katana beside him and scarf spread beneath his body. Faint temporal echoes fade like ghosts around his still form. The chrono-device is dark.
  Header "Victory 1" (5,1): Chrono Blade performs a swift katana flourish, the blue-glowing blade tracing a circle of light. His red scarf billows dramatically behind him.
  Header "Victory 2" (5,2): He sheathes the katana with a precise click, the temporal sigil pulsing triumphantly. The scarf settles in a dramatic drape and his amber eyes gleam.
  Header "Victory 3" (5,3): Standing tall with arms crossed, the sheathed katana at his side and scarf drifting in slow motion. The chrono-device projects small celebratory cyan sparks.
  Header "Weak Pose" (5,4): Chrono Blade hunches forward, one hand on his knee and the other gripping the katana loosely. The chrono-device malfunctions, flickering between states, and his afterimage stutters.
  Header "Critical Pose" (5,5): Barely standing, he grips the katana with both hands as the chrono-device crackles erratically. His body flickers with translucent temporal duplicates and his scarf is tattered.`,
    },
    {
      id: 'shadow-weaver',
      name: "Shadow Weaver",
      genre: "Dark Fantasy",
      description: "A stealthy assassin with short-cropped black hair, pale skin, and narrow violet eyes that gleam in darkness. Slim, agile build with a low crouching ready stance.",
      equipment: "Form-fitting dark leather armor with deep purple trim, a half-face mask covering the lower face, twin curved daggers with serrated edges, and a belt of throwing knives. A dark hooded cloak with a tattered hem.",
      colorNotes: "Black hair, violet eyes, pale skin. Very dark charcoal leather armor with deep purple accents. Daggers are dark steel with purple gem pommels. Cloak is near-black with purple lining.",
      rowGuidance: `ROW 0 — Walk Down & Walk Up:
  Header "Walk Down 1" (0,0): Shadow Weaver skulks forward on her left foot in a low predatory stride. The dark hooded cloak obscures most of her body and the twin daggers are hidden beneath it. Her violet eyes gleam above the half-face mask.
  Header "Walk Down 2" (0,1): Neutral mid-step contact pose with feet together, crouched slightly. The tattered cloak hem brushes the ground and her narrow violet eyes scan watchfully ahead.
  Header "Walk Down 3" (0,2): Mirror of Walk Down 1 — right foot leads, cloak swaying in the opposite direction. The deep purple lining of the cloak flashes briefly as it shifts.
  Header "Walk Up 1" (0,3): Facing away with left foot forward, the dark hooded cloak dominates the view with its tattered hem trailing. The belt of throwing knives is barely visible beneath the cloak edge.
  Header "Walk Up 2" (0,4): Neutral mid-step facing away, the near-black cloak hanging still. The deep purple trim on her leather armor peeks at the collar where the hood meets the shoulders.
  Header "Walk Up 3" (0,5): Mirror of Walk Up 1 — right foot forward facing away, cloak shifting. The purple lining catches dim light as the tattered hem sways.

ROW 1 — Walk Left & Walk Right:
  Header "Walk Left 1" (1,0): Shadow Weaver faces left in a low skulking crouch, left foot forward. The cloak wraps tightly around her slim frame, concealing the daggers. Only her violet eyes and the mask are visible in profile.
  Header "Walk Left 2" (1,1): Neutral contact pose facing left, her slim silhouette barely visible within the dark cloak. The tattered hem drags slightly and her pale skin contrasts against charcoal leather.
  Header "Walk Left 3" (1,2): Mirror of Walk Left 1 — right foot leads while facing left, cloak rippling forward. A glint of dark steel shows where a dagger hilt sits beneath the cloak.
  Header "Walk Right 1" (1,3): Facing right with right foot forward in a stealthy crouch. The cloak trails behind revealing the form-fitting dark leather armor and purple trim along her side.
  Header "Walk Right 2" (1,4): Neutral contact pose facing right, crouched low. Her short-cropped black hair is visible beneath the hood and the half-face mask covers her sharp features.
  Header "Walk Right 3" (1,5): Mirror of Walk Right 1 — left foot leads while facing right, cloak swirling behind. The belt of throwing knives briefly flashes at her waist.

ROW 2 — Idle & Battle Idle:
  Header "Idle Down" (2,0): Shadow Weaver crouches facing the viewer, hood up and violet eyes scanning. Her right hand rests on a concealed dagger hilt beneath the cloak. Small wisps of shadow drift at her feet.
  Header "Idle Up" (2,1): Crouched facing away, the hooded cloak nearly envelops her form. The tattered hem pools on the ground and the purple cloak lining shows at the edges.
  Header "Idle Left" (2,2): Facing left in a low crouch, one hand near a dagger. Her narrow violet eyes peer from beneath the hood and pale skin stands stark against dark armor.
  Header "Idle Right" (2,3): Facing right, crouched and watchful. The half-face mask and glowing violet eyes create an intimidating profile against the dark cloak.
  Header "Battle Idle 1" (2,4): Shadow Weaver throws back the cloak and draws both curved daggers, dropping into a low combat stance. Small shadow wisps rise from her charcoal armor. The purple gem pommels glow faintly.
  Header "Battle Idle 2" (2,5): She shifts weight between feet in her dual-dagger stance, the serrated edges catching dim light. Shadow wisps coil around her forearms and the violet eyes narrow.

ROW 3 — Battle Idle 3, Attack, Cast Start:
  Header "Battle Idle 3" (3,0): Shadow Weaver holds her daggers reversed in a defensive cross, shadow wisps thickening around her. The cloak billows behind and the purple gem pommels pulse.
  Header "Attack 1" (3,1): Wind-up — she coils her body tight, both daggers pulled back to her sides. Her violet eyes flash and small shadow trails begin forming behind the blades.
  Header "Attack 2" (3,2): Rapid double slash — both curved daggers slash forward in an X-pattern, each trailing a small arc of dark shadow energy. Her body blurs with speed.
  Header "Attack 3" (3,3): Follow-through — daggers fully extended from the X-slash, small shadow trails dissipating. Her cloak whips from the rotational force and she slides to a stop.
  Header "Cast 1" (3,4): Shadow Weaver sheathes both daggers and raises her hands as shadow tendrils rise from beneath her. Her body begins dissolving into darkness from the feet up, only violet eyes remaining bright.
  Header "Cast 2" (3,5): She is nearly melted into a pool of living shadow, only her violet eyes and the top of her hooded head visible. Small shadow tendrils reach outward from the pool.

ROW 4 — Cast 3, Damage, KO Start:
  Header "Cast 3" (4,0): A small explosion of shadow erupts outward from where she stood, sending dark tendrils in all directions. Her violet eyes flash from within the epicenter of the burst.
  Header "Damage 1" (4,1): Shadow Weaver recoils from a hit, the half-face mask cracking along one side. Her daggers waver in her grip and the shadow wisps scatter.
  Header "Damage 2" (4,2): Staggering back, a section of her mask falls away revealing pale skin beneath. Her cloak is torn and one dagger nearly slips from her fingers.
  Header "Damage 3" (4,3): Recovery — she catches her balance in a low crouch, re-gripping both daggers. The broken mask shows her gritted teeth and the shadow wisps slowly reform.
  Header "KO 1" (4,4): Her daggers clatter to the ground as her legs give out. Her form begins dissolving into shadow involuntarily, edges flickering between solid and dark vapor.
  Header "KO 2" (4,5): She collapses into a spreading pool of shadow, her body half-dissolved. The violet eyes dim and the daggers lie abandoned at the edge of the pool.

ROW 5 — KO 3, Victory, Status Poses:
  Header "KO 3" (5,0): Only a dark puddle of shadow remains on the ground with two fading violet points of light where her eyes were. The daggers and broken mask fragments lie nearby.
  Header "Victory 1" (5,1): Shadow Weaver flips both daggers into the air with a casual wrist flick, the serrated blades spinning. Her violet eyes crinkle with satisfaction above the intact mask.
  Header "Victory 2" (5,2): She catches both daggers and crosses them before her in a showy pose. Small shadow wisps spiral around her in a celebratory vortex.
  Header "Victory 3" (5,3): Shadow Weaver melts briefly into shadow and reappears standing confidently with daggers sheathed, arms crossed. The cloak settles around her with dramatic flair.
  Header "Weak Pose" (5,4): Crouching low with one dagger as support, her shadow form is unstable — edges of her body flicker between solid and vapor. The mask is cracked and her breathing is ragged.
  Header "Critical Pose" (5,5): Barely holding form, her body phases in and out of shadow uncontrollably. One dagger is gone, the other gripped desperately. Her violet eyes flicker like dying embers.`,
    },
    {
      id: 'ignis-pyromancer',
      name: "Ignis the Pyromancer",
      genre: "Elemental Fantasy",
      description: "A fierce fire sorceress with long, wild flame-red hair that seems to flicker at the tips, bright orange eyes, and warm bronze skin. Medium build with an assertive, wide-footed stance.",
      equipment: "Layered crimson and burnt-orange robes with ember-like particles drifting from the hems, ornate gold bracers on both wrists, and a staff topped with a caged fireball. A fire-opal pendant at her throat.",
      colorNotes: "Flame-red hair with orange-yellow tips, orange eyes, bronze skin. Crimson and burnt-orange robes. Gold bracers and pendant. Staff fire is bright orange-yellow. Ember particles are orange-red.",
      rowGuidance: `ROW 0 — Walk Down & Walk Up:
  Header "Walk Down 1" (0,0): Ignis strides forward on her left foot, flame-red hair swaying with orange-yellow tips flickering. Small embers drift from her crimson robe hems and the caged fireball on her staff pulses warmly.
  Header "Walk Down 2" (0,1): Neutral mid-step contact pose, feet together. Her bright orange eyes look ahead, the fire-opal pendant glows at her throat, and a few embers float lazily around her robes.
  Header "Walk Down 3" (0,2): Mirror of Walk Down 1 — right foot forward, hair swaying opposite. The gold bracers on her wrists catch firelight and ember particles trail from the other side of her robes.
  Header "Walk Up 1" (0,3): Facing away with left foot forward, the layered crimson and burnt-orange robes fill the view with small embers drifting upward. Her wild flame-red hair cascades down her back.
  Header "Walk Up 2" (0,4): Neutral mid-step facing away, robes hanging still. The caged fireball atop her staff glows steadily above her right shoulder. Ember particles drift lazily upward.
  Header "Walk Up 3" (0,5): Mirror of Walk Up 1 — right foot forward facing away, robes swishing. The flame-red hair tips flicker orange-yellow against the crimson fabric.

ROW 1 — Walk Left & Walk Right:
  Header "Walk Left 1" (1,0): Ignis faces left with her left foot forward, staff held upright with the caged fireball leading. Her wild hair streams behind her and embers trail from her robe hems.
  Header "Walk Left 2" (1,1): Neutral contact pose facing left, her bronze-skinned profile visible. The gold bracers glint and the fire-opal pendant catches light at her throat.
  Header "Walk Left 3" (1,2): Mirror of Walk Left 1 — right foot leads while facing left, hair swinging forward. Ember particles scatter in her wake from the disturbed robes.
  Header "Walk Right 1" (1,3): Facing right with right foot forward, flame-red hair trailing dramatically behind. The staff fireball illuminates her assertive stride and embers drift from the robe edges.
  Header "Walk Right 2" (1,4): Neutral contact pose facing right, the layered robes draping naturally. Her bright orange eyes are visible in profile and the pendant glows warm.
  Header "Walk Right 3" (1,5): Mirror of Walk Right 1 — left foot leads while facing right, hair flowing back. The gold bracers flash as her arms swing and embers scatter behind her.

ROW 2 — Idle & Battle Idle:
  Header "Idle Down" (2,0): Ignis stands in a wide-footed stance facing the viewer, staff resting beside her. Embers drift lazily from her robe hems and her flame-red hair tips glow softly.
  Header "Idle Up" (2,1): Facing away in a relaxed stance, the wild flame-red hair flows down her back with flickering tips. The crimson robes and ember particles create a warm silhouette.
  Header "Idle Left" (2,2): Facing left, Ignis rests the staff against her shoulder. The caged fireball flickers gently and a few embers orbit the gold bracers on her near wrist.
  Header "Idle Right" (2,3): Facing right, she holds the staff loosely at her side. The fire-opal pendant pulses with inner warmth and her orange eyes glow faintly.
  Header "Battle Idle 1" (2,4): Ignis drops into an aggressive wide stance, staff held forward with the caged fireball blazing brightly. Small flames lick at her feet and her hair tips ignite with orange fire.
  Header "Battle Idle 2" (2,5): She shifts weight in her combat stance as a small ring of fire orbits her staff. The gold bracers glow with heat and her hair floats upward slightly from the thermal updraft.

ROW 3 — Battle Idle 3, Attack, Cast Start:
  Header "Battle Idle 3" (3,0): Ignis holds her battle stance, flames intensifying around the staff. Her orange eyes blaze and ember particles swirl faster around her crimson robes.
  Header "Attack 1" (3,1): Wind-up — Ignis raises the staff overhead, the caged fireball growing brighter. She plants her feet wide and coils her torso, heat shimmer rising around her.
  Header "Attack 2" (3,2): She slams the staff down and a small wave of fire erupts forward from the impact point. Her robes flare outward and her hair whips from the force.
  Header "Attack 3" (3,3): Follow-through — the fire wave crests at the edge of the cell, staff planted in the ground. Her bronze skin gleams from the heat, embers showering around her.
  Header "Cast 1" (3,4): Ignis raises both hands, the staff floating beside her. Her flame-red hair ignites fully, becoming a mane of fire. A small vortex of flames begins forming between her palms.
  Header "Cast 2" (3,5): The fire vortex grows between her outstretched hands as her entire body radiates heat. The gold bracers glow white-hot and the fire-opal pendant blazes.

ROW 4 — Cast 3, Damage, KO Start:
  Header "Cast 3" (4,0): Ignis launches a small but intense fireball from her palms, a compact meteor of orange-yellow flame. Her robes billow violently upward and her hair is a column of fire above her head.
  Header "Damage 1" (4,1): Ignis stumbles back from a hit, her flames sputtering momentarily. The caged fireball on the staff dims and the ember particles scatter chaotically around her.
  Header "Damage 2" (4,2): Staggering further, cracks appear in one of her gold bracers. Her hair flames flicker out at the tips, returning to just red, and the fire-opal pendant dims.
  Header "Damage 3" (4,3): Recovery — Ignis reignites with effort, small flames returning to her hair tips. She grips the staff tighter and the caged fireball steadies, though dimmer than before.
  Header "KO 1" (4,4): All fires die out — her hair falls limp as normal red hair, the staff fireball extinguishes, and the embers vanish. She drops to her knees.
  Header "KO 2" (4,5): She falls forward, the now-dark staff clattering beside her. Her crimson robes spread on the ground with no embers or fire. The gold bracers are dull and cold.

ROW 5 — KO 3, Victory, Status Poses:
  Header "KO 3" (5,0): Ignis lies on the ground, robes spread around her with the extinguished staff nearby. A last thin wisp of smoke rises from her hair. The fire-opal pendant is dark and cracked.
  Header "Victory 1" (5,1): Ignis thrusts her staff skyward as a small pillar of fire erupts from the caged fireball. Her hair blazes fully and her wide grin radiates fierce triumph.
  Header "Victory 2" (5,2): She spins the staff in a fiery flourish, creating a ring of small embers around her. The gold bracers shine and her bronze skin glows warmly from the firelight.
  Header "Victory 3" (5,3): Ignis plants the staff and stands with her free hand on her hip, flames dancing along her hair. The fire-opal pendant pulses victoriously and embers float in celebration.
  Header "Weak Pose" (5,4): Ignis leans on the staff with both hands, flames barely flickering at her hair tips. The caged fireball is dim, the pendant cracked, and her breathing comes in heavy gasps.
  Header "Critical Pose" (5,5): Barely standing in a wide desperate stance, her flames are reduced to faint flickers. The gold bracers are fractured, the staff fireball gutters, and only her blazing orange eyes remain defiant.`,
    },
    {
      id: 'mx-zero',
      name: "MX-Zero",
      genre: "Sci-Fi Action",
      description: "A heroic robot with a rounded blue helmet featuring a red gem on the forehead, expressive green eyes, and a compact humanoid frame. Solid, balanced stance with one arm transformed into a cannon.",
      equipment: "Sleek blue and cyan armor plating over a dark bodysuit, with white joints and accents. Right arm is a modular arm cannon with a glowing cyan barrel. Armored boots with jet boosters.",
      colorNotes: "Primary blue armor with cyan highlights. White joint segments and trim. Dark navy bodysuit underneath. Helmet gem is red. Arm cannon glows cyan. Boot jets are orange when active.",
      rowGuidance: `ROW 0 — Walk Down & Walk Up:
  Header "Walk Down 1" (0,0): MX-Zero steps forward on his left foot with a precise mechanical stride, arm cannon held at ready position by his right side. The red helmet gem pulses faintly and the cyan barrel glows.
  Header "Walk Down 2" (0,1): Neutral mid-step contact pose, feet together. His expressive green eyes look directly ahead and the blue armor plating gleams. The white joint segments flex cleanly.
  Header "Walk Down 3" (0,2): Mirror of Walk Down 1 — right foot forward, arm cannon now on the left side. The boot jet boosters show faint orange vents at the heels.
  Header "Walk Up 1" (0,3): Facing away with left foot forward, the blue and cyan armor plating covers his back. The arm cannon is visible at his right side and the jet booster ports on his boots glow faintly orange.
  Header "Walk Up 2" (0,4): Neutral mid-step facing away, the dark navy bodysuit visible at the joints between blue armor plates. The red helmet gem is visible from behind as a slight glow.
  Header "Walk Up 3" (0,5): Mirror of Walk Up 1 — right foot forward facing away, arm cannon on the opposite side. White joint accents catch the light as his limbs move.

ROW 1 — Walk Left & Walk Right:
  Header "Walk Left 1" (1,0): MX-Zero faces left with left foot forward, arm cannon pointing ahead. His compact humanoid frame shows clean blue plating and the cyan barrel glows. The helmet profile reveals the red gem.
  Header "Walk Left 2" (1,1): Neutral contact pose facing left, his balanced mechanical stance evident. The white joint segments are visible at the knees and elbows. Green eyes scan forward.
  Header "Walk Left 3" (1,2): Mirror of Walk Left 1 — right foot leads while facing left. The arm cannon swings slightly with the stride and the boot jets show faint heat shimmer.
  Header "Walk Right 1" (1,3): Facing right with right foot forward, arm cannon trailing behind. The blue helmet with red gem is visible in profile and cyan highlights trace the armor edges.
  Header "Walk Right 2" (1,4): Neutral contact pose facing right, compact frame in balanced stance. The dark bodysuit shows between the blue armor plates at the waist joint.
  Header "Walk Right 3" (1,5): Mirror of Walk Right 1 — left foot leads while facing right, arm cannon swinging forward. The boot jet ports flicker with faint orange.

ROW 2 — Idle & Battle Idle:
  Header "Idle Down" (2,0): MX-Zero stands in a relaxed scanning mode facing the viewer, arm cannon lowered and barrel dim. His green eyes blink in a friendly manner and the helmet gem pulses softly red.
  Header "Idle Up" (2,1): Facing away in standby, the back armor panels and boot jet ports are visible. His compact frame is upright with the arm cannon resting at his side.
  Header "Idle Left" (2,2): Facing left in idle mode, arm cannon hanging at his side. His green eyes are half-lidded in a relaxed expression and the cyan highlights on his armor are muted.
  Header "Idle Right" (2,3): Facing right, standing balanced with the arm cannon resting. The red helmet gem pulses in a slow rhythm and the white joint segments are clean and bright.
  Header "Battle Idle 1" (2,4): MX-Zero snaps to combat mode — arm cannon raised and charged with intense cyan glow, knees bent in a firing stance. A small targeting reticle appears in his green eyes.
  Header "Battle Idle 2" (2,5): He shifts in his combat stance, the arm cannon humming with building energy. The helmet gem blazes red and the boot jets engage with small orange flares for stability.

ROW 3 — Battle Idle 3, Attack, Cast Start:
  Header "Battle Idle 3" (3,0): MX-Zero holds his firing stance, arm cannon fully charged and glowing bright cyan. His green eyes lock forward with the targeting display active and all armor panels are battle-tight.
  Header "Attack 1" (3,1): Wind-up — the arm cannon barrel opens wider as energy concentrates inside, glowing intensely cyan. MX-Zero braces his feet and leans into the firing position.
  Header "Attack 2" (3,2): Rapid fire — a small burst of cyan plasma shoots from the cannon barrel with a bright muzzle flash. His arm recoils slightly from the discharge and his boots grip the ground.
  Header "Attack 3" (3,3): Follow-through — the plasma bolt streaks to the edge of the cell as the cannon barrel vents small wisps of cyan energy. His body rocks back from the recoil.
  Header "Cast 1" (3,4): The arm cannon begins transforming — panels shift and the barrel extends, reconfiguring into a larger mega-buster form. Energy crackles along the new barrel as it charges.
  Header "Cast 2" (3,5): The mega-buster is fully formed and charging, a sphere of intense cyan energy growing at the barrel tip. All of his armor lights pulse in sync and his green eyes blaze.

ROW 4 — Cast 3, Damage, KO Start:
  Header "Cast 3" (4,0): The mega-buster fires a massive charged shot — a large cyan energy sphere launches forward with a blinding flash. The recoil pushes him back and his boot jets fire to compensate.
  Header "Damage 1" (4,1): MX-Zero staggers from a hit, blue armor plates jostling and sparking at the joints. His green eyes flicker and the arm cannon dips from the impact force.
  Header "Damage 2" (4,2): Reeling backward, a panel of blue armor cracks and small electrical sparks spray from exposed wiring. The red helmet gem flickers and the cannon barrel dims.
  Header "Damage 3" (4,3): Recovery — MX-Zero plants his feet and recalibrates, armor panels clicking back into place. The sparking subsides and his green eyes refocus with renewed determination.
  Header "KO 1" (4,4): Systems failing — his green eyes dim and flicker as his knees buckle. The arm cannon powers down, barrel going dark, and the helmet gem fades to dull red.
  Header "KO 2" (4,5): Collapsing forward, his armor panels go slack. Faint sparks crackle from joints as his body hits the ground face-first, arm cannon thudding beside him.

ROW 5 — KO 3, Victory, Status Poses:
  Header "KO 3" (5,0): MX-Zero lies collapsed on the ground, eyes completely dark and all armor lights extinguished. Small occasional sparks crackle from his joints. The arm cannon barrel is cold and grey.
  Header "Victory 1" (5,1): MX-Zero pumps his left fist into the air while the arm cannon is raised triumphantly. His green eyes shine brightly and the boot jets fire small celebratory orange sparks.
  Header "Victory 2" (5,2): He strikes a heroic pose with the arm cannon aimed skyward, cyan barrel blazing. The helmet gem pulses a victorious red and all armor lights cycle through a bright pattern.
  Header "Victory 3" (5,3): MX-Zero gives a thumbs-up with his left hand, the arm cannon resting on his hip. His green eyes form a friendly expression and the boot jets puff a tiny orange burst.
  Header "Weak Pose" (5,4): MX-Zero stands unsteadily, one knee slightly buckled. His systems are failing — static flickers in his green eyes, the arm cannon is powered down, and the helmet gem sputters.
  Header "Critical Pose" (5,5): Barely operational, MX-Zero leans forward with the arm cannon flickering between charged and dead. Exposed wiring sparks, armor panels hang loose, and his green eyes strobe with static.`,
    },
    {
      id: 'hayate-ninja',
      name: "Hayate the Wind Ninja",
      genre: "Action Platformer",
      description: "A swift ninja with a dark blue head wrap leaving only sharp grey eyes visible, lean and agile build, always appearing mid-motion even when standing still.",
      equipment: "Dark blue-black fitted shinobi armor with silver arm guards and shin guards, a long trailing silver-white scarf, a ninjato sword strapped to his back, and shuriken holstered at his waist.",
      colorNotes: "Dark blue-black armor and head wrap. Grey eyes. Silver-white scarf and metallic silver guards. Ninjato handle is wrapped in dark blue cord. Shuriken are polished steel.",
      rowGuidance: `ROW 0 — Walk Down & Walk Up:
  Header "Walk Down 1" (0,0): Hayate dashes forward on his left foot in a swift ninja stride, barely touching the ground. The long silver-white scarf trails dynamically to the right and his dark blue head wrap frames sharp grey eyes.
  Header "Walk Down 2" (0,1): Neutral mid-step contact pose, feet together in a light crouch. The scarf hangs briefly still and the ninjato hilt is visible over his right shoulder. Silver arm guards glint.
  Header "Walk Down 3" (0,2): Mirror of Walk Down 1 — right foot leads, scarf trailing to the left. The shuriken holstered at his waist catch a flash of polished steel as he moves.
  Header "Walk Up 1" (0,3): Facing away with left foot forward, the ninjato strapped to his back dominates the view with its dark blue cord-wrapped handle. The silver-white scarf streams behind him.
  Header "Walk Up 2" (0,4): Neutral mid-step facing away, the dark blue-black shinobi armor visible across his back. The silver shin guards catch light below the ninjato sheath.
  Header "Walk Up 3" (0,5): Mirror of Walk Up 1 — right foot forward facing away, scarf flowing to the opposite side. The lean silhouette shows his agile build in motion.

ROW 1 — Walk Left & Walk Right:
  Header "Walk Left 1" (1,0): Hayate faces left in a rapid dash, left foot forward and body low. The silver-white scarf trails long behind him and the ninjato handle protrudes above his far shoulder.
  Header "Walk Left 2" (1,1): Neutral contact pose facing left, crouched and ready. His sharp grey eyes peer from the head wrap and the silver arm guards protect his leading forearms.
  Header "Walk Left 3" (1,2): Mirror of Walk Left 1 — right foot leads while facing left, scarf whipping forward. His lean body barely seems to touch the ground as he moves.
  Header "Walk Right 1" (1,3): Facing right with right foot forward in a swift dash. The silver-white scarf streams behind and the shuriken at his waist are visible in profile. Grey eyes focus ahead.
  Header "Walk Right 2" (1,4): Neutral contact pose facing right, the dark blue-black armor sleek against his agile frame. The silver shin guards shine and the head wrap tails flutter.
  Header "Walk Right 3" (1,5): Mirror of Walk Right 1 — left foot leads while facing right, scarf trailing. The ninjato handle is visible above his shoulder as he sprints.

ROW 2 — Idle & Battle Idle:
  Header "Idle Down" (2,0): Hayate stands with arms crossed facing the viewer, the silver-white scarf drifting in an unseen wind. Despite standing still, his crouch suggests coiled potential. Grey eyes are calm but alert.
  Header "Idle Up" (2,1): Facing away with arms crossed, the ninjato and scarf visible on his back. The dark blue head wrap tails drift gently and his posture is poised and watchful.
  Header "Idle Left" (2,2): Facing left with arms crossed, his lean profile showing the silver arm guards and the scarf drifting behind. One foot is slightly forward, ready to move instantly.
  Header "Idle Right" (2,3): Facing right, arms crossed, scarf floating lazily. The shuriken at his waist and the ninjato hilt over his shoulder create a distinctive silhouette.
  Header "Battle Idle 1" (2,4): Hayate draws the ninjato in a low combat stance, the straight blade gleaming. The silver-white scarf whips aggressively and his grey eyes narrow above the head wrap.
  Header "Battle Idle 2" (2,5): He shifts into a deeper crouch, ninjato held reversed along his forearm. The scarf coils in the wind and the silver arm guards are positioned defensively.

ROW 3 — Battle Idle 3, Attack, Cast Start:
  Header "Battle Idle 3" (3,0): Hayate holds his low ninjato stance, the blade angled forward. His scarf whips in a controlled spiral and the polished shuriken at his waist are within easy reach.
  Header "Attack 1" (3,1): Wind-up — Hayate pulls the ninjato back in a reverse grip, body coiling like a spring. Small wind streaks form around the blade and his scarf goes taut.
  Header "Attack 2" (3,2): Rapid slash — the ninjato cuts forward in a blur, a small streak of wind following the blade path. His body spins and the scarf trails in a wide arc.
  Header "Attack 3" (3,3): Follow-through — a second slash completes a combo, wind streaks crossing in an X. The ninjato is fully extended and the scarf snaps from the speed of the rotation.
  Header "Cast 1" (3,4): Hayate sheathes the ninjato and performs rapid hand signs, fingers blurring. A small wind vortex begins forming around his feet, the scarf spiraling upward.
  Header "Cast 2" (3,5): The wind vortex intensifies as shuriken lift from his holster and orbit him in the spinning air. His scarf stands straight up and his grey eyes glow with focused energy.

ROW 4 — Cast 3, Damage, KO Start:
  Header "Cast 3" (4,0): Wind blade barrage — multiple small crescent-shaped wind blades launch outward from the vortex as the orbiting shuriken shoot forward. The scarf snaps violently in the discharge.
  Header "Damage 1" (4,1): Hayate is knocked backward from a hit, the scarf tangling around his arm. His ninjato wavers and the silver arm guards show a dent from the impact.
  Header "Damage 2" (4,2): Staggering, his head wrap is partially torn revealing black hair beneath. The scarf wraps chaotically around his body and a shuriken drops from his belt.
  Header "Damage 3" (4,3): Recovery — Hayate catches himself in a low three-point crouch, untangling the scarf with one hand. His grey eyes refocus and he draws the ninjato again.
  Header "KO 1" (4,4): The ninjato clatters from his hand as his legs give way. His silver-white scarf droops and the head wrap loosens, revealing more of his face beneath.
  Header "KO 2" (4,5): Falling face-down, the scarf pools around his crumpled body. The shuriken scatter from his belt and the ninjato slides away from his outstretched hand.

ROW 5 — KO 3, Victory, Status Poses:
  Header "KO 3" (5,0): Hayate lies face-down on the ground, the silver-white scarf draped over his body like a shroud. The ninjato rests beside him and scattered shuriken surround his still form.
  Header "Victory 1" (5,1): Hayate appears from a puff of ninja smoke, flipping a polished shuriken between his fingers. His grey eyes crinkle with satisfaction above the head wrap and the scarf billows triumphantly.
  Header "Victory 2" (5,2): He catches the shuriken and sheathes the ninjato in one fluid motion, striking a confident cross-armed pose. The scarf settles dramatically behind him.
  Header "Victory 3" (5,3): Hayate stands with the ninjato resting on his shoulder, head tilted with casual confidence. A single shuriken spins on his fingertip and the silver-white scarf drifts in the breeze.
  Header "Weak Pose" (5,4): Hayate leans heavily on the ninjato planted in the ground, panting. His scarf is tattered and dragging, the silver arm guards are dented, and his grey eyes are weary but defiant.
  Header "Critical Pose" (5,5): Barely standing, Hayate grips the ninjato with both trembling hands. His head wrap is half-unwound, the scarf is shredded, and his breathing is visible and labored.`,
    },
    {
      id: 'sgt-nova',
      name: "Sgt. Nova",
      genre: "Sci-Fi Action",
      description: "A hardened space marine with a full visor helmet showing a green HUD glow, bulky power-armored frame, and a commanding military bearing.",
      equipment: "Heavy olive-green and gunmetal power armor with reinforced shoulder plates, a large plasma rifle held at the ready, ammo pouches on the belt, and a jet pack module on the back.",
      colorNotes: "Olive-green primary armor with gunmetal-gray secondary plates. Visor glows green. Plasma rifle has a blue energy cell. Jet pack has orange thruster ports. Belt pouches are dark brown.",
      rowGuidance: `ROW 0 — Walk Down & Walk Up:
  Header "Walk Down 1" (0,0): Sgt. Nova marches forward on his left foot with heavy, deliberate steps, the plasma rifle held at ready across his chest. The green visor HUD glows and the olive-green armor clanks with each stride.
  Header "Walk Down 2" (0,1): Neutral mid-step contact pose, feet together, rifle shouldered. The reinforced shoulder plates frame his helmeted head and the jet pack vents glow faintly orange on his back.
  Header "Walk Down 3" (0,2): Mirror of Walk Down 1 — right foot leads, rifle swaying to the opposite side. The ammo pouches on his belt bounce and the gunmetal secondary plates catch the light.
  Header "Walk Up 1" (0,3): Facing away with left foot forward, the jet pack module dominates the back view with its orange thruster ports. The heavy power armor and plasma rifle barrel are visible over his shoulder.
  Header "Walk Up 2" (0,4): Neutral mid-step facing away, the olive-green and gunmetal armor covering his broad back. The reinforced shoulder plates jut prominently and the belt pouches hang at his sides.
  Header "Walk Up 3" (0,5): Mirror of Walk Up 1 — right foot forward facing away, jet pack shifting with his stride. The plasma rifle blue energy cell glows through the weapon housing.

ROW 1 — Walk Left & Walk Right:
  Header "Walk Left 1" (1,0): Sgt. Nova faces left with left foot forward in a disciplined march, plasma rifle leading. His bulky power-armored silhouette shows the reinforced shoulder plate and the green visor in profile.
  Header "Walk Left 2" (1,1): Neutral contact pose facing left, rifle at port arms. The jet pack is visible on his far side and the dark brown ammo pouches line his belt.
  Header "Walk Left 3" (1,2): Mirror of Walk Left 1 — right foot leads while facing left, heavy footfall evident. The gunmetal secondary plates protect his near flank.
  Header "Walk Right 1" (1,3): Facing right with right foot forward, the plasma rifle held at the ready. The jet pack module is on his far side and the green visor HUD scans ahead.
  Header "Walk Right 2" (1,4): Neutral contact pose facing right, commanding military bearing evident. The reinforced shoulder plate and olive-green armor create a formidable profile.
  Header "Walk Right 3" (1,5): Mirror of Walk Right 1 — left foot leads while facing right, armor clanking. The blue energy cell on the plasma rifle glows in its housing.

ROW 2 — Idle & Battle Idle:
  Header "Idle Down" (2,0): Sgt. Nova stands at parade rest facing the viewer, plasma rifle shouldered with barrel up. The green visor glows steadily and his commanding posture fills the frame with power armor bulk.
  Header "Idle Up" (2,1): At ease facing away, the jet pack and reinforced back armor visible. The plasma rifle barrel extends over his right shoulder and the orange thruster ports are dormant.
  Header "Idle Left" (2,2): Facing left at parade rest, rifle shouldered. His helmet profile shows the green visor strip and the bulky shoulder plate. Ammo pouches are accessible at his belt.
  Header "Idle Right" (2,3): Facing right at ease, the power armor bulk evident. The plasma rifle rests against his shoulder and the green visor casts a faint glow on the nearby armor plates.
  Header "Battle Idle 1" (2,4): Sgt. Nova drops into a combat firing stance, plasma rifle aimed forward with the blue energy cell glowing bright. His knees are bent, visor HUD tracking, and the shoulder plates brace for recoil.
  Header "Battle Idle 2" (2,5): He shifts in his firing stance, the rifle barrel scanning. The green visor HUD flickers with targeting data and the jet pack vents pulse orange with readiness.

ROW 3 — Battle Idle 3, Attack, Cast Start:
  Header "Battle Idle 3" (3,0): Sgt. Nova holds his firing stance, rifle locked on target. The visor HUD displays targeting brackets and the blue energy cell hums with full charge. His heavy boots are firmly planted.
  Header "Attack 1" (3,1): Wind-up — he braces the plasma rifle against his shoulder plate, sighting down the barrel. The blue energy cell brightens as the weapon charges and his visor locks on.
  Header "Attack 2" (3,2): Rapid fire — a burst of blue plasma erupts from the rifle barrel with a bright muzzle flash. The recoil pushes against his shoulder plate and spent energy crackles from the barrel.
  Header "Attack 3" (3,3): Follow-through — the plasma bursts streak to the edge of the cell, the rifle barrel venting blue-white heat. His boots have slid back slightly from the sustained recoil.
  Header "Cast 1" (3,4): Sgt. Nova raises his left arm, activating a wrist-mounted hologram display. A small blue tactical interface projects upward showing an orbital targeting reticle. The rifle is slung.
  Header "Cast 2" (3,5): The hologram display expands as he confirms coordinates, a small beam of light shooting skyward from his wrist device. The visor HUD displays incoming strike data.

ROW 4 — Cast 3, Damage, KO Start:
  Header "Cast 3" (4,0): An orbital strike lands — a focused beam of energy impacts from above at the cell edge, creating a small explosion of light. Sgt. Nova shields his visor from the flash with one arm.
  Header "Damage 1" (4,1): Sgt. Nova staggers from a hit, armor sparking at the impact point on his shoulder plate. The plasma rifle wavers and the visor HUD flickers with static.
  Header "Damage 2" (4,2): Stumbling backward, a gunmetal armor panel cracks and sparks fly from exposed circuitry. The jet pack sputters and the green visor dims briefly.
  Header "Damage 3" (4,3): Recovery — he plants the rifle stock on the ground for balance, pushing back to a standing firing position. The visor HUD reboots with a green flash and he grits through the pain.
  Header "KO 1" (4,4): Systems critical — the armor locks up as servos fail, his knees buckling under the heavy suit. The visor HUD scrambles and the plasma rifle droops in weakening hands.
  Header "KO 2" (4,5): Sgt. Nova collapses under the weight of the dead power armor, the rifle clattering beside him. The jet pack sparks once and the visor goes dark.

ROW 5 — KO 3, Victory, Status Poses:
  Header "KO 3" (5,0): Sgt. Nova lies in the powered-down armor, visor completely dark and all systems offline. The plasma rifle rests beside his outstretched arm and faint sparks crackle from the jet pack.
  Header "Victory 1" (5,1): Sgt. Nova raises the plasma rifle overhead with one arm in triumph, the blue energy cell blazing. The jet pack fires a small celebratory burst of orange flame and the visor glows bright green.
  Header "Victory 2" (5,2): He plants the rifle butt on the ground and stands at attention, giving a sharp military salute. The visor HUD displays a mission-complete readout and the armor gleams.
  Header "Victory 3" (5,3): Sgt. Nova rests the rifle on his shoulder with casual confidence, helmet tilted slightly. The green visor reflects the aftermath and the jet pack vents steam in satisfaction.
  Header "Weak Pose" (5,4): Sgt. Nova leans heavily on the plasma rifle as a crutch, visor cracked with a flickering green glow. Coolant leaks from a damaged armor joint and his jet pack is offline.
  Header "Critical Pose" (5,5): Barely standing in failing armor, Sgt. Nova holds the plasma rifle one-handed, the energy cell nearly depleted. The visor is cracked and sputtering, one shoulder plate is gone, and servos whine.`,
    },
    {
      id: 'gel-slime',
      name: "Gel Slime",
      genre: "Classic Fantasy",
      description: "A small, round, translucent blue slime creature with a jiggly gelatinous body. Two large, expressive dark eyes with white highlights sit near the top of its body. A perpetual happy expression with a tiny curved mouth.",
      equipment: "",
      colorNotes: "Translucent sky-blue body with lighter blue highlights on top and darker blue shadow at the base. Eyes are large and dark with bright white shine spots. A faint inner glow gives it a jewel-like quality.",
      rowGuidance: `ROW 0 — Walk Down & Walk Up:
  Header "Walk Down 1" (0,0): Gel Slime squishes down and bounces forward to the left, its translucent sky-blue body compressing flat before springing up. The large dark eyes with white highlights squish down with the body, maintaining a happy expression.
  Header "Walk Down 2" (0,1): At the peak of a bounce, Gel Slime is stretched tall and narrow in mid-air with the faint inner glow brightening. Its eyes are wide and round at the top of its elongated body.
  Header "Walk Down 3" (0,2): Mirror of Walk Down 1 — bouncing to the right, body compressed flat on landing. The darker blue shadow at the base spreads wider and the lighter highlights on top squish sideways.
  Header "Walk Up 1" (0,3): Gel Slime bounces forward facing away, showing the rounded back of its translucent body. The inner glow is visible through the gelatinous form and the base shadow compresses on landing.
  Header "Walk Up 2" (0,4): Peak of bounce facing away, stretched tall. The jewel-like inner glow is most visible from behind when the body is elongated and thinner.
  Header "Walk Up 3" (0,5): Mirror of Walk Up 1 — bouncing the other direction facing away, body squished flat. The translucent quality shows the darker blue shadow spreading beneath.

ROW 1 — Walk Left & Walk Right:
  Header "Walk Left 1" (1,0): Gel Slime squishes and bounces to the left, body tilting in the direction of movement. Its large eyes and tiny curved mouth are visible in profile and the translucent body wobbles with jelly physics.
  Header "Walk Left 2" (1,1): Mid-bounce facing left, stretched tall and leaning forward. The lighter blue highlight catches light on the top surface and the body ripples with gelatinous movement.
  Header "Walk Left 3" (1,2): Mirror of Walk Left 1 — landing from the bounce, body compressed wide. The dark base shadow spreads and the eyes squish down humorously with the rest of its form.
  Header "Walk Right 1" (1,3): Gel Slime bounces to the right, body tilting rightward. The translucent sky-blue form shows the inner glow shifting with momentum and the tiny happy mouth curves upward.
  Header "Walk Right 2" (1,4): Mid-bounce facing right, elongated and stretchy. The white eye highlights shine brightly at the top of the tall form and the faint inner glow pulses.
  Header "Walk Right 3" (1,5): Mirror of Walk Right 1 — landing squish, body flattened wide. The jelly wobble ripples outward from the impact point and the eyes bounce within the gelatinous body.

ROW 2 — Idle & Battle Idle:
  Header "Idle Down" (2,0): Gel Slime sits in a gentle idle wobble facing the viewer, body jiggling slightly. Its large dark eyes blink contentedly with bright white highlights and the tiny curved mouth smiles. The inner glow pulses softly.
  Header "Idle Up" (2,1): Facing away in a relaxed wobble, the rounded back of the translucent body shows the inner glow. The darker blue base shadow is visible and the body sways gently.
  Header "Idle Left" (2,2): Facing left with a gentle jiggle, one eye visible in profile. The translucent sky-blue body catches light on its curved surface and it sways rhythmically.
  Header "Idle Right" (2,3): Facing right with a contented wobble, the tiny mouth and one large eye visible. The jewel-like inner glow shifts with each gentle sway.
  Header "Battle Idle 1" (2,4): Gel Slime puffs up slightly larger, its body vibrating with determination. The eyes narrow with a focused expression and the inner glow intensifies. Its happy mouth becomes a determined line.
  Header "Battle Idle 2" (2,5): The puffed-up slime vibrates faster, body rippling with contained energy. The translucent form becomes slightly more opaque as it concentrates and the base shadow darkens.

ROW 3 — Battle Idle 3, Attack, Cast Start:
  Header "Battle Idle 3" (3,0): Gel Slime holds its puffed battle stance, body taut and vibrating. The inner glow pulses rapidly and the dark eyes are locked forward with unusual intensity for such a cute creature.
  Header "Attack 1" (3,1): Wind-up — Gel Slime compresses its body down flat, coiling like a spring. The inner glow concentrates at the base and its eyes squint with effort as it prepares to launch.
  Header "Attack 2" (3,2): Tackle launch — the slime springs forward, body elongated into a missile shape aimed at the target. The inner glow streaks behind like a comet trail and its eyes are determined.
  Header "Attack 3" (3,3): Impact — Gel Slime splats against the target area, body flattening and rippling outward on contact. It quickly reforms into a wobbly sphere, eyes spinning briefly from the collision.
  Header "Cast 1" (3,4): Gel Slime glows brightly from within, the translucent body becoming luminous. Small water droplets begin condensing in the air around it and its eyes close in concentration.
  Header "Cast 2" (3,5): The water droplets multiply and orbit the glowing slime. Its body pulses with blue light and the surrounding air shimmers with moisture. The inner glow is intense and beautiful.

ROW 4 — Cast 3, Damage, KO Start:
  Header "Cast 3" (4,0): Water splash burst — the orbiting droplets explode outward in a small ring of water, and Gel Slime itself releases a pulse of blue energy. Its body dims afterward, slightly deflated from the effort.
  Header "Damage 1" (4,1): Gel Slime flattens from an impact, body rippling violently like disturbed jelly. Its eyes widen in shock and spin momentarily while the inner glow flickers. The happy expression turns to surprise.
  Header "Damage 2" (4,2): The slime wobbles erratically, body distorted and off-balance. Its dark eyes are dizzy spirals and the translucent form shows the inner glow sputtering unevenly.
  Header "Damage 3" (4,3): Recovery — Gel Slime reshapes itself with a determined wobble, eyes refocusing. Its body is slightly less translucent than normal and the inner glow steadies to a dim pulse.
  Header "KO 1" (4,4): Gel Slime begins melting — its round shape sags and flattens, the body losing cohesion. The eyes droop sadly and the inner glow fades. The tiny mouth turns down.
  Header "KO 2" (4,5): Further melting into a spreading puddle, the body nearly flat. The eyes are half-submerged in the puddle and the last traces of inner glow flicker at the center.

ROW 5 — KO 3, Victory, Status Poses:
  Header "KO 3" (5,0): Gel Slime is a flat translucent blue puddle on the ground with two fading dark eyes barely visible at the surface. The inner glow has completely gone out and only a faint blue tint remains.
  Header "Victory 1" (5,1): Gel Slime bounces high into the air with joy, body stretching tall. Its eyes are bright crescents of happiness and small sparkles surround its glowing form. The tiny mouth is a wide grin.
  Header "Victory 2" (5,2): At the peak of its victory bounce, Gel Slime wiggles ecstatically. The inner glow is the brightest it has ever been and happy sparkles orbit its translucent body.
  Header "Victory 3" (5,3): Landing from the bounce, Gel Slime jiggles contentedly with a satisfied expression. Its large eyes shine with delight and the inner glow pulses warmly. A few last sparkles fade around it.
  Header "Weak Pose" (5,4): Gel Slime sags and droops, body semi-transparent and barely holding its round shape. The eyes are half-closed and tired, the inner glow is very faint, and the edges of its body waver.
  Header "Critical Pose" (5,5): Nearly dissolved, Gel Slime is a wobbly semi-flat blob barely maintaining form. Its eyes are dim and unfocused, the body is almost fully transparent, and it trembles with the effort of staying together.`,
    },
    {
      id: 'magma-wyrm',
      name: "Magma Wyrm",
      genre: "Classic Fantasy",
      description: "A small but fearsome fire-breathing dragon with molten orange-red scales, two curved horns, a ridged back, and a spiked tail. Bat-like wings folded at its sides. Fierce yellow eyes with slit pupils and an open mouth revealing glowing fangs.",
      equipment: "",
      colorNotes: "Molten orange-red scales with darker crimson underbelly. Bright yellow-orange cracks between scales suggesting inner magma. Horns and claws are dark charcoal. Wing membranes are deep red. Eyes are fierce yellow. Mouth interior glows orange.",
      rowGuidance: `ROW 0 — Walk Down & Walk Up:
  Header "Walk Down 1" (0,0): Magma Wyrm lumbers forward on its left fore-claw, the molten orange-red scales shifting as muscles move beneath. Its bat-like wings are folded tight, spiked tail swishing to the right, and small lava drops drip from its open jaws.
  Header "Walk Down 2" (0,1): Neutral mid-step with all four claws planted, the ridged back arching slightly. Its fierce yellow slit-pupil eyes face the viewer and the bright yellow-orange cracks between scales glow steadily.
  Header "Walk Down 3" (0,2): Mirror of Walk Down 1 — right fore-claw leads, spiked tail swishing left. The curved dark charcoal horns frame its glowing-fanged mouth and lava drops trail from the opposite side.
  Header "Walk Up 1" (0,3): Facing away with left fore-claw forward, the ridged back and folded wing membranes fill the view. The spiked tail sways and the deep red wing membranes peek from the folded position.
  Header "Walk Up 2" (0,4): Neutral stance facing away, the dark charcoal horns curving from the back of its head. The bright magma cracks between the dorsal scales glow warmly and the tail rests.
  Header "Walk Up 3" (0,5): Mirror of Walk Up 1 — right fore-claw forward facing away, tail swishing opposite. The crimson underbelly is barely visible beneath the folded wings.

ROW 1 — Walk Left & Walk Right:
  Header "Walk Left 1" (1,0): Magma Wyrm faces left with its left claws forward in a lumbering reptilian gait. The folded wings press against its flank, spiked tail trailing behind, and smoke wisps from its nostrils.
  Header "Walk Left 2" (1,1): Neutral contact pose facing left, all claws planted. The profile shows the curved horns, ridged back, and the orange glow of its open mouth. Wing membranes fold neatly.
  Header "Walk Left 3" (1,2): Mirror of Walk Left 1 — right claws lead while facing left. The spiked tail swings forward and the magma cracks between scales pulse with each step.
  Header "Walk Right 1" (1,3): Facing right with right claws forward, the wyrm strides heavily. Lava drips from its jaws, the spiked tail trails behind, and the fierce yellow eyes scan ahead.
  Header "Walk Right 2" (1,4): Neutral contact pose facing right, the crimson underbelly visible below. The dark charcoal claws grip the ground and the folded bat-like wings are tucked against the body.
  Header "Walk Right 3" (1,5): Mirror of Walk Right 1 — left claws lead while facing right, tail swinging. The molten orange-red scales shimmer with heat and magma cracks glow brighter with movement.

ROW 2 — Idle & Battle Idle:
  Header "Idle Down" (2,0): Magma Wyrm sits on its haunches facing the viewer, wings twitching at its sides. Thin smoke curls from its nostrils and the fierce yellow eyes watch lazily. The magma cracks pulse with slow heat.
  Header "Idle Up" (2,1): Sitting facing away, the ridged back and folded wings are prominent. The spiked tail curls around one side and the dark charcoal horns curve upward from its skull.
  Header "Idle Left" (2,2): Facing left at rest, smoke wisping from its snout. Its wings fold against the near flank and the spiked tail lies along the ground. The yellow eye watches with slit-pupil focus.
  Header "Idle Right" (2,3): Facing right at rest, the crimson underbelly visible as it sits. The curved horns and ridged back create a fierce profile and faint heat shimmer rises from its scales.
  Header "Battle Idle 1" (2,4): Magma Wyrm spreads its bat-like wings wide, revealing the deep red membranes. Its mouth opens to show glowing orange fangs and it drops into an aggressive crouch. Small flames lick from its jaws.
  Header "Battle Idle 2" (2,5): Wings still spread, the wyrm sways with predatory menace. The magma cracks between scales blaze brighter and its spiked tail lashes side to side. The fierce yellow eyes lock on prey.

ROW 3 — Battle Idle 3, Attack, Cast Start:
  Header "Battle Idle 3" (3,0): Magma Wyrm holds its aggressive stance, wings half-spread and mouth aglow. Heat shimmer rises from its entire body and the ground beneath its claws shows faint scorch marks.
  Header "Attack 1" (3,1): Wind-up — the wyrm rears its head back, mouth opening wide. Fire builds in its throat, visible as a growing orange glow behind its glowing fangs. The body coils for a lunge.
  Header "Attack 2" (3,2): Lunging bite — Magma Wyrm snaps forward with jaws wide, fire streaming from the corners of its mouth. Its fore-claws extend and the spiked tail counterbalances the strike.
  Header "Attack 3" (3,3): Follow-through — a small burst of fire breath erupts from its mouth, bathing the area ahead in orange flame. Its wings flare from the effort and the charcoal horns gleam with reflected fire.
  Header "Cast 1" (3,4): Magma Wyrm rears up on its hind legs, wings spread wide. Its scales crack open wider revealing the bright magma beneath, and its entire body begins to glow from within.
  Header "Cast 2" (3,5): Standing on hind legs, the wyrm roars skyward as magma seeps from every scale crack. The deep red wing membranes are backlit by the internal fire and its eyes blaze white-hot.

ROW 4 — Cast 3, Damage, KO Start:
  Header "Cast 3" (4,0): Volcanic eruption — magma bursts from the cracks across its body in a small explosive release. Fire geysers erupt around the wyrm as it roars, wings fully spread and tail lashing.
  Header "Damage 1" (4,1): Magma Wyrm recoils from a hit, several scales cracking and falling away to reveal cooling grey stone beneath. Its wings flinch inward and a pained snarl shows dimming fangs.
  Header "Damage 2" (4,2): Staggering on its claws, more scales crack and the magma beneath begins cooling. The fierce yellow eyes dim and the fire in its mouth sputters. The spiked tail droops.
  Header "Damage 3" (4,3): Recovery — the wyrm shakes itself, reigniting some of the cooling cracks with renewed orange glow. It snarls defiantly and plants its claws, though patches of grey cooled stone remain.
  Header "KO 1" (4,4): The wyrm's wings crumple and fold as the fire inside dies. Its scales cool rapidly to dark grey, the magma cracks solidifying. It drops to its belly with dimming yellow eyes.
  Header "KO 2" (4,5): Collapsing onto its side, the wings splay lifelessly. The once-glowing fangs are dark and the spiked tail lies still. Grey cooled stone spreads across its body.

ROW 5 — KO 3, Victory, Status Poses:
  Header "KO 3" (5,0): Magma Wyrm lies curled up, its scales fully cooled to dark grey stone. No glow remains in the cracks, the eyes are closed, and it resembles a small stone statue of a dragon.
  Header "Victory 1" (5,1): Magma Wyrm rears up and roars triumphantly, a plume of fire shooting from its mouth. Its wings spread fully showing the deep red membranes and every scale crack blazes brilliant orange.
  Header "Victory 2" (5,2): Wings spread wide, the wyrm stamps its fore-claws proudly. Sparks fly from beneath its charcoal claws and its fierce yellow eyes burn with wild satisfaction.
  Header "Victory 3" (5,3): Magma Wyrm settles into a proud sitting pose, wings folded neatly and spiked tail curled around its body. Small flames flicker contentedly from its nostrils and the magma cracks pulse warmly.
  Header "Weak Pose" (5,4): The wyrm hunches low, wings drooping and barely folded. Most magma cracks have cooled to dim orange, the eyes are half-lidded, and only faint smoke rises from its closed mouth.
  Header "Critical Pose" (5,5): Barely standing on trembling claws, the wyrm is mostly cooled grey stone with only a few faint orange cracks remaining. Its eyes are barely yellow slits and the wings drag on the ground.`,
    },
    {
      id: 'mosskin-spirit',
      name: "Mosskin Spirit",
      genre: "Classic Fantasy",
      description: "A gentle forest spirit NPC whose body is formed from intertwined bark, leaves, and moss. A rounded head with two large glowing green eyes and a small peaceful smile. Short stubby limbs with leaf-like hands. Small flowers and mushrooms sprout from its shoulders.",
      equipment: "",
      colorNotes: "Body is mottled brown bark with patches of vibrant green moss. Leaves are various greens from bright lime to deep forest green. Eyes glow soft emerald. Flowers are tiny white and pale yellow. Mushrooms are red with white spots. A faint green aura surrounds it.",
      rowGuidance: `ROW 0 — Walk Down & Walk Up:
  Header "Walk Down 1" (0,0): Mosskin Spirit waddles forward on its left stubby leg, the bark-and-moss body tilting gently. The small flowers on its shoulders bob and the red-spotted mushrooms sway. Tiny green spores drift from its mossy patches.
  Header "Walk Down 2" (0,1): Neutral mid-step with both stubby legs together, the rounded head facing the viewer. Its large glowing emerald eyes blink peacefully and the small mouth curves in its gentle smile.
  Header "Walk Down 3" (0,2): Mirror of Walk Down 1 — right stubby leg leads, body tilting the other way. The leaf-like hands wave for balance and the shoulder flowers bob in the opposite direction.
  Header "Walk Up 1" (0,3): Facing away with left leg forward, the mottled brown bark back is visible with patches of vibrant green moss. The shoulder mushrooms and flowers are seen from behind with the faint green aura.
  Header "Walk Up 2" (0,4): Neutral mid-step facing away, the intertwined bark texture covering its rounded back. Small leaves of various greens protrude from its form and tiny spores drift upward.
  Header "Walk Up 3" (0,5): Mirror of Walk Up 1 — right leg forward facing away, body tilting. The red-and-white spotted mushrooms sway and the pale yellow flowers nod with the waddling motion.

ROW 1 — Walk Left & Walk Right:
  Header "Walk Left 1" (1,0): Mosskin Spirit waddles left on its left stubby leg, leaf-like hands reaching forward. Its profile shows the rounded bark head, glowing emerald eye, and the shoulder mushrooms and flowers.
  Header "Walk Left 2" (1,1): Neutral contact pose facing left, stubby legs together. The mottled bark body with moss patches is visible in profile and the faint green aura outlines its gentle form.
  Header "Walk Left 3" (1,2): Mirror of Walk Left 1 — right leg leads while facing left. The flowers bob forward and spores trail behind the waddling spirit in a small green cloud.
  Header "Walk Right 1" (1,3): Facing right with right stubby leg forward, the leaf-like hands wave gently. The shoulder flowers lean forward with momentum and the peaceful smile is visible in profile.
  Header "Walk Right 2" (1,4): Neutral contact pose facing right, body upright. The various green leaves protruding from its bark body catch the light and the emerald eye glows softly.
  Header "Walk Right 3" (1,5): Mirror of Walk Right 1 — left leg leads while facing right, mushrooms swaying. The gentle waddling motion sends tiny spores drifting from its mossy patches.

ROW 2 — Idle & Battle Idle:
  Header "Idle Down" (2,0): Mosskin Spirit sways gently like a tree in a breeze, facing the viewer. The shoulder mushrooms pulse with faint bioluminescence and the large emerald eyes blink slowly and contentedly.
  Header "Idle Up" (2,1): Swaying facing away, the bark back with moss patches is on display. Tiny white flowers bloom and close in a slow rhythm and the green aura pulses peacefully.
  Header "Idle Left" (2,2): Facing left in a gentle sway, one leaf-like hand raised slightly as if sensing the wind. The emerald eye glows warmly and the red-spotted mushroom tilts toward the light.
  Header "Idle Right" (2,3): Facing right, swaying gently. The rounded bark head tilts with curiosity and the shoulder flowers and mushrooms sway in their own gentle rhythm. Spores drift lazily.
  Header "Battle Idle 1" (2,4): Mosskin Spirit plants its stubby feet as small roots spread outward from beneath them, anchoring it to the ground. Its emerald eyes brighten intensely and the bark body hardens visibly.
  Header "Battle Idle 2" (2,5): Roots deepen as the spirit braces itself, the bark plates tightening. The green aura intensifies and the mushrooms and flowers glow brighter, channeling forest energy.

ROW 3 — Battle Idle 3, Attack, Cast Start:
  Header "Battle Idle 3" (3,0): Rooted firmly, the Mosskin Spirit stands with hardened bark armor and blazing emerald eyes. The green aura crackles with nature energy and the mushrooms pulse with defensive light.
  Header "Attack 1" (3,1): Wind-up — a vine extends rapidly from the spirit's leaf-like hand, coiling back like a whip. Thorns sprout along the vine and the bark body leans into the strike.
  Header "Attack 2" (3,2): Vine lash — the thorned vine whips forward in a sharp crack, extending to the edge of the cell. Leaves scatter from the motion and the emerald eyes flash with uncharacteristic ferocity.
  Header "Attack 3" (3,3): Follow-through — the vine retracts as small thorns scatter at the impact point. The Mosskin Spirit rebalances on its stubby legs and the bark plates settle back into place.
  Header "Cast 1" (3,4): The spirit closes its emerald eyes and raises both leaf-like hands, communing with the forest. A circle of glowing green leaves begins spinning around it and the green aura expands.
  Header "Cast 2" (3,5): The leaf circle intensifies into a spinning ring of forest magic. Tiny flowers bloom and wilt rapidly within the spell circle and the mushrooms on its shoulders glow brilliant red.

ROW 4 — Cast 3, Damage, KO Start:
  Header "Cast 3" (4,0): Massive root eruption — thick roots burst from the ground around the spirit in a small ring, twisting upward with green energy. The Mosskin Spirit directs them with outstretched leaf-hands.
  Header "Damage 1" (4,1): The Mosskin Spirit stumbles from a hit, bark cracking along one side. Several leaves fall from its body and the shoulder flowers wilt from the shock. Its emerald eyes wince.
  Header "Damage 2" (4,2): Staggering back, more bark cracks and moss patches dry and brown at the edges. A mushroom breaks off from one shoulder and the green aura flickers weakly.
  Header "Damage 3" (4,3): Recovery — the spirit steadies itself, new moss slowly creeping over the cracked bark. Its emerald eyes reopen with determination and tiny buds push through the damaged areas.
  Header "KO 1" (4,4): The roots anchoring the spirit retract into the ground as its stubby legs weaken. The bark body starts splitting and leaves fall rapidly. The emerald eye glow fades to dim.
  Header "KO 2" (4,5): The Mosskin Spirit topples forward, its bark body separating at the cracks. Flowers and mushrooms fall off and the green aura gutters out. It crumbles slowly.

ROW 5 — KO 3, Victory, Status Poses:
  Header "KO 3" (5,0): A small pile of bark fragments, dried leaves, and fallen mushrooms lies on the ground — all that remains of the spirit. The emerald eye glow has vanished and only a faint green wisp lingers above.
  Header "Victory 1" (5,1): Mosskin Spirit blooms with joy — dozens of tiny white and yellow flowers burst open across its body. Its emerald eyes are bright crescents of happiness and it does a little stomping dance.
  Header "Victory 2" (5,2): The spirit waves its leaf-like hands as a shower of green spores and flower petals erupts around it. New mushrooms sprout on its shoulders and the green aura blazes with life.
  Header "Victory 3" (5,3): Mosskin Spirit settles into a content pose, flowers in full bloom and mushrooms glowing softly. Its peaceful smile widens and it hugs itself with its stubby leaf-hands.
  Header "Weak Pose" (5,4): The spirit droops visibly, leaves wilting and turning brown at the edges. The mushrooms are shriveled and the flowers have closed. Its emerald eyes are dim and it sways unsteadily.
  Header "Critical Pose" (5,5): Barely standing, the bark body is cracked throughout and most leaves have browned and fallen. The emerald eyes are faint flickers, the aura is nearly invisible, and it trembles like a dying plant.`,
    },
    {
      id: 'voidmaw-parasite',
      name: "Voidmaw Parasite",
      genre: "Sci-Fi Horror",
      description: "A writhing alien parasite with a segmented, chitinous body that ends in a lamprey-like circular mouth lined with concentric rings of needle-thin teeth. Four hooked appendages on each side used for latching onto hosts. A pulsing translucent sac on its back reveals dark fluid inside. Two vestigial eye-stalks protrude from the head segment.",
      equipment: "",
      colorNotes: "Oily black chitin with iridescent purple-green sheen. Mouth interior is raw pinkish-red. Back sac is translucent milky grey with dark violet fluid. Eye-stalks tip with dull yellow bioluminescent orbs. Hooked legs are dark gunmetal with rust-red tips.",
      rowGuidance: `ROW 0 — Walk Down & Walk Up:
  Header "Walk Down 1" (0,0): Voidmaw Parasite undulates forward with its left-side hooks pulling it ahead, the segmented chitinous body rippling with oily black-and-purple sheen. The translucent back sac pulses rhythmically and the dull yellow eye-stalks point toward the viewer.
  Header "Walk Down 2" (0,1): Mid-slither with the body contracted, hooks repositioning for the next pull. The lamprey mouth faces forward with its concentric rings of needle teeth visible. The back sac compresses with the contraction.
  Header "Walk Down 3" (0,2): Mirror of Walk Down 1 — right-side hooks pull forward, body undulating in the opposite wave. The iridescent purple-green sheen shifts across the chitin and the dark violet fluid sloshes in the sac.
  Header "Walk Up 1" (0,3): Facing away with left hooks leading, the translucent back sac with dark violet fluid is prominently displayed. The segmented chitinous body shows the iridescent sheen from behind and the hooked legs scrape forward.
  Header "Walk Up 2" (0,4): Mid-slither facing away, body contracted. The rust-red tips of the hooks are visible gripping the ground and the segmented chitin plates overlap in their compressed state.
  Header "Walk Up 3" (0,5): Mirror of Walk Up 1 — right hooks lead facing away, sac fluid sloshing with the undulation. The vestigial eye-stalks trail behind the head segment.

ROW 1 — Walk Left & Walk Right:
  Header "Walk Left 1" (1,0): Voidmaw slithers left with its left hooks pulling, body in profile showing the segmented chitin. The back sac bulges visibly and the eye-stalks wave in the direction of travel. The lamprey mouth opens slightly.
  Header "Walk Left 2" (1,1): Mid-slither facing left, body contracted and hooks repositioning. The oily black chitin shows its iridescent purple-green sheen in profile and the rust-red hook tips grip the surface.
  Header "Walk Left 3" (1,2): Mirror of Walk Left 1 — right hooks pull while facing left, body extending. The pulsing sac stretches with the movement and the dark gunmetal hooks flash their rust-red tips.
  Header "Walk Right 1" (1,3): Slithering right with right hooks leading, the full segmented profile is visible. The eye-stalks point rightward with dull yellow bioluminescence and the sac fluid shifts with momentum.
  Header "Walk Right 2" (1,4): Mid-slither facing right, contracted and compact. The lamprey mouth shows its pinkish-red interior and needle teeth in profile. The chitin plates overlap tightly.
  Header "Walk Right 3" (1,5): Mirror of Walk Right 1 — left hooks pull while facing right. The back sac pulses and the iridescent sheen ripples across the extending segments.

ROW 2 — Idle & Battle Idle:
  Header "Idle Down" (2,0): Voidmaw Parasite is coiled in a loose spiral facing the viewer, eye-stalks scanning slowly. The back sac pulses with a slow heartbeat rhythm and the hooks are tucked beneath its body. The lamprey mouth is closed to a slit.
  Header "Idle Up" (2,1): Coiled facing away, the translucent sac and segmented back dominate the view. The dull yellow eye-stalks peek over the head segment and the hooks rest along its sides.
  Header "Idle Left" (2,2): Coiled facing left, one eye-stalk visible scanning ahead. The oily chitin reflects light in iridescent bands and the sac pulses gently. The rust-red hook tips peek from beneath.
  Header "Idle Right" (2,3): Coiled facing right, the lamprey mouth visible as a thin slit in the head segment. The back sac shows the dark violet fluid shifting slowly and the eye-stalks drift lazily.
  Header "Battle Idle 1" (2,4): Voidmaw rears its front segments upward, lamprey mouth opening wide to reveal concentric rings of needle teeth. The hooks spread wide from its sides and the back sac swells aggressively. Eye-stalks lock forward.
  Header "Battle Idle 2" (2,5): Swaying in its reared stance, the parasite hisses with the mouth fully open. The pinkish-red mouth interior glistens and the hooks flex menacingly. The sac pulses rapidly with dark violet fluid.

ROW 3 — Battle Idle 3, Attack, Cast Start:
  Header "Battle Idle 3" (3,0): Voidmaw holds its reared threat posture, hooks spread wide and mouth gaping. The eye-stalks lock on the target with intensified yellow glow and the chitin sheen ripples with agitation.
  Header "Attack 1" (3,1): Wind-up — the parasite coils its body tight like a spring, mouth opening wider. The hooks extend forward in a grasping formation and the back sac compresses, building internal pressure.
  Header "Attack 2" (3,2): Lunge — Voidmaw launches forward, hooks clamping outward to grab. The lamprey mouth leads the strike, needle teeth splayed in concentric rings. The body stretches taut behind it.
  Header "Attack 3" (3,3): Latch and drill — the hooks clamp onto the target area and the mouth presses forward, teeth rotating. The sac pulses rapidly and the entire body writhes with feeding frenzy energy.
  Header "Cast 1" (3,4): The back sac begins swelling dramatically, the translucent membrane stretching to reveal the dark violet fluid churning inside. The eye-stalks retract and the chitin plates seal tightly.
  Header "Cast 2" (3,5): The sac reaches maximum distension, glowing faintly violet through the milky grey membrane. A toxic haze begins seeping from pores along the segments and the hooks brace the body.

ROW 4 — Cast 3, Damage, KO Start:
  Header "Cast 3" (4,0): The sac ruptures in a controlled burst, spraying a cloud of dark violet acid from the pores along its body. The toxic cloud spreads within the cell and the parasite shudders from the exertion.
  Header "Damage 1" (4,1): Voidmaw recoils from a hit, chitin cracking along one segment. Dark violet fluid leaks from the crack and the eye-stalks flinch back. The hooks clench reflexively inward.
  Header "Damage 2" (4,2): Writhing in pain, more chitin plates crack and the oily sheen dulls on the damaged segments. The back sac deflates slightly and the lamprey mouth emits a silent shriek.
  Header "Damage 3" (4,3): Recovery — the parasite coils tightly around its damaged segments, the hooks guarding its body. The eye-stalks re-emerge cautiously and the chitin slowly seals over the worst cracks.
  Header "KO 1" (4,4): Voidmaw curls inward as its segments seize, hooks twitching spasmodically. The back sac deflates and the dull yellow eye-stalk lights fade. The lamprey mouth gapes open and limp.
  Header "KO 2" (4,5): The parasite collapses into a loose coil, hooks limp and splayed. The chitin loses its iridescent sheen turning matte black and the sac is flat and empty.

ROW 5 — KO 3, Victory, Status Poses:
  Header "KO 3" (5,0): A shriveled husk of matte black chitin lies in a loose coil. The sac is completely flat, the hooks are rigid and curled, and the eye-stalks are dark. No movement remains.
  Header "Victory 1" (5,1): Voidmaw rears triumphantly, the lamprey mouth open in a victorious display of needle teeth. The back sac glows with renewed violet fluid and all hooks spread wide in dominance.
  Header "Victory 2" (5,2): The parasite sways in its reared pose, the eye-stalks pulsing bright yellow. The iridescent chitin sheen ripples in bands of purple and green and the sac pulses with a fast, healthy rhythm.
  Header "Victory 3" (5,3): Voidmaw settles into a coiled throne pose, hooks tucked neatly, sac glowing contentedly. The eye-stalks blink slowly with satisfaction and the lamprey mouth closes to a smug slit.
  Header "Weak Pose" (5,4): The parasite sags loosely, hooks limp and barely gripping. The back sac is deflated and the eye-stalks droop. The chitin is dull and the segments barely undulate with weakened movement.
  Header "Critical Pose" (5,5): Nearly motionless, Voidmaw lies in a loose uncoiled line. The hooks twitch feebly, the sac is flat, and only one eye-stalk manages a faint yellow flicker. The chitin is cracked and lightless.`,
    },
    {
      id: 'fluxbot-drone',
      name: "Fluxbot Drone",
      genre: "Sci-Fi",
      description: "A small hovering maintenance drone with a spherical chrome body, a single large blue optical lens, and three articulated tool-arms folding neatly underneath. Two anti-gravity fins rotate slowly on either side. A ring of status LEDs encircles its equator. Friendly and curious demeanor despite being fully mechanical.",
      equipment: "",
      colorNotes: "Polished chrome body with brushed steel panels. Main lens is bright cyan-blue with a white focal point. Anti-grav fins are matte dark grey with cyan edge lighting. LED ring cycles through soft blue and green. Tool-arms are gunmetal with orange safety markings at the joints.",
      rowGuidance: `ROW 0 — Walk Down & Walk Up:
  Header "Walk Down 1" (0,0): Fluxbot Drone hovers forward with a slight leftward tilt, the spherical chrome body gleaming. The anti-gravity fins rotate steadily on either side with cyan edge lighting, and the LED ring pulses soft blue.
  Header "Walk Down 2" (0,1): Level hover in a neutral position, the large cyan-blue optical lens facing the viewer with its white focal point. The LED ring cycles to soft green and the tool-arms fold neatly underneath.
  Header "Walk Down 3" (0,2): Mirror of Walk Down 1 — slight rightward tilt while hovering forward. The polished chrome body reflects the environment and the anti-grav fins adjust their rotation angle.
  Header "Walk Up 1" (0,3): Hovering away with a slight leftward tilt, the brushed steel back panels and anti-grav fin mechanisms are visible. The LED ring glows soft blue from behind and the tool-arms tuck underneath.
  Header "Walk Up 2" (0,4): Level hover facing away, the chrome body reflecting from behind. The two anti-grav fins spin steadily with cyan edge lighting creating small light trails.
  Header "Walk Up 3" (0,5): Mirror of Walk Up 1 — slight rightward tilt facing away. The LED ring cycles through colors and the gunmetal tool-arm joints peek from beneath the spherical body.

ROW 1 — Walk Left & Walk Right:
  Header "Walk Left 1" (1,0): Fluxbot tilts left toward the direction of travel, the chrome sphere gleaming in profile. The near anti-grav fin speeds up while the far one slows, and the cyan-blue lens looks ahead.
  Header "Walk Left 2" (1,1): Level hover facing left, the LED ring visible as a band of cycling blue-green light around the equator. The optical lens focuses forward and the tool-arms hang underneath in profile.
  Header "Walk Left 3" (1,2): Mirror of Walk Left 1 — tilted left with adjusted fin speeds. The polished chrome catches a reflection and the orange safety markings on the tool-arm joints are visible from this angle.
  Header "Walk Right 1" (1,3): Fluxbot tilts right, the chrome body reflecting as it moves. The near fin adjusts speed and the cyan-blue lens scans the path ahead. The LED ring pulses green.
  Header "Walk Right 2" (1,4): Level hover facing right, the spherical body in perfect profile. The anti-grav fins spin symmetrically and the white focal point of the lens is visible as a bright dot.
  Header "Walk Right 3" (1,5): Mirror of Walk Right 1 — tilted right with the far fin compensating. The brushed steel panels are visible in the chrome reflections and the LED ring shifts to blue.

ROW 2 — Idle & Battle Idle:
  Header "Idle Down" (2,0): Fluxbot Drone hovers at rest facing the viewer, bobbing gently up and down. The large cyan-blue lens tilts curiously and the LED ring cycles through calm blue-green patterns. The chrome body gleams.
  Header "Idle Up" (2,1): Hovering at rest facing away, the anti-grav fins idle slowly. The brushed steel panels catch light and the LED ring pulses softly. The tool-arms hang relaxed underneath.
  Header "Idle Left" (2,2): Facing left in an idle hover, the lens focuses on something with a curious tilt. The chrome sphere reflects its surroundings and the fins rotate lazily.
  Header "Idle Right" (2,3): Facing right, hovering with gentle bobs. The lens white focal point adjusts and the LED ring shows a friendly green pattern. The drone radiates curious, friendly energy.
  Header "Battle Idle 1" (2,4): Fluxbot snaps to alert — the optical lens turns from cyan-blue to bright red, tool-arms deploy from underneath in a defensive array. The LED ring flashes rapid orange warnings and the fins spin faster.
  Header "Battle Idle 2" (2,5): Hovering with agitation, the red lens scans for threats. The tool-arms are splayed defensively — one ends in a small arc welder, another in a gripper claw. The chrome body vibrates with energy.

ROW 3 — Battle Idle 3, Attack, Cast Start:
  Header "Battle Idle 3" (3,0): Fluxbot holds its combat hover, red lens locked forward and tool-arms at the ready. The LED ring strobes orange and the anti-grav fins are at maximum spin with bright cyan edges.
  Header "Attack 1" (3,1): Wind-up — one tool-arm extends forward, the arc welder tip charging with a bright orange-white glow. The chrome body braces and the other arms stabilize the drone against recoil.
  Header "Attack 2" (3,2): The arc welder fires a concentrated beam of orange-white energy in a short, precise blast. The chrome body rocks backward from the discharge and the red lens narrows.
  Header "Attack 3" (3,3): Follow-through — the second tool-arm swings forward with the gripper claw in a physical strike. The arc welder vents heat and the LED ring flashes with the exertion.
  Header "Cast 1" (3,4): Fluxbot projects a wide scanning beam from its lens, now blue again. The beam sweeps in a cone, and the tool-arms begin assembling small glowing particles — repair nanobots — from an internal dispenser.
  Header "Cast 2" (3,5): A cloud of tiny glowing cyan nanobots swarms around the drone, orbiting the chrome body. The LED ring cycles rapidly through blue and green as it coordinates the nanobots.

ROW 4 — Cast 3, Damage, KO Start:
  Header "Cast 3" (4,0): EMP burst — the LED ring blazes blindingly bright, then discharges a ring of crackling blue-white energy outward from the equator. The chrome body dims momentarily from the power drain.
  Header "Damage 1" (4,1): Fluxbot jolts from a hit, sparking at the impact point on its chrome body. The drone spins off-axis briefly and the lens flickers. One anti-grav fin stutters in its rotation.
  Header "Damage 2" (4,2): Spinning erratically, a panel of brushed steel cracks on the chrome body. The lens develops a visible fracture line and the LED ring shows static patterns. Sparks crackle from a tool-arm joint.
  Header "Damage 3" (4,3): Recovery — Fluxbot stabilizes its spin, re-leveling with visible effort. The cracked lens refocuses and the LED ring reboots to a steady pattern. One fin is slower than the other.
  Header "KO 1" (4,4): Power failing — the anti-grav fins slow and stutter, causing the drone to sink. The lens dims from cyan to grey and the LED ring goes dark one segment at a time. Tool-arms droop.
  Header "KO 2" (4,5): Fluxbot drops to the ground with a metallic thud, the chrome body rolling to a stop. The fins stop spinning and the lens is dark. A last spark crackles from the LED ring.

ROW 5 — KO 3, Victory, Status Poses:
  Header "KO 3" (5,0): Fluxbot Drone lies on the ground, chrome body scratched and dull. The lens is dark and cracked, the fins are motionless, and the LED ring is dead. Occasional sparks crackle from exposed joints.
  Header "Victory 1" (5,1): Fluxbot spins happily in place, the chrome body gleaming as the LED ring cycles through a rainbow of celebratory colors. The lens glows bright cyan with a heart-shaped focal point.
  Header "Victory 2" (5,2): The drone does a little aerial loop, tool-arms extended in a whee pose. The anti-grav fins spin at full speed with brilliant cyan trails and the lens beams happily.
  Header "Victory 3" (5,3): Fluxbot hovers proudly, giving a thumbs-up with one tool-arm gripper. The LED ring displays a scrolling smiley pattern and the chrome body is polished to a perfect shine.
  Header "Weak Pose" (5,4): Fluxbot hovers low and unsteadily, the anti-grav fins sputtering. The lens flickers between dim cyan and dark, the LED ring is mostly unlit, and one tool-arm hangs limp.
  Header "Critical Pose" (5,5): Barely hovering inches off the ground, the chrome body is dented and sparking. The lens strobes weakly, both fins stutter, and the LED ring shows only a single blinking red segment.`,
    },
    {
      id: 'spore-lurker',
      name: "Spore Lurker",
      genre: "Sci-Fi Horror",
      description: "A fungal alien organism that resembles a crouching mass of fleshy tendrils topped with a cluster of bulbous spore pods. No visible eyes — instead it senses via vibration through fine cilia covering its surface. When threatened, the pods swell and release clouds of toxic green spores. Moves with an unsettling undulating crawl.",
      equipment: "",
      colorNotes: "Fleshy pale mauve and grey tendrils with sickly yellow-green veining. Spore pods are swollen dark purple with bright toxic-green tips that glow faintly. Cilia are near-white and shimmer slightly. Underside is wet-looking dark reddish-brown.",
      rowGuidance: `ROW 0 — Walk Down & Walk Up:
  Header "Walk Down 1" (0,0): Spore Lurker crawls forward with its left-side tendrils pulling, the fleshy pale mauve mass undulating. The cluster of dark purple spore pods sways atop the body and the near-white cilia ripple in a wave toward the viewer.
  Header "Walk Down 2" (0,1): Mid-crawl with tendrils repositioning, the body contracted. The sickly yellow-green veining pulses through the tendrils and the toxic-green tips of the spore pods glow faintly.
  Header "Walk Down 3" (0,2): Mirror of Walk Down 1 — right-side tendrils pull forward, body undulating the opposite direction. The dark reddish-brown underside peeks through as the mass shifts and the cilia shimmer.
  Header "Walk Up 1" (0,3): Crawling away with left tendrils leading, the cluster of spore pods visible from behind atop the fleshy mass. The wet-looking underside is partially visible and the cilia ripple away from the viewer.
  Header "Walk Up 2" (0,4): Mid-crawl facing away, contracted. The pale mauve and grey tendrils overlap in their compressed state and the yellow-green veining is prominent across the back surface.
  Header "Walk Up 3" (0,5): Mirror of Walk Up 1 — right tendrils lead facing away. The spore pods sway and the toxic-green tips glow against the dark purple bulbs. Cilia shimmer across the body surface.

ROW 1 — Walk Left & Walk Right:
  Header "Walk Left 1" (1,0): Spore Lurker crawls left with tendrils pulling in that direction, the profile showing the fleshy mass topped with spore pods. The cilia ripple along the surface and the underside shows dark reddish-brown.
  Header "Walk Left 2" (1,1): Mid-crawl facing left, contracted. The yellow-green veining pulses in the tendrils and the spore pods cluster tightly atop the compressed body. Cilia shimmer in the ambient light.
  Header "Walk Left 3" (1,2): Mirror of Walk Left 1 — opposite tendrils pull while facing left. The dark purple spore pods bob and the toxic-green tips leave faint trails of luminescence.
  Header "Walk Right 1" (1,3): Crawling right with tendrils extending, the pale mauve mass stretches. The spore pods lean in the direction of travel and the near-white cilia create a shimmering wave pattern across its skin.
  Header "Walk Right 2" (1,4): Mid-crawl facing right, body compressed. The sickly yellow-green veining is bright against the grey tendril flesh and the reddish-brown underside grips the surface.
  Header "Walk Right 3" (1,5): Mirror of Walk Right 1 — opposite tendrils pull while facing right. The fleshy mass undulates and the spore pod cluster sways with the unsettling crawling motion.

ROW 2 — Idle & Battle Idle:
  Header "Idle Down" (2,0): Spore Lurker sits in a compact mass facing the viewer, pulsing slowly. The spore pods are dormant with faintly glowing green tips and the cilia wave gently, sensing vibrations.
  Header "Idle Up" (2,1): Resting facing away, the cluster of spore pods visible above the tendril mass. The pale mauve flesh breathes slowly and the yellow-green veining dims in the relaxed state.
  Header "Idle Left" (2,2): Facing left at rest, tendrils loosely coiled. The spore pod cluster sits atop the mass in profile and the cilia shimmer along the surface in slow rhythmic waves.
  Header "Idle Right" (2,3): Facing right, the Lurker pulses gently. The dark reddish-brown underside anchors to the ground and the toxic-green spore tips glow with a dim, regular pulse.
  Header "Battle Idle 1" (2,4): The spore pods swell visibly, the dark purple bulbs expanding with internal pressure. The cilia stand erect across the entire surface and the tendrils spread outward aggressively. The toxic-green tips blaze.
  Header "Battle Idle 2" (2,5): Tendrils spread wider as the pods swell further, green tips glowing intensely. The yellow-green veining throbs faster and the cilia vibrate with hostile sensing activity.

ROW 3 — Battle Idle 3, Attack, Cast Start:
  Header "Battle Idle 3" (3,0): Fully agitated, the Spore Lurker holds its spread posture with swollen pods and erect cilia. The toxic-green glow is at maximum and the fleshy mass vibrates with aggressive energy.
  Header "Attack 1" (3,1): Wind-up — a thick tendril rears back from the mass, the pale mauve flesh taut with coiled power. The yellow-green veining bulges along its length and the cilia flatten for aerodynamics.
  Header "Attack 2" (3,2): Tendril lash — the thick tendril whips forward, its tip splitting open to reveal reddish-brown inner flesh. The strike extends to the edge of the cell and the body lurches forward.
  Header "Attack 3" (3,3): A spore pod at the tendril tip bursts on impact, releasing a small cloud of toxic green spores. The pod deflates and the tendril retracts while the green cloud hangs in the air.
  Header "Cast 1" (3,4): All spore pods begin swelling dramatically, the dark purple membranes stretching thin to show the toxic green spore mass inside. The entire body hunkers down and the cilia flatten.
  Header "Cast 2" (3,5): The pods reach critical swelling, toxic-green light shining through the stretched purple membranes. A haze of green begins seeping from micro-pores and the tendrils brace the body.

ROW 4 — Cast 3, Damage, KO Start:
  Header "Cast 3" (4,0): Toxic spore explosion — all pods burst simultaneously, releasing a dense cloud of glowing green spores that fills the cell. The Lurker shudders at the center, pods deflated and dripping.
  Header "Damage 1" (4,1): The Lurker recoils from a hit, tendrils flinching inward. Several cilia are torn off and float away. A spore pod pops prematurely, leaking green fluid, and the yellow-green veining flickers.
  Header "Damage 2" (4,2): More tendrils curl protectively as the fleshy mass takes damage. The pale mauve skin tears in places showing darker inner tissue and another pod ruptures, deflating with a hiss.
  Header "Damage 3" (4,3): Recovery — the Lurker reshapes its mass, surviving tendrils covering the wounds. The remaining spore pods slowly re-inflate and the cilia begin sensing again, though many are broken.
  Header "KO 1" (4,4): The tendrils go limp one by one, collapsing from the outside in. The spore pods deflate and droop, their green tips going dark. The mass sags as it loses structural integrity.
  Header "KO 2" (4,5): The Lurker collapses into a formless heap, tendrils splayed and motionless. The pods are flat and empty, the cilia are still, and the yellow-green veining goes dark.

ROW 5 — KO 3, Victory, Status Poses:
  Header "KO 3" (5,0): A deflated mass of pale mauve tendrils lies flat on the ground, spore pods empty and withered. The toxic-green glow has died completely and a few last spores settle like dust around it.
  Header "Victory 1" (5,1): The Lurker puffs up triumphantly, all pods swelling with renewed vigor. The toxic-green tips blaze and the cilia wave in organized patterns. New tiny pods bud from the tendril mass.
  Header "Victory 2" (5,2): Tendrils wave slowly in a display of dominance, the spore pods pulsing with healthy green glow. The yellow-green veining throbs with strong circulation and the cilia shimmer brilliantly.
  Header "Victory 3" (5,3): The Spore Lurker settles into a satisfied mound, new growth visible as tiny tendrils and buds push from its surface. The pods glow contentedly and the cilia wave in gentle, peaceful patterns.
  Header "Weak Pose" (5,4): The Lurker is dried and shrunken, tendrils thin and brittle. Most spore pods are empty and the remaining ones glow a sickly dim green. The cilia are wilted and barely moving.
  Header "Critical Pose" (5,5): Nearly desiccated, the Lurker is a fraction of its normal size. The tendrils are cracked and brown, pods shriveled, and only a faint green flicker remains at the tip of the largest surviving pod.`,
    },
    {
      id: 'arc-jelly',
      name: "Arc Jelly",
      genre: "Sci-Fi",
      description: "A bioluminescent deep-space jellyfish creature with a translucent dome-shaped bell and long trailing tentacles that crackle with electrical arcs. Inside the bell, a dense cluster of neural filaments pulses with light. Drifts gracefully through zero-gravity environments. Peaceful unless provoked, at which point its tentacles discharge powerful electric shocks.",
      equipment: "",
      colorNotes: "Bell is translucent pale blue-white with a soft inner glow. Neural filaments pulse between electric blue and bright white. Tentacles are near-transparent with vivid cyan-to-violet electrical arcs running along their length. Outer bell rim has a faint pink-magenta bioluminescent edge.",
      rowGuidance: `ROW 0 — Walk Down & Walk Up:
  Header "Walk Down 1" (0,0): Arc Jelly drifts forward with a gentle bell contraction, the translucent dome compressing and pushing it ahead-left. The neural filaments pulse electric blue and the trailing tentacles sway with small cyan arcs crackling.
  Header "Walk Down 2" (0,1): At the peak of bell expansion, the dome is fully open showing the dense cluster of neural filaments glowing bright white inside. The tentacles trail straight below and the pink-magenta rim pulses softly.
  Header "Walk Down 3" (0,2): Mirror of Walk Down 1 — bell contracting and pushing ahead-right, tentacles swaying the opposite direction. The electrical arcs along the tentacles shift from cyan to violet as they move.
  Header "Walk Up 1" (0,3): Drifting away, the translucent bell shows the neural filaments from behind — a soft glow visible through the pale blue-white dome. The tentacles trail toward the viewer with arcs crackling.
  Header "Walk Up 2" (0,4): Bell expanded facing away, the translucent dome catching light. The pink-magenta rim is visible as a glowing edge and the tentacles hang with lazy electrical activity.
  Header "Walk Up 3" (0,5): Mirror of Walk Up 1 — bell contracting away in the opposite direction. The near-transparent tentacles shift and the cyan arcs trace new paths along their length.

ROW 1 — Walk Left & Walk Right:
  Header "Walk Left 1" (1,0): Arc Jelly pulses leftward, the translucent bell contracting in profile. The neural filaments shift with the motion and the tentacles trail rightward with violet-cyan arcs. The pink-magenta rim glows on the leading edge.
  Header "Walk Left 2" (1,1): Bell expanded in profile facing left, the dome at full size. The neural filament cluster is visible through the translucent wall as a glowing core. Tentacles hang with gentle arc activity.
  Header "Walk Left 3" (1,2): Mirror of Walk Left 1 — bell contracting leftward with tentacles swaying. The electrical arcs intensify briefly during the propulsion phase and the bell rim flares pink.
  Header "Walk Right 1" (1,3): Pulsing rightward, the translucent bell contracts and pushes. The tentacles trail leftward with crackling arcs and the neural filaments flash electric blue inside the moving dome.
  Header "Walk Right 2" (1,4): Bell expanded facing right, serene and open. The soft inner glow of the filaments illuminates the translucent dome and the tentacles drift with passive cyan arcs.
  Header "Walk Right 3" (1,5): Mirror of Walk Right 1 — contracting rightward, tentacles trailing. The pink-magenta rim flares on the leading edge and the near-transparent tentacles flash with electrical discharge.

ROW 2 — Idle & Battle Idle:
  Header "Idle Down" (2,0): Arc Jelly floats peacefully facing the viewer, the bell gently pulsing. The neural filaments glow with a calm, slow pulse between blue and white. Tentacles sway below with lazy, gentle arcs.
  Header "Idle Up" (2,1): Floating serenely facing away, the translucent bell glows softly from within. The tentacles drift in zero-gravity currents and the pink-magenta rim pulses at resting rhythm.
  Header "Idle Left" (2,2): Facing left in a peaceful drift, the bell profile shows the neural filament glow. The tentacles trail with occasional small cyan sparks and the dome shimmers translucently.
  Header "Idle Right" (2,3): Facing right, floating calmly. The bell catches light beautifully and the neural filaments pulse in a mesmerizing slow pattern. The tentacles drift with faint electrical whispers.
  Header "Battle Idle 1" (2,4): Arc Jelly contracts its bell aggressively, the dome pulling tight. The neural filaments blaze bright white and the tentacles stiffen, arcs intensifying from lazy sparks to vivid cyan-violet bolts.
  Header "Battle Idle 2" (2,5): In defensive posture, the tentacles spread outward like an electrified cage. The arcs crackle louder and brighter, jumping between tentacles. The bell rim blazes pink-magenta in warning.

ROW 3 — Battle Idle 3, Attack, Cast Start:
  Header "Battle Idle 3" (3,0): Arc Jelly holds its combat posture with tentacles spread and crackling. The neural filaments pulse rapidly between blue and white and the bell vibrates with contained electrical energy.
  Header "Attack 1" (3,1): Wind-up — one tentacle rears back, charging with intense cyan energy. The electrical arc along its length builds to a blinding brightness and the bell contracts in preparation.
  Header "Attack 2" (3,2): Shock lash — the charged tentacle whips forward, discharging a bolt of cyan-violet lightning at the target. The other tentacles flare sympathetically and the bell pulses from the energy release.
  Header "Attack 3" (3,3): Follow-through — the lightning bolt crackles at the edge of the cell as the striking tentacle recoils. Residual arcs dance along all tentacles and the neural filaments flash white.
  Header "Cast 1" (3,4): All neural filaments blaze simultaneously as Arc Jelly enters an overcharge state. The filaments pulse faster and brighter, and energy visibly flows down from the bell into the tentacles.
  Header "Cast 2" (3,5): A massive charge builds — every tentacle blazes with intense electrical energy, arcs jumping between them in a web of lightning. The bell glows from within like a lantern and the rim is incandescent pink.

ROW 4 — Cast 3, Damage, KO Start:
  Header "Cast 3" (4,0): Chain lightning storm — arcs of cyan-violet lightning discharge simultaneously from all tentacles in a radial burst. The bell flashes blindingly white and the neural filaments overload momentarily.
  Header "Damage 1" (4,1): Arc Jelly recoils from a hit, the bell distorting from its dome shape. The neural filaments flicker erratically and several tentacle arcs sputter out. The bell wobbles off-balance.
  Header "Damage 2" (4,2): The bell collapses partially inward, losing its smooth dome shape. The neural filament glow dims unevenly and more tentacles go dark, their arcs dying. The pink-magenta rim fades.
  Header "Damage 3" (4,3): Recovery — the bell slowly re-inflates to its dome shape, though slightly lopsided. The neural filaments reestablish a dim glow and a few tentacles reignite with weak arcs.
  Header "KO 1" (4,4): The bell deflates, losing its dome shape and sagging. The neural filaments go dark one cluster at a time and the tentacles tangle lifelessly, all arcs extinguished.
  Header "KO 2" (4,5): Arc Jelly sinks downward as the bell crumples, tentacles tangling into a limp mass below. The last flickers of bioluminescence fade from the pink rim and the filaments are completely dark.

ROW 5 — KO 3, Victory, Status Poses:
  Header "KO 3" (5,0): A translucent heap of collapsed bell and tangled tentacles lies on the ground. The neural filaments are dark, no arcs remain, and only the faintest blue tint shows it was once luminous.
  Header "Victory 1" (5,1): Arc Jelly blazes with a brilliant light show — the bell fully expanded and glowing, neural filaments pulsing in rapid rainbow patterns. Arcs dance joyfully between all tentacles in cyan, violet, and white.
  Header "Victory 2" (5,2): The tentacles perform a synchronized wave, arcs of light traveling down their lengths in sequence. The bell pulses in rhythm and the pink-magenta rim blazes with celebratory bioluminescence.
  Header "Victory 3" (5,3): Arc Jelly settles into a serene float, the bell glowing warmly with a satisfied inner light. The tentacles drift gracefully with soft, gentle arcs and the neural filaments pulse in a calm, happy pattern.
  Header "Weak Pose" (5,4): The bell sags and barely holds its shape, the inner glow reduced to a faint flicker. Most tentacles hang limp and dark, with only one or two managing dim, sputtering arcs.
  Header "Critical Pose" (5,5): Nearly collapsed, the bell is translucent and shapeless. The neural filaments show only the faintest ghost of light and the tentacles are limp tangles with no electrical activity. Only the fading pink rim shows life.`,
    },
    {
      id: 'rustback-scavenger',
      name: "Rustback Scavenger",
      genre: "Post-Apocalyptic Sci-Fi",
      description: "A six-legged insectoid scavenger built from salvaged mechanical parts fused with organic tissue. Its body is a corroded metal thorax with exposed wiring and a biological abdomen. A pair of mismatched optical sensors serve as eyes — one is a cracked red camera lens, the other a repurposed green scanner. Mandibles fashioned from sharpened scrap metal click constantly.",
      equipment: "",
      colorNotes: "Corroded burnt-orange and rust-brown metal plating over sickly grey-green organic tissue. Wiring is faded yellow and red. Camera-eye glows dim red, scanner-eye glows green. Mandibles are dull gunmetal. Legs alternate between rusted mechanical joints and pale fleshy segments. Abdomen has a faint sickly yellow bioluminescence.",
      rowGuidance: `ROW 0 — Walk Down & Walk Up:
  Header "Walk Down 1" (0,0): Rustback Scavenger skitters forward with its left three legs stepping in sequence, the corroded metal thorax shifting over sickly grey-green organic tissue. The mismatched eyes — cracked red camera and green scanner — face the viewer and the scrap-metal mandibles click.
  Header "Walk Down 2" (0,1): Mid-step with all six legs repositioning, the faded yellow and red wiring bounces from the exposed sections. The biological abdomen with its sickly yellow bioluminescence trails behind the mechanical thorax.
  Header "Walk Down 3" (0,2): Mirror of Walk Down 1 — right three legs step forward, the burnt-orange plating shifting opposite. The mandibles click on the other side and the exposed wiring sways.
  Header "Walk Up 1" (0,3): Skittering away with left legs leading, the biological abdomen with its yellow bioluminescence is prominent from behind. The rusted mechanical leg joints alternate with pale fleshy segments.
  Header "Walk Up 2" (0,4): Mid-step facing away, the corroded metal thorax showing exposed wiring from behind. The six legs reposition and the rust-brown plating is weathered and dented.
  Header "Walk Up 3" (0,5): Mirror of Walk Up 1 — right legs lead facing away, the abdomen swaying. The alternating mechanical and organic leg segments create an unsettling gait pattern.

ROW 1 — Walk Left & Walk Right:
  Header "Walk Left 1" (1,0): Rustback faces left, skittering with three near-side legs cycling forward. The profile shows the corroded thorax, exposed wiring, and the green scanner-eye facing ahead. The mandibles are open.
  Header "Walk Left 2" (1,1): Mid-step facing left, legs repositioning. The rusted mechanical joints creak and the pale fleshy leg segments contract. The abdomen bioluminescence pulses with movement.
  Header "Walk Left 3" (1,2): Mirror of Walk Left 1 — far-side legs cycle while facing left. The cracked red camera-eye is visible on the far side and the wiring bounces with the skittering motion.
  Header "Walk Right 1" (1,3): Facing right with near-side legs leading, the cracked red camera-eye faces ahead. The scrap-metal mandibles click rapidly and the burnt-orange plating reflects dull light.
  Header "Walk Right 2" (1,4): Mid-step facing right, the six-legged gait in transition. The corroded thorax rocks slightly and the biological abdomen sways behind, yellow glow pulsing.
  Header "Walk Right 3" (1,5): Mirror of Walk Right 1 — far-side legs cycle while facing right. The green scanner-eye is visible on the far side and the exposed wiring trails from the thorax.

ROW 2 — Idle & Battle Idle:
  Header "Idle Down" (2,0): Rustback Scavenger stands on all six legs facing the viewer, mandibles twitching with constant clicking. Both mismatched eyes scan — the red camera flickering and the green scanner sweeping. Wiring dangles from the thorax.
  Header "Idle Up" (2,1): Standing facing away, the biological abdomen and its sickly yellow glow are prominent. The six legs are planted firmly and the exposed wiring hangs from the corroded back plating.
  Header "Idle Left" (2,2): Facing left at rest, mandibles clicking idly. The corroded profile shows the mechanical-organic fusion clearly — rust-brown metal meeting grey-green tissue at jagged seams.
  Header "Idle Right" (2,3): Facing right, the cracked red camera-eye scans nearby while the green scanner on the far side sweeps. The mandibles twitch and the faded wiring shifts with the head movements.
  Header "Battle Idle 1" (2,4): Rustback rears up on its four back legs, front two legs raised with hooked tips extended. The mandibles spread wide showing sharpened scrap-metal edges and both eyes flash — red and green blazing.
  Header "Battle Idle 2" (2,5): Swaying in its reared posture, the front legs claw at the air. The abdomen glows brighter yellow as it charges biological processes and the exposed wiring crackles with stolen electricity.

ROW 3 — Battle Idle 3, Attack, Cast Start:
  Header "Battle Idle 3" (3,0): Holding its aggressive rear, the Rustback clicks its mandibles rapidly. Both eyes lock on target — red camera focusing, green scanner mapping. The front leg hooks gleam with rust-red sharpened tips.
  Header "Attack 1" (3,1): Wind-up — the mandibles spread wide as the Rustback lunges its thorax forward. The scrap-metal jaw edges catch light and the front legs retract, preparing to strike.
  Header "Attack 2" (3,2): Mandible snap — the sharpened scrap-metal mandibles clamp shut with tremendous force. The corroded thorax rocks forward with the strike and the mechanical joints grind audibly.
  Header "Attack 3" (3,3): The biological abdomen contracts and spits a small glob of acid from its rear segment, the sickly yellow bioluminescence flaring as the caustic liquid arcs forward. The thorax braces.
  Header "Cast 1" (3,4): The abdomen begins glowing intensely, the sickly yellow bioluminescence brightening to a vivid pulse. The thorax opens panels revealing internal machinery that whirs and clicks, assembling something.
  Header "Cast 2" (3,5): Mini-drones — tiny versions of itself made from scrap — begin emerging from the thorax panels. The abdomen provides organic fuel, glowing as it pumps energy into the spawning process.

ROW 4 — Cast 3, Damage, KO Start:
  Header "Cast 3" (4,0): Swarm burst — a cluster of tiny scrap mini-drones launches from the thorax, buzzing outward in a small cloud. The Rustback shudders from the exertion, abdomen dimming after the spawning effort.
  Header "Damage 1" (4,1): Rustback recoils from a hit, corroded armor plates buckling inward. Sparks fly from exposed wiring and the cracked red camera-eye flickers. One front leg twitches from the impact.
  Header "Damage 2" (4,2): More plates buckle and a section of burnt-orange plating falls away, exposing the grey-green organic tissue beneath. The wiring sparks and the green scanner-eye goes dim briefly.
  Header "Damage 3" (4,3): Recovery — the Rustback shakes its thorax, resettling the loose plates. Its mandibles click defiantly and the abdomen pulses as biological repair begins on the exposed tissue. Both eyes reboot.
  Header "KO 1" (4,4): Legs begin failing — the mechanical joints seize one by one, causing the body to sink unevenly. The wiring sparks and goes dead, the mandibles slow their clicking, and both eyes flicker erratically.
  Header "KO 2" (4,5): Rustback crashes to the ground as the remaining legs fold, the corroded thorax hitting with a metallic clang. The abdomen bioluminescence fades and the mandibles go still.

ROW 5 — KO 3, Victory, Status Poses:
  Header "KO 3" (5,0): Rustback lies upside-down, six legs curled inward and twitching faintly. The corroded plating is dented and the wiring is dead. Both eyes are dark and the mandibles are locked open.
  Header "Victory 1" (5,1): Rustback clicks its mandibles in a rapid triumphant rhythm, both eyes blazing — red camera bright, green scanner sweeping. The front legs wave and the abdomen glows a strong, healthy yellow.
  Header "Victory 2" (5,2): It stamps its six legs in a skittering victory dance, the corroded plating clanking. The wiring bounces and sparks celebratorily and the mandibles clatter like applause.
  Header "Victory 3" (5,3): Rustback settles into a proud stance, all six legs planted wide and thorax raised high. Both eyes glow steadily and a piece of salvaged scrap dangles from one mandible as a trophy.
  Header "Weak Pose" (5,4): Three of the six legs are failing, causing the Rustback to drag its body. One eye is dark and the other flickers weakly. The mandibles click slowly and the abdomen glow is nearly extinguished.
  Header "Critical Pose" (5,5): Only two legs function, barely dragging the corroded body forward. The cracked red camera-eye is dead, the green scanner emits only a faint flicker. The mandibles hang open and the abdomen is dark.`,
    },
    {
      id: 'baron-brioche',
      name: "Baron Brioche",
      genre: "Food Fantasy",
      description: "A pompous bread nobleman with a golden-brown brioche bun for a head, a flaky croissant mustache, and tiny raisin eyes set deep in his doughy face. Plump, round body made of layered pastry. Struts with aristocratic arrogance.",
      equipment: "A baguette rapier with a butter-pat crossguard, a cape made of flattened puff pastry sheets, and a monocle made from a hardened sugar disc. A breadbasket shield on his back.",
      colorNotes: "Golden-brown brioche head, warm amber pastry body. Cape is pale golden puff pastry. Baguette rapier is tan with a yellow butter crossguard. Monocle is translucent amber sugar. Raisin eyes are dark brown.",
      rowGuidance: `ROW 0 — Walk Down & Walk Up:
  Header "Walk Down 1" (0,0): Baron Brioche steps forward on his left foot with an aristocratic waddle, his puff-pastry cape fluttering to the right. The baguette rapier swings at his side and his sugar monocle glints. His brioche head bobs with each step.
  Header "Walk Down 2" (0,1): Neutral mid-step, feet together, cape draped behind him. His croissant mustache curls upward proudly and his raisin eyes stare imperiously ahead. The breadbasket shield sits snugly on his round back.
  Header "Walk Down 3" (0,2): Mirror of Walk Down 1 — right foot leads, puff-pastry cape swishing left. Crumbs trail faintly from his flaky body with each step.
  Header "Walk Up 1" (0,3): Baron Brioche faces away, the puff-pastry cape and breadbasket shield filling the view. His golden-brown brioche head sits atop his round pastry body like a crown.
  Header "Walk Up 2" (0,4): Neutral mid-step facing away, cape draping straight. The layered pastry texture of his body is visible, with each flaky layer catching light differently.
  Header "Walk Up 3" (0,5): Mirror of Walk Up 1 — right foot forward facing away, cape billowing. The baguette rapier handle protrudes at his hip.

ROW 1 — Walk Left & Walk Right:
  Header "Walk Left 1" (1,0): Facing left with his left foot forward, the Baron's rotund pastry profile is on full display. The baguette rapier extends slightly ahead and the croissant mustache curls elegantly in profile.
  Header "Walk Left 2" (1,1): Neutral contact pose facing left, his plump layered body balanced. The sugar monocle catches light and his raisin eyes look down his doughy nose.
  Header "Walk Left 3" (1,2): Mirror of Walk Left 1 — right foot leads, puff-pastry cape swaying forward. A small dusting of flour trails behind him.
  Header "Walk Right 1" (1,3): Facing right with his right foot forward, baguette rapier extended confidently. The breadbasket shield peeks from behind his round body and the cape trails.
  Header "Walk Right 2" (1,4): Neutral contact pose facing right, the Baron's aristocratic profile visible — brioche head held high, croissant mustache bristling, sugar monocle gleaming.
  Header "Walk Right 3" (1,5): Mirror of Walk Right 1 — left foot leads while facing right, cape flowing behind. His pastry body bounces gently with each waddle.

ROW 2 — Idle & Battle Idle:
  Header "Idle Down" (2,0): Baron Brioche stands facing the viewer with one hand on his hip and the other resting on the baguette rapier pommel. His croissant mustache twitches with disdain and his sugar monocle gleams.
  Header "Idle Up" (2,1): Facing away, the puff-pastry cape drapes regally over his round pastry body. The breadbasket shield sits on his back and the brioche head is tilted upward snobbishly.
  Header "Idle Left" (2,2): Facing left, one hand adjusts the sugar monocle while the other holds the baguette rapier loosely. His raisin eyes squint with aristocratic suspicion.
  Header "Idle Right" (2,3): Facing right, the Baron puffs out his layered chest proudly, cape flowing behind. He twirls one end of the croissant mustache with his free hand.
  Header "Battle Idle 1" (2,4): Baron Brioche drops into a fencing stance, baguette rapier raised in a classic en garde position. His puff-pastry cape flares behind him and his raisin eyes narrow with intensity.
  Header "Battle Idle 2" (2,5): He shifts weight in his fencing stance, the rapier tip tracing small circles. The butter-pat crossguard catches light and his brioche head gleams with a buttery sheen.

ROW 3 — Battle Idle 3, Attack, Cast Start:
  Header "Battle Idle 3" (3,0): The Baron holds his en garde pose firmly, monocle gleaming with determination. His croissant mustache bristles and the baguette rapier hums with flour-dusted menace.
  Header "Attack 1" (3,1): Wind-up — Baron Brioche pulls the baguette rapier back in a classic lunge preparation, his round body coiling. The puff-pastry cape wraps slightly around his torso.
  Header "Attack 2" (3,2): Mid-lunge — the baguette rapier thrusts forward with surprising speed, a small puff of flour erupting from the blade. His pastry body stretches forward dramatically.
  Header "Attack 3" (3,3): Follow-through — rapier fully extended, a burst of toasted bread crumbs explodes from the tip on impact. The cape flies outward and his monocle catches the light of the strike.
  Header "Cast 1" (3,4): Baron Brioche raises the baguette rapier overhead, and the breadbasket shield floats off his back. Golden dough energy begins swirling between the two items.
  Header "Cast 2" (3,5): A ring of floating croissants, rolls, and breadsticks materializes around him as the dough energy intensifies. His brioche head glows warm gold and the mustache crackles with yeast magic.

ROW 4 — Cast 3, Damage, KO Start:
  Header "Cast 3" (4,0): The bread spell releases — a barrage of magically-hardened dinner rolls fires outward from the orbiting ring. The breadbasket shield snaps back onto his back and his cape billows from the yeasty shockwave.
  Header "Damage 1" (4,1): Baron Brioche flinches from a hit, his monocle popping off his face. A chunk of his brioche head crumbles away and he clutches it in horror. The croissant mustache droops on one side.
  Header "Damage 2" (4,2): Staggering back, large flaky crumbs break from his layered body. His puff-pastry cape tears and the baguette rapier wavers in his grip. His raisin eyes widen with indignation.
  Header "Damage 3" (4,3): Recovery — Baron Brioche pats himself back into shape, smoothing the pastry layers. He retrieves his monocle and jams it back on, mustache bristling with outrage.
  Header "KO 1" (4,4): The Baron's pastry legs give way, his round body crumbling at the seams. The baguette rapier cracks in half and the monocle shatters. His brioche head deflates slightly.
  Header "KO 2" (4,5): Baron Brioche topples sideways, his layered body flattening like a collapsed souffle. The puff-pastry cape spreads beneath him and crumbs scatter everywhere.

ROW 5 — KO 3, Victory, Status Poses:
  Header "KO 3" (5,0): The Baron lies flat and deflated on the ground, looking like a sad, squashed pastry. His broken baguette rapier lies beside him, the croissant mustache has unraveled, and his monocle is in pieces.
  Header "Victory 1" (5,1): Baron Brioche puffs up to twice his size in triumph, pastry layers expanding gloriously. He raises the baguette rapier overhead and his monocle catches a triumphant gleam.
  Header "Victory 2" (5,2): He twirls the baguette rapier in a flourish while golden bread crumbs shower around him like confetti. His croissant mustache curls upward in a magnificent victory pose.
  Header "Victory 3" (5,3): The Baron plants the baguette rapier into the ground, crosses his arms over his puffed pastry chest, and tilts his brioche head back with a hearty, arrogant laugh.
  Header "Weak Pose" (5,4): Baron Brioche leans heavily on the baguette rapier, his pastry body sagging and crumbling at the edges. His monocle is cracked and the croissant mustache hangs limply.
  Header "Critical Pose" (5,5): Barely holding together, the Baron's body is a mess of separated flaky layers. His brioche head is dented, one raisin eye has fallen out, and the baguette rapier is bent — but he still sneers defiantly through his ruined mustache.`,
    },
    {
      id: 'sergeant-sriracha',
      name: "Sergeant Sriracha",
      genre: "Food Fantasy",
      description: "A fiery hot-sauce warrior with a body shaped like a bright red sriracha bottle, a green cap helmet, and intense orange-flame eyes. Muscular arms sprout from the bottle shoulders. Legs are sturdy and planted wide in a military stance.",
      equipment: "Dual chili-pepper grenades on a bandolier across his chest, armored gauntlets with capsaicin-dripping knuckle spikes, and a nozzle cannon mounted on his right forearm that shoots pressurized hot sauce. A jalape\u00f1o-shaped combat knife at his belt.",
      colorNotes: "Bright red body with white sriracha rooster label on chest. Green cap helmet. Orange-flame eyes. Gauntlets are dark red with orange spikes. Chili grenades are green and red. Nozzle cannon is chrome with red tubing.",
      rowGuidance: `ROW 0 — Walk Down & Walk Up:
  Header "Walk Down 1" (0,0): Sergeant Sriracha marches forward on his left foot with military precision, the chili-pepper bandolier bouncing across his bright red bottle body. His green cap helmet sits firmly and the nozzle cannon on his right forearm gleams.
  Header "Walk Down 2" (0,1): Neutral mid-step, feet together in attention. The white rooster label on his chest is clearly visible. His orange-flame eyes burn forward and the jalape\u00f1o knife is strapped at his belt.
  Header "Walk Down 3" (0,2): Mirror of Walk Down 1 — right foot leads, bandolier swaying. Small wisps of steam rise from the capsaicin knuckle spikes on his gauntlets.
  Header "Walk Up 1" (0,3): Facing away, the bright red bottle body narrows toward the green cap. The bandolier crosses his back and the nozzle cannon's chrome barrel is visible on his right arm.
  Header "Walk Up 2" (0,4): Neutral mid-step facing away, military posture rigid. The green and red chili grenades hang in neat rows across his back.
  Header "Walk Up 3" (0,5): Mirror of Walk Up 1 — right foot forward facing away. Steam wisps trail from the nozzle cannon's barrel.

ROW 1 — Walk Left & Walk Right:
  Header "Walk Left 1" (1,0): Facing left with his left foot forward in a disciplined march. His bottle-shaped profile shows the nozzle cannon extending from his forearm and the bandolier slung diagonally.
  Header "Walk Left 2" (1,1): Neutral contact pose facing left. His cylindrical red body and green cap helmet create a distinctive silhouette. The jalape\u00f1o knife is visible at his belt.
  Header "Walk Left 3" (1,2): Mirror of Walk Left 1 — right foot leads, the chili grenades clinking together softly. His orange-flame eyes glare ahead.
  Header "Walk Right 1" (1,3): Facing right with his right foot forward, nozzle cannon arm leading. The capsaicin knuckle spikes drip with a faint orange glow. The bandolier trails across his body.
  Header "Walk Right 2" (1,4): Neutral contact pose facing right, the white rooster label partially visible on his side. The green cap sits at a slight military angle.
  Header "Walk Right 3" (1,5): Mirror of Walk Right 1 — left foot leads while facing right. A small heat shimmer radiates from his bright red body.

ROW 2 — Idle & Battle Idle:
  Header "Idle Down" (2,0): Sergeant Sriracha stands at ease facing the viewer, hands behind his back, chest out to display the rooster label proudly. His flame eyes scan forward and the green cap helmet shadows his face.
  Header "Idle Up" (2,1): At ease facing away, the bandolier of chili grenades visible across his back. The green cap sits atop the narrowing bottle neck.
  Header "Idle Left" (2,2): Facing left at ease, one hand resting on the jalape\u00f1o knife. His cylindrical profile and the nozzle cannon at his side are prominent.
  Header "Idle Right" (2,3): Facing right at ease, the nozzle cannon arm hanging ready. Steam gently wafts from the barrel and his flame eyes look ahead watchfully.
  Header "Battle Idle 1" (2,4): Sriracha drops into a combat crouch, nozzle cannon raised and aimed forward with pressurized sauce visible in the chrome barrel. A chili grenade is gripped in his other hand. His flame eyes blaze bright.
  Header "Battle Idle 2" (2,5): He shifts weight in his combat stance, the nozzle cannon barrel glowing orange from internal heat. The capsaicin knuckle spikes drip molten sauce onto the ground.

ROW 3 — Battle Idle 3, Attack, Cast Start:
  Header "Battle Idle 3" (3,0): Sriracha holds his combat stance, nozzle cannon humming with pressure. A heat shimmer distorts the air around his bright red body and his flame eyes are locked on target.
  Header "Attack 1" (3,1): Wind-up — Sriracha cocks back his cannon arm as pressure builds visibly inside the chrome barrel. His bottle body compresses slightly like a squeezed bottle.
  Header "Attack 2" (3,2): A concentrated blast of hot sauce erupts from the nozzle cannon in a fiery orange stream. The recoil pushes him back slightly and his green cap tilts from the force.
  Header "Attack 3" (3,3): Follow-through — the sauce stream splashes on impact, sending bright red droplets sizzling in all directions. Sriracha steadies himself, barrel smoking.
  Header "Cast 1" (3,4): Sriracha pulls the pins on two chili grenades simultaneously, one in each hand. The grenades glow from green to bright red as they activate, smoke curling from their stems.
  Header "Cast 2" (3,5): He hurls both chili grenades upward where they orbit him, trailing fire and capsaicin vapor. His entire body glows brighter red and the rooster label seems to animate.

ROW 4 — Cast 3, Damage, KO Start:
  Header "Cast 3" (4,0): The chili grenades detonate — a massive explosion of fire, hot sauce, and pepper seeds erupts outward. Sriracha stands in the center, arms wide, his flame eyes blazing white-hot.
  Header "Damage 1" (4,1): Sriracha stumbles back from a hit, a crack forming in his bottle body. Hot sauce leaks from the crack and his green cap is knocked askew. He grunts through gritted teeth.
  Header "Damage 2" (4,2): Staggering further, more cracks spread across his body. Hot sauce drips from multiple fractures and the nozzle cannon sparks. A chili grenade falls from the damaged bandolier.
  Header "Damage 3" (4,3): Recovery — Sriracha slaps a hand over the worst crack, sealing it with sheer heat pressure. His flame eyes reignite with fury and he straightens his green cap.
  Header "KO 1" (4,4): The cracks widen catastrophically — hot sauce pours from his body in streams. The nozzle cannon goes limp, the bandolier snaps, and chili grenades scatter. His flame eyes flicker.
  Header "KO 2" (4,5): Sriracha topples forward, his cracked bottle body splitting open on impact. A pool of hot sauce spreads beneath him and his green cap rolls away.

ROW 5 — KO 3, Victory, Status Poses:
  Header "KO 3" (5,0): Sergeant Sriracha lies in a pool of his own sauce, body cracked open like a broken bottle. The green cap rests upside down nearby, the bandolier is scattered, and his flame eyes are completely dark.
  Header "Victory 1" (5,1): Sriracha pumps his nozzle cannon arm overhead, firing a triumphant geyser of hot sauce into the air like a fountain. His flame eyes blaze and the rooster label glows.
  Header "Victory 2" (5,2): He flexes both arms, capsaicin knuckle spikes flaring bright orange. A ring of fire surrounds his feet and his bottle body gleams an intense, polished red.
  Header "Victory 3" (5,3): Sriracha plants his feet wide, crosses his arms, and lets steam pour from his green cap in a dramatic release of pressure. The chili grenades on his bandolier glow victoriously.
  Header "Weak Pose" (5,4): Sriracha's body is covered in hairline cracks, sauce slowly seeping out. The nozzle cannon droops, barely functional. His flame eyes are dim embers and he breathes in labored puffs of steam.
  Header "Critical Pose" (5,5): Barely standing, Sriracha is a shattered mess — body held together by sheer will, sauce pooling at his feet. One flame eye is out, the other gutters weakly. He aims the sputtering nozzle cannon with his last ounce of heat.`,
    },
    {
      id: 'duchess-gelato',
      name: "Duchess Gelato",
      genre: "Food Fantasy",
      description: "An elegant ice cream sorceress with a swirled tri-color gelato head (strawberry pink, pistachio green, vanilla cream), a waffle-cone corset bodice, and a flowing skirt made of frozen cream ribbons. Graceful and poised with a cold, regal demeanor.",
      equipment: "A wafer-stick wand tipped with a crystallized sugar star, a parasol made from a giant sugar cookie with royal icing filigree, and delicate spun-sugar jewelry at her wrists and neck. A small sundae-glass familiar floats beside her.",
      colorNotes: "Tri-color gelato head: strawberry pink, pistachio green, vanilla cream. Waffle-cone bodice is warm tan with grid pattern. Skirt is pale white-blue frozen cream. Wand is tan wafer with a sparkling sugar star. Parasol is cream with white icing swirls.",
      rowGuidance: `ROW 0 — Walk Down & Walk Up:
  Header "Walk Down 1" (0,0): Duchess Gelato glides forward on her left foot, frozen cream skirt swirling gracefully. The wafer-stick wand is held delicately in her right hand and the sugar cookie parasol rests on her left shoulder. Her tri-color gelato head swirls gently.
  Header "Walk Down 2" (0,1): Neutral mid-step, feet together. The spun-sugar necklace sparkles at her throat and the sundae-glass familiar bobs beside her. The waffle-cone corset's grid pattern is clearly visible.
  Header "Walk Down 3" (0,2): Mirror of Walk Down 1 — right foot leads, frozen cream skirt flowing to the opposite side. A faint trail of frost crystals follows her steps.
  Header "Walk Up 1" (0,3): Facing away, the frozen cream skirt cascades down in elegant ribbons. The sugar cookie parasol rests against her shoulder and the gelato swirl of her head catches ambient light.
  Header "Walk Up 2" (0,4): Neutral mid-step facing away, skirt draping straight. The waffle-cone corset lacing is visible up her back and the spun-sugar bracelets glint.
  Header "Walk Up 3" (0,5): Mirror of Walk Up 1 — right foot forward facing away, the sundae-glass familiar trailing behind her. Frost crystallizes in her wake.

ROW 1 — Walk Left & Walk Right:
  Header "Walk Left 1" (1,0): Facing left with her left foot forward in an elegant glide. Her tri-color gelato head is visible in profile — pink, green, cream layers stacked. The parasol trails behind.
  Header "Walk Left 2" (1,1): Neutral contact pose facing left, the frozen cream skirt draping around her. The wafer-stick wand rests at her side with the sugar star dimly twinkling.
  Header "Walk Left 3" (1,2): Mirror of Walk Left 1 — right foot leads, skirt swirling forward. The sundae-glass familiar floats ahead of her, scouting.
  Header "Walk Right 1" (1,3): Facing right with her right foot forward, parasol leading. The waffle-cone corset's warm tan contrasts with the icy blue-white of her frozen skirt.
  Header "Walk Right 2" (1,4): Neutral contact pose facing right, her elegant profile showing the gelato swirl and the spun-sugar earring catching light.
  Header "Walk Right 3" (1,5): Mirror of Walk Right 1 — left foot leads while facing right. The sundae-glass familiar follows faithfully behind her.

ROW 2 — Idle & Battle Idle:
  Header "Idle Down" (2,0): Duchess Gelato stands poised facing the viewer, parasol resting on her shoulder and wand held loosely. Her gelato head swirls slowly with hypnotic color and the sundae familiar orbits her lazily.
  Header "Idle Up" (2,1): Facing away, the frozen cream skirt and sugar cookie parasol dominate the view. Frost crystals drift gently downward around her feet.
  Header "Idle Left" (2,2): Facing left, she holds the parasol open to shade her gelato head from imagined heat. The wand rests in the crook of her arm and her expression is serene.
  Header "Idle Right" (2,3): Facing right, the Duchess fans herself delicately with one hand. The sundae-glass familiar hovers near her shoulder and the sugar star on her wand pulses faintly.
  Header "Battle Idle 1" (2,4): Duchess Gelato snaps the parasol shut and holds it like a staff alongside the wafer wand. Her gelato head swirls faster, frost radiating from her body. The sundae familiar's ice cream glows.
  Header "Battle Idle 2" (2,5): She twirls the wand in a figure-eight, trails of frost and tiny snowflakes following the sugar star. Her frozen cream skirt crystallizes into sharp icy edges.

ROW 3 — Battle Idle 3, Attack, Cast Start:
  Header "Battle Idle 3" (3,0): The Duchess holds her battle pose with cold elegance, wand raised and parasol braced. The air around her visibly chills with frost particles and her gelato head gleams with icy resolve.
  Header "Attack 1" (3,1): Wind-up — she pulls the wafer wand back, the sugar star gathering swirling frost energy. The sundae familiar spins rapidly beside her, generating cold.
  Header "Attack 2" (3,2): She thrusts the wand forward, launching a concentrated blast of frozen cream that spirals toward the target. The sugar star blazes with icy light.
  Header "Attack 3" (3,3): Follow-through — the frozen blast impacts in a burst of ice crystals and cream splatter. The Duchess flicks the wand with a satisfied flourish, frost settling around her.
  Header "Cast 1" (3,4): The Duchess raises both the wand and the parasol overhead, opening the parasol upside-down like a bowl. A blizzard of sprinkles, cream, and ice begins swirling above her.
  Header "Cast 2" (3,5): The inverted parasol fills with magical gelato energy — a miniature frozen storm swirls inside it. Her tri-color head blazes bright and the sundae familiar merges into the growing spell.

ROW 4 — Cast 3, Damage, KO Start:
  Header "Cast 3" (4,0): The Duchess flips the parasol and slams it down — a massive wave of flash-frozen gelato erupts outward, coating everything in ice cream and frost. The sundae familiar reforms beside her, glowing.
  Header "Damage 1" (4,1): Duchess Gelato flinches as a hit cracks her waffle-cone corset. A scoop of pink gelato drops from her head and the parasol wavers. She gasps with regal indignation.
  Header "Damage 2" (4,2): Staggering back, her tri-color gelato head begins to melt — streams of pink, green, and cream run down her face. The frozen cream skirt thaws at the edges and drips.
  Header "Damage 3" (4,3): Recovery — the Duchess waves her wand and re-freezes herself with a flash of cold. The melting stops, though her gelato head is slightly lopsided. She composes herself with icy dignity.
  Header "KO 1" (4,4): Her gelato head melts catastrophically, colors running together into a muddy swirl. The waffle-cone corset cracks and crumbles. The sundae familiar shatters like glass.
  Header "KO 2" (4,5): Duchess Gelato collapses in a pool of melted ice cream, her frozen skirt dissolving into puddles. The parasol breaks and the wand's sugar star dissolves.

ROW 5 — KO 3, Victory, Status Poses:
  Header "KO 3" (5,0): All that remains is a sad puddle of melted tri-color gelato with a broken waffle-cone corset sitting in the center. The wafer wand and shattered parasol lie in the pool. Only a faint cold mist marks where she stood.
  Header "Victory 1" (5,1): The Duchess twirls her parasol overhead triumphantly as a shower of rainbow sprinkles cascades down. Her gelato head swirls in vibrant, perfectly layered colors.
  Header "Victory 2" (5,2): She conjures a massive sundae from thin air beside her and perches the sundae familiar on top as the cherry. She curtsies with a regal flourish, frost sparkling.
  Header "Victory 3" (5,3): Duchess Gelato snaps the parasol open and poses beneath it, wand planted at her side. Tiny ice cream cones orbit her like a frozen solar system.
  Header "Weak Pose" (5,4): The Duchess leans on her parasol as a cane, her gelato head drooping and slowly melting. Her frozen skirt is slushy and the wafer wand droops. The sundae familiar flickers in and out of existence.
  Header "Critical Pose" (5,5): Barely a silhouette of her former self — mostly melted, the Duchess holds together by sheer frozen willpower. Her gelato head is a single dripping blob, the corset is cracked, but she still aims the dissolving wand with trembling grace.`,
    },
    {
      id: 'general-gumbo',
      name: "General Gumbo",
      genre: "Food Fantasy",
      description: "A hulking stew golem villain with a cast-iron cauldron for a torso, thick okra-stalk arms, and legs made of bundled andouille sausage links. His head is a bubbling pot lid with two glowing ember eyes peering through the steam. A dark roux oozes from his joints.",
      equipment: "A massive ladle war-hammer with a heavy iron bowl, a lid shield that doubles as his head cover, and chains made of linked onion rings draped across his body. A belt of bay leaves and a pouch of file powder at his hip.",
      colorNotes: "Dark iron-gray cauldron torso with brown roux dripping from seams. Okra arms are dark green. Sausage legs are reddish-brown. Ember eyes are orange-red. Ladle is dark iron. Onion ring chains are golden-brown. Steam is white-gray.",
      rowGuidance: `ROW 0 — Walk Down & Walk Up:
  Header "Walk Down 1" (0,0): General Gumbo lumbers forward on his left sausage-link leg, the cauldron torso sloshing audibly. The ladle war-hammer drags at his right side and onion-ring chains rattle across his chest. Steam billows from his pot-lid head.
  Header "Walk Down 2" (0,1): Neutral mid-step, sausage legs planted wide for balance. His ember eyes glow through the steam and dark roux oozes from the joints between his cauldron body and okra arms. The bay-leaf belt hangs at his waist.
  Header "Walk Down 3" (0,2): Mirror of Walk Down 1 — right sausage leg leads, chains swinging. The ladle's heavy iron bowl scrapes along the ground and roux drips trail behind him.
  Header "Walk Up 1" (0,3): Facing away, the massive cast-iron cauldron torso dominates the view with handles protruding at the sides. The onion-ring chains cross his back and the pot-lid head vents steam upward.
  Header "Walk Up 2" (0,4): Neutral mid-step facing away, sausage legs steady. The dark green okra arms hang at his sides and the ladle war-hammer is slung across his back.
  Header "Walk Up 3" (0,5): Mirror of Walk Up 1 — right leg forward, steam trailing. The bundled sausage links of his legs flex with each heavy step.

ROW 1 — Walk Left & Walk Right:
  Header "Walk Left 1" (1,0): Facing left with his left sausage leg forward, the General's massive profile shows the cauldron torso, okra arm, and pot-lid head venting steam. The ladle drags behind.
  Header "Walk Left 2" (1,1): Neutral contact pose facing left, his bulk filling the frame. The onion-ring chains catch light and the ember eyes peer sideways through billowing steam.
  Header "Walk Left 3" (1,2): Mirror of Walk Left 1 — right leg leads, dark roux splattering with each heavy footfall. The iron cauldron creaks with the motion.
  Header "Walk Right 1" (1,3): Facing right with his right sausage leg forward, ladle war-hammer swinging ahead. The file-powder pouch bounces at his hip and steam pours from the pot-lid.
  Header "Walk Right 2" (1,4): Neutral contact pose facing right, the cauldron's curved profile visible. His okra arm hangs ready and the bay leaves flutter at his belt.
  Header "Walk Right 3" (1,5): Mirror of Walk Right 1 — left leg leads while facing right, onion-ring chains clinking. Each step shakes the ground beneath him.

ROW 2 — Idle & Battle Idle:
  Header "Idle Down" (2,0): General Gumbo stands menacingly, both okra hands resting on the ladle war-hammer planted before him. His pot-lid head vents a steady column of steam and his ember eyes smolder through it. Roux drips slowly from his torso seams.
  Header "Idle Up" (2,1): Facing away, a hulking mass of iron and stew. The cauldron handles jut outward, the ladle is slung across his back, and steam rises from the pot-lid into the air.
  Header "Idle Left" (2,2): Facing left, one okra arm rests on the ladle handle while the other hangs at his side, roux dripping from the knuckles. The onion-ring chains sag under their own weight.
  Header "Idle Right" (2,3): Facing right, the General's ember eyes glow ominously through a fresh billow of steam. His sausage legs are planted wide and the cauldron bubbles faintly inside.
  Header "Battle Idle 1" (2,4): Gumbo hoists the ladle war-hammer onto his shoulder with one okra arm, the other fist clenched. His pot-lid head tilts forward aggressively, steam jetting sideways. The cauldron torso bubbles violently.
  Header "Battle Idle 2" (2,5): He shifts the ladle to a two-handed grip, ember eyes flaring brighter. The roux at his joints darkens and thickens menacingly, and the onion-ring chains tighten across his swelling chest.

ROW 3 — Battle Idle 3, Attack, Cast Start:
  Header "Battle Idle 3" (3,0): The General holds the massive ladle at the ready, steam pouring from every seam of his body. His ember eyes are slits of focused rage and the cauldron bubbles and roils inside.
  Header "Attack 1" (3,1): Wind-up — Gumbo heaves the ladle war-hammer overhead with both okra arms, the heavy iron bowl blotting out the sky. His cauldron torso groans under the strain.
  Header "Attack 2" (3,2): The ladle crashes downward with devastating force, the iron bowl slamming into the ground. A shockwave of dark roux and hot broth explodes outward from the impact. The chains rattle furiously.
  Header "Attack 3" (3,3): Follow-through — Gumbo wrenches the ladle from the crater, splashing boiling gumbo in an arc. Steam erupts from the impact zone and his ember eyes blaze with satisfaction.
  Header "Cast 1" (3,4): The General removes his pot-lid head and holds it over the cauldron opening. The stew inside begins to bubble and churn with unnatural energy, green and brown vapors spiraling upward.
  Header "Cast 2" (3,5): He plunges an okra arm into his own cauldron body, stirring the contents. A vortex of stew energy rises — chunks of okra, sausage, and shrimp orbit within a tornado of dark roux magic.

ROW 4 — Cast 3, Damage, KO Start:
  Header "Cast 3" (4,0): Gumbo slams the pot-lid back on and the spell erupts — a geyser of boiling, enchanted gumbo blasts from every seam and joint, scalding everything nearby. The onion-ring chains glow red-hot.
  Header "Damage 1" (4,1): A hit dents the cauldron torso, causing a spray of hot stew from the crack. The pot-lid rattles and his ember eyes flicker. One onion-ring chain link snaps.
  Header "Damage 2" (4,2): Staggering, a large section of the cauldron cracks open, pouring stew. His okra arms wilt slightly and the sausage legs buckle. Steam vents erratically from the pot-lid.
  Header "Damage 3" (4,3): Recovery — Gumbo slaps a massive okra hand over the crack, sealing it with hardened roux. He straightens up with a threatening rumble, ember eyes reigniting.
  Header "KO 1" (4,4): The cauldron torso fractures catastrophically — stew pours from every side. The okra arms go limp, sausage legs buckle, and the pot-lid tilts off his head. Ember eyes dim.
  Header "KO 2" (4,5): General Gumbo collapses in a massive splash of gumbo, his cauldron body splitting open. The ladle clatters to the ground and sausage links scatter.

ROW 5 — KO 3, Victory, Status Poses:
  Header "KO 3" (5,0): A shattered iron cauldron sits in a lake of cooling gumbo. Limp okra arms, disconnected sausage links, and a cracked pot-lid lie scattered in the stew. The ember eyes are cold dark stones.
  Header "Victory 1" (5,1): General Gumbo raises the ladle war-hammer overhead with one arm, stew raining down from the bowl like a grotesque trophy. His pot-lid head jets steam in a furious victory roar and his ember eyes blaze.
  Header "Victory 2" (5,2): He slams both okra fists against his cauldron chest in a thunderous drumroll, each impact sending splashes of dark roux outward. The onion-ring chains clatter percussively.
  Header "Victory 3" (5,3): Gumbo plants the ladle and removes his pot-lid, revealing the bubbling stew within. He holds the lid aloft like a crown, ember eyes glowing with malevolent pride.
  Header "Weak Pose" (5,4): The cauldron is covered in cracks, leaking stew from a dozen wounds. His okra arms are wilted and browning, the sausage legs are sagging, and one ember eye has gone dark. Steam barely trickles from the pot-lid.
  Header "Critical Pose" (5,5): Barely a shell of iron and stew, Gumbo holds together through sheer stubborn villainy. The cauldron is more hole than metal, the roux has dried to a crust, and his remaining ember eye burns with desperate, simmering fury.`,
    },
    {
      id: 'pepperoni-pete',
      name: "Pepperoni Pete",
      genre: "Food Fantasy",
      description: "A roguish pizza-slice thief with a triangular pizza body, a golden-brown crust spine running down his back, and a face made of melted mozzarella with pepperoni-disc cheeks. Lanky and flexible with a sneaky, hunched posture. Strings of cheese trail from his movements.",
      equipment: "Twin pizza-cutter chakrams that he throws and recalls, suction-cup boots made of mozzarella for wall-climbing, and a bandana made from a folded napkin. A utility belt of condiment packets (hot pepper flakes, parmesan, garlic butter).",
      colorNotes: "Triangular body is pizza-orange with melted yellow cheese and red pepperoni spots. Crust spine is golden-brown. Mozzarella face is pale yellow-white. Napkin bandana is white with red checkered pattern. Pizza-cutter chakrams are silver with red handles.",
      rowGuidance: `ROW 0 — Walk Down & Walk Up:
  Header "Walk Down 1" (0,0): Pepperoni Pete slinks forward on his left foot in a sneaky crouch, strings of mozzarella trailing from his movements. The twin pizza-cutter chakrams hang at his hips and the checkered napkin bandana covers his lower face.
  Header "Walk Down 2" (0,1): Neutral mid-step, feet together in a ready stance. His triangular pizza body leans forward and his pepperoni-disc cheeks poke above the bandana. Cheese strings dangle from his elbows.
  Header "Walk Down 3" (0,2): Mirror of Walk Down 1 — right foot leads, cheese trailing. The condiment-packet utility belt rattles softly and his mozzarella suction-cup boots stick briefly to the ground.
  Header "Walk Up 1" (0,3): Facing away, the golden-brown crust spine runs prominently down his triangular back. The pizza-cutter chakrams cross on his lower back and cheese strings trail behind him.
  Header "Walk Up 2" (0,4): Neutral mid-step facing away, his pizza-slice silhouette narrow from behind. The checkered bandana ties flutter at the back of his head.
  Header "Walk Up 3" (0,5): Mirror of Walk Up 1 — right foot forward facing away, the crust spine catching light. Mozzarella strings stretch and snap with each step.

ROW 1 — Walk Left & Walk Right:
  Header "Walk Left 1" (1,0): Facing left with his left foot forward in a sneaky sidestep. His flat triangular profile is visible — the pointed pizza tip at top, widening to the crust at his back. A chakram glints at his hip.
  Header "Walk Left 2" (1,1): Neutral contact pose facing left, hunched and ready. His mozzarella face peeks over the bandana and the condiment belt pouches hang from his waist.
  Header "Walk Left 3" (1,2): Mirror of Walk Left 1 — right foot leads, cheese dripping from his trailing hand. His mozzarella boots squelch softly.
  Header "Walk Right 1" (1,3): Facing right with his right foot forward, one hand reaching for a chakram. The pizza-orange body and pepperoni spots are vivid in profile. The bandana trails behind.
  Header "Walk Right 2" (1,4): Neutral contact pose facing right, the crust spine visible along his back. His cheesy face is scrunched with mischievous focus.
  Header "Walk Right 3" (1,5): Mirror of Walk Right 1 — left foot leads while facing right. A string of cheese stretches back to his previous position before snapping.

ROW 2 — Idle & Battle Idle:
  Header "Idle Down" (2,0): Pete stands in a casual thieves' slouch, one hand spinning a pizza-cutter chakram lazily. His pepperoni cheeks bulge in a smirk above the bandana and cheese strings hang from his fingertips.
  Header "Idle Up" (2,1): Facing away in a slouch, the crust spine and crossed chakrams are visible. His napkin bandana ties droop and he scratches his back, flaking off a pepperoni disc.
  Header "Idle Left" (2,2): Facing left, Pete leans against an invisible wall, arms crossed. The chakrams dangle from his fingers and his mozzarella face has a bored, scheming expression.
  Header "Idle Right" (2,3): Facing right, he casually tosses a parmesan packet from his utility belt and catches it. His pizza-triangle body is relaxed and slightly droopy with stretchy cheese.
  Header "Battle Idle 1" (2,4): Pete snaps to attention, a pizza-cutter chakram in each hand held in a dual-wield stance. His mozzarella face stretches into a wild grin above the bandana and his body tenses.
  Header "Battle Idle 2" (2,5): He flips one chakram in the air and catches it, shifting into a new stance. Cheese strings whip around him dynamically and his pepperoni cheeks flush darker red.

ROW 3 — Battle Idle 3, Attack, Cast Start:
  Header "Battle Idle 3" (3,0): Pete crouches low with both chakrams ready, the silver blades spinning slowly. His mozzarella eyes narrow and cheese strings drift around him like tripwires.
  Header "Attack 1" (3,1): Wind-up — Pete cocks his arm back, one pizza-cutter chakram spinning up to speed in his grip. His triangular body coils like a spring, cheese stretching taut.
  Header "Attack 2" (3,2): He hurls the chakram in a flat spinning arc, the silver blade slicing through the air with a pizza-cutter whir. Cheese strings trail behind it like a yo-yo tether.
  Header "Attack 3" (3,3): The chakram ricochets back to his hand as the second one flies out in a follow-up throw. Both blades flash silver and cheese-string trails criss-cross the frame.
  Header "Cast 1" (3,4): Pete rips open all his condiment packets at once — hot pepper flakes, parmesan, and garlic butter swirl around him in a spicy tornado. His pizza body absorbs the seasonings and glows.
  Header "Cast 2" (3,5): The condiment tornado intensifies — pepper flakes ignite into tiny sparks, parmesan crystallizes into shrapnel, and garlic butter coats his chakrams with a golden sheen. His eyes glow red-pepper hot.

ROW 4 — Cast 3, Damage, KO Start:
  Header "Cast 3" (4,0): Pete launches both seasoned chakrams simultaneously through the condiment storm — they spiral outward trailing fire, cheese, and garlic-butter sparks. The explosion is a greasy, spicy supernova.
  Header "Damage 1" (4,1): Pete flinches as a hit takes a bite-shaped chunk out of his pizza body. Cheese strings spray from the wound and he clutches the missing section. His bandana slips.
  Header "Damage 2" (4,2): Another hit tears more pizza from his body — he's visibly smaller now, missing a large triangular piece. Toppings scatter and his mozzarella face stretches in pain.
  Header "Damage 3" (4,3): Recovery — Pete pulls his remaining cheese together, stretching mozzarella over the wounds like bandages. He's battered but his eyes burn with defiant mischief behind the crooked bandana.
  Header "KO 1" (4,4): Pete's pizza body tears apart — cheese strings snap, pepperoni discs pop off, and the crust spine cracks. The chakrams clatter to the ground and his mozzarella face melts into a sad droop.
  Header "KO 2" (4,5): He collapses into a messy heap of cheese, sauce, and scattered toppings. The napkin bandana flutters down over the pile and the chakrams spin to a stop beside him.

ROW 5 — KO 3, Victory, Status Poses:
  Header "KO 3" (5,0): A sad pile of cold pizza remains — flattened, stale, and congealed. The crust spine lies cracked on top, pepperoni discs are scattered, and the checkered bandana covers the mess like a tiny shroud. The chakrams are stuck in the ground nearby.
  Header "Victory 1" (5,1): Pete juggles both pizza-cutter chakrams overhead, spinning and catching them with flashy flair. Cheese strings fly everywhere in celebration and his pepperoni cheeks glow with triumph.
  Header "Victory 2" (5,2): He strikes a dramatic rogue pose — one foot on an invisible ledge, chakram pointed forward, napkin bandana billowing. A trail of cheese strings frames him like a cheesy spotlight.
  Header "Victory 3" (5,3): Pete takes a bite out of his own arm (it grows back immediately in a stretch of cheese), chewing smugly. He twirls a chakram on one finger and winks with a mozzarella eyelid.
  Header "Weak Pose" (5,4): Pete is missing large chunks of his pizza body, barely held together by overstretched cheese strings. The crust spine is cracked, the bandana is torn, and he holds one chakram weakly while the other drags on the ground.
  Header "Critical Pose" (5,5): Just a sad, tiny triangle of pizza with a face — most of his body is gone. He clutches one battered chakram with a single stretched cheese-string arm, his last pepperoni cheek barely hanging on. But his mozzarella grin refuses to die.`,
    },
    {
      id: 'queen-umami',
      name: "Queen Umami",
      genre: "Food Fantasy",
      description: "A sinister mushroom empress villain with a massive shiitake cap crown, a body woven from enoki and oyster mushroom fibers, and glowing bioluminescent spore eyes. Tall and willowy with an unsettling, swaying gait. Dark truffle-colored skin with veins of mycelium running beneath the surface.",
      equipment: "A gnarled morel scepter that drips with dark spore ink, a cloak of layered portobello gills that rustles like whispers, and a choker of dried porcini discs. Clouds of psychedelic spores drift around her constantly.",
      colorNotes: "Shiitake cap crown is dark brown with tan cracks. Body is pale cream enoki fibers with gray oyster mushroom patches. Bioluminescent eyes are eerie blue-green. Truffle skin is near-black. Morel scepter is dark honeycomb brown. Portobello gill cloak is dark brown-purple. Spore clouds are sickly yellow-green.",
      rowGuidance: `ROW 0 — Walk Down & Walk Up:
  Header "Walk Down 1" (0,0): Queen Umami drifts forward on her left foot with an unsettling sway, her portobello-gill cloak rustling in layers. The morel scepter is held in her right hand, dripping dark spore ink. A cloud of yellow-green spores trails in her wake.
  Header "Walk Down 2" (0,1): Neutral mid-step, feet together. Her massive shiitake cap crown shadows her face, only the bioluminescent blue-green eyes visible beneath. Mycelium veins pulse faintly beneath her dark truffle skin.
  Header "Walk Down 3" (0,2): Mirror of Walk Down 1 — right foot leads, gill cloak whispering. The porcini choker gleams at her throat and spores swirl around her enoki-fiber body.
  Header "Walk Up 1" (0,3): Facing away, the portobello-gill cloak cascades down in dark, layered ruffles. The shiitake cap crown is enormous from behind, with tan cracks radiating outward.
  Header "Walk Up 2" (0,4): Neutral mid-step facing away, the cloak draped like a fungal waterfall. Mycelium threads connect her feet to the ground, spreading outward.
  Header "Walk Up 3" (0,5): Mirror of Walk Up 1 — right foot forward facing away, spore clouds billowing behind her. The morel scepter drips a trail of dark ink.

ROW 1 — Walk Left & Walk Right:
  Header "Walk Left 1" (1,0): Facing left with her left foot forward in a swaying glide. Her willowy profile shows the shiitake crown, pale enoki body, and the gill cloak trailing. Spores drift from her every movement.
  Header "Walk Left 2" (1,1): Neutral contact pose facing left, her bioluminescent eyes casting an eerie glow on her cheek. The morel scepter's honeycomb texture is visible in profile.
  Header "Walk Left 3" (1,2): Mirror of Walk Left 1 — right foot leads, portobello cloak swirling forward. Mycelium threads spread from her footprints.
  Header "Walk Right 1" (1,3): Facing right with her right foot forward, scepter extended ahead dripping ink. Her tall willowy frame sways like a fungus in wind, the shiitake crown tilting slightly.
  Header "Walk Right 2" (1,4): Neutral contact pose facing right. The oyster mushroom patches on her body catch light with a gray pearlescence. The porcini choker gleams darkly.
  Header "Walk Right 3" (1,5): Mirror of Walk Right 1 — left foot leads while facing right, spore cloud thickening around her. The gill cloak whispers as it moves.

ROW 2 — Idle & Battle Idle:
  Header "Idle Down" (2,0): Queen Umami stands still facing the viewer, an aura of slowly rotating spores surrounding her. The morel scepter rests upright at her side, leaking ink. Her bioluminescent eyes are half-lidded and menacing beneath the shiitake crown.
  Header "Idle Up" (2,1): Facing away, motionless but for the slowly rustling gill cloak. Mycelium threads fan outward from her feet in an expanding network. Spores drift upward lazily.
  Header "Idle Left" (2,2): Facing left, she strokes the morel scepter thoughtfully, dark ink coating her fingers. Her bioluminescent eyes cast a blue-green glow on the scepter's honeycomb surface.
  Header "Idle Right" (2,3): Facing right, Queen Umami holds up one hand and examines the mycelium veins pulsing beneath her truffle skin. A small mushroom sprouts from her palm and she crushes it, releasing spores.
  Header "Battle Idle 1" (2,4): Umami raises the morel scepter overhead, its dark ink flowing upward in defiance of gravity. Her bioluminescent eyes blaze fully open, her spore cloud intensifies to a toxic haze, and the gill cloak spreads wide like fungal wings.
  Header "Battle Idle 2" (2,5): She sways hypnotically in her battle stance, the spore cloud pulsing in rhythm. Mycelium threads creep outward from her feet aggressively and the morel scepter hums with dark energy.

ROW 3 — Battle Idle 3, Attack, Cast Start:
  Header "Battle Idle 3" (3,0): The Queen holds her menacing stance, gill cloak spread wide. The spore cloud is thick and choking, her eyes are blazing beacons, and the morel scepter drips with anticipation.
  Header "Attack 1" (3,1): Wind-up — Umami raises the morel scepter and dark spore ink collects at its tip, forming a large, quivering droplet. Mycelium threads retract from the ground into her body, charging the attack.
  Header "Attack 2" (3,2): She swings the scepter in a wide arc, the collected ink launching as a toxic slash of dark spore energy. The portobello cloak flares outward and her eyes leave bioluminescent trails.
  Header "Attack 3" (3,3): The dark slash impacts and erupts into a patch of rapid fungal growth — mushrooms sprout instantly at the point of contact, then wither and release a secondary spore burst.
  Header "Cast 1" (3,4): Queen Umami plants the morel scepter into the ground. Mycelium threads explode outward from the base, forming a vast underground network. Small mushrooms begin sprouting in a circle around her.
  Header "Cast 2" (3,5): The mushroom circle grows taller, each cap glowing with bioluminescent energy. The Queen raises her arms and the spore cloud converges overhead into a dense, swirling fungal storm. Her eyes are blinding blue-green.

ROW 4 — Cast 3, Damage, KO Start:
  Header "Cast 3" (4,0): The fungal storm detonates — a massive cascade of toxic spores, sprouting mushrooms, and dark mycelium tendrils erupts in all directions. The Queen stands in the eye, gill cloak billowing, a silhouette of pure fungal terror.
  Header "Damage 1" (4,1): A hit tears a section of enoki fibers from her body, exposing dark truffle beneath. She recoils, her shiitake crown cracking at one edge. Spores scatter erratically.
  Header "Damage 2" (4,2): Staggering, more of her enoki-fiber body tears away. The mycelium veins beneath her skin pulse frantically in repair mode. The portobello cloak shreds at the edges and the morel scepter wavers.
  Header "Damage 3" (4,3): Recovery — Queen Umami regrows her damaged fibers rapidly, new mushroom tissue sprouting to fill the gaps. The repairs are visible as lighter-colored patches. She hisses through clenched teeth, eyes blazing.
  Header "KO 1" (4,4): Her body can't keep up with the damage — enoki fibers wilt and collapse. The shiitake crown splits down the middle, the morel scepter cracks, and the bioluminescent light in her eyes sputters.
  Header "KO 2" (4,5): Queen Umami topples in a cascade of decaying mushroom matter, her gill cloak folding over her like a funeral shroud. The spore cloud dissipates and mycelium threads go limp.

ROW 5 — KO 3, Victory, Status Poses:
  Header "KO 3" (5,0): A mound of wilted, decaying fungal matter lies on the ground — the split shiitake crown on top, the broken morel scepter beside it. The bioluminescent glow is gone. Only a few dormant spores drift upward from the remains.
  Header "Victory 1" (5,1): Queen Umami raises the morel scepter and a forest of bioluminescent mushrooms erupts around her in celebration. Her eyes blaze triumphant blue-green and the gill cloak spreads wide like a dark throne behind her.
  Header "Victory 2" (5,2): She laughs silently, spore clouds erupting in rhythmic bursts like dark fireworks. Mycelium threads spread outward in a conquering web and new mushrooms sprout wherever they touch.
  Header "Victory 3" (5,3): The Queen sits upon a throne of interwoven mushrooms that grew from the battlefield. She rests the scepter across her lap, shiitake crown gleaming, bioluminescent eyes half-lidded in cold satisfaction.
  Header "Weak Pose" (5,4): Umami's body is riddled with rot — enoki fibers browning and wilting, the shiitake crown sagging and cracked. Her bioluminescent eyes are dim and her spore cloud is thin. She clutches the morel scepter for support.
  Header "Critical Pose" (5,5): A crumbling ruin of fungus, Queen Umami barely maintains her form. Her crown is shattered, her cloak is decomposing, and only one bioluminescent eye still glows — but the mycelium beneath the ground still pulses, and her grip on the cracked scepter remains iron.`,
    },
    {
      id: 'wasabi-ronin',
      name: "Wasabi Ronin",
      genre: "Food Fantasy",
      description: "A stoic wandering sushi warrior with a body made of tightly-packed rice wrapped in a nori seaweed cloak, a head of vibrant green wasabi paste shaped into a stern samurai topknot, and eyes made of pickled ginger slices. Compact, disciplined physique with precise, economical movements.",
      equipment: "A razor-sharp sashimi blade (a single long slice of gleaming tuna used as a katana), bamboo-mat armor worn over the nori cloak, and chopstick throwing daggers tucked into a soy-sauce-bottle holster at his hip. A small dish of soy sauce serves as a meditation focus.",
      colorNotes: "White rice body with dark green nori cloak. Bright green wasabi head and topknot. Pink pickled-ginger eyes. Sashimi blade is deep red tuna with a silver edge. Bamboo-mat armor is tan with green ties. Chopsticks are pale wood. Soy sauce bottle is dark brown-black.",
      rowGuidance: `ROW 0 — Walk Down & Walk Up:
  Header "Walk Down 1" (0,0): Wasabi Ronin steps forward on his left foot with measured discipline, his nori cloak swaying slightly. The sashimi blade is sheathed at his left hip in a bamboo scabbard and his wasabi topknot is sharp and rigid. His ginger eyes stare ahead unblinking.
  Header "Walk Down 2" (0,1): Neutral mid-step, feet together. His compact rice body is wrapped tightly in the nori seaweed, bamboo-mat armor visible over his chest. The soy-sauce holster sits at his right hip with chopstick daggers.
  Header "Walk Down 3" (0,2): Mirror of Walk Down 1 — right foot leads, nori cloak shifting. A few grains of rice trail from the hem of his cloak as he moves.
  Header "Walk Up 1" (0,3): Facing away, the dark green nori cloak covers most of his rice body. The bamboo-mat armor crosses his back and the sashimi blade handle protrudes from his left hip. The wasabi topknot juts upward sharply.
  Header "Walk Up 2" (0,4): Neutral mid-step facing away, cloak hanging straight. The tan bamboo-mat armor ties are knotted neatly and the chopstick daggers are visible in the holster.
  Header "Walk Up 3" (0,5): Mirror of Walk Up 1 — right foot forward facing away. The nori cloak's edge reveals the white rice body beneath.

ROW 1 — Walk Left & Walk Right:
  Header "Walk Left 1" (1,0): Facing left with his left foot forward in a precise, silent step. His compact profile shows the wasabi head, bamboo-mat armor, and the sashimi blade scabbard at his hip. The nori cloak drapes.
  Header "Walk Left 2" (1,1): Neutral contact pose facing left, his disciplined posture rigid. The pickled-ginger eyes are visible in profile, pink and alert. One hand rests near the sashimi blade hilt.
  Header "Walk Left 3" (1,2): Mirror of Walk Left 1 — right foot leads, nori cloak swaying forward. His wasabi topknot is sharp as a blade in silhouette.
  Header "Walk Right 1" (1,3): Facing right with his right foot forward, hand hovering over the sashimi blade. The bamboo-mat armor plates shift with his movement and the soy-sauce holster is visible.
  Header "Walk Right 2" (1,4): Neutral contact pose facing right, stoic and still. The deep red of the sheathed sashimi blade peeks from the bamboo scabbard.
  Header "Walk Right 3" (1,5): Mirror of Walk Right 1 — left foot leads while facing right. Rice grains scatter faintly from his precise footwork.

ROW 2 — Idle & Battle Idle:
  Header "Idle Down" (2,0): Wasabi Ronin stands perfectly still, hands at his sides, facing the viewer. His ginger eyes are calm, his wasabi topknot motionless. The sashimi blade rests sheathed and the nori cloak is undisturbed. Total stillness.
  Header "Idle Up" (2,1): Facing away in a meditative stance, the nori cloak draped over his rice body. The sashimi blade crosses his back and the wasabi topknot is perfectly vertical.
  Header "Idle Left" (2,2): Facing left, one hand rests on the sashimi hilt in a classic iaido ready position. His expression is blank and focused, ginger eyes unblinking.
  Header "Idle Right" (2,3): Facing right, the Ronin holds the small soy sauce dish in one hand, meditating on its dark surface. His wasabi features are serene.
  Header "Battle Idle 1" (2,4): In a single fluid motion, Wasabi Ronin draws the sashimi blade — the deep red tuna katana gleams with a razor-silver edge. His nori cloak falls back from his arms and his ginger eyes narrow. The wasabi topknot seems to sharpen.
  Header "Battle Idle 2" (2,5): He shifts into a low kendo stance, the sashimi blade angled precisely. A faint green aura of wasabi heat radiates from his body and the bamboo-mat armor creaks.

ROW 3 — Battle Idle 3, Attack, Cast Start:
  Header "Battle Idle 3" (3,0): The Ronin holds his blade perfectly level, the tuna-red surface reflecting light. His entire body is coiled potential energy — ginger eyes locked, wasabi head steady, rice body compressed and ready.
  Header "Attack 1" (3,1): Wind-up — Wasabi Ronin raises the sashimi blade overhead in a classic two-handed grip. His rice body compresses like a loaded spring and the nori cloak whips back.
  Header "Attack 2" (3,2): A devastating downward slash — the sashimi blade cuts through the air with a flash of red and silver. A thin line of wasabi heat trails the blade edge and his ginger eyes blaze.
  Header "Attack 3" (3,3): Follow-through — the blade completes its arc with surgical precision. A burst of wasabi-green energy erupts at the point of impact and the Ronin flicks the blade clean in a chiburi motion.
  Header "Cast 1" (3,4): Wasabi Ronin draws three chopstick daggers between his fingers and channels energy through them. Each chopstick tip glows with a different condiment aura — soy brown, wasabi green, ginger pink.
  Header "Cast 2" (3,5): He hurls the charged chopsticks upward where they form a triangle in the air. A spinning mandala of sushi energy materializes between them — rice, nori, and fish spinning in a sacred pattern.

ROW 4 — Cast 3, Damage, KO Start:
  Header "Cast 3" (4,0): The sushi mandala fires — a focused beam of pure umami energy blasts downward through the chopstick triangle. The beam is layered: soy-dark outer ring, wasabi-green core, ginger-pink sparks. The Ronin sheathes his blade as the attack lands.
  Header "Damage 1" (4,1): A hit scatters rice from the Ronin's body, leaving a gap in his torso. His nori cloak tears and a chopstick snaps. His ginger eyes wince but he holds his stance.
  Header "Damage 2" (4,2): More rice bursts from his body, the nori cloak now shredded. His bamboo-mat armor cracks and the sashimi blade wobbles in his loosening grip. The wasabi topknot wilts slightly.
  Header "Damage 3" (4,3): Recovery — the Ronin presses his scattered rice back into place with one hand, packing it tight. He adjusts the torn nori, steadies the blade, and hardens his wasabi expression. Ginger eyes sharpen.
  Header "KO 1" (4,4): His rice body finally falls apart — grains pouring from the torn nori like sand. The sashimi blade drops as his arm disintegrates. The wasabi topknot melts in the heat of defeat.
  Header "KO 2" (4,5): Wasabi Ronin collapses into a mound of loose rice, torn nori sheets, and a puddle of melted wasabi. The sashimi blade lies across the pile and the chopsticks are scattered.

ROW 5 — KO 3, Victory, Status Poses:
  Header "KO 3" (5,0): A deconstructed sushi plate lies on the ground — scattered rice, limp nori, a dissolved wasabi smear, two pink ginger slices where the eyes were, and the sashimi blade resting atop it all. The chopsticks are laid parallel in a final respectful gesture.
  Header "Victory 1" (5,1): Wasabi Ronin sheathes the sashimi blade in one precise, ceremonial motion — the blade slides home with a decisive click. His wasabi topknot gleams and his ginger eyes close in satisfied meditation.
  Header "Victory 2" (5,2): He performs a formal bow, the nori cloak spreading elegantly. Then he rises and holds the soy sauce dish aloft in a toast to the fallen. A single cherry blossom petal — made of thin-sliced ginger — drifts past.
  Header "Victory 3" (5,3): The Ronin sits cross-legged on the ground, sashimi blade across his lap, chopstick daggers arranged neatly beside him. He sips from the soy sauce dish in serene contemplation, wasabi topknot perfect.
  Header "Weak Pose" (5,4): His rice body is thin and loosely packed, grains falling steadily. The nori cloak is more hole than seaweed, the wasabi topknot is drooping, and he uses the sashimi blade as a walking stick. His ginger eyes are faded.
  Header "Critical Pose" (5,5): Barely a fistful of rice held together by a single strip of nori, the Ronin somehow still stands. The sashimi blade trembles in his grip, the wasabi has nearly dissolved, and only one faint ginger eye remains — but his stance is still perfect.`,
    }
  ];

  const insert = db.prepare(
    `INSERT OR REPLACE INTO character_presets (id, name, genre, description, equipment, color_notes, row_guidance, is_preset)
     VALUES (?, ?, ?, ?, ?, ?, ?, 1)`
  );

  const insertAll = db.transaction(() => {
    for (const p of PRESETS) {
      insert.run(p.id, p.name, p.genre, p.description, p.equipment, p.colorNotes, p.rowGuidance);
    }
  });

  insertAll();
  console.log(`[DB] Seeded ${PRESETS.length} character presets.`);
}

function seedBuildingPresets(db) {
  const PRESETS = [
    {
      id: 'medieval-inn',
      name: 'Medieval Inn',
      genre: 'Classic Fantasy',
      gridSize: '3x3',
      description: 'A cozy two-story medieval inn with a thatched roof, stone chimney, and a wooden sign hanging from an iron bracket. Warm light spills from the windows.',
      details: 'Stone foundation, timber-framed walls with whitewash plaster, dark wooden beams. A wooden door with iron hinges at ground level. Second-floor balcony with flower boxes.',
      colorNotes: 'Warm browns and tans for wood, grey stone foundation, golden-yellow window glow, dark green trim.',
      cellLabels: JSON.stringify([
        'Day - Idle', 'Day - Smoke Rising', 'Day - Sign Swaying',
        'Evening - Lights On', 'Evening - Chimney Glow', 'Evening - Busy',
        'Night - Lantern Lit', 'Night - Quiet', 'Night - Closed'
      ]),
      cellGuidance: `ROW 0 — Daytime Activity:
  Header "Day - Idle" (0,0): The inn in full daylight. Warm sun illuminates the thatched roof and timber walls. Windows reflect blue sky. Door is open. Quiet, peaceful.
  Header "Day - Smoke Rising" (0,1): Same daytime view but a thin trail of grey smoke rises from the stone chimney. Kitchen is active. Small detail change from Idle.
  Header "Day - Sign Swaying" (0,2): Same daytime view but the hanging wooden sign tilts slightly to the right as if caught by a breeze. Sign text is too small to read at pixel scale.

ROW 1 — Evening Transition:
  Header "Evening - Lights On" (1,0): Dusk sky tones (purple-orange). All windows now glow warm golden-yellow from interior candles and hearth. The facade is slightly darker.
  Header "Evening - Chimney Glow" (1,1): Evening view with a warm orange glow emanating from the chimney top. More smoke than daytime. Windows still warmly lit.
  Header "Evening - Busy" (1,2): Evening with multiple warm-lit windows and a small figure silhouette visible in the doorway. The inn looks welcoming and active.

ROW 2 — Nighttime:
  Header "Night - Lantern Lit" (2,0): Dark night sky with stars. A single lantern glows beside the front door. Few windows still lit with dim warm light. Mostly dark facade.
  Header "Night - Quiet" (2,1): Deep night. Only one upstairs window has a faint glow. The lantern beside the door flickers. Very dark and atmospheric.
  Header "Night - Closed" (2,2): Full night, all lights extinguished. The inn is a dark silhouette with just starlight reflecting off the roof. Completely still.`,
    },
    {
      id: 'castle-tower',
      name: 'Castle Tower',
      genre: 'Classic Fantasy',
      gridSize: '2x2',
      description: 'A tall stone castle tower with crenellated battlements, narrow arrow-slit windows, and a blue pennant flag at the peak.',
      details: 'Grey stone block construction, moss growing on lower sections, a wooden door with iron reinforcement at the base. Spiral staircase window slits visible along the height.',
      colorNotes: 'Cool greys for stone, dark green moss patches, royal blue pennant, brown wooden door.',
      cellLabels: JSON.stringify([
        'Day', 'Night',
        'Damaged', 'Ruined'
      ]),
      cellGuidance: `ROW 0 — Time of Day:
  Header "Day" (0,0): The tower in bright daylight. Clean stone walls catch sunlight on the left side. Blue pennant waves in the breeze. Arrow slits are dark.
  Header "Night" (0,1): The tower under moonlight. A cool blue-grey cast over the stone. A single torch flickers at the top of the battlements. Pennant barely visible.

ROW 1 — Damage States:
  Header "Damaged" (1,0): The tower has taken battle damage. Cracks run through the upper stonework, two blocks are missing from the battlements. The pennant is torn. Scorch marks around an arrow slit.
  Header "Ruined" (1,1): The tower is a ruin. The top third has collapsed, leaving jagged broken walls. No pennant. Vines and moss cover exposed surfaces. Rubble at the base.`,
    },
    {
      id: 'space-station-module',
      name: 'Space Station Module',
      genre: 'Sci-Fi',
      gridSize: '2x3',
      description: 'A cylindrical space station module with metallic hull plating, glowing blue viewport windows, and antenna arrays on top.',
      details: 'Brushed metal hull with panel seam lines, a circular airlock hatch on one side, solar panel wing extending from the right side, blinking navigation lights.',
      colorNotes: 'Silver and light grey hull, blue glowing viewports, red and green navigation lights, dark solar panels with blue accents.',
      cellLabels: JSON.stringify([
        'Normal - Frame 1', 'Normal - Frame 2',
        'Alert - Frame 1', 'Alert - Frame 2',
        'Damaged', 'Destroyed'
      ]),
      cellGuidance: `ROW 0 — Normal Operation (loop 1→2→1):
  Header "Normal - Frame 1" (0,0): The module in standard operation. Viewports glow steady blue. Navigation lights: green on right, red on left. Antenna array points upward.
  Header "Normal - Frame 2" (0,1): Subtle animation frame — navigation lights blink (swap positions or dim), antenna tilts very slightly. Viewport glow unchanged.

ROW 1 — Alert Mode (loop 1→2→1):
  Header "Alert - Frame 1" (1,0): Red alert mode. Viewports pulse orange-red instead of blue. A rotating amber warning light is visible on top. Hull unchanged.
  Header "Alert - Frame 2" (1,1): Alert animation frame — warning light rotated to opposite side, viewport glow slightly dimmer (pulse trough). Tense atmosphere.

ROW 2 — Damage Progression:
  Header "Damaged" (2,0): Hull breach on the upper left section — torn metal plates and sparks. One viewport is dark/cracked. Solar panel bent at an angle. Some debris floating nearby.
  Header "Destroyed" (2,1): The module is wrecked. Hull split open exposing interior compartments. All viewports dark. Solar panel detached. Sparks and small fires. Debris cloud.`,
    },
    {
      id: 'ancient-tree',
      name: 'Ancient Tree',
      genre: 'Nature',
      gridSize: '3x3',
      description: 'A massive ancient oak tree with a thick gnarled trunk, spreading canopy of leaves, and visible root system above ground.',
      details: 'Trunk is wide enough for a door-sized hollow at the base. Branches spread in all directions forming a broad canopy. Thick roots break through the soil around the base.',
      colorNotes: 'Dark brown trunk, varied greens for leaves (spring=bright, summer=deep, autumn=orange/red), bare grey-brown branches in winter.',
      cellLabels: JSON.stringify([
        'Spring', 'Summer', 'Autumn',
        'Winter', 'Enchanted', 'Corrupted',
        'Sapling', 'Ancient', 'Dead'
      ]),
      cellGuidance: `ROW 0 — Seasons (bright conditions):
  Header "Spring" (0,0): The tree in early spring with fresh bright-green leaves just emerging. Small white blossoms scattered in the canopy. Light green grass at the base.
  Header "Summer" (0,1): Full summer canopy — dense deep-green foliage. The tree is at its most lush and full. Dappled sunlight visible. Rich green grass below.
  Header "Autumn" (0,2): Autumn colors — leaves in oranges, reds, and golds. Some leaves falling. A few bare branch tips visible through the thinning canopy.

ROW 1 — Special Variants:
  Header "Winter" (1,0): Bare winter branches covered in a light dusting of snow. No leaves. The trunk's texture and gnarled shape are fully visible. Snow on the ground.
  Header "Enchanted" (1,1): The tree glows with magical energy. Small motes of light float among summer-green leaves. The hollow at the base emits a soft golden glow.
  Header "Corrupted" (1,2): Dark twisted version. Leaves are sickly purple-black. The trunk has dark veins of corruption. The ground around it is dead and grey.

ROW 2 — Life Stages:
  Header "Sapling" (2,0): A young version of the tree — thin trunk, small canopy, only a few branches. Fresh and bright green. No hollow yet.
  Header "Ancient" (2,1): Extremely old version — massive trunk, sprawling roots, heavy moss and lichen. Canopy is enormous. A wise, weathered presence.
  Header "Dead" (2,2): The tree has died. Bare grey branches, cracked dry trunk, no leaves. Some branches have broken off. Dry ground with dead grass.`,
    },
    {
      id: 'blacksmith-shop',
      name: 'Blacksmith Shop',
      genre: 'Village',
      gridSize: '3x3',
      description: 'A sturdy blacksmith workshop with an open-air forge, a large anvil visible inside, and a shingled roof with a wide chimney billowing smoke.',
      details: 'Stone and brick construction with heavy wooden support beams. Open front wall exposes the forge and anvil. Weapon and tool racks on the back wall. Bellows beside the forge.',
      colorNotes: 'Dark red-brown brick, grey stone, orange forge glow, dark iron anvil and tools, brown wooden beams.',
      cellLabels: JSON.stringify([
        'Idle', 'Forge Lit', 'Sparks Flying',
        'Light Damage', 'Heavy Damage', 'Destroyed',
        'Day', 'Afternoon', 'Night'
      ]),
      cellGuidance: `ROW 0 — Activity States (loop Idle→Forge Lit→Sparks→Forge Lit):
  Header "Idle" (0,0): The shop at rest. Forge is cold/dark, no smoke from chimney. Tools hang neatly on racks. The anvil sits empty. Quiet and still.
  Header "Forge Lit" (0,1): The forge is burning — warm orange glow illuminates the interior. Smoke rises from the chimney. The bellows are compressed, ready.
  Header "Sparks Flying" (0,2): Active forging — bright sparks spray from the anvil area. Forge blazes hot white-orange. Heavy smoke billows from chimney. The most active frame.

ROW 1 — Damage Progression:
  Header "Light Damage" (1,0): Minor battle damage. Some roof shingles displaced, a crack in the front wall. Forge is out. One tool rack has fallen. Still structurally sound.
  Header "Heavy Damage" (1,1): Severe damage. Part of the roof has collapsed. The front wall has a large breach. Anvil toppled. Soot and char marks everywhere.
  Header "Destroyed" (1,2): The shop is ruined. Most of the roof gone, walls crumbled to half-height. The forge is a pile of rubble. Charred beams. Only the chimney partially stands.

ROW 2 — Time of Day:
  Header "Day" (2,0): Bright daylight. The shop is open and ready for business. Forge has a warm glow. Clear lighting, sharp shadows.
  Header "Afternoon" (2,1): Golden hour lighting — warm amber light from the right. Long shadows. The forge glow is less visible against the warm ambient light.
  Header "Night" (2,2): Night scene with the forge as the main light source. Warm orange glow spills outward. Everything outside the forge-light is dark blue-grey shadow.`,
    },
    {
      id: 'haunted-cathedral',
      name: 'Haunted Cathedral',
      genre: 'Dark Fantasy',
      gridSize: '2x3',
      description: 'A Gothic cathedral with pointed arched windows, a tall spire, flying buttresses, and an ominous atmosphere with cracked stonework and overgrown vines.',
      details: 'Dark stone construction with ornate Gothic architectural details. Large rose window on the front facade. Double wooden doors, one hanging ajar. Gargoyles perch on corners.',
      colorNotes: 'Dark grey and charcoal stone, deep purple stained glass glow, sickly green vine overgrowth, pale moonlight blues.',
      cellLabels: JSON.stringify([
        'Day - Abandoned', 'Day - Haunted',
        'Dusk - Eerie Glow', 'Dusk - Spirits',
        'Night - Dark', 'Night - Possessed'
      ]),
      cellGuidance: `ROW 0 — Daytime States:
  Header "Day - Abandoned" (0,0): The cathedral in daylight but clearly long-abandoned. Cracked walls, overgrown vines, broken windows. Still imposing but desolate. No supernatural elements.
  Header "Day - Haunted" (0,1): Same daytime view but with subtle supernatural hints — a faint ghostly wisp near the doorway, one window glowing faintly purple from inside.

ROW 1 — Dusk Transition:
  Header "Dusk - Eerie Glow" (1,0): Twilight sky. The rose window now glows an unsettling purple. A faint green mist creeps along the ground at the cathedral base.
  Header "Dusk - Spirits" (1,1): Dusk with ghostly figures barely visible near the windows and entrance. The purple glow is brighter. Small spectral orbs float around the spire.

ROW 2 — Night Horror:
  Header "Night - Dark" (2,0): Deep night. The cathedral is a menacing dark silhouette against a moonlit sky. Only the rose window pulses with a dim, rhythmic purple glow.
  Header "Night - Possessed" (2,1): Full supernatural event — the cathedral glows from within with intense purple and green light. Spectral energy crackles around the spire. Ghostly faces in windows. The ground mist is thick and glowing.`,
    },
    {
      id: 'cyberpunk-noodle-shop',
      name: 'Cyberpunk Noodle Shop',
      genre: 'Cyberpunk',
      gridSize: '3x3',
      description: 'A cramped street-level noodle shop with a glowing neon sign, steam vents, and a roll-up metal shutter. Wedged between towering megastructures.',
      details: 'Corrugated metal walls plastered with holographic ads. A serving counter with bar stools faces the street. Overhead cables and pipes run across the facade. A flickering neon bowl-and-chopsticks sign hangs above.',
      colorNotes: 'Hot pink and cyan neon, dark gunmetal walls, warm orange interior light, purple holographic ad accents, yellow steam highlights.',
      cellLabels: JSON.stringify([
        'Open - Idle', 'Open - Steam Burst', 'Open - Neon Flicker',
        'Busy Hour', 'Rain - Reflections', 'Rain - Heavy',
        'Closed - Shuttered', 'Closed - Neon Only', 'Power Outage'
      ]),
      cellGuidance: `ROW 0 — Open for Business:
  Header "Open - Idle" (0,0): The shop is open, shutter rolled up. Warm orange light spills from inside. Neon sign glows steady pink-cyan. A wisp of steam rises from the kitchen vent. Calm street scene.
  Header "Open - Steam Burst" (0,1): A burst of white-yellow steam erupts from the kitchen vent, partially obscuring the upper facade. Neon sign visible through the haze. Interior still warmly lit.
  Header "Open - Neon Flicker" (0,2): The neon sign blinks — the bowl portion is dark, only chopsticks glow cyan. One holographic ad on the wall glitches. Otherwise same as Idle.

ROW 1 — Atmosphere Variants:
  Header "Busy Hour" (1,0): Peak hour — warm glow is brighter, more steam, small silhouette figures visible at the counter stools. The neon sign blazes at full intensity. Lively energy.
  Header "Rain - Reflections" (1,1): Light rain. Puddles on the ground reflect the neon pink and cyan. Rain streaks visible against the dark walls. Interior glow creates warm contrast.
  Header "Rain - Heavy" (1,2): Heavy downpour. Rain is dense, partially obscuring the facade. Neon colors bleed and streak in the rain. Steam mixes with rain vapor. Moody and atmospheric.

ROW 2 — Closed States:
  Header "Closed - Shuttered" (2,0): Metal shutter is down. The neon sign is off. Holographic ads still flicker faintly. Dark and quiet. Only ambient city-glow illuminates the wet metal.
  Header "Closed - Neon Only" (2,1): Shutter down but the neon sign still glows — a beacon in the dark alley. The pink-cyan light reflects off the metal shutter. Everything else dark.
  Header "Power Outage" (2,2): Complete darkness. No neon, no ads, no interior light. The shop is a dark metallic shape. Only faint moonlight/ambient highlights the corrugated edges.`,
    },
    {
      id: 'desert-pyramid',
      name: 'Desert Pyramid',
      genre: 'Ancient',
      gridSize: '2x2',
      description: 'A weathered sandstone step pyramid rising from desert dunes, with hieroglyphic carvings on the entrance facade and a golden capstone at the peak.',
      details: 'Four-stepped pyramid with smooth sandstone blocks. A dark entrance doorway at the base center flanked by carved pillars. Hieroglyphic panels on either side. Wind-worn edges. Sand drifts against the lower steps.',
      colorNotes: 'Sandy tan and warm ochre stone, golden capstone catching sunlight, dark entrance shadow, faded turquoise and red hieroglyphic paint traces.',
      cellLabels: JSON.stringify([
        'Day - Intact', 'Day - Excavated',
        'Curse Active', 'Sandstorm'
      ]),
      cellGuidance: `ROW 0 — Archaeological States:
  Header "Day - Intact" (0,0): The pyramid in bright desert sunlight. Clean sandstone glowing warm. Golden capstone gleams. Sand dunes around the base. Clear blue sky implied by lighting. Sharp shadows on stepped surfaces.
  Header "Day - Excavated" (0,1): Same daylight pyramid but with archaeological scaffolding on one side. Exposed hieroglyphic panel cleaned to reveal vivid turquoise and red paint. Dig trenches at the base expose buried lower steps.

ROW 1 — Supernatural/Environmental:
  Header "Curse Active" (1,0): The pyramid's entrance glows with an eerie green-gold light. Hieroglyphics pulse faintly. The golden capstone emits a beam of light upward. Sand around the base levitates slightly. Ominous atmosphere.
  Header "Sandstorm" (1,1): A sandstorm engulfs the pyramid. Dense tan-brown sand swirls obscure the lower half. Only the upper steps and golden capstone peek through the storm. Wind-driven sand streaks across the frame.`,
    },
    {
      id: 'underwater-coral-shrine',
      name: 'Underwater Coral Shrine',
      genre: 'Aquatic Fantasy',
      gridSize: '2x3',
      description: 'A submerged shrine built from living coral and seashells, with bioluminescent algae providing an ethereal glow. Ancient stone archway at the center.',
      details: 'A stone arch entrance covered in barnacles and coral growth. Brain coral and branching coral form natural walls. Giant clamshells flank the entrance. Kelp strands sway from the top. Schools of tiny fish swim nearby.',
      colorNotes: 'Deep sea blues and teals for water tones, vibrant coral pinks and oranges, bioluminescent cyan-green glow, pearl-white shells, moss-green kelp.',
      cellLabels: JSON.stringify([
        'Calm - Day', 'Calm - Night',
        'Current - Fish Swarm', 'Current - Kelp Sway',
        'Awakened - Glow', 'Awakened - Portal'
      ]),
      cellGuidance: `ROW 0 — Calm Waters:
  Header "Calm - Day" (0,0): The shrine in shallow sunlit water. Light rays filter down from above, creating caustic patterns on the coral. Bioluminescence is subtle. Fish idle near the entrance. Peaceful and serene.
  Header "Calm - Night" (0,1): Deep night waters — darker blue-black tones. The bioluminescent algae now clearly glow cyan-green along the coral edges and archway. A few jellyfish drift above. Mystical and quiet.

ROW 1 — Active Ocean:
  Header "Current - Fish Swarm" (1,0): A large school of small silver fish swirls around the shrine, creating a living cloud of movement. The coral is partially obscured. Dynamic and lively.
  Header "Current - Kelp Sway" (1,1): Strong current — kelp strands stream dramatically to the right. Small bubbles trail from the coral peaks. The shrine looks windswept underwater. Sand particles in the water.

ROW 2 — Magical Awakening:
  Header "Awakened - Glow" (2,0): The shrine activates — all bioluminescent algae blaze bright cyan-green. The coral pulses with inner light. The clamshells open to reveal glowing pearls. Ancient runes on the stone arch illuminate.
  Header "Awakened - Portal" (2,1): Full magical event — a swirling portal of blue-white light fills the stone archway. Energy ripples radiate outward through the water. All coral glows intensely. Fish scatter. The shrine is a beacon of power.`,
    },
    {
      id: 'mushroom-cottage',
      name: 'Mushroom Cottage',
      genre: 'Fairy Tale',
      gridSize: '3x3',
      description: 'A whimsical cottage built inside a giant red-and-white spotted toadstool mushroom, with a round wooden door, tiny windows, and a smoking chimney poking through the cap.',
      details: 'The mushroom cap serves as the roof — bright red with white spots. A round hobbit-style door with brass hinges. Two small round windows with flower boxes. A tiny cobblestone path leads to the door. Smaller decorative mushrooms grow around the base.',
      colorNotes: 'Bright red mushroom cap with white spots, cream-colored stem/walls, warm brown door and window frames, green grass and moss, yellow flower box flowers.',
      cellLabels: JSON.stringify([
        'Spring - Flowers', 'Summer - Butterflies', 'Autumn - Falling Leaves',
        'Winter - Snow Cap', 'Fairy Lights', 'Enchanted Growth',
        'Tiny Cottage', 'Standard', 'Grand Mushroom'
      ]),
      cellGuidance: `ROW 0 — Seasonal Variants:
  Header "Spring - Flowers" (0,0): The mushroom cottage in spring. Flower boxes overflow with colorful blooms. Small wildflowers surround the base. The mushroom cap is vibrant and fresh. Bright, cheerful lighting.
  Header "Summer - Butterflies" (0,1): Full summer — lush green grass, tiny colorful butterflies flutter around the cottage. The mushroom cap is at its brightest red. Warm golden sunlight.
  Header "Autumn - Falling Leaves" (0,2): Autumn tones — tiny orange and yellow leaves drift past. The grass is amber-green. A small pumpkin sits beside the door. The mushroom cap has slight golden-brown patches.

ROW 1 — Magical Variants:
  Header "Winter - Snow Cap" (1,0): Snow covers the mushroom cap spots, creating a cozy winter scene. Icicles hang from the cap edge. Warm glow from the windows. Bare tiny trees nearby.
  Header "Fairy Lights" (1,1): Twilight scene with tiny glowing fairy lights strung around the cap edge and along the path. Fireflies dot the air. The windows glow warm. Magical and cozy.
  Header "Enchanted Growth" (1,2): The mushroom has been magically enhanced — the cap glows faintly, sparkle particles float upward, smaller mushrooms around the base also glow in various colors. Mystical energy.

ROW 2 — Size Variants (same design, different scale):
  Header "Tiny Cottage" (2,0): A very small version — just big enough for a pixie. The door is acorn-sized. Only one window. A single tiny mushroom companion. Adorable miniature scale.
  Header "Standard" (2,1): The normal-sized cottage as described. This is the canonical reference version with all details at standard scale.
  Header "Grand Mushroom" (2,2): An enormous version — the mushroom is three stories tall with multiple windows at different heights. A balcony wraps around the stem. Multiple chimneys. Grand and impressive.`,
    },
    {
      id: 'mech-hangar',
      name: 'Mech Hangar Bay',
      genre: 'Mecha',
      gridSize: '2x3',
      description: 'A massive military hangar bay with blast doors, heavy crane systems, and industrial catwalks. Designed to house and maintain giant combat mechs.',
      details: 'Reinforced steel blast doors that open vertically. Interior visible when open — a mech silhouette in a maintenance cradle, tool racks, fuel lines. Hazard stripe markings on the floor. Overhead crane rail runs the width. Control booth on upper right.',
      colorNotes: 'Military dark green and steel grey, hazard yellow-black stripes, red warning lights, white industrial lighting interior, blue holographic displays in control booth.',
      cellLabels: JSON.stringify([
        'Doors Closed', 'Doors Opening',
        'Doors Open - Empty', 'Doors Open - Mech Docked',
        'Launch Sequence', 'Battle Damage'
      ]),
      cellGuidance: `ROW 0 — Door States:
  Header "Doors Closed" (0,0): The hangar exterior with massive blast doors fully shut. Hazard stripes visible at the door seam. A red status light glows above. The structure looks imposing and sealed. Military stencil numbering on the door.
  Header "Doors Opening" (0,1): The blast doors mid-opening — a bright white gap reveals the lit interior. Hydraulic pistons visible on the door sides. Steam vents from the mechanism. Status light is amber/yellow.

ROW 1 — Interior States:
  Header "Doors Open - Empty" (1,0): Doors fully open revealing an empty hangar bay. The maintenance cradle is vacant. Overhead crane idle. Interior lit with white industrial lights. Tool racks and fuel lines visible. Clean and ready.
  Header "Doors Open - Mech Docked" (1,1): Doors open with a large mech silhouette locked in the maintenance cradle. Robotic arms perform maintenance. Blue holographic diagnostic displays active in the control booth. Busy scene.

ROW 2 — Action States:
  Header "Launch Sequence" (2,0): Active launch — the mech stands at the open door threshold, backlit by interior lights. Thruster exhaust glows blue-white at its feet. Catwalks retracted. Warning lights flash. Dramatic tension.
  Header "Battle Damage" (2,1): The hangar has taken hits — one blast door is crumpled inward, scorch marks on the walls. Sparks shower from severed cables. Interior fires visible. The crane has collapsed. Debris everywhere.`,
    },
    {
      id: 'volcanic-forge-temple',
      name: 'Volcanic Forge Temple',
      genre: 'Elemental',
      gridSize: '3x3',
      description: 'A massive temple built into the face of an active volcano, with lava channels running through carved stone conduits and a great forge entrance framed by obsidian pillars.',
      details: 'Black volcanic rock and obsidian construction. Carved dwarven/elemental runes glow orange along the pillars. Lava flows through carved channels on either side of the entrance. A huge forge opening reveals the orange-white glow of the inner sanctum. Stone steps lead up to the entrance.',
      colorNotes: 'Black obsidian and dark volcanic rock, bright orange-red lava and forge glow, carved runes glow amber-orange, grey volcanic ash, deep red accents.',
      cellLabels: JSON.stringify([
        'Dormant', 'Active - Lava Flow', 'Eruption',
        'Forge Cold', 'Forge Blazing', 'Forge - Artifact',
        'Day - Smoke', 'Lava Night', 'Destroyed'
      ]),
      cellGuidance: `ROW 0 — Volcanic Activity:
  Header "Dormant" (0,0): The temple with minimal volcanic activity. Lava channels are dark with only a faint orange glow deep within. The forge entrance is dimly lit. Wisps of smoke from the mountaintop. Imposing but quiet.
  Header "Active - Lava Flow" (0,1): Volcanic activity increasing — lava flows brightly through the carved channels. The forge entrance glows orange-white. Rune carvings on pillars pulse with heat. Steam and heat shimmer in the air.
  Header "Eruption" (0,2): Full eruption behind the temple — lava fountains spray upward, molten rock rains down. The temple channels overflow with bright lava. Intense orange-red glow illuminates everything. Ash and embers fill the air.

ROW 1 — Forge States:
  Header "Forge Cold" (1,0): The great forge is inactive — the entrance is dark. No lava in the channels. The obsidian pillars are cold black. The runes are unlit. The temple looks abandoned and ancient.
  Header "Forge Blazing" (1,1): The forge is at full power — white-hot light pours from the entrance. Sparks fly outward. Lava channels glow intensely. Runes blaze bright orange. Heat waves visible. The temple is alive with elemental energy.
  Header "Forge - Artifact" (1,2): A magical forging event — the forge emits a beam of golden light upward from the entrance. The lava channels pulse in rhythm. Runes cycle through colors (orange to white). An aura of power surrounds the temple.

ROW 2 — Environmental:
  Header "Day - Smoke" (2,0): Daylight view with volcanic smoke drifting from the peak. The dark obsidian contrasts against the sky. Lava channels have a moderate warm glow. The temple's carved details are clearly visible.
  Header "Lava Night" (2,1): Night scene — the temple is silhouetted against the dark sky, lit only by the lava glow from channels and forge. Runes provide accent lighting. The volcanic rock absorbs all other light. Dramatic and ominous.
  Header "Destroyed" (2,2): The temple has been destroyed by a catastrophic eruption. Obsidian pillars shattered, forge entrance collapsed. Cooled black lava covers the steps. Some channels still glow faintly. Ruins and rubble.`,
    },
  ];

  const insert = db.prepare(
    `INSERT OR REPLACE INTO building_presets (id, name, genre, grid_size, description, details, color_notes, cell_labels, cell_guidance, is_preset)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`
  );

  const insertAll = db.transaction(() => {
    for (const p of PRESETS) {
      insert.run(p.id, p.name, p.genre, p.gridSize, p.description, p.details, p.colorNotes, p.cellLabels, p.cellGuidance);
    }
  });

  insertAll();
  console.log(`[DB] Seeded ${PRESETS.length} building presets.`);
}

function seedTerrainPresets(db) {
  const PRESETS = [
    {
      id: 'grassland-plains',
      name: 'Grassland Plains',
      genre: 'Nature',
      gridSize: '4x4',
      description: 'Lush green grassland tiles with dirt paths, wildflowers, and natural ground variations for an overworld map.',
      colorNotes: 'Vibrant greens for grass, warm brown for dirt, yellow-green for dry patches, tiny wildflower accents in white and yellow.',
      tileLabels: JSON.stringify([
        'Base Grass 1', 'Base Grass 2', 'Base Grass 3', 'Tall Grass',
        'Dirt Path H', 'Dirt Path V', 'Dirt Crossroad', 'Dirt Patch',
        'Grass-Dirt Edge N', 'Grass-Dirt Edge S', 'Grass-Dirt Edge E', 'Grass-Dirt Edge W',
        'Grass-Dirt Corner NE', 'Grass-Dirt Corner NW', 'Grass-Dirt Corner SE', 'Grass-Dirt Corner SW'
      ]),
      tileGuidance: `ROW 0 — Base Grass Tiles (seamlessly tileable with each other):
  Header "Base Grass 1" (0,0): Standard grass tile — short green blades with subtle shade variation. A few tiny wildflowers. This is the most common ground tile.
  Header "Base Grass 2" (0,1): Grass variant with slightly different blade pattern and a small bare soil patch. Tiles seamlessly with Base Grass 1.
  Header "Base Grass 3" (0,2): Grass variant with a tiny rock or two embedded in the soil. Different blade arrangement from 1 and 2.
  Header "Tall Grass" (0,3): Taller, denser grass blades reaching upward. Darker green. Represents overgrown or wild areas.

ROW 1 — Dirt Path Tiles:
  Header "Dirt Path H" (1,0): Horizontal dirt path — packed brown earth running left to right, grass on top and bottom edges. Path edges are slightly ragged.
  Header "Dirt Path V" (1,1): Vertical dirt path — packed brown earth running top to bottom, grass on left and right edges.
  Header "Dirt Crossroad" (1,2): Four-way dirt intersection — paths extend to all four edges. Center is well-worn brown earth.
  Header "Dirt Patch" (1,3): A bare dirt area with no grass — full tile of packed earth with small pebbles. Used for clearings.

ROW 2 — Grass-to-Dirt Edge Transitions (straight edges):
  Header "Grass-Dirt Edge N" (2,0): Grass on the north half, dirt on the south half. Clean natural transition line running horizontally.
  Header "Grass-Dirt Edge S" (2,1): Dirt on the north half, grass on the south half. Reverse of Edge N.
  Header "Grass-Dirt Edge E" (2,2): Grass on the east half, dirt on the west half. Transition line runs vertically.
  Header "Grass-Dirt Edge W" (2,3): Dirt on the east half, grass on the west half. Reverse of Edge E.

ROW 3 — Grass-to-Dirt Corner Transitions:
  Header "Grass-Dirt Corner NE" (3,0): Grass fills the northeast quarter, dirt fills the rest. The grass-dirt boundary curves from the north edge to the east edge.
  Header "Grass-Dirt Corner NW" (3,1): Grass fills the northwest quarter, dirt fills the rest.
  Header "Grass-Dirt Corner SE" (3,2): Grass fills the southeast quarter, dirt fills the rest.
  Header "Grass-Dirt Corner SW" (3,3): Grass fills the southwest quarter, dirt fills the rest.`,
    },
    {
      id: 'dungeon-stone',
      name: 'Dungeon Stone',
      genre: 'Dungeon',
      gridSize: '3x3',
      description: 'Dark stone floor tiles for dungeon interiors with cracks, moss, and wear patterns.',
      colorNotes: 'Dark grey and charcoal stone, green-grey moss accents, brown-black cracks, subtle blue-grey highlights on wet surfaces.',
      tileLabels: JSON.stringify([
        'Stone Floor 1', 'Stone Floor 2', 'Cracked Stone',
        'Mossy Stone', 'Wet Stone', 'Rubble',
        'Wall Base N', 'Wall Base S', 'Wall Corner'
      ]),
      tileGuidance: `ROW 0 — Base Stone Floors (seamlessly tileable):
  Header "Stone Floor 1" (0,0): Clean-cut dark grey stone blocks in a regular pattern. Thin mortar lines between blocks. The standard dungeon floor tile.
  Header "Stone Floor 2" (0,1): Variant stone floor with slightly different block sizes and arrangement. Same color palette as Floor 1 for seamless tiling.
  Header "Cracked Stone" (0,2): Stone floor with visible cracks running through several blocks. Some blocks are slightly displaced. Signs of age and damage.

ROW 1 — Environmental Variants:
  Header "Mossy Stone" (1,0): Stone floor with patches of dark green moss growing in the mortar lines and across some block surfaces. Damp atmosphere.
  Header "Wet Stone" (1,1): Stone floor with a wet sheen — subtle blue-grey reflective highlights on the surface. Small puddle in one corner.
  Header "Rubble" (1,2): Broken stone floor with scattered debris — crumbled blocks, small rock fragments, dust. A partially collapsed area.

ROW 2 — Wall Transition Tiles:
  Header "Wall Base N" (2,0): Stone floor on the south half transitioning to a wall base on the north half. The wall is darker, taller stone blocks with a visible baseboard ledge.
  Header "Wall Base S" (2,1): Wall base on the south half, stone floor on the north half. Reverse of Wall Base N.
  Header "Wall Corner" (2,2): Corner tile where two walls meet — wall base on the north and west edges, stone floor in the southeast quarter. An interior corner piece.`,
    },
    {
      id: 'desert-dunes',
      name: 'Desert Dunes',
      genre: 'Desert',
      gridSize: '4x4',
      description: 'Sandy desert tiles with dunes, rocky outcrops, and oasis transitions for arid environments.',
      colorNotes: 'Warm sandy tan and golden yellow for sand, reddish-brown for rock, dark brown shadows in dune valleys, blue-green for oasis water edges.',
      tileLabels: JSON.stringify([
        'Flat Sand 1', 'Flat Sand 2', 'Rippled Sand', 'Wind Swept',
        'Dune Crest N', 'Dune Crest S', 'Dune Shadow', 'Sand-Rock Mix',
        'Rocky Ground', 'Sandstone', 'Cracked Earth', 'Fossil',
        'Sand-Oasis Edge N', 'Sand-Oasis Edge S', 'Sand-Oasis Edge E', 'Sand-Oasis Edge W'
      ]),
      tileGuidance: `ROW 0 — Base Sand Tiles (seamlessly tileable):
  Header "Flat Sand 1" (0,0): Smooth flat sand with subtle grain texture. Warm tan color. The default desert ground tile.
  Header "Flat Sand 2" (0,1): Sand variant with slightly different grain pattern and a few small pebbles. Tiles with Flat Sand 1.
  Header "Rippled Sand" (0,2): Sand with visible wind ripple patterns running diagonally. Small parallel ridges across the surface.
  Header "Wind Swept" (0,3): Sand with wind-blown streaks and a thin layer of fine dust. Slightly lighter color with movement lines.

ROW 1 — Dune Features:
  Header "Dune Crest N" (1,0): A sand dune crest running across the north portion — elevated lighter sand catching light on the north side, darker shadow on the south side.
  Header "Dune Crest S" (1,1): Dune crest on the south portion. Shadow falls northward. Reverse lighting of Dune Crest N.
  Header "Dune Shadow" (1,2): The shadowed valley between dunes — darker warm brown sand. Tiles between Dune Crest tiles.
  Header "Sand-Rock Mix" (1,3): Sand with small rocks and pebbles scattered across the surface. Transition between pure sand and rocky areas.

ROW 2 — Rocky Desert Tiles:
  Header "Rocky Ground" (2,0): Hard-packed desert floor with exposed reddish-brown rock. Minimal sand. Rough texture.
  Header "Sandstone" (2,1): Flat sandstone surface with natural layered patterns visible. Warm reddish-tan. Smooth but weathered.
  Header "Cracked Earth" (2,2): Dried, cracked mud or clay surface — a polygon pattern of cracks revealing dry soil beneath. Parched and arid.
  Header "Fossil" (2,3): Sandy ground with a partially exposed fossil — a small spiral shell or bone fragment embedded in sandstone. A rare decorative tile.

ROW 3 — Sand-to-Oasis Edges:
  Header "Sand-Oasis Edge N" (3,0): Sand on the north half transitioning to wet dark earth and sparse grass on the south half. The edge of an oasis.
  Header "Sand-Oasis Edge S" (3,1): Wet earth and grass on the north half, sand on the south half. Reverse of Edge N.
  Header "Sand-Oasis Edge E" (3,2): Sand on the east half, oasis vegetation on the west half. Transition runs vertically.
  Header "Sand-Oasis Edge W" (3,3): Oasis vegetation on the east half, sand on the west half. Reverse of Edge E.`,
    },
    {
      id: 'snow-tundra',
      name: 'Snow Tundra',
      genre: 'Arctic',
      gridSize: '3x3',
      description: 'Frozen tundra tiles with snow, ice, and frozen ground for arctic and winter environments.',
      colorNotes: 'Pure white and blue-white for snow, light cyan and blue for ice, dark blue-grey for frozen rock, pale blue shadows.',
      tileLabels: JSON.stringify([
        'Snow 1', 'Snow 2', 'Deep Snow',
        'Ice Patch', 'Frozen Ground', 'Snow-Ice Edge',
        'Snowdrift N', 'Snowdrift S', 'Frozen Puddle'
      ]),
      tileGuidance: `ROW 0 — Base Snow Tiles (seamlessly tileable):
  Header "Snow 1" (0,0): Clean white snow with subtle blue shadow variation. Smooth, undisturbed surface. The default winter ground tile.
  Header "Snow 2" (0,1): Snow variant with a slightly different texture — some crystalline sparkle highlights. Tiles seamlessly with Snow 1.
  Header "Deep Snow" (0,2): Thicker snow with visible depth — softer, fluffier appearance with deeper blue-white shadows in depressions.

ROW 1 — Ice and Frozen Ground:
  Header "Ice Patch" (1,0): A frozen ice surface — smooth, reflective light cyan with white highlight streaks. Slippery appearance. Some hairline cracks visible.
  Header "Frozen Ground" (1,1): Hard frozen earth with a thin dusting of snow. Dark blue-grey ground showing through white frost. Rocky texture beneath.
  Header "Snow-Ice Edge" (1,2): Snow on one half transitioning to smooth ice on the other half. Natural boundary where snow meets a frozen lake or river.

ROW 2 — Features:
  Header "Snowdrift N" (2,0): A snowdrift piled against the north edge — deeper white snow mounded up, thinner on the south side. Wind-sculpted shape.
  Header "Snowdrift S" (2,1): Snowdrift against the south edge. Reverse of Snowdrift N. Mounded snow with wind-carved curves.
  Header "Frozen Puddle" (2,2): Snow ground with a small frozen puddle in the center — smooth ice circle surrounded by snow. A few bubbles trapped under the ice.`,
    },
    {
      id: 'volcanic-rock',
      name: 'Volcanic Rock',
      genre: 'Elemental',
      gridSize: '4x4',
      description: 'Volcanic terrain tiles with obsidian, lava flows, ash, and cooled magma for fiery environments.',
      colorNotes: 'Black and dark grey obsidian, bright orange-red for active lava, dark red for cooling lava, grey ash, amber ember glow.',
      tileLabels: JSON.stringify([
        'Obsidian 1', 'Obsidian 2', 'Basalt', 'Pumice',
        'Lava Flow H', 'Lava Flow V', 'Lava Pool', 'Cooling Lava',
        'Ash Ground', 'Scorched Earth', 'Ember Glow', 'Lava Crack',
        'Rock-Lava Edge N', 'Rock-Lava Edge S', 'Rock-Lava Edge E', 'Rock-Lava Edge W'
      ]),
      tileGuidance: `ROW 0 — Base Volcanic Rock (seamlessly tileable):
  Header "Obsidian 1" (0,0): Smooth black obsidian with glassy reflective highlights. The standard volcanic floor tile. Subtle purple-black sheen.
  Header "Obsidian 2" (0,1): Obsidian variant with slightly rougher texture and small embedded crystals. Tiles with Obsidian 1.
  Header "Basalt" (0,2): Rough dark grey basalt with columnar texture. Hexagonal crack patterns. Matte finish unlike obsidian.
  Header "Pumice" (0,3): Light grey porous volcanic rock with many tiny holes. Lighter and rougher than basalt.

ROW 1 — Active Lava Tiles:
  Header "Lava Flow H" (1,0): A horizontal stream of bright orange-red molten lava flowing left to right. Dark cooled edges frame the bright center channel.
  Header "Lava Flow V" (1,1): Vertical lava stream flowing top to bottom. Same bright orange-red molten center with dark crusted edges.
  Header "Lava Pool" (1,2): A bubbling pool of lava filling most of the tile. Bright orange center, darker red-black crust around edges. A bubble of gas bursting on the surface.
  Header "Cooling Lava" (1,3): Partially cooled lava — dark red-black surface with bright orange cracks showing molten rock beneath. A transitional state between flow and solid.

ROW 2 — Ash and Ember Tiles:
  Header "Ash Ground" (2,0): Grey volcanic ash covering the ground. Fine powdery texture. Footprint-like impressions visible. Muted and desolate.
  Header "Scorched Earth" (2,1): Blackened earth with char marks and heat distortion. Former vegetation reduced to ash outlines. Dark and devastated.
  Header "Ember Glow" (2,2): Dark ground with scattered glowing embers — small orange-red points of light in the cracks. Smoldering aftermath.
  Header "Lava Crack" (2,3): Solid dark rock with a bright orange lava crack running through it diagonally. Molten rock visible through the fissure.

ROW 3 — Rock-to-Lava Edge Transitions:
  Header "Rock-Lava Edge N" (3,0): Solid obsidian on the north half, lava flow on the south half. The rock edge is crumbling and glowing where it meets the molten lava.
  Header "Rock-Lava Edge S" (3,1): Lava on the north half, solid rock on the south half. Reverse of Edge N.
  Header "Rock-Lava Edge E" (3,2): Rock on the east half, lava on the west half. Vertical transition with glowing edge.
  Header "Rock-Lava Edge W" (3,3): Lava on the east half, rock on the west half. Reverse of Edge E.`,
    },
    {
      id: 'forest-floor',
      name: 'Forest Floor',
      genre: 'Nature',
      gridSize: '5x5',
      description: 'Dense forest floor tiles with moss, roots, leaf litter, clearings, and path transitions for woodland environments.',
      colorNotes: 'Deep greens for moss, rich browns for soil and roots, amber-gold for leaf litter, dappled yellow-green for light patches.',
      tileLabels: JSON.stringify([
        'Moss 1', 'Moss 2', 'Leaf Litter', 'Pine Needles', 'Fern Patch',
        'Root Tangle', 'Root Cross', 'Root Line H', 'Root Line V', 'Bare Soil',
        'Clearing 1', 'Clearing 2', 'Mushroom Ring', 'Fallen Log', 'Rock Outcrop',
        'Path H', 'Path V', 'Path Fork', 'Path Curve NE', 'Path Curve NW',
        'Forest-Grass Edge N', 'Forest-Grass Edge S', 'Forest-Grass Edge E', 'Forest-Grass Edge W', 'Forest-Grass Corner'
      ]),
      tileGuidance: `ROW 0 — Base Forest Floor (seamlessly tileable):
  Header "Moss 1" (0,0): Thick green moss covering the ground with tiny details — small sprouts, leaf fragments. The primary forest floor tile. Rich emerald green.
  Header "Moss 2" (0,1): Moss variant with slightly different pattern and a few fallen twigs. Tiles seamlessly with Moss 1.
  Header "Leaf Litter" (0,2): Fallen leaves in amber, gold, and brown scattered over dark soil. Autumn forest floor feel.
  Header "Pine Needles" (0,3): A carpet of brown-orange pine needles over dark soil. Conifer forest ground. Linear texture direction.
  Header "Fern Patch" (0,4): Small fern fronds growing from mossy ground. Bright green ferns add vertical texture interest to the forest floor.

ROW 1 — Root and Soil Tiles:
  Header "Root Tangle" (1,0): Thick tree roots crossing the tile in multiple directions. Dark brown roots over mossy soil. Complex interwoven pattern.
  Header "Root Cross" (1,1): Two large roots crossing in an X pattern. Dark brown over green-brown soil. Used at path intersections in root-heavy areas.
  Header "Root Line H" (1,2): A single thick root running horizontally across the tile. Mossy soil above and below.
  Header "Root Line V" (1,3): A single thick root running vertically. Mossy soil on both sides.
  Header "Bare Soil" (1,4): Exposed dark brown forest soil with minimal vegetation. A few small pebbles and leaf fragments. Used for clearings.

ROW 2 — Feature Tiles:
  Header "Clearing 1" (2,0): A sunlit clearing — lighter green grass with dappled light patches. Surrounded by darker forest floor tones at edges.
  Header "Clearing 2" (2,1): Clearing variant with a few wildflowers and lighter soil. Different dappled light pattern from Clearing 1.
  Header "Mushroom Ring" (2,2): Forest floor with a semicircle of small mushrooms — brown caps with white spots. Mossy ground. A fairy ring.
  Header "Fallen Log" (2,3): A section of fallen tree trunk lying across the tile. Moss-covered bark, decomposing. Soil visible beneath.
  Header "Rock Outcrop" (2,4): A flat stone surface breaking through the forest floor. Grey rock with moss at edges. Leaf litter collects around it.

ROW 3 — Forest Path Tiles:
  Header "Path H" (3,0): A worn dirt path running horizontally through forest floor. Packed brown earth, forest floor on top and bottom.
  Header "Path V" (3,1): Vertical dirt path through forest. Mossy edges, packed earth center.
  Header "Path Fork" (3,2): A path that splits into two directions — T-junction or Y-fork. Worn earth with forest floor in the gaps.
  Header "Path Curve NE" (3,3): Path curving from south to east. Packed earth follows a natural curve through mossy ground.
  Header "Path Curve NW" (3,4): Path curving from south to west. Mirror of Path Curve NE.

ROW 4 — Forest-to-Grassland Edge Transitions:
  Header "Forest-Grass Edge N" (4,0): Dense forest floor on the north half transitioning to open grass on the south half. Tree shadow fades into sunlight.
  Header "Forest-Grass Edge S" (4,1): Open grass on the north half, forest floor on the south half. Reverse of Edge N.
  Header "Forest-Grass Edge E" (4,2): Forest floor on the east half, grass on the west half. Vertical transition.
  Header "Forest-Grass Edge W" (4,3): Grass on the east half, forest floor on the west half. Reverse of Edge E.
  Header "Forest-Grass Corner" (4,4): Forest floor in the northeast corner, grass filling the rest. A convex corner transition where forest meets grassland.`,
    },
  ];

  const insert = db.prepare(
    `INSERT OR REPLACE INTO terrain_presets (id, name, genre, grid_size, description, color_notes, tile_labels, tile_guidance, is_preset)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`
  );

  const insertAll = db.transaction(() => {
    for (const p of PRESETS) {
      insert.run(p.id, p.name, p.genre, p.gridSize, p.description, p.colorNotes, p.tileLabels, p.tileGuidance);
    }
  });

  insertAll();
  console.log(`[DB] Seeded ${PRESETS.length} terrain presets.`);
}

function seedBackgroundPresets(db) {
  const PRESETS = [
    {
      id: 'enchanted-forest',
      name: 'Enchanted Forest',
      genre: 'Fantasy',
      gridSize: '1x4',
      bgMode: 'parallax',
      description: 'A mystical enchanted forest with glowing flora, ancient trees, and magical atmosphere. Four parallax layers from sky canopy to forest floor.',
      colorNotes: 'Deep emerald and teal greens, magical cyan-blue glow accents, warm golden dappled light, purple-blue mystical haze in distant layers.',
      layerLabels: JSON.stringify([
        'Sky & Canopy', 'Mid Canopy & Light Rays', 'Undergrowth & Trunks', 'Forest Floor & Roots'
      ]),
      layerGuidance: `LAYER ORDER (top to bottom, farthest to nearest):
  Header "Sky & Canopy" (0,0): The topmost parallax layer. Dense treetop canopy filtering light — overlapping leaf clusters in deep greens with golden light breaking through gaps. Fills the ENTIRE cell. No magenta visible. A purple-blue haze creates depth. Tiny glowing motes float among the leaves.
  Header "Mid Canopy & Light Rays" (1,0): Middle layer with tree trunks and mid-level branches. Shafts of golden light beam diagonally through the canopy from upper left. Magical sparkle particles in the light beams. Magenta background visible at the top where sky/upper canopy shows through. Trees and branches fill the lower two-thirds.
  Header "Undergrowth & Trunks" (2,0): Foreground tree trunks — large, ancient, gnarled. Thick moss covers their bases. Glowing mushrooms and magical flowers dot the undergrowth between trunks. Magenta background visible in upper portion. Content fills from bottom up.
  Header "Forest Floor & Roots" (3,0): Nearest layer — massive twisted roots, fallen logs, and lush ground cover. Bioluminescent fungi glow cyan-blue along root surfaces. Ferns and magical flowers in the foreground. Magenta visible in upper half. Ground detail fills the bottom portion.`,
    },
    {
      id: 'mountain-range',
      name: 'Mountain Range',
      genre: 'Nature',
      gridSize: '1x5',
      bgMode: 'parallax',
      description: 'A majestic mountain landscape with five parallax layers creating deep atmospheric perspective from distant peaks to nearby rocky ground.',
      colorNotes: 'Pale blue-grey for distant mountains, medium slate blue for mid-range, deep grey-brown for near mountains, warm green for foothills, rich earth tones for foreground.',
      layerLabels: JSON.stringify([
        'Sky & Far Peaks', 'Distant Mountains', 'Near Mountains', 'Foothills & Trees', 'Rocky Foreground'
      ]),
      layerGuidance: `LAYER ORDER (top to bottom, farthest to nearest):
  Header "Sky & Far Peaks" (0,0): Topmost layer. A gradient sky from light blue at top to warm peach at the horizon. Very distant mountain silhouettes in pale blue-grey with snow-capped peaks barely visible through atmospheric haze. Fills the ENTIRE cell. No magenta visible.
  Header "Distant Mountains" (1,0): Second layer. A range of mountains in medium slate blue, more detailed than the sky peaks but still softened by atmospheric perspective. Snow patches visible. Magenta above where sky shows through. Mountains fill the lower two-thirds.
  Header "Near Mountains" (2,0): Third layer. Closer mountain range in deeper grey-brown tones with visible rock texture, cliff faces, and sparse vegetation. More detail and contrast. Magenta in upper portion. Mountains fill from bottom, roughly half the cell.
  Header "Foothills & Trees" (3,0): Fourth layer. Rolling green foothills with clusters of evergreen trees. Warm greens and browns. Individual trees distinguishable. Magenta in upper half. Hills and trees fill the lower portion.
  Header "Rocky Foreground" (4,0): Nearest layer. Large rocks, boulders, and scattered wildflowers in the immediate foreground. Rich brown and grey tones. Grass tufts between rocks. Magenta fills the upper two-thirds. Ground content at the very bottom of the cell.`,
    },
    {
      id: 'haunted-graveyard',
      name: 'Haunted Graveyard',
      genre: 'Horror',
      gridSize: '3x2',
      bgMode: 'scene',
      description: 'A spooky graveyard with tombstones, dead trees, and iron fencing. Six scene variants showing different atmospheric conditions.',
      colorNotes: 'Muted greys and dark blues for night, warm orange for dusk, sickly green for fog, purple for supernatural. Desaturated palette throughout.',
      layerLabels: JSON.stringify([
        'Day - Overcast', 'Dusk - Orange Sky', 'Night - Moonlit',
        'Fog - Dense', 'Rain - Storm', 'Haunted - Spirits'
      ]),
      layerGuidance: `SCENE DESIGN — Same graveyard composition across all 6 variants. Layout: iron fence in foreground, rows of tombstones in mid-ground, a large dead oak tree right of center, a small chapel silhouette on the left horizon, rolling hill skyline.

  Header "Day - Overcast" (0,0): Daytime but under heavy grey overcast clouds. Flat, even lighting. The graveyard looks abandoned and neglected but not supernatural. Muted green-grey grass, weathered grey tombstones. Fill the ENTIRE cell.
  Header "Dusk - Orange Sky" (0,1): Sunset with a vivid orange-red sky. Long dark shadows stretch toward the viewer. The dead oak tree is silhouetted dramatically. Warm light hits the tops of tombstones. Ominous mood building.
  Header "Night - Moonlit" (0,2): Full moon high in a dark blue-black sky. Silver moonlight casts sharp shadows. Tombstones gleam pale. The dead oak has an eerie silver outline. Stars visible. Classic horror atmosphere.
  Header "Fog - Dense" (1,0): Same scene enveloped in thick greenish-grey fog. Only the nearest tombstones and fence are clearly visible. The chapel and tree fade into fog. Ground-level mist obscures the grass. Visibility decreases with distance.
  Header "Rain - Storm" (1,1): Heavy rainstorm with dark purple-grey clouds. Lightning illuminates the scene in a flash — dramatic hard shadows. Rain streaks across the frame. Puddles form between tombstones reflecting the lightning. The tree bends in wind.
  Header "Haunted - Spirits" (1,2): Night scene with supernatural activity. Ghostly translucent figures hover above tombstones. An eerie green-purple glow emanates from the ground. The dead oak's branches reach like claws. Spectral orbs float in the air. The chapel window glows ominously.`,
    },
    {
      id: 'ocean-sunset',
      name: 'Ocean Sunset',
      genre: 'Nature',
      gridSize: '1x3',
      bgMode: 'parallax',
      description: 'A serene ocean sunset with three parallax layers — dramatic sky, distant horizon, and rolling waves.',
      colorNotes: 'Warm orange, pink, and purple for sunset sky, deep blue ocean, golden reflections on water, white foam on wave crests.',
      layerLabels: JSON.stringify([
        'Sunset Sky', 'Horizon & Distant Water', 'Waves & Foreground'
      ]),
      layerGuidance: `LAYER ORDER (top to bottom, farthest to nearest):
  Header "Sunset Sky" (0,0): The full sky layer — a gradient from deep purple-blue at the top through pink and orange to golden yellow at the horizon line. Wispy clouds catch the sunset light in warm pink and orange. The sun is a bright golden-white disc near the bottom center. Fills the ENTIRE cell. No magenta visible.
  Header "Horizon & Distant Water" (1,0): The ocean horizon and middle-distance water. Calm deep blue sea with golden-orange sun reflection creating a bright path on the water surface. Gentle wave texture. Magenta visible at the top where sky shows through. Water fills the lower two-thirds.
  Header "Waves & Foreground" (2,0): Nearest water layer — larger rolling waves with white foam crests. Deeper blue-green water with warm sunset reflections. Spray particles catch the golden light. Magenta fills the upper half. Waves and water fill the bottom portion.`,
    },
    {
      id: 'cyberpunk-city',
      name: 'Cyberpunk City',
      genre: 'Sci-Fi',
      gridSize: '2x2',
      bgMode: 'scene',
      description: 'A neon-drenched cyberpunk cityscape with towering megastructures, holographic advertisements, and atmospheric pollution. Four scene variants.',
      colorNotes: 'Dark blue-grey base, hot pink and cyan neon accents, purple atmospheric haze, yellow-orange artificial lighting, green holographic displays.',
      layerLabels: JSON.stringify([
        'Day - Smog', 'Night - Neon',
        'Rain - Reflections', 'Blackout - Emergency'
      ]),
      layerGuidance: `SCENE DESIGN — Same cityscape composition across all 4 variants. Layout: a narrow street canyon between towering megastructures, dense overhead cables and pipes, holographic billboards on building faces, a distant skyline of corporate towers, street-level shops and stalls at the very bottom.

  Header "Day - Smog" (0,0): Daytime but the sky is a hazy yellow-orange from industrial smog. Buildings are visible but muted. Holographic ads are dim, barely visible in daylight. The street is grey and utilitarian. A thin crowd moves below. Fill the ENTIRE cell.
  Header "Night - Neon" (0,1): Nighttime — the city comes alive. Neon signs blaze hot pink and cyan. Holographic ads project vivid images. The buildings are dark silhouettes lit by countless colored lights. The wet street reflects neon colors. Vibrant and electric.
  Header "Rain - Reflections" (1,0): Night with heavy rain. All the neon colors bleed and streak in the rain. Massive puddles on the street create perfect reflections of the signs above. Steam rises from grates. Umbrellas in the crowd below. Atmospheric and moody.
  Header "Blackout - Emergency" (1,1): Power outage — all neon and holographic displays are dark. Only red emergency lights pulse on the buildings. The street is nearly pitch black with sparse flashlight beams. A single emergency vehicle's blue-red lights cut through the darkness. Tense and ominous.`,
    },
    {
      id: 'underwater-reef',
      name: 'Underwater Reef',
      genre: 'Fantasy',
      gridSize: '1x4',
      bgMode: 'parallax',
      description: 'A vibrant underwater coral reef with four parallax layers from the sunlit surface to the deep ocean floor.',
      colorNotes: 'Bright turquoise and teal for shallow water, deep navy for depths, vibrant coral pinks and oranges, bioluminescent cyan-green accents, golden surface light rays.',
      layerLabels: JSON.stringify([
        'Surface Light & Open Water', 'Mid Water & Fish Schools', 'Coral Formations', 'Seafloor & Anemones'
      ]),
      layerGuidance: `LAYER ORDER (top to bottom, farthest to nearest):
  Header "Surface Light & Open Water" (0,0): The topmost layer. Bright turquoise water with golden light rays streaming down from the surface above. Small bubbles rise. The water is clear and luminous. A faint surface ripple pattern at the very top. Fills the ENTIRE cell. No magenta. Color grades from bright turquoise at top to deeper blue at bottom.
  Header "Mid Water & Fish Schools" (1,0): Middle distance. Schools of small colorful tropical fish swim in formation. A sea turtle silhouette glides in the background. Water is a medium blue. Magenta visible at the top. Fish and creatures occupy the lower two-thirds of the cell.
  Header "Coral Formations" (2,0): Coral reef structures — branching coral in pinks and purples, brain coral in green, fan coral swaying. Bright orange clownfish dart among the formations. Bioluminescent accents glow cyan. Magenta above. Coral fills from the bottom up through roughly half the cell.
  Header "Seafloor & Anemones" (3,0): The nearest layer — the ocean floor with sea anemones waving their tentacles, colorful starfish, scattered shells, and sandy patches between rocks. Rich detail and saturated colors. Magenta fills the upper two-thirds. Seafloor content at the very bottom of the cell.`,
    },
  ];

  const insert = db.prepare(
    `INSERT OR REPLACE INTO background_presets (id, name, genre, grid_size, bg_mode, description, color_notes, layer_labels, layer_guidance, is_preset)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`
  );

  const insertAll = db.transaction(() => {
    for (const p of PRESETS) {
      insert.run(p.id, p.name, p.genre, p.gridSize, p.bgMode, p.description, p.colorNotes, p.layerLabels, p.layerGuidance);
    }
  });

  insertAll();
  console.log(`[DB] Seeded ${PRESETS.length} background presets.`);
}
