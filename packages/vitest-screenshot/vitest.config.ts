import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { name: 'screenshot', include: ['src/**/*.test.ts'] },
});
