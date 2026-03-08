import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import express from 'express';
import cors from 'cors';
import { mkdirSync, writeFileSync, readdirSync, statSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { getDb } from './db.js';
import { createGenerateRouter } from './routes/generate.js';
import { parseIntParam, extractPresetValues, mapPresetRow } from './utils.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, '..', 'output');

const app = express();
const PORT = process.env.PORT || 3002;

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
  : ['http://localhost:5173', 'http://localhost:5174'];
app.use(cors({ origin: allowedOrigins }));
app.use(express.json({ limit: '50mb' }));

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error('GEMINI_API_KEY not found in environment. Create a .env.local file.');
  process.exit(1);
}

// Initialize database
const db = getDb();
console.log('[Server] Database initialized.');

// Mount routes
app.use('/api', createGenerateRouter(apiKey));

// Simple history endpoints
app.get('/api/history', (req, res, next) => {
  try {
    const rows = db.prepare(
      'SELECT id, content_name, content_description, model, created_at FROM generations ORDER BY created_at DESC LIMIT 50'
    ).all();
    res.json(rows);
  } catch (err) { next(err); }
});

app.get('/api/history/:id', (req, res, next) => {
  try {
    const id = parseIntParam(req.params.id);
    if (id === null) return res.status(400).json({ error: 'Invalid id' });

    const gen = db.prepare('SELECT * FROM generations WHERE id = ?').get(id);
    if (!gen) return res.status(404).json({ error: 'Not found' });

    const sprites = db.prepare(
      'SELECT * FROM sprites WHERE generation_id = ? ORDER BY cell_index'
    ).all(id);

    res.json({
      id: gen.id,
      spriteType: gen.sprite_type || 'character',
      gridSize: gen.grid_size || null,
      content: {
        name: gen.content_name || '',
        description: gen.content_description || '',
        equipment: '',
        colorNotes: '',
        styleNotes: '',
        rowGuidance: '',
      },
      filledGridImage: gen.filled_grid_image,
      filledGridMimeType: 'image/png',
      geminiText: gen.prompt || '',
      aspectRatio: gen.aspect_ratio || '1:1',
      groupId: gen.group_id || null,
      contentPresetId: gen.content_preset_id || null,
      thumbnailCellIndex: gen.thumbnail_cell_index,
      sprites: sprites.map(s => ({
        cellIndex: s.cell_index,
        label: s.pose_name,
        imageData: s.image_data,
        mimeType: s.mime_type,
        width: 0,
        height: 0,
      })),
    });
  } catch (err) { next(err); }
});

