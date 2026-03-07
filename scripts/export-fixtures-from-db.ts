#!/usr/bin/env npx tsx
/**
 * Export all generations from the database as test fixtures.
 *
 * For each generation in the DB:
 * 1. Writes the filled grid image as test-fixtures/<name>.png
 * 2. Creates a companion .manifest.json with the grid profile
 *
 * Usage: npx tsx scripts/export-fixtures-from-db.ts
 */

import Database from 'better-sqlite3';
import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const ROOT = join(import.meta.dirname, '..');
const FIXTURES_DIR = join(ROOT, 'test-fixtures');
const DB_PATH = process.env.DB_PATH || join(ROOT, 'data', 'grid-sprite.db');

interface Manifest {
  spriteType: string;
  gridSize: string;
  cols: number;
  rows: number;
  totalCells: number;
  templateCellW: number;
  templateCellH: number;
  headerH: number;
  border: number;
  cellLabels?: string[];
  generationId?: number;
}

// Template params from src/lib/gridConfig.ts
const TEMPLATE_PARAMS: Record<string, Record<string, { cellW: number; cellH: number; headerH: number; border: number }>> = {
  character: {
    '6x6': { cellW: 339, cellH: 339, headerH: 14, border: 2 },
  },
  building: {
    '3x3': { cellW: 680, cellH: 680, headerH: 22, border: 2 },
    '2x3': { cellW: 1021, cellH: 680, headerH: 22, border: 2 },
    '2x2': { cellW: 1021, cellH: 1021, headerH: 22, border: 2 },
  },
  terrain: {
    '3x3': { cellW: 680, cellH: 680, headerH: 18, border: 2 },
    '4x4': { cellW: 509, cellH: 509, headerH: 18, border: 2 },
    '5x5': { cellW: 406, cellH: 406, headerH: 18, border: 2 },
  },
  background: {
    '1x3': { cellW: 2044, cellH: 680, headerH: 18, border: 2 },
    '1x4': { cellW: 2044, cellH: 509, headerH: 18, border: 2 },
    '1x5': { cellW: 2044, cellH: 406, headerH: 18, border: 2 },
    '2x2': { cellW: 1021, cellH: 1021, headerH: 18, border: 2 },
    '3x2': { cellW: 680, cellH: 1021, headerH: 18, border: 2 },
    '3x3': { cellW: 680, cellH: 680, headerH: 18, border: 2 },
  },
};

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function main() {
  if (!existsSync(DB_PATH)) {
    console.error(`Database not found at ${DB_PATH}. Start the server first to initialize it.`);
    process.exit(1);
  }

  mkdirSync(FIXTURES_DIR, { recursive: true });

  const db = new Database(DB_PATH, { readonly: true });

  // Get all generations with their sprites
  const generations = db.prepare(`
    SELECT g.id, g.content_name, g.sprite_type, g.grid_size, g.filled_grid_image
    FROM generations g
    WHERE g.filled_grid_image IS NOT NULL AND g.filled_grid_image != ''
    ORDER BY g.id
  `).all() as any[];

  console.log(`Found ${generations.length} generations in database.\n`);

  // Track slugs to handle duplicates
  const usedSlugs = new Set<string>();
  let exported = 0;
  let skipped = 0;

  for (const gen of generations) {
    let slug = slugify(gen.content_name);

    // Handle duplicate names by appending generation id
    if (usedSlugs.has(slug)) {
      slug = `${slug}-${gen.id}`;
    }
    usedSlugs.add(slug);

    const spriteType = gen.sprite_type || 'character';
    const gridSize = gen.grid_size || '6x6';

    const templateParams = TEMPLATE_PARAMS[spriteType]?.[gridSize];
    if (!templateParams) {
      console.warn(`  SKIP: "${gen.content_name}" (id=${gen.id}) — no template params for ${spriteType} ${gridSize}`);
      skipped++;
      continue;
    }

    const [colStr, rowStr] = gridSize.split('x');
    const cols = parseInt(colStr, 10);
    const rows = parseInt(rowStr, 10);

    // Get sprite labels from the sprites table
    const sprites = db.prepare(`
      SELECT cell_index, pose_name FROM sprites
      WHERE generation_id = ?
      ORDER BY cell_index
    `).all(gen.id) as any[];

    // Write the filled grid image
    const imagePath = join(FIXTURES_DIR, `${slug}.png`);
    const imageBuffer = Buffer.from(gen.filled_grid_image, 'base64');
    writeFileSync(imagePath, imageBuffer);

    // Build manifest
    const manifest: Manifest = {
      spriteType,
      gridSize,
      cols,
      rows,
      totalCells: cols * rows,
      templateCellW: templateParams.cellW,
      templateCellH: templateParams.cellH,
      headerH: templateParams.headerH,
      border: templateParams.border,
      generationId: gen.id,
    };

    // Add cell labels for non-character types (from sprites table)
    if (spriteType !== 'character' && sprites.length > 0) {
      manifest.cellLabels = sprites.map((s: any) => s.pose_name);
    }

    const manifestPath = join(FIXTURES_DIR, `${slug}.manifest.json`);
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');

    console.log(`  EXPORT: ${slug} (${spriteType} ${gridSize}, ${sprites.length} sprites, id=${gen.id})`);
    exported++;
  }

  db.close();

  console.log(`\nDone: ${exported} exported, ${skipped} skipped.`);
}

main();
