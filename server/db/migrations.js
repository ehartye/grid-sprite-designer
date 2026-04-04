const MIGRATIONS = [
  { name: '001_add_thumbnail_columns', sql: 'ALTER TABLE generations ADD COLUMN thumbnail_cell_index INTEGER DEFAULT NULL' },
  { name: '002_add_thumbnail_image', sql: 'ALTER TABLE generations ADD COLUMN thumbnail_image TEXT DEFAULT NULL' },
  { name: '003_add_thumbnail_mime', sql: 'ALTER TABLE generations ADD COLUMN thumbnail_mime TEXT DEFAULT NULL' },
  { name: '004_add_sprite_type', sql: "ALTER TABLE generations ADD COLUMN sprite_type TEXT NOT NULL DEFAULT 'character'" },
  { name: '005_add_grid_size', sql: 'ALTER TABLE generations ADD COLUMN grid_size TEXT DEFAULT NULL' },
  { name: '006_add_grid_preset_aspect_ratio', sql: "ALTER TABLE grid_presets ADD COLUMN aspect_ratio TEXT DEFAULT '1:1'" },
  { name: '007_add_grid_preset_tile_shape', sql: "ALTER TABLE grid_presets ADD COLUMN tile_shape TEXT DEFAULT 'square'" },
  { name: '008_add_generation_aspect_ratio', sql: "ALTER TABLE generations ADD COLUMN aspect_ratio TEXT DEFAULT '1:1'" },
  { name: '009_add_group_id', sql: 'ALTER TABLE generations ADD COLUMN group_id TEXT DEFAULT NULL' },
  { name: '010_add_content_preset_id', sql: 'ALTER TABLE generations ADD COLUMN content_preset_id TEXT DEFAULT NULL' },
  { name: '011_rename_character_name', sql: 'ALTER TABLE generations RENAME COLUMN character_name TO content_name' },
  { name: '012_rename_character_description', sql: 'ALTER TABLE generations RENAME COLUMN character_description TO content_description' },
  { name: '013_add_sprites_unique_index', sql: 'CREATE UNIQUE INDEX IF NOT EXISTS idx_sprites_gen_cell ON sprites(generation_id, cell_index)' },
  { name: '014_add_generations_sprite_type_index', sql: 'CREATE INDEX IF NOT EXISTS idx_generations_sprite_type ON generations(sprite_type)' },
  { name: '015_add_generations_type_created_index', sql: 'CREATE INDEX IF NOT EXISTS idx_generations_type_created ON generations(sprite_type, created_at DESC)' },
  {
    name: '016_remove_rpg_full_tall',
    sql: `
      -- Delete Tall links where the character already has a link to RPG Full
      DELETE FROM character_grid_links
      WHERE grid_preset_id = (SELECT id FROM grid_presets WHERE name = 'RPG Full (Tall)' AND sprite_type = 'character' LIMIT 1)
        AND character_preset_id IN (
          SELECT character_preset_id FROM character_grid_links
          WHERE grid_preset_id = (SELECT id FROM grid_presets WHERE name = 'RPG Full' AND sprite_type = 'character' LIMIT 1)
        );
      -- Re-link remaining Tall links to RPG Full
      UPDATE character_grid_links
      SET grid_preset_id = (SELECT id FROM grid_presets WHERE name = 'RPG Full' AND sprite_type = 'character' LIMIT 1)
      WHERE grid_preset_id = (SELECT id FROM grid_presets WHERE name = 'RPG Full (Tall)' AND sprite_type = 'character' LIMIT 1)
        AND (SELECT id FROM grid_presets WHERE name = 'RPG Full' AND sprite_type = 'character' LIMIT 1) IS NOT NULL;
      -- Delete the Tall preset
      DELETE FROM grid_presets WHERE name = 'RPG Full (Tall)' AND sprite_type = 'character';
    `
  },
  {
    name: '017_clean_isometric_aspect_ratios',
    sql: "UPDATE grid_presets SET aspect_ratio = '1:1' WHERE sprite_type != 'background' AND aspect_ratio != '1:1'"
  },
  {
    name: '018_hierarchical_guidance',
    sql: `
    -- grid_presets: rename generic_guidance → overall_guidance, add group/cell
    ALTER TABLE grid_presets RENAME COLUMN generic_guidance TO overall_guidance;
    ALTER TABLE grid_presets ADD COLUMN group_guidance TEXT NOT NULL DEFAULT '{}';
    ALTER TABLE grid_presets ADD COLUMN cell_guidance TEXT NOT NULL DEFAULT '{}';

    -- character_grid_links: rename guidance_override → overall_guidance, add group/cell
    ALTER TABLE character_grid_links RENAME COLUMN guidance_override TO overall_guidance;
    ALTER TABLE character_grid_links ADD COLUMN group_guidance TEXT NOT NULL DEFAULT '{}';
    ALTER TABLE character_grid_links ADD COLUMN cell_guidance TEXT NOT NULL DEFAULT '{}';

    -- building_grid_links
    ALTER TABLE building_grid_links RENAME COLUMN guidance_override TO overall_guidance;
    ALTER TABLE building_grid_links ADD COLUMN group_guidance TEXT NOT NULL DEFAULT '{}';
    ALTER TABLE building_grid_links ADD COLUMN cell_guidance TEXT NOT NULL DEFAULT '{}';

    -- terrain_grid_links
    ALTER TABLE terrain_grid_links RENAME COLUMN guidance_override TO overall_guidance;
    ALTER TABLE terrain_grid_links ADD COLUMN group_guidance TEXT NOT NULL DEFAULT '{}';
    ALTER TABLE terrain_grid_links ADD COLUMN cell_guidance TEXT NOT NULL DEFAULT '{}';

    -- background_grid_links
    ALTER TABLE background_grid_links RENAME COLUMN guidance_override TO overall_guidance;
    ALTER TABLE background_grid_links ADD COLUMN group_guidance TEXT NOT NULL DEFAULT '{}';
    ALTER TABLE background_grid_links ADD COLUMN cell_guidance TEXT NOT NULL DEFAULT '{}';

    -- character_presets: rename row_guidance → overall_guidance, add group/cell
    ALTER TABLE character_presets RENAME COLUMN row_guidance TO overall_guidance;
    ALTER TABLE character_presets ADD COLUMN group_guidance TEXT NOT NULL DEFAULT '{}';
    ALTER TABLE character_presets ADD COLUMN cell_guidance TEXT NOT NULL DEFAULT '{}';

    -- building_presets: rename cell_guidance → overall_guidance (must go before ADD COLUMN)
    ALTER TABLE building_presets RENAME COLUMN cell_guidance TO overall_guidance;
    ALTER TABLE building_presets ADD COLUMN group_guidance TEXT NOT NULL DEFAULT '{}';
    ALTER TABLE building_presets ADD COLUMN cell_guidance TEXT NOT NULL DEFAULT '{}';

    -- terrain_presets: rename tile_guidance → overall_guidance
    ALTER TABLE terrain_presets RENAME COLUMN tile_guidance TO overall_guidance;
    ALTER TABLE terrain_presets ADD COLUMN group_guidance TEXT NOT NULL DEFAULT '{}';
    ALTER TABLE terrain_presets ADD COLUMN cell_guidance TEXT NOT NULL DEFAULT '{}';

    -- background_presets: rename layer_guidance → overall_guidance
    ALTER TABLE background_presets RENAME COLUMN layer_guidance TO overall_guidance;
    ALTER TABLE background_presets ADD COLUMN group_guidance TEXT NOT NULL DEFAULT '{}';
    ALTER TABLE background_presets ADD COLUMN cell_guidance TEXT NOT NULL DEFAULT '{}';
  `,
  },
  { name: '019_add_generation_image_size', sql: 'ALTER TABLE generations ADD COLUMN image_size TEXT DEFAULT NULL' },
  { name: '020_add_generation_thinking_level', sql: 'ALTER TABLE generations ADD COLUMN thinking_level TEXT DEFAULT NULL' },
];

