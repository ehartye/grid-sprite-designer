import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { getDb } from './db/index.js';
import { createGenerateRouter } from './routes/generate.js';
import { createHistoryRouter } from './routes/history.js';
import { createPresetsRouter } from './routes/presets.js';
import { createGridPresetsRouter } from './routes/gridPresets.js';
import { createGridLinksRouter } from './routes/gridLinks.js';
import { createGalleryRouter } from './routes/gallery.js';
import { createStateRouter } from './routes/state.js';
import { createArchiveRouter } from './routes/archive.js';
import { createHealthHandler } from './healthCheck.js';
import { requestId } from './middleware.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, '..', 'output');

const app = express();
const PORT = Number.isFinite(Number(process.env.PORT)) ? Number(process.env.PORT) : 3002;

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
  : ['http://localhost:5173', 'http://localhost:5174'];
app.use(cors({ origin: allowedOrigins }));
app.use(requestId);

if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
}

// Routes that carry base64 image data need a larger body limit.
// Apply the 50MB parser to those paths first, then fall back to 1MB for everything else.
const largeBodyParser = express.json({ limit: '50mb' });
app.use('/api/generate-grid', largeBodyParser);
app.use('/api/history', largeBodyParser);
app.use('/api/archive', largeBodyParser);
app.use(express.json({ limit: '1mb' }));

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error('GEMINI_API_KEY not found in environment. Create a .env.local file.');
  process.exit(1);
}

// Initialize database
const db = getDb();
console.log('[Server] Database initialized.');

// Mount route modules
app.use('/api', createGenerateRouter(apiKey));
app.use('/api/history', createHistoryRouter(db));
app.use('/api/presets', createPresetsRouter(db));
app.use('/api/grid-presets', createGridPresetsRouter(db));
app.use('/api/grid-links', createGridLinksRouter(db));
app.use('/api/gallery', createGalleryRouter(db));
app.use('/api/state', createStateRouter(db));
app.use('/api/archive', createArchiveRouter(OUTPUT_DIR));

// Serve archive files statically
app.use('/output', express.static(OUTPUT_DIR));

// Serve test files (dev only)
if (process.env.NODE_ENV !== 'production') {
  app.use('/tests', express.static(join(__dirname, '..', 'tests')));
  app.use('/test-fixtures', express.static(join(__dirname, '..', 'test-fixtures')));
}

// Health check
app.get('/health', createHealthHandler(db, !!apiKey));

// Global error handler
app.use((err, req, res, _next) => {
  console.error(`[Server] Unhandled error [${req.id || '?'}] ${req.method} ${req.url}:`, err);
  res.status(500).json({ error: 'Internal server error' });
});

const server = app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE' && process.env.NODE_ENV === 'development') {
    console.log(`[Server] Port ${PORT} in use, killing existing process...`);
    import('child_process').then(({ execSync }) => {
      try {
        const isWin = process.platform === 'win32';
        if (isWin) {
          const out = execSync(`netstat -ano | findstr ":${PORT}" | findstr LISTENING`, { encoding: 'utf8' }).trim();
          const pid = out.split(/\s+/).pop();
          if (pid && /^\d+$/.test(pid)) {
            execSync(`taskkill /F /PID ${pid}`);
            console.log(`[Server] Killed PID ${pid}, restarting...`);
            setTimeout(() => server.listen(PORT), 1000);
          }
        } else {
          const pid = execSync(`lsof -ti:${PORT}`, { encoding: 'utf8' }).trim();
          if (pid) {
            process.kill(Number(pid), 'SIGKILL');
            console.log(`[Server] Killed PID ${pid}, restarting...`);
            setTimeout(() => server.listen(PORT), 1000);
          }
        }
      } catch {
        console.error(`[Server] Could not kill process on port ${PORT}. Stop it manually and retry.`);
        process.exit(1);
      }
    });
  } else {
    throw err;
  }
});

// Graceful shutdown
function shutdown(signal) {
  console.log(`[Server] ${signal} received, shutting down gracefully...`);
  server.close(() => {
    console.log('[Server] HTTP server closed.');
    try {
      db.close();
      console.log('[Server] Database closed.');
    } catch (err) {
      console.error('[Server] Error closing database:', err);
    }
    process.exit(0);
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  console.error('[Server] Unhandled promise rejection:', reason instanceof Error ? reason.stack : reason);
});

process.on('uncaughtException', (err) => {
  console.error('[Server] Uncaught exception:', err);
  shutdown('uncaughtException');
});
