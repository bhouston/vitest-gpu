import { defineConfig } from 'vitest/config';

// First GPU context init can take several seconds on a cold CI runner.
export default defineConfig({ test: { testTimeout: 60_000 } });
