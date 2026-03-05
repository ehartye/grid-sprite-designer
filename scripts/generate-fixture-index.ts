#!/usr/bin/env npx tsx
/**
 * Generate test-fixtures/index.json listing all fixture manifests + image files.
 * Used by the fixture listing page to enumerate available harness targets.
 *
 * Usage: npx tsx scripts/generate-fixture-index.ts
 */

import { readdirSync, readFileSync, writeFileSync } from 'fs';
import { join, basename } from 'path';

const ROOT = join(import.meta.dirname, '..');
const FIXTURES_DIR = join(ROOT, 'test-fixtures');

const manifestFiles = readdirSync(FIXTURES_DIR)
  .filter(f => f.endsWith('.manifest.json'))
  .sort();

const fixtures = manifestFiles.map(mf => {
  const name = basename(mf, '.manifest.json');
  const manifest = JSON.parse(readFileSync(join(FIXTURES_DIR, mf), 'utf8'));
  const imageFile = ['.png', '.jpg', '.jpeg']
    .map(ext => `${name}${ext}`)
    .find(f => readdirSync(FIXTURES_DIR).includes(f));
  return { name, imageFile: imageFile || null, manifest };
}).filter(f => f.imageFile);

writeFileSync(
  join(FIXTURES_DIR, 'index.json'),
  JSON.stringify(fixtures, null, 2) + '\n',
);

console.log(`Generated index.json with ${fixtures.length} fixtures.`);
