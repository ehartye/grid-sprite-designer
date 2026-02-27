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
  seedPresets(db);
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
  `);
}

function seedPresets(db) {
  const count = db.prepare('SELECT COUNT(*) as cnt FROM character_presets').get().cnt;
  if (count > 0) return;

  const PRESETS = [
    {
      id: 'cecil-paladin',
      name: 'Cecil the Paladin',
      genre: 'Classic Fantasy',
      description: 'A noble paladin with shoulder-length silver-white hair, strong jawline, and piercing blue eyes. Medium athletic build. Stands with confident, upright posture.',
      equipment: 'Ornate white-and-gold plate armor with a blue cape, wielding a holy longsword with a glowing blade. Shield with a sun emblem on his back.',
      colorNotes: 'Silver-white hair, blue eyes. White and gold armor with blue accents. Cape is royal blue with gold trim.',
      rowGuidance: `ROW 0 — Walk Down / Walk Up:
  (0,0) "Walk Down 1" — left foot forward, sword at side, cape swaying right
  (0,1) "Walk Down 2" — neutral standing mid-step, feet together
  (0,2) "Walk Down 3" — right foot forward, mirror of frame 1, cape swaying left
  (0,3) "Walk Up 1" — facing away, cape prominent, left foot forward
  (0,4) "Walk Up 2" — neutral standing mid-step facing away
  (0,5) "Walk Up 3" — right foot forward facing away

ROW 1 — Walk Left & Right:
  (1,0) "Walk Left 1" — facing left, sword in leading hand, shield visible on back
  (1,1) "Walk Left 2" — facing left, neutral contact pose
  (1,2) "Walk Left 3" — facing left, right foot forward
  (1,3) "Walk Right 1" — facing right, sword forward, cape trailing
  (1,4) "Walk Right 2" — facing right, neutral contact pose
  (1,5) "Walk Right 3" — facing right, left foot forward

ROW 2 — Idle & Battle Idle:
  (2,0) "Idle Down" — relaxed standing facing camera, sword at side, cape draped
  (2,1) "Idle Up" — relaxed facing away, cape and shield visible
  (2,2) "Idle Left" — relaxed facing left, sword visible
  (2,3) "Idle Right" — relaxed facing right, cape flowing
  (2,4) "Battle Idle 1" — battle stance, sword raised, shield forward, slight crouch
  (2,5) "Battle Idle 2" — battle stance sway, holy glow on sword

ROW 3 — Battle Idle 3, Attack, Cast:
  (3,0) "Battle Idle 3" — battle stance, cape billowing, frame 3
  (3,1) "Attack 1" — wind-up: sword pulled back over shoulder, body coiled
  (3,2) "Attack 2" — mid-swing: holy sword slashing forward with light trail
  (3,3) "Attack 3" — follow-through: sword fully extended, burst of holy light
  (3,4) "Cast 1" — sword raised overhead, gathering white holy energy
  (3,5) "Cast 2" — casting: eyes glowing white, pillar of light forming

ROW 4 — Cast 3, Damage, KO:
  (4,0) "Cast 3" — spell release: divine light erupting, cape billowing upward
  (4,1) "Damage 1" — hit recoil: flinching backward, shield raised defensively
  (4,2) "Damage 2" — stagger: leaning back, armor dented, pain expression
  (4,3) "Damage 3" — recovery: planting sword for balance, standing back up
  (4,4) "KO 1" — collapsing: knees buckling, sword slipping
  (4,5) "KO 2" — falling: body hitting ground, cape spreading

