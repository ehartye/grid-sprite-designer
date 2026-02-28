import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  reporter: [['html', { open: 'never' }]],
  use: {
    baseURL: 'http://localhost:5175',
  },
  webServer: {
    command: 'npx vite --port 5175',
    port: 5175,
    reuseExistingServer: true,
  },
});
