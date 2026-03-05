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
  failures?: string[];
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

    const failureList = r.failures && r.failures.length > 0
      ? `<div class="failure-list">${r.failures.map(f => `<div class="failure-item">${f}</div>`).join('')}</div>`
      : '';

    return `
      <div class="fixture-card${r.pass ? '' : ' fixture-fail'}">
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
          ${failureList}
        </div>
        <details${r.pass ? '' : ' open'}>
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
    .fixture-fail { border-color: #7f1d1d; }
    .fixture-fail .fixture-header { border-bottom-color: #7f1d1d; }
    .failure-list { margin-top: 8px; padding: 8px; background: #1a0a0a; border: 1px solid #7f1d1d; border-radius: 4px; }
    .failure-item { font-size: 0.75rem; color: #fca5a5; padding: 2px 0; }
    .failure-item::before { content: "\\2717 "; color: #ef4444; }
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