ROW 5 — KO 3, Victory, Weak/Critical:
  (5,0) "KO 3" — fully down: lying on ground, sword beside body, cape over face
  (5,1) "Victory 1" — raising sword triumphantly, cape flowing
  (5,2) "Victory 2" — sword overhead, holy sparkles erupting
  (5,3) "Victory 3" — confident pose, sword planted in ground, arms crossed
  (5,4) "Weak Pose" — leaning on sword as crutch, one knee down, panting
  (5,5) "Critical Pose" — desperate stance, cracked armor, flickering holy aura`,
    },
    {
      id: 'vivienne-scholar',
      name: 'Vivienne the Scholar',
      genre: 'Classic Fantasy',
      description: 'A studious mage with chin-length dark auburn hair, round spectacles, and warm brown eyes. Petite frame with a thoughtful expression and slightly hunched scholarly posture.',
      equipment: 'Flowing purple robes with gold embroidered runes, carrying a thick leather-bound tome in one hand and a crystal-topped staff in the other. A satchel of scrolls at her hip.',
      colorNotes: 'Dark auburn hair, brown eyes. Deep purple robes with gold trim and rune patterns. Staff crystal is pale violet. Book is brown leather with gold clasps.',
      rowGuidance: `ROW 0 — Walk Down / Walk Up:
  (0,0) "Walk Down 1" — left foot forward, tome tucked under arm, staff in hand
  (0,1) "Walk Down 2" — neutral mid-step, spectacles glinting
  (0,2) "Walk Down 3" — right foot forward, robes swishing
  (0,3) "Walk Up 1" — facing away, satchel visible, left foot forward
  (0,4) "Walk Up 2" — neutral mid-step facing away, runes on robe visible
  (0,5) "Walk Up 3" — right foot forward facing away

ROW 1 — Walk Left & Right:
  (1,0-2) Walk Left frames — tome held close, staff forward, scrolls bouncing
  (1,3-5) Walk Right frames — mirrored, crystal staff leading

ROW 2 — Idle & Battle Idle:
  (2,0-3) Idle directions — reading tome absently, staff resting on shoulder
  (2,4) "Battle Idle 1" — tome open, staff raised, arcane symbols floating
  (2,5) "Battle Idle 2" — pages flipping magically, crystal glowing violet

ROW 3 — Battle Idle 3, Attack, Cast:
  (3,0) "Battle Idle 3" — spectacles pushed up, ready stance
  (3,1) "Attack 1" — staff pulled back, tome snapping shut
  (3,2) "Attack 2" — staff sweeping forward, arcane blast from crystal
  (3,3) "Attack 3" — follow-through, violet energy burst
  (3,4) "Cast 1" — tome floating open, both hands raised, runes circling
  (3,5) "Cast 2" — massive spell circle forming, hair floating upward

ROW 4 — Cast 3, Damage, KO:
  (4,0) "Cast 3" — spell release: beam of violet light from tome
  (4,1-3) Damage — flinching, spectacles askew, scrolls scattering
  (4,4-5) KO start — collapsing over tome protectively

ROW 5 — KO 3, Victory, Weak/Critical:
  (5,0) "KO 3" — lying with tome as pillow, spectacles fallen off
  (5,1-3) Victory — adjusting spectacles smugly, tome snapping shut triumphantly
  (5,4) "Weak Pose" — leaning on staff, tome clutched to chest
  (5,5) "Critical Pose" — barely standing, pages swirling protectively`,
    },
    {
      id: 'kael-thornwood',
      name: 'Kael Thornwood',
      genre: 'Classic Fantasy',
      description: 'A lithe elven ranger with long braided golden hair, pointed ears, and sharp green eyes. Lean athletic build with graceful, balanced stance.',
      equipment: 'Supple forest-green leather armor with a brown hooded cloak, carrying an elegant longbow across his back and a quiver of silver-tipped arrows. A hunting knife at his belt.',
      colorNotes: 'Golden blonde hair, bright green eyes. Forest-green leather with brown cloak and belt. Bow is pale wood with silver inlay. Arrow fletching is emerald green.',
      rowGuidance: `ROW 0 — Walk Down / Walk Up:
  (0,0-2) Walk Down — light elven stride, cloak swaying, bow on back
  (0,3-5) Walk Up — cloak and quiver prominent from behind

ROW 1 — Walk Left & Right:
  (1,0-2) Walk Left — bow visible on back, knife at belt, silent steps
  (1,3-5) Walk Right — mirrored, braided hair trailing

ROW 2 — Idle & Battle Idle:
  (2,0-3) Idle — calm watchful stance, hand near knife, ears perked
  (2,4) "Battle Idle 1" — bow drawn and nocked, arrow ready, crouched
  (2,5) "Battle Idle 2" — slight sway, scanning for targets

