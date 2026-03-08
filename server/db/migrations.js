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
      if (msg.includes('duplicate column') || msg.includes('already exists') || msg.includes('no such column')) {
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
    } catch (_) { /* table may not exist yet */ }
  }
}
