import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/__tests__/**/*.test.ts', 'server/__tests__/**/*.test.{ts,js}'],
    setupFiles: ['src/lib/__tests__/setup.ts'],
  },
});