ROW 3 — Battle Idle 3, Attack, Cast:
  (3,0) "Battle Idle 3" — arrow tip glinting, bowstring taut
  (3,1) "Attack 1" — drawing bow fully back, eyes narrowed
  (3,2) "Attack 2" — releasing arrow, silver streak trailing
  (3,3) "Attack 3" — follow-through, bow arm extended, arrow flying
  (3,4) "Cast 1" — pulling special arrow from quiver, green energy
  (3,5) "Cast 2" — enchanted arrow nocked, swirling nature magic

ROW 4 — Cast 3, Damage, KO:
  (4,0) "Cast 3" — enchanted arrow released, explosion of vines and thorns
  (4,1-3) Damage — stumbling, cloak torn, arrows scattering
  (4,4-5) KO — bow falling, collapsing into cloak

ROW 5 — KO 3, Victory, Weak/Critical:
  (5,0) "KO 3" — lying in cloak like a blanket, bow beside
  (5,1-3) Victory — spinning an arrow, smirking, bow resting on shoulder
  (5,4) "Weak Pose" — using bow as crutch, panting
  (5,5) "Critical Pose" — last arrow drawn, trembling aim`,
    },
    {
      id: 'chrono-blade',
      name: 'Chrono Blade',
      genre: 'Sci-Fantasy',
      description: 'A time-traveling swordsman with spiky dark blue hair, a determined gaze, and a glowing temporal sigil on his forehead. Athletic build with a dynamic, forward-leaning combat stance.',
      equipment: 'Sleek silver-gray light armor with crimson accents, a flowing red scarf that trails behind him, and a gleaming katana with a clock-gear guard. A small chrono-device on his left wrist.',
      colorNotes: 'Dark blue spiky hair, amber eyes. Silver-gray armor with red accents and scarf. Katana blade has a faint blue temporal glow. Wrist device pulses cyan.',
      rowGuidance: `ROW 0-1: Walk cycles — scarf trailing dynamically, katana sheathed at hip, chrono-device pulsing blue
ROW 2: Idle — hand on katana hilt, scarf drifting. Battle Idle — katana drawn, temporal sigil glowing, afterimage effect
ROW 3: Attack — iaido quickdraw slash with temporal blur trail. Cast — chrono-device activating, time distortion circles
ROW 4: Cast 3 — time freeze burst. Damage — scarf whipping, temporal shield flickering. KO — device sparking, collapsing
ROW 5: KO 3 — lying with fading temporal echoes. Victory — katana flourish, scarf billowing dramatically. Weak/Critical — device malfunctioning, flickering between timeframes`,
    },
    {
      id: 'shadow-weaver',
      name: 'Shadow Weaver',
      genre: 'Dark Fantasy',
      description: 'A stealthy assassin with short-cropped black hair, pale skin, and narrow violet eyes that gleam in darkness. Slim, agile build with a low crouching ready stance.',
      equipment: 'Form-fitting dark leather armor with deep purple trim, a half-face mask covering the lower face, twin curved daggers with serrated edges, and a belt of throwing knives. A dark hooded cloak with a tattered hem.',
      colorNotes: 'Black hair, violet eyes, pale skin. Very dark charcoal leather armor with deep purple accents. Daggers are dark steel with purple gem pommels. Cloak is near-black with purple lining.',
      rowGuidance: `ROW 0-1: Walk cycles — low skulking movement, cloak obscuring body, daggers hidden
ROW 2: Idle — crouched, eyes scanning, hand on dagger. Battle Idle — twin daggers drawn, shadow wisps rising from cloak
ROW 3: Attack — rapid double dagger slash with shadow trail. Cast — melting into shadows, only eyes visible, shadow tendrils
ROW 4: Cast 3 — shadow explosion. Damage — mask cracking, recoiling. KO — dissolving into shadow pool
ROW 5: KO 3 — dark puddle with fading eyes. Victory — flipping daggers, disappearing and reappearing. Weak/Critical — shadow form unstable, flickering`,
    },
    {
      id: 'ignis-pyromancer',
      name: 'Ignis the Pyromancer',
      genre: 'Elemental Fantasy',
      description: 'A fierce fire sorceress with long, wild flame-red hair that seems to flicker at the tips, bright orange eyes, and warm bronze skin. Medium build with an assertive, wide-footed stance.',
      equipment: 'Layered crimson and burnt-orange robes with ember-like particles drifting from the hems, ornate gold bracers on both wrists, and a staff topped with a caged fireball. A fire-opal pendant at her throat.',
      colorNotes: 'Flame-red hair with orange-yellow tips, orange eyes, bronze skin. Crimson and burnt-orange robes. Gold bracers and pendant. Staff fire is bright orange-yellow. Ember particles are orange-red.',
      rowGuidance: `ROW 0-1: Walk cycles — embers trailing from robes and hair tips, staff fire flickering, hair flowing like flames
