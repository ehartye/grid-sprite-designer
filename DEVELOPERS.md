# Developer Guide

## Architecture Overview

Grid Sprite Designer is a dual-server application:

- **Vite dev server** (port 5174) — serves the React frontend with HMR
- **Express API server** (port 3002) — handles API requests, database, and file I/O

In development, `npm run dev` starts both servers via `concurrently`. The Vite dev server proxies `/api` and `/test-fixtures` requests to Express (configured in `vite.config.js`).

```
Browser :5174 --> Vite (static + HMR)
                  |
                  +--> /api/*           --> Express :3002
                  +--> /test-fixtures/* --> Express :3002
```

## Prerequisites

- Node.js >= 20
- A Google Gemini API key

## Getting Started

```bash
# Install dependencies
npm install

# Create your environment file (gitignored)
cp .env.example .env.local
# Edit .env.local and set GEMINI_API_KEY

# Start development servers
npm run dev
```

The Express server loads `.env.local` via `dotenv`. It will exit immediately if `GEMINI_API_KEY` is not set.

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `GEMINI_API_KEY` | Yes | — | Google Gemini API key for image generation |
| `PORT` | No | `3002` | Express server port |
| `DB_PATH` | No | `data/grid-sprite.db` | SQLite database file path |
| `NODE_ENV` | No | `development` | Node environment |
| `ALLOWED_ORIGINS` | No | `http://localhost:5173,http://localhost:5174` | Comma-separated CORS origins |

See `.env.example` for the full reference.

## Database

The app uses SQLite via `better-sqlite3` with WAL mode and foreign keys enabled.

- **Auto-creation**: The `data/` directory and database file are created on first server start
- **Schema + migrations**: `server/db.js` runs `createSchema()` and `migrateSchema()` on every startup (idempotent `CREATE TABLE IF NOT EXISTS`)
- **Seeding**: Preset data (character, building, terrain, background, isometric grid, animation series) is seeded on startup
- **Location**: Defaults to `data/grid-sprite.db` (gitignored), override with `DB_PATH` env var

## Port Conflict Auto-Kill

In development (`NODE_ENV=development`), if port 3002 is already in use, the server automatically detects the conflicting process and kills it before restarting. This handles stale processes from crashed dev sessions. See `server/index.js` lines 612-642.

This behavior is disabled in production.

## Directory Structure

```
server/              Express API server
  index.js           Main server, routes, static serving
  db.js              SQLite setup, schema, migrations, seed data
  routes/generate.js Image generation endpoint (Gemini API)
  utils.js           Shared server utilities
  presetTables.js    Preset type configuration registry
  __tests__/         Server unit tests

src/                 React frontend (Vite)
  App.tsx            Root component, sprite type routing
  main.tsx           Entry point
  api/               API client functions
  components/        React components
  context/           AppContext, reducer, state management
  hooks/             Custom React hooks (workflows, etc.)
  lib/               Pure utility functions, prompt builders
  styles/            CSS (global.css, admin.css, run-builder.css)
  types/             TypeScript type definitions

tests/               Playwright e2e tests
  extraction.spec.ts Sprite extraction integration tests

test-fixtures/       Test fixture images and manifests
scripts/             Maintenance scripts (fixture export, sync)
data/                SQLite database (gitignored, auto-created)
output/              Exported sprite sheets (gitignored)
screenshots/         README screenshots
```

## Testing

```bash
# Unit tests (vitest)
npm run test:unit

# Unit tests with coverage
npm run test:coverage

# E2E tests (Playwright — requires running servers)
npm test

# Type checking
npm run typecheck
```

Unit tests live alongside source files in `__tests__/` directories. E2E tests are in `tests/extraction.spec.ts`.

## API Request Flow

1. Browser makes a request to `/api/*` on port 5174
2. Vite dev server proxy forwards it to Express on port 3002
3. Express processes the request (database, Gemini API, file I/O)
4. Response flows back through the proxy to the browser

In production builds (`npm run build` + `npm run preview`), the Vite proxy is not used — requests go directly to Express, controlled by `ALLOWED_ORIGINS`.

## NPM Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start both Vite and Express dev servers |
| `npm run dev:client` | Start Vite dev server only |
| `npm run dev:server` | Start Express server with `--watch` |
| `npm run build` | Production build (Vite) |
| `npm run test:unit` | Run vitest unit tests |
| `npm run test:coverage` | Run vitest with coverage |
| `npm test` | Run Playwright e2e tests |
| `npm run typecheck` | TypeScript type checking |
