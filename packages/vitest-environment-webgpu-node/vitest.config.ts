import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { name: 'webgpu-node', include: ['src/**/*.test.ts'] },
});
