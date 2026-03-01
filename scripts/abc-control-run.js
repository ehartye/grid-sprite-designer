/**
 * Control group: 3 generations with NO character-specific row guidance.
 * Uses only the generic prompt + character description (no per-cell pose details).
 * This isolates the value of the detailed rowGuidance preset.
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { mkdirSync, writeFileSync } from 'fs';
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

const CECIL = {
  name: 'Cecil the Paladin',
  description: 'A noble paladin with shoulder-length silver-white hair, strong jawline, and piercing blue eyes. Medium athletic build. Stands with confident, upright posture.',
  equipment: 'Ornate white-and-gold plate armor with a blue cape, wielding a holy longsword with a glowing blade. Shield with a sun emblem on his back.',
  colorNotes: 'Silver-white hair, blue eyes. White and gold armor with blue accents. Cape is royal blue with gold trim.',
};

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

function buildControlPrompt(character) {
  // Same structure as Variant A but with NO character-specific rowGuidance
  const charBlock = [
    `Fill every pink cell area with an SNES-era 16-bit pixel-art sprite of a`,
    `${character.name.toUpperCase()} character.`,
    ``,
    `Character appearance: ${character.description}`,
    character.equipment ? `Equipment: ${character.equipment}` : '',
    character.colorNotes ? `Color palette: ${character.colorNotes}` : '',
    ``,
    `  • Style reference: Final Fantasy VI / Chrono Trigger overworld + battle sprites`,
    `  • Consistent proportions and palette across ALL 36 cells`,
  ].filter(Boolean).join('\n');

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

Return the completed sprite sheet as a single image. Preserve ALL header text exactly.`;
}

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

async function main() {
  console.log('Generating template image via Playwright...');
  const { chromium } = await import('playwright');
  const browser = await chromium.launch();
  const page = await browser.newPage();

  await page.goto('http://localhost:5174', { waitUntil: 'networkidle', timeout: 15000 });

  const templateBase64 = await page.evaluate(() => {
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
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, w, h);
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        const x = col * (cellW + border) + border;
        const y = row * (cellH + border) + border;
        ctx.fillStyle = '#FF00FF';
        ctx.fillRect(x, y, cellW, cellH);
        ctx.fillStyle = '#000000';
        ctx.fillRect(x, y, cellW, headerH);
        ctx.fillStyle = '#FFFFFF';
        ctx.font = `${fontSize}px monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(labels[row * COLS + col], x + cellW / 2, y + headerH / 2);
      }
    }
    return canvas.toDataURL('image/png').split(',')[1];
  });

  await browser.close();
  console.log(`Template generated (${(templateBase64.length / 1024).toFixed(0)}KB base64)\n`);

  const prompt = buildControlPrompt(CECIL);
  mkdirSync(OUTPUT_DIR, { recursive: true });
  writeFileSync(join(OUTPUT_DIR, 'prompt-D.txt'), prompt);

  console.log('═'.repeat(60));
  console.log(`Variant D: Control — no rowGuidance (${prompt.length} chars)`);
  console.log('═'.repeat(60));

  for (let run = 1; run <= 3; run++) {
    const label = `D${run}`;
    const ts = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14).replace(/(\d{8})(\d{6})/, '$1-$2');
    const folderName = `${label}_cecil-the-paladin_${ts}`;
    const folderPath = join(OUTPUT_DIR, folderName);

    console.log(`\n  [${label}] Generating (run ${run}/3)...`);
    const startTime = Date.now();

    try {
      const result = await callGemini(templateBase64, prompt);
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

      if (!result.image) {
        console.log(`  [${label}] FAILED — no image returned (${elapsed}s)`);
        continue;
      }

      mkdirSync(folderPath, { recursive: true });
      const ext = result.image.mimeType?.includes('jpeg') ? 'jpg' : 'png';
      writeFileSync(join(folderPath, `grid.${ext}`), Buffer.from(result.image.data, 'base64'));
      if (result.text) writeFileSync(join(folderPath, 'gemini-response.txt'), result.text);
      writeFileSync(join(folderPath, 'meta.json'), JSON.stringify({
        variant: 'D', variantName: 'Control (no rowGuidance)', run,
        character: CECIL.name, model: MODEL, imageSize: IMAGE_SIZE,
        promptLength: prompt.length, elapsed: `${elapsed}s`,
        timestamp: new Date().toISOString(),
      }, null, 2));

      const sizeKB = (Buffer.from(result.image.data, 'base64').length / 1024).toFixed(0);
      console.log(`  [${label}] OK — ${sizeKB}KB ${ext}, ${elapsed}s → ${folderName}`);
    } catch (err) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`  [${label}] ERROR (${elapsed}s): ${err.message}`);
    }

    if (run < 3) await new Promise(r => setTimeout(r, 2000));
  }

  console.log(`\nDone! Control results saved to: ${OUTPUT_DIR}`);
}

main().catch(err => { console.error('Fatal error:', err); process.exit(1); });
