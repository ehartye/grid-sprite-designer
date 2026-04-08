# Grid Sprite Designer

AI sprite sheet generator using Google Gemini. React + Express + SQLite.

## Commands

```bash
npm run dev          # Start client (Vite :5174) + server (Express :3002) concurrently
npm run build        # Vite production build
npm run typecheck    # TypeScript type checking
npm run lint         # ESLint (src + server)
npm test             # Playwright e2e tests
npm run test:unit    # Vitest unit tests
```

## Environment

Requires `GEMINI_API_KEY` in `.env.local`. Copy `.env.example` to start.

## Architecture

- **Frontend**: `src/` — React 18, CSS (no framework), Vite
- **Backend**: `server/` — Express, better-sqlite3 (WAL mode)
- **State**: React Context + useReducer (`src/context/AppContext.tsx`)
- **DB**: `data/grid-sprite.db` — auto-created, schema + migrations run on startup
- **Output**: `output/` — archived sprite sheets (gitignored)

## Key Patterns

- Workflows: `src/hooks/useGenericWorkflow.ts` — shared generate->extract->save pipeline
- Prompt builders: `src/lib/promptBuilderBase.ts` + per-type builders assemble hierarchical guidance
- Generation pipeline: `runGeneratePipeline()` -> template -> Gemini API -> extract sprites -> save history -> archive
- Edit pipeline: `useRegenerateWithFeedback` -> `editGrid()` (no template, feedback-only prompt)
- Grid links: content presets link to grid presets with per-link guidance overrides
- Hierarchical guidance: grid defaults -> link overrides -> preset guidance, merged in `buildGuidanceBlock()`

## Generation Flows

1. **New sprite**: configure -> `useGenericWorkflow.generate()` -> `runGeneratePipeline()`
2. **Add sheet**: review -> `useAddSheet` -> same pipeline with reference image
3. **Multi-grid run**: `useRunWorkflow` -> sequential grids with reference continuity
4. **Regenerate with feedback**: review -> `useRegenerateWithFeedback` -> edit mode (source image only, no template)

## API

- `POST /api/generate-grid` — Gemini proxy (generate mode + edit mode via `mode: 'edit'`)
- `GET/POST /api/history` — Generation CRUD
- `PATCH /api/history/:id/feedback` — Save feedback JSON
- `GET /api/history/:id/children` — Version chain children
- `GET /api/history/max-version` — Next version number for branching
- `GET/POST /api/presets/:type` — Content preset CRUD
- `GET /api/presets/:type/:id/grid-links` — Grid links for a preset
- `GET /api/gallery` — Paginated gallery with search/filter

## Database Gotchas

- Migrations in `server/db/migrations.js` — append-only array, run idempotently on startup
- Schema in `server/db/schema.js` — must match migrations for new DBs
- Seed data in `server/db/seeds/` — re-seeded on startup if missing
- `generations.filled_grid_image` stores full base64 — rows can be large

## CSS

- Design system: "Pixel Studio" theme — `src/styles/global.css`
- CSS variables: `--bg-base`, `--bg-panel`, `--bg-card`, `--accent` (#c8ff00), `--border`
- Do NOT use `--surface-0/1/2` — they don't exist. Use `--bg-base`, `--bg-panel`, `--bg-card-hover`
- Fonts: Syne (display), Outfit (UI), JetBrains Mono (mono)
- Components reuse: `.config-field`, `.segmented-control`, `.sidebar-section`, `.anim-group-btn`

## Testing

- Unit: Vitest (`npm run test:unit`), files in `__tests__/` dirs
- E2E: Playwright (`npm test`), sprite extraction integration
- Fixtures: `test-fixtures/` with test images + manifests
- Body limit: 50MB for generate/history/archive routes
