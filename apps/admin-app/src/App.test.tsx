import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { axe } from 'vitest-axe'
import { describe, it, expect, beforeEach } from 'vitest'
import App from './App'
import { useAuthStore } from './features/auth/auth-store'

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  )
}

describe('admin-app App accessibility', () => {
  beforeEach(() => {
    window.localStorage.clear()
    useAuthStore.getState().clearSession()
  })

  it('has no axe violations on the login page', async () => {
    const { container } = renderAt('/login')
    // Wait for useAuthBootstrap to flip ready=true (no refresh token → instant).
    await waitFor(() => expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument())
    const results = await axe(container, {
      rules: { 'color-contrast': { enabled: false } },
    })
    expect(results).toHaveNoViolations()
  })

  it('renders a skip-to-main-content link as first focusable element', async () => {
    const user = userEvent.setup()
    renderAt('/login')
    await waitFor(() => expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument())

    const skipLink = screen.getByRole('link', { name: /skip to main content/i })
    expect(skipLink).toBeInTheDocument()
    expect(skipLink).toHaveAttribute('href', '#main-content')

    await user.tab()
    expect(skipLink).toHaveFocus()
  })

  it('exposes a #main-content landmark that is programmatically focusable', async () => {
    renderAt('/login')
    await waitFor(() => expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument())
    const main = document.getElementById('main-content')
    expect(main).not.toBeNull()
    expect(main?.tagName.toLowerCase()).toBe('main')
    expect(main).toHaveAttribute('tabindex', '-1')
  })

  it('protected route (/) redirects to /login when unauthenticated', async () => {
    renderAt('/')
    // Wait for both bootstrap and the Navigate-driven re-render.
    await waitFor(() => expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument())
    // The level-1 heading on /login is "Star Energy Admin — Sign in".
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/sign in/i)
  })
})
