import { Router } from 'express';
import { parseIntParam } from '../utils.js';
import { PRESET_TABLES } from '../presetTables.js';

export function createGridPresetsRouter(db) {
  const router = Router();

  router.get('/', (req, res, next) => {
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

  router.post('/', (req, res, next) => {
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

  router.put('/:id', (req, res, next) => {
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

  router.delete('/:id', (req, res, next) => {
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

  return router;
}
