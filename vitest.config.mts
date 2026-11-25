import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      // `server-only` throws outside React Server Components; tests import server modules directly.
      'server-only': fileURLToPath(new URL('./tests/support/empty.ts', import.meta.url)),
    },
  },
  test: { include: ['tests/**/*.test.ts'], environment: 'node', testTimeout: 30_000, hookTimeout: 60_000 },
});