export function migrateSchema(db) {
  // Ensure migrations table exists (for databases created before version tracking)
  db.exec(`
    CREATE TABLE IF NOT EXISTS migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  const applied = new Set(
    db.prepare('SELECT name FROM migrations').all().map(r => r.name)
  );

  const record = db.prepare('INSERT INTO migrations (name) VALUES (?)');

  for (const { name, sql } of MIGRATIONS) {
    if (applied.has(name)) continue;

    try {
      db.exec(sql);
      record.run(name);
      console.log(`[Migration] Applied: ${name}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      // Migration may already be applied on databases that predate version tracking
      if (msg.includes('duplicate column') || msg.includes('already exists') || msg.includes('no such column') || msg.includes('no such table')) {
        record.run(name);
        console.log(`[Migration] Recorded (already applied): ${name}`);
      } else {
        console.error(`[Migration] Failed: ${name}\n  ${msg}`);
        throw e;
      }
    }
  }

  // Backfill content_preset_id from content_name for existing entries
  const presetTables = ['character_presets', 'building_presets', 'terrain_presets', 'background_presets'];
  for (const table of presetTables) {
    try {
      db.exec(`
        UPDATE generations SET content_preset_id = (
          SELECT id FROM ${table} WHERE name = generations.content_name LIMIT 1
        ) WHERE content_preset_id IS NULL AND EXISTS (
          SELECT 1 FROM ${table} WHERE name = generations.content_name
        )
      `);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes('no such table') && !msg.includes('SQLITE_ERROR')) {
        throw err;
      }
    }
  }
}
