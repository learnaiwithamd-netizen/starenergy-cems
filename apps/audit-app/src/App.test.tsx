import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe } from 'vitest-axe'
import { describe, it, expect } from 'vitest'
import App from './App'

describe('audit-app App accessibility', () => {
  it('has no axe violations', async () => {
    const { container } = render(<App />)
    // color-contrast disabled in jsdom — Tailwind utilities don't compile to
    // computed styles inside the test environment, so contrast assertions are
    // unreliable here. Playwright visual-regression covers contrast at real
    // viewports.
    const results = await axe(container, {
      rules: { 'color-contrast': { enabled: false } },
    })
    expect(results).toHaveNoViolations()
  })

  it('renders a skip-to-main-content link as first focusable element', async () => {
    const user = userEvent.setup()
    render(<App />)

    const skipLink = screen.getByRole('link', { name: /skip to main content/i })
    expect(skipLink).toBeInTheDocument()
    expect(skipLink).toHaveAttribute('href', '#main-content')

    // Skip link should be the first thing keyboard focus lands on.
    await user.tab()
    expect(skipLink).toHaveFocus()
  })

  it('exposes a #main-content landmark that is programmatically focusable', () => {
    render(<App />)
    const main = document.getElementById('main-content')
    expect(main).not.toBeNull()
    expect(main?.tagName.toLowerCase()).toBe('main')
    // tabIndex={-1} → programmatically focusable for skip-link target.
    expect(main).toHaveAttribute('tabindex', '-1')
  })
})
