import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { name: 'webgl-node', include: ['src/**/*.test.ts'] },
});