ROW 2: Idle — embers drifting lazily, hair tips glowing. Battle Idle — staff ablaze, fire orbiting, combat stance with flames at feet
ROW 3: Attack — staff slam creating fire wave. Cast — hair fully aflame, massive fire vortex forming
ROW 4: Cast 3 — meteor-like fireball launch. Damage — flames sputtering, bracers cracking. KO — fires dying out
ROW 5: KO 3 — smoldering on ground, last embers fading. Victory — pillar of fire, triumphant roar. Weak/Critical — flames barely flickering, pendant cracked`,
    },
    {
      id: 'mx-zero',
      name: 'MX-Zero',
      genre: 'Sci-Fi Action',
      description: 'A heroic robot with a rounded blue helmet featuring a red gem on the forehead, expressive green eyes, and a compact humanoid frame. Solid, balanced stance with one arm transformed into a cannon.',
      equipment: 'Sleek blue and cyan armor plating over a dark bodysuit, with white joints and accents. Right arm is a modular arm cannon with a glowing cyan barrel. Armored boots with jet boosters.',
      colorNotes: 'Primary blue armor with cyan highlights. White joint segments and trim. Dark navy bodysuit underneath. Helmet gem is red. Arm cannon glows cyan. Boot jets are orange when active.',
      rowGuidance: `ROW 0-1: Walk cycles — mechanical precise steps, arm cannon at ready, helmet gem pulsing
ROW 2: Idle — scanning mode, cannon lowered. Battle Idle — cannon charged, cyan glow intensifying, targeting reticle in eye
ROW 3: Attack — rapid plasma shots from cannon. Cast — cannon transforming into mega-buster, energy charging
ROW 4: Cast 3 — massive charged shot release. Damage — sparking, armor plates jostled. KO — powering down, eyes dimming
ROW 5: KO 3 — collapsed, eyes dark, faint sparks. Victory — fist pump, cannon raised, jets firing celebration sparks. Weak/Critical — systems failing, static in eyes, cannon flickering`,
    },
    {
      id: 'hayate-ninja',
      name: 'Hayate the Wind Ninja',
      genre: 'Action Platformer',
      description: 'A swift ninja with a dark blue head wrap leaving only sharp grey eyes visible, lean and agile build, always appearing mid-motion even when standing still.',
      equipment: 'Dark blue-black fitted shinobi armor with silver arm guards and shin guards, a long trailing silver-white scarf, a ninjato sword strapped to his back, and shuriken holstered at his waist.',
      colorNotes: 'Dark blue-black armor and head wrap. Grey eyes. Silver-white scarf and metallic silver guards. Ninjato handle is wrapped in dark blue cord. Shuriken are polished steel.',
      rowGuidance: `ROW 0-1: Walk cycles — rapid ninja dash, scarf trailing long, barely touching ground
ROW 2: Idle — arms crossed, scarf drifting in wind. Battle Idle — ninjato drawn, low stance, scarf whipping
ROW 3: Attack — ninjato slash combo with wind streaks. Cast — hand signs, wind vortex forming, shuriken orbiting
ROW 4: Cast 3 — wind blade barrage. Damage — knocked back, scarf tangling. KO — ninjato clattering, falling
ROW 5: KO 3 — face down, scarf draped over body. Victory — vanish and reappear pose, shuriken catch. Weak/Critical — leaning on ninjato, scarf tattered`,
    },
    {
      id: 'sgt-nova',
      name: 'Sgt. Nova',
      genre: 'Sci-Fi Action',
      description: 'A hardened space marine with a full visor helmet showing a green HUD glow, bulky power-armored frame, and a commanding military bearing.',
      equipment: 'Heavy olive-green and gunmetal power armor with reinforced shoulder plates, a large plasma rifle held at the ready, ammo pouches on the belt, and a jet pack module on the back.',
      colorNotes: 'Olive-green primary armor with gunmetal-gray secondary plates. Visor glows green. Plasma rifle has a blue energy cell. Jet pack has orange thruster ports. Belt pouches are dark brown.',
      rowGuidance: `ROW 0-1: Walk cycles — heavy armored march, rifle at ready position, jet pack vents glowing
