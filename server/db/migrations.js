export function migrateSchema(db) {
  const migrations = [
    'ALTER TABLE generations ADD COLUMN thumbnail_cell_index INTEGER DEFAULT NULL',
    'ALTER TABLE generations ADD COLUMN thumbnail_image TEXT DEFAULT NULL',
    'ALTER TABLE generations ADD COLUMN thumbnail_mime TEXT DEFAULT NULL',
    "ALTER TABLE generations ADD COLUMN sprite_type TEXT NOT NULL DEFAULT 'character'",
    "ALTER TABLE generations ADD COLUMN grid_size TEXT DEFAULT NULL",
    "ALTER TABLE grid_presets ADD COLUMN aspect_ratio TEXT DEFAULT '1:1'",
    "ALTER TABLE grid_presets ADD COLUMN tile_shape TEXT DEFAULT 'square'",
    "ALTER TABLE generations ADD COLUMN aspect_ratio TEXT DEFAULT '1:1'",
    "ALTER TABLE generations ADD COLUMN group_id TEXT DEFAULT NULL",
    "ALTER TABLE generations ADD COLUMN content_preset_id TEXT DEFAULT NULL",
    "ALTER TABLE generations RENAME COLUMN character_name TO content_name",
    "ALTER TABLE generations RENAME COLUMN character_description TO content_description",
    "CREATE UNIQUE INDEX IF NOT EXISTS idx_sprites_gen_cell ON sprites(generation_id, cell_index)",
  ];
  for (const sql of migrations) {
    try {
      db.exec(sql);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (!msg.includes('duplicate column') && !msg.includes('already exists') && !msg.includes('no such column')) {
        console.error(`Migration failed: ${sql}\n  ${msg}`);
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
