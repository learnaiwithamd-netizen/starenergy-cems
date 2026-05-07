import { test, expect } from '@playwright/test'

test('home renders without visual regression', async ({ page }) => {
  await page.goto('/')
  await page.waitForLoadState('networkidle')
  await expect(page).toHaveScreenshot({
    fullPage: true,
    maxDiffPixelRatio: 0.01,
    // Mask out any element that varies between runs (e.g. dynamic timestamps).
    // Currently the placeholder home page has no such elements; revisit when
    // auditor surface lands real content.
  })
})

test('skip-to-main-content link is reachable on Tab', async ({ page }) => {
  await page.goto('/')
  await page.waitForLoadState('networkidle')

  await page.keyboard.press('Tab')
  const focused = page.locator(':focus')
  await expect(focused).toHaveText(/skip to main content/i)
})