ROW 2: Idle — parade rest, rifle shouldered. Battle Idle — rifle aimed, visor HUD tracking, knees bent
ROW 3: Attack — rapid plasma bursts, muzzle flash. Cast — calling in orbital strike, wrist hologram display
ROW 4: Cast 3 — orbital beam impact. Damage — armor sparking, stumbling. KO — systems failing, collapsing
ROW 5: KO 3 — armor powered down, visor dark. Victory — rifle raised overhead, jet pack celebration burst. Weak/Critical — cracked visor, leaking coolant, rifle as support`,
    },
    {
      id: 'gel-slime',
      name: 'Gel Slime',
      genre: 'Classic Fantasy',
      description: 'A small, round, translucent blue slime creature with a jiggly gelatinous body. Two large, expressive dark eyes with white highlights sit near the top of its body. A perpetual happy expression with a tiny curved mouth.',
      equipment: '',
      colorNotes: 'Translucent sky-blue body with lighter blue highlights on top and darker blue shadow at the base. Eyes are large and dark with bright white shine spots. A faint inner glow gives it a jewel-like quality.',
      rowGuidance: `ROW 0-1: Walk/bounce cycles — squishing and stretching with each bounce-step, jelly wobble, eyes bouncing
ROW 2: Idle — gentle idle wobble, eyes blinking. Battle Idle — puffing up slightly, determined face, body vibrating
ROW 3: Attack — launching body forward as tackle, stretching. Cast — glowing from within, summoning water droplets
ROW 4: Cast 3 — water splash burst. Damage — flattening on impact, eyes spinning. KO — melting into puddle
ROW 5: KO 3 — flat puddle with fading eyes. Victory — bouncing high, happy sparkles. Weak/Critical — semi-transparent, barely holding shape`,
    },
    {
      id: 'magma-wyrm',
      name: 'Magma Wyrm',
      genre: 'Classic Fantasy',
      description: 'A small but fearsome fire-breathing dragon with molten orange-red scales, two curved horns, a ridged back, and a spiked tail. Bat-like wings folded at its sides. Fierce yellow eyes with slit pupils and an open mouth revealing glowing fangs.',
      equipment: '',
      colorNotes: 'Molten orange-red scales with darker crimson underbelly. Bright yellow-orange cracks between scales suggesting inner magma. Horns and claws are dark charcoal. Wing membranes are deep red. Eyes are fierce yellow. Mouth interior glows orange.',
      rowGuidance: `ROW 0-1: Walk cycles — lumbering reptilian gait, wings folded tight, tail swishing, lava dripping from jaws
ROW 2: Idle — wings twitching, smoke from nostrils. Battle Idle — wings spread, flames licking from mouth, aggressive crouch
ROW 3: Attack — lunging bite with fire breath. Cast — rearing up, scales cracking open to reveal magma beneath
ROW 4: Cast 3 — volcanic eruption from body. Damage — scales cracking, magma leaking. KO — wings crumpling, fire dying
ROW 5: KO 3 — curled up, scales cooling to grey. Victory — roaring with fire plume, wings fully spread. Weak/Critical — magma cooling, cracks dimming, barely glowing`,
    },
    {
      id: 'mosskin-spirit',
      name: 'Mosskin Spirit',
      genre: 'Classic Fantasy',
      description: 'A gentle forest spirit NPC whose body is formed from intertwined bark, leaves, and moss. A rounded head with two large glowing green eyes and a small peaceful smile. Short stubby limbs with leaf-like hands. Small flowers and mushrooms sprout from its shoulders.',
      equipment: '',
      colorNotes: 'Body is mottled brown bark with patches of vibrant green moss. Leaves are various greens from bright lime to deep forest green. Eyes glow soft emerald. Flowers are tiny white and pale yellow. Mushrooms are red with white spots. A faint green aura surrounds it.',
      rowGuidance: `ROW 0-1: Walk cycles — waddling gently, leaves rustling, flowers bobbing, spores drifting
