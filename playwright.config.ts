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
