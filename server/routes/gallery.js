import { Router } from 'express';

export function createGalleryRouter(db) {
  const router = Router();

  router.get('/', (req, res, next) => {
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
        `SELECT g.id, g.content_name, g.content_description, g.model, g.image_size, g.thinking_level, g.created_at, g.sprite_type, g.grid_size, g.group_id, g.generation_version, g.content_preset_id,
              (SELECT COUNT(*) FROM sprites WHERE generation_id = g.id) as sprite_count,
              COALESCE(g.thumbnail_image, (SELECT s.image_data FROM sprites s WHERE s.generation_id = g.id AND s.cell_index = COALESCE(g.thumbnail_cell_index, 0) LIMIT 1)) as thumb_data,
              COALESCE(g.thumbnail_mime, (SELECT s.mime_type FROM sprites s WHERE s.generation_id = g.id AND s.cell_index = COALESCE(g.thumbnail_cell_index, 0) LIMIT 1)) as thumb_mime,
              (SELECT gp.name FROM grid_presets gp WHERE gp.grid_size = g.grid_size AND gp.sprite_type = g.sprite_type LIMIT 1) as grid_preset_name
       FROM generations g ${where} ORDER BY g.created_at DESC LIMIT ? OFFSET ?`
      ).all(...params, limit, offset);

      res.json({
        entries: rows.map(r => ({
          id: r.id,
          contentName: r.content_name,
          contentDescription: r.content_description,
          model: r.model,
          imageSize: r.image_size,
          thinkingLevel: r.thinking_level,
          createdAt: r.created_at,
          spriteType: r.sprite_type || 'character',
          gridSize: r.grid_size,
          groupId: r.group_id,
          spriteCount: r.sprite_count,
          generationVersion: r.generation_version || 1,
          gridPresetName: r.grid_preset_name || null,
          thumbnailData: r.thumb_data,
          thumbnailMime: r.thumb_mime,
        })),
        total,
        page,
        totalPages: Math.ceil(total / limit),
      });
    } catch (err) { next(err); }
  });

  return router;
}
