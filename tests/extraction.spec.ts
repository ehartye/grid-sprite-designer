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

  test('posterization: 5-bit output has SNES-conformant colors', async ({ page }) => {
    const fixturePath = join(ROOT, 'test-fixtures', 'mosskin-spirit.png');
    expect(existsSync(fixturePath), 'Test fixture mosskin-spirit.png must exist').toBeTruthy();

    await page.goto('/tests/extraction-harness.html?fixture=mosskin-spirit.png', {
      waitUntil: 'domcontentloaded',
    });

    // Wait for the default extraction to complete
    await page.waitForFunction(() => (window as any).__extractionDone === true, {
      timeout: 30000,
    });

    // Extract sprites (original pixels), then posterize client-side and analyze
    const result = await page.evaluate(async () => {
      const resp = await fetch('/test-fixtures/mosskin-spirit.png');
      const blob = await resp.blob();
      const base64: string = await new Promise(resolve => {
        const reader = new FileReader();
        reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
        reader.readAsDataURL(blob);
      });

      const { extractSprites, composeSpriteSheet } = await import('/src/lib/spriteExtractor.ts');
      const { posterize } = await import('/src/lib/imagePreprocess.ts');

      // Extract with 5-bit detection (sprites always come from original)
      const sprites = await extractSprites(base64, 'image/png', {
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
      const resp = await fetch('/test-fixtures/mosskin-spirit.png');
      const blob = await resp.blob();
      const base64: string = await new Promise(resolve => {
        const reader = new FileReader();
        reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
        reader.readAsDataURL(blob);
      });

      const { extractSprites, composeSpriteSheet } = await import('/src/lib/spriteExtractor.ts');
      const { posterize } = await import('/src/lib/imagePreprocess.ts');

      const sprites = await extractSprites(base64, 'image/png', { posterizeBits: 5 });
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
