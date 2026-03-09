import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { createSchema } from '../db/schema.js';
import { migrateSchema } from '../db/migrations.js';
import { createPresetsRouter } from '../routes/presets.js';
import { PRESET_TABLES } from '../presetTables.js';

function freshDb() {
  const db = new Database(':memory:');
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  createSchema(db);
  migrateSchema(db);
  return db;
}

/** Find the route handler registered for a given method + path. */
function findHandler(router, method, path) {
  for (const layer of router.stack) {
    if (
      layer.route &&
      layer.route.path === path &&
      layer.route.methods[method]
    ) {
      return layer.route.stack.at(-1).handle;
    }
  }
  throw new Error(`No ${method.toUpperCase()} handler for "${path}"`);
}

function mockRes() {
  const res = {
    statusCode: 200,
    body: null,
    status(code) { res.statusCode = code; return res; },
    json(data) { res.body = data; return res; },
  };
  return res;
}

describe('GET / preset list with gridLinkCount', () => {
  let db, handler;

  beforeEach(() => {
    db = freshDb();
    const router = createPresetsRouter(db);
    handler = findHandler(router, 'get', '/');
  });

  it('returns gridLinkCount of 0 for presets with no links', () => {
    // Insert a character preset
    db.prepare(
      "INSERT INTO character_presets (id, name, is_preset) VALUES ('cp1', 'Warrior', 1)"
    ).run();

    const res = mockRes();
    handler({ query: { type: 'character' } }, res, () => {});
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].gridLinkCount).toBe(0);
  });

  it('returns correct gridLinkCount when links exist', () => {
    // Insert a character preset
    db.prepare(
      "INSERT INTO character_presets (id, name, is_preset) VALUES ('cp1', 'Warrior', 1)"
    ).run();

    // Insert grid presets
    db.prepare(
      "INSERT INTO grid_presets (name, sprite_type, grid_size, cols, rows) VALUES ('4x4 Grid', 'character', '4x4', 4, 4)"
    ).run();
    db.prepare(
      "INSERT INTO grid_presets (name, sprite_type, grid_size, cols, rows) VALUES ('3x3 Grid', 'character', '3x3', 3, 3)"
    ).run();

    // Link presets
    db.prepare(
      "INSERT INTO character_grid_links (character_preset_id, grid_preset_id) VALUES ('cp1', 1)"
    ).run();
    db.prepare(
      "INSERT INTO character_grid_links (character_preset_id, grid_preset_id) VALUES ('cp1', 2)"
    ).run();

    const res = mockRes();
    handler({ query: { type: 'character' } }, res, () => {});
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].gridLinkCount).toBe(2);
  });

  it('returns correct gridLinkCount per preset when multiple presets exist', () => {
    db.prepare(
      "INSERT INTO character_presets (id, name, is_preset) VALUES ('cp1', 'Warrior', 1)"
    ).run();
    db.prepare(
      "INSERT INTO character_presets (id, name, is_preset) VALUES ('cp2', 'Mage', 1)"
    ).run();

    db.prepare(
      "INSERT INTO grid_presets (name, sprite_type, grid_size, cols, rows) VALUES ('4x4 Grid', 'character', '4x4', 4, 4)"
    ).run();

    // Only link cp1
    db.prepare(
      "INSERT INTO character_grid_links (character_preset_id, grid_preset_id) VALUES ('cp1', 1)"
    ).run();

    const res = mockRes();
    handler({ query: { type: 'character' } }, res, () => {});
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveLength(2);

    const warrior = res.body.find(p => p.name === 'Warrior');
    const mage = res.body.find(p => p.name === 'Mage');
    expect(mage).toBeTruthy();
    expect(warrior.gridLinkCount).toBe(1);
    expect(mage.gridLinkCount).toBe(0);
  });

  it('uses a single query instead of N+1 queries', () => {
    // Insert presets
    db.prepare(
      "INSERT INTO character_presets (id, name, is_preset) VALUES ('cp1', 'Warrior', 1)"
    ).run();
    db.prepare(
      "INSERT INTO character_presets (id, name, is_preset) VALUES ('cp2', 'Mage', 1)"
    ).run();

    // Spy on db.prepare to count calls
    const originalPrepare = db.prepare.bind(db);
    let prepareCount = 0;
    db.prepare = (sql) => {
      prepareCount++;
      return originalPrepare(sql);
    };

    const res = mockRes();
    handler({ query: { type: 'character' } }, res, () => {});
    expect(res.statusCode).toBe(200);

    // Should use exactly 1 query, not 1 + N (where N is number of presets)
    expect(prepareCount).toBe(1);
  });
});

describe('GET /:type/:id/grid-links returns aspectRatio and tileShape', () => {
  let db, handler;

  beforeEach(() => {
    db = freshDb();
    const router = createPresetsRouter(db);
    handler = findHandler(router, 'get', '/:type/:id/grid-links');
  });

  it('returns aspectRatio and tileShape from grid preset', () => {
    // Insert a character preset
    db.prepare(
      "INSERT INTO character_presets (id, name, is_preset) VALUES ('cp1', 'Warrior', 1)"
    ).run();

    // Insert a grid preset with specific aspect_ratio and tile_shape
    db.prepare(
      `INSERT INTO grid_presets (name, sprite_type, grid_size, cols, rows, cell_labels, cell_groups, aspect_ratio, tile_shape)
       VALUES ('Wide Grid', 'character', '4x4', 4, 4, '[]', '[]', '16:9', 'diamond')`
    ).run();

    // Link them
    db.prepare(
      "INSERT INTO character_grid_links (character_preset_id, grid_preset_id) VALUES ('cp1', 1)"
    ).run();

    const res = mockRes();
    const req = {
      params: { type: 'character', id: 'cp1' },
      presetConfig: PRESET_TABLES.character,
    };
    handler(req, res, () => {});

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].aspectRatio).toBe('16:9');
    expect(res.body[0].tileShape).toBe('diamond');
  });

  it('defaults aspectRatio to 1:1 and tileShape to square when null', () => {
    db.prepare(
      "INSERT INTO character_presets (id, name, is_preset) VALUES ('cp1', 'Warrior', 1)"
    ).run();

    // Insert grid preset without aspect_ratio or tile_shape (uses schema defaults)
    db.prepare(
      `INSERT INTO grid_presets (name, sprite_type, grid_size, cols, rows, cell_labels, cell_groups)
       VALUES ('Basic Grid', 'character', '3x3', 3, 3, '[]', '[]')`
    ).run();

    db.prepare(
      "INSERT INTO character_grid_links (character_preset_id, grid_preset_id) VALUES ('cp1', 1)"
    ).run();

    const res = mockRes();
    const req = {
      params: { type: 'character', id: 'cp1' },
      presetConfig: PRESET_TABLES.character,
    };
    handler(req, res, () => {});

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].aspectRatio).toBe('1:1');
    expect(res.body[0].tileShape).toBe('square');
  });
});
