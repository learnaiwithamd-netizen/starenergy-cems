import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe } from 'vitest-axe'
import { describe, it, expect } from 'vitest'
import App from './App'

describe('admin-app App accessibility', () => {
  it('has no axe violations', async () => {
    const { container } = render(<App />)
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

    await user.tab()
    expect(skipLink).toHaveFocus()
  })

  it('exposes a #main-content landmark that is programmatically focusable', () => {
    render(<App />)
    const main = document.getElementById('main-content')
    expect(main).not.toBeNull()
    expect(main?.tagName.toLowerCase()).toBe('main')
    expect(main).toHaveAttribute('tabindex', '-1')
  })
})
