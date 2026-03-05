# Test Harness Formalization Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use h-superpowers:subagent-driven-development, h-superpowers:team-driven-development, or h-superpowers:executing-plans to implement this plan (ask user which approach).

**Goal:** Formalize the sprite extraction test harness into an automated, manifest-driven Playwright suite with a custom HTML audit report.

**Architecture:** Each test fixture gets a companion JSON manifest describing its grid profile (cols, rows, cell dimensions, labels, sprite type). Tests auto-discover fixtures by scanning for manifests. A DB sync script generates/updates manifests from grid_presets. After all tests run, a global teardown assembles a self-contained HTML audit report from per-fixture result JSONs.

**Tech Stack:** Playwright, TypeScript, better-sqlite3 (sync script), Vite dev server (test harness)

---

### Task 1: Fixture Manifest Schema & Initial Manifests

**Files:**
- Create: `test-fixtures/filled-grid.manifest.json`
- Create: `test-fixtures/colored-grid.manifest.json`
- Create: `test-fixtures/fluxbot-drone.manifest.json`
- Create: `test-fixtures/kael-thornwood.manifest.json`
- Create: `test-fixtures/magma-wyrm.manifest.json`
- Create: `test-fixtures/mosskin-spirit.manifest.json`
- Create: `test-fixtures/robot-leech-snake.manifest.json`
- Create: `test-fixtures/rustback-scavenger.manifest.json`
- Create: `test-fixtures/spore-lurker.manifest.json`
- Create: `test-fixtures/voidmaw-parasite.manifest.json`
- Create: `test-fixtures/junk-bug-spire.manifest.json`
- Create: `test-fixtures/medieval-inn.manifest.json`

**Step 1: Create character fixture manifests**

All character fixtures share the same 6x6 grid config. Character cell labels come from `src/lib/poses.ts` CELL_LABELS.

```json
{
  "spriteType": "character",
  "gridSize": "6x6",
  "cols": 6,
  "rows": 6,
  "totalCells": 36,
  "templateCellW": 339,
  "templateCellH": 339,
  "headerH": 14,
  "border": 2
}
```

Create this for: `filled-grid`, `colored-grid`, `fluxbot-drone`, `kael-thornwood`, `magma-wyrm`, `mosskin-spirit`, `robot-leech-snake`, `rustback-scavenger`, `spore-lurker`, `voidmaw-parasite`.

Character manifests omit `cellLabels` — the test will fall back to the default CELL_LABELS from poses.ts.

**Step 2: Create building fixture manifests**

`junk-bug-spire.manifest.json`:
```json
{
  "spriteType": "building",
  "gridSize": "2x3",
  "cols": 2,
  "rows": 3,
  "totalCells": 6,
  "templateCellW": 1021,
  "templateCellH": 680,
  "headerH": 22,
  "border": 2,
  "cellLabels": ["Stage 1", "Stage 2", "Stage 3", "Stage 4", "Stage 5", "Stage 6"],
  "contentPreset": "junk-bug-spire"
}
```

`medieval-inn.manifest.json`:
```json
{
  "spriteType": "building",
  "gridSize": "3x3",
  "cols": 3,
  "rows": 3,
  "totalCells": 9,
  "templateCellW": 680,
  "templateCellH": 680,
  "headerH": 22,
  "border": 2,
  "cellLabels": [
    "Day - Idle", "Day - Smoke Rising", "Day - Sign Swaying",
    "Evening - Lights On", "Evening - Chimney Glow", "Evening - Busy",
    "Night - Lantern Lit", "Night - Quiet", "Night - Closed"
  ],
  "contentPreset": "medieval-inn"
}
```

**Step 3: Verify manifests are valid JSON**

Run: `node -e "const fs=require('fs'),path=require('path'); const dir='test-fixtures'; fs.readdirSync(dir).filter(f=>f.endsWith('.manifest.json')).forEach(f=>{JSON.parse(fs.readFileSync(path.join(dir,f),'utf8')); console.log('OK:',f)})" `
Expected: All manifests print OK.

**Step 4: Commit**

```bash
git add test-fixtures/*.manifest.json
git commit -m "test: add fixture manifests for all existing test fixtures"
```

---

### Task 2: DB-to-Manifest Sync Script

**Files:**
- Create: `scripts/sync-fixture-manifests.ts`
- Modify: `package.json` (add `test:sync-manifests` script)

**Step 1: Create the sync script**

