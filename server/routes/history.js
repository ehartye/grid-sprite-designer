import { Router } from 'express';
import { parseIntParam } from '../utils.js';
import { PRESET_TABLES } from '../presetTables.js';
import { ALLOWED_MIME_TYPES } from './generate.js';

const VALID_SPRITE_TYPES = new Set(Object.keys(PRESET_TABLES));

export function createHistoryRouter(db) {
  const router = Router();

  router.get('/', (req, res, next) => {
    try {
      const rows = db.prepare(
        'SELECT id, content_name, content_description, model, created_at FROM generations ORDER BY created_at DESC LIMIT 50'
      ).all();
      res.json(rows.map(r => ({
        id: r.id,
        contentName: r.content_name,
        contentDescription: r.content_description,
        model: r.model,
        createdAt: r.created_at,
      })));
    } catch (err) { next(err); }
  });

  router.get('/:id', (req, res, next) => {
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

  router.post('/', (req, res, next) => {
    try {
      if (!req.body || typeof req.body !== 'object') {
        return res.status(400).json({ error: 'Request body is required' });
      }
      const { contentName, contentDescription, model, prompt, templateImage, filledGridImage, spriteType, gridSize, aspectRatio, groupId, contentPresetId } = req.body;
      if (typeof contentName !== 'string' || contentName.trim() === '') {
        return res.status(400).json({ error: 'contentName is required and must be a non-empty string' });
      }
      if (typeof model !== 'string' || model.trim() === '') {
        return res.status(400).json({ error: 'model is required and must be a non-empty string' });
      }
      const effectiveSpriteType = spriteType || 'character';
      if (!VALID_SPRITE_TYPES.has(effectiveSpriteType)) {
        return res.status(400).json({ error: `Invalid sprite_type: ${effectiveSpriteType}` });
      }

      const result = db.prepare(
        `INSERT INTO generations (content_name, content_description, model, prompt, template_image, filled_grid_image, sprite_type, grid_size, aspect_ratio, group_id, content_preset_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(contentName, contentDescription, model, prompt, templateImage || '', filledGridImage || '', effectiveSpriteType, gridSize || null, aspectRatio || '1:1', groupId || null, contentPresetId || null);

      res.status(201).json({ id: Number(result.lastInsertRowid) });
    } catch (err) { next(err); }
  });

  router.post('/:id/sprites', (req, res, next) => {
    try {
      const id = parseIntParam(req.params.id);
      if (id === null) return res.status(400).json({ error: 'Invalid id' });

      if (!req.body || typeof req.body !== 'object') {
        return res.status(400).json({ error: 'Request body is required' });
      }
      const { sprites } = req.body;
      if (!Array.isArray(sprites)) {
        return res.status(400).json({ error: 'sprites must be an array' });
      }
      if (sprites.length === 0) {
        return res.status(400).json({ error: 'sprites array must not be empty' });
      }
      for (let i = 0; i < sprites.length; i++) {
        const s = sprites[i];
        if (typeof s.cellIndex !== 'number') {
          return res.status(400).json({ error: `sprites[${i}].cellIndex must be a number` });
        }
        if (typeof s.poseId !== 'string' || s.poseId.trim() === '') {
          return res.status(400).json({ error: `sprites[${i}].poseId must be a non-empty string` });
        }
        if (typeof s.poseName !== 'string' || s.poseName.trim() === '') {
          return res.status(400).json({ error: `sprites[${i}].poseName must be a non-empty string` });
        }
        if (typeof s.imageData !== 'string' || s.imageData.trim() === '') {
          return res.status(400).json({ error: `sprites[${i}].imageData must be a non-empty string` });
        }
        if (typeof s.mimeType !== 'string' || s.mimeType.trim() === '') {
          return res.status(400).json({ error: `sprites[${i}].mimeType must be a non-empty string` });
        }
        if (!ALLOWED_MIME_TYPES.includes(s.mimeType)) {
          return res.status(400).json({ error: `sprites[${i}].mimeType is invalid. Allowed values: ${ALLOWED_MIME_TYPES.join(', ')}` });
        }
      }

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
      res.status(201).json({ count: sprites.length });
    } catch (err) { next(err); }
  });

  router.put('/:id/thumbnail', (req, res, next) => {
    try {
      const id = parseIntParam(req.params.id);
      if (id === null) return res.status(400).json({ error: 'Invalid id' });

      const { cellIndex, imageData, mimeType } = req.body;
      if (mimeType && !ALLOWED_MIME_TYPES.includes(mimeType)) {
        return res.status(400).json({ error: `Invalid mimeType. Allowed values: ${ALLOWED_MIME_TYPES.join(', ')}` });
      }
      const result = db.prepare(
        `UPDATE generations SET thumbnail_cell_index = ?, thumbnail_image = ?, thumbnail_mime = ?, updated_at = datetime('now') WHERE id = ?`
      ).run(cellIndex, imageData || null, mimeType || null, id);
      if (result.changes === 0) return res.status(404).json({ error: 'Not found' });
      res.json({ success: true });
    } catch (err) { next(err); }
  });

  router.get('/:id/settings', (req, res, next) => {
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

  router.put('/:id/settings', (req, res, next) => {
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

  router.delete('/:id', (req, res, next) => {
    try {
      const id = parseIntParam(req.params.id);
      if (id === null) return res.status(400).json({ error: 'Invalid id' });

      db.prepare('DELETE FROM sprites WHERE generation_id = ?').run(id);
      const result = db.prepare('DELETE FROM generations WHERE id = ?').run(id);
      if (result.changes === 0) return res.status(404).json({ error: 'Not found' });
      res.json({ success: true });
    } catch (err) { next(err); }
  });

  router.patch('/:id/group', (req, res, next) => {
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

  return router;
}
