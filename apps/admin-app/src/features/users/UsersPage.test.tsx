import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { axe } from 'vitest-axe'

const fetchMock = vi.fn()

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => {
  vi.unstubAllGlobals()
})

import { UsersPage } from './UsersPage'

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/users']}>
        <UsersPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

const sampleAuditors = [
  {
    id: 'user-1',
    tenantId: 'tenant-a',
    email: 'auditor1@cems.local',
    name: 'Aud One',
    role: 'AUDITOR',
    status: 'ACTIVE',
    assignedStoreIds: [],
    createdAt: '2026-05-07T00:00:00.000Z',
    updatedAt: '2026-05-07T00:00:00.000Z',
  },
]

const sampleClients = [
  {
    id: 'user-2',
    tenantId: 'tenant-a',
    email: 'client1@cems.local',
    name: 'Client One',
    role: 'CLIENT',
    status: 'ACTIVE',
    assignedStoreIds: ['store-001', 'store-002'],
    createdAt: '2026-05-07T00:00:00.000Z',
    updatedAt: '2026-05-07T00:00:00.000Z',
  },
]

describe('UsersPage', () => {
  it('shows empty state when no auditors exist', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ users: [], total: 0 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    renderPage()
    await waitFor(() => expect(screen.getByText(/no auditor accounts yet/i)).toBeInTheDocument())
  })

  it('renders the table when auditors exist', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ users: sampleAuditors, total: 1 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    const { container } = renderPage()
    await waitFor(() => expect(screen.getByText('Aud One')).toBeInTheDocument())
    expect(screen.getByText('auditor1@cems.local')).toBeInTheDocument()

    const results = await axe(container, {
      rules: { 'color-contrast': { enabled: false } },
    })
    expect(results).toHaveNoViolations()
  })

  it('switches to the Clients tab + shows the assigned-stores column (Story 1.4)', async () => {
    // First call: AUDITOR list (default tab) — empty.
    // Second call (after clicking Clients tab): CLIENT list with seeded row.
    fetchMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ users: [], total: 0 }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ users: sampleClients, total: 1 }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
    const user = userEvent.setup()
    renderPage()
    await waitFor(() => expect(screen.getByText(/no auditor accounts yet/i)).toBeInTheDocument())

    // Click the Clients tab.
    await user.click(screen.getByRole('tab', { name: /clients/i }))

    await waitFor(() => expect(screen.getByText('Client One')).toBeInTheDocument())
    // The Clients view shows the Assigned-stores column with the count.
    expect(screen.getByText('Assigned stores')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
    // The dialog button now reads "New client".
    expect(screen.getByRole('button', { name: /new client/i })).toBeInTheDocument()
  })

  it('opens the create-user dialog on button click', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ users: [], total: 0 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    const user = userEvent.setup()
    renderPage()
    await waitFor(() => expect(screen.getByText(/no auditor accounts yet/i)).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: /new auditor/i }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText(/create auditor account/i)).toBeInTheDocument()
    expect(within(dialog).getByLabelText(/name/i)).toBeInTheDocument()
    expect(within(dialog).getByLabelText(/email/i)).toBeInTheDocument()
  })
})
