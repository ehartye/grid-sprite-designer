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