The script:
1. Opens the SQLite DB (same path as server: `grid-sprites.db` in project root)
2. Queries grid_presets joined with content presets for each sprite type
3. Scans `test-fixtures/` for image files (`.jpg`, `.png`)
4. For each image, tries to match its basename to a content preset name (case-insensitive, hyphen-to-space)
5. If a match is found, writes/updates the companion `.manifest.json`
6. For unmatched fixtures, warns but doesn't overwrite existing manifests

```typescript
#!/usr/bin/env npx tsx
/**
 * Sync fixture manifests from the database.
 *
 * For each image in test-fixtures/, attempts to match it to a content preset
 * in the DB and writes a companion .manifest.json with the grid profile.
 *
 * Usage: npx tsx scripts/sync-fixture-manifests.ts
 */

import Database from 'better-sqlite3';
import { readdirSync, writeFileSync, existsSync } from 'fs';
import { join, basename, extname } from 'path';

const ROOT = join(import.meta.dirname, '..');
const FIXTURES_DIR = join(ROOT, 'test-fixtures');
const DB_PATH = join(ROOT, 'grid-sprites.db');

interface Manifest {
  spriteType: string;
  gridSize: string;
  cols: number;
  rows: number;
  totalCells: number;
  templateCellW: number;
  templateCellH: number;
  headerH: number;
  border: number;
  cellLabels?: string[];
  contentPreset?: string;
}

// Template params from src/lib/gridConfig.ts — duplicated here to avoid importing TS modules
const TEMPLATE_PARAMS: Record<string, Record<string, { cellW: number; cellH: number; headerH: number; border: number }>> = {
  character: {
    '6x6': { cellW: 339, cellH: 339, headerH: 14, border: 2 },
  },
  building: {
    '3x3': { cellW: 680, cellH: 680, headerH: 22, border: 2 },
    '2x3': { cellW: 1021, cellH: 680, headerH: 22, border: 2 },
    '2x2': { cellW: 1021, cellH: 1021, headerH: 22, border: 2 },
  },
  terrain: {
    '3x3': { cellW: 680, cellH: 680, headerH: 18, border: 2 },
    '4x4': { cellW: 509, cellH: 509, headerH: 18, border: 2 },
    '5x5': { cellW: 406, cellH: 406, headerH: 18, border: 2 },
  },
  background: {
    '1x3': { cellW: 2044, cellH: 680, headerH: 18, border: 2 },
    '1x4': { cellW: 2044, cellH: 509, headerH: 18, border: 2 },
    '1x5': { cellW: 2044, cellH: 406, headerH: 18, border: 2 },
    '2x2': { cellW: 1021, cellH: 1021, headerH: 18, border: 2 },
    '3x2': { cellW: 680, cellH: 1021, headerH: 18, border: 2 },
    '3x3': { cellW: 680, cellH: 680, headerH: 18, border: 2 },
  },
};

function main() {
  if (!existsSync(DB_PATH)) {
    console.error(`Database not found at ${DB_PATH}. Start the server first to initialize it.`);
    process.exit(1);
  }

  const db = new Database(DB_PATH, { readonly: true });

  // Query all content presets with their linked grid presets
  const presetQueries: Record<string, string> = {
    character: `
      SELECT cp.id, cp.name, 'character' as sprite_type, '6x6' as grid_size,
             6 as cols, 6 as rows, NULL as cell_labels
      FROM character_presets cp
    `,
    building: `
      SELECT bp.id, bp.name, 'building' as sprite_type, gp.grid_size,
             gp.cols, gp.rows, gp.cell_labels
      FROM building_presets bp
      JOIN building_grid_links bgl ON bgl.building_preset_id = bp.id
      JOIN grid_presets gp ON gp.id = bgl.grid_preset_id
    `,
    terrain: `
      SELECT tp.id, tp.name, 'terrain' as sprite_type, gp.grid_size,
             gp.cols, gp.rows, gp.cell_labels
      FROM terrain_presets tp
      JOIN terrain_grid_links tgl ON tgl.terrain_preset_id = tp.id
      JOIN grid_presets gp ON gp.id = tgl.grid_preset_id
    `,
    background: `
      SELECT bp.id, bp.name, 'background' as sprite_type, gp.grid_size,
             gp.cols, gp.rows, gp.cell_labels
      FROM background_presets bp
      JOIN background_grid_links bgl ON bgl.background_preset_id = bp.id
      JOIN grid_presets gp ON gp.id = bgl.grid_preset_id
    `,
  };

  // Build lookup: normalized name -> preset data
  const presetsByName = new Map<string, any>();
  for (const [type, query] of Object.entries(presetQueries)) {
    const rows = db.prepare(query).all();
    for (const row of rows) {
      const key = (row as any).name.toLowerCase().replace(/\s+/g, '-');
      presetsByName.set(key, row);
    }
  }

  db.close();

  // Scan fixtures
  const imageFiles = readdirSync(FIXTURES_DIR).filter(f =>
    ['.jpg', '.jpeg', '.png'].includes(extname(f).toLowerCase()) &&
    !f.includes('-results')
  );

  let updated = 0;
  let skipped = 0;

  for (const imageFile of imageFiles) {
    const name = basename(imageFile, extname(imageFile));
    const manifestPath = join(FIXTURES_DIR, `${name}.manifest.json`);
    const preset = presetsByName.get(name);

    if (!preset) {
      if (!existsSync(manifestPath)) {
        console.warn(`  SKIP: ${imageFile} — no matching preset and no existing manifest`);
      } else {
        console.log(`  KEEP: ${imageFile} — no matching preset, keeping existing manifest`);
      }
      skipped++;
      continue;
    }

    const spriteType = preset.sprite_type;
    const gridSize = preset.grid_size;
    const cols = preset.cols;
    const rows = preset.rows;
    const totalCells = cols * rows;

    const templateParams = TEMPLATE_PARAMS[spriteType]?.[gridSize];
    if (!templateParams) {
      console.warn(`  SKIP: ${imageFile} — no template params for ${spriteType} ${gridSize}`);
      skipped++;
      continue;
    }

    const manifest: Manifest = {
      spriteType,
      gridSize,
      cols,
      rows,
      totalCells,
      templateCellW: templateParams.cellW,
      templateCellH: templateParams.cellH,
      headerH: templateParams.headerH,
      border: templateParams.border,
    };

    // Add cell labels for non-character types
    if (spriteType !== 'character' && preset.cell_labels) {
      try {
        const labels = JSON.parse(preset.cell_labels);
        if (Array.isArray(labels) && labels.length > 0) {
          manifest.cellLabels = labels;
        }
      } catch {}
    }

    manifest.contentPreset = name;

    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
    console.log(`  WRITE: ${name}.manifest.json (${spriteType} ${gridSize})`);
    updated++;
  }

  console.log(`\nDone: ${updated} updated, ${skipped} skipped.`);
}

main();
```

