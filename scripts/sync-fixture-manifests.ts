#!/usr/bin/env npx tsx
/**
 * Sync fixture manifests from the database.
 *
 * For each image in test-fixtures/, attempts to match it to a content preset
 * in the DB and writes a companion .manifest.json with the grid profile.
 *
 * Usage: npx tsx scripts/sync-fixture-manifests.ts
 */

import Database from 'better-sqlite3';
import { readdirSync, writeFileSync, existsSync } from 'fs';
import { join, basename, extname } from 'path';

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
  contentPreset?: string;
}

// Template params from src/lib/gridConfig.ts — duplicated here to avoid importing TS modules
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

function main() {
  if (!existsSync(DB_PATH)) {
    console.error(`Database not found at ${DB_PATH}. Start the server first to initialize it.`);
    process.exit(1);
  }

  const db = new Database(DB_PATH, { readonly: true });

  // Query all content presets with their linked grid presets
  const presetQueries: Record<string, string> = {
    character: `
      SELECT cp.id, cp.name, 'character' as sprite_type, '6x6' as grid_size,
             6 as cols, 6 as rows, NULL as cell_labels
      FROM character_presets cp
    `,
    building: `
      SELECT bp.id, bp.name, 'building' as sprite_type, gp.grid_size,
             gp.cols, gp.rows, gp.cell_labels
      FROM building_presets bp
      JOIN building_grid_links bgl ON bgl.building_preset_id = bp.id
      JOIN grid_presets gp ON gp.id = bgl.grid_preset_id
    `,
    terrain: `
      SELECT tp.id, tp.name, 'terrain' as sprite_type, gp.grid_size,
             gp.cols, gp.rows, gp.cell_labels
      FROM terrain_presets tp
      JOIN terrain_grid_links tgl ON tgl.terrain_preset_id = tp.id
      JOIN grid_presets gp ON gp.id = tgl.grid_preset_id
    `,
    background: `
      SELECT bp.id, bp.name, 'background' as sprite_type, gp.grid_size,
             gp.cols, gp.rows, gp.cell_labels
      FROM background_presets bp
      JOIN background_grid_links bgl ON bgl.background_preset_id = bp.id
      JOIN grid_presets gp ON gp.id = bgl.grid_preset_id
    `,
  };

  // Build lookup: normalized name -> preset data
  const presetsByName = new Map<string, any>();
  for (const [type, query] of Object.entries(presetQueries)) {
    const rows = db.prepare(query).all();
    for (const row of rows) {
      const key = (row as any).name.toLowerCase().replace(/\s+/g, '-');
      presetsByName.set(key, row);
    }
  }

  db.close();

  // Scan fixtures
  const imageFiles = readdirSync(FIXTURES_DIR).filter(f =>
    ['.jpg', '.jpeg', '.png'].includes(extname(f).toLowerCase()) &&
    !f.includes('-results')
  );

  let updated = 0;
  let skipped = 0;

  for (const imageFile of imageFiles) {
    const name = basename(imageFile, extname(imageFile));
    const manifestPath = join(FIXTURES_DIR, `${name}.manifest.json`);
    const preset = presetsByName.get(name);

    if (!preset) {
      if (!existsSync(manifestPath)) {
        console.warn(`  SKIP: ${imageFile} — no matching preset and no existing manifest`);
      } else {
        console.log(`  KEEP: ${imageFile} — no matching preset, keeping existing manifest`);
      }
      skipped++;
      continue;
    }

    const spriteType = preset.sprite_type;
    const gridSize = preset.grid_size;
    const cols = preset.cols;
    const rows = preset.rows;
    const totalCells = cols * rows;

    const templateParams = TEMPLATE_PARAMS[spriteType]?.[gridSize];
    if (!templateParams) {
      console.warn(`  SKIP: ${imageFile} — no template params for ${spriteType} ${gridSize}`);
      skipped++;
      continue;
    }

    const manifest: Manifest = {
      spriteType,
      gridSize,
      cols,
      rows,
      totalCells,
      templateCellW: templateParams.cellW,
      templateCellH: templateParams.cellH,
      headerH: templateParams.headerH,
      border: templateParams.border,
    };

    // Add cell labels for non-character types
    if (spriteType !== 'character' && preset.cell_labels) {
      try {
        const labels = JSON.parse(preset.cell_labels);
        if (Array.isArray(labels) && labels.length > 0) {
          manifest.cellLabels = labels;
        }
      } catch {}
    }

    manifest.contentPreset = name;

    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
    console.log(`  WRITE: ${name}.manifest.json (${spriteType} ${gridSize})`);
    updated++;
  }

  console.log(`\nDone: ${updated} updated, ${skipped} skipped.`);
}

main();
