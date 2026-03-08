import { describe, it, expect, beforeEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import { createSchema } from '../db/schema.js';
import { migrateSchema } from '../db/migrations.js';

function freshDb() {
  const db = new Database(':memory:');
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  return db;
}

describe('migration backfill error handling', () => {
  let db;

  beforeEach(() => {
    db = freshDb();
    createSchema(db);
  });

  it('suppresses "no such table" errors during backfill', () => {
    // Drop one of the preset tables to simulate it not existing yet
    db.exec('DROP TABLE IF EXISTS character_grid_links');
    db.exec('DROP TABLE IF EXISTS character_presets');

    // Should not throw — "no such table" is expected and suppressed
    expect(() => migrateSchema(db)).not.toThrow();
  });

  it('re-throws non-"no such table" errors during backfill', () => {
    // Run migrations first to set up schema
    migrateSchema(db);

    // Monkey-patch db.exec to throw a non-"no such table" error on the
    // backfill UPDATE statement
    const originalExec = db.exec.bind(db);
    db.exec = (sql) => {
      if (sql.includes('UPDATE generations SET content_preset_id')) {
        throw new Error('disk I/O error');
      }
      return originalExec(sql);
    };

    // Re-running migrateSchema should re-throw the unexpected error
    expect(() => migrateSchema(db)).toThrow('disk I/O error');
  });
});