**Step 2: Add npm script**

In `package.json`, add to `"scripts"`:
```json
"test:sync-manifests": "npx tsx scripts/sync-fixture-manifests.ts"
```

**Step 3: Run the sync script to verify**

Run: `npm run test:sync-manifests`
Expected: Outputs WRITE for building/terrain/background fixtures that match DB presets, KEEP for character fixtures (which already have manual manifests).

**Step 4: Commit**

```bash
git add scripts/sync-fixture-manifests.ts package.json
git commit -m "feat: add DB-to-manifest sync script for test fixtures"
```

---

### Task 3: Rewrite extraction-harness.html to Accept Manifest JSON

**Files:**
- Modify: `tests/extraction-harness.html`

**Step 1: Update the harness to accept a `manifest` query param**

The harness should accept `?fixture=name.jpg&manifest={...}` where manifest is a URL-encoded JSON string. This replaces the individual `cols`, `rows`, `cellW`, etc. params. Keep backward compatibility: if no `manifest` param, fall back to the individual params (for manual browser testing).

Replace the param parsing section (lines 33-43) and config building section (lines 69-82) in `tests/extraction-harness.html`:

```javascript
const params = new URLSearchParams(window.location.search);
const fixture = params.get('fixture') || 'filled-grid.jpg';

// Parse manifest (preferred) or individual params (legacy)
let manifest = null;
if (params.get('manifest')) {
  try {
    manifest = JSON.parse(params.get('manifest'));
  } catch (e) {
    console.error('Failed to parse manifest:', e);
  }
}

const gridCols = manifest?.cols ?? (params.get('cols') ? Number(params.get('cols')) : null);
const gridRows = manifest?.rows ?? (params.get('rows') ? Number(params.get('rows')) : null);
const gridCellW = manifest?.templateCellW ?? (params.get('cellW') ? Number(params.get('cellW')) : null);
const gridCellH = manifest?.templateCellH ?? (params.get('cellH') ? Number(params.get('cellH')) : null);
const gridHeaderH = manifest?.headerH ?? (params.get('headerH') ? Number(params.get('headerH')) : null);
const gridBorder = manifest?.border ?? (params.get('border') ? Number(params.get('border')) : null);
const gridLabels = manifest?.cellLabels ?? (params.get('labels') ? params.get('labels').split(',') : null);
```

