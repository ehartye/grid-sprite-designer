import { Router } from 'express';

const VALID_STATE_KEYS = ['lastHistoryId'];

export function createStateRouter(db) {
  const router = Router();

  // Validate key for all routes
  router.use('/:key', (req, res, next) => {
    if (!VALID_STATE_KEYS.includes(req.params.key)) {
      return res.status(400).json({ error: `Invalid state key. Allowed keys: ${VALID_STATE_KEYS.join(', ')}` });
    }
    next();
  });

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
      const result = db.prepare('DELETE FROM app_state WHERE key = ?').run(req.params.key);
      if (result.changes === 0) return res.status(404).json({ error: 'Not found' });
      res.json({ success: true });
    } catch (err) { next(err); }
  });

  return router;
}
