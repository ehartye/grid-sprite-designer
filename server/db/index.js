import Database from 'better-sqlite3';
import { mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createSchema } from './schema.js';
import { migrateSchema } from './migrations.js';
import { runAllSeeds } from './seeds/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

let db;

export function getDb() {
  if (db) return db;

  const dataDir = join(__dirname, '..', '..', 'data');
  mkdirSync(dataDir, { recursive: true });

  const dbPath = process.env.DB_PATH || join(dataDir, 'grid-sprite.db');
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  createSchema(db);
  migrateSchema(db);
  runAllSeeds(db);
  return db;
}
