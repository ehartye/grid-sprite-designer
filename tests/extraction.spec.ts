import { test, expect } from '@playwright/test';
import { createServer } from 'http';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import handler from 'serve-handler';

const ROOT = join(__dirname, '..');

test.describe('Sprite Extraction', () => {
  let server: ReturnType<typeof createServer>;
  let port: number;

  test.beforeAll(async () => {
    // Simple static file server for the test HTML + fixtures
    server = createServer((req, res) => {
      return handler(req, res, { public: ROOT });
    });
    await new Promise<void>((resolve) => {
      server.listen(0, () => {
        port = (server.address() as any).port;
        resolve();
      });
    });
  });

  test.afterAll(async () => {
    server?.close();
  });

  test('extracted sprites should not contain header text', async ({ page }) => {
    // Verify fixture exists
    const fixturePath = join(ROOT, 'test-fixtures', 'filled-grid.jpg');
    expect(existsSync(fixturePath), 'Test fixture filled-grid.jpg must exist').toBeTruthy();

    await page.goto(`http://localhost:${port}/tests/extract-test.html`, {
      waitUntil: 'domcontentloaded',
    });

    // Wait for extraction to complete
    await page.waitForFunction(() => (window as any).__extractionDone === true, {
      timeout: 30000,
    });

    // Get test results
    const results = await page.evaluate(() => (window as any).__results);
    expect(results).toHaveLength(36);

    // Check each sprite for header bleed
    const MAX_ALLOWED_BLEED = 15; // % of top 10px that are dark/white
    const failures: string[] = [];

    for (const r of results) {
      if (r.headerBleedPct > MAX_ALLOWED_BLEED) {
        failures.push(`${r.label}: ${r.headerBleedPct}% header bleed (${r.darkPixels}/${r.totalPixels} dark/white pixels in top 10px)`);
      }
    }

    // Screenshot the results page for manual inspection
    await page.screenshot({
      path: join(ROOT, 'test-fixtures', 'extraction-results.png'),
      fullPage: true,
    });

    // Screenshot just the top-pixels section (zoomed header bleed check)
    const topPixels = page.locator('#top-pixels');
    await topPixels.screenshot({
      path: join(ROOT, 'test-fixtures', 'header-bleed-strips.png'),
    });

    // Screenshot the sprite grid
    const spriteGrid = page.locator('.sprite-grid');
    await spriteGrid.screenshot({
      path: join(ROOT, 'test-fixtures', 'extracted-sprites.png'),
    });

    // Get computed dimensions
    const info = await page.locator('#info').textContent();
    console.log('Extraction info:', info);

    // Log summary
    const maxBleed = Math.max(...results.map((r: any) => r.headerBleedPct));
    const avgBleed = results.reduce((s: number, r: any) => s + r.headerBleedPct, 0) / results.length;
    console.log(`Header bleed — max: ${maxBleed}%, avg: ${avgBleed.toFixed(1)}%`);

    if (failures.length > 0) {
      console.log('FAILING sprites:');
      failures.forEach(f => console.log('  ' + f));
    }

    expect(failures, `${failures.length} sprites have header bleed:\n${failures.join('\n')}`).toHaveLength(0);
  });
});
