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

  const dbPath = process.env.DB_PATH || join(dataDir, 'grid-sprite.db');
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
  seedIsometricGridPresets(db);
  seedAnimationSeries(db);
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
      aspect_ratio TEXT DEFAULT '1:1',
      tile_shape TEXT DEFAULT 'square',
      is_preset INTEGER DEFAULT 1,
      UNIQUE(name, sprite_type, grid_size)
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
    "ALTER TABLE grid_presets ADD COLUMN aspect_ratio TEXT DEFAULT '1:1'",
    "ALTER TABLE grid_presets ADD COLUMN tile_shape TEXT DEFAULT 'square'",
    "ALTER TABLE generations ADD COLUMN aspect_ratio TEXT DEFAULT '1:1'",
    "ALTER TABLE generations ADD COLUMN content_preset_id TEXT DEFAULT NULL",
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
    INSERT OR IGNORE INTO grid_presets (name, sprite_type, genre, grid_size, cols, rows, cell_labels, cell_groups, generic_guidance, bg_mode, is_preset)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
  `);

  insertGrid.run('RPG Full', 'character', 'RPG', '6x6', 6, 6, characterCellLabels, characterCellGroups, rpgFullGuidance, null);

  // Building, terrain, and background grid presets are created per content preset
  // in their respective seed functions (seedBuildingPresets, seedTerrainPresets,
  // seedBackgroundPresets) so each gets specific cell labels matching the content.

  console.log('[DB] Seeded character grid presets.');
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
    },
    {
      id: 'wasteland-wanderer',
      name: "Wasteland Wanderer",
      genre: "Post-Apocalyptic",
      description: "A lone survivor with sun-weathered skin, a full-face gas mask with round tinted lenses, and a tattered leather duster over layered scavenged clothing. Medium wiry build with a cautious, hunched posture.",
      equipment: "A long leather duster over mismatched layered clothing, a rubber-strapped gas mask, a crude makeshift spear fashioned from a stop sign and pipe, and a bulging salvaged backpack covered in dangling trinkets.",
      colorNotes: "Dusty brown leather duster, faded olive under-layers, rust orange accents on salvaged gear. Gas mask is dark rubber with amber-tinted lenses. Spear shaft is dull grey pipe with a faded red stop-sign blade. Backpack is patched tan canvas.",
      rowGuidance: `ROW 0 — Walk Down & Walk Up:
  Header "Walk Down 1" (0,0): The Wanderer steps forward on his left foot, leather duster swaying to the right. The makeshift spear is held upright in his right hand and the salvaged backpack bounces with dangling trinkets. His gas mask's amber lenses catch the light.
  Header "Walk Down 2" (0,1): Neutral mid-step contact pose with feet together, duster hanging straight. The round amber lenses of the gas mask stare directly ahead and the stop-sign spear rests at his side.
  Header "Walk Down 3" (0,2): Mirror of Walk Down 1 — right foot leads, duster swaying left. The trinkets on the backpack jingle and the faded olive under-layers peek through the open duster front.
  Header "Walk Up 1" (0,3): Facing away with left foot forward, the bulging salvaged backpack dominates the view with its patched tan canvas and hanging trinkets. The leather duster drapes around the pack and the spear extends above his shoulder.
  Header "Walk Up 2" (0,4): Neutral mid-step facing away, the backpack and duster filling the frame. The dull grey pipe shaft of the spear rises over his right shoulder and the faded red stop-sign blade peeks at the top.
  Header "Walk Up 3" (0,5): Mirror of Walk Up 1 — right foot forward facing away, backpack shifting with the stride. Trinkets swing and the leather duster tail flaps behind his legs.

ROW 1 — Walk Left & Walk Right:
  Header "Walk Left 1" (1,0): The Wanderer faces left with his left foot forward in a cautious stride. The spear extends ahead in his leading hand and the duster trails behind, revealing the layered olive clothing beneath. The gas mask profile shows the protruding filter canister.
  Header "Walk Left 2" (1,1): Neutral contact pose facing left, feet aligned. The hunched posture is evident in profile and the backpack's bulk rises behind his shoulders. Amber lenses gleam from the mask.
  Header "Walk Left 3" (1,2): Mirror of Walk Left 1 — right foot leads while facing left, duster swinging forward. The stop-sign spear blade catches a dull red glint.
  Header "Walk Right 1" (1,3): Facing right with right foot forward, the spear leading his advance. The duster flows behind and the backpack trinkets sway. His gas mask filter canister protrudes from the far side.
  Header "Walk Right 2" (1,4): Neutral contact pose facing right, the wiry build visible beneath the heavy duster. The rust orange accents on the salvaged buckles and straps catch dim light.
  Header "Walk Right 3" (1,5): Mirror of Walk Right 1 — left foot leads while facing right, duster trailing. The backpack bounces and the amber mask lenses reflect the wasteland ahead.

ROW 2 — Idle & Battle Idle:
  Header "Idle Down" (2,0): The Wanderer stands in a slightly hunched stance facing the viewer, spear resting on his shoulder and one hand on a hip strap. The gas mask's amber lenses stare out beneath the duster's raised collar. Trinkets hang still from the backpack.
  Header "Idle Up" (2,1): Facing away at rest, the patched backpack and dangling trinkets fill the view. The leather duster hangs loosely and the spear extends upward past his shoulder. The rubber gas mask straps cross the back of his head.
  Header "Idle Left" (2,2): Facing left in a watchful hunched stance, one hand resting on the spear shaft planted beside him. The gas mask filter and amber lens are visible in profile. The duster drapes heavily.
  Header "Idle Right" (2,3): Facing right at rest, the spear leaning against his shoulder. The duster collar is turned up and the backpack's silhouette extends behind him. The mask's breathing creates a faint haze from the filter.
  Header "Battle Idle 1" (2,4): The Wanderer drops into a low defensive crouch, the stop-sign spear held horizontally at waist level with both hands. The duster pulls back from his arms and the amber lenses narrow with focus behind the mask.
  Header "Battle Idle 2" (2,5): He shifts his weight in the crouch, the spear tip tracking an unseen threat. The backpack straps creak and the trinkets clink softly. His gas mask breathing quickens, visible as a faint pulse from the filter.

ROW 3 — Battle Idle 3, Attack, Cast Start:
  Header "Battle Idle 3" (3,0): The Wanderer holds the defensive crouch, spear angled forward. The duster flares behind him and the amber lenses reflect a harsh wasteland glare. His knuckles are white on the pipe shaft.
  Header "Attack 1" (3,1): Wind-up — he pulls the stop-sign spear back over his right shoulder, body coiling. The duster wraps around his torso from the twist and the backpack shifts heavily.
  Header "Attack 2" (3,2): The spear thrusts forward in a savage jab, the faded red stop-sign blade punching outward. His body extends into the strike and the duster flares from the motion.
  Header "Attack 3" (3,3): Follow-through — the spear is fully extended, the stop-sign blade at maximum reach. The duster whips from the rotational force and the Wanderer's hunched posture straightens into the lunge.
  Header "Cast 1" (3,4): The Wanderer reaches into the backpack and pulls out a crude Molotov cocktail — a glass bottle stuffed with an oily rag. He holds a salvaged lighter in his other hand, spear tucked under his arm.
  Header "Cast 2" (3,5): The rag ignites, casting orange firelight across his gas mask. The amber lenses glow warm and the bottle's contents slosh with volatile liquid. Smoke trails from the burning rag.

ROW 4 — Cast 3, Damage, KO Start:
  Header "Cast 3" (4,0): The Wanderer hurls the Molotov forward — a small arc of fire trails the spinning bottle as it shatters at the cell edge, erupting in a compact burst of flame. He shields his mask with one arm.
  Header "Damage 1" (4,1): The Wanderer staggers backward from a hit, the spear wavering in his grip. One gas mask lens cracks in a spiderweb pattern and trinkets scatter from the jostled backpack.
  Header "Damage 2" (4,2): Stumbling further, the duster tears at the shoulder and salvaged gear spills from a ruptured backpack pocket. The cracked mask lens distorts the amber glow and his breathing rasps louder through the filter.
  Header "Damage 3" (4,3): Recovery — the Wanderer plants the spear butt into the ground for balance, steadying himself. He presses the torn duster against his side and the remaining mask lens refocuses on the threat.
  Header "KO 1" (4,4): His grip on the spear loosens as his knees buckle. The gas mask straps slip and the mask tilts sideways on his face. The backpack drags him backward with its weight.
  Header "KO 2" (4,5): The Wanderer collapses onto the backpack, the spear clattering beside him. The gas mask pulls free, revealing sun-weathered, scarred skin beneath. Trinkets scatter across the ground.

ROW 5 — KO 3, Victory, Status Poses:
  Header "KO 3" (5,0): The Wanderer lies sprawled on the ground atop the crushed backpack, the gas mask beside his weathered face. The stop-sign spear rests nearby and scattered trinkets and salvage surround his still form.
  Header "Victory 1" (5,1): The Wanderer plants the stop-sign spear into the ground and leans on it, pushing the gas mask up onto his forehead. His weathered face shows a rare, tired grin beneath.
  Header "Victory 2" (5,2): He raises the spear overhead with one hand, the faded red stop-sign blade catching the light. The duster billows and trinkets jingle in a metallic cheer from the backpack.
  Header "Victory 3" (5,3): The Wanderer slings the spear across his shoulders behind his neck, arms draped over it casually. The gas mask hangs loosely at his collar and he surveys the aftermath with amber-tinted goggles pushed up.
  Header "Weak Pose" (5,4): The Wanderer leans heavily on the spear as a crutch, one hand clutching his side. The duster is torn and caked with dust, the mask filter is clogged with soot, and the backpack hangs by a single strap.
  Header "Critical Pose" (5,5): Barely standing, the Wanderer grips the spear with trembling hands. The gas mask is cracked and wheezing, the duster is shredded, and his desperate amber lenses scan for any escape route.`,
    },
    {
      id: 'vault-dweller',
      name: "Vault Dweller",
      genre: "Post-Apocalyptic",
      description: "A young, clean-cut survivor freshly emerged from an underground vault. Short brown hair, wide blue eyes, and an expression of cautious wonder. Lean build in a fitted jumpsuit with an upright, slightly nervous posture.",
      equipment: "A bright blue jumpsuit with a yellow number '42' on the back, a chunky Pip-Boy wrist computer on the left arm with a green screen, a compact laser pistol holstered at the hip, and a small utility belt with pouches.",
      colorNotes: "Bright blue jumpsuit with yellow trim and number. Pip-Boy is dark grey-green with a glowing green screen. Laser pistol is chrome with a red energy cell. Utility belt is brown leather with brass buckles.",
      rowGuidance: `ROW 0 — Walk Down & Walk Up:
  Header "Walk Down 1" (0,0): The Vault Dweller steps forward on his left foot, the bright blue jumpsuit crisp and visible with yellow trim along the seams. The chunky Pip-Boy on his left wrist glows green and the laser pistol sits snug in the hip holster.
  Header "Walk Down 2" (0,1): Neutral mid-step contact pose with feet together. His wide blue eyes look ahead with cautious wonder and the yellow '42' is partially visible on his chest pocket. The Pip-Boy screen flickers with data.
  Header "Walk Down 3" (0,2): Mirror of Walk Down 1 — right foot leads. The utility belt pouches bounce and the chrome laser pistol handle catches light at his hip. His short brown hair is neat and clean.
  Header "Walk Up 1" (0,3): Facing away with left foot forward, the large yellow '42' on the back of the blue jumpsuit is prominently displayed. The Pip-Boy is visible on his trailing left wrist and the utility belt wraps his waist.
  Header "Walk Up 2" (0,4): Neutral mid-step facing away, the blue jumpsuit and yellow number filling the view. The brown leather utility belt pouches are visible at his sides and his short hair shows his clean-cut profile.
  Header "Walk Up 3" (0,5): Mirror of Walk Up 1 — right foot forward facing away, the jumpsuit shifting with the stride. The laser pistol holster is visible at his right hip from behind.

ROW 1 — Walk Left & Walk Right:
  Header "Walk Left 1" (1,0): The Vault Dweller faces left with his left foot forward in a careful step, Pip-Boy arm leading and its green screen visible. The blue jumpsuit is neat and the laser pistol rides at his far hip.
  Header "Walk Left 2" (1,1): Neutral contact pose facing left, his lean profile showing the yellow jumpsuit trim running down his side. The Pip-Boy is prominent on his near wrist and his nervous expression is visible.
  Header "Walk Left 3" (1,2): Mirror of Walk Left 1 — right foot leads while facing left. The utility belt pouches sway and the chrome pistol handle glints behind his hip.
  Header "Walk Right 1" (1,3): Facing right with right foot forward, the laser pistol holster visible at his near hip. The Pip-Boy trails on his far arm and his wide blue eyes scan the unfamiliar world ahead.
  Header "Walk Right 2" (1,4): Neutral contact pose facing right, jumpsuit creasing at the joints. The brown leather belt and brass buckles are visible and the Pip-Boy glows green on his far wrist.
  Header "Walk Right 3" (1,5): Mirror of Walk Right 1 — left foot leads while facing right. His slightly nervous posture shows in the way his shoulders hunch forward, Pip-Boy swinging.

ROW 2 — Idle & Battle Idle:
  Header "Idle Down" (2,0): The Vault Dweller stands facing the viewer in a slightly stiff, uncertain stance. His left arm is raised to check the Pip-Boy screen, which glows green with readouts. The blue jumpsuit is pristine and the laser pistol is holstered.
  Header "Idle Up" (2,1): Facing away, the yellow '42' on the blue jumpsuit is clear. His posture is upright but tense, hands at his sides with the Pip-Boy arm slightly raised. The utility belt hangs neatly.
  Header "Idle Left" (2,2): Facing left, the Vault Dweller taps at the Pip-Boy screen with his right hand. The green display casts a soft glow on his chin and the blue jumpsuit drapes cleanly on his lean frame.
  Header "Idle Right" (2,3): Facing right, hand resting near the holstered laser pistol. His wide blue eyes peer cautiously ahead and the yellow trim on the jumpsuit catches ambient light.
  Header "Battle Idle 1" (2,4): The Vault Dweller draws the chrome laser pistol in a two-handed grip, feet apart in a textbook shooting stance. The Pip-Boy screen switches to a targeting display and the red energy cell glows at the pistol's base.
  Header "Battle Idle 2" (2,5): He adjusts his aim nervously, the laser pistol wavering slightly in his grip. The Pip-Boy targeting display blinks with distance readings and his blue eyes narrow with determined focus.

ROW 3 — Battle Idle 3, Attack, Cast Start:
  Header "Battle Idle 3" (3,0): The Vault Dweller steadies the laser pistol with both hands, settling into a firmer stance. The Pip-Boy beeps with a target lock and the red energy cell hums. His expression hardens behind the sights.
  Header "Attack 1" (3,1): Wind-up — he squares his shoulders and sights down the laser pistol, the red energy cell brightening as it charges. The Pip-Boy arm supports the shooting hand and his blue eyes lock on the target.
  Header "Attack 2" (3,2): A bright red laser beam fires from the chrome pistol with a flash at the barrel. The recoil pushes his hands up slightly and the red beam streaks across the cell. The jumpsuit creases from the brace.
  Header "Attack 3" (3,3): Follow-through — the laser beam terminates at the cell edge in a small red impact flash. The pistol barrel vents heat and the Vault Dweller steadies himself for another shot, Pip-Boy recalibrating.
  Header "Cast 1" (3,4): The Vault Dweller raises his Pip-Boy arm and activates a special function, the green screen projecting a small holographic map. The laser pistol is holstered as he focuses on the device.
  Header "Cast 2" (3,5): The Pip-Boy projects a wider holographic field, a targeting grid expanding outward. The device whirs and clicks, the green screen blazing bright, and his wide eyes reflect the holographic data.

ROW 4 — Cast 3, Damage, KO Start:
  Header "Cast 3" (4,0): The Pip-Boy activates a V.A.T.S.-like targeting burst — a brief pulse of green energy radiates outward from the device, highlighting weak points. Time seems to slow around him momentarily before normalizing.
  Header "Damage 1" (4,1): The Vault Dweller flinches from a hit, the laser pistol nearly slipping from his grip. A scorch mark appears on the blue jumpsuit sleeve and the Pip-Boy screen flickers with static.
  Header "Damage 2" (4,2): Stumbling backward, the jumpsuit tears at the shoulder revealing a white undershirt. The Pip-Boy sparks at a cracked hinge and a utility pouch spills its contents. His expression shows genuine fear.
  Header "Damage 3" (4,3): Recovery — the Vault Dweller steadies himself, checking the Pip-Boy which reboots with a green flash. He picks up the laser pistol and forces a brave expression, though his hands tremble.
  Header "KO 1" (4,4): The laser pistol drops from his limp fingers as his knees give out. The Pip-Boy screen displays a flatline readout and the bright blue jumpsuit is stained and torn. His eyes go wide with shock.
  Header "KO 2" (4,5): The Vault Dweller collapses forward, the Pip-Boy arm outstretched with a fading green screen. The chrome laser pistol slides away and the yellow '42' on his back is now scuffed and dirty.

ROW 5 — KO 3, Victory, Status Poses:
  Header "KO 3" (5,0): The Vault Dweller lies face-down on the ground, the Pip-Boy screen dark and the blue jumpsuit torn and dirtied. The laser pistol rests nearby and scattered utility belt contents surround him.
  Header "Victory 1" (5,1): The Vault Dweller holds the laser pistol up triumphantly, blowing imaginary smoke from the barrel. The Pip-Boy beeps a cheerful victory jingle and his wide blue eyes beam with surprised pride.
  Header "Victory 2" (5,2): He holsters the laser pistol with a spin and checks the Pip-Boy, which displays a smiley face and XP gained. His nervous expression is replaced by a confident grin and the jumpsuit is still clean.
  Header "Victory 3" (5,3): The Vault Dweller gives a thumbs-up with his Pip-Boy hand, the green screen showing a thumbs-up icon in return. He stands tall with an awkward but genuine confidence, blue jumpsuit gleaming.
  Header "Weak Pose" (5,4): The Vault Dweller hunches over with hands on knees, panting. The jumpsuit is torn and stained, the Pip-Boy screen flickers with warning readouts, and the laser pistol dangles loosely from one hand.
  Header "Critical Pose" (5,5): Barely standing, the Vault Dweller clutches the laser pistol with both hands. The Pip-Boy screen flashes red emergency warnings, the jumpsuit is in tatters, and his blue eyes are wide with terrified determination.`,
    },
    {
      id: 'raider-warlord',
      name: "Raider Warlord",
      genre: "Post-Apocalyptic",
      description: "A brutal scavenger leader with a shaved head sporting a tall crimson mohawk, heavy war paint across the eyes, and a scarred, muscular build. Aggressive forward-leaning stance radiating menace.",
      equipment: "Spiked shoulder armor welded from scrap metal and car parts, a heavy chain weapon ending in a spiked ball, bone-and-tooth trophies on a necklace, and crude war paint in red and black streaks.",
      colorNotes: "Bare scarred skin with red and black war paint. Crimson mohawk. Armor is rust red and gunmetal scrap metal with bone white trophy accents. Chain is dark iron and the spiked ball is pitted steel. Pants are torn black leather.",
      rowGuidance: `ROW 0 — Walk Down & Walk Up:
  Header "Walk Down 1" (0,0): The Raider Warlord stomps forward on his left foot, the heavy chain weapon swinging at his right side with the spiked ball dragging. The spiked scrap-metal shoulder armor juts aggressively and his crimson mohawk stands tall above red and black war paint.
  Header "Walk Down 2" (0,1): Neutral mid-step contact pose with feet planted wide. His scarred muscular torso is visible between scrap armor plates and the bone-and-tooth necklace rattles against his chest. War-painted eyes glare forward.
  Header "Walk Down 3" (0,2): Mirror of Walk Down 1 — right foot leads, chain swinging to the left. The spiked ball scrapes the ground and the rust red armor plates clank with each heavy step.
  Header "Walk Up 1" (0,3): Facing away with left foot forward, the massive spiked shoulder armor dominates the back view. The chain weapon trails behind and the crimson mohawk rises like a fin above the gunmetal scrap plates.
  Header "Walk Up 2" (0,4): Neutral mid-step facing away, the scarred back visible between armor gaps. Bone trophies dangle from armor hooks and the chain weapon hangs at his side. The mohawk is a sharp crimson ridge.
  Header "Walk Up 3" (0,5): Mirror of Walk Up 1 — right foot forward facing away, the spiked ball dragging behind. The torn black leather pants and heavy boots complete the brutal silhouette.

ROW 1 — Walk Left & Walk Right:
  Header "Walk Left 1" (1,0): The Warlord faces left with his left foot forward in an aggressive advance. The spiked shoulder armor leads and the chain weapon trails behind, spiked ball bouncing. His mohawk profile is sharp and the war paint streaks are vivid.
  Header "Walk Left 2" (1,1): Neutral contact pose facing left, his scarred muscular profile visible. The bone-tooth necklace hangs across his chest and the scrap armor plates overlap with crude welds. Eyes narrow with menace.
  Header "Walk Left 3" (1,2): Mirror of Walk Left 1 — right foot leads while facing left, chain swinging forward. The rust red armor catches harsh light and the spiked ball arcs ahead.
  Header "Walk Right 1" (1,3): Facing right with right foot forward, chain weapon leading and spiked ball swinging outward. The crimson mohawk trails like a war banner and the scrap shoulder armor bristles with welded spikes.
  Header "Walk Right 2" (1,4): Neutral contact pose facing right, the aggressive forward lean evident. The war paint streaks frame his scarred face in profile and the bone trophies click against the armor.
  Header "Walk Right 3" (1,5): Mirror of Walk Right 1 — left foot leads while facing right, the chain weapon trailing. The torn black leather pants and heavy stomping boots are prominent.

ROW 2 — Idle & Battle Idle:
  Header "Idle Down" (2,0): The Warlord stands with legs apart facing the viewer, the chain weapon coiled in one fist. The spiked armor gleams dull rust red and his war-painted face glares with open hostility. The bone necklace hangs over his scarred chest.
  Header "Idle Up" (2,1): Facing away, the spiked shoulder armor and bare scarred back fill the view. The chain weapon hangs at his side and bone trophies are hooked to the back of his armor. The crimson mohawk is a bold ridge.
  Header "Idle Left" (2,2): Facing left, the Warlord rests the spiked ball on the ground with the chain taut in his fist. His profile shows the prominent mohawk, sharp war paint, and the menacing scrap armor silhouette.
  Header "Idle Right" (2,3): Facing right, he holds the chain loosely, letting the spiked ball swing lazily. His aggressive forward lean and scarred muscular arms are prominent beneath the rust red armor plates.
  Header "Battle Idle 1" (2,4): The Warlord begins swinging the chain weapon overhead in a wide arc, the spiked ball whirring. He drops into a wide combat stance and bares his teeth with a snarl. The war paint makes his eyes look like burning embers.
  Header "Battle Idle 2" (2,5): The chain swings faster, the spiked ball a blur above his head. He shifts his weight aggressively and the scrap armor clanks and sparks. His crimson mohawk whips in the self-made wind.

ROW 3 — Battle Idle 3, Attack, Cast Start:
  Header "Battle Idle 3" (3,0): The Warlord holds the whirring chain at peak speed, muscles straining beneath the scrap armor. His war-painted face is locked in a battle snarl and the spiked ball hums with lethal momentum.
  Header "Attack 1" (3,1): Wind-up — he pulls the chain back over his shoulder, the spiked ball swinging behind him. His body coils with raw power and the scrap armor groans under the tension. War paint glistens with sweat.
  Header "Attack 2" (3,2): The chain lashes forward — the spiked ball rockets outward in a savage overhead slam. His entire body follows the arc and the scrap armor sparks from the violent motion.
  Header "Attack 3" (3,3): Impact — the spiked ball crashes down at the cell edge with a burst of sparks and debris. The chain snaps taut and the Warlord is pulled forward by the momentum, boots skidding.
  Header "Cast 1" (3,4): The Warlord reaches to his belt and produces a crude frag grenade — a tin can packed with scrap metal and a fuse. He bites the pull ring with his teeth while holding the chain weapon in the other hand.
  Header "Cast 2" (3,5): The fuse sparks and sizzles as he holds the grenade overhead, the orange glow reflecting off his war paint and spiked armor. Scrap shrapnel is visible inside the crude casing.

