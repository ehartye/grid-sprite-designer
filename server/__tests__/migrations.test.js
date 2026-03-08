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

describe('migration version tracking', () => {
  let db;

  beforeEach(() => {
    db = freshDb();
  });

  it('creates migrations table if it does not exist', () => {
    // Run on a bare database with just the base schema
    createSchema(db);
    migrateSchema(db);

    const table = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='migrations'"
    ).get();
    expect(table).toBeTruthy();
  });

  it('records each migration in the migrations table', () => {
    createSchema(db);
    migrateSchema(db);

    const rows = db.prepare('SELECT name FROM migrations ORDER BY id').all();
    expect(rows.length).toBeGreaterThan(0);
    // The last migration should be the sprites unique index
    expect(rows.at(-1).name).toBe('013_add_sprites_unique_index');
  });

  it('does not re-run migrations on second call', () => {
    createSchema(db);
    migrateSchema(db);

    const countBefore = db.prepare('SELECT COUNT(*) as c FROM migrations').get().c;

    // Run again
    migrateSchema(db);

    const countAfter = db.prepare('SELECT COUNT(*) as c FROM migrations').get().c;
    expect(countAfter).toBe(countBefore);
  });

  it('each migration has a unique name', () => {
    createSchema(db);
    migrateSchema(db);

    const rows = db.prepare('SELECT name FROM migrations').all();
    const names = rows.map(r => r.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('marks already-applied migrations when upgrading from pre-tracking database', () => {
    // Simulate a pre-tracking database: create schema (which already has all columns)
    // but no migrations table yet
    createSchema(db);

    // Verify no migrations table before migrateSchema
    // (schema.js now creates it, so it will exist but be empty)
    const countBefore = db.prepare('SELECT COUNT(*) as c FROM migrations').get().c;
    expect(countBefore).toBe(0);

    // Run migrations - ALTER COLUMNs will fail with "duplicate column" since
    // createSchema already defines them, but they should still be recorded
    migrateSchema(db);

    const rows = db.prepare('SELECT name FROM migrations').all();
    expect(rows.length).toBeGreaterThan(0);
  });
});
