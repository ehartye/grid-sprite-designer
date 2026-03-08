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
  const startTime = Date.now();

  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  createSchema(db);
  migrateSchema(db);
  const seedCount = runAllSeeds(db);

  const migrationCount = db.prepare('SELECT COUNT(*) as c FROM migrations').get().c;
  const duration = Date.now() - startTime;
  console.log(`[DB] Initialized: path=${dbPath}, migrations=${migrationCount}, seeds=${seedCount}, duration=${duration}ms`);

  return db;
}
