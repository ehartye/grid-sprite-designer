import { Router } from 'express';
import { parseIntParam } from '../utils.js';
import { validatePresetType } from '../middleware.js';

export function createGridLinksRouter(db) {
  const router = Router();

  router.put('/:type/:id', validatePresetType, (req, res, next) => {
    try {
      const { id } = req.params;
      const config = req.presetConfig;
      const numericId = parseIntParam(id);
      if (numericId === null) return res.status(400).json({ error: 'Invalid id' });
      const { overallGuidance, groupGuidance, cellGuidance, sortOrder } = req.body;
      db.prepare(`
        UPDATE ${config.linkTable}
        SET overall_guidance = ?, group_guidance = ?, cell_guidance = ?, sort_order = ?
        WHERE id = ?
      `).run(
        overallGuidance || '',
        JSON.stringify(groupGuidance || {}),
        JSON.stringify(cellGuidance || {}),
        sortOrder || 0,
        numericId
      );
      res.json({ success: true });
    } catch (err) { next(err); }
  });

  router.delete('/:type/:id', validatePresetType, (req, res, next) => {
    try {
      const { id } = req.params;
      const config = req.presetConfig;
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
