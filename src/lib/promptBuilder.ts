/**
 * Build the grid-fill prompt for Gemini.
 * Combines the template structure instructions with character-specific details.
 */

export interface CharacterConfig {
  name: string;
  description: string;
  styleNotes: string;
}

/**
 * Build the full prompt that tells Gemini how to fill the 6×6 grid template.
 */
export function buildGridFillPrompt(character: CharacterConfig): string {
  return `\
You are filling in a sprite sheet template. The attached image is a 6×6 grid
(36 cells) on a bright magenta (#FF00FF) chroma-key background. Each cell has
a thin black header strip with white text labeling the pose. You MUST preserve
every header strip and its text exactly as-is — do not erase, move, or redraw
them.

Fill every pink cell area with an SNES-era 16-bit pixel-art sprite of a
${character.name.toUpperCase()} character. The character design:
${character.description}
${character.styleNotes ? `\nAdditional style notes: ${character.styleNotes}` : ''}
  • Style reference: Final Fantasy VI / Chrono Trigger overworld + battle sprites
  • Consistent proportions and palette across ALL 36 cells

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

Below is the exact layout with a description of what each cell should depict.
Row and column numbers are 0-indexed (row, col).

ROW 0 — Walk Down (top-down overworld, character facing the camera):
  (0,0) "Walk Down 1" — left foot forward, arms at sides
  (0,1) "Walk Down 2" — neutral standing mid-step, feet together (contact pose)
  (0,2) "Walk Down 3" — right foot forward, mirror of frame 1
  (0,3) "Walk Up 1"   — character facing away, left foot forward
  (0,4) "Walk Up 2"   — neutral standing mid-step facing away
  (0,5) "Walk Up 3"   — right foot forward facing away, mirror of frame 1

ROW 1 — Walk Left & Right (top-down overworld, side views):
  (1,0) "Walk Left 1"  — facing left, left foot forward
  (1,1) "Walk Left 2"  — facing left, neutral contact pose
  (1,2) "Walk Left 3"  — facing left, right foot forward
  (1,3) "Walk Right 1" — facing right, right foot forward
  (1,4) "Walk Right 2" — facing right, neutral contact pose
  (1,5) "Walk Right 3" — facing right, left foot forward

ROW 2 — Idle & Battle Idle:
  (2,0) "Idle Down"     — relaxed standing pose facing camera, weight centered
  (2,1) "Idle Up"       — relaxed standing pose facing away
  (2,2) "Idle Left"     — relaxed standing pose facing left
  (2,3) "Idle Right"    — relaxed standing pose facing right
  (2,4) "Battle Idle 1" — side-view battle stance, slight crouch, frame 1
  (2,5) "Battle Idle 2" — battle stance with subtle breathing/sway, frame 2

ROW 3 — Battle Idle 3, Attack sequence, Cast start:
  (3,0) "Battle Idle 3" — battle stance sway, frame 3 (loops back to frame 1)
  (3,1) "Attack 1"      — wind-up: arm/weapon pulled back, body coiled
  (3,2) "Attack 2"      — mid-swing: weapon sweeping forward
  (3,3) "Attack 3"      — follow-through: weapon fully extended
  (3,4) "Cast 1"        — arms raised, gathering energy
  (3,5) "Cast 2"        — casting: eyes glowing, energy swirling

ROW 4 — Cast 3, Damage, KO:
  (4,0) "Cast 3"   — spell release: energy erupting
  (4,1) "Damage 1" — hit recoil: flinching backward
  (4,2) "Damage 2" — stagger: leaning further back, pain expression
  (4,3) "Damage 3" — recovery: stumbling forward catching balance
  (4,4) "KO 1"     — collapsing: knees buckling
  (4,5) "KO 2"     — falling: body hitting the ground

ROW 5 — KO 3, Victory, Weak/Critical:
  (5,0) "KO 3"          — fully down: lying flat, eyes closed
  (5,1) "Victory 1"     — celebration start: jumping up triumphantly
  (5,2) "Victory 2"     — mid-celebration: overhead gesture
  (5,3) "Victory 3"     — celebration end: confident pose
  (5,4) "Weak Pose"     — hunched over, one knee on ground, panting, low HP
  (5,5) "Critical Pose" — desperate stance, near death

Return the completed sprite sheet as a single image. Preserve ALL header text exactly.`;
}
