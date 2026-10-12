import { defineConfig } from 'vitest/config';

// Separate from vite.config.ts: the Cloudflare plugin can't run under Vitest, and
// these are pure-logic tests that don't need it.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'worker/**/*.test.ts'],
  },
});
