import { Router } from 'express';
import { parseIntParam, extractPresetValues, mapPresetRow } from '../utils.js';
import { PRESET_TABLES } from '../presetTables.js';
import { validatePresetType } from '../middleware.js';

export function createPresetsRouter(db) {
  const router = Router();

  router.get('/', (req, res, next) => {
    try {
      const type = req.query.type || 'character';
      const config = PRESET_TABLES[type];
      if (!config) return res.status(400).json({ error: 'Invalid type' });

      const rows = db.prepare(`
        SELECT p.*, COUNT(l.id) as grid_link_count
        FROM ${config.table} p
        LEFT JOIN ${config.linkTable} l ON l.${config.fk} = p.id
        WHERE p.is_preset = 1
        GROUP BY p.id
        ORDER BY p.name
      `).all();
      res.json(rows.map(r => ({ ...mapPresetRow(r, config.columns), gridLinkCount: r.grid_link_count })));
    } catch (err) { next(err); }
  });

  router.get('/:type/:id', validatePresetType, (req, res, next) => {
    try {
      const id = parseIntParam(req.params.id);
      if (id === null) return res.status(400).json({ error: 'Invalid id' });
      const config = req.presetConfig;

      const row = db.prepare(`SELECT * FROM ${config.table} WHERE id = ? AND is_preset = 1`).get(id);
      if (!row) return res.status(404).json({ error: 'Not found' });
      res.json(mapPresetRow(row, config.columns));
    } catch (err) { next(err); }
  });

  router.post('/:type', validatePresetType, (req, res, next) => {
    try {
      const config = req.presetConfig;

      const dbCols = config.columns.map(c => c[1]);
      const placeholders = dbCols.map(() => '?').join(', ');
      const values = extractPresetValues(req.body, config.columns);
      const result = db.prepare(
        `INSERT INTO ${config.table} (${dbCols.join(', ')}, is_preset) VALUES (${placeholders}, 1)`
      ).run(...values);
      res.status(201).json({ id: Number(result.lastInsertRowid) });
    } catch (err) { next(err); }
  });

  router.put('/:type/:id', validatePresetType, (req, res, next) => {
    try {
      const id = parseIntParam(req.params.id);
      if (id === null) return res.status(400).json({ error: 'Invalid id' });
      const config = req.presetConfig;

      const setClauses = config.columns.map(c => `${c[1]}=?`).join(', ');
      const values = extractPresetValues(req.body, config.columns);
      const result = db.prepare(
        `UPDATE ${config.table} SET ${setClauses} WHERE id=?`
      ).run(...values, id);
      if (result.changes === 0) return res.status(404).json({ error: 'Not found' });
      res.json({ success: true });
    } catch (err) { next(err); }
  });

  router.delete('/:type/:id', validatePresetType, (req, res, next) => {
    try {
      const id = parseIntParam(req.params.id);
      if (id === null) return res.status(400).json({ error: 'Invalid id' });
      const config = req.presetConfig;

      // Junction links cascade via ON DELETE CASCADE, but delete explicitly just in case
      db.prepare(`DELETE FROM ${config.linkTable} WHERE ${config.fk} = ?`).run(id);
      const result = db.prepare(`DELETE FROM ${config.table} WHERE id = ?`).run(id);
      if (result.changes === 0) return res.status(404).json({ error: 'Not found' });
      res.json({ success: true });
    } catch (err) { next(err); }
  });

  // Grid link endpoints for presets
  router.get('/:type/:id/grid-links', validatePresetType, (req, res, next) => {
    try {
      const { id } = req.params;
      const config = req.presetConfig;
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

  router.post('/:type/:id/grid-links', validatePresetType, (req, res, next) => {
    try {
      const { id } = req.params;
      const config = req.presetConfig;
      const { gridPresetId, guidanceOverride, sortOrder } = req.body;
      if (!gridPresetId) return res.status(400).json({ error: 'Missing gridPresetId' });
      const { linkTable: table, fk } = config;
      const result = db.prepare(`
        INSERT INTO ${table} (${fk}, grid_preset_id, guidance_override, sort_order)
        VALUES (?, ?, ?, ?)
      `).run(id, gridPresetId, guidanceOverride || '', sortOrder || 0);
      res.status(201).json({ id: Number(result.lastInsertRowid) });
    } catch (err) { next(err); }
  });

  return router;
}