ROW 4 — Cast 3, Damage, KO Start:
  Header "Cast 3" (4,0): The Warlord hurls the frag grenade — it tumbles through the air and detonates at the cell edge in a small burst of fire and flying scrap metal shards. He shields himself with the spiked shoulder armor.
  Header "Damage 1" (4,1): The Warlord reels from a hit, a scrap armor plate cracking and flying off his shoulder. The chain weapon jerks in his grip and his mohawk flattens from the impact. War paint smears with blood.
  Header "Damage 2" (4,2): Staggering back, more armor plates buckle and fall. His scarred torso takes a visible wound and the bone necklace snaps, sending trophies scattering. The chain weapon drags on the ground.
  Header "Damage 3" (4,3): Recovery — the Warlord plants his feet and roars with rage, swinging the chain weapon back up. His remaining armor is battered but he forces himself upright, war paint streaked with blood and fury in his eyes.
  Header "KO 1" (4,4): The chain weapon slips from his weakening grip, the spiked ball thudding to the ground. His massive frame sways and the remaining scrap armor hangs loose. The mohawk droops and the war paint is smeared.
  Header "KO 2" (4,5): The Warlord crashes to his knees, then falls forward onto the broken scrap armor. The chain weapon lies coiled beside him and bone trophies scatter. His crimson mohawk is flattened against the ground.

ROW 5 — KO 3, Victory, Status Poses:
  Header "KO 3" (5,0): The Warlord lies face-down amid scattered scrap armor plates, broken bone trophies, and the tangled chain weapon. His crimson mohawk is matted and the war paint is unrecognizable. The spiked ball rests near his open hand.
  Header "Victory 1" (5,1): The Warlord raises the chain weapon overhead and roars, spiked ball swinging triumphantly. His war-painted face splits into a savage grin and he beats his scarred chest with his free fist. The mohawk bristles.
  Header "Victory 2" (5,2): He slams the spiked ball into the ground with a thunderous crash and stands over it, one boot on the chain. The scrap armor gleams with battle damage and he throws his head back in a primal howl.
  Header "Victory 3" (5,3): The Warlord coils the chain weapon around his arm and crosses his armored arms, glaring forward with contemptuous superiority. The bone necklace clicks and the crimson mohawk stands perfectly erect.
  Header "Weak Pose" (5,4): The Warlord hunches forward, chain weapon dragging on the ground. Half his scrap armor is gone, the war paint is faded with dried blood, and the mohawk wilts. He snarls through gritted teeth, refusing to fall.
  Header "Critical Pose" (5,5): Barely standing, the Warlord swings the chain weapon in weak, desperate arcs. His armor is destroyed, the bone necklace is gone, and his body is covered in wounds — but his war-painted eyes still burn with unbroken fury.`,
    },
    {
      id: 'mutant-enforcer',
      name: "Mutant Enforcer",
      genre: "Post-Apocalyptic",
      description: "An oversized irradiated brute standing a head taller than a normal human. Sickly green-tinged skin with purple bruising and visible radiation scars. Hunched, top-heavy build with massive arms and a small, angry head.",
      equipment: "A crude super sledge — an oversized sledgehammer with a car engine block as the head, torn remnants of pre-war clothing barely covering the torso, and heavy chains wrapped around the forearms as makeshift bracers.",
      colorNotes: "Sickly green skin with mottled purple bruising and grey radiation scars. Torn clothing is faded grey-blue. Super sledge head is dark steel with rust. Chain bracers are dark iron. Eyes are a dim, angry yellow.",
      rowGuidance: `ROW 0 — Walk Down & Walk Up:
  Header "Walk Down 1" (0,0): The Mutant Enforcer lumbers forward on his left foot, the ground seeming to shake with his weight. The massive super sledge drags at his right side, its car-engine head scraping the ground. His sickly green skin is mottled with purple bruises and his dim yellow eyes glare ahead.
  Header "Walk Down 2" (0,1): Neutral mid-step with feet planted wide to support his top-heavy frame. The torn grey-blue clothing barely covers his barrel chest and the chain bracers on his massive forearms clink. His small angry head sits atop bulging shoulders.
  Header "Walk Down 3" (0,2): Mirror of Walk Down 1 — right foot leads, the super sledge dragging on the other side. Grey radiation scars are visible across his green arms and the purple bruising shifts with muscle movement.
  Header "Walk Up 1" (0,3): Facing away with left foot forward, the Enforcer's massive hunched back fills the view. The torn clothing hangs in strips and radiation scars crisscross his green skin. The super sledge shaft extends upward past his shoulder.
  Header "Walk Up 2" (0,4): Neutral mid-step facing away, the top-heavy build evident. Chain-wrapped forearms hang at his sides and the car-engine sledge head protrudes above his right shoulder. The purple bruising is visible on his back.
  Header "Walk Up 3" (0,5): Mirror of Walk Up 1 — right foot forward facing away, the massive frame lumbering. The torn clothing flaps and the dark iron chains on his wrists catch dull light.

ROW 1 — Walk Left & Walk Right:
  Header "Walk Left 1" (1,0): The Enforcer faces left with his left foot forward in a heavy, ground-shaking stride. The super sledge is held low in his massive right hand, engine-block head trailing. His hunched profile shows the disproportion between his huge body and small head.
  Header "Walk Left 2" (1,1): Neutral contact pose facing left, his enormous silhouette looming. The chain bracers hang heavily on forearms thicker than a normal man's thighs. Sickly green skin glistens with an unhealthy sheen.
  Header "Walk Left 3" (1,2): Mirror of Walk Left 1 — right foot leads while facing left, sledge swinging forward. The torn grey-blue clothing rips further with the motion and radiation scars catch the light.
  Header "Walk Right 1" (1,3): Facing right with right foot forward, the super sledge leading in his massive grip. The chain bracers jingle and his dim yellow eyes squint ahead. Purple bruising marks his near arm and shoulder.
  Header "Walk Right 2" (1,4): Neutral contact pose facing right, the top-heavy hunched frame evident. The car-engine sledge head rests on the ground and his small angry head peers forward from between massive shoulders.
  Header "Walk Right 3" (1,5): Mirror of Walk Right 1 — left foot leads while facing right. The ground cracks under his weight and the torn clothing flutters with each thunderous step.

ROW 2 — Idle & Battle Idle:
  Header "Idle Down" (2,0): The Enforcer stands hunched facing the viewer, the super sledge resting on his shoulder with the engine-block head behind his back. His massive chain-wrapped arms hang forward and his small head peers out with dim yellow eyes. Green skin pulses faintly with radiation.
  Header "Idle Up" (2,1): Facing away, the enormous hunched back and massive shoulders fill the frame. The super sledge rests across the back of his neck like a yoke. Chain bracers dangle and the torn clothing barely covers his lower back.
  Header "Idle Left" (2,2): Facing left, the Enforcer rests both hands on top of the upright super sledge handle, the engine-block head on the ground. His hunched profile and small angry head create a looming silhouette. Radiation scars mark his visible arm.
  Header "Idle Right" (2,3): Facing right, the sledge hangs loosely in one massive hand. His top-heavy posture leans forward and the purple bruising on his green skin creates a sickly pattern. The chain bracers are prominent on his near arm.
  Header "Battle Idle 1" (2,4): The Enforcer hoists the super sledge with both hands, raising the car-engine head overhead. He drops into a wide aggressive stance and roars, revealing jagged, yellowed teeth. His green skin darkens with rage and the yellow eyes blaze.
  Header "Battle Idle 2" (2,5): He swings the super sledge in slow, menacing figure-eights, the engine-block head whooshing through the air. The chain bracers rattle and his massive frame shifts with surprising control for his size.

ROW 3 — Battle Idle 3, Attack, Cast Start:
  Header "Battle Idle 3" (3,0): The Enforcer holds the super sledge cocked behind his right shoulder, muscles bulging. His small head is lowered like a charging bull and the dim yellow eyes lock on the target with brute focus. Chains rattle on his tensed forearms.
  Header "Attack 1" (3,1): Wind-up — the Enforcer heaves the super sledge high overhead with both hands, the engine-block head at its peak. His green body stretches to full height, momentarily towering, and the torn clothing tears further from the strain.
  Header "Attack 2" (3,2): The super sledge crashes downward in a devastating overhead slam, the engine-block head a blur of dark steel and rust. The impact is enormous and his massive frame follows the arc with full commitment.
  Header "Attack 3" (3,3): Impact — the engine-block head hits the ground at the cell edge, sending a shockwave of cracks through the surface. Dust and debris erupt outward and the Enforcer is buried to the wrists in the crater. Chains spark against stone.
  Header "Cast 1" (3,4): The Enforcer's radiation scars begin to glow — a sickly green luminescence pulses beneath his skin. He drops the sledge and clutches his head as the radiation within him surges, purple bruises intensifying.
  Header "Cast 2" (3,5): His entire body radiates green light, the scars becoming bright veins of toxic energy. His yellow eyes blaze and a shockwave of radioactive air distorts the space around him. The chains on his arms heat and glow.

ROW 4 — Cast 3, Damage, KO Start:
  Header "Cast 3" (4,0): The Enforcer releases a burst of radiation — a green shockwave erupts outward from his body, distorting the air. His skin cracks momentarily with the energy release before sealing. He collapses to one knee afterward, drained.
  Header "Damage 1" (4,1): The Enforcer is knocked back a step — a remarkable feat given his size. A chunk of green skin tears revealing raw purple tissue beneath. The super sledge dips but he holds on, growling.
  Header "Damage 2" (4,2): Staggering, a chain bracer snaps and falls from his wrist. More skin tears open showing the purple bruised tissue and his torn clothing disintegrates further. The sledge handle cracks under his stressed grip.
  Header "Damage 3" (4,3): Recovery — the Enforcer steadies himself with a ground-shaking stomp. He hoists the damaged super sledge and roars, the radiation scars pulsing with renewed dim green light. His yellow eyes refocus with animal determination.
  Header "KO 1" (4,4): The super sledge slips from his massive hands and thuds to the ground. The Enforcer sways, his green skin losing its glow, and the yellow eyes dim. His enormous frame lists to one side.
  Header "KO 2" (4,5): The Enforcer topples like a felled tree, crashing to the ground with earth-shaking impact. The super sledge lies beside him and the chain bracers splay outward. His green skin is pale and the radiation scars are dark.

ROW 5 — KO 3, Victory, Status Poses:
  Header "KO 3" (5,0): The Enforcer lies in a small crater from his own impact, the super sledge nearby and chain bracers spread around him. His sickly green skin is faded to grey-green and the yellow eyes are closed. The torn clothing is now just rags.
  Header "Victory 1" (5,1): The Enforcer lifts the super sledge overhead with one hand and pounds his chest with the other, roaring victoriously. The engine-block head catches light above him and his green skin blazes with renewed radiation glow.
  Header "Victory 2" (5,2): He slams the super sledge down and stands over it, flexing his massive arms. The chain bracers jingle and his small head throws back in a triumphant bellow. The radiation scars pulse a bright, healthy green.
  Header "Victory 3" (5,3): The Enforcer sits on the super sledge engine-block head as a throne, massive arms resting on his knees. His dim yellow eyes show a rare, dull satisfaction and the purple bruises have faded slightly.
  Header "Weak Pose" (5,4): The Enforcer leans heavily on the upright super sledge, his massive frame sagging. The green skin is pale and the radiation scars are dim. Chain bracers drag on the ground and his yellow eyes are half-closed, flickering.
  Header "Critical Pose" (5,5): Barely standing, the Enforcer clutches the super sledge handle with both trembling hands. His green skin is almost grey, the radiation scars are completely dark, and his massive body shakes. Only a faint angry glow in his yellow eyes remains.`,
    },
    {
      id: 'caravan-trader',
      name: "Caravan Trader",
      genre: "Post-Apocalyptic",
      description: "A pragmatic traveling merchant with a weathered face, a wide-brimmed cowboy hat, and shrewd hazel eyes. Medium build wrapped in practical layers and a pack harness distributing heavy trade goods across the body.",
      equipment: "A wide-brimmed leather cowboy hat, a heavy pack harness with goods strapped across chest and back, barter items dangling from hooks (bottles, ammo boxes, canned food), a worn revolver in a thigh holster, and a walking staff made from a twisted rebar rod.",
      colorNotes: "Tan wide-brimmed hat and outer layers. Brown leather harness and holster. Brass-colored buckles, bullet casings, and barter goods. Gunmetal revolver. Dark brown boots. Rebar staff is rust-grey.",
      rowGuidance: `ROW 0 — Walk Down & Walk Up:
  Header "Walk Down 1" (0,0): The Caravan Trader steps forward on his left foot, barter goods jingling on the pack harness. The wide-brimmed hat shades his weathered face and the rebar walking staff plants ahead. Bottles and ammo boxes sway from harness hooks.
  Header "Walk Down 2" (0,1): Neutral mid-step contact pose with feet together. His shrewd hazel eyes peer from beneath the hat brim and the pack harness distributes heavy goods across his chest. The revolver sits snug in the thigh holster.
  Header "Walk Down 3" (0,2): Mirror of Walk Down 1 — right foot leads, barter goods swinging to the opposite side. Canned food and brass bullet casings dangle and clatter. The rebar staff catches rust-grey light.
  Header "Walk Up 1" (0,3): Facing away with left foot forward, the heavy pack harness and trade goods dominate the back view. Strapped bundles, bottles, and ammo boxes create a merchant's profile. The hat brim is visible from above.
  Header "Walk Up 2" (0,4): Neutral mid-step facing away, the full weight of the pack visible. Brown leather straps crisscross the tan outer layers and the rebar staff rises past his right shoulder. Brass buckles catch dim light.
  Header "Walk Up 3" (0,5): Mirror of Walk Up 1 — right foot forward facing away, goods shifting with the stride. The thigh holster and revolver handle peek from beneath the layered pack.

ROW 1 — Walk Left & Walk Right:
  Header "Walk Left 1" (1,0): The Trader faces left with his left foot forward, leaning on the rebar staff. The pack harness goods — bottles, cans, ammo boxes — jingle and sway. His weathered profile beneath the hat brim shows shrewd concentration.
  Header "Walk Left 2" (1,1): Neutral contact pose facing left, the pack harness creating a bulky side profile. The revolver holster is visible at his near thigh and the hat brim casts a shadow across his face.
  Header "Walk Left 3" (1,2): Mirror of Walk Left 1 — right foot leads while facing left, the rebar staff swinging. Barter goods bounce and the brass buckles on the harness glint.
  Header "Walk Right 1" (1,3): Facing right with right foot forward, the rebar staff leading. The pack harness goods trail behind and the wide-brimmed hat tilts forward. The worn revolver holster is on his far thigh.
  Header "Walk Right 2" (1,4): Neutral contact pose facing right, the practical layers and harness creating a distinctive merchant silhouette. Hazel eyes scan the path ahead and trade goods clink softly.
  Header "Walk Right 3" (1,5): Mirror of Walk Right 1 — left foot leads while facing right, goods swaying. The dark brown boots are worn smooth and the rebar staff taps the ground with each step.

ROW 2 — Idle & Battle Idle:
  Header "Idle Down" (2,0): The Trader stands with the rebar staff planted beside him, one hand resting on a dangling ammo box. His wide-brimmed hat tilts back showing his weathered face and hazel eyes. The pack harness hangs heavily but comfortably. The revolver is holstered.
  Header "Idle Up" (2,1): Facing away, the full pack harness load is visible — bottles, cans, ammo, and various barter goods strapped in organized chaos. The leather straps and brass buckles hold everything secure. The hat brim is visible at the top.
  Header "Idle Left" (2,2): Facing left, the Trader adjusts a strap on the harness with one hand, rebar staff tucked under his arm. His shrewd expression shows he is calculating something. Trade goods dangle from his near side.
  Header "Idle Right" (2,3): Facing right, he rests both hands on top of the rebar staff planted before him. The hat shades his profile and the revolver holster and barter goods create a distinctive merchant outline.
  Header "Battle Idle 1" (2,4): The Trader drops the rebar staff and draws the worn revolver from the thigh holster in a practiced quick-draw. He crouches behind the pack harness goods using them as improvised cover. Hazel eyes are sharp above the revolver sights.
  Header "Battle Idle 2" (2,5): He shifts behind the hanging pack goods, revolver tracking a target. The bottles and cans sway as he moves and the brass bullet casings on the harness clink. His weathered face is calm and calculating.

ROW 3 — Battle Idle 3, Attack, Cast Start:
  Header "Battle Idle 3" (3,0): The Trader holds steady with the revolver, one eye closed for aim. The wide-brimmed hat shadows his face and the pack harness goods shift as he breathes. His thigh holster hangs empty and his trigger finger is steady.
  Header "Attack 1" (3,1): Wind-up — the Trader thumbs back the revolver hammer with a click, sighting down the barrel. His hazel eyes narrow and the hat brim dips with his focused lean forward. The pack goods go still.
  Header "Attack 2" (3,2): The revolver fires — a small muzzle flash erupts from the barrel and the Trader's arm recoils upward. Smoke trails from the chamber and the barter goods rattle from the concussive blast.
  Header "Attack 3" (3,3): Follow-through — the bullet streaks to the cell edge as spent powder smoke drifts. The Trader steadies the revolver for another shot and an empty brass casing arcs through the air from the chamber.
  Header "Cast 1" (3,4): The Trader reaches into the pack harness and produces a bundle of dynamite sticks — salvaged mining explosives tied together with a long fuse. He bites a match head and strikes it on his hat brim.
  Header "Cast 2" (3,5): The fuse sizzles and sparks, casting orange light on the Trader's weathered face beneath the hat. The dynamite bundle crackles and he winds up for the throw, pack goods swaying from the motion.

ROW 4 — Cast 3, Damage, KO Start:
  Header "Cast 3" (4,0): The Trader hurls the dynamite bundle — it tumbles end over end, fuse burning, and detonates at the cell edge in a thundering explosion of dust and fire. He ducks behind the pack harness from the blast wave.
  Header "Damage 1" (4,1): The Trader stumbles from a hit, barter goods flying from the harness. A bottle shatters and an ammo box spills open. The revolver wavers and the hat tilts askew. His hazel eyes show surprise.
  Header "Damage 2" (4,2): Staggering further, the pack harness snaps a strap and goods cascade — cans, bottles, and brass casings scatter. The hat flies off revealing thinning grey-brown hair. The revolver dips in his weakening grip.
  Header "Damage 3" (4,3): Recovery — the Trader catches his hat and jams it back on. He kicks a few scattered goods aside, steadies the revolver, and adjusts the damaged harness with one hand. His expression shifts from surprise to hardened resolve.
  Header "KO 1" (4,4): The revolver drops from his limp hand as the Trader's knees buckle. The pack harness tears free and goods spill everywhere — a cascade of bottles, cans, and ammo boxes. The hat falls over his eyes.
  Header "KO 2" (4,5): The Trader collapses amid his scattered merchandise, the rebar staff rolling away. Barter goods surround him like a halo of commerce — bottles, cans, ammo, and brass buckles. The hat lies beside his weathered face.

ROW 5 — KO 3, Victory, Status Poses:
  Header "KO 3" (5,0): The Trader lies among his scattered goods — bottles, canned food, ammo boxes, and brass casings spread around him. The revolver rests in his open palm, the hat covers his face, and the broken pack harness is draped across his legs.
  Header "Victory 1" (5,1): The Trader spins the revolver and holsters it with a practiced flourish. He tips the wide-brimmed hat with a satisfied smirk and adjusts the pack harness, which still holds most of its goods. Business is good.
  Header "Victory 2" (5,2): He plants the rebar staff and leans on it with casual confidence, one hand tipping the hat. The barter goods jingle merrily and his shrewd hazel eyes survey the spoils. A small grin creases his weathered face.
  Header "Victory 3" (5,3): The Trader pulls a bottle from the harness and uncorks it, raising it in a toast to himself. The revolver is holstered, the hat tilted back, and the remaining barter goods dangle with the satisfaction of a deal well done.
  Header "Weak Pose" (5,4): The Trader leans on the rebar staff, the pack harness half-empty and hanging by one strap. The hat droops and the revolver dangles loosely from one hand. Most of his barter goods are lost and his hazel eyes are weary.
  Header "Critical Pose" (5,5): Barely standing amid his scattered goods, the Trader clutches the revolver with his last round. The hat is torn, the harness is destroyed, and he stands guard over what remains of his trade goods with desperate, calculating eyes.`,
    },
    {
      id: 'power-armor-knight',
      name: "Power Armor Knight",
      genre: "Post-Apocalyptic",
      description: "A towering figure encased head-to-toe in pre-war powered combat armor. The suit is bulky and angular with a T-shaped visor slit glowing amber on a bucket-shaped helmet. Broad-shouldered, heavy, and imposing with hydraulic joints at the elbows and knees. Moves with deliberate, ground-shaking weight.",
      equipment: "Full suit of olive-drab T-51b power armor with scratched steel plating and faded military stencils, a shoulder-mounted lamp on the left pauldron, a heavy gatling laser with six rotating barrels held in both hands, and a fusion core glowing blue-white in the back-mounted power pack.",
      colorNotes: "Olive-drab steel armor plating with scratched gunmetal edges and faded white military stencils. Amber-glowing T-shaped visor. Fusion core is blue-white. Gatling laser barrels are dark chrome with red heat vents. Hydraulic pistons are brass-colored. Shoulder lamp is yellow when active.",
      rowGuidance: `ROW 0 — Walk Down & Walk Up:
  Header "Walk Down 1" (0,0): The Power Armor Knight stomps forward on the left foot, the ground cracking under the immense weight. The gatling laser is held across the chest in both armored hands, six barrels angled down. The T-shaped amber visor glows beneath the bucket helmet and hydraulic knee pistons hiss with the step. Olive-drab plating shows scratched battle damage.
  Header "Walk Down 2" (0,1): Neutral mid-step contact pose with heavy boots planted side by side. The gatling laser rests at waist level and the shoulder lamp casts a faint yellow glow. Faded white military stencils are visible on the chest plate. The fusion core pulses blue-white through the back vents.
  Header "Walk Down 3" (0,2): Mirror of Walk Down 1 — right foot leads, the armored frame shifting with mechanical precision. Hydraulic elbow pistons extend and the gatling laser sways to the opposite side. Scratched gunmetal edges catch harsh light.
  Header "Walk Up 1" (0,3): Facing away with left foot forward, the back-mounted fusion core dominates the view — a glowing blue-white cylinder in a steel housing. Exhaust vents trail faint heat shimmer. The olive-drab plating is scarred across the back and the gatling laser barrel tips extend past the right shoulder.
  Header "Walk Up 2" (0,4): Neutral mid-step facing away, the fusion core and power pack filling the frame. Hydraulic spine actuators are visible between the back plates and faded stencils read partial unit numbers. The bucket helmet's rear vents are visible.
  Header "Walk Up 3" (0,5): Mirror of Walk Up 1 — right foot forward facing away, the heavy frame lumbering. The shoulder lamp housing is visible on the left pauldron and the gatling laser shifts to the other side.

