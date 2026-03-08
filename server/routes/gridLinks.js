import { Router } from 'express';
import { parseIntParam } from '../utils.js';
import { PRESET_TABLES } from '../presetTables.js';

export function createGridLinksRouter(db) {
  const router = Router();

  router.put('/:type/:id', (req, res, next) => {
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

  router.delete('/:type/:id', (req, res, next) => {
    try {
      const { type, id } = req.params;
      const config = PRESET_TABLES[type];
      if (!config) return res.status(400).json({ error: 'Invalid type' });
      const linkId = parseIntParam(id);
      if (linkId === null) return res.status(400).json({ error: 'Invalid id' });
      const { linkTable: table } = config;
      const result = db.prepare(`DELETE FROM ${table} WHERE id=?`).run(linkId);
      if (result.changes === 0) return res.status(404).json({ error: 'Link not found' });
      res.json({ success: true });
    } catch (err) { next(err); }
  });

  return router;
}