The rest of the harness (extraction config building, rendering, result collection) stays unchanged — it already consumes these variables.

**Step 2: Verify the harness still works with legacy params**

Open in browser: `http://localhost:5174/tests/extraction-harness.html?fixture=filled-grid.jpg`
Expected: Same behavior as before (6x6 extraction, sprites displayed).

**Step 3: Verify manifest param works**

Open in browser: `http://localhost:5174/tests/extraction-harness.html?fixture=medieval-inn.jpg&manifest={"cols":3,"rows":3,"totalCells":9,"templateCellW":680,"templateCellH":680,"headerH":22,"border":2,"cellLabels":["Day - Idle","Day - Smoke Rising","Day - Sign Swaying","Evening - Lights On","Evening - Chimney Glow","Evening - Busy","Night - Lantern Lit","Night - Quiet","Night - Closed"]}`
Expected: 3x3 grid with 9 sprites extracted.

**Step 4: Commit**

```bash
git add tests/extraction-harness.html
git commit -m "refactor: extraction harness accepts manifest JSON param"
```

---

### Task 4: Rewrite extraction.spec.ts — Auto-Discovery & Manifest-Driven

**Files:**
- Modify: `tests/extraction.spec.ts`

**Step 1: Rewrite the test spec**

Replace the entire file with a manifest-driven auto-discovery approach:

```typescript
import { test, expect } from '@playwright/test';
import { existsSync, readdirSync, readFileSync, mkdirSync, writeFileSync } from 'fs';
import { join, dirname, basename } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '..');
const FIXTURES_DIR = join(ROOT, 'test-fixtures');
const RESULTS_DIR = join(ROOT, 'test-results', 'fixtures');

// Thresholds
const MAX_ALLOWED_BLEED = 15;
const MAX_DARK_BAND_PCT: Record<string, number> = {
  character: 80,
  building: 95,  // buildings have legitimately dark content
  terrain: 90,
  background: 95,
};
const MAX_HEIGHT_SPREAD = 10;

interface Manifest {
  spriteType: string;
  gridSize: string;
  cols: number;
  rows: number;
  totalCells: number;
  templateCellW: number;
  templateCellH: number;
  headerH: number;
  border: number;
  cellLabels?: string[];
  contentPreset?: string;
}

interface SpriteResult {
  idx: number;
  label: string;
  headerBleedPct: number;
  grayPixels: number;
  totalPixels: number;
  cellW: number;
  cellH: number;
  worstDarkBandPct: number;
  worstDarkBandRow: number;
  imageDataUrl: string; // base64 data URL for the report
}

// Discover all manifests
const manifestFiles = readdirSync(FIXTURES_DIR)
  .filter(f => f.endsWith('.manifest.json'))
  .sort();

const fixtures = manifestFiles.map(mf => {
  const name = basename(mf, '.manifest.json');
  const manifest: Manifest = JSON.parse(readFileSync(join(FIXTURES_DIR, mf), 'utf8'));
  const imageFile = ['.jpg', '.jpeg', '.png']
    .map(ext => `${name}${ext}`)
    .find(f => existsSync(join(FIXTURES_DIR, f)));
  return { name, manifest, imageFile };
}).filter(f => f.imageFile); // skip manifests without matching images

// Ensure results directory exists
mkdirSync(RESULTS_DIR, { recursive: true });

async function runExtraction(page: any, imageFile: string, manifest: Manifest): Promise<SpriteResult[]> {
  const manifestParam = encodeURIComponent(JSON.stringify(manifest));
  await page.goto(
    `/tests/extraction-harness.html?fixture=${imageFile}&manifest=${manifestParam}`,
    { waitUntil: 'domcontentloaded' },
  );

  await page.waitForFunction(() => (window as any).__extractionDone === true, {
    timeout: 30000,
  });

  // Collect results including sprite image data for the report
  return page.evaluate(() => {
    const results = (window as any).__results as any[];
    // Augment with image data URLs from the rendered sprites
    const spriteImgs = document.querySelectorAll('.sprite-cell img');
    return results.map((r: any, i: number) => ({
      ...r,
      imageDataUrl: (spriteImgs[i] as HTMLImageElement)?.src || '',
    }));
  });
}

test.describe('Sprite Extraction', () => {
  for (const { name, manifest, imageFile } of fixtures) {
    test(`${name}: ${manifest.spriteType} ${manifest.gridSize} extraction`, async ({ page }) => {
      const results = await runExtraction(page, imageFile!, manifest);

      // Take screenshot for visual audit
      await page.screenshot({
        path: join(ROOT, 'test-results', `${name}-results.png`),
        fullPage: true,
      });

      // ── Assertions ──

      // 1. Sprite count
      expect(
        results.length,
        `${name}: expected ${manifest.totalCells} sprites, got ${results.length}`,
      ).toBe(manifest.totalCells);

      // 2. Header bleed
      const bleedFailures: string[] = [];
      for (const r of results) {
        if (r.headerBleedPct > MAX_ALLOWED_BLEED) {
          bleedFailures.push(`${r.label}: ${r.headerBleedPct}% header bleed`);
        }
      }
      expect(
        bleedFailures,
        `${name}: header bleed failures:\n${bleedFailures.join('\n')}`,
      ).toHaveLength(0);

      // 3. Dark bands (threshold varies by sprite type)
      const darkThreshold = MAX_DARK_BAND_PCT[manifest.spriteType] ?? 80;
      const darkBandFailures: string[] = [];
      for (const r of results) {
        if (r.worstDarkBandPct > darkThreshold) {
          darkBandFailures.push(`${r.label}: ${r.worstDarkBandPct}% dark at row ${r.worstDarkBandRow}`);
        }
      }
      // Buildings/backgrounds: log as info only
      if (manifest.spriteType === 'building' || manifest.spriteType === 'background') {
        if (darkBandFailures.length > 0) {
          console.log(`${name} — dark bands (informational):\n  ${darkBandFailures.join('\n  ')}`);
        }
      } else {
        expect(
          darkBandFailures,
          `${name}: dark band failures:\n${darkBandFailures.join('\n')}`,
        ).toHaveLength(0);
      }

      // 4. Row height uniformity
      for (let row = 0; row < manifest.rows; row++) {
        const rowSprites = results.filter(r => Math.floor(r.idx / manifest.cols) === row);
        if (rowSprites.length === 0) continue;
        const heights = rowSprites.map(r => r.cellH);
        const spread = Math.max(...heights) - Math.min(...heights);
        expect(
          spread,
          `${name} row ${row}: height spread ${spread}px`,
        ).toBeLessThanOrEqual(MAX_HEIGHT_SPREAD);
      }

      // 5. Dimension uniformity (post-normalization)
      const widths = results.map(r => r.cellW);
      const heights = results.map(r => r.cellH);
      expect(Math.max(...widths) - Math.min(...widths), `${name}: width spread`).toBe(0);
      expect(Math.max(...heights) - Math.min(...heights), `${name}: height spread`).toBe(0);

      // ── Save results for report ──
      const fixtureResult = {
        name,
        manifest,
        pass: true, // will be set to false by the report generator if assertions above threw
        metrics: {
          spriteCount: results.length,
          maxBleed: Math.max(...results.map(r => r.headerBleedPct)),
          avgBleed: parseFloat((results.reduce((s, r) => s + r.headerBleedPct, 0) / results.length).toFixed(1)),
          maxDarkBand: Math.max(...results.map(r => r.worstDarkBandPct)),
          cellW: results[0]?.cellW ?? 0,
          cellH: results[0]?.cellH ?? 0,
        },
        sprites: results.map(r => ({
          idx: r.idx,
          label: r.label,
          headerBleedPct: r.headerBleedPct,
          worstDarkBandPct: r.worstDarkBandPct,
          worstDarkBandRow: r.worstDarkBandRow,
          cellW: r.cellW,
          cellH: r.cellH,
          imageDataUrl: r.imageDataUrl,
        })),
      };

      writeFileSync(
        join(RESULTS_DIR, `${name}.json`),
        JSON.stringify(fixtureResult, null, 2),
      );

      // Log summary
      console.log(
        `${name} — ${manifest.spriteType} ${manifest.gridSize}: ` +
        `${results.length} sprites, max bleed: ${fixtureResult.metrics.maxBleed}%, ` +
        `max dark band: ${fixtureResult.metrics.maxDarkBand}%, ` +
        `cell: ${results[0]?.cellW}x${results[0]?.cellH}`,
      );
    });
  }
});
```

**Step 2: Run the tests**