app.post('/api/history', (req, res, next) => {
  try {
    const { contentName, contentDescription, model, prompt, templateImage, filledGridImage, spriteType, gridSize, aspectRatio, groupId, contentPresetId } = req.body;

    const result = db.prepare(
      `INSERT INTO generations (content_name, content_description, model, prompt, template_image, filled_grid_image, sprite_type, grid_size, aspect_ratio, group_id, content_preset_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(contentName, contentDescription, model, prompt, templateImage || '', filledGridImage || '', spriteType || 'character', gridSize || null, aspectRatio || '1:1', groupId || null, contentPresetId || null);

    res.json({ id: result.lastInsertRowid });
  } catch (err) { next(err); }
});

app.post('/api/history/:id/sprites', (req, res, next) => {
  try {
    const id = parseIntParam(req.params.id);
    if (id === null) return res.status(400).json({ error: 'Invalid id' });

    const { sprites } = req.body; // Array of { cellIndex, poseId, poseName, imageData, mimeType }

    const insert = db.prepare(
      `INSERT INTO sprites (generation_id, cell_index, pose_id, pose_name, image_data, mime_type)
     VALUES (?, ?, ?, ?, ?, ?)`
    );

    const insertAll = db.transaction(() => {
      for (const s of sprites) {
        insert.run(id, s.cellIndex, s.poseId, s.poseName, s.imageData, s.mimeType);
      }
    });

    insertAll();
    res.json({ count: sprites.length });
  } catch (err) { next(err); }
});

// Content preset CRUD endpoints — single data-driven implementation
// Each column entry: [bodyField, dbColumn, default, json?]
const PRESET_TABLES = {
  character: {
    table: 'character_presets', linkTable: 'character_grid_links', fk: 'character_preset_id',
    columns: [
      ['name', 'name'], ['genre', 'genre', ''], ['description', 'description', ''],
      ['equipment', 'equipment', ''], ['colorNotes', 'color_notes', ''],
      ['rowGuidance', 'row_guidance', ''],
    ],
  },
  building: {
    table: 'building_presets', linkTable: 'building_grid_links', fk: 'building_preset_id',
    columns: [
      ['name', 'name'], ['genre', 'genre', ''], ['description', 'description', ''],
      ['details', 'details', ''], ['colorNotes', 'color_notes', ''],
      ['gridSize', 'grid_size', '3x3'], ['cellLabels', 'cell_labels', [], true],
      ['cellGuidance', 'cell_guidance', ''],
    ],
  },
  terrain: {
    table: 'terrain_presets', linkTable: 'terrain_grid_links', fk: 'terrain_preset_id',
    columns: [
      ['name', 'name'], ['genre', 'genre', ''], ['description', 'description', ''],
      ['colorNotes', 'color_notes', ''], ['gridSize', 'grid_size', '4x4'],
      ['tileLabels', 'tile_labels', [], true], ['tileGuidance', 'tile_guidance', ''],
    ],
  },
  background: {
    table: 'background_presets', linkTable: 'background_grid_links', fk: 'background_preset_id',
    columns: [
      ['name', 'name'], ['genre', 'genre', ''], ['description', 'description', ''],
      ['colorNotes', 'color_notes', ''], ['gridSize', 'grid_size', '1x4'],
      ['bgMode', 'bg_mode', 'parallax'], ['layerLabels', 'layer_labels', [], true],
      ['layerGuidance', 'layer_guidance', ''],
    ],
  },
};

app.get('/api/presets', (req, res, next) => {
  try {
    const type = req.query.type || 'character';
    const config = PRESET_TABLES[type];
    if (!config) return res.status(400).json({ error: 'Invalid type' });

    const rows = db.prepare(`SELECT * FROM ${config.table} WHERE is_preset = 1 ORDER BY name`).all();
    res.json(rows.map(r => {
      const gridLinkCount = db.prepare(`SELECT COUNT(*) as c FROM ${config.linkTable} WHERE ${config.fk} = ?`).get(r.id).c;
      return { ...mapPresetRow(r, config.columns), gridLinkCount };
    }));
  } catch (err) { next(err); }
});

app.get('/api/presets/:type/:id', (req, res, next) => {
  try {
    const id = parseIntParam(req.params.id);
    if (id === null) return res.status(400).json({ error: 'Invalid id' });
    const config = PRESET_TABLES[req.params.type];
    if (!config) return res.status(400).json({ error: 'Invalid type' });

    const row = db.prepare(`SELECT * FROM ${config.table} WHERE id = ? AND is_preset = 1`).get(id);
    if (!row) return res.status(404).json({ error: 'Not found' });
    res.json(mapPresetRow(row, config.columns));
  } catch (err) { next(err); }
});

app.post('/api/presets/:type', (req, res, next) => {
  try {
    const config = PRESET_TABLES[req.params.type];
    if (!config) return res.status(400).json({ error: 'Invalid type' });

    const dbCols = config.columns.map(c => c[1]);
    const placeholders = dbCols.map(() => '?').join(', ');
    const values = extractPresetValues(req.body, config.columns);
    const result = db.prepare(
      `INSERT INTO ${config.table} (${dbCols.join(', ')}, is_preset) VALUES (${placeholders}, 1)`
    ).run(...values);
    res.json({ id: Number(result.lastInsertRowid) });
  } catch (err) { next(err); }
});

app.put('/api/presets/:type/:id', (req, res, next) => {
  try {
    const id = parseIntParam(req.params.id);
    if (id === null) return res.status(400).json({ error: 'Invalid id' });
    const config = PRESET_TABLES[req.params.type];
    if (!config) return res.status(400).json({ error: 'Invalid type' });

    const setClauses = config.columns.map(c => `${c[1]}=?`).join(', ');
    const values = extractPresetValues(req.body, config.columns);
    const result = db.prepare(
      `UPDATE ${config.table} SET ${setClauses} WHERE id=?`
    ).run(...values, id);
    if (result.changes === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true });
  } catch (err) { next(err); }
});

app.delete('/api/presets/:type/:id', (req, res, next) => {
  try {
    const { type } = req.params;
    const id = parseIntParam(req.params.id);
    if (id === null) return res.status(400).json({ error: 'Invalid id' });
    const config = PRESET_TABLES[type];
    if (!config) return res.status(400).json({ error: 'Invalid type' });

    // Junction links cascade via ON DELETE CASCADE, but delete explicitly just in case
    db.prepare(`DELETE FROM ${config.linkTable} WHERE ${config.fk} = ?`).run(id);
    const result = db.prepare(`DELETE FROM ${config.table} WHERE id = ?`).run(id);
    if (result.changes === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true });
  } catch (err) { next(err); }
});

// Grid preset CRUD endpoints
app.get('/api/grid-presets', (req, res, next) => {
  try {
    const { sprite_type } = req.query;
    let rows;
    if (sprite_type) {
      rows = db.prepare('SELECT * FROM grid_presets WHERE sprite_type = ? ORDER BY name').all(sprite_type);
    } else {
      rows = db.prepare('SELECT * FROM grid_presets ORDER BY sprite_type, name').all();
    }
    res.json(rows.map(r => ({
      id: r.id,
      name: r.name,
      spriteType: r.sprite_type,
      genre: r.genre,
      gridSize: r.grid_size,
      cols: r.cols,
      rows: r.rows,
      cellLabels: JSON.parse(r.cell_labels),
      cellGroups: JSON.parse(r.cell_groups),
      genericGuidance: r.generic_guidance,
      bgMode: r.bg_mode,
      aspectRatio: r.aspect_ratio || '1:1',
      tileShape: r.tile_shape || 'square',
      isPreset: r.is_preset,
    })));
  } catch (err) { next(err); }
});

app.post('/api/grid-presets', (req, res, next) => {
  try {
    const { name, spriteType, genre, gridSize, cols, rows, cellLabels, cellGroups, genericGuidance, bgMode, aspectRatio, tileShape } = req.body;
    if (!name || !spriteType || !gridSize || !cols || !rows) {
      return res.status(400).json({ error: 'Missing required fields: name, spriteType, gridSize, cols, rows' });
    }
    const result = db.prepare(`
      INSERT INTO grid_presets (name, sprite_type, genre, grid_size, cols, rows, cell_labels, cell_groups, generic_guidance, bg_mode, aspect_ratio, tile_shape, is_preset)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    `).run(name, spriteType, genre || '', gridSize, cols, rows,
      JSON.stringify(cellLabels || []), JSON.stringify(cellGroups || []), genericGuidance || '', bgMode || null,
      aspectRatio || '1:1', tileShape || 'square');
    res.json({ id: Number(result.lastInsertRowid) });
  } catch (err) { next(err); }
});

app.put('/api/grid-presets/:id', (req, res, next) => {
  try {
    const id = parseIntParam(req.params.id);
    if (id === null) return res.status(400).json({ error: 'Invalid id' });
    const { name, genre, gridSize, cols, rows, cellLabels, cellGroups, genericGuidance, bgMode, aspectRatio, tileShape } = req.body;
    const result = db.prepare(`
      UPDATE grid_presets SET name=?, genre=?, grid_size=?, cols=?, rows=?, cell_labels=?, cell_groups=?, generic_guidance=?, bg_mode=?, aspect_ratio=?, tile_shape=?
      WHERE id=?
    `).run(name, genre || '', gridSize, cols, rows,
      JSON.stringify(cellLabels || []), JSON.stringify(cellGroups || []), genericGuidance || '', bgMode || null,
      aspectRatio || '1:1', tileShape || 'square', id);
    if (result.changes === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true });
  } catch (err) { next(err); }
});

app.delete('/api/grid-presets/:id', (req, res, next) => {
  try {
    const id = parseIntParam(req.params.id);
    if (id === null) return res.status(400).json({ error: 'Invalid id' });
    const linkCount = db.prepare(`
      SELECT (SELECT COUNT(*) FROM character_grid_links WHERE grid_preset_id=?) +
             (SELECT COUNT(*) FROM building_grid_links WHERE grid_preset_id=?) +
             (SELECT COUNT(*) FROM terrain_grid_links WHERE grid_preset_id=?) +
             (SELECT COUNT(*) FROM background_grid_links WHERE grid_preset_id=?) as total
    `).get(id, id, id, id);
    db.prepare('DELETE FROM grid_presets WHERE id=?').run(id);
    res.json({ success: true, unlinked: linkCount.total });
  } catch (err) { next(err); }
});

// Grid link endpoints
app.get('/api/presets/:type/:id/grid-links', (req, res, next) => {
  try {
    const { type, id } = req.params;
    const config = PRESET_TABLES[type];
    if (!config) return res.status(400).json({ error: 'Invalid type' });
    const { linkTable: table, fk } = config;
    const links = db.prepare(`
      SELECT l.*, g.name as grid_name, g.grid_size, g.cols, g.rows,
             g.cell_labels, g.cell_groups, g.generic_guidance, g.bg_mode
      FROM ${table} l
      JOIN grid_presets g ON g.id = l.grid_preset_id
      WHERE l.${fk} = ?
      ORDER BY l.sort_order
    `).all(id);
    res.json(links.map(l => ({
      id: l.id,
      gridPresetId: l.grid_preset_id,
      guidanceOverride: l.guidance_override,
      sortOrder: l.sort_order,
      gridName: l.grid_name,
      gridSize: l.grid_size,
      cols: l.cols,
      rows: l.rows,
      cellLabels: JSON.parse(l.cell_labels),
      cellGroups: JSON.parse(l.cell_groups),
      genericGuidance: l.generic_guidance,
      bgMode: l.bg_mode,
    })));
  } catch (err) { next(err); }
});

app.post('/api/presets/:type/:id/grid-links', (req, res, next) => {
  try {
    const { type, id } = req.params;
    const config = PRESET_TABLES[type];
    if (!config) return res.status(400).json({ error: 'Invalid type' });
    const { gridPresetId, guidanceOverride, sortOrder } = req.body;
    if (!gridPresetId) return res.status(400).json({ error: 'Missing gridPresetId' });
    const { linkTable: table, fk } = config;
    const result = db.prepare(`
      INSERT INTO ${table} (${fk}, grid_preset_id, guidance_override, sort_order)
      VALUES (?, ?, ?, ?)
    `).run(id, gridPresetId, guidanceOverride || '', sortOrder || 0);
    res.json({ id: Number(result.lastInsertRowid) });
  } catch (err) { next(err); }
});

app.put('/api/grid-links/:type/:id', (req, res, next) => {
  try {
    const { type, id } = req.params;
    const config = PRESET_TABLES[type];
    if (!config) return res.status(400).json({ error: 'Invalid type' });
    const linkId = parseIntParam(id);
    if (linkId === null) return res.status(400).json({ error: 'Invalid id' });
    const { guidanceOverride, sortOrder } = req.body;
    const { linkTable: table } = config;
    const result = db.prepare(`UPDATE ${table} SET guidance_override=?, sort_order=? WHERE id=?`)
      .run(guidanceOverride || '', sortOrder || 0, linkId);
    if (result.changes === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true });
  } catch (err) { next(err); }
});

app.delete('/api/grid-links/:type/:id', (req, res, next) => {
  try {
    const { type, id } = req.params;
    const config = PRESET_TABLES[type];
    if (!config) return res.status(400).json({ error: 'Invalid type' });
    const linkId = parseIntParam(id);
    if (linkId === null) return res.status(400).json({ error: 'Invalid id' });
    const { linkTable: table } = config;
    db.prepare(`DELETE FROM ${table} WHERE id=?`).run(linkId);
    res.json({ success: true });
  } catch (err) { next(err); }
});

// Set thumbnail cell for a generation (with processed image data)
app.put('/api/history/:id/thumbnail', (req, res, next) => {
  try {
    const id = parseIntParam(req.params.id);
    if (id === null) return res.status(400).json({ error: 'Invalid id' });

    const { cellIndex, imageData, mimeType } = req.body;
    const result = db.prepare(
      `UPDATE generations SET thumbnail_cell_index = ?, thumbnail_image = ?, thumbnail_mime = ?, updated_at = datetime('now') WHERE id = ?`
    ).run(cellIndex, imageData || null, mimeType || null, id);
    if (result.changes === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true });
  } catch (err) { next(err); }
});

// Generation gallery (paginated, searchable, filterable)
app.get('/api/gallery', (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 24));
    const offset = (page - 1) * limit;
    const search = req.query.search ? `%${req.query.search}%` : null;
    const spriteType = req.query.spriteType || null;

    const conditions = [];
    const params = [];
    if (search) {
      conditions.push('g.content_name LIKE ?');
      params.push(search);
    }
    if (spriteType) {
      conditions.push('g.sprite_type = ?');
      params.push(spriteType);
    }
    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countRow = db.prepare(`SELECT COUNT(*) as total FROM generations g ${where}`).get(...params);
    const total = countRow.total;

    const rows = db.prepare(
      `SELECT g.id, g.content_name, g.content_description, g.model, g.created_at, g.sprite_type, g.grid_size, g.group_id,
            (SELECT COUNT(*) FROM sprites WHERE generation_id = g.id) as sprite_count,
            COALESCE(g.thumbnail_image, (SELECT s.image_data FROM sprites s WHERE s.generation_id = g.id AND s.cell_index = COALESCE(g.thumbnail_cell_index, 0) LIMIT 1)) as thumb_data,
            COALESCE(g.thumbnail_mime, (SELECT s.mime_type FROM sprites s WHERE s.generation_id = g.id AND s.cell_index = COALESCE(g.thumbnail_cell_index, 0) LIMIT 1)) as thumb_mime
     FROM generations g ${where} ORDER BY g.created_at DESC LIMIT ? OFFSET ?`
    ).all(...params, limit, offset);

    res.json({
      entries: rows.map(r => ({
        id: r.id,
        contentName: r.content_name,
        contentDescription: r.content_description,
        model: r.model,
        createdAt: r.created_at,
        spriteType: r.sprite_type || 'character',
        gridSize: r.grid_size,
        groupId: r.group_id,
        spriteCount: r.sprite_count,
        thumbnailData: r.thumb_data,
        thumbnailMime: r.thumb_mime,
      })),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) { next(err); }
});

// App state (key-value store for session persistence)
app.get('/api/state/:key', (req, res, next) => {
  try {
    const row = db.prepare('SELECT value FROM app_state WHERE key = ?').get(req.params.key);
    res.json({ value: row ? row.value : null });
  } catch (err) { next(err); }
});

app.put('/api/state/:key', (req, res, next) => {
  try {
    const { value } = req.body;
    db.prepare(
      'INSERT INTO app_state (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
    ).run(req.params.key, String(value));
    res.json({ success: true });
  } catch (err) { next(err); }
});

app.delete('/api/state/:key', (req, res, next) => {
  try {
    db.prepare('DELETE FROM app_state WHERE key = ?').run(req.params.key);
    res.json({ success: true });
  } catch (err) { next(err); }
});

// Editor settings per generation
app.get('/api/history/:id/settings', (req, res, next) => {
  try {
    const id = parseIntParam(req.params.id);
    if (id === null) return res.status(400).json({ error: 'Invalid id' });

    const row = db.prepare('SELECT settings FROM editor_settings WHERE generation_id = ?').get(id);
    try {
      res.json(row ? JSON.parse(row.settings) : null);
    } catch {
      res.json(null);
    }
  } catch (err) { next(err); }
});

app.put('/api/history/:id/settings', (req, res, next) => {
  try {
    const id = parseIntParam(req.params.id);
    if (id === null) return res.status(400).json({ error: 'Invalid id' });

    const settings = JSON.stringify(req.body);
    db.prepare(
      `INSERT INTO editor_settings (generation_id, settings, updated_at)
     VALUES (?, ?, datetime('now'))
     ON CONFLICT(generation_id) DO UPDATE SET settings = excluded.settings, updated_at = excluded.updated_at`
    ).run(id, settings);
    res.json({ success: true });
  } catch (err) { next(err); }
});

app.delete('/api/history/:id', (req, res, next) => {
  try {
    const id = parseIntParam(req.params.id);
    if (id === null) return res.status(400).json({ error: 'Invalid id' });

    db.prepare('DELETE FROM sprites WHERE generation_id = ?').run(id);
    const result = db.prepare('DELETE FROM generations WHERE id = ?').run(id);
    if (result.changes === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true });
  } catch (err) { next(err); }
});

app.patch('/api/history/:id/group', (req, res, next) => {
  try {
    const id = parseIntParam(req.params.id);
    if (id === null) return res.status(400).json({ error: 'Invalid id' });
    const { groupId } = req.body;
    if (!groupId) return res.status(400).json({ error: 'Missing groupId' });
    const result = db.prepare('UPDATE generations SET group_id = ? WHERE id = ? AND group_id IS NULL')
      .run(groupId, id);
    if (result.changes === 0) {
      const existing = db.prepare('SELECT group_id FROM generations WHERE id = ?').get(id);
      if (!existing) return res.status(404).json({ error: 'Not found' });
      return res.json({ groupId: existing.group_id, alreadySet: true });
    }
    res.json({ groupId, alreadySet: false });
  } catch (err) { next(err); }
});

// ── Archive: save generation to disk as PNG files ──────────────────────────

app.post('/api/archive', (req, res, next) => {
  try {
    const { contentName, filledGridImage, filledGridMimeType, sprites } = req.body;

    if (!contentName || !filledGridImage) {
      return res.status(400).json({ error: 'contentName and filledGridImage are required' });
    }

    // Build folder name: content-name_YYYYMMDD-HHmmss
    const slug = contentName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const ts = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14).replace(/(\d{8})(\d{6})/, '$1-$2');
    const folderName = `${slug}_${ts}`;
    const folderPath = join(OUTPUT_DIR, folderName);

    mkdirSync(folderPath, { recursive: true });

    // Save filled grid
    const gridExt = (filledGridMimeType || 'image/png').includes('jpeg') ? 'jpg' : 'png';
    writeFileSync(join(folderPath, `grid.${gridExt}`), Buffer.from(filledGridImage, 'base64'));

    // Save individual sprites
    let spriteCount = 0;
    if (sprites && Array.isArray(sprites)) {
      const spritesDir = join(folderPath, 'sprites');
      mkdirSync(spritesDir, { recursive: true });

      for (const s of sprites) {
        const ext = (s.mimeType || 'image/png').includes('jpeg') ? 'jpg' : 'png';
        const idx = String(s.cellIndex).padStart(2, '0');
        const poseSlug = (s.poseName || s.poseId || `cell-${idx}`)
          .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
        const filename = `${idx}-${poseSlug}.${ext}`;
        writeFileSync(join(spritesDir, filename), Buffer.from(s.imageData, 'base64'));
        spriteCount++;
      }
    }

    console.log(`[Archive] Saved to ${folderName}: grid + ${spriteCount} sprites`);
    res.json({ folder: folderName, spriteCount });
  } catch (err) { next(err); }
});

// List archive folders
app.get('/api/archive', (req, res, next) => {
  try {
    if (!existsSync(OUTPUT_DIR)) {
      return res.json([]);
    }
    const entries = readdirSync(OUTPUT_DIR)
      .filter(name => {
        const full = join(OUTPUT_DIR, name);
        return statSync(full).isDirectory();
      })
      .map(name => {
        const full = join(OUTPUT_DIR, name);
        const hasGrid = existsSync(join(full, 'grid.png')) || existsSync(join(full, 'grid.jpg'));
        const spritesDir = join(full, 'sprites');
        const spriteCount = existsSync(spritesDir) ? readdirSync(spritesDir).length : 0;
        return {
          folder: name,
          hasGrid,
          spriteCount,
          createdAt: statSync(full).birthtime.toISOString(),
        };
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    res.json(entries);
  } catch (err) { next(err); }
});

// Serve archive files statically
app.use('/output', express.static(OUTPUT_DIR));

// Serve test files (dev only)
if (process.env.NODE_ENV !== 'production') {
  app.use('/tests', express.static(join(__dirname, '..', 'tests')));
  app.use('/test-fixtures', express.static(join(__dirname, '..', 'test-fixtures')));
}

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// Global error handler
app.use((err, req, res, _next) => {
  console.error('[Server] Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

const server = app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE' && process.env.NODE_ENV === 'development') {
    console.log(`[Server] Port ${PORT} in use, killing existing process...`);
    import('child_process').then(({ execSync }) => {
      try {
        const isWin = process.platform === 'win32';
        if (isWin) {
          const out = execSync(`netstat -ano | findstr ":${PORT}" | findstr LISTENING`, { encoding: 'utf8' }).trim();
          const pid = out.split(/\s+/).pop();
          if (pid && /^\d+$/.test(pid)) {
            execSync(`taskkill /F /PID ${pid}`);
            console.log(`[Server] Killed PID ${pid}, restarting...`);
            setTimeout(() => server.listen(PORT), 1000);
          }
        } else {
          const pid = execSync(`lsof -ti:${PORT}`, { encoding: 'utf8' }).trim();
          if (pid) {
            process.kill(Number(pid), 'SIGKILL');
            console.log(`[Server] Killed PID ${pid}, restarting...`);
            setTimeout(() => server.listen(PORT), 1000);
          }
        }
      } catch {
        console.error(`[Server] Could not kill process on port ${PORT}. Stop it manually and retry.`);
        process.exit(1);
      }
    });
  } else {
    throw err;
  }
});

// Graceful shutdown
function shutdown(signal) {
  console.log(`[Server] ${signal} received, shutting down gracefully...`);
  server.close(() => {
    console.log('[Server] HTTP server closed.');
    try {
      db.close();
      console.log('[Server] Database closed.');
    } catch (err) {
      console.error('[Server] Error closing database:', err);
    }
    process.exit(0);
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
