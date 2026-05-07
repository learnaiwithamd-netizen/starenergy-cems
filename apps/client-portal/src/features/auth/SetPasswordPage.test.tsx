import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { axe } from 'vitest-axe'
import { SetPasswordPage } from './SetPasswordPage'

const fetchMock = vi.fn()

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => {
  vi.unstubAllGlobals()
})

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <SetPasswordPage />
    </MemoryRouter>,
  )
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

const PROBLEM_BASE = 'https://cems.starenergy.ca/errors'

describe('SetPasswordPage', () => {
  it('renders the form when the token validates', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ valid: true, email: 'auditor@cems.local' }))
    const { container } = renderAt('/set-password?token=valid-token')

    await waitFor(() =>
      expect(screen.getByLabelText(/new password/i)).toBeInTheDocument(),
    )
    expect(screen.getByText(/auditor@cems\.local/)).toBeInTheDocument()

    const results = await axe(container, {
      rules: { 'color-contrast': { enabled: false } },
    })
    expect(results).toHaveNoViolations()
  })

  it('shows the invalid-link message when the token is rejected', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          type: `${PROBLEM_BASE}/not-found`,
          title: 'Not Found',
          status: 404,
          detail: 'Invalid or expired link',
        }),
        { status: 404, headers: { 'Content-Type': 'application/problem+json' } },
      ),
    )
    renderAt('/set-password?token=expired')
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(/invalid or has expired/i),
    )
    expect(screen.queryByLabelText(/new password/i)).not.toBeInTheDocument()
  })

  it('shows the invalid-link message when no token is provided', async () => {
    renderAt('/set-password')
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(/invalid or has expired/i),
    )
  })

  it('submits the password and (on success) navigates to /login?welcome=true', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ valid: true, email: 'a@b.c' }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
    const user = userEvent.setup()
    renderAt('/set-password?token=valid')

    const input = await screen.findByLabelText(/new password/i)
    await user.type(input, 'a-strong-password-that-is-long-enough')
    await user.click(screen.getByRole('button', { name: /set password/i }))

    await waitFor(() => {
      const submitCall = fetchMock.mock.calls[1]
      expect(submitCall?.[0]).toContain('/api/v1/auth/password-set')
    })
  })
})
