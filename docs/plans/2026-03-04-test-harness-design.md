# Test Harness Formalization Design

**Goal:** Formalize the sprite extraction test harness into an automated, CI-friendly suite that respects each fixture's grid profile, with a custom HTML audit report for visual inspection.

**Approach:** Manifest-driven Playwright tests with auto-discovery, DB-to-manifest sync script, and a self-contained HTML audit report generated after each test run.

---

## 1. Fixture Manifest System

Each fixture image in `test-fixtures/` gets a companion `.manifest.json` with its grid profile:

```json
{
  "spriteType": "building",
  "gridSize": "3x3",
  "cols": 3,
  "rows": 3,
  "totalCells": 9,
  "cellLabels": ["Day - Idle", "Day - Smoke Rising", "..."],
  "templateCellW": 680,
  "templateCellH": 680,
  "headerH": 22,
  "border": 2,
  "contentPreset": "medieval-inn"
}
```

Character fixtures use defaults (6x6, 339x339 cells) so their manifests are minimal — just `spriteType: "character"`.

**Sync script:** `scripts/sync-fixture-manifests.ts` reads the DB (grid_presets + content presets), matches to existing fixture images by name, and writes/updates manifests. Run manually after changing presets: `npm run test:sync-manifests`.

Manifests are committed to git (source of truth at test time). The sync script keeps them current with DB changes.

## 2. Test Discovery & Execution

The test spec (`tests/extraction.spec.ts`) becomes fully data-driven:

- **Auto-discovery:** At test setup, scan `test-fixtures/*.manifest.json` and generate a test case per manifest. No more hardcoded fixture lists.
- **Extraction:** Each test loads the fixture image, reads its manifest, builds `ExtractionConfig` from manifest data, and calls the production `extractSprites()` via the browser harness — same Canvas API code path as the real application.
- **Grid-profile-aware assertions:**
  - Sprite count matches `manifest.totalCells`
  - Dimension uniformity checked within the manifest's grid layout (row uniformity uses `manifest.cols`, not hardcoded 6)
  - Header bleed and dark band thresholds adapt per `spriteType` (buildings tolerate more dark content than characters)
- **The extraction-harness.html** stays as the browser entry point but reads manifest data from query params. It imports and calls the real `extractSprites()` — identical code path to production.

## 3. Custom HTML Audit Report

After all tests complete, a report generator produces `test-results/audit-report.html`:

**Layout:**
- Header with overall pass/fail count, timestamp, total fixtures tested
- One card per fixture (failures first), containing:
  - Fixture name, sprite type badge, grid dimensions
  - Visual sprite grid at correct cols/rows layout with checkerboard transparency
  - Per-sprite metrics: header bleed %, worst dark band %, dimensions
  - Color-coded indicators: green/yellow/red per metric
  - Expandable "Top 10px" strip view for header bleed inspection

**Generation:**
- Each Playwright test writes results (metrics JSON + per-sprite base64 data) to `test-results/fixtures/<name>.json`
- A Playwright `globalTeardown` script reads all fixture result JSONs and assembles the HTML report
- Report is self-contained (inline CSS, inline base64 images) — opens without a server

## 4. npm Scripts & CI Integration

**Scripts:**
- `npm test` — runs Playwright headless, generates fixture result JSONs, assembles HTML report
- `npm run test:report` — opens `test-results/audit-report.html` in default browser
- `npm run test:sync-manifests` — runs the DB-to-manifest sync script

**CI considerations:**
- No server needed (Vite dev server via Playwright's `webServer` config, already configured)
- No Gemini API key needed (fixture-only)
- `test-results/` stays gitignored
- `test-fixtures/*.manifest.json` committed to git

## 5. File Structure

```
scripts/
  sync-fixture-manifests.ts        ← NEW: DB → manifest sync
tests/
  extraction.spec.ts               ← REWRITE: manifest-driven, auto-discovery
  extraction-harness.html           ← UPDATE: read manifest params
  report-generator.ts              ← NEW: assembles HTML audit report
  playwright-global-teardown.ts    ← NEW: triggers report generation
test-fixtures/
  *.jpg                            ← existing fixtures
  *.manifest.json                  ← NEW: companion manifests
test-results/                      ← gitignored
  fixtures/*.json                  ← per-fixture metrics (generated)
  audit-report.html                ← final report (generated)
```
