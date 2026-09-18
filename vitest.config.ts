import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // First GPU context init (Metal shader cache, Mesa) can take several seconds on a cold CI runner.
    testTimeout: 60_000,
    projects: [
      'packages/*',
      { root: 'demo', test: { name: 'demo-webgl', environment: 'webgl-node', include: ['test/webgl/**/*.test.ts'] } },
      {
        root: 'demo',
        test: { name: 'demo-webgpu', environment: 'webgpu-node', include: ['test/webgpu/**/*.test.ts'] },
      },
      {
        root: 'demo',
        test: { name: 'demo-screenshots', environment: 'webgl-node', include: ['test/screenshots/**/*.test.ts'] },
      },
    ],
    coverage: {
      provider: 'v8',
      thresholds: { statements: 95, branches: 95, functions: 95, lines: 95 },
      reporter: ['text', 'lcov', 'json-summary'],
      include: ['packages/*/src/**/*.ts'],
      exclude: ['**/*.test.ts'],
    },
  },
});
