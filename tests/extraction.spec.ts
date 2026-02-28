import { test, expect } from '@playwright/test';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '..');

const MAX_ALLOWED_BLEED = 15; // % of top 10px that are dark/white
const MAX_DARK_BAND_PCT = 80; // % dark pixels in any single row (catches misplaced headers)
const MAX_HEIGHT_SPREAD = 10; // px max height variation within a row

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
}

async function runExtraction(page: any, fixture: string): Promise<SpriteResult[]> {
  await page.goto(`/tests/extraction-harness.html?fixture=${fixture}`, {
    waitUntil: 'domcontentloaded',
  });

  await page.waitForFunction(() => (window as any).__extractionDone === true, {
    timeout: 30000,
  });

  return page.evaluate(() => (window as any).__results);
}

function checkResults(results: SpriteResult[], fixtureName: string) {
  expect(results, `${fixtureName}: expected 36 sprites`).toHaveLength(36);

  // Check header bleed (top 10px)
  const bleedFailures: string[] = [];
  for (const r of results) {
    if (r.headerBleedPct > MAX_ALLOWED_BLEED) {
      bleedFailures.push(`${r.label}: ${r.headerBleedPct}% header bleed`);
    }
  }
  expect(bleedFailures, `${fixtureName}: header bleed failures:\n${bleedFailures.join('\n')}`).toHaveLength(0);

  // Check whole-sprite dark bands (catches headers anywhere, not just top)
  const darkBandFailures: string[] = [];
  for (const r of results) {
    if (r.worstDarkBandPct > MAX_DARK_BAND_PCT) {
      darkBandFailures.push(`${r.label}: ${r.worstDarkBandPct}% dark at row ${r.worstDarkBandRow}`);
    }
  }
  expect(darkBandFailures, `${fixtureName}: dark band failures:\n${darkBandFailures.join('\n')}`).toHaveLength(0);

  // Check cell height uniformity within each row (6 sprites per row)
  for (let row = 0; row < 6; row++) {
    const rowSprites = results.filter(r => Math.floor(r.idx / 6) === row);
    const heights = rowSprites.map(r => r.cellH);
    const spread = Math.max(...heights) - Math.min(...heights);
    expect(spread, `${fixtureName} row ${row}: height spread ${spread}px (heights: ${heights.join(',')})`).toBeLessThanOrEqual(MAX_HEIGHT_SPREAD);
  }
}

test.describe('Sprite Extraction', () => {
  test('filled-grid: standard dark grid lines', async ({ page }) => {
    const fixturePath = join(ROOT, 'test-fixtures', 'filled-grid.jpg');
    expect(existsSync(fixturePath), 'Test fixture filled-grid.jpg must exist').toBeTruthy();

    const results = await runExtraction(page, 'filled-grid.jpg');
    checkResults(results, 'filled-grid');

    await page.screenshot({
      path: join(ROOT, 'test-results', 'filled-grid-results.png'),
      fullPage: true,
    });

    // Log summary
    const maxBleed = Math.max(...results.map(r => r.headerBleedPct));
    const maxDarkBand = Math.max(...results.map(r => r.worstDarkBandPct));
    console.log(`filled-grid — max bleed: ${maxBleed}%, max dark band: ${maxDarkBand}%`);
  });

  test('colored-grid: colored (pink) grid lines', async ({ page }) => {
    const fixturePath = join(ROOT, 'test-fixtures', 'colored-grid.jpg');
    if (!existsSync(fixturePath)) {
      test.skip();
      return;
    }

    const results = await runExtraction(page, 'colored-grid.jpg');
    checkResults(results, 'colored-grid');

    await page.screenshot({
      path: join(ROOT, 'test-results', 'colored-grid-results.png'),
      fullPage: true,
    });

    const maxBleed = Math.max(...results.map(r => r.headerBleedPct));
    const maxDarkBand = Math.max(...results.map(r => r.worstDarkBandPct));
    console.log(`colored-grid — max bleed: ${maxBleed}%, max dark band: ${maxDarkBand}%`);
  });

  test('fluxbot-drone: magenta grid lines', async ({ page }) => {
    const fixturePath = join(ROOT, 'test-fixtures', 'fluxbot-drone.jpg');
    if (!existsSync(fixturePath)) {
      test.skip();
      return;
    }

    const results = await runExtraction(page, 'fluxbot-drone.jpg');
    checkResults(results, 'fluxbot-drone');

    await page.screenshot({
      path: join(ROOT, 'test-results', 'fluxbot-drone-results.png'),
      fullPage: true,
    });

    const maxBleed = Math.max(...results.map(r => r.headerBleedPct));
    const maxDarkBand = Math.max(...results.map(r => r.worstDarkBandPct));
    console.log(`fluxbot-drone — max bleed: ${maxBleed}%, max dark band: ${maxDarkBand}%`);
  });
});
