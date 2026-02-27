import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import express from 'express';
import cors from 'cors';
import { getDb } from './db.js';
import { createGenerateRouter } from './routes/generate.js';

const app = express();
const PORT = process.env.PORT || 3002;

app.use(cors());
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

  res.json({ ...gen, sprites });
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

// Generation gallery
app.get('/api/gallery', (req, res) => {
  const rows = db.prepare(
    `SELECT g.id, g.character_name, g.character_description, g.model, g.created_at,
            (SELECT COUNT(*) FROM sprites WHERE generation_id = g.id) as sprite_count,
            (SELECT s.image_data FROM sprites s WHERE s.generation_id = g.id ORDER BY s.cell_index LIMIT 1) as thumb_data,
            (SELECT s.mime_type FROM sprites s WHERE s.generation_id = g.id ORDER BY s.cell_index LIMIT 1) as thumb_mime
     FROM generations g ORDER BY g.created_at DESC LIMIT 50`
  ).all();
  res.json(rows);
});

app.delete('/api/gallery/:id', (req, res) => {
  db.prepare('DELETE FROM sprites WHERE generation_id = ?').run(req.params.id);
  const result = db.prepare('DELETE FROM generations WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Not found' });
  res.json({ success: true });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
