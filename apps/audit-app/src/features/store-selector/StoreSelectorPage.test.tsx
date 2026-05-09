import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { axe } from 'vitest-axe'

const fetchMock = vi.fn()
const navigateMock = vi.fn()

/**
 * Helper that routes fetch calls by URL — stores vs in-progress draft.
 * Tests can override `draftsResponse` to surface the Resume CTA.
 */
function setupFetchMock(opts: {
  storesBody?: unknown
  storesStatus?: number
  draftsBody?: unknown
}): void {
  const storesBody = opts.storesBody ?? { stores: [], total: 0 }
  const draftsBody = opts.draftsBody ?? { audits: [], total: 0 }
  fetchMock.mockImplementation((input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input.toString()
    if (url.includes('/api/v1/audits')) {
      return Promise.resolve(jsonResponse(draftsBody))
    }
    return Promise.resolve(jsonResponse(storesBody, opts.storesStatus ?? 200))
  })
}

beforeEach(() => {
  fetchMock.mockReset()
  navigateMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => {
  vi.unstubAllGlobals()
  // Clear TanStack Query online-manager pause state in case any test triggers it.
  window.dispatchEvent(new Event('online'))
})

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return {
    ...actual,
    useNavigate: () => navigateMock,
  }
})

import { StoreSelectorPage } from './StoreSelectorPage'

function renderPage() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/']}>
        <StoreSelectorPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

const sampleStores = [
  { id: 'a', storeNumber: 'STORE-001', storeName: 'Sobeys A', banner: 'Sobeys', region: 'ON' },
  { id: 'b', storeNumber: 'STORE-002', storeName: 'Metro B', banner: 'Metro', region: 'QC' },
  { id: 'c', storeNumber: 'STORE-456', storeName: 'Sobeys C', banner: 'Sobeys', region: 'ON' },
]

describe('StoreSelectorPage', () => {
  it('shows the empty-state message when no stores are assigned (AC3)', async () => {
    setupFetchMock({ storesBody: { stores: [], total: 0 } })
    renderPage()
    await waitFor(() =>
      expect(
        screen.getByText('No stores assigned — contact your administrator'),
      ).toBeInTheDocument(),
    )
  })

  it('shows skeleton placeholders while loading (AC2)', async () => {
    let resolveStores!: (r: Response) => void
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString()
      if (url.includes('/api/v1/audits')) {
        return Promise.resolve(jsonResponse({ audits: [], total: 0 }))
      }
      return new Promise<Response>((resolve) => {
        resolveStores = resolve
      })
    })
    const { container } = renderPage()
    await waitFor(() =>
      expect(container.querySelector('ul[aria-hidden="true"]')).toBeInTheDocument(),
    )
    resolveStores(jsonResponse({ stores: [], total: 0 }))
  })

  it('renders the populated list and clicking a row navigates to /audit/new (AC1, AC5)', async () => {
    setupFetchMock({ storesBody: { stores: sampleStores, total: 3 } })
    const user = userEvent.setup()
    const { container } = renderPage()

    await waitFor(() => expect(screen.getByText(/STORE-001/)).toBeInTheDocument())

    const results = await axe(container, {
      rules: { 'color-contrast': { enabled: false } },
    })
    expect(results).toHaveNoViolations()

    await user.click(screen.getByRole('button', { name: /select store STORE-001/i }))
    expect(navigateMock).toHaveBeenCalledWith('/audit/new?storeNumber=STORE-001')
  })

  it('search filters by store number (AC4)', async () => {
    setupFetchMock({ storesBody: { stores: sampleStores, total: 3 } })
    const user = userEvent.setup()
    renderPage()

    await waitFor(() => expect(screen.getByText(/STORE-001/)).toBeInTheDocument())

    await user.type(screen.getByLabelText(/search stores/i), '456')

    await waitFor(() => {
      expect(screen.queryByText(/STORE-001/)).not.toBeInTheDocument()
      expect(screen.getByText(/STORE-456/)).toBeInTheDocument()
    })
  })

  it('search filters by store name (AC4, case-insensitive)', async () => {
    setupFetchMock({ storesBody: { stores: sampleStores, total: 3 } })
    const user = userEvent.setup()
    renderPage()

    await waitFor(() => expect(screen.getByText(/STORE-001/)).toBeInTheDocument())

    await user.type(screen.getByLabelText(/search stores/i), 'metro')

    await waitFor(() => {
      expect(screen.queryByText(/STORE-001/)).not.toBeInTheDocument()
      expect(screen.getByText(/STORE-002/)).toBeInTheDocument()
    })
  })

  it('renders Resume CTA when an in-progress DRAFT exists (Story 2.3 AC5)', async () => {
    setupFetchMock({
      storesBody: { stores: sampleStores, total: 3 },
      draftsBody: {
        audits: [
          {
            id: 'audit-xyz',
            storeId: 'a',
            status: 'DRAFT',
            createdAt: '2026-05-08T10:00:00.000Z',
            updatedAt: '2026-05-09T10:00:00.000Z',
          },
        ],
        total: 1,
      },
    })
    const user = userEvent.setup()
    renderPage()
    await waitFor(() =>
      expect(screen.getByTestId('resume-audit-callout')).toBeInTheDocument(),
    )
    expect(screen.getByText(/Resume audit at STORE-001/i)).toBeInTheDocument()
    await user.click(screen.getByTestId('resume-audit-button'))
    expect(navigateMock).toHaveBeenCalledWith('/audit/audit-xyz')
  })

  it('does NOT render Resume CTA when no in-progress draft exists', async () => {
    setupFetchMock({ storesBody: { stores: sampleStores, total: 3 } })
    renderPage()
    await waitFor(() => expect(screen.getByText(/STORE-001/)).toBeInTheDocument())
    expect(screen.queryByTestId('resume-audit-callout')).not.toBeInTheDocument()
  })
})
