/**
 * ABC Prompt Engineering Test
 *
 * Generates 3 variations of prompt strategy × 3 runs each = 9 total generations.
 * All use the same character preset (Cecil the Paladin) and template image.
 *
 * Variant A — "Baseline": Current prompt as-is
 * Variant B — "Concise":  Shorter prompt, fewer constraints, trusts the model more
 * Variant C — "Structured": System-instruction style with numbered rules + XML-like sections
 *
 * Usage:
 *   1. Start the dev server: npm run dev
 *   2. Run: node scripts/abc-prompt-test.js
 *
 * Results are saved to output/abc-test/ with folder names like:
 *   A1_cecil-the-paladin_20260301-150000/
 *   B2_cecil-the-paladin_20260301-150100/
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { mkdirSync, writeFileSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const OUTPUT_DIR = join(ROOT, 'output', 'abc-test');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) {
  console.error('GEMINI_API_KEY not set in .env.local');
  process.exit(1);
}

const MODEL = 'nano-banana-pro-preview';
const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const IMAGE_SIZE = '2K';
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 3000;

// ── Character: Cecil the Paladin ──────────────────────────────────────────

const CECIL = {
  name: 'Cecil the Paladin',
  description: 'A noble paladin with shoulder-length silver-white hair, strong jawline, and piercing blue eyes. Medium athletic build. Stands with confident, upright posture.',
  equipment: 'Ornate white-and-gold plate armor with a blue cape, wielding a holy longsword with a glowing blade. Shield with a sun emblem on his back.',
  colorNotes: 'Silver-white hair, blue eyes. White and gold armor with blue accents. Cape is royal blue with gold trim.',
  styleNotes: '',
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
};

// ── Generic row guidance (shared) ──────────────────────────────────────────

const GENERIC_ROW_GUIDANCE = `\
Each cell in the grid has a WHITE TEXT HEADER that names the pose. Match each
cell's sprite to the header label printed above it. The labels and their
required poses are listed below by row.

ROW 0 — Walk Down & Walk Up (top-down RPG overworld perspective):
  Header "Walk Down 1" (0,0): Character faces the camera, mid-stride with the left leg forward and right leg back. Arms swing naturally.
  Header "Walk Down 2" (0,1): Contact pose — feet together, weight centered, arms at sides.
  Header "Walk Down 3" (0,2): Mirror of Walk Down 1. Right leg forward, left leg back.
  Header "Walk Up 1" (0,3): Character faces AWAY from the camera. Left leg forward.
  Header "Walk Up 2" (0,4): Facing away, contact pose — feet together, arms at sides.
  Header "Walk Up 3" (0,5): Facing away, right leg forward — mirror of Walk Up 1.

ROW 1 — Walk Left & Walk Right (side-view):
  Header "Walk Left 1" (1,0): Side profile facing left, left foot forward in stride.
  Header "Walk Left 2" (1,1): Facing left, contact pose — feet together.
  Header "Walk Left 3" (1,2): Facing left, right foot forward.
  Header "Walk Right 1" (1,3): Side profile facing right, right foot forward.
  Header "Walk Right 2" (1,4): Facing right, contact pose.
  Header "Walk Right 3" (1,5): Facing right, left foot forward.

ROW 2 — Idle & Battle Idle:
  Header "Idle Down" (2,0): Relaxed standing facing camera.
  Header "Idle Up" (2,1): Relaxed standing facing away.
  Header "Idle Left" (2,2): Relaxed standing facing left.
  Header "Idle Right" (2,3): Relaxed standing facing right.
  Header "Battle Idle 1" (2,4): Combat-ready crouch, weapon raised.
  Header "Battle Idle 2" (2,5): Subtle sway/breathing frame from Battle Idle 1.

ROW 3 — Battle Idle 3, Attack, Cast:
  Header "Battle Idle 3" (3,0): Third idle sway frame.
  Header "Attack 1" (3,1): Wind-up, weapon pulled back.
  Header "Attack 2" (3,2): Mid-swing.
  Header "Attack 3" (3,3): Follow-through.
  Header "Cast 1" (3,4): Arms rise, small energy glow starts.
  Header "Cast 2" (3,5): Energy builds, posture leans into spell.

ROW 4 — Cast 3, Damage, KO:
  Header "Cast 3" (4,0): Spell release — energy erupts.
  Header "Damage 1" (4,1): Hit recoil — flinch backward.
  Header "Damage 2" (4,2): Stagger — further off-balance.
  Header "Damage 3" (4,3): Recovery — regaining balance.
  Header "KO 1" (4,4): Collapse begins — knees buckle.
  Header "KO 2" (4,5): Falling — body hitting ground.

ROW 5 — KO 3, Victory, Status:
  Header "KO 3" (5,0): Fully down, lying flat.
  Header "Victory 1" (5,1): Celebration — fist pump / weapon thrust.
  Header "Victory 2" (5,2): Arms raised in victory.
  Header "Victory 3" (5,3): Confident final pose.
  Header "Weak Pose" (5,4): Low HP — hunched, panting.
  Header "Critical Pose" (5,5): Near death — barely standing.`;

// ── Prompt Variants ────────────────────────────────────────────────────────

function buildVariantA(character) {
  // BASELINE — current production prompt (from promptBuilder.ts)
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

function buildVariantB(character) {
  // CONCISE — shorter, less repetitive, trusts the model more
  return `\
Fill this 6×6 sprite sheet template. Each cell has a black header strip naming the pose.

Character: ${character.name.toUpperCase()}
Appearance: ${character.description}
Equipment: ${character.equipment}
Colors: ${character.colorNotes}
Style: SNES 16-bit pixel art (Final Fantasy VI / Chrono Trigger)

Rules:
1. Preserve all black header strips and white text exactly
2. Keep magenta #FF00FF background in every cell
3. Stay within cell boundaries — no bleeding into adjacent cells
4. Center every sprite horizontally, feet at ~80% down
5. Full body visible head-to-toe in every cell — scale down if needed
6. Consistent character proportions and palette across all 36 cells
7. Match each sprite's pose to its cell's header label

${GENERIC_ROW_GUIDANCE}

CHARACTER-SPECIFIC POSE NOTES:
${character.rowGuidance.trim()}

Return the completed sprite sheet as a single image.`;
}

function buildVariantC(character) {
  // STRUCTURED — XML-like sections, numbered priority rules, explicit DO/DON'T
  return `\
<task>Fill the attached 6×6 sprite sheet template image with pixel-art sprites.</task>

<character>
  <name>${character.name.toUpperCase()}</name>
  <appearance>${character.description}</appearance>
  <equipment>${character.equipment}</equipment>
  <colors>${character.colorNotes}</colors>
  <style>SNES 16-bit pixel art, Final Fantasy VI / Chrono Trigger era</style>
</character>

<rules priority="critical">
  1. PRESERVE every black header strip and its white text label exactly as-is
  2. KEEP the bright magenta #FF00FF chroma-key background behind every sprite
  3. STAY within cell boundaries — sprites, effects, and weapons must NOT touch or cross black grid lines
  4. SHOW the character's ENTIRE body (head to toe) in every cell — scale smaller if needed
  5. CENTER every sprite: horizontally centered with equal margins, feet at a consistent baseline ~80% down the cell
</rules>

<rules priority="important">
  6. CONSISTENT character appearance, proportions, and color palette across all 36 cells
  7. MATCH each sprite's pose exactly to the header label printed in that cell
  8. Walk frames must share the same height and baseline for clean animation tiling
  9. Spell effects and weapon trails must be SMALL and fully contained within the cell
</rules>

<do_not>
  - Do NOT erase, move, or redraw header strips
  - Do NOT draw over the black grid lines
  - Do NOT let any part of the sprite (cape, weapon, hat, wings) get clipped by cell edges
  - Do NOT let effects bleed into adjacent cells
</do_not>

<layout>
${GENERIC_ROW_GUIDANCE}
</layout>

<character_poses>
${character.rowGuidance.trim()}
</character_poses>

Return the completed sprite sheet as a single image. Preserve ALL header text exactly.`;
}

// ── Gemini API ─────────────────────────────────────────────────────────────

async function callGemini(templateBase64, prompt, retries = 0) {
  const url = `${GEMINI_BASE}/${MODEL}:generateContent`;

  const body = {
    contents: [{
      parts: [
        { inline_data: { mime_type: 'image/png', data: templateBase64 } },
        { text: prompt },
      ],
    }],
    generationConfig: {
      responseModalities: ['TEXT', 'IMAGE'],
      temperature: 1.0,
      imageConfig: { aspectRatio: '1:1', imageSize: IMAGE_SIZE },
    },
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': GEMINI_API_KEY,
    },
    body: JSON.stringify(body),
  });

  if (response.status === 429 && retries < MAX_RETRIES) {
    const delay = BASE_DELAY_MS * Math.pow(2, retries);
    console.log(`  Rate limited (429). Retrying in ${delay / 1000}s...`);
    await new Promise(r => setTimeout(r, delay));
    return callGemini(templateBase64, prompt, retries + 1);
  }

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(`Gemini ${response.status}: ${err?.error?.message || 'Unknown error'}`);
  }

  const data = await response.json();
  const finishReason = data?.candidates?.[0]?.finishReason;
  if (finishReason === 'SAFETY' || finishReason === 'BLOCKED') {
    throw new Error('Content filtered by safety settings');
  }

  const parts = data?.candidates?.[0]?.content?.parts ?? [];
  let image = null;
  let text = '';
  for (const part of parts) {
    if (part.text) text += part.text;
    if (part.inlineData) image = part.inlineData;
  }

  return { text, image };
}

// ── Main ───────────────────────────────────────────────────────────────────

async function main() {
  // Get template from running dev server
  console.log('Fetching template from dev server...');
  let templateBase64;
  try {
    const resp = await fetch('http://localhost:5174/api/generate-grid', { method: 'OPTIONS' });
    // Server is up — generate template via the app
  } catch {
    console.error('Dev server not running. Start it with: npm run dev');
    process.exit(1);
  }

  // Generate template by calling the app's template generator via the test harness
  // Actually, we can just create a minimal template ourselves using the dev server
  // Or better: grab a pre-generated template from test-fixtures
  // Simplest: hit the dev server's static files and use Playwright to generate one
  // Actually simplest: just use the extraction harness to get a template

  // Let's generate the template by making a quick fetch to the running server
  // We'll grab it from the test page
  console.log('Generating template image via Playwright...');

  const { chromium } = await import('playwright');
  const browser = await chromium.launch();
  const page = await browser.newPage();

  await page.goto('http://localhost:5174', { waitUntil: 'networkidle', timeout: 15000 });

  // Generate template via browser canvas
  templateBase64 = await page.evaluate(() => {
    // Import and run template generator
    const { generateTemplate, CONFIG_2K } = window.__modules?.templateGenerator || {};
    if (generateTemplate) {
      return generateTemplate(CONFIG_2K).base64;
    }

    // Fallback: create canvas manually
    const COLS = 6, ROWS = 6;
    const cellW = 339, cellH = 339, headerH = 14, border = 2, fontSize = 9;
    const labels = [
      "Walk Down 1","Walk Down 2","Walk Down 3","Walk Up 1","Walk Up 2","Walk Up 3",
      "Walk Left 1","Walk Left 2","Walk Left 3","Walk Right 1","Walk Right 2","Walk Right 3",
      "Idle Down","Idle Up","Idle Left","Idle Right","Battle Idle 1","Battle Idle 2",
      "Battle Idle 3","Attack 1","Attack 2","Attack 3","Cast 1","Cast 2",
      "Cast 3","Damage 1","Damage 2","Damage 3","KO 1","KO 2",
      "KO 3","Victory 1","Victory 2","Victory 3","Weak Pose","Critical Pose"
    ];

    const w = COLS * cellW + (COLS + 1) * border;
    const h = ROWS * cellH + (ROWS + 1) * border;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');

    // Black background (grid lines)
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, w, h);

    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        const x = col * (cellW + border) + border;
        const y = row * (cellH + border) + border;

        // Magenta content area
        ctx.fillStyle = '#FF00FF';
        ctx.fillRect(x, y, cellW, cellH);

        // Black header strip
        ctx.fillStyle = '#000000';
        ctx.fillRect(x, y, cellW, headerH);

        // White header text
        ctx.fillStyle = '#FFFFFF';
        ctx.font = `${fontSize}px monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const label = labels[row * COLS + col];
        ctx.fillText(label, x + cellW / 2, y + headerH / 2);
      }
    }

    return canvas.toDataURL('image/png').split(',')[1];
  });

  await browser.close();
  console.log(`Template generated (${(templateBase64.length / 1024).toFixed(0)}KB base64)\n`);

  // Define variants
  const variants = [
    { id: 'A', name: 'Baseline', builder: buildVariantA },
    { id: 'B', name: 'Concise', builder: buildVariantB },
    { id: 'C', name: 'Structured', builder: buildVariantC },
  ];

  const RUNS_PER_VARIANT = 3;
  mkdirSync(OUTPUT_DIR, { recursive: true });

  for (const variant of variants) {
    const prompt = variant.builder(CECIL);

    // Save prompt text for reference
    writeFileSync(
      join(OUTPUT_DIR, `prompt-${variant.id}.txt`),
      prompt,
    );
    console.log(`\n${'═'.repeat(60)}`);
    console.log(`Variant ${variant.id}: ${variant.name} (${prompt.length} chars)`);
    console.log('═'.repeat(60));

    for (let run = 1; run <= RUNS_PER_VARIANT; run++) {
      const label = `${variant.id}${run}`;
      const ts = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14).replace(/(\d{8})(\d{6})/, '$1-$2');
      const folderName = `${label}_cecil-the-paladin_${ts}`;
      const folderPath = join(OUTPUT_DIR, folderName);

      console.log(`\n  [${label}] Generating (run ${run}/${RUNS_PER_VARIANT})...`);
      const startTime = Date.now();

      try {
        const result = await callGemini(templateBase64, prompt);
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

        if (!result.image) {
          console.log(`  [${label}] FAILED — no image returned (${elapsed}s)`);
          continue;
        }

        mkdirSync(folderPath, { recursive: true });

        // Save the filled grid
        const ext = result.image.mimeType?.includes('jpeg') ? 'jpg' : 'png';
        writeFileSync(join(folderPath, `grid.${ext}`), Buffer.from(result.image.data, 'base64'));

        // Save Gemini's text response
        if (result.text) {
          writeFileSync(join(folderPath, 'gemini-response.txt'), result.text);
        }

        // Save metadata
        writeFileSync(join(folderPath, 'meta.json'), JSON.stringify({
          variant: variant.id,
          variantName: variant.name,
          run,
          character: CECIL.name,
          model: MODEL,
          imageSize: IMAGE_SIZE,
          promptLength: prompt.length,
          elapsed: `${elapsed}s`,
          timestamp: new Date().toISOString(),
        }, null, 2));

        const sizeKB = (Buffer.from(result.image.data, 'base64').length / 1024).toFixed(0);
        console.log(`  [${label}] OK — ${sizeKB}KB ${ext}, ${elapsed}s → ${folderName}`);

      } catch (err) {
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`  [${label}] ERROR (${elapsed}s): ${err.message}`);
      }

      // Brief pause between calls to avoid rate limiting
      if (run < RUNS_PER_VARIANT || variant !== variants[variants.length - 1]) {
        await new Promise(r => setTimeout(r, 2000));
      }
    }
  }

  console.log(`\n${'═'.repeat(60)}`);
  console.log(`Done! Results saved to: ${OUTPUT_DIR}`);
  console.log('═'.repeat(60));
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
