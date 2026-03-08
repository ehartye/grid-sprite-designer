export function createSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS generations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      content_name TEXT NOT NULL,
      content_description TEXT NOT NULL DEFAULT '',
      character_preset_id TEXT,
      custom_instructions TEXT DEFAULT '',
      model TEXT NOT NULL DEFAULT 'gemini-2.5-flash-image',
      prompt TEXT NOT NULL DEFAULT '',
      template_image TEXT NOT NULL DEFAULT '',
      filled_grid_image TEXT NOT NULL DEFAULT '',
      thumbnail_cell_index INTEGER DEFAULT NULL,
      thumbnail_image TEXT DEFAULT NULL,
      thumbnail_mime TEXT DEFAULT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sprites (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      generation_id INTEGER NOT NULL,
      cell_index INTEGER NOT NULL,
      pose_id TEXT NOT NULL,
      pose_name TEXT NOT NULL,
      image_data TEXT NOT NULL,
      mime_type TEXT NOT NULL DEFAULT 'image/png',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY(generation_id) REFERENCES generations(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_sprites_generation ON sprites(generation_id);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_sprites_gen_cell ON sprites(generation_id, cell_index);

    CREATE TABLE IF NOT EXISTS editor_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      generation_id INTEGER NOT NULL UNIQUE,
      settings TEXT NOT NULL DEFAULT '{}',
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY(generation_id) REFERENCES generations(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_editor_settings_generation ON editor_settings(generation_id);

    CREATE TABLE IF NOT EXISTS app_state (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS character_presets (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      genre TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL DEFAULT '',
      equipment TEXT NOT NULL DEFAULT '',
      color_notes TEXT NOT NULL DEFAULT '',
      row_guidance TEXT NOT NULL DEFAULT '',
      is_preset INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS building_presets (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      genre TEXT NOT NULL DEFAULT '',
      grid_size TEXT NOT NULL DEFAULT '3x3',
      description TEXT NOT NULL DEFAULT '',
      details TEXT NOT NULL DEFAULT '',
      color_notes TEXT NOT NULL DEFAULT '',
      cell_labels TEXT NOT NULL DEFAULT '[]',
      cell_guidance TEXT NOT NULL DEFAULT '',
      is_preset INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS terrain_presets (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      genre TEXT NOT NULL DEFAULT '',
      grid_size TEXT NOT NULL DEFAULT '4x4',
      description TEXT NOT NULL DEFAULT '',
      color_notes TEXT NOT NULL DEFAULT '',
      tile_labels TEXT NOT NULL DEFAULT '[]',
      tile_guidance TEXT NOT NULL DEFAULT '',
      is_preset INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS background_presets (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      genre TEXT NOT NULL DEFAULT '',
      grid_size TEXT NOT NULL DEFAULT '1x4',
      bg_mode TEXT NOT NULL DEFAULT 'parallax',
      description TEXT NOT NULL DEFAULT '',
      color_notes TEXT NOT NULL DEFAULT '',
      layer_labels TEXT NOT NULL DEFAULT '[]',
      layer_guidance TEXT NOT NULL DEFAULT '',
      is_preset INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS grid_presets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      sprite_type TEXT NOT NULL CHECK(sprite_type IN ('character','building','terrain','background')),
      genre TEXT DEFAULT '',
      grid_size TEXT NOT NULL,
      cols INTEGER NOT NULL,
      rows INTEGER NOT NULL,
      cell_labels TEXT NOT NULL DEFAULT '[]',
      cell_groups TEXT NOT NULL DEFAULT '[]',
      generic_guidance TEXT DEFAULT '',
      bg_mode TEXT DEFAULT NULL,
      aspect_ratio TEXT DEFAULT '1:1',
      tile_shape TEXT DEFAULT 'square',
      is_preset INTEGER DEFAULT 1,
      UNIQUE(name, sprite_type, grid_size)
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS character_grid_links (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      character_preset_id TEXT NOT NULL REFERENCES character_presets(id) ON DELETE CASCADE,
      grid_preset_id INTEGER NOT NULL REFERENCES grid_presets(id) ON DELETE CASCADE,
      guidance_override TEXT DEFAULT '',
      sort_order INTEGER DEFAULT 0,
      UNIQUE(character_preset_id, grid_preset_id)
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS building_grid_links (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      building_preset_id TEXT NOT NULL REFERENCES building_presets(id) ON DELETE CASCADE,
      grid_preset_id INTEGER NOT NULL REFERENCES grid_presets(id) ON DELETE CASCADE,
      guidance_override TEXT DEFAULT '',
      sort_order INTEGER DEFAULT 0,
      UNIQUE(building_preset_id, grid_preset_id)
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS terrain_grid_links (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      terrain_preset_id TEXT NOT NULL REFERENCES terrain_presets(id) ON DELETE CASCADE,
      grid_preset_id INTEGER NOT NULL REFERENCES grid_presets(id) ON DELETE CASCADE,
      guidance_override TEXT DEFAULT '',
      sort_order INTEGER DEFAULT 0,
      UNIQUE(terrain_preset_id, grid_preset_id)
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS background_grid_links (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      background_preset_id TEXT NOT NULL REFERENCES background_presets(id) ON DELETE CASCADE,
      grid_preset_id INTEGER NOT NULL REFERENCES grid_presets(id) ON DELETE CASCADE,
      guidance_override TEXT DEFAULT '',
      sort_order INTEGER DEFAULT 0,
      UNIQUE(background_preset_id, grid_preset_id)
    )
  `);
}
