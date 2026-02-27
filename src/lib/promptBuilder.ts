/**
 * Build the grid-fill prompt for Gemini.
 * Combines the template structure instructions with character-specific details.
 */

export interface CharacterConfig {
  name: string;
  description: string;
  equipment: string;
  colorNotes: string;
  styleNotes: string;
  rowGuidance: string;
}

const GENERIC_ROW_GUIDANCE = `\
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

/**
 * Build the full prompt that tells Gemini how to fill the 6×6 grid template.
 */
export function buildGridFillPrompt(character: CharacterConfig): string {
  const charBlock = [
    `Fill every pink cell area with an SNES-era 16-bit pixel-art sprite of a`,
    `${character.name.toUpperCase()} character.`,
    ``,
    `Character appearance: ${character.description}`,
    character.equipment ? `Equipment: ${character.equipment}` : '',
    character.colorNotes ? `Color palette: ${character.colorNotes}` : '',
    character.styleNotes ? `Additional style notes: ${character.styleNotes}` : '',
    ``,
    `  • Style reference: Final Fantasy VI / Chrono Trigger overworld + battle sprites`,
    `  • Consistent proportions and palette across ALL 36 cells`,
  ].filter(Boolean).join('\n');

  const characterGuidance = character.rowGuidance.trim()
    ? `\nCHARACTER-SPECIFIC POSE NOTES (use these to refine each cell):\n${character.rowGuidance.trim()}\n`
    : '';

  return `\
You are filling in a sprite sheet template. The attached image is a 6×6 grid
(36 cells) on a bright magenta (#FF00FF) chroma-key background. Each cell has
a thin black header strip with white text labeling the pose. You MUST preserve
every header strip and its text exactly as-is — do not erase, move, or redraw
them.

${charBlock}

Keep the magenta #FF00FF background behind each sprite for chroma keying.
Do NOT draw outside the cell boundaries or over the black grid lines.

CENTERING IS CRITICAL: Every sprite must be precisely centered both
horizontally and vertically within its cell's pink content area (below the
header strip). The character's feet should rest at a consistent baseline
roughly 80% down the cell, and the sprite should be horizontally centered
with equal pink space on the left and right. Standing poses should all share
the same vertical baseline so they tile cleanly. Even action poses (attack
swings, casting, damage recoil) must keep the character's center of mass
near the middle of the cell — do not let poses drift to the edges. KO/lying
poses should be centered horizontally even though they are low to the ground.

FULL BODY VISIBILITY: The character's ENTIRE body — head to toe — must be
fully visible within every cell. No part of the sprite (head, feet, weapon,
hat, cape, tail, wings) may be clipped or cut off by the cell boundary.
Scale the sprite small enough to fit comfortably with a margin of pink
background on all sides. Shadows, spell effects, energy auras, weapon
trails, and any ability VFX must also stay fully contained within the cell
— they must NOT touch, overlap, or push up against the cell edges or bleed
into adjacent cells. If an effect would be too large to fit, make it
smaller or omit it rather than letting it crowd the boundaries.

Below is the exact layout. Each entry begins with the HEADER text printed in
that cell — use it to identify which cell you are filling. The (row, col)
coordinates are 0-indexed. Every sprite must match its header's pose exactly.

${GENERIC_ROW_GUIDANCE}
${characterGuidance}
Return the completed sprite sheet as a single image. Preserve ALL header text exactly.`;
}
