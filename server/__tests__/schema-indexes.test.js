import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { createSchema } from '../db/schema.js';
import { migrateSchema } from '../db/migrations.js';

function freshDb() {
  const db = new Database(':memory:');
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  return db;
}

describe('schema indexes', () => {
  let db;

  beforeEach(() => {
    db = freshDb();
    createSchema(db);
    migrateSchema(db);
  });

  it('creates idx_generations_sprite_type index', () => {
    const idx = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='index' AND name='idx_generations_sprite_type'"
    ).get();
    expect(idx).toBeTruthy();
  });

  it('creates idx_generations_type_created composite index', () => {
    const idx = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='index' AND name='idx_generations_type_created'"
    ).get();
    expect(idx).toBeTruthy();
  });
});