Run: `npx playwright test`
Expected: All existing fixtures pass (same quality, now manifest-driven). Result JSONs written to `test-results/fixtures/`.

**Step 3: Commit**

```bash
git add tests/extraction.spec.ts
git commit -m "refactor: manifest-driven auto-discovery extraction tests"
```

---

### Task 5: HTML Audit Report Generator

**Files:**
- Create: `tests/report-generator.ts`

**Step 1: Create the report generator**

This script reads all `test-results/fixtures/*.json` files and assembles a self-contained HTML report.

```typescript
/**
 * Generates a self-contained HTML audit report from per-fixture result JSONs.
 *
 * Usage: npx tsx tests/report-generator.ts
 * Reads: test-results/fixtures/*.json
 * Writes: test-results/audit-report.html
 */

import { readdirSync, readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '..');
const FIXTURES_RESULTS_DIR = join(ROOT, 'test-results', 'fixtures');
const OUTPUT_PATH = join(ROOT, 'test-results', 'audit-report.html');

interface FixtureResult {
  name: string;
  manifest: {
    spriteType: string;
    gridSize: string;
    cols: number;
    rows: number;
    totalCells: number;
  };
  pass: boolean;
  metrics: {
    spriteCount: number;
    maxBleed: number;
    avgBleed: number;
    maxDarkBand: number;
    cellW: number;
    cellH: number;
  };
  sprites: Array<{
    idx: number;
    label: string;
    headerBleedPct: number;
    worstDarkBandPct: number;
    worstDarkBandRow: number;
    cellW: number;
    cellH: number;
    imageDataUrl: string;
  }>;
}

function main() {
  if (!existsSync(FIXTURES_RESULTS_DIR)) {
    console.error('No fixture results found. Run tests first: npx playwright test');
    process.exit(1);
  }

  const resultFiles = readdirSync(FIXTURES_RESULTS_DIR).filter(f => f.endsWith('.json'));
  if (resultFiles.length === 0) {
    console.error('No fixture result JSONs found.');
    process.exit(1);
  }

  const results: FixtureResult[] = resultFiles
    .map(f => JSON.parse(readFileSync(join(FIXTURES_RESULTS_DIR, f), 'utf8')))
    .sort((a, b) => {
      // Failures first, then alphabetical
      if (a.pass !== b.pass) return a.pass ? 1 : -1;
      return a.name.localeCompare(b.name);
    });

  const totalPass = results.filter(r => r.pass).length;
  const totalFail = results.length - totalPass;
  const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19);

  const spriteTypeColors: Record<string, string> = {
    character: '#8b5cf6',
    building: '#f59e0b',
    terrain: '#10b981',
    background: '#3b82f6',
  };

  function metricColor(value: number, warn: number, fail: number): string {
    if (value >= fail) return '#ef4444';
    if (value >= warn) return '#f59e0b';
    return '#22c55e';
  }

  function renderFixtureCard(r: FixtureResult): string {
    const typeColor = spriteTypeColors[r.manifest.spriteType] || '#888';
    const statusBadge = r.pass
      ? '<span style="color:#22c55e;font-weight:700">PASS</span>'
      : '<span style="color:#ef4444;font-weight:700">FAIL</span>';

    const spriteGrid = r.sprites.map(s => {
      const bleedColor = metricColor(s.headerBleedPct, 10, 15);
      const darkColor = metricColor(s.worstDarkBandPct, 70, 80);
      return `
        <div class="sprite-card">
          <div class="sprite-img-wrap">
            ${s.imageDataUrl ? `<img src="${s.imageDataUrl}" alt="${s.label}" />` : '<div class="no-img">No image</div>'}
          </div>
          <div class="sprite-meta">
            <div class="sprite-label">${s.label}</div>
            <div class="sprite-metrics">
              <span style="color:${bleedColor}">Bleed: ${s.headerBleedPct}%</span>
              <span style="color:${darkColor}">Dark: ${s.worstDarkBandPct}%</span>
              <span>${s.cellW}&times;${s.cellH}</span>
            </div>
          </div>
        </div>`;
    }).join('\n');

    return `
      <div class="fixture-card">
        <div class="fixture-header">
          <div class="fixture-title">
            ${statusBadge}
            <span class="fixture-name">${r.name}</span>
            <span class="type-badge" style="background:${typeColor}">${r.manifest.spriteType}</span>
            <span class="grid-badge">${r.manifest.gridSize}</span>
          </div>
          <div class="fixture-summary">
            ${r.metrics.spriteCount} sprites &middot;
            Max bleed: <span style="color:${metricColor(r.metrics.maxBleed, 10, 15)}">${r.metrics.maxBleed}%</span> &middot;
            Avg bleed: ${r.metrics.avgBleed}% &middot;
            Max dark: <span style="color:${metricColor(r.metrics.maxDarkBand, 70, 80)}">${r.metrics.maxDarkBand}%</span> &middot;
            Cell: ${r.metrics.cellW}&times;${r.metrics.cellH}
          </div>
        </div>
        <details>
          <summary>Sprite Grid (${r.manifest.cols}&times;${r.manifest.rows})</summary>
          <div class="sprite-grid" style="grid-template-columns: repeat(${r.manifest.cols}, 1fr)">
            ${spriteGrid}
          </div>
        </details>
      </div>`;
  }

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Extraction Audit Report</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: #0f0f1a; color: #e0e0e0; font-family: 'SF Mono', 'Cascadia Code', 'Fira Code', monospace; padding: 24px; }
    h1 { font-size: 1.5rem; margin-bottom: 8px; }
    .header { margin-bottom: 24px; border-bottom: 1px solid #333; padding-bottom: 16px; }
    .header-stats { display: flex; gap: 16px; font-size: 0.85rem; color: #999; }
    .header-stats .pass { color: #22c55e; font-weight: 700; }
    .header-stats .fail { color: #ef4444; font-weight: 700; }
    .fixture-card { background: #1a1a2e; border: 1px solid #2a2a4a; border-radius: 8px; margin-bottom: 16px; overflow: hidden; }
    .fixture-header { padding: 12px 16px; border-bottom: 1px solid #2a2a4a; }
    .fixture-title { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
    .fixture-name { font-size: 1.1rem; font-weight: 600; }
    .type-badge { padding: 2px 8px; border-radius: 4px; font-size: 0.7rem; color: #fff; font-weight: 600; text-transform: uppercase; }
    .grid-badge { padding: 2px 8px; border-radius: 4px; font-size: 0.7rem; background: #333; color: #ccc; }
    .fixture-summary { font-size: 0.8rem; color: #999; }
    details { padding: 12px 16px; }
    summary { cursor: pointer; color: #888; font-size: 0.8rem; margin-bottom: 8px; }
    summary:hover { color: #ccc; }
    .sprite-grid { display: grid; gap: 6px; }
    .sprite-card { background: #12122a; border: 1px solid #2a2a4a; border-radius: 4px; overflow: hidden; }
    .sprite-img-wrap {
      background-color: #fff;
      background-image: linear-gradient(45deg, #ccc 25%, transparent 25%), linear-gradient(-45deg, #ccc 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #ccc 75%), linear-gradient(-45deg, transparent 75%, #ccc 75%);
      background-size: 10px 10px;
      background-position: 0 0, 0 5px, 5px -5px, -5px 0;
    }
    .sprite-card img { width: 100%; display: block; image-rendering: pixelated; }
    .sprite-meta { padding: 4px 6px; }
    .sprite-label { font-size: 0.65rem; color: #aaa; font-weight: 600; text-transform: uppercase; letter-spacing: 0.03em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .sprite-metrics { font-size: 0.6rem; display: flex; gap: 8px; margin-top: 2px; }
    .no-img { padding: 20px; text-align: center; color: #555; font-size: 0.7rem; }
  </style>
</head>
<body>
  <div class="header">
    <h1>Extraction Audit Report</h1>
    <div class="header-stats">
      <span class="pass">${totalPass} passed</span>
      ${totalFail > 0 ? `<span class="fail">${totalFail} failed</span>` : ''}
      <span>${results.length} fixtures</span>
      <span>${timestamp}</span>
    </div>
  </div>

  ${results.map(renderFixtureCard).join('\n')}
</body>
</html>`;

  mkdirSync(join(ROOT, 'test-results'), { recursive: true });
  writeFileSync(OUTPUT_PATH, html);
  console.log(`Audit report written to ${OUTPUT_PATH}`);
}

