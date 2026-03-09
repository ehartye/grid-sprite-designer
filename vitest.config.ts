import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/__tests__/**/*.test.{ts,tsx}', 'server/__tests__/**/*.test.{ts,js}'],
    setupFiles: ['src/lib/__tests__/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.{ts,tsx}', 'server/**/*.js'],
      exclude: ['**/__tests__/**', '**/*.test.*', '**/node_modules/**'],
      thresholds: {
        statements: 11,
        branches: 18,
        functions: 4,
        lines: 11,
      },
    },
  },
});