ROW 1 — Walk Left & Walk Right:
  Header "Walk Left 1" (1,0): The Knight faces left with the left foot forward in a thunderous stride. The gatling laser leads in both hands, six dark chrome barrels pointing ahead. The bucket helmet's T-shaped visor glows amber in profile and the hydraulic knee piston compresses visibly. The shoulder lamp sits atop the near pauldron.
  Header "Walk Left 2" (1,1): Neutral contact pose facing left, the full armored silhouette looming. The gatling laser hangs at the ready and the fusion core's blue-white glow is visible behind the torso. Brass-colored hydraulic pistons gleam at the elbow joint.
  Header "Walk Left 3" (1,2): Mirror of Walk Left 1 — right foot leads while facing left, gatling laser barrels swinging forward. The red heat vents along the barrel housing glow faintly and olive-drab plating clanks with the step.
  Header "Walk Right 1" (1,3): Facing right with right foot forward, the gatling laser pointing ahead. The fusion core's glow trails behind and the shoulder lamp is on the far pauldron. The T-shaped visor scans the path ahead, amber light cutting through dust.
  Header "Walk Right 2" (1,4): Neutral contact pose facing right, the angular bulk of the power armor creating a fortress-like profile. Faded stencils on the near pauldron and thigh plate are partially legible. Hydraulic joints are visible at the knee and elbow.
  Header "Walk Right 3" (1,5): Mirror of Walk Right 1 — left foot leads while facing right, the heavy frame shaking the ground. The gatling laser sways with controlled momentum and the back-mounted power pack vents heat.

ROW 2 — Idle & Battle Idle:
  Header "Idle Down" (2,0): The Knight stands facing the viewer in a wide, planted stance, gatling laser held vertically with the barrels pointing up and the stock resting on the ground. The amber visor glows steadily and the shoulder lamp is off. Hydraulic joints hiss softly at rest. The fusion core pulses a calm blue-white.
  Header "Idle Up" (2,1): Facing away at rest, the gatling laser is mag-locked to the back alongside the fusion core housing. The olive-drab plating shows extensive battle scarring across the shoulders and back. Exhaust vents idle with faint heat shimmer and the helmet rear has cooling fins.
  Header "Idle Left" (2,2): Facing left, the Knight rests the gatling laser on one armored hip, the barrel tips angled down. The bucket helmet's T-visor is visible in profile, amber glow steady. The shoulder lamp housing and pauldron scratches are prominent.
  Header "Idle Right" (2,3): Facing right, the gatling laser is cradled in both arms across the chest. The fusion core's blue-white glow illuminates the near side of the armor and the brass hydraulic pistons at the elbow reflect it. The T-visor scans slowly.
  Header "Battle Idle 1" (2,4): The Knight brings the gatling laser to bear — both armored hands grip the weapon, the six barrels leveled forward. The shoulder lamp flicks on, casting a harsh yellow cone. The T-shaped visor brightens to a fierce amber and hydraulic actuators lock the arms steady. The fusion core ramps up, glowing brighter.
  Header "Battle Idle 2" (2,5): The gatling barrels begin to spin with a mechanical whine, not yet firing. The Knight shifts weight into a braced firing stance — one foot forward, torso angled. Red heat vents along the barrel housing begin to glow and the shoulder lamp beam cuts through dust particles.

