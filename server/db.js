import Database from 'better-sqlite3';
import { mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

let db;

export function getDb() {
  if (db) return db;

  const dataDir = join(__dirname, '..', 'data');
  mkdirSync(dataDir, { recursive: true });

  const dbPath = join(dataDir, 'grid-sprite.db');
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  createSchema(db);
  return db;
}

function createSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS generations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      character_name TEXT NOT NULL,
      character_description TEXT NOT NULL DEFAULT '',
      model TEXT NOT NULL DEFAULT 'gemini-2.5-flash-image',
      prompt TEXT NOT NULL DEFAULT '',
      template_image TEXT NOT NULL DEFAULT '',
      filled_grid_image TEXT NOT NULL DEFAULT '',
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
  `);
}
