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
      const { id } = req.params;
      const numericId = parseIntParam(id);
      const config = req.presetConfig;

      // Support text-slug IDs (seeded presets) and numeric rowids (user-created presets
      // inserted without an explicit id value).
      const row = numericId !== null
        ? db.prepare(`SELECT * FROM ${config.table} WHERE id = ? OR rowid = ?`).get(id, numericId)
        : db.prepare(`SELECT * FROM ${config.table} WHERE id = ?`).get(id);

      if (!row) return res.status(404).json({ error: 'Not found' });
      res.json(mapPresetRow(row, config.columns));
    } catch (err) { next(err); }
  });

  router.post('/:type', validatePresetType, (req, res, next) => {
    try {
      const config = req.presetConfig;

      // Generate a unique slug id from the preset name
      const baseName = (req.body.name || 'preset').toString();
      const baseSlug = baseName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      let slug = baseSlug;
      let suffix = 2;
      while (db.prepare(`SELECT 1 FROM ${config.table} WHERE id = ?`).get(slug)) {
        slug = `${baseSlug}-${suffix++}`;
      }

      const dbCols = ['id', ...config.columns.map(c => c.column)];
      const placeholders = dbCols.map(() => '?').join(', ');
      const values = extractPresetValues(req.body, config.columns);
      db.prepare(
        `INSERT INTO ${config.table} (${dbCols.join(', ')}, is_preset) VALUES (${placeholders}, 1)`
      ).run(slug, ...values);
      res.status(201).json({ id: slug });
    } catch (err) { next(err); }
  });

  router.put('/:type/:id', validatePresetType, (req, res, next) => {
    try {
      const { id } = req.params;
      const numericId = parseIntParam(id);
      const config = req.presetConfig;

      const setClauses = config.columns.map(c => `${c.column}=?`).join(', ');
      const values = extractPresetValues(req.body, config.columns);
      const result = numericId !== null
        ? db.prepare(`UPDATE ${config.table} SET ${setClauses} WHERE id=? OR rowid=?`).run(...values, id, numericId)
        : db.prepare(`UPDATE ${config.table} SET ${setClauses} WHERE id=?`).run(...values, id);
      if (result.changes === 0) return res.status(404).json({ error: 'Not found' });
      res.json({ success: true });
    } catch (err) { next(err); }
  });

  router.delete('/:type/:id', validatePresetType, (req, res, next) => {
    try {
      const { id } = req.params;
      const numericId = parseIntParam(id);
      const config = req.presetConfig;

      // Junction links cascade via ON DELETE CASCADE, but delete explicitly just in case
      if (numericId !== null) {
        db.prepare(`DELETE FROM ${config.linkTable} WHERE ${config.fk} = (SELECT id FROM ${config.table} WHERE id = ? OR rowid = ?)`).run(id, numericId);
        const result = db.prepare(`DELETE FROM ${config.table} WHERE id = ? OR rowid = ?`).run(id, numericId);
        if (result.changes === 0) return res.status(404).json({ error: 'Not found' });
      } else {
        db.prepare(`DELETE FROM ${config.linkTable} WHERE ${config.fk} = ?`).run(id);
        const result = db.prepare(`DELETE FROM ${config.table} WHERE id = ?`).run(id);
        if (result.changes === 0) return res.status(404).json({ error: 'Not found' });
      }
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
        SELECT l.id, l.grid_preset_id, l.sort_order,
               l.overall_guidance as link_overall_guidance,
               l.group_guidance as link_group_guidance,
               l.cell_guidance as link_cell_guidance,
               g.name as grid_name, g.grid_size, g.cols, g.rows,
               g.cell_labels, g.cell_groups,
               g.overall_guidance as grid_overall_guidance,
               g.group_guidance as grid_group_guidance,
               g.cell_guidance as grid_cell_guidance,
               g.bg_mode, g.aspect_ratio, g.tile_shape
        FROM ${table} l
        JOIN grid_presets g ON g.id = l.grid_preset_id
        WHERE l.${fk} = ?
        ORDER BY l.sort_order
      `).all(id);
      res.json(links.map(l => ({
        id: l.id,
        gridPresetId: l.grid_preset_id,
        gridGuidance: {
          overall: l.grid_overall_guidance || '',
          groups: JSON.parse(l.grid_group_guidance || '{}'),
          cells: JSON.parse(l.grid_cell_guidance || '{}'),
        },
        linkGuidance: {
          overall: l.link_overall_guidance || '',
          groups: JSON.parse(l.link_group_guidance || '{}'),
          cells: JSON.parse(l.link_cell_guidance || '{}'),
        },
        sortOrder: l.sort_order,
        gridName: l.grid_name,
        gridSize: l.grid_size,
        cols: l.cols,
        rows: l.rows,
        cellLabels: JSON.parse(l.cell_labels),
        cellGroups: JSON.parse(l.cell_groups),
        bgMode: l.bg_mode,
        aspectRatio: l.aspect_ratio || '1:1',
        tileShape: l.tile_shape || 'square',
      })));
    } catch (err) { next(err); }
  });

  router.post('/:type/:id/grid-links', validatePresetType, (req, res, next) => {
    try {
      const { id } = req.params;
      const config = req.presetConfig;
      const { gridPresetId, overallGuidance, groupGuidance, cellGuidance, sortOrder } = req.body;
      if (!gridPresetId) return res.status(400).json({ error: 'Missing gridPresetId' });
      const { linkTable: table, fk } = config;
      const result = db.prepare(`
        INSERT INTO ${table} (${fk}, grid_preset_id, overall_guidance, group_guidance, cell_guidance, sort_order)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(id, gridPresetId,
        overallGuidance || '',
        JSON.stringify(groupGuidance || {}),
        JSON.stringify(cellGuidance || {}),
        sortOrder || 0
      );
      res.status(201).json({ id: Number(result.lastInsertRowid) });
    } catch (err) { next(err); }
  });

  return router;
}
