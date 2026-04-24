import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // Unit tests under src/ run in every invocation.
    // Integration tests under tests/ self-gate on RUN_INTEGRATION=1 via describe.skipIf(),
    // so they're included here but harmless when the env var isn't set.
    include: ['src/**/*.{test,spec}.ts', 'tests/**/*.{test,spec}.ts'],
  },
})
