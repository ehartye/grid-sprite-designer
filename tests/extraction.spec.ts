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

  test('posterization: 5-bit output has SNES-conformant colors', async ({ page }) => {
    const fixturePath = join(ROOT, 'test-fixtures', 'filled-grid.jpg');
    expect(existsSync(fixturePath), 'Test fixture filled-grid.jpg must exist').toBeTruthy();

    await page.goto('/tests/extraction-harness.html?fixture=filled-grid.jpg', {
      waitUntil: 'domcontentloaded',
    });

    // Wait for the default extraction to complete
    await page.waitForFunction(() => (window as any).__extractionDone === true, {
      timeout: 30000,
    });

    // Extract sprites (original pixels), then posterize client-side and analyze
    const result = await page.evaluate(async () => {
      const resp = await fetch('/test-fixtures/filled-grid.jpg');
      const blob = await resp.blob();
      const base64: string = await new Promise(resolve => {
        const reader = new FileReader();
        reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
        reader.readAsDataURL(blob);
      });

      const { extractSprites, composeSpriteSheet } = await import('/src/lib/spriteExtractor.ts');
      const { posterize } = await import('/src/lib/imagePreprocess.ts');

      // Extract with 5-bit detection (sprites always come from original)
      const sprites = await extractSprites(base64, 'image/jpeg', {
        posterizeBits: 5,
      });

      // Apply 5-bit posterization client-side (same as processSprite pipeline)
      const posterizedSprites = await Promise.all(sprites.map(async (sprite) => {
        const img = new Image();
        await new Promise<void>((resolve) => {
          img.onload = () => resolve();
          img.src = `data:${sprite.mimeType};base64,${sprite.imageData}`;
        });
        const c = document.createElement('canvas');
        c.width = img.width;
        c.height = img.height;
        const ctx = c.getContext('2d')!;
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, img.width, img.height);
        const posterized = posterize(imageData, 5);
        ctx.putImageData(posterized, 0, 0);
        const dataUrl = c.toDataURL('image/png');
        return { ...sprite, imageData: dataUrl.split(',')[1], mimeType: 'image/png' };
      }));

      const { canvas } = await composeSpriteSheet(posterizedSprites);
      const ctx = canvas.getContext('2d')!;
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;

      // Count unique colors and verify 5-bit conformance
      const uniqueColors = new Set<number>();
      const step = 8; // 256 / 32
      const halfStep = 4;
      const validValues = new Set<number>();
      for (let i = 0; i < 32; i++) {
        validValues.add(Math.min(255, i * step + halfStep));
      }

      let opaquePixels = 0;
      let nonConforming = 0;
      for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] === 0) continue;
        opaquePixels++;
        uniqueColors.add((data[i] << 16) | (data[i + 1] << 8) | data[i + 2]);
        if (!validValues.has(data[i]) || !validValues.has(data[i + 1]) || !validValues.has(data[i + 2])) {
          nonConforming++;
        }
      }

      // Count original (non-posterized) colors for comparison
      const { canvas: origCanvas } = await composeSpriteSheet(sprites);
      const origData = origCanvas.getContext('2d')!.getImageData(0, 0, origCanvas.width, origCanvas.height).data;
      const origColors = new Set<number>();
      for (let i = 0; i < origData.length; i += 4) {
        if (origData[i + 3] === 0) continue;
        origColors.add((origData[i] << 16) | (origData[i + 1] << 8) | origData[i + 2]);
      }

      return {
        spriteCount: sprites.length,
        uniqueColors: uniqueColors.size,
        origColors: origColors.size,
        opaquePixels,
        nonConforming,
      };
    });

    expect(result.spriteCount, 'should extract 36 sprites').toBe(36);
    expect(result.nonConforming, 'all pixels must have valid 5-bit channel values').toBe(0);
    expect(result.uniqueColors, 'posterized colors must be within 15-bit limit').toBeLessThanOrEqual(32768);
    expect(result.uniqueColors, 'posterized output should have fewer colors than original').toBeLessThan(result.origColors);

    console.log(
      `posterization — ${result.origColors} original colors → ${result.uniqueColors} posterized ` +
      `(${((1 - result.uniqueColors / result.origColors) * 100).toFixed(1)}% reduction), ` +
      `0 non-conforming pixels out of ${result.opaquePixels}`,
    );

    // Export posterized sprite sheet to file for visual inspection
    const pngBase64 = await page.evaluate(async () => {
      const resp = await fetch('/test-fixtures/filled-grid.jpg');
      const blob = await resp.blob();
      const base64: string = await new Promise(resolve => {
        const reader = new FileReader();
        reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
        reader.readAsDataURL(blob);
      });

      const { extractSprites, composeSpriteSheet } = await import('/src/lib/spriteExtractor.ts');
      const { posterize } = await import('/src/lib/imagePreprocess.ts');

      const sprites = await extractSprites(base64, 'image/jpeg', { posterizeBits: 5 });
      const posterizedSprites = await Promise.all(sprites.map(async (sprite) => {
        const img = new Image();
        await new Promise<void>((resolve) => {
          img.onload = () => resolve();
          img.src = `data:${sprite.mimeType};base64,${sprite.imageData}`;
        });
        const c = document.createElement('canvas');
        c.width = img.width;
        c.height = img.height;
        const ctx = c.getContext('2d')!;
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, img.width, img.height);
        const posterized = posterize(imageData, 5);
        ctx.putImageData(posterized, 0, 0);
        return { ...sprite, imageData: c.toDataURL('image/png').split(',')[1], mimeType: 'image/png' };
      }));

      const { base64: sheetB64 } = await composeSpriteSheet(posterizedSprites);
      return sheetB64;
    });

    const fs = await import('fs');
    const outPath = join(ROOT, 'test-results', 'posterized-5bit-spritesheet.png');
    fs.mkdirSync(join(ROOT, 'test-results'), { recursive: true });
    fs.writeFileSync(outPath, Buffer.from(pngBase64, 'base64'));
    console.log(`Exported posterized sprite sheet to ${outPath}`);
  });
});
