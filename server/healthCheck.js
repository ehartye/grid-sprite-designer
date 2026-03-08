export function createHealthHandler(db, geminiKeyConfigured) {
  return (_req, res) => {
    let dbStatus = 'ok';
    try {
      db.prepare('SELECT 1').get();
    } catch {
      dbStatus = 'error';
    }

    const status = dbStatus === 'ok' ? 'ok' : 'degraded';
    const code = status === 'ok' ? 200 : 503;

    res.status(code).json({
      status,
      db: dbStatus,
      uptime: process.uptime(),
      geminiKeyConfigured,
    });
  };
}