ROW 2: Idle — swaying like a tree in breeze, mushrooms pulsing. Battle Idle — roots spreading from feet, eyes brightening, bark hardening
ROW 3: Attack — vine whip lash, thorns shooting. Cast — communing with nature, forest magic circle of leaves
ROW 4: Cast 3 — massive root eruption. Damage — bark cracking, leaves falling. KO — roots retracting, wilting
ROW 5: KO 3 — collapsed as pile of bark and leaves. Victory — blooming flowers everywhere, happy dance. Weak/Critical — wilting, leaves browning, eyes dimming`,
    },
    {
      id: 'voidmaw-parasite',
      name: 'Voidmaw Parasite',
      genre: 'Sci-Fi Horror',
      description: 'A writhing alien parasite with a segmented, chitinous body that ends in a lamprey-like circular mouth lined with concentric rings of needle-thin teeth. Four hooked appendages on each side used for latching onto hosts. A pulsing translucent sac on its back reveals dark fluid inside. Two vestigial eye-stalks protrude from the head segment.',
      equipment: '',
      colorNotes: 'Oily black chitin with iridescent purple-green sheen. Mouth interior is raw pinkish-red. Back sac is translucent milky grey with dark violet fluid. Eye-stalks tip with dull yellow bioluminescent orbs. Hooked legs are dark gunmetal with rust-red tips.',
      rowGuidance: `ROW 0-1: Walk cycles — undulating slither, hooks scraping, sac pulsing rhythmically
ROW 2: Idle — coiled, eye-stalks scanning. Battle Idle — rearing up, mouth opening, hooks spread wide
ROW 3: Attack — lunging latch, hooks clamping, mouth drilling. Cast — sac swelling, releasing toxic cloud
ROW 4: Cast 3 — acid spray from mouth. Damage — chitin cracking, fluid leaking. KO — curling inward, hooks twitching
ROW 5: KO 3 — shriveled husk. Victory — rearing triumphantly, sac glowing. Weak/Critical — hooks limp, sac deflated, barely moving`,
    },
    {
      id: 'fluxbot-drone',
      name: 'Fluxbot Drone',
      genre: 'Sci-Fi',
      description: 'A small hovering maintenance drone with a spherical chrome body, a single large blue optical lens, and three articulated tool-arms folding neatly underneath. Two anti-gravity fins rotate slowly on either side. A ring of status LEDs encircles its equator. Friendly and curious demeanor despite being fully mechanical.',
      equipment: '',
      colorNotes: 'Polished chrome body with brushed steel panels. Main lens is bright cyan-blue with a white focal point. Anti-grav fins are matte dark grey with cyan edge lighting. LED ring cycles through soft blue and green. Tool-arms are gunmetal with orange safety markings at the joints.',
      rowGuidance: `ROW 0-1: Walk/hover cycles — bobbing gently, fins rotating, LED ring pulsing, slight tilt in movement direction
ROW 2: Idle — hovering, lens focusing, curious head tilt. Battle Idle — lens turning red, tool-arms deploying, defensive stance
ROW 3: Attack — tool-arm laser beam, arc welder attack. Cast — scanning beam, deploying repair nanobots
ROW 4: Cast 3 — EMP burst from LED ring. Damage — sparking, spinning off-axis, lens cracking. KO — power failing, dropping
ROW 5: KO 3 — crashed on ground, lens dark, sparking. Victory — happy beeps, spinning, lens forming heart shape. Weak/Critical — low power, lens flickering, fins stuttering`,
    },
    {
      id: 'spore-lurker',
      name: 'Spore Lurker',
      genre: 'Sci-Fi Horror',
      description: 'A fungal alien organism that resembles a crouching mass of fleshy tendrils topped with a cluster of bulbous spore pods. No visible eyes — instead it senses via vibration through fine cilia covering its surface. When threatened, the pods swell and release clouds of toxic green spores. Moves with an unsettling undulating crawl.',
      equipment: '',
      colorNotes: 'Fleshy pale mauve and grey tendrils with sickly yellow-green veining. Spore pods are swollen dark purple with bright toxic-green tips that glow faintly. Cilia are near-white and shimmer slightly. Underside is wet-looking dark reddish-brown.',
      rowGuidance: `ROW 0-1: Walk cycles — undulating crawl, tendrils pulling forward, spore pods swaying, cilia rippling