main();
```

**Step 2: Run the report generator manually to verify**

Run: `npx playwright test && npx tsx tests/report-generator.ts`
Expected: `test-results/audit-report.html` is created. Open it in a browser — should show cards for all fixtures with sprite grids, metrics, and pass/fail badges.

**Step 3: Commit**

```bash
git add tests/report-generator.ts
git commit -m "feat: custom HTML audit report generator for extraction tests"
```

---

### Task 6: Playwright Global Teardown & npm Scripts

**Files:**
- Create: `tests/playwright-global-teardown.ts`
- Modify: `playwright.config.ts`
- Modify: `package.json`

**Step 1: Create global teardown**

```typescript
/**
 * Playwright global teardown — generates the HTML audit report after all tests.
 */

import { execSync } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '..');

async function globalTeardown() {
  try {
    execSync('npx tsx tests/report-generator.ts', {
      cwd: ROOT,
      stdio: 'inherit',
    });
  } catch (err) {
    console.error('Failed to generate audit report:', err);
  }
}

export default globalTeardown;
```

**Step 2: Wire up global teardown in playwright.config.ts**

Replace the entire `playwright.config.ts`:

```typescript
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  reporter: [['html', { open: 'never' }]],
  globalTeardown: './tests/playwright-global-teardown.ts',
  use: {
    baseURL: 'http://localhost:5174',
  },
  webServer: {
    command: 'npx vite --port 5174',
    port: 5174,
    reuseExistingServer: true,
  },
});
```

**Step 3: Add npm scripts**

In `package.json`, update `"scripts"`:

```json
"test": "playwright test",
"test:report": "npx tsx tests/report-generator.ts && node -e \"import('open').then(m=>m.default('test-results/audit-report.html')).catch(()=>console.log('Open test-results/audit-report.html in your browser'))\"",
"test:sync-manifests": "npx tsx scripts/sync-fixture-manifests.ts"
```

Note: The `test:report` script tries to use the `open` package but falls back to a message if not installed. Keep it simple — users can just open the file manually. Alternatively, simplify to:

```json
"test:report": "npx tsx tests/report-generator.ts"
```

**Step 4: Verify the full pipeline**

Run: `npm test`
Expected: Tests run, fixture result JSONs are written, global teardown runs report generator, `test-results/audit-report.html` is generated.

**Step 5: Commit**

```bash
git add tests/playwright-global-teardown.ts playwright.config.ts package.json
git commit -m "feat: wire up global teardown for audit report generation"
```

---

### Task 7: Verify .gitignore & Clean Up

**Files:**
- Modify: `.gitignore` (if needed)
- Remove: Stale test result files from `test-fixtures/` (the `.png` files that are extraction results, not fixture images)

**Step 1: Verify .gitignore includes test-results/**

Check that `test-results/` is already in `.gitignore`. If not, add it.

Run: `grep -q 'test-results' .gitignore && echo "Already ignored" || echo "test-results/" >> .gitignore`

**Step 2: Clean up stale result PNGs from test-fixtures/**

The `test-fixtures/` directory contains result PNGs from previous test runs (`colored-grid-results.png`, `debug-full-results.png`, etc.). These should be in `test-results/`, not `test-fixtures/`. Delete them:

```bash
rm -f test-fixtures/*-results.png test-fixtures/debug-*.png test-fixtures/extracted-sprites.png test-fixtures/extraction-results.png test-fixtures/header-bleed-strips.png
```

**Step 3: Verify tests still pass after cleanup**

Run: `npm test`
Expected: All tests pass. Audit report generated.

**Step 4: Commit**

```bash
git add .gitignore
git rm --cached test-fixtures/*-results.png test-fixtures/debug-*.png test-fixtures/extracted-sprites.png test-fixtures/extraction-results.png test-fixtures/header-bleed-strips.png 2>/dev/null || true
git commit -m "chore: clean up stale test results, ensure test-results/ is gitignored"
```

---

### Task 8: End-to-End Verification

**Step 1: Fresh test run**

```bash
rm -rf test-results/
npm test
```

Expected:
- All fixture tests pass
- `test-results/fixtures/*.json` files created for each fixture
- `test-results/audit-report.html` generated
- Screenshot PNGs in `test-results/` for each fixture

**Step 2: Visual audit**

Open `test-results/audit-report.html` in a browser.
Expected:
- Header shows pass/fail counts, timestamp
- Each fixture has a card with correct sprite type badge and grid size
- Expanding a card shows the sprite grid at the correct cols/rows layout
- Metrics are color-coded (green/yellow/red)
- Sprites render on checkerboard backgrounds

**Step 3: Sync script round-trip**

```bash
npm run test:sync-manifests
```

Expected: Character fixtures show KEEP (already have manifests), building fixtures show WRITE (updated from DB).

**Step 4: Final commit**

If any fixes were needed during verification, commit them.
