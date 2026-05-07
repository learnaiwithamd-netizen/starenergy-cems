import { defineConfig, devices } from '@playwright/test'

const PORT = 5173
const baseURL = `http://localhost:${PORT}`

const VIEWPORTS = [
  { name: 'iphone-se', width: 375, height: 667 },
  { name: 'iphone-14', width: 390, height: 844 },
  { name: 'ipad', width: 768, height: 1024 },
  { name: 'desktop-narrow', width: 1024, height: 768 },
  { name: 'desktop-standard', width: 1280, height: 800 },
] as const

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  // Drop the platform suffix from screenshot paths so the same baseline
  // works on macOS (local dev) and Linux (CI). Combined with the
  // maxDiffPixelRatio tolerance below, this absorbs small font/anti-aliasing
  // differences between OSes.
  snapshotPathTemplate: '{testDir}/__screenshots__/{testFilePath}/{arg}-{projectName}{ext}',
  expect: {
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.05,
      threshold: 0.3,
    },
  },
  use: {
    baseURL,
    trace: 'retain-on-failure',
  },
  projects: VIEWPORTS.map(({ name, width, height }) => ({
    name,
    use: {
      ...devices['Desktop Chrome'],
      viewport: { width, height },
    },
  })),
  webServer: {
    command: 'pnpm --filter audit-app dev',
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
})
