import { Router } from 'express';

export function createStateRouter(db) {
  const router = Router();

  router.get('/:key', (req, res, next) => {
    try {
      const row = db.prepare('SELECT value FROM app_state WHERE key = ?').get(req.params.key);
      res.json({ value: row ? row.value : null });
    } catch (err) { next(err); }
  });

  router.put('/:key', (req, res, next) => {
    try {
      const { value } = req.body;
      db.prepare(
        'INSERT INTO app_state (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
      ).run(req.params.key, String(value));
      res.json({ success: true });
    } catch (err) { next(err); }
  });

  router.delete('/:key', (req, res, next) => {
    try {
      db.prepare('DELETE FROM app_state WHERE key = ?').run(req.params.key);
      res.json({ success: true });
    } catch (err) { next(err); }
  });

  return router;
}
