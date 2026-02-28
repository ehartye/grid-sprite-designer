import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import express from 'express';
import cors from 'cors';
import { mkdirSync, writeFileSync, readdirSync, statSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { getDb } from './db.js';
import { createGenerateRouter } from './routes/generate.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, '..', 'output');

const app = express();
const PORT = process.env.PORT || 3002;

app.use(cors({ origin: ['http://localhost:5173', 'http://localhost:5174'] }));
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
app.get('/api/history', (req, res) => {
  const rows = db.prepare(
    'SELECT id, character_name, character_description, model, created_at FROM generations ORDER BY created_at DESC LIMIT 50'
  ).all();
  res.json(rows);
});

app.get('/api/history/:id', (req, res) => {
  const gen = db.prepare('SELECT * FROM generations WHERE id = ?').get(req.params.id);
  if (!gen) return res.status(404).json({ error: 'Not found' });

  const sprites = db.prepare(
    'SELECT * FROM sprites WHERE generation_id = ? ORDER BY cell_index'
  ).all(req.params.id);

  res.json({
    id: gen.id,
    character: {
      name: gen.character_name || '',
      description: gen.character_description || '',
      equipment: '',
      colorNotes: '',
      styleNotes: '',
      rowGuidance: '',
    },
    filledGridImage: gen.filled_grid_image,
    filledGridMimeType: 'image/png',
    geminiText: gen.prompt || '',
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
});

app.post('/api/history', (req, res) => {
  const { characterName, characterDescription, model, prompt, templateImage, filledGridImage } = req.body;

  const result = db.prepare(
    `INSERT INTO generations (character_name, character_description, model, prompt, template_image, filled_grid_image)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(characterName, characterDescription, model, prompt, templateImage || '', filledGridImage || '');

  res.json({ id: result.lastInsertRowid });
});

app.post('/api/history/:id/sprites', (req, res) => {
  const { sprites } = req.body; // Array of { cellIndex, poseId, poseName, imageData, mimeType }

  const insert = db.prepare(
    `INSERT INTO sprites (generation_id, cell_index, pose_id, pose_name, image_data, mime_type)
     VALUES (?, ?, ?, ?, ?, ?)`
  );

  const insertAll = db.transaction(() => {
    for (const s of sprites) {
      insert.run(req.params.id, s.cellIndex, s.poseId, s.poseName, s.imageData, s.mimeType);
    }
  });

  insertAll();
  res.json({ count: sprites.length });
});

// Character presets
app.get('/api/presets', (req, res) => {
  const rows = db.prepare('SELECT * FROM character_presets WHERE is_preset = 1 ORDER BY name').all();
  res.json(rows.map(r => ({
    id: r.id,
    name: r.name,
    genre: r.genre,
    description: r.description,
    equipment: r.equipment,
    colorNotes: r.color_notes,
    rowGuidance: r.row_guidance,
  })));
});

// Set thumbnail cell for a generation (with processed image data)
app.put('/api/history/:id/thumbnail', (req, res) => {
  const { cellIndex, imageData, mimeType } = req.body;
  const result = db.prepare(
    `UPDATE generations SET thumbnail_cell_index = ?, thumbnail_image = ?, thumbnail_mime = ?, updated_at = datetime('now') WHERE id = ?`
  ).run(cellIndex, imageData || null, mimeType || null, req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Not found' });
  res.json({ success: true });
});

// Generation gallery
app.get('/api/gallery', (req, res) => {
  const rows = db.prepare(
    `SELECT g.id, g.character_name, g.character_description, g.model, g.created_at,
            (SELECT COUNT(*) FROM sprites WHERE generation_id = g.id) as sprite_count,
            COALESCE(g.thumbnail_image, (SELECT s.image_data FROM sprites s WHERE s.generation_id = g.id AND s.cell_index = COALESCE(g.thumbnail_cell_index, 0) LIMIT 1)) as thumb_data,
            COALESCE(g.thumbnail_mime, (SELECT s.mime_type FROM sprites s WHERE s.generation_id = g.id AND s.cell_index = COALESCE(g.thumbnail_cell_index, 0) LIMIT 1)) as thumb_mime
     FROM generations g ORDER BY g.created_at DESC LIMIT 50`
  ).all();
  res.json(rows.map(r => ({
    id: r.id,
    characterName: r.character_name,
    characterDescription: r.character_description,
    model: r.model,
    createdAt: r.created_at,
    spriteCount: r.sprite_count,
    thumbnailData: r.thumb_data,
    thumbnailMime: r.thumb_mime,
  })));
});

app.delete('/api/gallery/:id', (req, res) => {
  db.prepare('DELETE FROM sprites WHERE generation_id = ?').run(req.params.id);
  const result = db.prepare('DELETE FROM generations WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Not found' });
  res.json({ success: true });
});

// App state (key-value store for session persistence)
app.get('/api/state/:key', (req, res) => {
  const row = db.prepare('SELECT value FROM app_state WHERE key = ?').get(req.params.key);
  res.json({ value: row ? row.value : null });
});

app.put('/api/state/:key', (req, res) => {
  const { value } = req.body;
  db.prepare(
    'INSERT INTO app_state (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
  ).run(req.params.key, String(value));
  res.json({ success: true });
});

app.delete('/api/state/:key', (req, res) => {
  db.prepare('DELETE FROM app_state WHERE key = ?').run(req.params.key);
  res.json({ success: true });
});

// Editor settings per generation
app.get('/api/history/:id/settings', (req, res) => {
  const row = db.prepare('SELECT settings FROM editor_settings WHERE generation_id = ?').get(req.params.id);
  res.json(row ? JSON.parse(row.settings) : null);
});

app.put('/api/history/:id/settings', (req, res) => {
  const settings = JSON.stringify(req.body);
  db.prepare(
    `INSERT INTO editor_settings (generation_id, settings, updated_at)
     VALUES (?, ?, datetime('now'))
     ON CONFLICT(generation_id) DO UPDATE SET settings = excluded.settings, updated_at = excluded.updated_at`
  ).run(req.params.id, settings);
  res.json({ success: true });
});

app.delete('/api/history/:id', (req, res) => {
  db.prepare('DELETE FROM sprites WHERE generation_id = ?').run(req.params.id);
  const result = db.prepare('DELETE FROM generations WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Not found' });
  res.json({ success: true });
});

// ── Archive: save generation to disk as PNG files ──────────────────────────

app.post('/api/archive', (req, res) => {
  try {
    const { characterName, filledGridImage, filledGridMimeType, sprites } = req.body;

    if (!characterName || !filledGridImage) {
      return res.status(400).json({ error: 'characterName and filledGridImage are required' });
    }

    // Build folder name: character-name_YYYYMMDD-HHmmss
    const slug = characterName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const ts = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 15).replace(/(\d{8})(\d{6})/, '$1-$2');
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
  } catch (err) {
    console.error('Archive error:', err);
    res.status(500).json({ error: err.message });
  }
});

// List archive folders
app.get('/api/archive', (req, res) => {
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
  } catch (err) {
    console.error('Archive list error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Serve archive files statically
app.use('/output', express.static(OUTPUT_DIR));

// Serve test files (dev only)
app.use('/tests', express.static(join(__dirname, '..', 'tests')));
app.use('/test-fixtures', express.static(join(__dirname, '..', 'test-fixtures')));

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