ROW 3 — Battle Idle 3, Attack, Cast Start:
  Header "Battle Idle 3" (3,0): The barrels spin at full speed, a blur of dark chrome. The Knight is locked in firing position, every hydraulic joint braced. The amber visor narrows to targeting mode — a faint crosshair pattern visible within the glow. The fusion core blazes blue-white and the shoulder lamp beam is a solid yellow bar.
  Header "Attack 1" (3,1): Wind-up — the gatling barrels reach maximum spin and the red heat vents flare bright. The Knight's armored frame plants and locks, servos whining under the bracing force. The fusion core surges energy into the weapon housing.
  Header "Attack 2" (3,2): The gatling laser fires — a torrent of red laser beams erupts from the spinning barrels in a devastating stream. Each barrel fires in sequence creating a near-continuous beam of destruction. The recoil pushes the entire armored frame back slightly despite its weight. Muzzle flash illuminates the olive-drab plating in red.
  Header "Attack 3" (3,3): Sustained fire — the laser stream rakes across the cell edge, red beams cutting through the air. The barrel housing glows cherry-red from heat and the shoulder lamp beam is lost in the laser glare. Spent heat radiates from every vent on the weapon and armor.
  Header "Cast 1" (3,4): The Knight reaches to the back-mounted power pack and pulls a secondary fusion core — a smaller blue-white cylinder. The gatling laser is held one-handed (the armor's strength makes this possible) while the other hand primes the core, which crackles with building energy.
  Header "Cast 2" (3,5): The primed fusion core blazes with intense blue-white light, arcs of energy jumping between the Knight's armored fingers. The T-shaped visor reflects the nuclear glow and the main fusion core in the back pack resonates in sympathy, pulsing brighter.

ROW 4 — Cast 3, Damage, KO Start:
  Header "Cast 3" (4,0): The Knight hurls the overloaded fusion core — it tumbles through the air trailing blue-white energy arcs and detonates at the cell edge in a blinding nuclear flash. A miniature mushroom cloud erupts and the Knight raises one armored arm to shield the visor from the blast wave.
  Header "Damage 1" (4,1): The Knight staggers from a heavy hit — an armor plate on the left pauldron cracks and the shoulder lamp shatters, sparking. The gatling laser dips and hydraulic fluid sprays from a ruptured line at the elbow. The amber visor flickers.
  Header "Damage 2" (4,2): A second impact buckles the chest plate inward, exposing wiring and hydraulic lines beneath. The fusion core's housing cracks and the blue-white glow flickers erratically. Olive-drab plating falls away in chunks and the gatling laser's barrel housing is dented.
  Header "Damage 3" (4,3): Recovery — hydraulic systems compensate with a loud hiss, forcing the Knight upright. Emergency seals clamp over the cracked fusion core housing and the amber visor stabilizes. The Knight racks the gatling laser back to firing position with damaged but functional arms.
  Header "KO 1" (4,4): Systems failing — the gatling laser drops from powerless arms and clangs to the ground. The fusion core sputters and dies, its blue-white glow extinguishing. The amber visor dims to a faint flicker and hydraulic joints lock at random angles. The Knight sways, a dying machine.
  Header "KO 2" (4,5): The Knight topples forward with an earth-shaking crash, face-down in the dirt. Armor plates scatter on impact and the dead fusion core rolls free of its cracked housing. The gatling laser lies beside the fallen titan and the visor goes completely dark.

ROW 5 — KO 3, Victory, Status Poses:
  Header "KO 3" (5,0): The Knight lies face-down in a crater of cracked earth, the power armor split open in places showing the empty interior. The dead fusion core sits nearby, dark and inert. The gatling laser is half-buried beside the armored hull. The T-shaped visor is black and lifeless.
  Header "Victory 1" (5,1): The Knight raises the gatling laser overhead with one hand — a feat only power armor makes possible. The amber visor blazes bright and the fusion core surges with triumphant blue-white energy. The shoulder lamp sweeps the area and hydraulic pistons pump with a mechanical victory flex.
  Header "Victory 2" (5,2): The Knight plants the gatling laser barrel-down like a flag pole and stands beside it, one armored boot on a chunk of rubble. The T-visor glows steady amber and the fusion core hums contentedly. Faded military stencils and fresh battle scars tell the story.
  Header "Victory 3" (5,3): The Knight crosses armored arms over the chest plate, gatling laser mag-locked to the back. The amber visor dims to a calm glow and the shoulder lamp clicks off. The imposing silhouette stands at ease — a steel monument on the battlefield.
  Header "Weak Pose" (5,4): The Knight stands with one leg's hydraulics failing, leaning heavily to one side. The gatling laser drags on the ground in a weakening grip. Armor plates are cracked and hanging loose, the fusion core flickers between blue-white and dark, and the amber visor pulses in time with failing power reserves.
  Header "Critical Pose" (5,5): Barely standing, every hydraulic joint sparking and grinding. The gatling laser is braced against the ground as a crutch, barrels bent from impact. The fusion core is exposed and critical — flashing red through the cracked housing. The amber visor is a dying ember behind a shattered helmet plate, but the Knight still faces the enemy.`,
    },
    {
      id: 'xenomorph-drone',
      name: "Xenomorph Drone",
      genre: "Sci-Fi Horror",
      description: "A sleek, biomechanical predator with an elongated smooth skull, no visible eyes, and a lipless mouth hiding a deadly inner jaw. Tall, gaunt frame with a segmented exoskeleton, digitigrade legs, and a long segmented tail ending in a blade tip.",
      equipment: "Natural weapons only — razor-sharp claws, a bladed tail tip, dorsal tubes running along the back, and a telescoping inner mouth with silver teeth. No artificial equipment.",
      colorNotes: "Obsidian black exoskeleton with dark blue reflective highlights on curved surfaces. Silver metallic teeth on both outer and inner jaws. Dorsal tubes are dark steel grey. Saliva is translucent silver. Tail blade is polished dark steel.",
      rowGuidance: `ROW 0 — Walk Down & Walk Up:
  Header "Walk Down 1" (0,0): The Xenomorph Drone stalks forward on its left digitigrade foot, the elongated smooth skull tilted slightly downward. Its obsidian black exoskeleton catches dark blue highlights and the segmented tail curves behind with the blade tip raised. Clawed hands are held at its sides in a predatory stance.
  Header "Walk Down 2" (0,1): Neutral mid-step with both feet planted, the gaunt frame crouched low. The lipless mouth is slightly parted revealing silver teeth and the dorsal tubes along its back are visible above the shoulders. Translucent saliva drips from the jaw.
  Header "Walk Down 3" (0,2): Mirror of Walk Down 1 — right foot leads, the tail blade swaying to the opposite side. The dark blue highlights ripple across the segmented exoskeleton and the clawed hands flex with silent menace.
  Header "Walk Up 1" (0,3): Facing away with left foot forward, the elongated skull rises above the hunched shoulders. The dorsal tubes run prominently down the spine and the segmented tail extends outward with its blade tip. The obsidian exoskeleton is smooth and insectoid.
  Header "Walk Up 2" (0,4): Neutral mid-step facing away, the full length of the dorsal tubes visible from skull crest to lower back. The dark steel grey tubes contrast against the obsidian body. The tail hangs in a low curve.
  Header "Walk Up 3" (0,5): Mirror of Walk Up 1 — right foot forward facing away, tail swaying. The digitigrade legs flex with alien musculature and the dark blue highlights trace the joints.

ROW 1 — Walk Left & Walk Right:
  Header "Walk Left 1" (1,0): The Drone faces left with its left foot forward in a silent, low stalk. The elongated skull extends far forward and the tail stretches out behind for balance. The profile shows the gaunt biomechanical ribbing of the torso.
  Header "Walk Left 2" (1,1): Neutral contact pose facing left, the entire silhouette visible — elongated head, hunched shoulders, dorsal tubes, thin waist, and the long bladed tail. Silver teeth glint in the partially open mouth.
  Header "Walk Left 3" (1,2): Mirror of Walk Left 1 — right foot leads while facing left, the tail curving forward slightly. Clawed hands reach ahead and the obsidian exoskeleton catches dark blue light along the limbs.
  Header "Walk Right 1" (1,3): Facing right with right foot forward, the elongated skull leading the advance. The dorsal tubes create a ridged silhouette and the tail extends far behind with its blade tip raised. Translucent saliva trails from the jaw.
  Header "Walk Right 2" (1,4): Neutral contact pose facing right, digitigrade legs visible in profile. The biomechanical ribbing of the torso and the smooth cranium create an unmistakable alien silhouette.
  Header "Walk Right 3" (1,5): Mirror of Walk Right 1 — left foot leads while facing right. The tail whips behind and the razor claws catch dim reflections. The dark blue highlights trace the segmented spine.

ROW 2 — Idle & Battle Idle:
  Header "Idle Down" (2,0): The Drone crouches facing the viewer, the elongated skull tilted as if sensing the air. The lipless mouth is closed with silver teeth barely visible. The tail coils loosely behind and the clawed hands rest on the ground in a spider-like stance. Dorsal tubes rise above the shoulders.
  Header "Idle Up" (2,1): Crouched facing away, the dorsal tubes and segmented spine dominate the view. The tail curls to one side with the blade tip resting on the ground. The elongated skull is barely visible above the hunched shoulders.
  Header "Idle Left" (2,2): Facing left in a low crouch, the elongated skull extends horizontally. One clawed hand rests on the ground and the tail coils behind. The dark blue highlights on the obsidian exoskeleton catch ambient light.
  Header "Idle Right" (2,3): Facing right, crouched and still. The biomechanical ribbing of the torso is visible and the silver teeth are barely parted. The tail blade rests on the ground and translucent saliva hangs from the jaw.
  Header "Battle Idle 1" (2,4): The Drone rises to full height — towering and gaunt, the elongated skull tilting back. The inner jaw telescopes outward briefly in a threat display, silver teeth gleaming. The tail arches overhead like a scorpion and the claws spread wide.
  Header "Battle Idle 2" (2,5): It sways in the aggressive stance, the inner jaw retracting. The tail blade circles menacingly overhead and the dorsal tubes pulse with subtle movement. The dark blue highlights intensify across the black exoskeleton.

ROW 3 — Battle Idle 3, Attack, Cast Start:
  Header "Battle Idle 3" (3,0): The Drone holds its full-height aggressive stance, the tail poised overhead. The elongated skull tilts forward as if locking onto prey and the clawed hands open and close with anticipation. Silver teeth drip with translucent saliva.
  Header "Attack 1" (3,1): Wind-up — the Drone coils its gaunt body, pulling both clawed hands back and arching the tail high. The inner jaw begins extending from the lipless mouth and the dorsal tubes flatten against the spine.
  Header "Attack 2" (3,2): The Drone lunges forward with both claws slashing in a rapid double-strike, the inner jaw shooting outward at maximum extension. The obsidian body is a blur of dark blue streaks and the tail lashes forward simultaneously.
  Header "Attack 3" (3,3): Follow-through — the claws are fully extended from the dual slash and the inner jaw snaps at the cell edge, silver teeth biting. The tail blade stabs forward past the body. Translucent saliva sprays from the extended inner mouth.
  Header "Cast 1" (3,4): The Drone drops to all fours and raises the tail high, the blade tip vibrating. A small bead of acid-green substance forms at the tip of the inner jaw as it opens wide. The dorsal tubes flare outward.
  Header "Cast 2" (3,5): The acid builds — a viscous green glob grows at the inner jaw tip, dripping and sizzling. The Drone's body tenses and the tail arches forward, poised to catapult the acid. The exoskeleton steams where acid touches it.

ROW 4 — Cast 3, Damage, KO Start:
  Header "Cast 3" (4,0): The Drone spits the acid glob forward — a compact blob of sizzling green that arcs to the cell edge and splatters, dissolving the surface with steaming hisses. The inner jaw retracts and the tail lowers after the release.
  Header "Damage 1" (4,1): The Drone recoils from a hit, the obsidian exoskeleton cracking at the impact point revealing dark blue inner tissue. Acid-green blood spurts from the wound, sizzling on the ground. The tail lashes in pain.
  Header "Damage 2" (4,2): Staggering, more cracks spider-web across the exoskeleton plates. Acid blood flows freely, burning anything it touches. The elongated skull shakes violently and the inner jaw extends in an involuntary pain response.
  Header "Damage 3" (4,3): Recovery — the Drone steadies on all fours, acid blood still dripping and sizzling. The cracked exoskeleton plates resettle and the inner jaw retracts. The tail blade rises again and the creature hisses through silver teeth.
  Header "KO 1" (4,4): The Drone collapses to its knees, the elongated skull drooping forward. Acid blood pools around the cracked exoskeleton, dissolving the ground. The tail goes limp and the clawed hands splay on the ground.
  Header "KO 2" (4,5): Falling onto its side, the Drone's exoskeleton shatters further, releasing more acid blood. The inner jaw hangs slack and the dorsal tubes lie flat. The obsidian body loses its dark blue highlights.

ROW 5 — KO 3, Victory, Status Poses:
  Header "KO 3" (5,0): The Drone lies motionless in a pool of sizzling acid blood, the obsidian exoskeleton cracked and dull. The elongated skull rests on the ground, inner jaw partially extended, and the tail blade lies flat. The acid slowly dissolves the surrounding surface.
  Header "Victory 1" (5,1): The Drone rises to full height and throws the elongated skull back, the inner jaw extending in a triumphant silent scream. Acid saliva sprays from the silver teeth and the tail lashes violently. The obsidian body gleams with dark blue highlights.
  Header "Victory 2" (5,2): It slams the tail blade into the ground and spreads the clawed hands wide, the dorsal tubes flaring. The inner jaw snaps in and out rapidly in a display of dominance. The exoskeleton ripples with predatory energy.
  Header "Victory 3" (5,3): The Drone drops to a low, satisfied crouch, the tail coiling around its body. The elongated skull tilts and the lipless mouth closes over the silver teeth. It is still and watchful — the perfect predator at rest.
  Header "Weak Pose" (5,4): The Drone crouches low, exoskeleton cracked and leaking acid blood. The tail drags limply and the claws barely grip the ground. The elongated skull hangs and the inner jaw extends weakly, silver teeth barely visible.
  Header "Critical Pose" (5,5): Barely alive, the Drone lies on its side with cracked, dull exoskeleton and acid blood pooling. The tail blade twitches and the inner jaw extends one last time in a feeble threat. Even dying, the creature remains terrifying.`,
    },
    {
      id: 'xenomorph-warrior',
      name: "Xenomorph Warrior",
      genre: "Sci-Fi Horror",
      description: "A larger, more heavily armored variant with a distinctive ridged head crest rising from the skull. Broader, more muscular build with thicker chitinous armor plates across the chest and limbs. More aggressive, upright stance than the drone.",
      equipment: "Natural weapons — larger, heavier claws, a thicker armored tail with a wider blade tip, reinforced chitinous chest plates, and a more powerful inner jaw. No artificial equipment.",
      colorNotes: "Primary black exoskeleton with dark brown undertones in the chitin plates. Head crest is glossy black with brown ridges. Acid-green blood visible at joints. Teeth are bone-white. Chest plates have a dark brown, almost woody texture.",
      rowGuidance: `ROW 0 — Walk Down & Walk Up:
  Header "Walk Down 1" (0,0): The Xenomorph Warrior advances on its left foot with a heavier, more deliberate stride than a drone. The ridged head crest rises prominently above the broader shoulders. Thick chitinous chest plates overlap like dark brown armor and the armored tail swings behind with its wide blade.
  Header "Walk Down 2" (0,1): Neutral mid-step with feet planted wide, the muscular frame upright and imposing. The glossy black head crest with brown ridges catches the light. Bone-white teeth are visible in the slightly open mouth and acid-green blood traces the joint seams.
  Header "Walk Down 3" (0,2): Mirror of Walk Down 1 — right foot leads, the heavier tail swaying opposite. The chitinous chest plates shift with the stride and the larger claws flex. Dark brown undertones show in the thicker chitin.
  Header "Walk Up 1" (0,3): Facing away with left foot forward, the ridged head crest and massive shoulders fill the upper view. The thick armored tail extends prominently and the dark brown chitinous back plates overlap in a segmented pattern.
  Header "Walk Up 2" (0,4): Neutral mid-step facing away, the full breadth of the Warrior's back visible — wider and more muscular than a drone. The head crest ridges run in parallel lines and the tail hangs heavily.
  Header "Walk Up 3" (0,5): Mirror of Walk Up 1 — right foot forward facing away, the armored tail swaying. Acid-green blood is faintly visible at the leg joints and the dark brown chitin plates clank softly.

ROW 1 — Walk Left & Walk Right:
  Header "Walk Left 1" (1,0): The Warrior faces left with its left foot forward in a powerful stride. The ridged head crest extends the skull profile dramatically and the thick chitinous chest plates are visible. The heavy armored tail counterbalances the massive build.
  Header "Walk Left 2" (1,1): Neutral contact pose facing left, the full silhouette showing the broader, more upright posture. The dark brown chitin plates layer across the torso like segmented armor and the head crest ridges are sharp in profile.
  Header "Walk Left 3" (1,2): Mirror of Walk Left 1 — right foot leads while facing left. The larger claws reach forward and the tail blade arcs behind. Acid-green blood traces are visible at the wrist joints.
  Header "Walk Right 1" (1,3): Facing right with right foot forward, the head crest leading the advance like a battering ram. The chitinous chest plates are in full profile and the armored tail trails heavily behind. Bone-white teeth are bared.
  Header "Walk Right 2" (1,4): Neutral contact pose facing right, the muscular, upright frame filling the cell. The dark brown undertones in the chitin are visible and the head crest ridges cast small shadows.
  Header "Walk Right 3" (1,5): Mirror of Walk Right 1 — left foot leads while facing right. The tail swings forward and the heavier claws are prominent. The glossy black exoskeleton contrasts with the brown chitin texture.

ROW 2 — Idle & Battle Idle:
  Header "Idle Down" (2,0): The Warrior stands nearly upright facing the viewer, the ridged head crest towering above. The chitinous chest plates are displayed prominently and the larger claws hang at its sides. The armored tail coils on the ground and bone-white teeth gleam in a closed-mouth expression.
  Header "Idle Up" (2,1): Facing away, the massive back and head crest fill the view. The armored tail lies in a heavy curve and the dark brown chitin plates overlap down the spine. The broader frame is noticeably bulkier than a drone.
  Header "Idle Left" (2,2): Facing left in an upright stance, the head crest extends far forward. One massive clawed hand rests at its side and the tail blade rests on the ground. The dark brown chitin plate texture is visible on the near flank.
  Header "Idle Right" (2,3): Facing right, standing tall with the head crest prominent. The chitinous chest plates and bone-white teeth create an armored, predatory profile. Acid-green blood traces at the joints mark its alien biology.
  Header "Battle Idle 1" (2,4): The Warrior drops into a wider, more aggressive stance than a drone, both massive claws raised and spread. The head crest tilts forward and the inner jaw extends partially, bone-white teeth bared in both jaws. The armored tail rises with the wide blade poised.
  Header "Battle Idle 2" (2,5): It shifts in the combat stance, the heavier frame moving with surprising speed. The chitinous chest plates expand with deep breathing and the head crest ridges seem to bristle. The tail blade circles in a wider, deadlier arc.

ROW 3 — Battle Idle 3, Attack, Cast Start:
  Header "Battle Idle 3" (3,0): The Warrior holds the aggressive stance, the inner jaw retracting as it coils for a strike. The head crest angles downward like a charging bull and the massive claws open wide. The armored tail is raised to maximum height.
  Header "Attack 1" (3,1): Wind-up — the Warrior pulls back its right arm, the massive claw clenched. The chitinous chest plates shift to allow the rotation and the head crest tilts with the torso. The tail arches for a secondary strike.
  Header "Attack 2" (3,2): A devastating claw swipe — the massive right claw rakes forward, tearing through the air. The head crest leads the body rotation and the inner jaw snaps outward simultaneously. The tail lashes from behind.
  Header "Attack 3" (3,3): Follow-through — the claw strike reaches maximum extension while the tail blade stabs forward from behind, creating a dual attack. The Warrior's body is fully rotated and the inner jaw is at full extension, bone-white teeth snapping.
  Header "Cast 1" (3,4): The Warrior rears back, the chitinous chest plates expanding as it inhales deeply. Acid-green fluid builds visibly behind the bone-white teeth, bubbling and sizzling. The head crest tilts back and the tail braces on the ground.
  Header "Cast 2" (3,5): The acid builds to a critical mass — the Warrior's throat bulges with the pressurized acid-green fluid. The chitin plates vibrate and the head crest ridges flatten. It aims the elongated skull forward like a cannon barrel.

ROW 4 — Cast 3, Damage, KO Start:
  Header "Cast 3" (4,0): The Warrior launches a pressurized spray of acid-green blood from its mouth — a wide cone of sizzling fluid that fans out to the cell edge, dissolving everything it contacts. The recoil rocks its massive body backward and the head crest shakes.
  Header "Damage 1" (4,1): The Warrior staggers from a hit, a chitinous chest plate cracking and falling away. Acid-green blood spurts from the exposed area, sizzling on the ground. The head crest sways and the tail lashes in rage.
  Header "Damage 2" (4,2): More chitin plates shatter, exposing the dark brown inner tissue. Acid blood flows freely, creating a hazardous pool. The inner jaw extends in a pained screech and the massive claws clutch at the wounds.
  Header "Damage 3" (4,3): Recovery — the Warrior roars and slams both claws on the ground, forcing itself upright. Broken chitin plates hang loose and acid blood still drips, but the head crest rises defiantly. The tail blade rises again.
  Header "KO 1" (4,4): The Warrior's legs buckle under its massive frame. The head crest droops and the chitinous armor hangs in shattered pieces. Acid-green blood pools widely, dissolving the ground. The tail blade scrapes along the surface.
  Header "KO 2" (4,5): Crashing to the ground, the Warrior's armored body creates a heavy impact. The head crest cracks against the surface and acid blood seeps from multiple wounds. The massive claws splay outward and the tail goes still.

ROW 5 — KO 3, Victory, Status Poses:
  Header "KO 3" (5,0): The Warrior lies in a wide pool of sizzling acid-green blood, its shattered chitin plates scattered around the body. The head crest is cracked and the bone-white teeth are visible in the slack jaw. The armored tail lies flat and the claws are open and still.
  Header "Victory 1" (5,1): The Warrior rears to full height and roars, the inner jaw extending in a triumphant shriek. The head crest towers above and the massive claws spread wide. Acid-green blood drips from the bone-white teeth and the tail blade stabs the air.
  Header "Victory 2" (5,2): It slams both clawed fists on the ground in a display of dominance, the chitinous chest plates expanding. The head crest dips and rises in a predatory nod and the tail lashes in a wide, aggressive sweep.
  Header "Victory 3" (5,3): The Warrior stands tall and crosses its massive clawed arms over the chitinous chest plates. The head crest tilts with an almost regal bearing and the tail coils around its feet. Even in stillness, it radiates lethal power.
  Header "Weak Pose" (5,4): The Warrior hunches forward, broken chitin plates hanging loose. Acid blood drips steadily and the head crest droops. The massive claws grip the ground for support and the tail drags limply. The inner jaw hangs partially extended.
  Header "Critical Pose" (5,5): Barely standing, the Warrior sways with most of its chitin armor destroyed. Acid-green blood pools around its feet. The head crest is cracked but still raised and the bone-white teeth are bared in a final, defiant snarl.`,
    },
    {
      id: 'facehugger-swarm',
      name: "Facehugger Swarm",
      genre: "Sci-Fi Horror",
      description: "A group of 3-4 spider-like parasitic creatures moving as a unit. Each has a pale, fleshy body with long gripping finger-legs, a muscular whip-like tail, and a ventral proboscis. They scuttle and leap in unsettling coordinated motion.",
      equipment: "Natural weapons only — gripping finger-legs for latching, a muscular tail for constriction, and a ventral proboscis for implantation. No artificial equipment.",
      colorNotes: "Pale flesh bodies with pink-grey undersides. Finger-legs are slightly darker flesh tone with visible tendons. Tails are pink-grey and muscular. Ventral side has translucent membranes revealing pulsing internals. Overall wet, organic appearance.",
      rowGuidance: `ROW 0 — Walk Down & Walk Up:
  Header "Walk Down 1" (0,0): Three facehuggers scuttle forward as a swarm, the lead creature on the left with finger-legs splayed and the others following in a staggered formation. Their pale flesh bodies are low to the ground and the muscular tails trail behind. The wet, organic sheen catches the light.
  Header "Walk Down 2" (0,1): The swarm pauses in a tight cluster, finger-legs interleaving. The lead facehugger raises its front legs sensing the air while the others press close beneath. Pink-grey undersides are partially visible and the translucent membranes pulse.
  Header "Walk Down 3" (0,2): Mirror of Walk Down 1 — the swarm shifts right, the lead creature now on the right side. Finger-legs scrabble across the ground in unsettling coordinated motion. Tails whip and coil.
  Header "Walk Up 1" (0,3): The swarm scuttles away, showing the top of their pale fleshy bodies. The finger-legs push from behind and the muscular tails lead the way. Three distinct bodies move in formation with visible tendons flexing on the legs.
  Header "Walk Up 2" (0,4): Facing away in a cluster, the swarm's pale dorsal surfaces are visible — smooth flesh domes with the bases of the finger-legs radiating outward. Tails coil together briefly before separating.
  Header "Walk Up 3" (0,5): Mirror of Walk Up 1 — the swarm shifts direction, scuttling away with the formation reversed. The finger-legs move in a disturbing wave pattern and the translucent undersides flash occasionally.

ROW 1 — Walk Left & Walk Right:
  Header "Walk Left 1" (1,0): The swarm scuttles left, three facehuggers in a line with finger-legs reaching. The lead creature's profile shows the gripping legs, whip tail, and the fleshy body in full side view. The others follow in rapid, spider-like pursuit.
  Header "Walk Left 2" (1,1): Clustered facing left, the swarm huddles with finger-legs interleaved. The side view shows the translucent ventral membranes and the muscular tails curling upward. The pale flesh glistens with moisture.
  Header "Walk Left 3" (1,2): Mirror of Walk Left 1 — the swarm moves left with altered formation, some creatures climbing over others. Finger-legs tangle and separate in disturbing coordination. Pink-grey undersides flash.
  Header "Walk Right 1" (1,3): The swarm scuttles right, finger-legs reaching ahead. The lead facehugger leaps slightly while the others rush below. Muscular tails whip for balance and the pale bodies ripple with effort.
  Header "Walk Right 2" (1,4): Clustered facing right, the swarm presses together. The fleshy bodies stack slightly and the finger-legs grip each other as well as the ground. The wet organic appearance is at its most unsettling.
  Header "Walk Right 3" (1,5): Mirror of Walk Right 1 — altered formation scuttling right. One facehugger rides atop another briefly, finger-legs spread wide. The translucent membranes on the ventral side pulse with internal movement.

ROW 2 — Idle & Battle Idle:
  Header "Idle Down" (2,0): The swarm rests in a loose cluster facing the viewer, finger-legs slowly flexing in place. The lead facehugger raises its front legs periodically as if sensing. Pink-grey undersides are visible and the muscular tails lie in lazy coils. The pale flesh rises and falls with breathing.
  Header "Idle Up" (2,1): Resting in a cluster facing away, the smooth flesh domes of the facehugger bodies are visible. Finger-legs splay outward and tails intertwine. The pale bodies pulse gently with internal movement.
  Header "Idle Left" (2,2): The swarm rests facing left, two creatures on the ground and one perched atop them. Finger-legs grip each other and the ground. The side view shows the layered fleshy bodies and trailing tails.
  Header "Idle Right" (2,3): Facing right in a resting cluster, the finger-legs slowly open and close. The translucent ventral membranes pulse and the muscular tails curl and uncurl with idle motion. The wet surface of the bodies glistens.
  Header "Battle Idle 1" (2,4): The swarm springs to alertness — all three facehuggers raise their front finger-legs high and the tails whip upright. They spread into an attack formation, each creature slightly separated and oriented toward the threat. The ventral proboscises extend partially.
  Header "Battle Idle 2" (2,5): The swarm shifts in the attack formation, creatures circling each other in a disturbing dance. Finger-legs flex rapidly and the muscular tails vibrate with tension. The translucent membranes reveal quickened internal pulsing.

ROW 3 — Battle Idle 3, Attack, Cast Start:
  Header "Battle Idle 3" (3,0): The swarm holds the attack formation, three sets of finger-legs spread wide and ready. The lead facehugger's ventral proboscis is fully extended and the muscular tails coil tight like springs. The pale flesh darkens slightly with arousal.
  Header "Attack 1" (3,1): Wind-up — the lead facehugger coils its finger-legs beneath its body and the tail whips backward, preparing to leap. The other two creatures press flat to the ground, clearing a launch path. The pale body compresses like a spring.
  Header "Attack 2" (3,2): The lead facehugger launches into a leaping attack, finger-legs spread wide and reaching forward. The ventral proboscis extends fully and the tail streams behind. The other two creatures rush forward on the ground in support.
  Header "Attack 3" (3,3): The lead facehugger latches on at the cell edge — finger-legs wrapping tight around an invisible target while the tail constricts. The two ground facehuggers attack the base, finger-legs gripping and tails whipping. The swarm strikes as one.
  Header "Cast 1" (3,4): The swarm clusters tightly together, finger-legs interlocking into a single mass. The bodies press together and the tails wrap around the group, forming a pulsing organic orb. The translucent membranes glow with combined internal energy.
  Header "Cast 2" (3,5): The orb of intertwined facehuggers pulses faster, the pale flesh darkening to pink as blood rushes through the combined mass. The finger-legs vibrate at the surface and a high-frequency tremor makes the ground around them ripple.

ROW 4 — Cast 3, Damage, KO Start:
  Header "Cast 3" (4,0): The swarm explodes outward — all three facehuggers launch in different directions simultaneously, each trailing a spray of pink-grey fluid. They arc to the cell edges in a burst of gripping finger-legs and whipping tails, covering maximum area.
  Header "Damage 1" (4,1): A hit scatters the swarm — one facehugger is knocked tumbling, its finger-legs curling protectively. The other two scatter sideways, tails lashing. The struck creature oozes pink fluid from a wound on its pale flesh.
  Header "Damage 2" (4,2): The swarm regroups in disarray — one creature drags a damaged leg and another has a torn translucent membrane leaking fluid. They cluster defensively, finger-legs interweaving for protection. The tails coil tightly.
  Header "Damage 3" (4,3): Recovery — the swarm rights itself, the damaged creatures pulling their wounded parts inward. They reform the attack formation with the healthiest facehugger in the lead. Finger-legs extend cautiously and tails rise again.
  Header "KO 1" (4,4): The swarm collapses — one facehugger goes limp, finger-legs curling inward in a death pose. The others slow and cluster around the fallen creature, finger-legs touching it. The pale flesh of all three goes a sickly grey.
  Header "KO 2" (4,5): Two facehuggers are now motionless with curled finger-legs, lying on their backs showing the translucent ventral membranes no longer pulsing. The last one crawls weakly before collapsing beside them, tail going slack.

ROW 5 — KO 3, Victory, Status Poses:
  Header "KO 3" (5,0): All three facehuggers lie motionless — finger-legs curled inward, tails limp, ventral membranes still and translucent. The pale flesh has gone grey and a small pool of pink fluid surrounds the cluster. They look like discarded organic husks.
  Header "Victory 1" (5,1): The swarm scurries in a celebratory circle, finger-legs clicking rapidly on the ground. The lead facehugger leaps and lands atop the others in a dominant display. Tails whip with energy and the pale flesh pulses a healthy pink.
  Header "Victory 2" (5,2): All three facehuggers rear up on their hind legs simultaneously, front finger-legs spread wide in a coordinated display. The ventral proboscises extend and retract and the tails lash in unison. A disturbing, synchronized victory.
  Header "Victory 3" (5,3): The swarm settles into a satisfied cluster, finger-legs intertwined. They breathe in synchronized pulses, the pale flesh rising and falling together. Tails coil lazily and the translucent membranes glow with contented internal warmth.
  Header "Weak Pose" (5,4): The swarm huddles in a weakened cluster — one creature is barely moving, finger-legs limp. The others press close protectively, their own finger-legs sluggish. The pale flesh is mottled grey and the tails hang without energy.
  Header "Critical Pose" (5,5): Only one facehugger remains functional, dragging itself forward with weakening finger-legs. The other two lie motionless behind it. Its translucent membrane barely pulses and the tail trails limply, but it still reaches toward the threat with desperate, instinctual gripping.`,
    },
    {
      id: 'biomechanical-entity',
      name: "Biomechanical Entity",
      genre: "Sci-Fi Horror",
      description: "An HR Giger-inspired fusion of organic tissue and mechanical structure. A humanoid frame where flesh merges seamlessly with chrome pipes, ribbed tubing, and exposed vertebral columns. Smooth, elongated skull-like head with no visible eyes, connected by cables and tubes to the torso.",
      equipment: "Integrated body-weapons — retractable chrome blade-arms that extend from forearm housings, ribbed pipes that vent steam, exposed vertebrae that flex and strike, and chrome-plated chest panels over raw flesh. No separate equipment.",
      colorNotes: "Chrome silver mechanical components contrasting with exposed flesh pink organic tissue. Dark steel ribbed pipes and tubes. Bone-white exposed vertebrae. The skull-head is smooth dark steel with chrome accents. Fluids are dark reddish-black.",
      rowGuidance: `ROW 0 — Walk Down & Walk Up:
  Header "Walk Down 1" (0,0): The Entity steps forward on its left foot — the leg is a fusion of chrome pistons and exposed flesh-pink muscle. The smooth dark steel skull-head tilts slightly and ribbed tubes connect the neck to the chrome-plated chest panels. A thin hiss of steam vents from a shoulder pipe.
  Header "Walk Down 2" (0,1): Neutral mid-step with both feet planted, the full biomechanical horror visible. Chrome-plated chest panels reveal raw flesh beneath at the seams. Cables and tubes run from the skull-head to the torso and the exposed vertebrae are visible through a gap in the back.
  Header "Walk Down 3" (0,2): Mirror of Walk Down 1 — right foot leads, the other leg's fusion of chrome and flesh visible. The ribbed pipes along the shoulders vent steam from the opposite side. Dark reddish-black fluid traces the chrome joints.
  Header "Walk Up 1" (0,3): Facing away with left foot forward, the exposed vertebral column runs prominently down the center of the back, each bone visible and connected by cables. Dark steel ribbed pipes flank the spine and chrome panels cover the lower back over flesh.
  Header "Walk Up 2" (0,4): Neutral mid-step facing away, the full spinal horror visible — bone-white vertebrae flexing with each step, cables and tubes pulsing with dark fluid. The smooth skull-head rises above on its tube-connected neck.
  Header "Walk Up 3" (0,5): Mirror of Walk Up 1 — right foot forward facing away. Steam vents from the dorsal ribbed pipes and the chrome pistons in the legs extend and contract with mechanical precision over exposed flesh.

ROW 1 — Walk Left & Walk Right:
  Header "Walk Left 1" (1,0): The Entity faces left with its left foot forward, the full profile showing the nightmare fusion. The skull-head extends on its tube-laden neck, the chrome chest panels transition to exposed flesh at the waist, and the ribbed pipes run along the arm and shoulder.
  Header "Walk Left 2" (1,1): Neutral contact pose facing left, the side view revealing the depth of the biomechanical integration. Chrome blade-arm housings are visible on the forearms and the exposed vertebrae peek through the back. Dark fluid drips from cable connections.
  Header "Walk Left 3" (1,2): Mirror of Walk Left 1 — right foot leads while facing left. Steam hisses from the near shoulder pipe and the chrome pistons in the leading leg extend. The flesh-pink tissue pulses visibly between chrome plates.
  Header "Walk Right 1" (1,3): Facing right with right foot forward, the skull-head leading the advance. The chrome-plated chest panels catch light and the ribbed tubes running to the arm housings are visible. The leg pistons drive the stride with mechanical precision.
  Header "Walk Right 2" (1,4): Neutral contact pose facing right, the bone-white vertebrae visible through the back gap. Chrome and flesh merge in unsettling harmony along the profile and dark reddish-black fluid traces the joint seams.
  Header "Walk Right 3" (1,5): Mirror of Walk Right 1 — left foot leads while facing right. The far arm's blade housing catches light and the ribbed pipes along the spine release a small steam vent.

ROW 2 — Idle & Battle Idle:
  Header "Idle Down" (2,0): The Entity stands facing the viewer in an unsettling stillness, the smooth skull-head tilted slightly. Chrome chest panels gleam over exposed flesh and the ribbed tubes pulse with dark fluid. The forearm blade housings are retracted and steam drifts from shoulder pipes.
  Header "Idle Up" (2,1): Facing away, the exposed vertebral column is fully displayed — bone-white vertebrae connected by cables and tubes, flanked by ribbed pipes and chrome panels. The skull-head is barely visible above the mechanical nightmare of the back.
  Header "Idle Left" (2,2): Facing left in biomechanical stillness, the profile shows the smooth skull-head connected by tubes to the torso. Chrome panels reflect light while flesh-pink tissue pulses between them. The blade arm housing is dormant on the near forearm.
  Header "Idle Right" (2,3): Facing right, the ribbed tubes and chrome panels create a disturbing silhouette. Steam drifts lazily from shoulder pipes and dark fluid traces the cable connections. The bone-white vertebrae are visible through the back.
  Header "Battle Idle 1" (2,4): The Entity activates — chrome blade-arms extend from both forearm housings, sliding out with a mechanical hiss. The skull-head snaps forward and the ribbed pipes flare with pressurized steam. The exposed vertebrae arch aggressively and the flesh between the chrome plates pulses faster.
  Header "Battle Idle 2" (2,5): It shifts in the combat stance, the extended chrome blades catching light. The cables and tubes connecting the skull-head to the torso tighten and the vertebral column undulates. Dark reddish-black fluid drips from the blade housing seams.

ROW 3 — Battle Idle 3, Attack, Cast Start:
  Header "Battle Idle 3" (3,0): The Entity holds the combat stance, chrome blades forward and the skull-head locked in a targeting orientation. Steam vents from multiple ribbed pipes and the flesh-pink tissue between chrome plates darkens with blood flow. The vertebrae flex like a coiled serpent.
  Header "Attack 1" (3,1): Wind-up — the Entity pulls both chrome blade-arms back, the forearm housings retracting to extend the blades to maximum length. The skull-head tilts back and the vertebral column arches, storing kinetic energy.
  Header "Attack 2" (3,2): Dual blade strike — both chrome blades slash forward in a crossing arc, the mechanical arms driving with piston force. The skull-head snaps forward and the vertebrae release their stored energy. Steam bursts from every pipe.
  Header "Attack 3" (3,3): Follow-through — the chrome blades are fully extended in an X-pattern, dark reddish-black fluid spraying from the blade edges. The skull-head tilts with the motion and the ribbed pipes vent a powerful steam blast from the exertion.
  Header "Cast 1" (3,4): The Entity retracts the blade-arms and spreads its chrome-and-flesh hands. The ribbed pipes along the spine begin glowing with internal heat and the skull-head tilts back. The cables and tubes connecting to the torso pulse with accelerated dark fluid.
  Header "Cast 2" (3,5): The internal heat builds — the chrome panels begin radiating visible heat shimmer and the exposed flesh between them glows reddish-pink. The vertebrae pulse with energy and the skull-head emits a low mechanical drone. Every ribbed pipe vents superheated steam.

ROW 4 — Cast 3, Damage, KO Start:
  Header "Cast 3" (4,0): The Entity releases a biomechanical shockwave — a burst of superheated steam and dark fluid erupts from every pipe and cable, creating a concussive ring of force. The chrome panels flash and the flesh pulses. The skull-head emits a piercing mechanical shriek.
  Header "Damage 1" (4,1): The Entity staggers, a chrome chest panel cracking and peeling back to reveal the raw flesh beneath. Dark reddish-black fluid sprays from severed tubes and the ribbed pipes sputter. The skull-head jerks sideways.
  Header "Damage 2" (4,2): More chrome panels shatter, exposing large areas of vulnerable flesh-pink tissue. Cables snap and flail, leaking dark fluid. The blade-arms retract involuntarily and the vertebral column locks in a pained arch. Steam vents erratically.
  Header "Damage 3" (4,3): Recovery — the Entity's damaged systems stabilize with mechanical clicks and hydraulic hisses. Severed tubes seal themselves and the blade-arms re-extend. The skull-head realigns and the vertebrae unlock. Dark fluid still drips but the chrome components realign.
  Header "KO 1" (4,4): Systems cascade failure — chrome panels fall away and the blade-arms retract permanently. The ribbed pipes stop venting and go silent. The cables connecting the skull-head go slack and the vertebral column collapses. The entity sinks to its knees.
  Header "KO 2" (4,5): The Entity collapses in a heap of chrome and flesh — mechanical components grinding to a halt and organic tissue going limp. Dark fluid pools around the body and the skull-head rests on the ground with disconnected tubes trailing. The silence is worse than the noise.

ROW 5 — KO 3, Victory, Status Poses:
  Header "KO 3" (5,0): The Entity lies motionless — a pile of chrome plates, exposed flesh, disconnected tubes, and silent ribbed pipes. The skull-head stares blankly and the exposed vertebrae have locked in a contorted position. Dark reddish-black fluid pools beneath the body. A final wisp of steam escapes one pipe.
  Header "Victory 1" (5,1): The Entity extends both chrome blade-arms and crosses them overhead, the skull-head tilting back in a mechanical roar. Every ribbed pipe vents steam in a coordinated blast and the vertebrae undulate in a display of biomechanical dominance. The chrome panels gleam.
  Header "Victory 2" (5,2): The blade-arms retract and the Entity stands tall, the chrome-plated chest expanding as cables and tubes pulse with fresh dark fluid. The skull-head scans slowly and the vertebrae ripple in a satisfied wave. It is a machine that has completed its function.
  Header "Victory 3" (5,3): The Entity returns to unsettling stillness — blade-arms retracted, ribbed pipes gently steaming, vertebrae settled. The skull-head tilts at an almost curious angle and the chrome panels gleam. It waits for the next directive with terrifying patience.
  Header "Weak Pose" (5,4): The Entity hunches with failing systems — chrome panels loose and hanging, blade-arms partially extended and sparking. Several tubes are disconnected and leaking dark fluid. The skull-head droops and the vertebral column sags. Only the faintest steam escapes the pipes.
  Header "Critical Pose" (5,5): Barely operational, the Entity stands on locked pistons. Most chrome plates are gone, exposing vulnerable flesh that pulses weakly. The blade-arms twitch and the skull-head hangs by a few cables. A single ribbed pipe still vents thin steam in a last mechanical breath.`,
    },
    {
      id: 'space-marine',
      name: "Space Marine",
      genre: "Sci-Fi Horror",
      description: "A hardened colonial marine in heavy tactical armor with a full-face helmet featuring an amber visor HUD. Athletic, combat-ready build with military bearing. Battle-scarred armor tells the story of encounters with alien threats.",
      equipment: "Olive drab tactical armor with gunmetal-grey reinforced plates, a pulse rifle with an underslung grenade launcher, a motion tracker mounted on the left forearm, a chest-mounted tactical lamp, and a tactical helmet with an amber-tinted visor.",
      colorNotes: "Olive drab primary armor with gunmetal-grey reinforced plates. Amber-tinted visor with HUD glow. Pulse rifle is dark gunmetal with olive grips. Motion tracker screen is green. Chest lamp casts white light. Boot soles are worn dark rubber.",
      rowGuidance: `ROW 0 — Walk Down & Walk Up:
  Header "Walk Down 1" (0,0): The Space Marine advances on his left foot with a disciplined, combat-ready stride. The pulse rifle is held at the ready across his chest and the amber visor glows with HUD data. The olive drab armor and gunmetal plates catch harsh light and the chest lamp casts a white beam forward.
  Header "Walk Down 2" (0,1): Neutral mid-step contact pose with feet together, the pulse rifle shouldered. The tactical helmet's amber visor reflects the environment and the motion tracker on the left forearm shows a green screen with a sweeping line. Gunmetal plates protect the shoulders and chest.
  Header "Walk Down 3" (0,2): Mirror of Walk Down 1 — right foot leads, the pulse rifle shifting sides. The underslung grenade launcher is visible beneath the barrel and the olive drab armor clanks softly with the disciplined stride.
  Header "Walk Up 1" (0,3): Facing away with left foot forward, the reinforced gunmetal back plates and tactical equipment are visible. The pulse rifle barrel extends over the right shoulder and the helmet's rear ventilation ports are prominent. The olive drab armor is scuffed with battle damage.
  Header "Walk Up 2" (0,4): Neutral mid-step facing away, the full back armor visible — olive drab with gunmetal reinforcement plates. The motion tracker arm hangs at the left side and the chest lamp's mounting bracket is visible from behind.
  Header "Walk Up 3" (0,5): Mirror of Walk Up 1 — right foot forward facing away. The pulse rifle shifts and the amber visor glow is faintly visible around the helmet edges. Battle scars mark the back armor plates.

ROW 1 — Walk Left & Walk Right:
  Header "Walk Left 1" (1,0): The Marine faces left with his left foot forward, pulse rifle aimed ahead with steady hands. The motion tracker on the near forearm sweeps with a green display. The amber visor shows targeting data and the chest lamp illuminates the path. Olive drab armor is tight and functional.
  Header "Walk Left 2" (1,1): Neutral contact pose facing left, the full tactical profile visible — helmet with amber visor, reinforced shoulder plates, pulse rifle at port arms, and the motion tracker screen facing the viewer. The gunmetal plates overlap the olive armor.
  Header "Walk Left 3" (1,2): Mirror of Walk Left 1 — right foot leads while facing left. The underslung grenade launcher is visible in profile and the chest lamp beam cuts forward. Battle scars mark the near shoulder plate.
  Header "Walk Right 1" (1,3): Facing right with right foot forward, pulse rifle leading the advance. The amber visor scans ahead and the chest lamp beam extends forward. The motion tracker is on the far arm and the olive drab armor shows combat wear.
  Header "Walk Right 2" (1,4): Neutral contact pose facing right, the gunmetal reinforced plates visible on the near side. The helmet profile shows the amber visor and ventilation ports. The pulse rifle rests at a ready angle.
  Header "Walk Right 3" (1,5): Mirror of Walk Right 1 — left foot leads while facing right. The motion tracker screen is visible on the far forearm and the pulse rifle barrel catches dull light.

ROW 2 — Idle & Battle Idle:
  Header "Idle Down" (2,0): The Marine stands at combat rest facing the viewer, pulse rifle shouldered with the barrel up. The amber visor glows steadily with a green HUD readout. The chest lamp is on low and the motion tracker shows a clear green screen. Military bearing is evident in every line.
  Header "Idle Up" (2,1): Facing away at combat rest, the back armor plates and equipment webbing are visible. The pulse rifle barrel extends over the right shoulder and the tactical helmet's rear shows communication equipment. Olive drab armor is well-maintained despite battle scars.
  Header "Idle Left" (2,2): Facing left at rest, pulse rifle at port arms. The amber visor shows in profile and the motion tracker on the near arm displays the green sweep. The chest lamp is dimmed and the reinforced shoulder plate shows a deep scratch from an alien encounter.
  Header "Idle Right" (2,3): Facing right at combat rest, the pulse rifle resting against the shoulder. The amber visor casts a faint glow on the olive drab armor and the chest lamp is on standby. The military bearing remains sharp and the gunmetal plates are well-seated.
  Header "Battle Idle 1" (2,4): The Marine snaps to combat stance — pulse rifle aimed forward in a two-handed grip, the amber visor tracking with targeting data. The motion tracker beeps with contacts and the chest lamp blazes to full power. Every gunmetal plate locks tight and the grenade launcher safety clicks off.
  Header "Battle Idle 2" (2,5): He shifts in the combat stance, the pulse rifle tracking. The motion tracker blips increase and the amber visor flickers with multiple contacts. The chest lamp sweeps and the olive drab armor is taut against his combat-ready muscles. Sweat is visible on the chin beneath the visor.

ROW 3 — Battle Idle 3, Attack, Cast Start:
  Header "Battle Idle 3" (3,0): The Marine holds the firing stance, pulse rifle locked on target. The amber visor displays range and target data. The motion tracker sweeps rapidly and the chest lamp illuminates the kill zone. His finger is on the trigger and the grenade launcher is armed.
  Header "Attack 1" (3,1): Wind-up — the Marine braces the pulse rifle stock against his gunmetal shoulder plate, sighting through the amber visor. The weapon charges with a building whine and the chest lamp focuses on the target zone. The motion tracker confirms target lock.
  Header "Attack 2" (3,2): The pulse rifle fires — a rapid burst of bright muzzle flashes erupts from the barrel with spent casings ejecting. The recoil pushes against the shoulder plate and the amber visor flickers with each flash. The chest lamp illuminates the tracer paths.
  Header "Attack 3" (3,3): Follow-through — the burst impacts at the cell edge with small explosions of sparks. Spent casings litter the ground and the pulse rifle barrel steams. The Marine steadies for another burst, the motion tracker still sweeping.
  Header "Cast 1" (3,4): The Marine flips the pulse rifle to the underslung grenade launcher, the selector clicking to secondary fire. He crouches slightly and the amber visor switches to a grenade trajectory arc display. The chest lamp dims to reduce his profile.
  Header "Cast 2" (3,5): The grenade launcher charges — the Marine sights the arc through the amber visor's trajectory display, compensating for range. His body braces for the recoil and the motion tracker shows the target cluster.

ROW 4 — Cast 3, Damage, KO Start:
  Header "Cast 3" (4,0): The grenade launches with a heavy thump — a small explosive round arcs to the cell edge and detonates in a burst of fire and shrapnel. The recoil rocks the Marine backward and the amber visor flashes with the explosion. Smoke rolls across the ground.
  Header "Damage 1" (4,1): The Marine staggers from a hit, a gunmetal plate denting inward. The pulse rifle wavers and the amber visor flickers with static. Acid burns appear on the olive drab armor from alien contact and the chest lamp sputters.
  Header "Damage 2" (4,2): Stumbling back, a shoulder plate cracks and falls away. The motion tracker sparks and the screen goes dark. The amber visor shows damage warnings and the pulse rifle is gripped with trembling, blood-smeared gloves. The chest lamp flickers.
  Header "Damage 3" (4,3): Recovery — the Marine plants his feet and raises the pulse rifle, forcing himself back into firing stance. The amber visor reboots with a flash and the chest lamp steadies. The motion tracker is dead but his training keeps him focused through the pain.
  Header "KO 1" (4,4): The pulse rifle drops from weakening hands as the Marine's knees buckle. The amber visor dims and the chest lamp dies. The damaged armor sags on his failing body and the motion tracker arm hangs limp.
  Header "KO 2" (4,5): The Marine collapses forward, the tactical helmet cracking against the ground. The pulse rifle lies beside his outstretched arm and the amber visor goes completely dark. The olive drab armor is battered and acid-scarred. The chest lamp gives one final flicker.

ROW 5 — KO 3, Victory, Status Poses:
  Header "KO 3" (5,0): The Marine lies face-down in battered armor — the pulse rifle beside his arm, the amber visor dark, and the chest lamp dead. Acid scars mark the olive drab plates and the cracked motion tracker shows a blank screen. Spent casings surround the body. Game over, man.
  Header "Victory 1" (5,1): The Marine raises the pulse rifle overhead with one arm, the amber visor blazing with a victory readout. The chest lamp flashes in celebration and the motion tracker shows a clear screen — all contacts eliminated. He lets out a triumphant battle cry behind the helmet.
  Header "Victory 2" (5,2): He taps the motion tracker and confirms all clear, then slings the pulse rifle over one shoulder. The amber visor switches to standard mode and the chest lamp dims to normal. He gives a sharp military nod of satisfaction — mission accomplished.
  Header "Victory 3" (5,3): The Marine plants the pulse rifle butt on the ground and leans on it, pushing the amber visor up on the helmet. His face is revealed — exhausted but alive, with a grim, satisfied expression. The motion tracker beeps a steady all-clear and the chest lamp casts a warm glow.
  Header "Weak Pose" (5,4): The Marine leans on the pulse rifle as a crutch, the amber visor cracked and flickering. The chest lamp is dead, the motion tracker sparks intermittently, and acid scars cover the olive drab armor. He breathes heavily behind the damaged helmet.
  Header "Critical Pose" (5,5): Barely standing, the Marine grips the pulse rifle one-handed, the other arm limp. The amber visor shows critical damage warnings, most armor plates are gone or cracked, and the chest lamp is shattered. His last magazine is loaded and his finger is on the trigger — he will not go quietly.`,
    }
  ];

  const insert = db.prepare(
    `INSERT OR IGNORE INTO character_presets (id, name, genre, description, equipment, color_notes, row_guidance, is_preset)
     VALUES (?, ?, ?, ?, ?, ?, ?, 1)`
  );

  const insertAll = db.transaction(() => {
    for (const p of PRESETS) {
      insert.run(p.id, p.name, p.genre, p.description, p.equipment, p.colorNotes, p.rowGuidance);
    }
  });

  insertAll();
  console.log(`[DB] Seeded ${PRESETS.length} character presets.`);

  // Link character presets to RPG Full 6x6 grid preset
  const rpgFullGrid = db.prepare("SELECT id FROM grid_presets WHERE name = 'RPG Full' AND sprite_type = 'character'").get();
  if (rpgFullGrid) {
    const insertLink = db.prepare(`
      INSERT OR IGNORE INTO character_grid_links (character_preset_id, grid_preset_id, guidance_override, sort_order)
      VALUES (?, ?, ?, 0)
    `);
    const chars = db.prepare('SELECT id, row_guidance FROM character_presets').all();
    const linkAll = db.transaction(() => {
      for (const char of chars) {
        insertLink.run(char.id, rpgFullGrid.id, char.row_guidance || '');
      }
    });
    linkAll();
    console.log(`[DB] Created ${chars.length} character grid links.`);
  }
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
    {
      id: 'ruined-gas-station',
      name: 'Ruined Gas Station',
      genre: 'Post-Apocalyptic',
      gridSize: '3x3',
      description: 'A collapsed roadside gas station with a caved-in canopy, rusted fuel pumps, and boarded-up windows. Faded pre-war signage barely readable.',
      details: 'Metal canopy collapsed on one side, supported by a single bent pole. Two rusted fuel pumps on cracked concrete. Boarded windows with plywood and nails. Faded price sign with missing letters. Overgrown parking lot with weeds through cracks. A rusted car hulk sits abandoned nearby.',
      colorNotes: 'Rust orange and brown for corroded metal, faded white and red for old signage, cracked grey concrete, dusty tan for sand and dirt, dark green weeds, dull yellow for faded road markings.',
      cellLabels: JSON.stringify([
        'Day - Abandoned', 'Day - Scavengers', 'Day - Dust Storm',
        'Dusk - Campfire', 'Dusk - Lookout', 'Dusk - Quiet',
        'Night - Moonlit', 'Night - Occupied', 'Night - Raider Attack'
      ]),
      cellGuidance: `ROW 0 — Daytime States:
  Header "Day - Abandoned" (0,0): The gas station in harsh daylight. The collapsed canopy casts a jagged shadow. Rusted pumps stand amid cracked concrete. Faded signage is sun-bleached. Weeds push through every crack. The rusted car hulk bakes in the heat. Empty and desolate.
  Header "Day - Scavengers" (0,1): Same daytime scene but small figure silhouettes are visible near the pumps, checking for remaining fuel. One boards are pried from a window. A pack of salvaged goods sits by the rusted car. Active scavenging.
  Header "Day - Dust Storm" (0,2): A dust storm sweeps across the station. Dense tan-brown dust obscures the lower half. The canopy creaks in the wind. Only the top of the faded sign is visible through the swirling sand. Debris flies past.

ROW 1 — Dusk Transition:
  Header "Dusk - Campfire" (1,0): Orange-purple dusk sky. A small campfire burns inside the station under the remaining canopy. Warm orange firelight spills from the boarded windows. Smoke mixes with the dusky air. Feels temporarily inhabited.
  Header "Dusk - Lookout" (1,1): Dusk with a small figure silhouette standing on the collapsed canopy edge, scanning the horizon. The fading light casts long shadows from the rusted pumps. A watchful, tense atmosphere.
  Header "Dusk - Quiet" (1,2): Peaceful dusk — the orange sky behind the station silhouette. No activity. The rusted pumps cast long shadows and the faded sign is backlit. A melancholy beauty to the abandoned ruin.

ROW 2 — Nighttime States:
  Header "Night - Moonlit" (2,0): Pale moonlight illuminates the station. The rusted metal has a blue-silver sheen. Deep shadows under the canopy. The boarded windows are dark voids. The car hulk is a dark silhouette. Eerie and still.
  Header "Night - Occupied" (2,1): Night with warm light from inside — a lantern or fire visible through gaps in the boarded windows. Someone has set up shelter. Bedroll silhouette visible through the doorway. A watch-fire outside.
  Header "Night - Raider Attack" (2,2): Night action scene — muzzle flashes from behind the rusted pumps. Small explosions of sparks. The canopy is being used as cover. Figures in combat silhouettes. Orange tracer lines against the dark. Chaos.`,
    },
    {
      id: 'fortified-settlement-gate',
      name: 'Fortified Settlement Gate',
      genre: 'Post-Apocalyptic',
      gridSize: '3x3',
      description: 'A makeshift community entrance built from scrap metal walls, featuring a watchtower, barbed wire barriers, and a heavy gate assembled from car doors and sheet metal.',
      details: 'Walls made from corrugated metal sheets, car hoods, and sheet metal welded together. A wooden watchtower with a tin roof rises above the left wall. Barbed wire coils top the walls. The gate is two car doors hinged on pipe frames. A guard post with sandbags flanks the right side. Painted warning signs.',
      colorNotes: 'Rust red and gunmetal grey for scrap metal walls, weathered brown wood for the watchtower, silver barbed wire, faded yellow and black warning signs, olive drab sandbags, dusty brown ground.',
      cellLabels: JSON.stringify([
        'Day - Open', 'Day - Closed', 'Day - Market',
        'Alert - Lockdown', 'Alert - Under Attack', 'Alert - Burning',
        'Night - Guarded', 'Night - All Clear', 'Night - Breach'
      ]),
      cellGuidance: `ROW 0 — Daytime Operations:
  Header "Day - Open" (0,0): The settlement gate in daylight with the car-door gates swung open. Traders and survivors pass through. The watchtower has a guard silhouette. Barbed wire glints in the sun. The scrap walls look sturdy despite their makeshift construction.
  Header "Day - Closed" (0,1): Gates shut tight, car doors sealed and barred from inside. The watchtower guard is alert with a visible rifle silhouette. Warning signs face outward. Barbed wire is prominent. The settlement is locked down but not under threat.
  Header "Day - Market" (0,2): Gates open with a bustling market scene just inside. Small stalls visible through the gateway. Barter goods displayed. Multiple figure silhouettes. The watchtower flies a trade flag. Lively and welcoming.

ROW 1 — Alert States:
  Header "Alert - Lockdown" (1,0): Emergency lockdown — gates barred with extra barricades. The watchtower has multiple armed guards. Additional barbed wire deployed in front of the gate. Warning signs lit with red flares. Tense and defensive.
  Header "Alert - Under Attack" (1,1): Active combat — muzzle flashes from the watchtower and guard post. Bullet impacts spark on the scrap metal walls. The gate shudders from impacts. Smoke rises from behind the walls. Desperate defense.
  Header "Alert - Burning" (1,2): The settlement is on fire — flames engulf the watchtower roof and lick along the scrap walls. The gate hangs broken and open. Black smoke billows upward. Barbed wire melts and sags. Devastation.

ROW 2 — Nighttime States:
  Header "Night - Guarded" (2,0): Night with the gates closed. A lantern hangs from the watchtower and a torch burns at the guard post. The scrap walls are dark silhouettes with barbed wire visible against the moonlit sky. Watchful and secure.
  Header "Night - All Clear" (2,1): Quiet night — the guard in the watchtower is relaxed. A small fire burns inside the guard post. The gates are closed but not barred. Peaceful. Distant campfire light glows from within the settlement behind the walls.
  Header "Night - Breach" (2,2): Night attack aftermath — a section of the scrap wall has been torn open. The watchtower leans at an angle. The gate is smashed inward. Fires burn inside the settlement visible through the breach. The barbed wire is scattered.`,
    },
    {
      id: 'underground-bunker-entrance',
      name: 'Underground Bunker Entrance',
      genre: 'Post-Apocalyptic',
      gridSize: '2x2',
      description: 'A concealed hillside entrance to an underground survival bunker, featuring a heavy blast door, radiation warning signs, and camouflage netting.',
      details: 'A reinforced concrete frame set into a grass-covered hillside. A thick steel blast door with a large wheel lock mechanism. Faded yellow radiation warning signs on either side. Torn camouflage netting partially covering the entrance. A ventilation pipe protrudes from the hillside above. Sandbag emplacements flank the approach.',
      colorNotes: 'Dark concrete grey frame, rusted steel blast door, faded yellow radiation trefoil signs, green-brown camouflage netting, olive grass on the hillside, dull metal ventilation pipe.',
      cellLabels: JSON.stringify([
        'Sealed - Day', 'Open - Day',
        'Sealed - Night', 'Open - Night'
      ]),
      cellGuidance: `ROW 0 — Daytime States:
  Header "Sealed - Day" (0,0): Daylight view of the sealed bunker entrance. The heavy blast door is shut tight, the wheel lock rusted in place. Faded radiation signs flank the concrete frame. Camouflage netting is torn but still partially covers the entrance. Grass grows over the hillside. The ventilation pipe releases a thin wisp of filtered air. Quiet and seemingly abandoned.
  Header "Open - Day" (0,1): The blast door is swung open, revealing a lit interior corridor with concrete walls and flickering fluorescent lights. The wheel lock hangs loose. A figure silhouette stands in the doorway. Fresh tracks in the dirt approach. The camouflage netting is pulled aside. Someone is home.

ROW 1 — Nighttime States:
  Header "Sealed - Night" (1,0): Night view of the sealed entrance. Moonlight catches the rusted blast door and concrete frame. The radiation signs are barely visible in the dark. The camouflage netting is a dark mass. The ventilation pipe is a dark silhouette against the sky. A faint hum from underground is the only sign of life.
  Header "Open - Night" (1,1): Night with the blast door open — warm fluorescent light spills from the corridor onto the dark hillside. The interior is brightly lit in contrast to the dark exterior. A guard sits on the sandbags with a lantern. The open door is a beacon in the darkness.`,
    },
    {
      id: 'irradiated-church',
      name: 'Irradiated Church',
      genre: 'Post-Apocalyptic',
      gridSize: '3x3',
      description: 'A crumbling pre-war church with a broken steeple, partially collapsed roof, and an eerie green radioactive glow emanating from the interior through shattered stained glass windows.',
      details: 'White clapboard walls now grey and peeling. The steeple leans at an angle with the cross bent. Half the roof has caved in exposing wooden rafters. Stained glass windows are shattered, some with jagged colorful fragments remaining. A green radioactive glow pulses from inside. An overgrown graveyard with tilted headstones surrounds the building.',
      colorNotes: 'Peeling grey-white clapboard, dark exposed wooden rafters, sickly green radioactive glow, remaining stained glass fragments in red/blue/gold, overgrown dark green vegetation, grey tilted headstones, rusty brown exposed metal.',
      cellLabels: JSON.stringify([
        'Day - Exterior', 'Day - Glow Pulse', 'Day - Overgrown',
        'Dusk - Silhouette', 'Dusk - Green Beacon', 'Dusk - Fog',
        'Night - Dormant', 'Night - Active', 'Night - Meltdown'
      ]),
      cellGuidance: `ROW 0 — Daytime States:
  Header "Day - Exterior" (0,0): The church in daylight showing its decay. Grey peeling clapboard walls, leaning steeple with bent cross, collapsed roof section. The green glow is faint in daylight, barely visible through the shattered windows. The overgrown graveyard with tilted headstones surrounds the building. Sad and decrepit.
  Header "Day - Glow Pulse" (0,1): Same daytime view but the green radioactive glow pulses brighter — clearly visible even in daylight through the broken windows and collapsed roof. The glow casts faint green light on the ground around the church. Something inside is active.
  Header "Day - Overgrown" (0,2): The church nearly consumed by mutant vegetation. Thick vines with sickly green leaves crawl up the walls. The graveyard headstones are buried in overgrowth. Only the leaning steeple protrudes above the vegetation. Nature reclaiming the ruin.

ROW 1 — Dusk Transition:
  Header "Dusk - Silhouette" (1,0): Orange-purple dusk sky with the church as a dark silhouette. The leaning steeple and bent cross are dramatic against the sunset. The green glow begins to become more visible through the windows. The graveyard headstones cast long shadows.
  Header "Dusk - Green Beacon" (1,1): Dusk with the green radioactive glow now clearly visible and bright. The church becomes a green beacon against the darkening sky. Light streams from every window and the collapsed roof. The surrounding ground is bathed in eerie green.
  Header "Dusk - Fog" (1,2): Dusk with a thick fog rolling through the graveyard. The fog glows faintly green near the church. Headstones emerge from the mist. The steeple pierces above the fog layer. Atmospheric and haunting.

ROW 2 — Nighttime States:
  Header "Night - Dormant" (2,0): Dark night with the church barely visible. The green glow is reduced to a faint pulse from within. Moonlight catches the leaning steeple. The graveyard is dark with headstones as pale shapes. Quiet and ominous.
  Header "Night - Active" (2,1): Night with the green glow at full intensity — the church blazes with radioactive light. Green beams shoot from the shattered windows. The collapsed roof is an open cauldron of green energy. The graveyard is lit in sickly green. Radiation readings would be lethal.
  Header "Night - Meltdown" (2,2): Critical radioactive event — the church's green glow is blinding. Cracks of green energy split the remaining walls. The steeple is surrounded by a green corona. The ground around the church glows and cracks. The headstones themselves glow. An atomic nightmare.`,
    },
    {
      id: 'hive-chamber',
      name: 'Hive Chamber',
      genre: 'Sci-Fi Horror',
      gridSize: '3x3',
      description: 'An organic alien nest chamber with resin-coated walls, cocooned victims along the walls, and a thick layer of biomechanical secretion covering every surface. Dim amber lighting from bioluminescent growths.',
      details: 'Walls made of hardened organic resin with ribbed textures. Cocooned human figures are embedded in the walls, encased in translucent resin showing vague silhouettes. Egg clusters sit on the organic floor. Dripping resin strands hang from the ceiling. Small bioluminescent growths provide dim amber light. A central passage leads deeper into the hive.',
      colorNotes: 'Dark brown-black resin walls, amber bioluminescent glow, translucent grey-white cocoon resin, dark organic floor with green-black sheen, pale flesh visible through cocoon material.',
      cellLabels: JSON.stringify([
        'Empty - Dim', 'Empty - Active', 'Egg Cluster',
        'Cocooned Victims', 'Hatching', 'Drone Present',
        'Warrior Patrolling', 'Queen Nearby', 'Infestation Peak'
      ]),
      cellGuidance: `ROW 0 — Chamber States:
  Header "Empty - Dim" (0,0): The hive chamber in its dormant state. Resin-coated walls glisten with a dark sheen. Bioluminescent growths cast faint amber pools of light. Dripping resin strands hang from above. The chamber is empty and quiet but deeply unsettling. Organic textures cover every surface.
  Header "Empty - Active" (0,1): The chamber is more active — bioluminescent growths pulse brighter. Fresh resin drips are visible. The ribbed walls seem to breathe with subtle expansion. The floor has fresh organic secretion. Something has been here recently.
  Header "Egg Cluster" (0,2): A cluster of leathery alien eggs sits in the center of the chamber. The eggs are waist-high, pale and mottled, with a cross-shaped opening at the top. They pulse gently with internal movement. Mist hugs the floor around them. The amber light catches the moist egg surfaces.

ROW 1 — Infestation Progress:
  Header "Cocooned Victims" (1,0): The walls are lined with cocooned figures — human silhouettes visible through layers of translucent hardened resin. Some figures show signs of chest-burst trauma. The cocoon material is grey-white and veined. The scene is deeply horrifying.
  Header "Hatching" (1,1): An egg in the foreground is opening — the cross-shaped top peeling back to reveal movement inside. A pale facehugger finger-leg reaches from within. Other eggs nearby pulse with imminent hatching. Tension and dread.
  Header "Drone Present" (1,2): A xenomorph drone silhouette crouches in the corner of the chamber, barely distinguishable from the organic walls. Its obsidian body blends with the resin. Only the glint of silver teeth and the curve of the tail blade betray its presence. Predator in its nest.

ROW 2 — Maximum Threat:
  Header "Warrior Patrolling" (2,0): A larger xenomorph warrior strides through the chamber, its ridged head crest nearly touching the ceiling. The resin walls seem to part for it. Acid-green blood traces mark the floor. The amber light catches the warrior's dark brown chitin plates.
  Header "Queen Nearby" (2,1): The chamber trembles — massive footsteps shake loose resin from the ceiling. An enormous shadow fills the passage at the far end. The bioluminescent growths blaze brighter in response. The eggs pulse frantically. The queen is approaching. Ultimate terror.
  Header "Infestation Peak" (2,2): The chamber is at maximum horror — every wall is covered in cocoons, eggs fill the floor, multiple drone silhouettes cling to walls and ceiling. Resin drips constantly. The bioluminescence is at its brightest. The hive is alive and thriving. A nightmare ecosystem.`,
    },
    {
      id: 'derelict-ship-corridor',
      name: 'Derelict Ship Corridor',
      genre: 'Sci-Fi Horror',
      gridSize: '3x3',
      description: 'A biomechanical alien vessel interior with HR Giger-inspired ribbed walls, fog-filled corridors, and flickering emergency strip lighting. The architecture itself seems alive.',
      details: 'Ribbed walls with organic-mechanical fusion — bone-like arches meet chrome pipes and cable bundles. Emergency strip lighting runs along the floor in dim red. Fog drifts at floor level. Skeletal arch doorways lead to other sections. Condensation drips from the biomechanical ceiling. A control panel with alien displays is embedded in one wall.',
      colorNotes: 'Dark steel-grey biomechanical walls with bone-white ribbing, dim red emergency strip lighting, blue-green fog, amber alien display panels, chrome pipe accents, dark condensation streaks.',
      cellLabels: JSON.stringify([
        'Powered Down', 'Emergency Lighting', 'Systems Online',
        'Fog Rolling', 'Motion Detected', 'Acid Damage',
        'Breach - Vacuum', 'Self Destruct', 'Overgrown'
      ]),
      cellGuidance: `ROW 0 — Power States:
  Header "Powered Down" (0,0): The corridor in complete darkness except for very faint bioluminescence from the walls themselves. The ribbed architecture is barely visible — bone-like shapes in the black. No emergency lights. No fog. Absolute silence visualized through stillness. Cold and dead.
  Header "Emergency Lighting" (0,1): Red emergency strip lights flicker on along the floor, casting harsh upward shadows on the ribbed walls. The bone-white ribs become dramatic against the dark ceiling. Fog begins drifting at floor level. The alien control panel shows a single amber warning glyph. Tense.
  Header "Systems Online" (0,2): Full emergency power — red strip lights are steady, the alien control panel blazes with amber displays, and conduit pipes along the walls pulse with faint blue energy. The fog is thicker. The corridor stretches into darkness at both ends. The biomechanical architecture is fully revealed and terrifying.

ROW 1 — Threat Escalation:
  Header "Fog Rolling" (1,0): Dense blue-green fog fills the lower half of the corridor, obscuring the floor completely. The red strip lights glow through the fog creating an otherworldly haze. The upper ribbed walls emerge above the fog line. Visibility is severely limited. Something could be hiding in the fog.
  Header "Motion Detected" (1,1): The control panel flashes a rapid amber warning. A shadow moves at the far end of the corridor — barely visible through the fog. The emergency lights flicker in response to the movement. Condensation falls from the ceiling in a disturbed pattern. The corridor suddenly feels very narrow.
  Header "Acid Damage" (1,2): Acid has burned through sections of the floor and walls — smoking holes with melted edges reveal lower decks and internal pipework. The acid-green residue sizzles and steams. Some ribs are partially dissolved. The corridor is compromised and dangerous.

ROW 2 — Catastrophic States:
  Header "Breach - Vacuum" (2,0): A hull breach at the far end of the corridor — the wall is torn open showing stars and the void of space. Atmosphere vents outward, the fog streaming toward the breach. Emergency bulkheads are half-closed. Loose objects drift toward the opening. The emergency lights strobe in alarm.
  Header "Self Destruct" (2,1): The self-destruct sequence is active — every light flashes red in urgent pulses. The alien control panel displays a countdown in alien glyphs. Steam jets from ruptured pipes. The ribbed walls seem to contract as if the ship is in pain. Alarms implied through visual chaos. Evacuation urgency.
  Header "Overgrown" (2,2): After years of abandonment, the biomechanical architecture has grown — ribs have expanded and merged, new organic growth covers the chrome pipes, and the corridor has partially closed in on itself. The alien technology and organic material have fused into a new, living structure. Beautiful and horrible.`,
    },
    {
      id: 'egg-chamber',
      name: 'Egg Chamber',
      genre: 'Sci-Fi Horror',
      gridSize: '2x2',
      description: 'A breeding ground for facehuggers — a low-ceilinged organic chamber carpeted with leathery eggs on a living organic floor, filled with blue-green mist and pulsing bioluminescence.',
      details: 'Low organic ceiling dripping with resin. The floor is a living organic membrane covered with rows of leathery eggs. Each egg is about waist-high with a cross-shaped opening at the top. Blue-green mist hugs the floor obscuring the egg bases. Pulsing bioluminescent growths in the walls create an eerie rhythmic light. The overall atmosphere is womb-like and profoundly disturbing.',
      colorNotes: 'Pale grey-brown leathery eggs, dark organic floor and ceiling, blue-green bioluminescent mist, amber pulsing wall growths, translucent egg membranes, dark resin drips.',
      cellLabels: JSON.stringify([
        'Dormant', 'Awakening',
        'Hatching Wave', 'Empty Husks'
      ]),
      cellGuidance: `ROW 0 — Pre-Hatch States:
  Header "Dormant" (0,0): The egg chamber at rest. Rows of leathery eggs stand in the mist, all closed at the top. The bioluminescent growths pulse in a slow, hypnotic rhythm. Resin drips from the low ceiling. The blue-green mist is still and even. The eggs appear inert but alive. An unsettling calm.
  Header "Awakening" (0,1): The eggs respond to a presence — the leathery surfaces begin to ripple with internal movement. The cross-shaped openings twitch. The bioluminescence pulses faster. The mist swirls as if disturbed from below. The organic floor membrane contracts slightly. Something is about to happen.

ROW 1 — Active States:
  Header "Hatching Wave" (1,0): Multiple eggs are opening simultaneously — cross-shaped tops peeling back, pale facehugger legs reaching upward. Some facehuggers are already free, scuttling between eggs. The mist churns. The bioluminescence blazes at maximum intensity. A cascade of horrifying birth.
  Header "Empty Husks" (1,1): The aftermath — all eggs are open and empty, their leathery walls collapsed inward. Spent egg fluid pools on the organic floor. The mist has thinned. The bioluminescence dims to a low pulse. Only hollow husks remain. The facehuggers have gone hunting. The silence is worse than the hatching.`,
    },
    {
      id: 'biomechanical-temple',
      name: 'Biomechanical Temple',
      genre: 'Sci-Fi Horror',
      gridSize: '3x3',
      description: 'A Giger-esque cathedral of impossible geometry — skeletal ribbed arches soar overhead, organic pipes pulse with unknown fluids, and a chrome altar sits at the center of a living chamber that defies architectural logic.',
      details: 'Massive skeletal arches made of fused bone and chrome form the ceiling structure. Organic pipes run along the walls carrying dark fluids. A central chrome altar rises from the organic floor, covered in alien glyphs. The walls themselves appear to breathe with slow, rhythmic expansion. The geometry is subtly wrong — angles that should be straight are curved, perspectives that should converge seem to diverge. Living walls with embedded vertebral columns and ribbed surfaces.',
      colorNotes: 'Bone-white skeletal arches with chrome joints, dark steel walls with flesh-pink organic patches, chrome altar with amber glyph lighting, dark fluid in translucent organic pipes, overall palette of chrome silver, bone, and disturbing flesh tones.',
      cellLabels: JSON.stringify([
        'Dormant - Day', 'Dormant - Night', 'Awakened',
        'Ritual Active', 'Entity Summoned', 'Corruption Spreading',
        'Ancient Ruin', 'Fully Alive', 'Transcendence'
      ]),
      cellGuidance: `ROW 0 — Base States:
  Header "Dormant - Day" (0,0): The temple in cold, dead light. The skeletal arches soar overhead but the bone surfaces are dull and dry. The chrome altar sits empty and unlit. The organic pipes are still and dark. The walls do not breathe. The impossible geometry is visible but muted. An ancient, dormant horror.
  Header "Dormant - Night" (0,1): Darkness fills the temple. Faint moonlight catches the chrome surfaces — the altar, the pipe fittings, the arch joints. The bone-white skeletal structure glows faintly. The geometry becomes more unsettling in the dark, shadows making the wrong angles more prominent.
  Header "Awakened" (0,2): The temple stirs — the organic pipes begin flowing with dark fluid. The walls pulse with the first breath. The chrome altar glyphs flicker amber. The skeletal arches flex almost imperceptibly. The flesh-pink patches on the walls darken with blood flow. Something ancient remembers.

ROW 1 — Active States:
  Header "Ritual Active" (1,0): A ceremony in progress — the chrome altar blazes with amber glyph light. The organic pipes pulse rhythmically. The walls breathe visibly. The skeletal arches vibrate with resonance. Small biomechanical entities emerge from the walls. The impossible geometry seems to shift and flow.
  Header "Entity Summoned" (1,1): A massive biomechanical entity materializes above the altar — a translucent form of chrome and flesh, too large for the space yet somehow contained. The temple's geometry bends around it. The skeletal arches bow inward. The organic pipes blaze with superheated fluid. Ultimate cosmic horror.
  Header "Corruption Spreading" (1,2): The temple's influence extends outward — the organic walls push through the stone boundaries. Biomechanical tendrils crawl along the floor beyond the temple proper. The chrome surfaces propagate like a metallic infection. The impossible geometry is spreading. Reality warps at the edges.

ROW 2 — Extreme States:
  Header "Ancient Ruin" (2,0): The temple as archaeological discovery — partially buried, the skeletal arches broken and half-collapsed. The chrome altar is tarnished and covered in dust. Organic pipes are dried and cracked. The impossible geometry is still subtly wrong even in ruin. A place of ancient power, long dormant.
  Header "Fully Alive" (2,1): The temple at maximum biological activity — every surface breathes, the organic pipes flow with bright fluid, the chrome altar projects holographic alien geometries upward. The skeletal arches flex like ribs around a beating heart. The walls are more flesh than metal. The air shimmers with impossible angles.
  Header "Transcendence" (2,2): Beyond horror into awe — the temple has transcended physical form. The skeletal arches dissolve into pure light. The chrome altar projects a gateway to somewhere else. The geometry inverts — inside becomes outside. The organic and mechanical merge into a new form of existence. Terrifyingly beautiful.`,
    },
  ];

  const insert = db.prepare(
    `INSERT OR IGNORE INTO building_presets (id, name, genre, grid_size, description, details, color_notes, cell_labels, cell_guidance, is_preset)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`
  );

  const insertAll = db.transaction(() => {
    for (const p of PRESETS) {
      insert.run(p.id, p.name, p.genre, p.gridSize, p.description, p.details, p.colorNotes, p.cellLabels, p.cellGuidance);
    }
  });

  insertAll();
  console.log(`[DB] Seeded ${PRESETS.length} building presets.`);

  // Create a grid preset per building content preset with real cell labels, then link
  const insertGrid = db.prepare(`
    INSERT OR IGNORE INTO grid_presets (name, sprite_type, genre, grid_size, cols, rows, cell_labels, cell_groups, generic_guidance, bg_mode, is_preset)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
  `);
  const findGrid = db.prepare("SELECT id FROM grid_presets WHERE name = ? AND sprite_type = 'building' AND grid_size = ?");
  const insertLink = db.prepare(`
    INSERT OR IGNORE INTO building_grid_links (building_preset_id, grid_preset_id, guidance_override, sort_order)
    VALUES (?, ?, ?, 0)
  `);
  const BUILDING_GUIDANCE = `Each cell in the grid has a WHITE TEXT HEADER that names the variant. Draw the same building in each cell but reflecting the variant described by its header label. Maintain consistent architecture, proportions, and style across all cells. Each row typically represents a thematic group (e.g., activity states, damage states, time of day).`;
  const gridSizeToDims = { '3x3': [3,3], '2x2': [2,2], '2x3': [2,3] };
  const linkAll = db.transaction(() => {
    for (const p of PRESETS) {
      const [cols, rows] = gridSizeToDims[p.gridSize] || [3, 3];
      const labels = JSON.parse(p.cellLabels);
      const cellGroups = [];
      for (let r = 0; r < rows; r++) {
        const cells = [];
        for (let c = 0; c < cols; c++) cells.push(r * cols + c);
        cellGroups.push({ name: `Row ${r + 1}`, cells });
      }
      insertGrid.run(p.name, 'building', p.genre, p.gridSize, cols, rows,
        p.cellLabels, JSON.stringify(cellGroups), BUILDING_GUIDANCE, null);
      const gridRow = findGrid.get(p.name, p.gridSize);
      if (gridRow) insertLink.run(p.id, gridRow.id, p.cellGuidance || '');
    }
  });
  linkAll();
  console.log(`[DB] Seeded building grid presets + links.`);
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
    {
      id: 'cracked-desert-wasteland',
      name: 'Cracked Desert Wasteland',
      genre: 'Post-Apocalyptic',
      gridSize: '4x4',
      description: 'Sun-baked post-nuclear earth with deep cracks, scattered debris, radiation pools, and dead brush for wasteland environments.',
      colorNotes: 'Parched tan and pale yellow cracked earth, dark brown crack lines, sickly yellow-green radiation pools, grey-brown dead brush, rust orange debris, bleached bone white.',
      tileLabels: JSON.stringify([
        'Cracked Earth 1', 'Cracked Earth 2', 'Deep Fissure', 'Scorched Ground',
        'Radiation Pool', 'Toxic Puddle', 'Dead Brush', 'Debris Scatter',
        'Rusted Metal', 'Bone Fragments', 'Tire Tracks', 'Blast Crater',
        'Wasteland-Road Edge N', 'Wasteland-Road Edge S', 'Wasteland-Road Edge E', 'Wasteland-Road Edge W'
      ]),
      tileGuidance: `ROW 0 — Base Wasteland Tiles (seamlessly tileable):
  Header "Cracked Earth 1" (0,0): Sun-baked pale tan earth with a polygon pattern of deep cracks. The standard wasteland ground tile. Dry, parched, and lifeless. Subtle heat shimmer implied by pale coloring.
  Header "Cracked Earth 2" (0,1): Variant cracked earth with different crack pattern and a few small pebbles. Same pale tan palette. Tiles seamlessly with Cracked Earth 1.
  Header "Deep Fissure" (0,2): A wide dark crack runs diagonally across the tile, deep enough to show darkness below. The surrounding earth is crumbling at the edges. More dramatic damage than base tiles.
  Header "Scorched Ground" (0,3): Blackened, charred earth from a nuclear blast or fire. Dark brown-black surface with ash residue. No cracks — the ground was melted smooth. Devastated.

ROW 1 — Hazard Tiles:
  Header "Radiation Pool" (1,0): A small pool of sickly yellow-green glowing liquid sitting in a depression. The surrounding cracked earth is stained darker. The pool surface has an oily, unnatural sheen. Lethal.
  Header "Toxic Puddle" (1,1): A smaller toxic puddle — murky brown-green water in a crack. Less glowing than the radiation pool but still dangerous. Dead insects float on the surface.
  Header "Dead Brush" (1,2): Cracked earth with a cluster of dead grey-brown brush — skeletal twigs and dried leaves. The only vegetation, and it is long dead. Desolate.
  Header "Debris Scatter" (1,3): Cracked earth with scattered pre-war debris — broken glass, twisted metal fragments, faded plastic. The remnants of civilization ground into the dirt.

ROW 2 — Feature Tiles:
  Header "Rusted Metal" (2,0): A rusted metal sheet or car panel partially buried in the cracked earth. Rust orange surface with flaking paint. A salvageable resource marker.
  Header "Bone Fragments" (2,1): Bleached white bone fragments scattered on the cracked earth. Animal or human bones sun-bleached to white. A grim reminder of what was lost.
  Header "Tire Tracks" (2,2): Twin parallel tire tracks pressed into the cracked earth, running top to bottom. Someone drove through recently. The tracks are the only sign of life.
  Header "Blast Crater" (2,3): A shallow circular depression — a small blast crater with darker scorched earth at the center and cracked debris around the rim. Evidence of past violence.

ROW 3 — Wasteland-to-Road Edge Transitions:
  Header "Wasteland-Road Edge N" (3,0): Cracked wasteland earth on the north half transitioning to broken asphalt road on the south half. The road edge crumbles into the dirt.
  Header "Wasteland-Road Edge S" (3,1): Broken asphalt on the north half, wasteland earth on the south half. Reverse of Edge N. Weeds push through the asphalt cracks.
  Header "Wasteland-Road Edge E" (3,2): Wasteland on the east half, broken road on the west half. Vertical transition with crumbling asphalt edge.
  Header "Wasteland-Road Edge W" (3,3): Broken road on the east half, wasteland on the west half. Reverse of Edge E.`,
    },
    {
      id: 'toxic-swamp',
      name: 'Toxic Swamp',
      genre: 'Post-Apocalyptic',
      gridSize: '4x4',
      description: 'Murky irradiated wetland tiles with glowing green water, dead trees, bubbling toxic surface, and fungal growths for contaminated swamp environments.',
      colorNotes: 'Murky dark green-brown water, sickly bright green glow in contaminated areas, grey-black dead tree trunks, pale bioluminescent fungi, dark mud brown, toxic yellow-green bubbles.',
      tileLabels: JSON.stringify([
        'Murky Water 1', 'Murky Water 2', 'Glowing Water', 'Bubbling Surface',
        'Mud Flat', 'Dead Tree Stump', 'Fallen Log', 'Fungal Growth',
        'Lily Pad Cluster', 'Toxic Algae', 'Bone Pile', 'Submerged Wreck',
        'Swamp-Land Edge N', 'Swamp-Land Edge S', 'Swamp-Land Edge E', 'Swamp-Land Edge W'
      ]),
      tileGuidance: `ROW 0 — Base Swamp Water (seamlessly tileable):
  Header "Murky Water 1" (0,0): Dark green-brown murky swamp water. The surface is opaque with floating organic matter. Subtle ripple texture. The standard toxic swamp tile. Unsettling and still.
  Header "Murky Water 2" (0,1): Variant murky water with slightly different surface debris and ripple pattern. Tiles seamlessly with Murky Water 1. A few more floating particles.
  Header "Glowing Water" (0,2): Swamp water with a sickly bright green glow emanating from below. The contaminated water illuminates from within. Radiation or chemical contamination. Beautiful and deadly.
  Header "Bubbling Surface" (0,3): Murky water with toxic yellow-green bubbles breaking the surface. Gas escaping from submerged decay. The bubbles pop and release wisps of toxic vapor. Active and dangerous.

ROW 1 — Solid Ground and Features:
  Header "Mud Flat" (1,0): Exposed dark brown mud between water areas. Wet, sticky surface with boot-print impressions. Small puddles of toxic water in depressions. Traversable but treacherous.
  Header "Dead Tree Stump" (1,1): A grey-black dead tree stump rising from the murky water. The trunk is bare and rotting. Fungal growths cling to the base. A landmark in the featureless swamp.
  Header "Fallen Log" (1,2): A dead tree trunk lying partially submerged in the swamp water. Grey-black bark peeling away. Moss and fungi cover the exposed wood. Could be used as a bridge.
  Header "Fungal Growth" (1,3): Mud or shallow water with a cluster of pale bioluminescent fungi. The mushrooms glow a soft blue-green. Toxic spores drift from the caps. Eerie and alien.

ROW 2 — Decorative Feature Tiles:
  Header "Lily Pad Cluster" (2,0): Murky water with mutant lily pads — oversized, slightly wrong in color (dark olive instead of bright green). Some have strange growths or holes. Post-apocalyptic vegetation.
  Header "Toxic Algae" (2,1): Water surface covered in a thick mat of toxic algae — bright yellow-green scum. The water beneath is invisible. The algae pulses faintly. A carpet of contamination.
  Header "Bone Pile" (2,2): Shallow murky water with a pile of animal bones rising above the surface. Bleached white against the dark water. Something was feeding here. Or something died here in numbers.
  Header "Submerged Wreck" (2,3): The top of a submerged vehicle or structure breaking the water surface. Rusted metal protrudes from the murky depths. Moss and algae cover the exposed parts. A pre-war relic swallowed by the swamp.

ROW 3 — Swamp-to-Land Edge Transitions:
  Header "Swamp-Land Edge N" (3,0): Murky swamp water on the north half transitioning to muddy solid ground on the south half. The waterline is irregular with reeds and debris.
  Header "Swamp-Land Edge S" (3,1): Muddy ground on the north half, swamp water on the south half. Reverse of Edge N. The ground slopes into the water.
  Header "Swamp-Land Edge E" (3,2): Swamp water on the east half, solid ground on the west half. Vertical transition with a muddy bank.
  Header "Swamp-Land Edge W" (3,3): Solid ground on the east half, swamp water on the west half. Reverse of Edge E.`,
    },
    {
      id: 'ruined-highway',
      name: 'Ruined Highway',
      genre: 'Post-Apocalyptic',
      gridSize: '4x4',
      description: 'Cracked and broken asphalt highway tiles with faded lane markings, rusted vehicle debris, and overgrown weeds pushing through the pavement.',
      colorNotes: 'Dark grey cracked asphalt, faded yellow and white lane markings, rust orange vehicle debris, dark green weeds in cracks, pale concrete for shoulder, brown dirt beneath broken pavement.',
      tileLabels: JSON.stringify([
        'Asphalt 1', 'Asphalt 2', 'Lane Markings H', 'Lane Markings V',
        'Pothole', 'Major Crack', 'Overgrown Section', 'Rusted Vehicle',
        'Guardrail', 'Road Sign', 'Debris Field', 'Oil Stain',
        'Road-Dirt Edge N', 'Road-Dirt Edge S', 'Road-Dirt Edge E', 'Road-Dirt Edge W'
      ]),
      tileGuidance: `ROW 0 — Base Road Tiles (seamlessly tileable):
  Header "Asphalt 1" (0,0): Dark grey cracked asphalt with small fractures and weathering. The standard broken road tile. Surface is rough and aged but mostly intact. Subtle variations in grey tones.
  Header "Asphalt 2" (0,1): Variant asphalt with different crack pattern and a small weed pushing through. Tiles seamlessly with Asphalt 1. Slightly lighter grey patches from sun bleaching.
  Header "Lane Markings H" (0,2): Asphalt with faded yellow or white lane markings running horizontally — dashed center line and solid edge line. The paint is flaking and barely visible. A ghost of order.
  Header "Lane Markings V" (0,3): Asphalt with faded lane markings running vertically. Dashed line in the center, solid at the edge. Same faded, forgotten paint.

ROW 1 — Damage Tiles:
  Header "Pothole" (1,0): A large pothole in the asphalt — a dark depression revealing layers of road base and brown dirt beneath. Crumbled edges. Water may collect here. A driving hazard.
  Header "Major Crack" (1,1): A wide crack splitting the asphalt diagonally. The crack is wide enough to see dirt and roots beneath. Weeds grow from the gap. The road is failing structurally.
  Header "Overgrown Section" (1,2): Asphalt nearly consumed by vegetation — dark green weeds, grass, and small bushes push through extensive cracks. Nature reclaiming the road. Barely recognizable as pavement.
  Header "Rusted Vehicle" (1,3): A rusted vehicle hulk sitting on the asphalt — a flattened, corroded car shell in rust orange and brown. Tires are flat discs. Windows are empty holes. A permanent road obstacle.

ROW 2 — Feature Tiles:
  Header "Guardrail" (2,0): A section of bent and rusted metal guardrail running across the tile. The posts lean at angles and the rail is dented. A road boundary marker long past its purpose.
  Header "Road Sign" (2,1): A fallen or leaning road sign on cracked asphalt. The sign face is faded and unreadable — maybe a speed limit or direction. The metal pole is rusted. A landmark.
  Header "Debris Field" (2,2): Asphalt covered with scattered debris — broken glass, twisted metal, plastic fragments, and scattered personal items. The aftermath of a crash or abandonment. Cluttered and sad.
  Header "Oil Stain" (2,3): Asphalt with a large dark oil stain — an iridescent dark patch where a vehicle leaked its lifeblood. The stain has been baked in by years of sun. A permanent scar.

ROW 3 — Road-to-Dirt Edge Transitions:
  Header "Road-Dirt Edge N" (3,0): Cracked asphalt on the north half breaking apart into bare dirt and gravel on the south half. The road edge crumbles. Weeds grow in the transition zone.
  Header "Road-Dirt Edge S" (3,1): Bare dirt and gravel on the north half, broken asphalt road on the south half. Reverse of Edge N. The pavement emerges from the wasteland.
  Header "Road-Dirt Edge E" (3,2): Asphalt on the east half, dirt on the west half. Vertical transition with crumbling road shoulder. Gravel scatter at the boundary.
  Header "Road-Dirt Edge W" (3,3): Dirt on the east half, asphalt on the west half. Reverse of Edge E. The road edge is defined by a line of broken concrete chunks.`,
    },
    {
      id: 'organic-hive-floor',
      name: 'Organic Hive Floor',
      genre: 'Sci-Fi Horror',
      gridSize: '4x4',
      description: 'Resin-coated metal floor tiles with organic alien growth, acid burn marks, and cocooned debris for xenomorph hive interiors.',
      colorNotes: 'Dark brown-black hardened resin over gunmetal grating, ridged organic growths in dark grey-brown, acid-green burn marks and residue, pale grey-white cocoon material, dim amber bioluminescent patches.',
      tileLabels: JSON.stringify([
        'Resin Floor 1', 'Resin Floor 2', 'Metal Grating', 'Resin-Metal Mix',
        'Organic Ridge H', 'Organic Ridge V', 'Ridge Junction', 'Acid Burn',
        'Cocoon Debris', 'Egg Base', 'Bioluminescent Patch', 'Secretion Pool',
        'Hive-Metal Edge N', 'Hive-Metal Edge S', 'Hive-Metal Edge E', 'Hive-Metal Edge W'
      ]),
      tileGuidance: `ROW 0 — Base Floor Tiles (seamlessly tileable):
  Header "Resin Floor 1" (0,0): Dark brown-black hardened resin coating over a metal floor. The resin surface is smooth and glossy with subtle organic texture. The standard hive floor tile. Occasionally a glint of metal shows through thin spots.
  Header "Resin Floor 2" (0,1): Variant resin floor with slightly different organic texture and a few small bumps of hardened secretion. Tiles seamlessly with Resin Floor 1. Slightly thicker resin coating.
  Header "Metal Grating" (0,2): Exposed gunmetal industrial grating — the metal floor before organic takeover. Grid pattern with dark gaps between bars. Clean but cold and industrial.
  Header "Resin-Metal Mix" (0,3): Transition tile — metal grating partially covered by encroaching resin. The organic material creeps across the metal in tendrils. The boundary between civilization and infestation.

ROW 1 — Organic Growth Features:
  Header "Organic Ridge H" (1,0): A raised ridge of hardened organic growth running horizontally across the tile. Dark grey-brown with ribbed texture. The ridge rises from the resin floor like a biological pipeline.
  Header "Organic Ridge V" (1,1): A vertical organic ridge running top to bottom. Same ribbed dark grey-brown texture. These ridges form the structural supports of the hive.
  Header "Ridge Junction" (1,2): A junction where multiple organic ridges meet — an intersection of ribbed growths forming a biomechanical node. Slightly larger mound at the center. A structural nexus.
  Header "Acid Burn" (1,3): Resin floor with acid-green burn marks — sizzling holes melted through the resin and into the metal below. Acid blood residue drips. Evidence of combat or injury. The burn edges glow faintly green.

ROW 2 — Feature Tiles:
  Header "Cocoon Debris" (2,0): Fragments of broken cocoon material scattered on the resin floor — pale grey-white fibrous strands and hardened resin chunks. Someone or something broke free. Disturbing evidence.
  Header "Egg Base" (2,1): The resin floor prepared for egg placement — a shallow depression with a textured organic base. Amber bioluminescent spots mark the prepared area. An egg may have been here or is coming.
  Header "Bioluminescent Patch" (2,2): A patch of the resin floor that glows with dim amber bioluminescence. The organic material pulses with faint light. These patches serve as the hive's lighting system. Warm but unsettling.
  Header "Secretion Pool" (2,3): A small pool of fresh organic secretion on the resin floor — translucent amber-brown liquid with a viscous surface. Fresh resin not yet hardened. The hive is actively growing.

ROW 3 — Hive-to-Metal Edge Transitions:
  Header "Hive-Metal Edge N" (3,0): Organic resin hive floor on the north half transitioning to clean metal grating on the south half. The resin edge creeps outward with tendrils reaching across the metal. The infestation boundary.
  Header "Hive-Metal Edge S" (3,1): Clean metal on the north half, organic hive floor on the south half. Reverse of Edge N. The organic growth is advancing northward.
  Header "Hive-Metal Edge E" (3,2): Hive floor on the east half, metal on the west half. Vertical transition with organic tendrils crossing the boundary.
  Header "Hive-Metal Edge W" (3,3): Metal on the east half, hive floor on the west half. Reverse of Edge E. The clean industrial world giving way to alien biology.`,
    },
    {
      id: 'industrial-grating',
      name: 'Industrial Grating',
      genre: 'Sci-Fi Horror',
      gridSize: '4x4',
      description: 'Metal walkway and utility corridor floor tiles with steam vents, dripping condensation, and cable runs for space station and industrial horror environments.',
      colorNotes: 'Gunmetal grey and dark steel grating, yellow-black hazard stripes, white steam wisps, blue-grey condensation drips, dark cable insulation, amber warning light patches.',
      tileLabels: JSON.stringify([
        'Grating 1', 'Grating 2', 'Solid Plate', 'Diamond Plate',
        'Steam Vent', 'Drain Grate', 'Cable Run H', 'Cable Run V',
        'Hazard Stripe H', 'Hazard Stripe V', 'Access Hatch', 'Condensation Pool',
        'Grating-Plate Edge N', 'Grating-Plate Edge S', 'Grating-Plate Edge E', 'Grating-Plate Edge W'
      ]),
      tileGuidance: `ROW 0 — Base Floor Tiles (seamlessly tileable):
  Header "Grating 1" (0,0): Standard gunmetal grey industrial grating — parallel bars with dark gaps showing pipes and conduits below. The standard corridor floor. Clean but industrial. Slight blue-grey sheen from overhead lighting.
  Header "Grating 2" (0,1): Variant grating with slightly different bar spacing and a few water drops on the surface. Tiles seamlessly with Grating 1. One bar is slightly bent.
  Header "Solid Plate" (0,2): A solid dark steel floor plate — smooth with bolt heads at the corners. Used for heavy equipment areas. No gaps. Darker than the grating.
  Header "Diamond Plate" (0,3): Raised diamond-pattern anti-slip floor plate. The standard industrial anti-slip surface. Subtle texture catch from overhead light. Heavier duty than basic grating.

ROW 1 — Utility Features:
  Header "Steam Vent" (1,0): A circular steam vent grate in the floor — a cloud of white steam wisps rising upward. The vent grate is a circular pattern of holes. The steam partially obscures the surrounding floor. Hot and humid.
  Header "Drain Grate" (1,1): A larger drain grate set into the floor — dark recessed grid with condensation dripping in. Slight rust around the edges. Water collects and drips through the gaps.
  Header "Cable Run H" (1,2): Grating with a bundle of insulated cables running horizontally across the surface. Cables are dark with colored bands at intervals. Secured with metal clamps to the grating.
  Header "Cable Run V" (1,3): Cable bundle running vertically top to bottom across the grating. Same dark insulated cables with clamps. Used for wiring-heavy corridor sections.

ROW 2 — Feature Tiles:
  Header "Hazard Stripe H" (2,0): Floor with a yellow-black hazard stripe band running horizontally across the center. Warning paint on either grating or solid plate. Marks a danger zone boundary.
  Header "Hazard Stripe V" (2,1): Vertical yellow-black hazard stripe running top to bottom. Same industrial warning paint marking a boundary or restricted area.
  Header "Access Hatch" (2,2): A square access hatch in the floor — a hinged plate with a recessed handle and locking mechanism. Yellow-black hazard marking around the edge. Leads to maintenance areas below.
  Header "Condensation Pool" (2,3): Grating with a shallow pool of collected condensation — blue-grey water reflecting overhead lights. The surrounding grating is wet and slightly discolored. Dripping from above.

ROW 3 — Grating-to-Plate Edge Transitions:
  Header "Grating-Plate Edge N" (3,0): Open grating on the north half transitioning to solid plate on the south half. A structural beam marks the boundary. The grating shows pipes below while the plate is sealed.
  Header "Grating-Plate Edge S" (3,1): Solid plate on the north half, grating on the south half. Reverse of Edge N. The transition from sealed to open flooring.
  Header "Grating-Plate Edge E" (3,2): Grating on the east half, solid plate on the west half. Vertical transition with a structural beam.
  Header "Grating-Plate Edge W" (3,3): Solid plate on the east half, grating on the west half. Reverse of Edge E.`,
    },
    {
      id: 'alien-planet-surface',
      name: 'Alien Planet Surface',
      genre: 'Sci-Fi Horror',
      gridSize: '4x4',
      description: 'Hostile extraterrestrial landscape tiles with jagged dark rock, bioluminescent pools, alien vegetation, and toxic atmospheric effects.',
      colorNotes: 'Dark charcoal and purple-black jagged rock, bright cyan-blue bioluminescent pools, alien magenta and teal vegetation, toxic yellow-green atmosphere wisps, pale bone-white mineral deposits.',
      tileLabels: JSON.stringify([
        'Alien Rock 1', 'Alien Rock 2', 'Jagged Formation', 'Smooth Basalt',
        'Bioluminescent Pool', 'Toxic Vent', 'Alien Fungi', 'Tendril Growth',
        'Mineral Deposit', 'Fossil Imprint', 'Spore Cluster', 'Acid Erosion',
        'Rock-Pool Edge N', 'Rock-Pool Edge S', 'Rock-Pool Edge E', 'Rock-Pool Edge W'
      ]),
      tileGuidance: `ROW 0 — Base Rock Tiles (seamlessly tileable):
  Header "Alien Rock 1" (0,0): Dark charcoal alien rock with a subtle purple-black sheen. The texture is unlike earthly stone — angular fractures with glassy smooth surfaces between them. The standard alien ground tile. Cold and lifeless.
  Header "Alien Rock 2" (0,1): Variant alien rock with different fracture pattern and a few pale mineral veins running through the surface. Tiles seamlessly with Alien Rock 1. Slightly more purple tint.
  Header "Jagged Formation" (0,2): Sharp, upward-pointing rock formations jutting from the surface. Dark charcoal spires with crystalline tips. The ground between the formations is rough. Treacherous terrain.
  Header "Smooth Basalt" (0,3): Polished-smooth alien basalt — very dark with a glassy surface reflecting faint light. Unlike rough rock, this surface is eerily perfect. As if melted and resolidified.

ROW 1 — Hazard and Life Tiles:
  Header "Bioluminescent Pool" (1,0): A small pool of bright cyan-blue glowing liquid in a rock depression. The light illuminates the surrounding dark rock. The liquid surface is perfectly still and reflective. Beautiful but of unknown origin.
  Header "Toxic Vent" (1,1): A crack in the alien rock releasing yellow-green toxic gas wisps. The gas rises from below and the rock edges are stained and corroded. The atmosphere is poisonous. Stay clear.
  Header "Alien Fungi" (1,2): Clusters of alien mushroom-like growths sprouting from the rock. Magenta caps with teal bioluminescent gills. Short, thick stalks. Unlike any earthly organism. Possibly dangerous.
  Header "Tendril Growth" (1,3): Dark organic tendrils growing across the rock surface — biomechanical vines that seem to be exploring the terrain. Teal-green with segmented ridges. Are they plant or animal? They pulse faintly.

ROW 2 — Feature Tiles:
  Header "Mineral Deposit" (2,0): A cluster of pale bone-white crystalline minerals erupting from the dark rock. The crystals glow faintly from within. Possibly valuable or possibly a trap. Sharp-edged and geometric.
  Header "Fossil Imprint" (2,1): The dark rock surface shows a large fossil imprint — the outline of an alien creature preserved in stone. Multiple limbs, an elongated skull. Ancient. The shape is disturbingly familiar.
  Header "Spore Cluster" (2,2): Small bioluminescent spore pods scattered across the rock surface. Each pod is a tiny magenta sphere that releases invisible spores. The air above shimmers faintly with released particles.
  Header "Acid Erosion" (2,3): Alien rock that has been eroded by natural acid — smooth, flowing channels cut into the dark surface revealing lighter purple-grey stone beneath. The acid is gone but its marks remain.

ROW 3 — Rock-to-Pool Edge Transitions:
  Header "Rock-Pool Edge N" (3,0): Dark alien rock on the north half transitioning to bioluminescent pool on the south half. The rock edge glows cyan where it meets the luminous liquid. Crystals form at the waterline.
  Header "Rock-Pool Edge S" (3,1): Bioluminescent pool on the north half, alien rock on the south half. Reverse of Edge N. The glowing liquid laps at the dark stone.
  Header "Rock-Pool Edge E" (3,2): Rock on the east half, glowing pool on the west half. Vertical transition with cyan light illuminating the nearby rock face.
  Header "Rock-Pool Edge W" (3,3): Glowing pool on the east half, rock on the west half. Reverse of Edge E. The cyan light creates an eerie glow on the dark stone surface.`,
    },
  ];

  const insert = db.prepare(
    `INSERT OR IGNORE INTO terrain_presets (id, name, genre, grid_size, description, color_notes, tile_labels, tile_guidance, is_preset)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`
  );

  const insertAll = db.transaction(() => {
    for (const p of PRESETS) {
      insert.run(p.id, p.name, p.genre, p.gridSize, p.description, p.colorNotes, p.tileLabels, p.tileGuidance);
    }
  });

  insertAll();
  console.log(`[DB] Seeded ${PRESETS.length} terrain presets.`);

  // Create a grid preset per terrain content preset with real tile labels, then link
  const insertGrid = db.prepare(`
    INSERT OR IGNORE INTO grid_presets (name, sprite_type, genre, grid_size, cols, rows, cell_labels, cell_groups, generic_guidance, bg_mode, is_preset)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
  `);
  const findGrid = db.prepare("SELECT id FROM grid_presets WHERE name = ? AND sprite_type = 'terrain' AND grid_size = ?");
  const insertLink = db.prepare(`
    INSERT OR IGNORE INTO terrain_grid_links (terrain_preset_id, grid_preset_id, guidance_override, sort_order)
    VALUES (?, ?, ?, 0)
  `);
  const TERRAIN_GUIDANCE = `Each cell in the grid has a WHITE TEXT HEADER naming the tile type. All tiles must share the same art style, color palette, and scale. Edge and corner tiles must seamlessly connect with adjacent base tiles. Each row represents a thematic group.`;
  const terrainSizeToDims = { '4x4': [4,4], '3x3': [3,3], '5x5': [5,5] };
  const linkAll = db.transaction(() => {
    for (const p of PRESETS) {
      const [cols, rows] = terrainSizeToDims[p.gridSize] || [4, 4];
      const labels = JSON.parse(p.tileLabels);
      const cellGroups = [];
      for (let r = 0; r < rows; r++) {
        const cells = [];
        for (let c = 0; c < cols; c++) cells.push(r * cols + c);
        cellGroups.push({ name: `Row ${r + 1}`, cells });
      }
      insertGrid.run(p.name, 'terrain', p.genre, p.gridSize, cols, rows,
        p.tileLabels, JSON.stringify(cellGroups), TERRAIN_GUIDANCE, null);
      const gridRow = findGrid.get(p.name, p.gridSize);
      if (gridRow) insertLink.run(p.id, gridRow.id, p.tileGuidance || '');
    }
  });
  linkAll();
  console.log(`[DB] Seeded terrain grid presets + links.`);
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
    {
      id: 'nuclear-sunset-skyline',
      name: 'Nuclear Sunset Skyline',
      genre: 'Post-Apocalyptic',
      gridSize: '1x4',
      bgMode: 'parallax',
      description: 'A ruined city silhouette against an orange-red sky with a mushroom cloud remnant on the horizon. Four parallax layers from irradiated sky to cracked foreground earth.',
      colorNotes: 'Intense orange-red and amber sky, black and dark grey silhouettes, sickly yellow radiation glow, dusty brown earth tones, muted rust and ash grey.',
      layerLabels: JSON.stringify([
        'Irradiated Sky & Mushroom Cloud', 'Ruined City Silhouette', 'Mid-Ground Rubble & Dead Trees', 'Cracked Earth & Debris'
      ]),
      layerGuidance: `LAYER ORDER (top to bottom, farthest to nearest):
  Header "Irradiated Sky & Mushroom Cloud" (0,0): The topmost layer. A dramatic gradient from deep blood-red at the top through intense orange to sickly yellow at the horizon. The remnant of a mushroom cloud dominates the upper right — a towering column of grey-brown smoke and ash spreading into the characteristic mushroom cap. Wispy radioactive clouds glow with unnatural orange-yellow light. Ash particles drift across the sky. Fills the ENTIRE cell. No magenta visible.
  Header "Ruined City Silhouette" (1,0): Distant ruined cityscape in dark silhouette. Broken skyscrapers — some snapped in half, others leaning at precarious angles. Collapsed overpasses and shattered bridge supports. The skyline is jagged and irregular. Fires burn in a few buildings, casting small orange glows. The sunset backlights everything in deep orange-red. Magenta visible at the top where sky shows through. City fills the lower two-thirds.
  Header "Mid-Ground Rubble & Dead Trees" (2,0): Closer devastation. Skeletal dead trees with no leaves, just blackened trunks and bare branches reaching upward. Piles of concrete rubble, twisted rebar, and crushed vehicles. A toppled water tower or radio antenna lies across the scene. Dust hangs in the air catching orange sunset light. Magenta above. Content fills the lower half.
  Header "Cracked Earth & Debris" (3,0): Nearest layer — severely cracked and parched earth. Deep fissures run through sun-baked mud. Scattered debris: a rusted car door, broken concrete chunks, shattered glass, a faded warning sign. Small fires or smoldering embers in debris piles. A radiation hazard symbol partially buried in dirt. Magenta fills the upper two-thirds. Ground detail at the very bottom.`,
    },
    {
      id: 'underground-vault-interior',
      name: 'Underground Vault Interior',
      genre: 'Post-Apocalyptic',
      gridSize: '1x4',
      bgMode: 'parallax',
      description: 'A clean but aging underground survival vault with metal walls, flickering fluorescent lights, and a massive vault door visible in the distance. Four parallax layers from far wall to foreground equipment.',
      colorNotes: 'Cool blue-grey metal surfaces, warm yellow-white fluorescent light, green screen glow from terminals, chrome and brushed steel, faded safety yellow markings.',
      layerLabels: JSON.stringify([
        'Far Wall & Vault Door', 'Mid Equipment & Lockers', 'Foreground Desks & Terminals', 'Floor Details & Overhead Pipes'
      ]),
      layerGuidance: `LAYER ORDER (top to bottom, farthest to nearest):
  Header "Far Wall & Vault Door" (0,0): The topmost/farthest layer. A massive circular vault door dominates the center-left — heavy reinforced steel with a central locking mechanism, partially open revealing a dark corridor beyond. The surrounding wall is riveted metal panels painted institutional blue-grey. A large painted vault number (e.g., "42") beside the door. Fluorescent tube lights along the ceiling cast even white light. A faded "VAULT-TEC" logo on the wall. Fills the ENTIRE cell. No magenta visible.
  Header "Mid Equipment & Lockers" (1,0): Middle distance. Rows of metal lockers along the walls — some open, some dented. Equipment racks hold tools, hazmat suits, and emergency supplies. A water purification unit with gauges and pipes. A bulletin board with faded notices and schedules. Overhead fluorescent lights flicker — one tube is dead, casting a shadow. Magenta visible at the top. Equipment fills the lower two-thirds.
  Header "Foreground Desks & Terminals" (2,0): Work stations with metal desks. Computer terminals display green text on black screens — system status readouts. A desk lamp provides warm pool of light. Scattered papers, coffee mugs, and personal items. A wall-mounted intercom speaker. Safety posters on the wall. Swivel chairs pushed back as if recently vacated. Magenta above. Content fills the lower half.
  Header "Floor Details & Overhead Pipes" (3,0): Nearest layer — the vault floor and low-hanging overhead infrastructure. Metal grate flooring with visible subfloor pipes beneath. Overhead runs of conduit, ventilation ducts, and bundled cables. A floor-standing fan oscillates. Condensation drips from a pipe joint. Yellow caution stripes painted on floor edges. A small puddle reflects the fluorescent light above. Magenta fills the upper two-thirds. Floor detail at the very bottom.`,
    },
    {
      id: 'wasteland-trading-post',
      name: 'Wasteland Trading Post',
      genre: 'Post-Apocalyptic',
      gridSize: '2x2',
      bgMode: 'scene',
      description: 'A scrap-built trading post and market in the wasteland. Four scene variants showing the same location under different conditions — bustling day, quiet day, night with campfire, and abandoned night.',
      colorNotes: 'Dusty earth tones and sun-bleached colors for day, warm orange campfire glow for night, cool blue moonlight, rust browns and faded canvas tans.',
      layerLabels: JSON.stringify([
        'Day - Bustling', 'Day - Quiet',
        'Night - Campfire', 'Night - Abandoned'
      ]),
      layerGuidance: `SCENE DESIGN — Same trading post composition across all 4 variants. Layout: A central open-air market area with scrap-metal stalls and canvas awnings. A converted shipping container serves as the main shop on the right. Strings of salvaged lights hang overhead between poles. A makeshift bar/counter on the left with stools. A guard tower built from scaffolding in the background. Barbed wire perimeter fencing visible at the edges. A hand-painted "TRADE" sign over the entrance.

  Header "Day - Bustling" (0,0): Bright harsh desert sunlight. The trading post is alive with activity — traders displaying scrap goods on tables, a merchant haggling at the counter, armed guards patrolling. Dust kicked up by foot traffic. Canvas awnings provide shade. Goods piled on tables: canned food, ammunition boxes, water jugs, mechanical parts. A pack brahmin (two-headed cow) stands near the entrance. Fill the ENTIRE cell.
  Header "Day - Quiet" (0,1): Same harsh sunlight but the post is nearly empty. Most stalls are closed with tarps pulled down. A single shopkeeper tends the main container store. A lone traveler sits at the bar counter drinking from a canteen. A sleeping dog curls under a table. Wind blows dust across the empty market. An "OPEN" sign creaks on one hinge. Peaceful but desolate.
  Header "Night - Campfire" (1,0): Nighttime with a large campfire burning in the center of the market area. Warm orange firelight illuminates the stalls and faces of a small group gathered around it. A guard silhouetted in the tower against a starry sky. Salvaged string lights glow dimly overhead. Shadows dance on the shipping container walls. Someone plays a makeshift guitar. The bar is lit by a lantern.
  Header "Night - Abandoned" (1,1): Nighttime, no campfire — the trading post appears abandoned. Cool blue moonlight casts long shadows. Stalls are empty, tarps flapping in the wind. The bar stools are knocked over. A tumbleweed rolls through. The guard tower is unmanned. An ominous silence suggested by the stillness. A single flickering light in the container store suggests someone hiding inside. Unsettling and post-apocalyptic.`,
    },
    {
      id: 'hive-interior',
      name: 'Hive Interior',
      genre: 'Sci-Fi Horror',
      gridSize: '1x4',
      bgMode: 'parallax',
      description: 'A vast organic cavern deep within an alien hive. Resin-coated walls, cocooned figures, and warm amber bioluminescence create a nightmarish organic environment. Four parallax layers from distant cavern wall to foreground floor.',
      colorNotes: 'Warm amber and dark honey for bioluminescence, obsidian black and dark brown for organic surfaces, sickly pale flesh tones for cocooned victims, translucent green-yellow for resin, deep purple shadows.',
      layerLabels: JSON.stringify([
        'Far Cavern Wall & Ceiling', 'Mid Resin Walls & Cocooned Figures', 'Near Organic Pillars & Egg Clusters', 'Hive Floor & Foreground Resin'
      ]),
      layerGuidance: `LAYER ORDER (top to bottom, farthest to nearest):
  Header "Far Cavern Wall & Ceiling" (0,0): The topmost/farthest layer. A vast organic cavern stretching into darkness. The ceiling is covered in hardened resin creating rib-like arching structures reminiscent of HR Giger's biomechanical aesthetic. Warm amber bioluminescent patches glow on the distant walls, providing the only light. Organic tubes and sinew-like cables hang from the ceiling. The scale is immense — the cavern walls disappear into shadow. Fills the ENTIRE cell. No magenta visible.
  Header "Mid Resin Walls & Cocooned Figures" (1,0): Middle distance. Closer resin-coated walls with horrifying detail — humanoid figures are partially cocooned in translucent resin, their outlines visible beneath the hardened surface. Some cocoons have been torn open from the inside, leaving empty husks. Thick resin drips down like melting wax. Faint amber light from behind the resin gives it a sickly warm glow. Biomechanical ribbing on the walls. Magenta visible at the top. Content fills the lower two-thirds.
  Header "Near Organic Pillars & Egg Clusters" (2,0): Closer pillars of hardened resin forming organic columns. Between them, clusters of leathery alien eggs rest on the organic floor — ovoid shapes about knee-high, their tops pulsing slightly as if breathing. A faint blue-green mist clings to the ground around the eggs. One egg is partially open, its four flaps peeled back revealing the dark interior. Dripping resin strands connect pillars like organic webbing. Magenta above. Content fills the lower half.
  Header "Hive Floor & Foreground Resin" (3,0): Nearest layer — the hive floor in intimate detail. Hardened organic resin covers everything in ridged, bone-like textures. Remnants of human equipment partially absorbed into the resin — a rifle barrel, a helmet, boot prints fossilized in hardened secretion. A face-hugger corpse lies discarded, its legs curled inward. Small bioluminescent nodes dot the floor providing dim amber light. Acid burn marks scar the resin. Magenta fills the upper two-thirds. Floor detail at the very bottom.`,
    },
    {
      id: 'space-station-breach',
      name: 'Space Station Breach',
      genre: 'Sci-Fi Horror',
      gridSize: '1x4',
      bgMode: 'parallax',
      description: 'A damaged space station corridor with hull breaches showing the void of space. Emergency red lighting, sparking cables, and floating debris create a tense survival horror atmosphere. Four parallax layers from stars through hull to foreground wreckage.',
      colorNotes: 'Deep black space with white stars, harsh red emergency lighting, cool blue-white sparking electricity, dark grey-blue metal hull, amber warning lights, green status screens.',
      layerLabels: JSON.stringify([
        'Space & Stars Through Breach', 'Damaged Hull & Sparking Cables', 'Emergency-Lit Corridor Section', 'Foreground Debris & Warning Signs'
      ]),
      layerGuidance: `LAYER ORDER (top to bottom, farthest to nearest):
  Header "Space & Stars Through Breach" (0,0): The topmost/farthest layer. The cold void of space visible through massive hull breaches in the station. A dense star field with a distant nebula in purple and blue provides an eerie backdrop. The curved edge of a planet or moon is partially visible in the lower portion. Torn metal edges of the hull breach frame the view like jagged teeth. Small debris particles float in zero gravity between the viewer and the stars. The contrast between the serene beauty of space and the violent destruction is unsettling. Fills the ENTIRE cell. No magenta visible.
  Header "Damaged Hull & Sparking Cables" (1,0): The station's outer hull structure visible in cross-section through the breach. Thick metal plating torn and peeled outward by decompression. Bundles of severed cables sparking with blue-white electrical discharge. Coolant pipes leaking crystallizing vapor into the vacuum. Emergency bulkhead doors partially closed but jammed by wreckage. Structural I-beams bent at unnatural angles. Frost forming on metal surfaces near the breach. Magenta visible at the top. Content fills the lower two-thirds.
  Header "Emergency-Lit Corridor Section" (2,0): An intact section of station corridor illuminated only by pulsing red emergency lights. The normal white corridor lighting is dead. Rotating amber warning beacons cast sweeping shadows. Wall-mounted status screens display critical alerts in green text. Floor emergency strips glow a faint white, marking the evacuation path. Motion tracker panels on the walls — some show contacts. The corridor curves away into darkness. Blast doors at the far end are sealed with red warning lights. Magenta above. Content fills the lower half.
  Header "Foreground Debris & Warning Signs" (3,0): Nearest layer — immediate corridor foreground wreckage. Overturned equipment lockers spilling contents — tools, medical supplies, ammunition magazines. A cracked helmet visor lies face-down. Claw marks score the metal floor in parallel grooves. A blood smear trail leads under a collapsed ceiling panel. Emergency signage flashes "HULL BREACH — SECTOR 7" in red. A discarded motion tracker beeps on the floor, its screen showing a cluster of contacts nearby. Acid burn holes in the deck plating. Magenta fills the upper two-thirds. Debris detail at the very bottom.`,
    },
    {
      id: 'alien-landscape',
      name: 'Alien Landscape',
      genre: 'Sci-Fi Horror',
      gridSize: '2x2',
      bgMode: 'scene',
      description: 'A hostile extraterrestrial planet surface with biomechanical megastructures, bioluminescent flora, and dual moons. Four scene variants showing different atmospheric and temporal conditions.',
      colorNotes: 'Dark volcanic rock in charcoal and deep purple, bioluminescent cyan and green accents, pale silver dual moonlight, amber-orange for active megastructures, sickly yellow-green toxic atmosphere.',
      layerLabels: JSON.stringify([
        'Day - Dual Moons Visible', 'Day - Storm',
        'Night - Bioluminescent', 'Night - Megastructure Active'
      ]),
      layerGuidance: `SCENE DESIGN — Same alien landscape composition across all 4 variants. Layout: A rocky alien terrain of dark volcanic stone in the foreground. Jagged crystalline formations jut from the ground at irregular angles on the left. A massive biomechanical megastructure rises in the background center-right — a towering Giger-esque cathedral of organic pipes, skeletal arches, and ribbed columns. Bioluminescent fungi and alien flora dot the mid-ground. Two moons of different sizes hang in the alien sky. A lake of dark, mirror-still liquid reflects the sky in the mid-ground left.

  Header "Day - Dual Moons Visible" (0,0): An alien daylight — the sky is a sickly yellow-green from the toxic atmosphere, brighter near the horizon. Both moons are visible — a large pale silver moon and a smaller reddish one. The megastructure is fully visible in muted grey tones, clearly ancient and dormant. Crystalline formations catch the light and refract it in prismatic patterns. Bioluminescent fungi are dim, barely visible in daylight. The dark lake reflects the yellow-green sky. Sparse alien vegetation — low, creeping tendrils with bulbous nodes. Fill the ENTIRE cell.
  Header "Day - Storm" (0,1): Same landscape under a violent alien storm. The sky churns with dark purple-black clouds shot through with veins of green lightning. Howling winds whip alien dust across the scene. The crystalline formations vibrate, emitting a visible harmonic shimmer. The megastructure's upper reaches disappear into the storm clouds. The lake surface is turbulent with dark waves. Bioluminescent plants glow brighter in the darkness — a stress response. Lightning strikes the megastructure, running down its ribbed columns. Intense and threatening.
  Header "Night - Bioluminescent" (1,0): Nighttime. Both moons are high — the larger moon is full, casting silver light. The sky is deep indigo-black with unfamiliar constellations. The true spectacle: every bioluminescent organism blazes with light. Fungi glow intense cyan-blue. Alien flowers pulse with green-yellow light. Luminescent spores drift through the air like fireflies. The crystalline formations glow from within. The dark lake reflects all the bioluminescence, creating a mirror of colored lights. The megastructure is a dark silhouette against the moonlit sky. Hauntingly beautiful and alien.
  Header "Night - Megastructure Active" (1,1): Nighttime, but the megastructure has awakened. Its organic pipes glow with pulsing amber-orange light from within. Rhythmic pulses travel up its columns like a heartbeat. Steam or vapor vents from its ribbed surfaces. The ground trembles — cracks in the volcanic rock glow with the same amber light. The lake surface ripples from the vibrations, distorting the reflections. Bioluminescent organisms have gone dark, as if in fear. Both moons are partially obscured by the megastructure's emissions. An ominous deep hum is suggested by the visual intensity. Terrifying and awe-inspiring.`,
    },
  ];

  const insert = db.prepare(
    `INSERT OR IGNORE INTO background_presets (id, name, genre, grid_size, bg_mode, description, color_notes, layer_labels, layer_guidance, is_preset)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`
  );

  const insertAll = db.transaction(() => {
    for (const p of PRESETS) {
      insert.run(p.id, p.name, p.genre, p.gridSize, p.bgMode, p.description, p.colorNotes, p.layerLabels, p.layerGuidance);
    }
  });

  insertAll();
  console.log(`[DB] Seeded ${PRESETS.length} background presets.`);

  // Create a grid preset per background content preset with real layer labels, then link
  const insertGrid = db.prepare(`
    INSERT OR IGNORE INTO grid_presets (name, sprite_type, genre, grid_size, cols, rows, cell_labels, cell_groups, generic_guidance, bg_mode, is_preset)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
  `);
  const findGrid = db.prepare("SELECT id FROM grid_presets WHERE name = ? AND sprite_type = 'background' AND grid_size = ?");
  const insertLink = db.prepare(`
    INSERT OR IGNORE INTO background_grid_links (background_preset_id, grid_preset_id, guidance_override, sort_order)
    VALUES (?, ?, ?, 0)
  `);
  const PARALLAX_GUIDANCE = `LAYER ORDER (top to bottom, farthest to nearest): Each cell is one parallax layer. Draw each layer so it tiles horizontally. Layers stack vertically — the top cell is the farthest background, the bottom cell is the nearest foreground. Maintain consistent color palette and art style across all layers. Each layer must fill its ENTIRE cell with no magenta visible.`;
  const SCENE_GUIDANCE = `Each cell in the grid has a WHITE TEXT HEADER naming the scene variant. Draw the same scene/environment in each cell but reflecting the condition described by its header label. Maintain consistent composition, landmark placement, and art style across all cells. Each cell must fill its ENTIRE area with no magenta visible.`;
  const bgSizeToDims = { '1x3': [1,3], '1x4': [1,4], '1x5': [1,5], '2x2': [2,2], '3x2': [3,2], '3x3': [3,3] };
  const linkAll = db.transaction(() => {
    for (const p of PRESETS) {
      const [cols, rows] = bgSizeToDims[p.gridSize] || [1, 4];
      const totalCells = cols * rows;
      const cellGroups = p.bgMode === 'parallax'
        ? [{ name: 'All Layers', cells: Array.from({ length: totalCells }, (_, i) => i) }]
        : (() => {
            const groups = [];
            for (let r = 0; r < rows; r++) {
              const cells = [];
              for (let c = 0; c < cols; c++) cells.push(r * cols + c);
              groups.push({ name: `Row ${r + 1}`, cells });
            }
            return groups;
          })();
      const guidance = p.bgMode === 'parallax' ? PARALLAX_GUIDANCE : SCENE_GUIDANCE;
      insertGrid.run(p.name, 'background', p.genre, p.gridSize, cols, rows,
        p.layerLabels, JSON.stringify(cellGroups), guidance, p.bgMode);
      const gridRow = findGrid.get(p.name, p.gridSize);
      if (gridRow) insertLink.run(p.id, gridRow.id, p.layerGuidance || '');
    }
  });
  linkAll();
  console.log(`[DB] Seeded background grid presets + links.`);
}