ROW 2: Idle — pulsing slowly, pods dormant. Battle Idle — pods swelling, cilia standing erect, tendrils spreading
ROW 3: Attack — tendril whip lash, pods bursting. Cast — massive spore cloud building
ROW 4: Cast 3 — toxic spore explosion. Damage — tendrils recoiling, pods popping. KO — collapsing, tendrils going limp
ROW 5: KO 3 — deflated mass, spores settling. Victory — pods pulsing triumphantly, new growth. Weak/Critical — dried out, pods empty, cilia wilting`,
    },
    {
      id: 'arc-jelly',
      name: 'Arc Jelly',
      genre: 'Sci-Fi',
      description: 'A bioluminescent deep-space jellyfish creature with a translucent dome-shaped bell and long trailing tentacles that crackle with electrical arcs. Inside the bell, a dense cluster of neural filaments pulses with light. Drifts gracefully through zero-gravity environments. Peaceful unless provoked, at which point its tentacles discharge powerful electric shocks.',
      equipment: '',
      colorNotes: 'Bell is translucent pale blue-white with a soft inner glow. Neural filaments pulse between electric blue and bright white. Tentacles are near-transparent with vivid cyan-to-violet electrical arcs running along their length. Outer bell rim has a faint pink-magenta bioluminescent edge.',
      rowGuidance: `ROW 0-1: Walk/drift cycles — gentle pulsing bell propulsion, tentacles trailing gracefully, arcs flickering
ROW 2: Idle — floating, tentacles swaying, gentle glow. Battle Idle — bell contracting, arcs intensifying, defensive posture
ROW 3: Attack — tentacle shock lash, lightning discharge. Cast — neural overload, massive charge building
ROW 4: Cast 3 — chain lightning storm. Damage — bell distorting, arcs sputtering. KO — deflating, tentacles tangling
ROW 5: KO 3 — translucent heap, fading glow. Victory — brilliant light show, arcs dancing. Weak/Critical — dim glow, arcs barely visible, tentacles limp`,
    },
    {
      id: 'rustback-scavenger',
      name: 'Rustback Scavenger',
      genre: 'Post-Apocalyptic Sci-Fi',
      description: 'A six-legged insectoid scavenger built from salvaged mechanical parts fused with organic tissue. Its body is a corroded metal thorax with exposed wiring and a biological abdomen. A pair of mismatched optical sensors serve as eyes — one is a cracked red camera lens, the other a repurposed green scanner. Mandibles fashioned from sharpened scrap metal click constantly.',
      equipment: '',
      colorNotes: 'Corroded burnt-orange and rust-brown metal plating over sickly grey-green organic tissue. Wiring is faded yellow and red. Camera-eye glows dim red, scanner-eye glows green. Mandibles are dull gunmetal. Legs alternate between rusted mechanical joints and pale fleshy segments. Abdomen has a faint sickly yellow bioluminescence.',
      rowGuidance: `ROW 0-1: Walk cycles — skittering six-legged gait, mandibles clicking, mismatched eyes scanning, wires bouncing
ROW 2: Idle — mandibles twitching, scanning. Battle Idle — rearing up on back legs, mandibles wide, eyes flashing
ROW 3: Attack — mandible snap, acid spit from abdomen. Cast — abdomen glowing, spawning mini-drones
ROW 4: Cast 3 — swarm burst. Damage — plates buckling, wires sparking. KO — legs folding, crashing down
ROW 5: KO 3 — upside down, legs twitching. Victory — clicking mandibles, eyes bright. Weak/Critical — legs failing, dragging body, one eye dark`,
    },
  ];

  const insert = db.prepare(
    `INSERT INTO character_presets (id, name, genre, description, equipment, color_notes, row_guidance, is_preset)
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
