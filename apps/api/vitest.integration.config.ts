import { defineConfig } from 'vitest/config';

// Integration, authorization and database tests against TEST_DATABASE_URL (test strategy).
export default defineConfig({
  test: {
    include: ['test/integration/**/*.test.ts'],
    globalSetup: ['test/integration/global-setup.ts'],
    // One file at a time: the files share one database.
    fileParallelism: false,
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
});