function seedIsometricGridPresets(db) {
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

function seedAnimationSeries(db) {
  // Check if any links already exist for these characters + iso grids
  const existing = db.prepare(`
    SELECT COUNT(*) as count FROM character_grid_links cgl
    JOIN grid_presets gp ON gp.id = cgl.grid_preset_id
    WHERE gp.aspect_ratio = '16:9' AND gp.genre = 'Isometric'
  `).get();
  if (existing.count > 0) return;

  const findGrid = db.prepare("SELECT id FROM grid_presets WHERE name = ?");
  const insertLink = db.prepare(`
    INSERT OR IGNORE INTO character_grid_links (character_preset_id, grid_preset_id, guidance_override, sort_order)
    VALUES (?, ?, ?, ?)
  `);

  const SERIES = [
    {
      characterId: 'wasteland-wanderer',
      grids: [
        {
          name: 'Iso Walk Cycle 8\u00d76',
          order: 0,
          guidance: `Walking cautiously through wasteland rubble. Crouched survival posture with spear held diagonally across body for balance. Leather duster coat sways with each step. Goggles on forehead, gas mask bouncing on chest strap. Feet carefully placed to avoid debris. Head constantly scanning left and right. Canteen swings on pack. Dust kicks up slightly from boots on each step.`,
        },
        {
          name: 'Iso Attack Cycle 8\u00d74',
          order: 1,
          guidance: `Rebar spear thrust attack sequence. Wind-up: spear pulled back with both hands, weight on rear foot. Strike: lunging forward with full-body thrust, spear tip leading. Impact: spear extended, slight twist for piercing. Recovery: pulling spear back to ready position, stepping back into defensive stance. Gas mask stays on forehead throughout. Duster flares outward during lunge.`,
        },
        {
          name: 'Iso Idle Cycle 8\u00d74',
          order: 2,
          guidance: `Standing alert in wasteland, scanning the horizon for threats. Spear held vertically in right hand, butt resting on ground. Left hand shading eyes or adjusting goggles. Subtle weight shifts from foot to foot. Occasional glance over shoulder. Breathing visible through slight chest movement. Duster drapes still. Canteen occasionally touched/checked.`,
        },
        {
          name: 'Iso Death Sequence 8\u00d74',
          order: 3,
          guidance: `Collapse from accumulated damage. Hit reaction: staggering backward, spear slipping from grip. Falling: knees buckling, hand reaching for wound. Impact: crumpling to ground on side, duster spreading around body. Final pose: lying face-down with one arm extended, spear fallen nearby, goggles knocked off, gas mask dangling from strap. Canteen spilled.`,
        },
        {
          name: 'Iso Attack Cycle 8\u00d74',
          order: 4,
          guidance: `Special attack: crouch and aim sequence. Frame 1: dropping to one knee from standing, spear shifting to overhand grip. Frame 2: crouched low behind cover (implied), pulling arm back with spear held like a javelin. Frame 3: aiming — body coiled, eyes narrowed through goggles now pulled down over eyes, gas mask hanging. Frame 4: explosive throw — full body extension, spear released in javelin throw, duster billowing from the force. Recovery implied off-sheet. Dust cloud at feet from the sudden movement.`,
        },
      ],
    },
    {
      characterId: 'xenomorph-warrior',
      grids: [
        {
          name: 'Iso Walk Cycle 8\u00d76',
          order: 0,
          guidance: `Predatory stalking movement on all fours transitioning to hunched bipedal. Low to the ground, tail stretched behind for balance, slowly sweeping side to side. Inner jaw occasionally visible through parted outer jaws. Claws extended, fingers splayed for grip. Elongated head tilted slightly as if sensing prey. Exoskeleton gleams with wet sheen. Movement is smooth and deliberate, not rushed.`,
        },
        {
          name: 'Iso Attack Cycle 8\u00d74',
          order: 1,
          guidance: `Lunging claw attack with tail strike follow-up. Wind-up: rearing back on hind legs, arms spread wide, jaws opening. Strike: explosive forward lunge, right claw slashing diagonally. Impact: claws extended at full reach, inner jaw shooting forward. Recovery: tail whips around from behind as secondary attack, then settling back to ready crouch. Acid drool trails from jaws during attack.`,
        },
        {
          name: 'Iso Idle Cycle 8\u00d74',
          order: 2,
          guidance: `Alert hunting stance, perfectly still except for subtle movements. Tail slowly swaying behind like a cat watching prey. Head making small tilting motions, sensing vibrations. Occasional jaw parting slightly revealing inner jaw. Fingers flexing and unflexing. Exoskeleton surface rippling subtly. Drool forming and dropping from lower jaw. Overall impression: coiled spring ready to explode into motion.`,
        },
        {
          name: 'Iso Death Sequence 8\u00d74',
          order: 3,
          guidance: `Acid blood death sequence. Hit: screeching with jaws fully open, body arching backward. Stagger: acid blood spraying from wound, burning ground beneath. Falling: limbs giving way asymmetrically, tail thrashing. Collapse: crumpling with acid pool forming around body. Final pose: curled on side, exoskeleton cracked open, acid still steaming, tail limp, jaws frozen open. Green-yellow acid glow.`,
        },
        {
          name: 'Iso Attack Cycle 8\u00d74',
          order: 4,
          guidance: `Tail strike attack from behind. Frame 1: crouched facing away from target, tail rising high behind the body, barbed tip glinting. Frame 2: tail arcing overhead in a scorpion-like motion, body still low and coiled. Frame 3: tail whipping forward at full extension — the segmented tail stretched to maximum reach, barbed tip driving downward. Frame 4: impact and retract — tail embedded momentarily, acid blood dripping from barb, then pulling back as the creature spins to face the target. Inner jaw visible in a hiss during the spin. Exoskeleton plates shift and flex with the tail movement.`,
        },
      ],
    },
    {
      characterId: 'vault-dweller',
      grids: [
        {
          name: 'Iso Walk Cycle 8\u00d76',
          order: 0,
          guidance: `Purposeful vault-trained walk with military-influenced posture. Upright, shoulders back, laser pistol holstered at hip. Left arm with Pip-Boy slightly raised, green screen glow visible. Blue jumpsuit crisp and clean. Steps are measured and deliberate, trained movement. Yellow stripe visible on jumpsuit sides. Boots have a slight heel click on contact. Head forward, alert but not fearful.`,
        },
        {
          name: 'Iso Attack Cycle 8\u00d74',
          order: 1,
          guidance: `Laser pistol firing sequence from trained hip-fire stance. Wind-up: drawing pistol from holster in smooth motion, left hand steadying Pip-Boy for targeting. Strike: pistol aimed and firing, red laser beam visible from barrel, slight recoil. Impact: follow-through shot, Pip-Boy screen flashing with target data. Recovery: pistol returning to ready position, not holstered. Red laser flash on frames 3-4.`,
        },
        {
          name: 'Iso Idle Cycle 8\u00d74',
          order: 2,
          guidance: `Checking Pip-Boy wrist computer readout while standing guard. Left arm raised to read Pip-Boy screen, green glow illuminating face from below. Right hand resting on holstered pistol. Subtle head movements between checking Pip-Boy and scanning surroundings. Occasional tap on Pip-Boy screen. Jumpsuit creases shift slightly with breathing. Standing at parade rest when not checking device.`,
        },
        {
          name: 'Iso Death Sequence 8\u00d74',
          order: 3,
          guidance: `Clean collapse animation befitting trained vault personnel. Hit: flinching back, hand going to chest wound, Pip-Boy arm dropping. Stagger: pistol falling from holster, knees weakening. Falling: controlled fall to knees first, then sideways. Final pose: lying on back, one hand on chest, Pip-Boy screen still glowing green on outstretched arm, pistol nearby, jumpsuit stained. Eyes closed, peaceful expression.`,
        },
      ],
    },
    {
      characterId: 'biomechanical-entity',
      grids: [
        {
          name: 'Iso Walk Cycle 8\u00d76',
          order: 0,
          guidance: `Mechanical-organic crawling movement blending robotic precision with organic fluidity. Multiple limbs move in unsettling coordination — some metallic, some fleshy. Central mass shifts weight between mechanical legs and organic tendrils. Exposed gears and pistons visible alongside pulsing tissue. Eye cluster tracks independently of body movement. Hydraulic hisses suggested by small steam puffs. Movement is eerily smooth despite the grotesque form.`,
        },
        {
          name: 'Iso Attack Cycle 8\u00d74',
          order: 1,
          guidance: `Tendril lash attack with mechanical precision. Wind-up: organic tendrils coiling back while mechanical arm extends targeting array. Strike: tendrils whipping forward in coordinated bundle, metallic barbs at tips catching light. Impact: tendrils fully extended, sparks flying from mechanical joints powering the strike. Recovery: tendrils retracting and re-coiling, mechanical components resetting with visible gear rotation. Purple bio-energy pulses along tendrils during strike.`,
        },
        {
          name: 'Iso Idle Cycle 8\u00d74',
          order: 2,
          guidance: `Pulsing mechanical-organic idle state. Organic tissue contracts and expands rhythmically like breathing. Mechanical components make small adjustment movements — gears turning, pistons cycling. Tendrils slowly writhe and probe the air. Eye cluster blinks in sequence, not simultaneously. Occasional spark from exposed wiring. Bio-luminescent patches pulse in sync with organic breathing. Steam/vapor vents periodically from cooling systems. Unsettling combination of machine precision and organic restlessness.`,
        },
        {
          name: 'Iso Death Sequence 8\u00d74',
          order: 3,
          guidance: `Component disassembly and system failure cascade. Hit: electrical discharge across body, tendrils spasming. Stagger: mechanical limbs locking at wrong angles, organic parts going limp. Falling: body listing as structural supports fail, components separating. Collapse: mechanical frame crashing down, organic tissue pooling, sparks flying from severed connections. Final pose: scattered wreckage of metal and tissue, eye cluster dimming to dark, last tendril twitching, fluids leaking, small fires on exposed circuitry.`,
        },
      ],
    },
  ];

  const linkAll = db.transaction(() => {
    let linkCount = 0;
    for (const series of SERIES) {
      for (const grid of series.grids) {
        const gridRow = findGrid.get(grid.name);
        if (gridRow) {
          insertLink.run(series.characterId, gridRow.id, grid.guidance, grid.order);
          linkCount++;
        }
      }
    }
    console.log(`[DB] Seeded ${SERIES.length} animation series (${linkCount} grid links).`);
  });

  linkAll();
}
