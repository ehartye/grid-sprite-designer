export function seedGridPresets(db) {
  const existing = db.prepare('SELECT COUNT(*) as count FROM grid_presets').get();
  if (existing.count > 0) return;

  const characterCellLabels = JSON.stringify([
    'Walk South 1','Walk South 2','Walk South 3',
    'Walk North 1','Walk North 2','Walk North 3',
    'Walk West 1','Walk West 2','Walk West 3',
    'Walk East 1','Walk East 2','Walk East 3',
    'Idle South','Idle North','Idle West','Idle East',
    'Battle Idle 1','Battle Idle 2',
    'Battle Idle 3',
    'Attack 1','Attack 2','Attack 3',
    'Special 1','Special 2',
    'Special 3',
    'Damage 1','Damage 2','Damage 3',
    'KO 1','KO 2',
    'KO 3',
    'Victory 1','Victory 2','Victory 3',
    'Weak','Critical'
  ]);

  const characterCellGroups = JSON.stringify([
    { name: 'Walk South Animation Frames', cells: [0,1,2] },
    { name: 'Walk North Animation Frames', cells: [3,4,5] },
    { name: 'Walk West Animation Frames', cells: [6,7,8] },
    { name: 'Walk East Animation Frames', cells: [9,10,11] },
    { name: 'Standard Idle Poses', cells: [12,13,14,15] },
    { name: 'Ready for Battle Idle Animation Frames', cells: [16,17,18] },
    { name: 'Standard Attack Animation Frames', cells: [19,20,21] },
    { name: 'Special Ability Animation Frames', cells: [22,23,24] },
    { name: 'Taking Damage Animation Frames', cells: [25,26,27] },
    { name: 'Knockout Animation Frames', cells: [28,29,30] },
    { name: 'Victory Celebration Animation Frames', cells: [31,32,33] },
    { name: 'Critical and Weak Condition Poses', cells: [34,35] },
  ]);

  const rpgFullOverall = `\
This is an RPG animation sprite sheet.
Throughout the frame descriptions, we'll be using the following terms to indicate which direction the character is facing.
- "South": Down. Downstage. Toward the camera. When a character is "facing south", their full face and torso front are visible.
- "North": Up. Upstage. Away from the camera. When a character is "facing north", the back of their head and back are visible.
- "West": Camera Left. Stage Right. The character's right. When a character is "facing west", their left profile is visible.
- "East": Camera Right. Stage Left. The character's left. When a character is "facing east", their right profile is visible.`;

  const rpgFullGroupGuidance = {
    'Walk South Animation Frames': 'Three frames of the southward (toward camera) walk cycle. Played 1-2-3-2, they produce a natural forward-facing gait.',
    'Walk North Animation Frames': 'Three frames of the northward (away from camera) walk cycle. Played 1-2-3-2, they produce a natural back-facing gait.',
    'Walk West Animation Frames': 'Three frames of the westward (camera-left) walk cycle in profile. Played 1-2-3-2, they produce a natural left-facing gait.',
    'Walk East Animation Frames': 'Three frames of the eastward (camera-right) walk cycle in profile. Played 1-2-3-2, they produce a natural right-facing gait.',
    'Standard Idle Poses': 'Four static idle poses, one for each cardinal direction: south (toward camera), north (away), west (left profile), east (right profile).',
    'Critical and Weak Condition Poses': 'Two status condition poses showing the character in a weakened or near-death state. Both face south.',
    'Standard Attack Animation Frames': 'Three frames of a melee attack sequence facing south: wind-up, mid-swing, follow-through.',
    'Special Ability Animation Frames': 'Three frames of a special/magic ability facing south: casting begins, builds, releases.',
    'Taking Damage Animation Frames': 'Three frames of taking a hit facing south: recoil, stagger, recovery.',
    'Knockout Animation Frames': 'Three frames of being knocked out: collapse, falling, fully down.',
    'Ready for Battle Idle Animation Frames': 'Three frames of a combat-ready idle sway facing south. Looped 1\u21922\u21923\u21922 for a breathing animation.',
    'Victory Celebration Animation Frames': 'Three frames of a victory celebration facing south: leap, arms raised, confident final pose.',
  };

  const rpgFullCellGuidance = {
    'Walk South 1': 'Character faces south, mid-stride, left leg forward and right leg back, right arm forward, left arm back.',
    'Walk South 2': 'Character faces south, legs even and neutral, arms even and neutral.',
    'Walk South 3': 'Character faces south, mid-stride, right leg forward, left leg back, left arm forward, right arm back.',
    'Walk North 1': 'Character faces north, mid-stride, left leg forward and right leg back, arms swinging naturally. Back of head, cape, and back-worn equipment visible.',
    'Walk North 2': 'Character faces north, legs even and neutral, arms at sides. Full back view visible.',
    'Walk North 3': 'Character faces north, mid-stride, right leg forward, left leg back, arms reversed from Walk North 1.',
    'Walk West 1': 'Character faces west in profile, left leg stepping forward, right arm swinging forward.',
    'Walk West 2': 'Character faces west in profile, legs even and neutral, arms at sides.',
    'Walk West 3': 'Character faces west in profile, right leg stepping forward, left arm swinging forward.',
    'Walk East 1': 'Character faces east in profile, right leg stepping forward, left arm swinging forward.',
    'Walk East 2': 'Character faces east in profile, legs even and neutral, arms at sides.',
    'Walk East 3': 'Character faces east in profile, left leg stepping forward, right arm swinging forward.',
    'Idle South': 'Character faces south, standing relaxed, feet slightly apart, arms resting at sides. Default overworld idle pose.',
    'Idle North': 'Character faces north, standing relaxed, same posture as Idle South. Back and back-worn equipment visible.',
    'Idle West': 'Character faces west in profile, standing relaxed, arms at sides.',
    'Idle East': 'Character faces east in profile, standing relaxed, arms at sides.',
    'Battle Idle 1': 'Character faces south in a combat-ready crouch, knees bent, weapon raised in guard position. Frame 1 of idle sway.',
    'Battle Idle 2': 'Character faces south, slight shift from Battle Idle 1 \u2014 shoulders rise slightly, weapon shifts a fraction. Frame 2 of idle sway.',
    'Battle Idle 3': 'Character faces south, shifts back toward Battle Idle 1 position. Frame 3; looped 1\u21922\u21923\u21922 creates a breathing animation.',
    'Attack 1': 'Character faces south, wind-up \u2014 weapon or fist pulled back, body coiled, weight on rear foot, torso twisted.',
    'Attack 2': 'Character faces south, mid-swing \u2014 weapon sweeps forward in an arc, body uncoils, weight transfers to front foot.',
    'Attack 3': 'Character faces south, follow-through \u2014 weapon fully extended past target point, body stretched forward, front foot planted.',
    'Special 1': 'Character faces south, casting begins \u2014 arms rise to chest height, palms open, small energy spark forming between hands.',
    'Special 2': 'Character faces south, casting builds \u2014 arms spread wider, energy grows brighter, posture leans into the spell.',
    'Special 3': 'Character faces south, spell release \u2014 arms thrust forward, energy erupts outward. Effect must be small and contained within cell.',
    'Damage 1': 'Character faces south, hit recoil \u2014 flinches backward, head snaps back, arms jerk inward, one foot lifts off ground.',
    'Damage 2': 'Character faces south, stagger \u2014 leans further back, nearly off-balance, knees bent, arms flailing.',
    'Damage 3': 'Character faces south, recovery \u2014 catches balance, stumbles forward, arms return to guard position.',
    'KO 1': 'Character faces south, collapse begins \u2014 knees buckle, weapon drops, upper body pitches forward, eyes closing.',
    'KO 2': 'Character mostly horizontal, falling \u2014 body hits the ground, one arm outstretched, weapon nearby.',
    'KO 3': 'Character fully down \u2014 lies flat on the ground, eyes closed, weapon beside them, motionless.',
    'Victory 1': 'Character faces south, celebration starts \u2014 leaps upward with fist pump or weapon thrust, joyful expression.',
    'Victory 2': 'Character faces south, mid-celebration \u2014 arms raised overhead in victory gesture, big smile, feet on ground.',
    'Victory 3': 'Character faces south, celebration ends \u2014 strikes a confident final pose, satisfied expression.',
    'Weak': 'Character faces south, low HP \u2014 hunched over, one knee on ground, panting, weapon dragging. Exhausted expression.',
    'Critical': 'Character faces south, near death \u2014 barely standing, leaning on weapon as crutch, trembling. Desperate expression.',
  };

  const insertGrid = db.prepare(`
    INSERT OR IGNORE INTO grid_presets (name, sprite_type, genre, grid_size, cols, rows, cell_labels, cell_groups, overall_guidance, group_guidance, cell_guidance, bg_mode, is_preset)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
  `);

  insertGrid.run(
    'RPG Full', 'character', 'RPG', '6x6', 6, 6,
    characterCellLabels, characterCellGroups,
    rpgFullOverall,
    JSON.stringify(rpgFullGroupGuidance),
    JSON.stringify(rpgFullCellGuidance),
    null,
  );

  // Building, terrain, and background grid presets are created per content preset
  // in their respective seed functions (seedBuildingPresets, seedTerrainPresets,
  // seedBackgroundPresets) so each gets specific cell labels matching the content.

  console.log('[DB] Seeded character grid presets.');
}
