#!/usr/bin/env node
/**
 * One-time script: restore sprites from output/ archive folders into the
 * sprites DB table. Matches archive folders to generations by content name
 * slug + chronological order.
 *
 * Usage:
 *   node scripts/restore-sprites-from-archive.js          # dry run
 *   node scripts/restore-sprites-from-archive.js --commit  # actually insert
 */

import Database from 'better-sqlite3';
import { readdirSync, readFileSync, existsSync, statSync } from 'fs';
import { join, resolve } from 'path';

const DRY_RUN = !process.argv.includes('--commit');
const DB_PATH = resolve('data/grid-sprite.db');
const OUTPUT_DIR = resolve('output');

if (DRY_RUN) console.log('=== DRY RUN (pass --commit to actually insert) ===\n');

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

function slugify(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

// Load all generations, group by slug
const gens = db.prepare('SELECT id, content_name, created_at FROM generations ORDER BY created_at ASC').all();
const gensBySlug = {};
for (const g of gens) {
  const slug = slugify(g.content_name);
  (gensBySlug[slug] = gensBySlug[slug] || []).push(g);
}

// Load archive folders, group by slug
const folders = readdirSync(OUTPUT_DIR)
  .filter(f => statSync(join(OUTPUT_DIR, f)).isDirectory())
  .sort();

const foldersBySlug = {};
for (const f of folders) {
  const slug = f.replace(/_\d{8}-\d{6}$/, '');
  (foldersBySlug[slug] = foldersBySlug[slug] || []).push(f);
}

// Check existing sprite counts to skip already-populated generations
const existingCounts = new Map(
  db.prepare('SELECT generation_id, COUNT(*) as c FROM sprites GROUP BY generation_id').all()
    .map(r => [r.generation_id, r.c])
);

const insert = db.prepare(`
  INSERT INTO sprites (generation_id, cell_index, pose_id, pose_name, image_data, mime_type)
  VALUES (?, ?, ?, ?, ?, ?)
`);

let totalRestored = 0;
let totalSkipped = 0;
let totalNoMatch = 0;

const insertAll = db.transaction((pairs) => {
  for (const { genId, folder } of pairs) {
    const spritesDir = join(OUTPUT_DIR, folder, 'sprites');
    if (!existsSync(spritesDir)) continue;

    const files = readdirSync(spritesDir)
      .filter(f => f.endsWith('.png') || f.endsWith('.jpg'))
      .sort();

    for (const file of files) {
      // Parse filename: "00-walk-down-1.png" -> cellIndex=0, poseSlug="walk-down-1"
      const match = file.match(/^(\d+)-(.+)\.(png|jpg)$/);
      if (!match) continue;

      const cellIndex = parseInt(match[1], 10);
      const poseSlug = match[2];
      const poseName = poseSlug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      const ext = match[3];
      const mimeType = ext === 'jpg' ? 'image/jpeg' : 'image/png';
      const imageData = readFileSync(join(spritesDir, file)).toString('base64');

      insert.run(genId, cellIndex, poseSlug, poseName, imageData, mimeType);
    }

    totalRestored += files.length;
  }
});

// Match folders to generations and collect pairs
const pairs = [];

for (const slug in foldersBySlug) {
  const flist = foldersBySlug[slug];
  const glist = gensBySlug[slug] || [];

  for (let i = 0; i < flist.length; i++) {
    const folder = flist[i];
    const gen = glist[i];

    if (!gen) {
      totalNoMatch++;
      if (DRY_RUN) console.log(`  SKIP  ${folder} (no matching generation)`);
      continue;
    }

    if ((existingCounts.get(gen.id) || 0) > 0) {
      totalSkipped++;
      if (DRY_RUN) console.log(`  SKIP  ${folder} -> gen ${gen.id} (already has sprites)`);
      continue;
    }

    const spritesDir = join(OUTPUT_DIR, folder, 'sprites');
    if (!existsSync(spritesDir)) {
      totalSkipped++;
      if (DRY_RUN) console.log(`  SKIP  ${folder} -> gen ${gen.id} (no sprites/ dir)`);
      continue;
    }

    const spriteCount = readdirSync(spritesDir).filter(f => f.endsWith('.png') || f.endsWith('.jpg')).length;
    console.log(`  ${DRY_RUN ? 'WOULD' : 'INSERT'}  ${folder} -> gen ${gen.id} (${spriteCount} sprites)`);
    pairs.push({ genId: gen.id, folder });
  }
}

if (!DRY_RUN && pairs.length > 0) {
  insertAll(pairs);
}

console.log(`\nDone. Restored: ${DRY_RUN ? 0 : totalRestored} | Would restore: ${pairs.reduce((sum, p) => {
  const dir = join(OUTPUT_DIR, p.folder, 'sprites');
  return sum + readdirSync(dir).filter(f => f.endsWith('.png') || f.endsWith('.jpg')).length;
}, 0)} | Skipped: ${totalSkipped} | No match: ${totalNoMatch}`);

db.close();
