import { defineConfig } from 'vitest/config';

// First GPU context init (Metal shader cache, Mesa llvmpipe) can take several seconds on a
// cold/loaded CI runner. Vitest projects resolve independently and do NOT inherit this from
// the root `test` config, so it must be repeated in every project config
// (packages/*/vitest.config.ts and demo/vitest.config.ts).
const GPU_TEST_TIMEOUT = 60_000;

export default defineConfig({
  test: {
    testTimeout: GPU_TEST_TIMEOUT,
    projects: ['packages/*', 'demo'],
    coverage: {
      provider: 'v8',
      thresholds: { statements: 95, branches: 95, functions: 95, lines: 95 },
      reporter: ['text', 'lcov', 'json-summary'],
      include: ['packages/*/src/**/*.ts'],
      exclude: ['**/*.test.ts'],
    },
  },
});
