import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // Integration tests live in ./tests/ and are gated by RUN_INTEGRATION=1.
    // Default `pnpm test` only runs unit tests under src/.
    include: ['src/**/*.{test,spec}.ts'],
  },
})
