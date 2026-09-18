import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'webgpu-node',
    include: ['src/**/*.test.ts'],
    // Cold GPU adapter/device init on Mesa llvmpipe can take several seconds on a loaded CI runner.
    // Vitest projects don't inherit testTimeout from the workspace root, so set it here too.
    testTimeout: 60_000,
  },
});
